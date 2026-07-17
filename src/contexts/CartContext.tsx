import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";

export type CartProduct = {
  id: string;
  title: string;
  base_price: number;
  shipping_fee: number | null;
  images: unknown;
  is_unique: boolean;
  status: "available" | "reserved" | "sold";
  reserved_until: string | null;
  reserved_by: string | null;
};

export type CartVariation = {
  id: string;
  size: string | null;
  color: string | null;
  price: number | null;
  stock: number;
} | null;

export type CartItem = {
  product_id: string;
  variation_id: string | null;
  quantity: number;
  product: CartProduct;
  variation: CartVariation;
};

type CartCtx = {
  items: CartItem[];
  loading: boolean;
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  addItem: (productId: string, variationId: string | null, quantity?: number) => Promise<boolean>;
  removeItem: (productId: string, variationId: string | null) => Promise<void>;
  updateQuantity: (productId: string, variationId: string | null, qty: number) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CartCtx | undefined>(undefined);
const STORAGE_KEY = "derdalax_cart_v1";
const SHIPPING_FEE = 100;
const FREE_SHIPPING_THRESHOLD = 2500;

type LocalRow = { product_id: string; variation_id: string | null; quantity: number };

function readLocal(): LocalRow[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function writeLocal(rows: LocalRow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<string | null>(null);

  const hydrate = useCallback(async (rows: LocalRow[]): Promise<CartItem[]> => {
    if (rows.length === 0) return [];
    const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
    const variationIds = Array.from(new Set(rows.map((r) => r.variation_id).filter(Boolean) as string[]));
    const [{ data: products }, { data: variations }] = await Promise.all([
      supabase.from("products").select("id,title,base_price,shipping_fee,images,is_unique,status,reserved_until,reserved_by").in("id", productIds),
      variationIds.length
        ? supabase.from("product_variations").select("id,size,color,price,stock").in("id", variationIds)
        : Promise.resolve({ data: [] as CartVariation[] }),
    ]);
    const pMap = new Map((products ?? []).map((p) => [p.id, p as CartProduct]));
    const vMap = new Map(((variations ?? []) as NonNullable<CartVariation>[]).map((v) => [v.id, v]));
    return rows
      .map((r) => {
        const p = pMap.get(r.product_id);
        if (!p) return null;
        return {
          product_id: r.product_id,
          variation_id: r.variation_id,
          quantity: r.quantity,
          product: p,
          variation: r.variation_id ? vMap.get(r.variation_id) ?? null : null,
        } as CartItem;
      })
      .filter((x): x is CartItem => x !== null);
  }, []);

  const loadFromServer = useCallback(async (uid: string) => {
    const { data } = await supabase.from("cart_items").select("product_id,variation_id,quantity").eq("user_id", uid);
    const rows: LocalRow[] = (data ?? []).map((r) => ({ product_id: r.product_id, variation_id: r.variation_id, quantity: r.quantity }));
    const hydrated = await hydrate(rows);
    setItems(hydrated);
  }, [hydrate]);

  const loadFromLocal = useCallback(async () => {
    const hydrated = await hydrate(readLocal());
    setItems(hydrated);
  }, [hydrate]);

  // Initial load + react to user changes (merge local on login)
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      if (user) {
        // If user changed (login), merge local cart into server
        const local = readLocal();
        if (local.length > 0 && userRef.current !== user.id) {
          for (const row of local) {
            await supabase.from("cart_items").upsert({
              user_id: user.id,
              product_id: row.product_id,
              variation_id: row.variation_id,
              quantity: row.quantity,
            }, { onConflict: "user_id,product_id,variation_id" });
          }
          writeLocal([]);
        }
        userRef.current = user.id;
        await loadFromServer(user.id);
      } else {
        userRef.current = null;
        await loadFromLocal();
      }
      setLoading(false);
    };
    run();
  }, [user, loadFromServer, loadFromLocal]);

  const refresh = useCallback(async () => {
    if (user) await loadFromServer(user.id);
    else await loadFromLocal();
  }, [user, loadFromServer, loadFromLocal]);

  // Auto-refresh every 30s to pick up expired reservations
  useEffect(() => {
    const t = setInterval(() => { refresh(); }, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  const persistAdd = async (productId: string, variationId: string | null, qty: number) => {
    if (user) {
      const existing = items.find((i) => i.product_id === productId && i.variation_id === variationId);
      const newQty = (existing?.quantity ?? 0) + qty;
      await supabase.from("cart_items").upsert({
        user_id: user.id, product_id: productId, variation_id: variationId, quantity: newQty,
      }, { onConflict: "user_id,product_id,variation_id" });
    } else {
      const rows = readLocal();
      const idx = rows.findIndex((r) => r.product_id === productId && r.variation_id === variationId);
      if (idx >= 0) rows[idx].quantity += qty;
      else rows.push({ product_id: productId, variation_id: variationId, quantity: qty });
      writeLocal(rows);
    }
  };

  const addItem = useCallback(async (productId: string, variationId: string | null, quantity = 1): Promise<boolean> => {
    const { data: prod } = await supabase
      .from("products")
      .select("id,is_unique,status,reserved_by")
      .eq("id", productId).maybeSingle();
    if (!prod) { toast.error("Produto não encontrado"); return false; }
    if (prod.status === "sold") { toast.error("Produto vendido"); return false; }

    if (prod.is_unique) {
      if (!user) { toast.error("Inicie sessão para reservar peças únicas"); return false; }
      // Check existing in cart
      if (items.some((i) => i.product_id === productId)) {
        toast.info("Esta peça única já está no seu carrinho");
        return true;
      }
      const { data, error } = await supabase.rpc("reserve_product", { _product_id: productId });
      if (error) { toast.error(error.message); return false; }
      const res = data as { ok: boolean; error?: string; reserved?: boolean; until?: string } | null;
      if (!res?.ok) {
        toast.error(res?.error === "unavailable" ? "Peça indisponível no momento" : "Não foi possível reservar");
        return false;
      }
      await persistAdd(productId, variationId, 1);
      await refresh();
      toast.success("✅ Peça reservada por 15 minutos");
      return true;
    }

    await persistAdd(productId, variationId, quantity);
    await refresh();
    toast.success("Adicionado ao carrinho");
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, items, refresh]);

  const removeItem = useCallback(async (productId: string, variationId: string | null) => {
    const item = items.find((i) => i.product_id === productId && i.variation_id === variationId);
    if (user) {
      let q = supabase.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId);
      q = variationId ? q.eq("variation_id", variationId) : q.is("variation_id", null);
      await q;
    } else {
      writeLocal(readLocal().filter((r) => !(r.product_id === productId && r.variation_id === variationId)));
    }
    if (item?.product.is_unique && user) {
      await supabase.rpc("release_product", { _product_id: productId });
    }
    await refresh();
  }, [items, user, refresh]);

  const updateQuantity = useCallback(async (productId: string, variationId: string | null, qty: number) => {
    if (qty < 1) { await removeItem(productId, variationId); return; }
    const item = items.find((i) => i.product_id === productId && i.variation_id === variationId);
    if (item?.product.is_unique) { toast.info("Peças únicas têm quantidade 1"); return; }
    if (user) {
      let q = supabase.from("cart_items").update({ quantity: qty }).eq("user_id", user.id).eq("product_id", productId);
      q = variationId ? q.eq("variation_id", variationId) : q.is("variation_id", null);
      await q;
    } else {
      const rows = readLocal();
      const idx = rows.findIndex((r) => r.product_id === productId && r.variation_id === variationId);
      if (idx >= 0) { rows[idx].quantity = qty; writeLocal(rows); }
    }
    await refresh();
  }, [items, user, refresh, removeItem]);

  const clear = useCallback(async () => {
    if (user) {
      await supabase.from("cart_items").delete().eq("user_id", user.id);
    } else {
      writeLocal([]);
    }
    setItems([]);
  }, [user]);

  const { subtotal, count } = useMemo(() => {
    let s = 0; let c = 0;
    for (const i of items) {
      const price = i.variation?.price ?? Number(i.product.base_price);
      s += price * i.quantity;
      c += i.quantity;
    }
    return { subtotal: s, count: c };
  }, [items]);

  const shipping = subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  return (
    <Ctx.Provider value={{ items, loading, count, subtotal, shipping, total, addItem, removeItem, updateQuantity, clear, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
