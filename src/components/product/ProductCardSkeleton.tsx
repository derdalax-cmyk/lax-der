export function ProductCardSkeleton() {
  return <div aria-hidden="true" className="rounded-xl border border-border overflow-hidden bg-card">
    <div className="aspect-square bg-secondary animate-pulse" />
    <div className="p-3"><div className="h-10 bg-secondary rounded animate-pulse" /><div className="mt-0.5 h-5 w-1/2 bg-secondary rounded animate-pulse" /></div>
  </div>;
}