// Gerador de nome/descrição/material a partir das fotografias do produto.
// Só corre no servidor: a chave da IA nunca chega ao navegador.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_IMAGES = 5;
export const AI_MAX_IMAGES = MAX_IMAGES;

/** Modelo configurável no servidor (variável de ambiente), sem tocar no frontend. */
export function aiProductModel(): string {
  return process.env["AI_PRODUCT_MODEL"] || "openai/gpt-5-nano";
}

const SYSTEM_PROMPT = `És um catalogador de vestuário de uma loja em Moçambique.
IDIOMA OBRIGATÓRIO DE SAÍDA: PORTUGUÊS (português de Moçambique), com linguagem natural e
adequada ao comércio de roupas em Moçambique. Todos os valores do JSON (nome, descricao,
material) devem estar em português. NUNCA escrevas o nome ou a descrição em inglês, mesmo que
reconheças a peça por um termo inglês — traduz sempre para um nome comercial em português
(ex.: em vez de "Quarter-Zip" escreve "Camisola Quarter-Zip Creme"). Usa termos de vestuário
comuns e compreensíveis para compradores moçambicanos (camisola, camisa, calças, calções,
vestido, saia, casaco, ténis, etc.). O idioma da saída é sempre português, independentemente
do idioma usado internamente para reconhecer o produto.
REGRA ABSOLUTA: todas as fotografias que recebes são vistas diferentes da MESMA peça única
(frente, costas, lateral, gola, mangas, fechos, estampas, etiqueta, detalhe).
Nunca as trates como produtos diferentes. Combina-as numa única compreensão da peça:
usa cada vista como informação complementar e não repitas a mesma característica só porque
aparece em várias fotos.
Ordem de raciocínio: 1) que peça é; 2) características visíveis (corte, mangas, gola, fecho,
botões, estampa, padrão, textura visível, detalhes de construção); 3) existe evidência escrita
do material (etiqueta/composição legível)?; 4) escrever nome; 5) escrever descrição factual;
6) indicar material só com evidência.
Responde em JSON, sempre em português, com exactamente estas chaves:
{"nome": "...", "descricao": "...", "material": "..."}
Regras:
- nome: identifica o tipo de peça e as características visíveis mais relevantes, ex. "Camisola
  Quarter-Zip Creme", "Camisa Social Azul de Manga Longa". Máx. 60 caracteres. Nunca uses nomes
  genéricos como "Roupa bonita", "Peça de roupa" ou "Produto de vestuário" quando é possível
  identificar o tipo de peça.
- descricao: 1 a 3 frases (máx. 300 caracteres), natural e adequada a uma loja online, apenas
  sobre o que é observável nas fotos. Sem exageros nem linguagem publicitária vazia.
- material: apenas se houver etiqueta ou composição legível nas fotos. Caso contrário escreve
  exactamente "Não identificado". Nunca deduzas o material pela aparência do tecido e nunca uses
  "geralmente", "provavelmente" ou "pode incluir".
- Precisão acima de completude: é melhor "Não identificado" do que inventar.
- Nunca inventes informação. Não incluas categoria, cor, tamanho, preço, stock ou marca no JSON.
Responde apenas com o objecto JSON.`;

/** Converte URLs do bucket "products" em data URLs reduzidas (menos custo por imagem). */
export async function imagesToDataUrls(urls: string[]): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: string[] = [];
  for (const url of urls.slice(0, MAX_IMAGES)) {
    const match = url.match(/\/products\/(.+?)(\?|$)/);
    if (!match) continue;
    const path = decodeURIComponent(match[1]);
    const { data, error } = await supabaseAdmin.storage
      .from("products")
      .download(path, { transform: { width: 512, quality: 70, resize: "contain" } });
    if (error || !data) continue;
    const buf = Buffer.from(await data.arrayBuffer());
    const type = data.type && data.type.startsWith("image/") ? data.type : "image/jpeg";
    out.push(`data:${type};base64,${buf.toString("base64")}`);
  }
  return out;
}

export type AiProductData = { nome: string; descricao: string; material: string };

export async function generateProductData(dataUrls: string[]): Promise<AiProductData> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("ai_unconfigured");

  const model = aiProductModel();
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 900,
      reasoning_effort: "minimal",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                dataUrls.length === 1
                  ? "Segue 1 fotografia de uma única peça de roupa. Gera o JSON com nome, descricao e material."
                  : `Seguem ${dataUrls.length} fotografias da MESMA peça de roupa (vistas/ângulos diferentes da mesma peça, podendo incluir a etiqueta). Analisa-as em conjunto como um só produto e gera um único JSON com nome, descricao e material.`,
            },
            ...dataUrls.flatMap((url, i) => [
              { type: "text" as const, text: `Vista ${i + 1} da mesma peça:` },
              { type: "image_url" as const, image_url: { url } },
            ]),
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[ai-product] gateway ${response.status}: ${body.slice(0, 500)}`);
    if (response.status === 429) throw new Error("ai_busy");
    if (response.status === 402 || response.status === 403) throw new Error("ai_unavailable");
    if (response.status === 400) throw new Error("ai_bad_image");
    throw new Error("ai_unavailable");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  let parsed: Partial<AiProductData> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
  } catch {
    throw new Error("ai_bad_image");
  }

  const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const nome = clean(parsed.nome, 80);
  if (!nome) throw new Error("ai_bad_image");

  return {
    nome,
    descricao: clean(parsed.descricao, 400),
    material: clean(parsed.material, 60) || "Não identificado",
  };
}
