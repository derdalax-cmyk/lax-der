import { useEffect, useRef, useState, type ReactNode } from "react";
import { productImageAspect } from "@/lib/productImageFrame";
import { cn } from "@/lib/utils";

const dimensions = new Map<string, { width: number; height: number }>();

/** Presentation only: never crops or modifies the original product photograph. */
export function NaturalProductImage({ src, alt, children, className, loading = "lazy", rotation = 0, onClick }: {
  src: string | null;
  alt: string;
  children?: ReactNode;
  className?: string;
  loading?: "eager" | "lazy";
  rotation?: number;
  onClick?: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<{ src: string; width: number; height: number } | null>(null);
  useEffect(() => {
    if (!src) return;
    const known = dimensions.get(src);
    const image = imageRef.current;
    if (known) setSize({ src, ...known });
    else if (image?.complete && image.naturalWidth) {
      const value = { width: image.naturalWidth, height: image.naturalHeight };
      dimensions.set(src, value);
      setSize({ src, ...value });
    }
  }, [src]);
  const known = size?.src === src ? size : src ? dimensions.get(src) : undefined;
  const aspect = productImageAspect(known?.width ?? 0, known?.height ?? 0, rotation);
  const sideways = Math.abs(rotation % 180) === 90;
  return (
    <div data-product-image-frame className={cn("relative w-full overflow-hidden bg-secondary", className)} style={{ aspectRatio: aspect }}>
      {src ? <img
        ref={imageRef} src={src} alt={alt} loading={loading} onClick={onClick}
        onLoad={event => {
          const image = event.currentTarget;
          const value = { width: image.naturalWidth, height: image.naturalHeight };
          dimensions.set(src, value);
          setSize({ src, ...value });
        }}
        className={cn("absolute left-1/2 top-1/2 object-contain object-center", onClick && "cursor-zoom-in")}
        style={{ width: sideways ? `${100 / aspect}%` : "100%", height: sideways ? `${100 * aspect}%` : "100%", maxWidth: "none", transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      /> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">Sem imagem</div>}
      {children}
    </div>
  );
}