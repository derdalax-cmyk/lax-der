// Gerador de nome/descrição/material a partir das fotografias do produto.
// Só corre no servidor: a chave da IA nunca chega ao navegador.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_IMAGES = 3;

/** Modelo configurável no servidor (variável de ambiente), sem tocar no frontend. */
export function aiProductModel(): string {
  return process.env["AI_PRODUCT_MODEL"] || "openai/gpt-5-nano";
}

const SYSTEM_PROMPT = `És um catalogador de vestuário de uma loja em Moçambique.
Analisa as fotografias e responde em JSON (português de Portugal) com exactamente estas chaves:
{"nome": "...", "descricao": "...", "material": "..."}
Regras:
- nome: curto e comercial (máx. 60 caracteres), sem preços nem marcas inventadas.
- descricao: 1 a 2 frases (máx. 300 caracteres) apenas sobre o que é visível na peça.
- material: só se houver etiqueta legível ou evidência clara. Caso contrário escreve exactamente "Não identificado".
- Nunca inventes informação. Não incluas categoria, cor, tamanho, preço, stock ou marca no JSON.
Responde apenas com o objecto JSON.`;

/** Converte URLs do bucket "products" em data URLs reduzidas (menos custo por imagem). */
export async function imagesToDataUrls(urls: string[]): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: string[] = [];
  for (const url of urls.slice(0, MAX_IMAGES)) {
    const match = url.match(/\/products\/(.+?)(\?|$)/);
    if (!match) continue;
    const path = decodeURIComponent(match[1]);
    const { data, error } = await supabaseAdmin.storage
      .from("products")
      .download(path, { transform: { width: 512, quality: 70, resize: "contain" } });
    if (error || !data) continue;
    const buf = Buffer.from(await data.arrayBuffer());
    const type = data.type && data.type.startsWith("image/") ? data.type : "image/jpeg";
    out.push(`data:${type};base64,${buf.toString("base64")}`);
  }
  return out;
}

export type AiProductData = { nome: string; descricao: string; material: string };

export async function generateProductData(dataUrls: string[]): Promise<AiProductData> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("ai_unconfigured");

  const model = aiProductModel();
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Gera o JSON com nome, descricao e material desta peça de roupa." },
            ...dataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[ai-product] gateway ${response.status}: ${body.slice(0, 500)}`);
    if (response.status === 429) throw new Error("ai_busy");
    if (response.status === 402 || response.status === 403) throw new Error("ai_unavailable");
    if (response.status === 400) throw new Error("ai_bad_image");
    throw new Error("ai_unavailable");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  let parsed: Partial<AiProductData> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error("ai_bad_image");
  }

  const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const nome = clean(parsed.nome, 80);
  if (!nome) throw new Error("ai_bad_image");

  return {
    nome,
    descricao: clean(parsed.descricao, 400),
    material: clean(parsed.material, 60) || "Não identificado",
  };
}
