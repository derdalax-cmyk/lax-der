import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { POLICIES, type Policy } from "@/lib/policies";

export function PoliciesDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Policy | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setTimeout(() => setSelected(null), 150);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {selected ? (
          <PolicyDetail policy={selected} onBack={() => setSelected(null)} />
        ) : (
          <PolicyList onSelect={setSelected} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PolicyList({ onSelect }: { onSelect: (p: Policy) => void }) {
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
        <DialogTitle className="font-display text-2xl">Políticas</DialogTitle>
        <p className="text-sm text-muted-foreground">Selecione uma política para ler em detalhe.</p>
      </DialogHeader>
      <div className="overflow-y-auto">
        <ul className="divide-y divide-border">
          {POLICIES.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.slug}>
                <button
                  onClick={() => onSelect(p)}
                  className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-secondary/40 transition-colors"
                >
                  <span className={`h-11 w-11 shrink-0 rounded-xl ${p.tint} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${p.iconColor}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground leading-tight">{p.title}</span>
                    <span className="block text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.short}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function PolicyDetail({ policy, onBack }: { policy: Policy; onBack: () => void }) {
  const Icon = policy.icon;
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Todas as políticas
        </button>
        <div className="flex items-center gap-3">
          <span className={`h-11 w-11 shrink-0 rounded-xl ${policy.tint} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${policy.iconColor}`} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl leading-tight text-left">{policy.title}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5 text-left">{policy.short}</p>
          </div>
        </div>
      </DialogHeader>
      <div className="overflow-y-auto px-6 py-5">
        <div className="space-y-6">
          {policy.sections.map((s, i) => (
            <section key={i}>
              {s.heading && (
                <h3 className="font-semibold text-base text-foreground mb-2">{s.heading}</h3>
              )}
              <div className="space-y-3">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
