import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, Minus, Plus, X, ChevronLeft, ChevronRight, Store, ChevronRight as ChevRight } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { useFavorites } from "@/hooks/useFavorites";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProductCard, type ProductCardData, formatMZN } from "@/components/ProductCard";
import { CountdownTimer } from "@/components/cart/CountdownTimer";
import { WaitingListButton } from "@/components/cart/WaitingListButton";
import { cn } from "@/lib/utils";
import { ContactSellerButton } from "@/components/ContactSellerButton";
import { toast } from "sonner";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({ meta: [{ title: "Produto · DERDALAX" }] }),
  component: ProdutoDetalhe,
});


type Product = {
  id: string;
  title: string;
  description: string | null;
  base_price: number;
  shipping_fee: number | null;
  category: string | null;
  images: unknown;
  is_unique: boolean;
  status: "available" | "reserved" | "sold";
  reserved_by: string | null;
  reserved_until: string | null;
  seller_id: string | null;
  city: string | null;
};

type PublicSeller = {
  id: string;
  store_name: string;
  logo_url: string | null;
  city: string | null;
  rating: number | null;
  total_reviews: number | null;
};


type Variation = {
  id: string;
  size: string | null;
  color: string | null;
  stock: number;
  price: number | null;
  is_active: boolean;
};

function imagesArr(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.map((i) => {
    if (typeof i === "string") return i;
    if (i && typeof i === "object" && "url" in i) return String((i as { url: unknown }).url);
    return "";
  }).filter(Boolean);
}

type Meta = { gender?: string; material?: string; color?: string; brand?: string; default_size?: string; in_stock?: boolean };

function parseMeta(desc: string | null): { text: string; meta: Meta } {
  if (!desc) return { text: "", meta: {} };
  const m = desc.match(/<!--META:(.+?)-->/s);
  if (!m) return { text: desc.trim(), meta: {} };
  try {
    return { text: desc.replace(m[0], "").trim(), meta: JSON.parse(m[1]) as Meta };
  } catch {
    return { text: desc.replace(m[0], "").trim(), meta: {} };
  }
}

function ProdutoDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorites();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [seller, setSeller] = useState<PublicSeller | null>(null);


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).maybeSingle(),
        supabase.from("product_variations").select("*").eq("product_id", id).eq("is_active", true),
      ]);
      if (cancelled) return;
      setProduct(p as Product | null);
      setVariations((v ?? []) as Variation[]);
      setImgIdx(0); setSize(null); setColor(null); setQty(1);
      setSeller(null);
      const sellerId = (p as Product | null)?.seller_id;
      if (sellerId) {
        supabase.rpc("get_public_seller", { _id: sellerId }).then(({ data: s }) => {
          if (!cancelled) setSeller((s ?? null) as unknown as PublicSeller | null);
        });
      }
      if (p?.category) {
        let relQ = supabase
          .from("products")
          .select("id,title,base_price,shipping_fee,images,is_unique,status,category")
          .eq("category", p.category)
          .neq("id", id)
          .neq("status", "sold");
        // Produtos relacionados da mesma cidade do produto atual (ou globais/admin)
        if (p.city) relQ = relQ.or(`city.eq.${p.city},city.is.null`);
        const { data: rel } = await relQ.limit(5);
        if (!cancelled) setRelated((rel ?? []) as ProductCardData[]);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const imgs = useMemo(() => product ? imagesArr(product.images) : [], [product]);
  const { text: descText, meta } = useMemo(() => parseMeta(product?.description ?? null), [product]);
  const specs = useMemo(() => ([
    { label: "Gênero", value: meta.gender },
    { label: "Marca", value: meta.brand },
    { label: "Material", value: meta.material },
    { label: "Cor", value: meta.color },
    { label: "Tamanho padrão", value: meta.default_size },
  ].filter((s) => s.value && String(s.value).trim())), [meta]);
  const sizes = useMemo(() => Array.from(new Set(variations.map((v) => v.size).filter(Boolean) as string[])), [variations]);
  const colors = useMemo(() => Array.from(new Set(variations.map((v) => v.color).filter(Boolean) as string[])), [variations]);

  // Auto-seleciona quando só existe uma opção
  useEffect(() => {
    if (sizes.length === 1 && !size) setSize(sizes[0]);
    if (colors.length === 1 && !color) setColor(colors[0]);
  }, [sizes, colors, size, color]);

  // Variações compatíveis com a seleção atual (dimensões não escolhidas não filtram)
  const matching = useMemo(() => variations.filter((v) =>
    (!size || v.size === size) && (!color || v.color === color)
  ), [variations, size, color]);

  const selectedVariation = useMemo(() => {
    if (sizes.length > 0 && !size) return undefined;
    if (colors.length > 0 && !color) return undefined;
    return matching[0];
  }, [matching, sizes, colors, size, color]);

  const stockAvailable = useMemo(() => {
    if (variations.length === 0) return product?.status === "available" ? 99 : 0;
    if (selectedVariation) return selectedVariation.stock;
    return matching.reduce((a, v) => a + v.stock, 0);
  }, [variations, matching, selectedVariation, product]);

  const basePrice = Number(product?.base_price ?? 0);
  const candidatePrices = useMemo(
    () => (matching.length > 0 ? matching : variations).map((v) => Number(v.price ?? basePrice)),
    [matching, variations, basePrice],
  );
  const minPrice = candidatePrices.length > 0 ? Math.min(...candidatePrices) : basePrice;
  const hasPriceRange = candidatePrices.length > 1 && Math.max(...candidatePrices) !== minPrice;
  const effectivePrice = selectedVariation ? Number(selectedVariation.price ?? basePrice) : minPrice;
  const showFromPrice = !selectedVariation && hasPriceRange;

  const reservedByOther = !!product?.is_unique && product.status === "reserved" && product.reserved_by !== user?.id;
  const reservedByMe = !!product?.is_unique && product.status === "reserved" && product.reserved_by === user?.id;

  const canBuy = !!product && product.status !== "sold" && !reservedByOther && stockAvailable > 0 &&
    (sizes.length === 0 || !!size) && (colors.length === 0 || !!color);

  const reload = async () => {
    const { data: p } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    setProduct(p as Product | null);
  };

  const handleAddToCart = async (): Promise<boolean> => {
    if (!product) return false;
    if (reservedByOther) { toast.error("Peça indisponível"); return false; }
    if (!canBuy) { toast.error("Selecione variação disponível"); return false; }
    setAdding(true);
    const ok = await addItem(product.id, selectedVariation?.id ?? null, qty);
    setAdding(false);
    if (ok) await reload();
    return ok;
  };


  if (loading) {
    return <div className="max-w-[1200px] mx-auto px-5 py-16">
      <div className="grid md:grid-cols-2 gap-8 animate-pulse">
        <div className="aspect-square bg-secondary rounded-xl" />
        <div className="space-y-3">
          <div className="h-8 bg-secondary rounded w-2/3" />
          <div className="h-6 bg-secondary rounded w-1/3" />
          <div className="h-24 bg-secondary rounded" />
        </div>
      </div>
    </div>;
  }

  if (!product) {
    return <div className="max-w-2xl mx-auto px-5 py-20 text-center">
      <h1 className="font-display text-3xl mb-3">Produto não encontrado</h1>
      <Link to="/produtos" className="text-gold underline">Voltar ao catálogo</Link>
    </div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-10 md:py-14">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link to="/produtos" className="hover:text-foreground">Produtos</Link>
        {product.category && <> <span className="mx-1">/</span> <span className="capitalize">{product.category}</span></>}
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <div className="relative aspect-square bg-secondary rounded-xl overflow-hidden">
            {imgs[imgIdx] ? (
              <img
                src={imgs[imgIdx]} alt={product.title}
                onClick={() => setZoom(true)}
                className="w-full h-full object-cover cursor-zoom-in"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sem imagem</div>
            )}
            {product.is_unique && (
              <span className="absolute top-3 left-3 bg-gold text-ink text-xs tracking-wider px-3 py-1.5 rounded font-semibold">PEÇA ÚNICA</span>
            )}
            {imgs.length > 1 && (
              <>
                <button onClick={() => setImgIdx((i) => (i - 1 + imgs.length) % imgs.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/90 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setImgIdx((i) => (i + 1) % imgs.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/90 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {imgs.map((src, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={cn("flex-none w-16 h-16 rounded-md overflow-hidden border-2", i === imgIdx ? "border-gold" : "border-transparent")}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-3xl md:text-4xl">{product.title}</h1>
          <p className="mt-2 text-2xl font-medium">
            {showFromPrice && <span className="text-sm text-muted-foreground mr-1.5">A partir de</span>}
            {formatMZN(Number(effectivePrice))}
          </p>
          <p className="mt-1 text-sm">
            {Number(product.shipping_fee ?? 0) > 0 ? (
              <span className="text-muted-foreground">Frete: <span className="font-medium text-foreground">{formatMZN(Number(product.shipping_fee))}</span></span>
            ) : (
              <span className="inline-flex items-center gap-1 text-green font-medium">Frete Grátis</span>
            )}
          </p>
          {reservedByOther && (
            <p className="mt-2 text-sm text-destructive font-medium">Indisponível temporariamente — reservado por outro cliente.</p>
          )}
          {reservedByMe && product.reserved_until && (
            <p className="mt-2 text-sm text-gold font-medium">
              <CountdownTimer until={product.reserved_until} onExpire={reload} />
            </p>
          )}


          {descText && (
            <p className="mt-5 text-muted-foreground whitespace-pre-line leading-relaxed">{descText}</p>
          )}

          {specs.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-border pt-5">
              {specs.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dt className="text-muted-foreground text-xs uppercase tracking-wide">{s.label}</dt>
                  <dd className="font-medium capitalize">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {sizes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Tamanho</h3>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const stock = variations.filter((v) => v.size === s && (!color || v.color === color)).reduce((a, v) => a + v.stock, 0);
                  const disabled = stock === 0;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <button disabled={disabled} onClick={() => setSize((prev) => (prev === s ? null : s))}
                        title={disabled ? "Sem estoque" : `${stock} disponível${stock === 1 ? "" : "is"}`}
                        className={cn("min-w-12 h-10 px-3 rounded border text-sm transition",
                          size === s ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
                          disabled && "opacity-40 line-through cursor-not-allowed")}
                      >{s}</button>
                      <span className="text-[11px] leading-none text-muted-foreground">{disabled ? "esgotado" : `${stock} disp.`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Cor</h3>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const stock = variations.filter((v) => v.color === c && (!size || v.size === size)).reduce((a, v) => a + v.stock, 0);
                  const disabled = stock === 0;
                  return (
                    <div key={c} className="flex flex-col items-center gap-1">
                      <button disabled={disabled} onClick={() => setColor((prev) => (prev === c ? null : c))}
                        title={disabled ? "Sem estoque" : `${stock} disponível${stock === 1 ? "" : "is"}`}
                        className={cn("px-3 h-10 rounded border text-sm capitalize",
                          color === c ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground",
                          disabled && "opacity-40 line-through cursor-not-allowed")}
                      >{c}</button>
                      <span className="text-[11px] leading-none text-muted-foreground">{disabled ? "esgotado" : `${stock} disp.`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          <div className="mt-6">
            <h3 className="text-sm font-medium mb-2">Quantidade</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                <span className="w-10 text-center font-medium">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(stockAvailable || 1, q + 1))} className="w-10 h-10 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
              {stockAvailable > 0 && stockAvailable < 10 && variations.length > 0 && (
                <span className="text-sm text-muted-foreground">Restam {stockAvailable}</span>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button onClick={handleAddToCart} disabled={!canBuy || adding} variant="outline" className="flex-1">
              {adding ? "A adicionar…" : "Adicionar ao carrinho"}
            </Button>
            <Button onClick={async () => { const ok = await handleAddToCart(); if (ok) navigate({ to: "/carrinho" }); }} disabled={!canBuy || adding} className="flex-1 bg-gold text-ink hover:bg-gold/90">
              Comprar agora
            </Button>
            <button onClick={() => toggle(product.id)} aria-label="Favoritar" className="h-10 w-10 flex items-center justify-center border border-border rounded">
              <Heart className={cn("w-5 h-5", isFavorite(product.id) ? "fill-destructive text-destructive" : "")} />
            </button>
          </div>

          {reservedByOther && (
            <div className="mt-4">
              <WaitingListButton productId={product.id} />
            </div>
          )}

          {seller && (
            <Link
              to="/loja/$id"
              params={{ id: seller.id }}
              className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-gold/50"
            >
              <div className="w-11 h-11 rounded-lg bg-secondary overflow-hidden grid place-items-center shrink-0">
                {seller.logo_url ? (
                  <img src={seller.logo_url} alt={seller.store_name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{seller.store_name}</p>
                <span className="flex items-center gap-1.5">
                  <StarRating value={Number(seller.rating ?? 0)} size={13} />
                  <span className="text-xs text-muted-foreground">
                    {Number(seller.rating ?? 0).toFixed(1)} ({seller.total_reviews ?? 0})
                  </span>
                </span>
              </div>
              <ChevRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          )}

          {seller && (
            <ContactSellerButton sellerId={seller.id} productId={product.id} className="mt-3 w-full" />
          )}
        </div>


      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl mb-5">Também pode gostar</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} isFavorite={isFavorite(p.id)} onToggleFavorite={toggle} />
            ))}
          </div>
        </section>
      )}

      {zoom && imgs[imgIdx] && (
        <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out">
          <button onClick={() => setZoom(false)} className="absolute top-4 right-4 text-white"><X className="w-6 h-6" /></button>
          <img src={imgs[imgIdx]} alt={product.title} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
