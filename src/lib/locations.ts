// Lista central de cidades/vilas principais de Moçambique, agrupadas por província.
// Usada para padronizar a "cidade de venda" atribuída pelo admin aos vendedores,
// evitando variações de escrita que fragmentam o seletor de cidades da loja.

export const MZ_CITIES_BY_PROVINCE: Record<string, string[]> = {
  "Maputo Cidade": ["Maputo"],
  "Maputo Província": ["Matola", "Boane", "Namaacha", "Manhiça", "Marracuene", "Xai-Xai"],
  Gaza: ["Xai-Xai", "Chókwè", "Chibuto", "Manjacaze", "Bilene"],
  Inhambane: ["Inhambane", "Maxixe", "Vilankulo", "Massinga", "Inharrime"],
  Sofala: ["Beira", "Dondo", "Nhamatanda", "Gorongosa", "Marromeu"],
  Manica: ["Chimoio", "Manica", "Catandica", "Sussundenga", "Gondola"],
  Tete: ["Tete", "Moatize", "Ulónguè", "Songo", "Cahora Bassa"],
  Zambézia: ["Quelimane", "Mocuba", "Gurué", "Milange", "Alto Molócue"],
  Nampula: ["Nampula", "Nacala", "Angoche", "Ilha de Moçambique", "Monapo"],
  "Cabo Delgado": ["Pemba", "Montepuez", "Mocímboa da Praia", "Chiúre", "Mueda"],
  Niassa: ["Lichinga", "Cuamba", "Marrupa", "Mandimba"],
};

// Lista plana e ordenada de todas as cidades (sem duplicados).
export const MZ_CITIES: string[] = Array.from(
  new Set(Object.values(MZ_CITIES_BY_PROVINCE).flat()),
).sort((a, b) => a.localeCompare(b, "pt"));
