# Navegação, catálogo e partilha — validação

## Alterações
- Filtros/pesquisa/preços/categoria ficam na URL das listas. Batches permanecem no cache durante a sessão; a volta não refaz as consultas já carregadas.
- Restauração do router por URL da lista e entrada de histórico do produto, sem scroll global partilhado entre páginas.
- Ligações de cards assinalam origem interna; botão Voltar usa history back. Entrada direta/externa usa Explorar.
- Explorar usa grid de geometria estável: CSS columns redistribuía produtos por coluna quando chegavam batches. Imagens quadradas mantêm a posição mesmo antes de carregar; títulos têm duas linhas e preços não são cortados.
- Ordem determinística por created_at/id; coleções mantêm prioridade com desempate por ID. Favoritos usam data de criação/product_id, partilhando cache e ordem entre as duas páginas.
- Preços principais dourados nos cards, detalhe e linhas de produto do carrinho/checkout; regras de desconto intactas.
- Detalhe carrega dados públicos no servidor; até cinco relacionados da mesma categoria e cinco disponíveis do vendedor, excluindo atual e repetições entre secções.
- Partilha tenta ficheiro da primeira foto real, com título/link oficial; fallback para link se não suportado. Metadata por ID e foto principal, com rendition 1200x630 para armazenamento público.

## Testes
- 50 testes automáticos passaram (112 assertions): catálogo/conta, limites de segurança, recomendações e partilha.
- Mobile 390x844, Explorar: 200 produtos carregados, sem repetidos; produto distante voltou ao mesmo Y=444, scrollY=8409, mesma ordem e todos os 200 preços presentes.
- Desktop 1280x1800: categoria vestido (86 produtos) e pesquisa/categoria (81 produtos), batches, URL/filtros/ordem e posição preservados com botão voltar do navegador.
- Favoritos autenticados: ambas as páginas abriram um produto e restauraram ordem/posição/preço; favorito temporário removido no fim, sem dados de teste deixados.
- Produto real mostrou cinco relacionados e cinco do vendedor.
- Partilha pelo botão real com Web Share simulado no navegador: ficheiro JPEG da imagem principal, título e canonical do produto corretos. Teste unitário também confirma bytes exatos e fallback.
- HTML SSR público: um title, um og:title, imagem e canonical do produto correto; imagem social respondeu HTTP 200, JPEG, 17.791 bytes.
- Entrada direta no produto: Voltar fez fallback para Explorar.
- Build/TypeScript: último registo build OK; nenhum pageerror nos fluxos testados.

## Limites
- Loja consultada devolveu «Loja não encontrada»; restauração com lista real de loja não pôde ser comprovada. Cache, desempate e cards foram atualizados para essa superfície.
- Não houve ensaio em aparelhos iPhone/Android nem envio real para WhatsApp/status; preview final depende do suporte do sistema e do crawler.
- Cache de batches vive no router da sessão ativa, não é persistido após recarregar/fechar o separador; logout continua a limpar os caches.
- Metadata novo chega ao domínio oficial na próxima publicação. Nenhuma publicação feita neste pedido.
- Tarefas antigas abertas no roadmap não foram alteradas: checkout transacional e mudanças de cidade/convite de cadastro estão fora deste pedido.

## Ficheiros alterados
- src/router.tsx
- src/types/history.d.ts
- src/hooks/useProductFeed.ts
- src/hooks/useFavorites.ts
- src/hooks/useFavoriteProducts.ts (novo)
- src/components/ProductCard.tsx
- src/components/ProductCarousel.tsx
- src/routes/index.tsx
- src/routes/explorar.tsx
- src/routes/produtos.tsx
- src/routes/loja.$id.tsx
- src/routes/favoritos.tsx
- src/routes/perfil.favoritos.tsx
- src/routes/produto.$id.tsx
- src/routes/carrinho.tsx (só apresentação e origem da ligação)
- src/routes/checkout.tsx (só cor do preço de produto)
- src/lib/productDetails.ts (novo)
- src/lib/productDetails.functions.ts (novo)
- tests/product-navigation-sharing.test.ts (novo)
- AGENTS.md e roadmap.md

Revisão de código verificada: d80a25b (versionamento automático da plataforma; documentação posterior pode criar nova revisão).