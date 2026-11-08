export type CategoryMeta = { slug: string; label: string; icon: string };

export const CATEGORY_META: CategoryMeta[] = [
  { slug: "camisas", label: "Camisas", icon: "shirt" },
  { slug: "calcas", label: "Calças", icon: "pants" },
  { slug: "sapatos", label: "Sapatos", icon: "footprints" },
  { slug: "chapeus", label: "Chapéus", icon: "hard-hat" },
  { slug: "calcoes", label: "Calções", icon: "scissors" },
  { slug: "casacos", label: "Casacos", icon: "coat" },
];

export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  return CATEGORY_META.find((c) => c.slug === slug)?.label ?? slug;
}

export const FEATURED_ICONS = [
  "star",
  "shirt",
  "pants",
  "footprints",
  "hard-hat",
  "scissors",
  "coat",
  "sparkles",
  "crown",
  "gem",
  "tag",
  "bag",
  "glasses",
  "watch",
];
