import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExploreCount, useExploreFacets } from "@/hooks/useExploreFacets";
import { EMPTY_ADVANCED, GENDERS, capitalize, exploreRpcArgs, splitList, toggleInList, type ExploreSearch } from "@/lib/exploreFilters";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ExploreSearch;
  categories: { slug: string; label: string }[];
  city: string | null | undefined;
  onApply: (next: ExploreSearch) => void;
};

export function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn("shrink-0 h-9 px-3.5 rounded-full border text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-gold text-gold-foreground border-gold font-medium" : "bg-card text-foreground border-border hover:border-foreground/40", className)}>
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-4 border-b border-border">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function ExploreFiltersSheet({ open, onOpenChange, value, categories, city, onApply }: Props) {
  const facets = useExploreFacets();
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  const [debounced, setDebounced] = useState(draft);
  useEffect(() => { const t = setTimeout(() => setDebounced(draft), 400); return () => clearTimeout(t); }, [draft]);
  const args = useMemo(() => exploreRpcArgs(debounced, city), [debounced, city]);
  const count = useExploreCount(args, open);
  const set = (patch: Partial<ExploreSearch>) => setDraft((d) => ({ ...d, ...patch }));
  const cats = draft.categoria === "all" ? [] : splitList(draft.categoria);
  const pending = count.isFetching || debounced !== draft;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[100dvh] max-h-[100dvh] p-0 flex flex-col gap-0 rounded-none [&>button]:hidden">
        <header className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" aria-label="Fechar filtros" onClick={() => onOpenChange(false)}><ArrowLeft className="w-5 h-5" /></Button>
          <SheetTitle className="flex-1 text-base">Filtros</SheetTitle>
          <SheetDescription className="sr-only">Refine os produtos do Explorar</SheetDescription>
          <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, ...EMPTY_ADVANCED, categoria: "all", genero: "all" })}>Limpar tudo</Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 max-w-2xl w-full mx-auto">
          <Section title="Preço (MT)">
            <div className="flex items-center gap-3">
              <Input inputMode="decimal" aria-label="Preço mínimo" placeholder="Mínimo" value={draft.min} onChange={(e) => set({ min: e.target.value.replace(/[^\d.]/g, "") })} />
              <span className="text-muted-foreground">–</span>
              <Input inputMode="decimal" aria-label="Preço máximo" placeholder={facets.price_max ? `Até ${Math.ceil(facets.price_max)}` : "Máximo"} value={draft.max} onChange={(e) => set({ max: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>
          </Section>
          <Section title="Ofertas e disponibilidade">
            {([["desconto", "Com desconto"], ["stock", "Disponível (não reservado)"], ["unica", "Peça única"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between py-2 min-h-11 cursor-pointer">
                <span className="text-sm">{label}</span>
                <Switch checked={draft[k]} onCheckedChange={(v) => set({ [k]: v } as Partial<ExploreSearch>)} />
              </label>
            ))}
          </Section>
          <Section title="Género">
            <div className="flex flex-wrap gap-2">{GENDERS.map((g) => <Chip key={g.value} active={draft.genero === g.value} onClick={() => set({ genero: g.value })}>{g.label}</Chip>)}</div>
          </Section>
          {categories.length > 0 && (
            <Section title="Categoria">
              <div className="flex flex-wrap gap-2">
                <Chip active={cats.length === 0} onClick={() => set({ categoria: "all" })}>Todas</Chip>
                {categories.map((c) => <Chip key={c.slug} active={cats.includes(c.slug)} onClick={() => set({ categoria: toggleInList(draft.categoria === "all" ? "" : draft.categoria, c.slug) || "all" })}>{c.label}</Chip>)}
              </div>
            </Section>
          )}
          {facets.sizes.length > 0 && (
            <Section title="Tamanho">
              <div className="flex flex-wrap gap-2">{facets.sizes.map((s) => <Chip key={s} className="min-w-11" active={splitList(draft.tamanhos).includes(s)} onClick={() => set({ tamanhos: toggleInList(draft.tamanhos, s) })}>{s}</Chip>)}</div>
            </Section>
          )}
          {facets.colors.length > 0 && (
            <Section title="Cor">
              <div className="flex flex-wrap gap-2">{facets.colors.map((c) => <Chip key={c} active={splitList(draft.cores).includes(c)} onClick={() => set({ cores: toggleInList(draft.cores, c) })}>{capitalize(c)}</Chip>)}</div>
            </Section>
          )}
          {facets.sellers.length > 0 && (
            <Section title="Loja">
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.loja} onClick={() => set({ loja: "" })}>Todas</Chip>
                {facets.sellers.map((s) => <Chip key={s.id} active={draft.loja === s.id} onClick={() => set({ loja: draft.loja === s.id ? "" : s.id })}>{s.name}</Chip>)}
              </div>
            </Section>
          )}
          <div className="h-6" />
        </div>
        <footer className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background">
          <Button className="w-full h-12 max-w-2xl mx-auto flex bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => { onApply(draft); onOpenChange(false); }}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" aria-label="A contar" /> : `Ver ${count.data ?? 0}${(count.data ?? 0) >= 10000 ? "+" : ""} produtos`}
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
