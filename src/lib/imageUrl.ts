// Transformação de imagem nativa do Storage: serve versões redimensionadas
// em vez do ficheiro original, para cartões (pequeno) e detalhe (grande).
const PUBLIC_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";

type Opts = { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" };

/** Devolve a URL transformada quando a imagem está num bucket público do Storage. */
export function imageUrl(url: string | null | undefined, opts: Opts = {}): string {
  if (!url) return "";
  if (url.includes(RENDER_MARKER)) return url;
  if (!url.includes(PUBLIC_MARKER)) return url;

  const base = url.replace(PUBLIC_MARKER, RENDER_MARKER);
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 75));
  params.set("resize", opts.resize ?? "cover");
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
}

/** Product thumbnail preserving the photograph's natural aspect ratio. */
export const thumbUrl = (url: string | null | undefined) =>
  imageUrl(url, { width: 500, quality: 78, resize: "contain" });

/** Product gallery image without server-side square cropping. */
export const mainUrl = (url: string | null | undefined) =>
  imageUrl(url, { width: 1000, quality: 80, resize: "contain" });

/** Imagem grande para o zoom da página de produto (sem forçar quadrado — foto completa). */
export const largeUrl = (url: string | null | undefined) => imageUrl(url, { width: 1200, quality: 80 });
