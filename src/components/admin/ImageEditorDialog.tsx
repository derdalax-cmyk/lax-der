import brandIcon512 from "@/assets/derdalax-icon-512.png.asset.json";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, RotateCw, Loader2, ImagePlus, Stamp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { validateUpload, IMAGE_ACCEPT, MAX_IMAGE_BYTES } from "@/lib/uploadLimits";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

type Ratio = { label: string; value: number | null };
type Seal = { x: number; y: number; size: number };

// Position is relative to the final crop; size is relative to its shortest side.
const fitSeal = (seal: Seal, width: number, height: number): Seal => {
  const side = Math.min(width, height) * seal.size;
  return {
    ...seal,
    x: Math.max(0, Math.min(seal.x, 1 - side / width)),
    y: Math.max(0, Math.min(seal.y, 1 - side / height)),
  };
};

const RATIOS: Ratio[] = [
  { label: "Original", value: null },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:4", value: 3 / 4 },
];

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  url: string;
  /** Recebe a imagem editada (JPEG) para substituir a original. */
  onSave: (blob: Blob) => Promise<void> | void;
};

/**
 * Editor simples: rodar 90° e recortar ao centro num formato à escolha.
 * O resultado substitui a imagem no cadastro (e é o que a IA passa a analisar).
 */
