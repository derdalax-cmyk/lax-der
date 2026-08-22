import { useState } from "react";
import { MapPin, Check, ChevronDown } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = { className?: string; compact?: boolean; tone?: "dark" | "light" };

export function CitySelector({ className, compact, tone = "dark" }: Props) {
  const { city, setCity, hasCity, cities, loading } = useCity();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Selecionar cidade"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors",
            hasCity
              ? tone === "light"
                ? "border-border bg-secondary text-foreground hover:border-gold/60"
                : "border-white/15 bg-white/5 text-white/90 hover:border-gold/50 hover:text-gold"
              : "border-gold/60 bg-gold/10 text-gold hover:bg-gold/20 animate-pulse",
            className,
          )}
        >
          <MapPin className="h-3 w-3 text-gold" />
          {!compact && <span className={hasCity ? (tone === "light" ? "text-muted-foreground" : "text-white/50") : "text-gold/70"}>Cidade:</span>}
          <span className="max-w-[90px] truncate">{hasCity ? city : "Escolher"}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Escolher cidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">A carregar…</div>
        ) : cities.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">Sem cidades com produtos.</div>
        ) : (
          cities.map((c) => (
            <DropdownMenuItem
              key={c.city}
              onSelect={() => setCity(c.city)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                {c.city === city ? <Check className="h-4 w-4 text-gold" /> : <span className="w-4" />}
                {c.city}
              </span>
              <span className="text-xs text-muted-foreground">{c.product_count}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

