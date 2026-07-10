import { useState } from "react";
import { MapPin, Check, ChevronDown, Globe } from "lucide-react";
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

type Props = { className?: string; compact?: boolean };

export function CitySelector({ className, compact }: Props) {
  const { city, setCity, clearCity, hasCity, cities, loading } = useCity();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Selecionar cidade"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            hasCity
              ? "border-white/15 bg-white/5 text-white/90 hover:border-gold/50 hover:text-gold"
              : "border-gold/60 bg-gold/10 text-gold hover:bg-gold/20 animate-pulse",
            className,
          )}
        >
          <MapPin className="h-3.5 w-3.5 text-gold" />
          {!compact && <span className={hasCity ? "text-white/50" : "text-gold/70"}>Cidade:</span>}
          <span className="max-w-[120px] truncate">{hasCity ? city : "Escolher"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Escolher cidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => clearCity()}
          className="flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            {!hasCity ? <Check className="h-4 w-4 text-gold" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
            Todas as cidades
          </span>
        </DropdownMenuItem>
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
