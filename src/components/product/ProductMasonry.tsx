import { Children, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Measured shortest columns; keep the settled prefix untouched as batches append. */
export function ProductMasonry({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;
    let signature = "";
    let measuredWidth = 0;
    const place = () => {
      frame = 0;
      if (measuredWidth !== grid.clientWidth) {
        for (const item of Array.from(grid.children)) if (item instanceof HTMLElement) item.style.gridColumn = "";
        measuredWidth = grid.clientWidth;
      }
      const style = getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(" ").length;
      const gutter = parseFloat(style.columnGap) || 0;
      const items = Array.from(grid.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
      const heights = items.map(item => Math.ceil(item.firstElementChild?.getBoundingClientRect().height ?? 0));
      const next = `${grid.clientWidth}:${columns}:${gutter}:${heights.join(",")}`;
      if (next === signature) return;
      signature = next;
      const bottoms = new Array<number>(columns).fill(0);
      let pending = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const image = item.querySelector<HTMLElement>("[data-product-image-frame]");
        pending ||= image?.dataset.imageReady === "false";
        const column = bottoms.indexOf(Math.min(...bottoms));
        const height = Math.max(1, heights[i]);
        // Once all earlier ratios are measured, insertion cannot move an existing real card.
        item.dataset.layoutSettled = pending ? "false" : "true";
        item.style.gridColumn = String(column + 1);
        item.style.gridRow = `${bottoms[column] + 1} / span ${height}`;
        bottoms[column] += height + gutter;
      }
      grid.classList.add("product-masonry-ready");
      grid.dataset.layoutVersion = String(Number(grid.dataset.layoutVersion ?? 0) + 1);
      grid.dataset.layoutReady = pending ? "false" : "true";
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    for (const item of Array.from(grid.children)) if (item.firstElementChild) observer.observe(item.firstElementChild);
    // Readiness can change without a height change (square images and errors).
    const mutations = new MutationObserver(() => { signature = ""; schedule(); });
    mutations.observe(grid, { attributes: true, subtree: true, attributeFilter: ["data-image-ready"] });
    const proximity = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const item of Array.from(grid.children)) {
          const image = item.querySelector<HTMLElement>('[data-image-ready="false"]');
          if (image && image.dataset.windowMeasured !== "true") {
            image.dataset.windowMeasured = "true";
            image.dispatchEvent(new Event("dx:measure-image"));
          }
          if (item === entry.target) break;
        }
      }
    }, { rootMargin: "600px" });
    for (const item of Array.from(grid.children)) proximity.observe(item);
    place();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); proximity.disconnect(); };
  }, [children]);
  return <div ref={ref} data-product-masonry className={cn("grid items-start", className)}>
    {Children.map(children, child => child ? <div className="min-w-0 relative product-masonry-item">{child}<div aria-hidden="true" className="product-card-measure-skeleton absolute inset-0 bg-card border border-border rounded-xl overflow-hidden"><div className="h-[calc(100%-5.5rem)] bg-secondary animate-pulse" /><div className="p-3 space-y-2"><div className="h-10 bg-secondary animate-pulse rounded" /><div className="h-5 w-1/2 bg-secondary animate-pulse rounded" /></div></div></div> : null)}
  </div>;
}