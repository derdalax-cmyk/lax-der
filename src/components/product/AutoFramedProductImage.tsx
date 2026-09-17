import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Bounds = { left: number; top: number; right: number; bottom: number };

type Props = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
  margin?: number;
  rotation?: number;
  onClick?: () => void;
};

const FULL_IMAGE: Bounds = { left: 0, top: 0, right: 1, bottom: 1 };

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function detectSubject(image: HTMLImageElement): Bounds {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longest) return FULL_IMAGE;

  const scale = Math.min(1, 220 / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return FULL_IMAGE;

  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const borderR: number[] = [];
  const borderG: number[] = [];
  const borderB: number[] = [];
  const borderDepth = Math.max(1, Math.round(Math.min(width, height) * 0.025));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= borderDepth && x < width - borderDepth && y >= borderDepth && y < height - borderDepth) continue;
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 220) continue;
      borderR.push(pixels[i]);
      borderG.push(pixels[i + 1]);
      borderB.push(pixels[i + 2]);
    }
  }

  const background = [median(borderR), median(borderG), median(borderB)];
  const borderDistances = borderR.map((r, i) => {
    const dr = r - background[0];
    const dg = borderG[i] - background[1];
    const db = borderB[i] - background[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  });
  const threshold = Math.max(30, median(borderDistances) * 2.8 + 16);
  const rowCounts = new Array<number>(height).fill(0);
  const columnCounts = new Array<number>(width).fill(0);
  let foregroundPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const dr = pixels[i] - background[0];
      const dg = pixels[i + 1] - background[1];
      const db = pixels[i + 2] - background[2];
      if (pixels[i + 3] > 32 && Math.sqrt(dr * dr + dg * dg + db * db) > threshold) {
        rowCounts[y] += 1;
        columnCounts[x] += 1;
        foregroundPixels += 1;
      }
    }
  }

  const foregroundRatio = foregroundPixels / (width * height);
  if (foregroundRatio < 0.015 || foregroundRatio > 0.88) return FULL_IMAGE;

  const rows = rowCounts.flatMap((count, index) => count >= Math.max(2, width * 0.018) ? [index] : []);
  const columns = columnCounts.flatMap((count, index) => count >= Math.max(2, height * 0.018) ? [index] : []);
  if (!rows.length || !columns.length) return FULL_IMAGE;

  const left = columns[0] / width;
  const right = (columns[columns.length - 1] + 1) / width;
  const top = rows[0] / height;
  const bottom = (rows[rows.length - 1] + 1) / height;
  const area = (right - left) * (bottom - top);
  if (area < 0.035) return FULL_IMAGE;

  return { left, top, right, bottom };
}

export function AutoFramedProductImage({
  src,
  alt,
  className,
  imageClassName,
  loading = "lazy",
  margin = 0.1,
  rotation = 0,
  onClick,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<Bounds>(FULL_IMAGE);

  useEffect(() => {
    setBounds(FULL_IMAGE);
    setImageSize({ width: 0, height: 0 });
  }, [src]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setFrameSize({ width: frame.clientWidth, height: frame.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback((image: HTMLImageElement) => {
    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    try {
      setBounds(detectSubject(image));
    } catch {
      setBounds(FULL_IMAGE);
    }
  }, []);

  const transform = (() => {
    const { width: fw, height: fh } = frameSize;
    const { width: iw, height: ih } = imageSize;
    if (!fw || !fh || !iw || !ih) return undefined;

    const containScale = Math.min(fw / iw, fh / ih);
    const renderedWidth = iw * containScale;
    const renderedHeight = ih * containScale;
    const subjectWidth = Math.max(1, (bounds.right - bounds.left) * renderedWidth);
    const subjectHeight = Math.max(1, (bounds.bottom - bounds.top) * renderedHeight);
    const targetWidth = fw * (1 - margin * 2);
    const targetHeight = fh * (1 - margin * 2);
    const scale = Math.max(1, Math.min(2.35, targetWidth / subjectWidth, targetHeight / subjectHeight));
    const subjectX = (bounds.left + bounds.right) * 0.5 * renderedWidth + (fw - renderedWidth) * 0.5;
    const subjectY = (bounds.top + bounds.bottom) * 0.5 * renderedHeight + (fh - renderedHeight) * 0.5;
    const translateX = -scale * (subjectX - fw * 0.5);
    const translateY = -scale * (subjectY - fh * 0.5);
    return `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
  })();

  return (
    <div ref={frameRef} className={cn("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        loading={loading}
        onClick={onClick}
        onLoad={(event) => handleLoad(event.currentTarget)}
        style={{ transform }}
        className={cn("absolute inset-0 h-full w-full object-contain object-center transition-transform duration-300", imageClassName)}
      />
    </div>
  );
}