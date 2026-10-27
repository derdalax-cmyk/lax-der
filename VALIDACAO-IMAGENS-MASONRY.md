# Enquadramento de imagens de produtos

## Resultado
- Grelhas verticais com colocação na coluna mais curta; ordem dos dados/DOM e carregamento incremental intactos.
- Duas colunas mobile; número desktop e espaçamentos existentes preservados.
- Home mantém carrosséis horizontais e navegação snap, agora com alturas naturais por foto.
- Imagens apresentadas integralmente com `contain`, proporção natural limitada entre 3:4 e 4:3, sem modificar originais.
- Removido também o recorte quadrado nas URLs transformadas do armazenamento: só mudar CSS não recuperaria partes já cortadas no servidor.
- Galeria conserva navegação, swipe e rotação; miniaturas mostram a foto inteira.

## Ficheiros alterados
- `src/lib/productImageFrame.ts` (novo): limites e rotação.
- `src/components/product/NaturalProductImage.tsx` (novo): imagem integral e cache de dimensões.
- `src/components/product/ProductMasonry.tsx` (novo): colocação medida, sem reordenar dados.
- `src/lib/imageUrl.ts`
- `src/components/ProductCard.tsx`
- `src/components/ProductCarousel.tsx`
- `src/styles.css`
- `src/routes/explorar.tsx`
- `src/routes/produtos.tsx` (também catálogo filtrado por categoria)
- `src/routes/favoritos.tsx`
- `src/routes/perfil.favoritos.tsx`
- `src/routes/loja.$id.tsx`
- `src/routes/produto.$id.tsx` (galeria e duas recomendações)
- `tests/product-image-frame.test.ts` (novo)
- `AGENTS.md`, `roadmap.md`, este relatório.

## Validação
- 57 testes passaram: proporções, catálogo/conta, navegação/partilha e fronteiras de segurança.
- Preview Chromium desktop 1280×1800 e mobile 390×844: cinco colunas desktop, duas mobile, sem erros de execução.
- Catálogo incremental: 215 produtos, zero IDs repetidos.
- Abrir produto e voltar no mobile: scroll 1500 → 1500.
- Loja pública: 215 cards; categoria filtrada e duas secções de recomendações renderizadas.
- Favoritos autenticados: adicionado um produto pela UI, lido na página de favoritos mobile e removido imediatamente; nenhum favorito de teste ficou guardado.
- Fixtures temporárias interceptadas apenas no navegador: 1:1, 4:3, 3:4, retrato extremo e paisagem extrema; `contain` e limites confirmados, sem persistir dados de produtos.
- Galeria e rotação renderizadas; Home verificada sem a sobreposição da Roleta.
- Último sinal de compilação automática: `build OK`; nenhum erro de runtime registado.

## Limites
- Fotos originalmente já cortadas não podem recuperar a parte ausente; não foi usada IA nem alteração destrutiva.
- Dimensões desconhecidas começam em 1:1 até a imagem carregar; cache reutiliza as dimensões durante a sessão para estabilizar o regresso.
- Não houve teste em dispositivos físicos Safari/iOS/TWA; validação desktop/mobile feita em Chromium.
- Revisão observada antes deste relatório: `3cc87f4`; o versionamento final é gerido automaticamente pela plataforma.
- Não publicado nesta tarefa.