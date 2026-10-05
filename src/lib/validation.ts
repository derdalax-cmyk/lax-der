export function normalizeMzPhone(input: string): string {
  return input.replace(/[\s\-().]/g, "").replace(/^(\+|00)?258/, "");
}

export function isValidMzPhone(input: string): boolean {
  return /^(84|85|86|87)\d{7}$/.test(normalizeMzPhone(input));
}

/** Any Mozambican mobile operator: 9 national digits starting with 82–87 (mirrors DB trigger). */
export function isValidMzMobile(input: string): boolean {
  return /^8[2-7]\d{7}$/.test(normalizeMzPhone(input));
}

/** Canonical stored format: +258XXXXXXXXX (mirrors DB trigger normalize_profile_phone). */
export function toMzE164(input: string): string {
  return `+258${normalizeMzPhone(input)}`;
}

/** National 9-digit part for the input field (legacy values returned as-is, digits only). */
export function mzNationalPart(stored: string | null | undefined): string {
  if (!stored) return "";
  return normalizeMzPhone(stored).replace(/\D/g, "");
}

export const MZ_PHONE_ERROR = "Introduza um número moçambicano válido.";
