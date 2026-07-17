export function normalizeMzPhone(input: string): string {
  return input.replace(/[\s\-()+]/g, "").replace(/^258/, "");
}

export function isValidMzPhone(input: string): boolean {
  const n = normalizeMzPhone(input);
  return /^(84|85|86|87)\d{7}$/.test(n);
}
