import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { productImageAspect } from "@/lib/productImageFrame";
import { cn } from "@/lib/utils";
import { getImageDimensions, hydrateImageDimensions, measureProductImage, saveImageDimensions } from "@/lib/productImageCache";

/** Presentation only: never crops or modifies the original product photograph. */
export function NaturalProductImage({ src, alt, children, className, loading = "lazy", rotation = 0, onClick, fixedAspect, width, height }: {
  src: string | null;
  alt: string;
  children?: ReactNode;
  className?: string;
  loading?: "eager" | "lazy";
  rotation?: number;
  onClick?: () => void;
  /** Force a fixed frame aspect (e.g. 1 = square). Defaults to the natural/adaptive behaviour. */
  fixedAspect?: number;
  width?: number;
  height?: number;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ src: string; width: number; height: number } | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!src) return;
    hydrateImageDimensions();
    if (width && height) saveImageDimensions(src, width, height);
    const known = getImageDimensions(src);
    if (known) { setSize({ src, ...known }); setResolved(src); return; }
    if (fixedAspect) { setResolved(src); return; }
    let cancelled = false;
    const measure = () => void measureProductImage(src).then(value => {
      if (cancelled) return;
      setSize({ src, width: value?.width ?? 1, height: value?.height ?? 1 });
      setResolved(src);
    });
    const frame = frameRef.current;
    if (!frame) return;
    frame.addEventListener("dx:measure-image", measure);
    // Only measure the nearby window; off-screen cards never flood the network.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); measure(); }
    }, { rootMargin: "1000px" });
    observer.observe(frame);
    return () => { cancelled = true; observer.disconnect(); frame.removeEventListener("dx:measure-image", measure); };
  }, [src, fixedAspect, width, height]);
  const known = size?.src === src ? size : width && height ? { width, height } : undefined;
  const ready = !src || !!fixedAspect || resolved === src || !!known;
  const aspect = fixedAspect ?? productImageAspect(known?.width ?? 0, known?.height ?? 0, rotation);
  const sideways = Math.abs(rotation % 180) === 90;
  return (
    <div ref={frameRef} data-product-image-frame data-image-ready={ready ? "true" : "false"} data-image-src={src ?? undefined} className={cn("relative w-full overflow-hidden bg-secondary", !ready && "animate-pulse", className)} style={{ aspectRatio: aspect }}>
      {src && ready ? <img
        ref={imageRef} src={src} alt={alt} loading={loading} fetchPriority={loading === "eager" ? "high" : "auto"} decoding="async" onClick={onClick}
        onLoad={event => {
          const image = event.currentTarget;
          saveImageDimensions(src, image.naturalWidth, image.naturalHeight);
        }}
        className={cn("absolute left-1/2 top-1/2 object-contain object-center", onClick && "cursor-zoom-in")}
        style={{ width: sideways ? `${100 / aspect}%` : "100%", height: sideways ? `${100 * aspect}%` : "100%", maxWidth: "none", transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      /> : !src ? <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div> : null}
      {children}
    </div>
  );
}