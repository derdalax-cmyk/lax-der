export const HOME_COLLECTION_LIMIT = 20;

export function homeCollectionProducts<T>(products: T[]): T[] {
  return products.slice(0, HOME_COLLECTION_LIMIT);
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/s$/, "");
}

export function homeCollectionSearch(collection: { slug: string; name: string }, categories: { slug: string; label: string }[]): Record<string, string> | undefined {
  const category = categories.find(c => normalized(c.slug) === normalized(collection.slug) || normalized(c.label) === normalized(collection.name));
  return category ? { categoria: category.slug } : undefined;
}

export function bannerIndex(index: number, direction: number, count: number) {
  return count > 0 ? ((index + direction) % count + count) % count : 0;
}

export function mobileNavSection(path: string) {
  if (path === "/") return "home";
  if (path === "/explorar" || path.startsWith("/explorar/")) return "explore";
  if (path === "/vendedor" || path.startsWith("/vendedor/") || path === "/tornar-se-vendedor") return "sell";
  if (path === "/categorias" || path.startsWith("/categorias/")) return "categories";
  if (path === "/suporte" || path.startsWith("/suporte/")) return "support";
  return null;
}