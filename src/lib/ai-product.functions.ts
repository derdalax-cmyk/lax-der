import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { sellerId: string; images: string[]; productId?: string | null };

const MESSAGES: Record<string, string> = {
  forbidden: "Não tem autorização para usar o gerador nesta loja.",
  no_images: "Adicione pelo menos uma fotografia antes de gerar.",
  ai_bad_image: "Não foi possível analisar esta imagem. Tente utilizar uma fotografia mais nítida.",
  ai_busy: "Muitos pedidos ao mesmo tempo. Tente novamente em alguns segundos.",
  ai_unavailable: "Não foi possível gerar os dados neste momento. Tente novamente.",
  ai_unconfigured: "Não foi possível gerar os dados neste momento. Tente novamente.",
};

export const generateProductFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => {
    const sellerId = String(data?.sellerId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(sellerId)) throw new Error("forbidden");
    // Todas as fotos da mesma peça (até 5) são analisadas numa só chamada.
    const images = Array.isArray(data?.images) ? data.images.filter((u) => typeof u === "string").slice(0, 5) : [];
    const productId = data?.productId ? String(data.productId) : null;
    return { sellerId, images, productId };
  })
  .handler(async ({ data, context }) => {
    // Autorização no servidor: utilizador + loja + permissão + IA activada nessa loja.
    const { data: allowed, error: authError } = await context.supabase.rpc("can_use_ai_generator", {
      _seller_id: data.sellerId,
    });
    if (authError || allowed !== true) {
      return { ok: false as const, error: MESSAGES.forbidden };
    }
    if (data.images.length === 0) {
      return { ok: false as const, error: MESSAGES.no_images };
    }

    const { imagesToDataUrls, generateProductData, aiProductModel } = await import("./ai-product.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O productId (quando presente) tem de pertencer à loja autorizada.
    if (data.productId) {
      const { data: prod } = await supabaseAdmin
        .from("products").select("id")
        .eq("id", data.productId).eq("seller_id", data.sellerId).maybeSingle();
      if (!prod) return { ok: false as const, error: MESSAGES.forbidden };
    }

    // Cada imagem tem de pertencer à loja: pasta sellers/<dono> ou pasta de um produto da loja.
    const { data: sellerRow } = await supabaseAdmin
      .from("sellers").select("user_id").eq("id", data.sellerId).maybeSingle();
    const ownerId = (sellerRow as { user_id?: string } | null)?.user_id ?? null;
    const paths = data.images
      .map((u) => u.match(/\/products\/(.+?)(\?|$)/)?.[1])
      .filter((p): p is string => !!p)
      .map((p) => decodeURIComponent(p));
    const firstSegments = [...new Set(paths.map((p) => p.split("/")[0]))];
    const productIds = firstSegments.filter((s) => /^[0-9a-f-]{36}$/i.test(s));
    const { data: ownedRows } = productIds.length
      ? await supabaseAdmin.from("products").select("id").in("id", productIds).eq("seller_id", data.sellerId)
      : { data: [] as { id: string }[] };
    const ownedIds = new Set((ownedRows ?? []).map((r) => r.id));
    const allOwned = paths.length > 0 && paths.every((p) => {
      const seg = p.split("/");
      if (seg[0] === "sellers") return !!ownerId && seg[1] === ownerId;
      return ownedIds.has(seg[0]);
    });
    if (!allOwned) return { ok: false as const, error: MESSAGES.forbidden };

    const model = aiProductModel();

    const log = async (status: string, images_count: number, result: unknown, error?: string) => {
      await supabaseAdmin.from("ai_generation_logs").insert({
        user_id: context.userId,
        seller_id: data.sellerId,
        product_id: data.productId,
        model,
        images_count,
        status,
        result: result as never,
        error: error ?? null,
      });
    };

    try {
      const dataUrls = await imagesToDataUrls(data.images);
      if (dataUrls.length === 0) {
        await log("error", 0, null, "images_unreadable");
        return { ok: false as const, error: MESSAGES.ai_bad_image };
      }
      const result = await generateProductData(dataUrls);
      await log("success", dataUrls.length, result);
      return { ok: true as const, data: result };
    } catch (e) {
      const code = (e as Error).message;
      await log("error", data.images.length, null, code);
      return { ok: false as const, error: MESSAGES[code] ?? MESSAGES.ai_unavailable };
    }
  });
