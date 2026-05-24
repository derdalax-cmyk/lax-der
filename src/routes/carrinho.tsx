import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, Minus, Plus } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { formatMZN } from "@/components/ProductCard";
import { CountdownTimer } from "@/components/cart/CountdownTimer";

export const Route = createFileRoute("/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho · DERDALAX" }, { name: "description", content: "O seu carrinho de compras." }] }),
  component: CarrinhoPage,
});

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const f = images[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "url" in f) return String((f as { url: unknown }).url);
  }
  return null;
}

function CarrinhoPage() {
  const navigate = useNavigate();
  const { items, loading, subtotal, shipping, total, updateQuantity, removeItem, refresh } = useCart();

  if (loading) return <div className="max-w-[1200px] mx-auto px-5 py-16 text-muted-foreground">A carregar carrinho…</div>;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-20 text-center">
        <h1 className="font-display text-4xl mb-3">Carrinho vazio</h1>
        <p className="text-muted-foreground mb-6">Adicione peças ao carrinho para começar.</p>
        <Link to="/produtos" className="inline-flex bg-gold text-ink rounded-md px-5 py-2.5 font-medium hover:bg-gold/90">Explorar produtos</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-10 md:py-14">
      <h1 className="font-display text-3xl md:text-4xl mb-8">Carrinho</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <ul className="lg:col-span-2 space-y-4">
          {items.map((it) => {
            const img = firstImage(it.product.images);
            const price = it.variation?.price ?? Number(it.product.base_price);
            const key = `${it.product_id}-${it.variation_id ?? "_"}`;
            return (
              <li key={key} className="flex gap-4 bg-card border border-border rounded-xl p-4">
                <Link to="/produto/$id" params={{ id: it.product_id }} className="flex-none w-24 h-32 bg-secondary rounded-md overflow-hidden">
                  {img ? <img src={img} alt={it.product.title} className="w-full h-full object-cover" /> : null}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to="/produto/$id" params={{ id: it.product_id }} className="font-medium line-clamp-1 hover:text-gold">{it.product.title}</Link>
                      {(it.variation?.size || it.variation?.color) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[it.variation.size, it.variation.color].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {it.product.is_unique && (
                        <span className="inline-block mt-1 text-[10px] tracking-wider bg-gold text-ink px-2 py-0.5 rounded font-semibold">PEÇA ÚNICA</span>
                      )}
                    </div>
                    <button onClick={() => removeItem(it.product_id, it.variation_id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {it.product.is_unique && it.product.reserved_until && (
                    <div className="mt-2 text-xs text-success font-medium">
                      <CountdownTimer until={it.product.reserved_until} onExpire={refresh} />
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center border border-border rounded">
                      <button
                        disabled={it.product.is_unique}
                        onClick={() => updateQuantity(it.product_id, it.variation_id, it.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center disabled:opacity-30"
                      ><Minus className="w-3 h-3" /></button>
                      <span className="w-8 text-center text-sm font-medium">{it.quantity}</span>
                      <button
                        disabled={it.product.is_unique || (!!it.variation && it.quantity >= it.variation.stock)}
                        onClick={() => updateQuantity(it.product_id, it.variation_id, it.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center disabled:opacity-30"
                      ><Plus className="w-3 h-3" /></button>
                    </div>
                    <p className="font-medium">{formatMZN(price * it.quantity)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="bg-card border border-border rounded-xl p-5 h-fit space-y-3">
          <h2 className="font-display text-xl mb-2">Resumo</h2>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatMZN(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Frete</span><span>{shipping === 0 ? "Grátis" : formatMZN(shipping)}</span></div>
          {subtotal < 2500 && subtotal > 0 && (
            <p className="text-xs text-muted-foreground">Faltam {formatMZN(2500 - subtotal)} para frete grátis.</p>
          )}
          <div className="flex justify-between font-medium text-lg pt-3 border-t border-border"><span>Total</span><span>{formatMZN(total)}</span></div>
          <Button onClick={() => navigate({ to: "/checkout" })} className="w-full bg-gold text-ink hover:bg-gold/90 mt-2">
            Finalizar compra
          </Button>
          <Link to="/produtos" className="block text-center text-sm text-muted-foreground hover:text-foreground">Continuar a comprar</Link>
        </aside>
      </div>
    </div>
  );
}
