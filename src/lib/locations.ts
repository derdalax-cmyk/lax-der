// Lista central de províncias e cidades/vilas sugeridas de Moçambique.
// Usada no perfil/cadastro (sugestões) e na "cidade de venda" atribuída pelo admin.

export const MZ_PROVINCES = [
  "Maputo Província",
  "Gaza",
  "Inhambane",
  "Sofala",
  "Manica",
  "Tete",
  "Zambézia",
  "Nampula",
  "Cabo Delgado",
  "Niassa",
] as const;

export type MzProvince = (typeof MZ_PROVINCES)[number];

export function isMzProvince(v: unknown): v is MzProvince {
  return typeof v === "string" && (MZ_PROVINCES as readonly string[]).includes(v);
}

export const MZ_CITIES_BY_PROVINCE: Record<MzProvince, string[]> = {
  "Maputo Província": ["Matola", "Boane", "Namaacha", "Manhiça", "Marracuene", "Moamba"],
  Gaza: ["Xai-Xai", "Chókwè", "Chibuto", "Manjacaze", "Bilene", "Macia"],
  Inhambane: ["Inhambane", "Maxixe", "Vilankulo", "Massinga", "Inharrime"],
  Sofala: ["Beira", "Dondo", "Nhamatanda", "Búzi", "Gorongosa", "Marromeu"],
  Manica: ["Chimoio", "Manica", "Catandica", "Sussundenga", "Gondola"],
  Tete: ["Tete", "Moatize", "Ulónguè", "Songo", "Cahora Bassa"],
  Zambézia: ["Quelimane", "Mocuba", "Gurué", "Milange", "Alto Molócue"],
  Nampula: ["Nampula", "Nacala", "Angoche", "Ilha de Moçambique", "Monapo"],
  "Cabo Delgado": ["Pemba", "Montepuez", "Mocímboa da Praia", "Chiúre", "Mueda"],
  Niassa: ["Lichinga", "Cuamba", "Marrupa", "Mandimba"],
};

export const MZ_CITIES: string[] = Array.from(
  new Set(Object.values(MZ_CITIES_BY_PROVINCE).flat()),
).sort((a, b) => a.localeCompare(b, "pt"));

export function citySuggestions(province?: string | null): string[] {
  return isMzProvince(province) ? MZ_CITIES_BY_PROVINCE[province] : MZ_CITIES;
}
