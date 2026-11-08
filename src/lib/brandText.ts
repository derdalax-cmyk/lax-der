/** Presentation only: preserve stored content and every technical identifier. */
export function brandText(value: string): string {
  return value.replace(/\bDERDALAX\b/g, "Derdalax");
}