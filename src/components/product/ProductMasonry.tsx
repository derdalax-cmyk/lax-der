import { Children, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shortest-column placement without changing product keys, DOM order or feed data. */
export function ProductMasonry({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;
    const place = () => {
      // Remove previous placements before measuring explicit responsive tracks;
      // otherwise desktop columns become implicit columns on a smaller screen.
      for (const item of Array.from(grid.children)) {
        if (item instanceof HTMLElement) item.style.gridColumn = "";
      }
      const style = getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(" ").length;
      const gutter = parseFloat(style.columnGap) || 0;
      const bottoms = new Array<number>(columns).fill(0);
      for (const item of Array.from(grid.children)) {
        if (!(item instanceof HTMLElement)) continue;
        const content = item.firstElementChild;
        if (!(content instanceof HTMLElement)) continue;
        const column = bottoms.indexOf(Math.min(...bottoms));
        const height = Math.ceil(content.getBoundingClientRect().height);
        item.style.gridColumn = String(column + 1);
        item.style.gridRow = `${bottoms[column] + 1} / span ${Math.max(1, height)}`;
        bottoms[column] += height + gutter;
      }
      grid.classList.add("product-masonry-ready");
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    for (const item of Array.from(grid.children)) {
      if (item.firstElementChild) observer.observe(item.firstElementChild);
    }
    place();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [children]);
  return <div ref={ref} data-product-masonry className={cn("grid items-start", className)}>
    {Children.map(children, child => child ? <div className="min-w-0">{child}</div> : null)}
  </div>;
}