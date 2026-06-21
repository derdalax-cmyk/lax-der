export type CategoryMeta = { slug: string; label: string; icon: string };

export const CATEGORY_META: CategoryMeta[] = [
  { slug: "camisas", label: "Camisas", icon: "👕" },
  { slug: "calcas", label: "Calças", icon: "👖" },
  { slug: "sapatos", label: "Sapatos", icon: "👟" },
  { slug: "chapeus", label: "Chapéus", icon: "🧢" },
  { slug: "calcoes", label: "Calções", icon: "🩳" },
  { slug: "casacos", label: "Casacos", icon: "🧥" },
];

export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  return CATEGORY_META.find((c) => c.slug === slug)?.label ?? slug;
}

export const FEATURED_ICONS = ["⭐", "👕", "👖", "👟", "🧢", "🩳", "🧥", "🔥", "✨", "💎", "🆕", "🏷️"];
