import {
  Shirt, Footprints, HardHat, Scissors, Watch, Gem, Glasses, Backpack,
  ShoppingBag, Tag, Diamond, Crown, Baby, Heart, Star, Package,
  Umbrella, Sun, Snowflake, Flame, Feather, Layers, Palette, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Minimal outline icons that pair with the site typography.
// "pants" and "coat" don't ship in lucide — reuse a semantically close outline.
export const CATEGORY_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: "shirt", label: "Camisa", Icon: Shirt },
  { name: "pants", label: "Calças", Icon: Layers },
  { name: "coat", label: "Casaco", Icon: Feather },
  { name: "footprints", label: "Sapatos", Icon: Footprints },
  { name: "hard-hat", label: "Chapéu", Icon: HardHat },
  { name: "scissors", label: "Calções", Icon: Scissors },
  { name: "watch", label: "Relógio", Icon: Watch },
  { name: "gem", label: "Joia", Icon: Gem },
  { name: "glasses", label: "Óculos", Icon: Glasses },
  { name: "backpack", label: "Mochila", Icon: Backpack },
  { name: "bag", label: "Bolsa", Icon: ShoppingBag },
  { name: "tag", label: "Etiqueta", Icon: Tag },
  { name: "sparkles", label: "Novo", Icon: Diamond },
  { name: "crown", label: "Premium", Icon: Crown },
  { name: "baby", label: "Infantil", Icon: Baby },
  { name: "heart", label: "Favorito", Icon: Heart },
  { name: "star", label: "Destaque", Icon: Star },
  { name: "package", label: "Pacote", Icon: Package },
  { name: "umbrella", label: "Chuva", Icon: Umbrella },
  { name: "sun", label: "Verão", Icon: Sun },
  { name: "snowflake", label: "Inverno", Icon: Snowflake },
  { name: "flame", label: "Trending", Icon: Flame },
  { name: "palette", label: "Cor", Icon: Palette },
  { name: "zap", label: "Novidade", Icon: Zap },
];

const MAP = new Map(CATEGORY_ICONS.map((c) => [c.name, c.Icon]));

export function CategoryIcon({ icon, className = "w-6 h-6" }: { icon?: string | null; className?: string }) {
  if (!icon) return <Tag className={className} />;
  if (/^https?:\/\//.test(icon)) {
    return <img src={icon} alt="" className={`${className} object-contain`} />;
  }
  const Icon = MAP.get(icon);
  if (Icon) return <Icon className={className} strokeWidth={1.5} />;
  // Fallback: legacy emoji strings render as text so old data stays readable.
  if (icon.length <= 4) return <span className={`${className} inline-grid place-items-center leading-none`} aria-hidden>{icon}</span>;
  return <Tag className={className} strokeWidth={1.5} />;
}