export function ImageEditorDialog({ open, onOpenChange, url, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sealImageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [ratio, setRatio] = useState<number | null>(1);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swapTick, setSwapTick] = useState(0);
  const [seal, setSeal] = useState<Seal | null>(null);
  const [sealReady, setSealReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRotation(0);
    setRatio(1);
    setReady(false);
    setSeal(null);
    dragRef.current = null;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setReady(true);
    };
    img.onerror = () => {
      if (!cancelled) toast.error("Não foi possível ler esta imagem. Tente outra fotografia.");
    };
    img.src = url;
    const brand = new Image();
    setSealReady(false);
    brand.onload = () => {
      if (cancelled) return;
      sealImageRef.current = brand;
      setSealReady(true);
    };
    brand.onerror = () => {
      if (!cancelled) toast.error("Não foi possível carregar o selo DERDALAX.");
    };
    brand.src = brandIcon512.url;
    return () => { cancelled = true; };
  }, [open, url]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!ready || !img || !canvas) return;

    const swapped = rotation % 180 !== 0;
    const rw = swapped ? img.naturalHeight : img.naturalWidth;
    const rh = swapped ? img.naturalWidth : img.naturalHeight;

    let cw = rw;
    let ch = rh;
    if (ratio) {
      if (rw / rh > ratio) cw = Math.round(rh * ratio);
      else ch = Math.round(rw / ratio);
    }

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
    const brand = sealImageRef.current;
    if (seal && sealReady && brand) {
      const fitted = fitSeal(seal, cw, ch);
      const side = Math.min(cw, ch) * fitted.size;
      ctx.drawImage(brand, fitted.x * cw, fitted.y * ch, side, side);
    }
  }, [ready, rotation, ratio, swapTick, seal, sealReady]);

  const addSeal = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sealReady) return;
    const size = 0.2;
    const side = Math.min(canvas.width, canvas.height) * size;
    setSeal(fitSeal({ x: 0.96 - side / canvas.width, y: 0.96 - side / canvas.height, size }, canvas.width, canvas.height));
  };

  const pointOnCanvas = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    // object-contain can leave space within the element on narrow screens.
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    return {
      x: (event.clientX - rect.left - (rect.width - canvas.width * scale) / 2) / (canvas.width * scale),
      y: (event.clientY - rect.top - (rect.height - canvas.height * scale) / 2) / (canvas.height * scale),
    };
  };

  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!seal || saving || (event.pointerType === "mouse" && event.button !== 0)) return;
    const canvas = event.currentTarget;
    const fitted = fitSeal(seal, canvas.width, canvas.height);
    const point = pointOnCanvas(event);
    const side = Math.min(canvas.width, canvas.height) * fitted.size;
    if (point.x < fitted.x || point.y < fitted.y || point.x > fitted.x + side / canvas.width || point.y > fitted.y + side / canvas.height) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, x: point.x - fitted.x, y: point.y - fitted.y };
  };

  const moveSeal = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const point = pointOnCanvas(event);
    const canvas = event.currentTarget;
    setSeal((current) => current ? fitSeal({ ...current, x: point.x - drag.x, y: point.y - drag.y }, canvas.width, canvas.height) : null);
  };

  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /** Substitui a imagem por um novo ficheiro escolhido no dispositivo (mesma posição na lista). */
  const swap = (file: File | undefined) => {
    if (!file) return;
    const invalid = validateUpload(file, "image");
    if (invalid) {
      toast.error(invalid);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setRotation(0);
      setRatio(1);
      setSeal(null);
      dragRef.current = null;
      setReady(true);
      setSwapTick((t) => t + 1);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      toast.error("Não foi possível ler esta imagem. Tente outra fotografia.");
    };
    img.src = URL.createObjectURL(file);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready || saving) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Não foi possível guardar a imagem.");
      if (blob.size > MAX_IMAGE_BYTES) throw new Error("A imagem editada excede 10MB. Escolha uma fotografia mais pequena.");
      await onSave(blob);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar a imagem. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Editar imagem</DialogTitle>
        </DialogHeader>

        <div className="flex h-[35dvh] min-h-[180px] max-h-[420px] items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary/40 p-3">
          {ready ? (
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={seal ? "Pré-visualização da imagem com selo DERDALAX" : "Pré-visualização da imagem"}
              tabIndex={seal ? 0 : undefined}
              className={cn("max-h-full max-w-full object-contain object-center", seal && "touch-none cursor-move focus-visible:outline-gold")}
              onPointerDown={startDrag}
              onPointerMove={moveSeal}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={() => { dragRef.current = null; }}
              onKeyDown={(event) => {
                if (!seal || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                event.preventDefault();
                const canvas = event.currentTarget;
                setSeal(fitSeal({ ...seal, x: seal.x + (event.key === "ArrowRight" ? 0.01 : event.key === "ArrowLeft" ? -0.01 : 0), y: seal.y + (event.key === "ArrowDown" ? 0.01 : event.key === "ArrowUp" ? -0.01 : 0) }, canvas.width, canvas.height));
              }}
            />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="w-4 h-4" /> Trocar imagem
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              swap(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRotation((r) => (r + 270) % 360)}>
            <RotateCcw className="w-4 h-4" /> Rodar
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw className="w-4 h-4" /> Rodar
          </Button>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {RATIOS.map((r) => (
              <Button
                key={r.label}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={ratio === r.value}
                onClick={() => setRatio(r.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md border text-xs transition-colors",
                  ratio === r.value ? "border-gold bg-gold/10 text-ink" : "border-border hover:bg-secondary",
                )}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" className="border-gold/60 text-gold" disabled={!ready || !sealReady || saving || !!seal} onClick={addSeal}>
              <Stamp /> {seal ? "Selo DERDALAX adicionado" : "Adicionar selo DERDALAX"}
            </Button>
            {seal && <Button type="button" variant="ghost" size="icon" aria-label="Remover selo" title="Remover selo" disabled={saving} onClick={() => setSeal(null)}><Trash2 /></Button>}
          </div>
          {seal && (
            <div className="flex items-center gap-3">
              <label id="seal-size-label" className="shrink-0 text-xs font-medium">Tamanho do selo</label>
              <Slider aria-labelledby="seal-size-label" min={5} max={60} step={1} value={[Math.round(seal.size * 100)]} disabled={saving} className="min-h-9" onValueChange={([value]) => {
                const canvas = canvasRef.current;
                if (value === undefined || !canvas) return;
                setSeal((current) => current ? fitSeal({ ...current, size: value / 100 }, canvas.width, canvas.height) : null);
              }} />
              <span className="w-9 shrink-0 text-right text-xs tabular-nums">{Math.round(seal.size * 100)}%</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          O recorte é feito ao centro. Pode trocar a foto mantendo a mesma posição na lista. A versão guardada substitui a original no produto e é a que a IA analisa.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !ready} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? "A guardar…" : "Guardar imagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
