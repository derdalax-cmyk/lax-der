import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MZ_PROVINCES, citySuggestions } from "@/lib/locations";

type Props = {
  province: string;
  city: string;
  onProvinceChange: (v: string) => void;
  onCityChange: (v: string) => void;
  labelClassName?: string;
};

export function ProvinceCityFields({ province, city, onProvinceChange, onCityChange, labelClassName }: Props) {
  const id = useId();
  const listId = `${id}-cities`;
  return (
    <>
      <div>
        <Label htmlFor={`${id}-prov`} className={labelClassName}>Província</Label>
        <Select value={province || undefined} onValueChange={onProvinceChange}>
          <SelectTrigger id={`${id}-prov`}><SelectValue placeholder="Selecione a província" /></SelectTrigger>
          <SelectContent>
            {MZ_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${id}-city`} className={labelClassName}>Cidade</Label>
        <Input
          id={`${id}-city`}
          list={listId}
          autoComplete="address-level2"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder={province ? `Ex: ${citySuggestions(province)[0]}` : "Ex: Maputo"}
          maxLength={80}
        />
        <datalist id={listId}>
          {citySuggestions(province).map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
    </>
  );
}
