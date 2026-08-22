import { MapPin } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { CitySelector } from "@/components/CitySelector";

export function CityAlert() {
  const { city, hasCity, ready, cities, loading } = useCity();

  // Só alerta depois de carregar o estado e havendo cidades disponíveis
  if (!ready || loading || cities.length === 0) return null;

  const selected = hasCity ? cities.find((c) => c.city === city) : undefined;
  const cityEmpty = hasCity && (!selected || selected.product_count === 0);

  if (hasCity && !cityEmpty) return null;

  return (
    <div className="bg-gold/10 border-b border-gold/30">
      <div className="max-w-[1400px] mx-auto px-5 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
          <MapPin className="h-4 w-4 text-gold shrink-0" />
          {cityEmpty
            ? `A cidade ${city} ainda não tem produtos disponíveis. Escolha outra cidade.`
            : "Selecione a sua cidade para ver os produtos disponíveis perto de si."}
        </span>
        <CitySelector />
      </div>
    </div>
  );
}
