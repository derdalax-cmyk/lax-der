import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, RotateCw, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { validateUpload, IMAGE_ACCEPT } from "@/lib/uploadLimits";
import { cn } from "@/lib/utils";

type Ratio = { label: string; value: number | null };

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
  const [rotation, setRotation] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swapTick, setSwapTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setRotation(0);
    setRatio(null);
    setReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = url;
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
  }, [ready, rotation, ratio, swapTick]);

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
      setRatio(null);
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
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
      );
      if (blob) await onSave(blob);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Editar imagem</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center rounded-lg border border-border bg-secondary/40 p-3 min-h-[220px]">
          {ready ? (
            <canvas ref={canvasRef} className="max-h-[45vh] max-w-full object-contain" />
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
              <button
                key={r.label}
                type="button"
                onClick={() => setRatio(r.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md border text-xs transition-colors",
                  ratio === r.value ? "border-gold bg-gold/10 text-ink" : "border-border hover:bg-secondary",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O recorte é feito ao centro. A versão guardada substitui a original no produto e é a que a IA analisa.
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
