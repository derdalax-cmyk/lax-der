export function normalizeMzPhone(input: string): string {
  return input.replace(/[\s\-().]/g, "").replace(/^(\+|00)?258/, "");
}

/** Mozambican mobile: 9 national digits starting with 82–88 (mirrors DB trigger). */
export function isValidMzMobile(input: string): boolean {
  return /^8[2-8]\d{7}$/.test(normalizeMzPhone(input));
}

export const isValidMzPhone = isValidMzMobile;

/** Canonical stored format: +258XXXXXXXXX (mirrors DB trigger normalize_profile_phone). */
export function toMzE164(input: string): string {
  return `+258${normalizeMzPhone(input)}`;
}

/** National 9-digit part for the input field (legacy values returned as-is, digits only). */
export function mzNationalPart(stored: string | null | undefined): string {
  if (!stored) return "";
  return normalizeMzPhone(stored).replace(/\D/g, "");
}

/** Sanitizes typed input to at most 9 national digits (strips +258/258). */
export function sanitizeMzPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^(00)?258/, "").slice(0, 9);
}

export const MZ_PHONE_ERROR = "Introduza um número moçambicano válido (+258 82–88...)";

export function formatMzNationalPhone(raw: string): string {
  const digits = sanitizeMzPhoneInput(raw);
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)].filter(Boolean).join(" ");
}
