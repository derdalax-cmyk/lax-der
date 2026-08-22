// Limites de upload aplicados no cliente (tipo e tamanho de ficheiro).
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB

type Kind = "image" | "document";

const CONFIG: Record<Kind, { types: readonly string[]; max: number; label: string }> = {
  image: { types: IMAGE_TYPES, max: MAX_IMAGE_BYTES, label: "JPG, PNG ou WEBP" },
  document: { types: DOC_TYPES, max: MAX_DOC_BYTES, label: "JPG, PNG, WEBP ou PDF" },
};

/** Devolve uma mensagem de erro se o ficheiro não for permitido, ou null se estiver OK. */
export function validateUpload(file: File, kind: Kind = "image"): string | null {
  const { types, max, label } = CONFIG[kind];
  if (!types.includes(file.type)) {
    return `${file.name}: formato inválido (apenas ${label})`;
  }
  if (file.size > max) {
    return `${file.name}: ficheiro maior que ${Math.round(max / (1024 * 1024))}MB`;
  }
  return null;
}

export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const DOC_ACCEPT = DOC_TYPES.join(",");
