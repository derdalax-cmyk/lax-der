import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type Variation = {
  id?: string;
  size: string;
  color: string;
  stock: number;
  price: number | null;
};

type Props = {
  value: Variation[];
  onChange: (v: Variation[]) => void;
  disabled?: boolean;
};

export function VariationsTable({ value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState<Variation>({ size: "", color: "", stock: 1, price: null });

  const add = () => {
    if (!draft.size && !draft.color) return;
    onChange([...value, draft]);
    setDraft({ size: "", color: "", stock: 1, price: null });
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const update = (idx: number, patch: Partial<Variation>) =>
    onChange(value.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Tamanho</th>
              <th className="px-3 py-2 font-medium">Cor</th>
              <th className="px-3 py-2 font-medium w-24">Estoque</th>
              <th className="px-3 py-2 font-medium w-32">Preço (MT)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {value.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-xs">Sem variações</td></tr>
            )}
            {value.map((v, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-2 py-1"><Input value={v.size} onChange={(e) => update(i, { size: e.target.value })} disabled={disabled} className="h-8" /></td>
                <td className="px-2 py-1"><Input value={v.color} onChange={(e) => update(i, { color: e.target.value })} disabled={disabled} className="h-8" /></td>
                <td className="px-2 py-1"><Input type="number" min={0} value={v.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} disabled={disabled} className="h-8" /></td>
                <td className="px-2 py-1"><Input type="number" min={0} step="0.01" value={v.price ?? ""} onChange={(e) => update(i, { price: e.target.value === "" ? null : Number(e.target.value) })} disabled={disabled} className="h-8" placeholder="base" /></td>
                <td className="px-2 py-1 text-center">
                  <button type="button" onClick={() => remove(i)} className="text-destructive hover:opacity-70" disabled={disabled}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[100px]">
          <label className="text-xs text-muted-foreground">Tamanho</label>
          <Input value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} placeholder="M, 42…" className="h-9" />
        </div>
        <div className="flex-1 min-w-[100px]">
          <label className="text-xs text-muted-foreground">Cor</label>
          <Input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder="Preto" className="h-9" />
        </div>
        <div className="w-24">
          <label className="text-xs text-muted-foreground">Estoque</label>
          <Input type="number" min={0} value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} className="h-9" />
        </div>
        <div className="w-28">
          <label className="text-xs text-muted-foreground">Preço</label>
          <Input type="number" min={0} step="0.01" value={draft.price ?? ""} onChange={(e) => setDraft({ ...draft, price: e.target.value === "" ? null : Number(e.target.value) })} placeholder="base" className="h-9" />
        </div>
        <Button type="button" onClick={add} disabled={disabled} className="bg-ink text-gold hover:bg-ink/90 h-9">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
