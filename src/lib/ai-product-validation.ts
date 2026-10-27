export type AiProductData = { nome: string; descricao: string; material: string };

const BODY = /\b(dedos?|m[aã]os?|pessoas?|pele|corpo|corpos|braços?|pernas?|rostos?|modelos?|modelo|homem|mulher|human[oa]s?|manequim|finger\w*|hands?|person\w*|skin|body|arms?|legs?|face|wearer)\b/i;
const SPECULATION = /\b(provavelmente|talvez|parece ser|pode ser|possivelmente|geralmente|supostamente)\b/i;
const UNSUPPORTED = /\b(marca|tamanho|composiç[aã]o)\s*[:=]|\b(100\s*%|\d+\s*%|aut[eê]ntic[oa]|original de marca)\b/i;
const HYPE = /\b(perfeit[oa]|incr[ií]vel|luxuos[oa]|imperd[ií]vel|sensual)\b/i;

export function validateAiProductData(value: unknown): AiProductData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ai_bad_image");
  const row = value as Record<string, unknown>;
  if (typeof row.nome !== "string" || typeof row.descricao !== "string" || typeof row.material !== "string") throw new Error("ai_bad_image");
  const nome = row.nome.trim();
  if (!nome || nome.length > 60 || BODY.test(nome) || SPECULATION.test(nome) || UNSUPPORTED.test(nome) || HYPE.test(nome)) throw new Error("ai_bad_image");
  // Remove whole irrelevant claims, not individual words leaving misleading fragments.
  const descricao = row.descricao.trim().split(/(?<=[.!?;])\s+|\n+/)
    .filter((sentence) => !BODY.test(sentence) && !SPECULATION.test(sentence) && !UNSUPPORTED.test(sentence) && !HYPE.test(sentence))
    .join(" ").trim();
  if (!descricao || descricao.length > 300) throw new Error("ai_bad_image");
  const rawMaterial = row.material.trim();
  // A fabric appearance alone is not proof: accept only an explicitly legible label.
  const material = /^etiqueta leg[ií]vel:\s*[^:]+$/i.test(rawMaterial) && rawMaterial.length <= 60 && !BODY.test(rawMaterial) && !SPECULATION.test(rawMaterial)
    ? rawMaterial : "Não identificado";
  const contradictions = [[/sem bolsos/i, /com bolsos/i], [/sem mangas/i, /mangas (longas|curtas)/i], [/sem fecho/i, /com fecho/i]];
  if (contradictions.some(([a, b]) => a.test(`${nome}. ${descricao}`) && b.test(`${nome}. ${descricao}`))) throw new Error("ai_bad_image");
  return { nome, descricao, material };
}