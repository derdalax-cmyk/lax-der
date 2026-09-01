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

/** Miniatura para cartões de produto (home, carrosséis, /explorar). */
export const thumbUrl = (url: string | null | undefined) => imageUrl(url, { width: 400, quality: 75 });

/** Imagem grande para a página de detalhe do produto. */
export const largeUrl = (url: string | null | undefined) => imageUrl(url, { width: 1200, quality: 80 });
