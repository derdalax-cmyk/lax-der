# Cache público DERDALAX

## Estratégia
- QueryClient por pedido SSR, sem singleton entre utilizadores. Restauração no `beforeLoad` da raiz antes dos loaders no navegador; nenhuma operação IndexedDB durante SSR.
- Persistência IndexedDB `derdalax-public-catalog/cache`, versão `dx-public-catalog-v2`; fallback localStorage apenas quando IndexedDB falha. Projecção positiva de chaves **e campos**, novamente aplicada ao ler.
- Freshness 30 minutos; retenção máxima 24 horas por query (não renovada só por guardar). Revalidação de queries públicas observadas em background, sem focus-refetch; offline-first, apenas um retry transitório. Defaults privados não mudam.
- Máximo 24 queries recentes, 750 KB estimados por query, 4 MB totais (estimativa conservadora UTF-16), 20 batches contíguos de 40 produtos por feed, 5 imagens por produto. Quota: reduzir metade das entradas antigas, fallback e ignorar falha sem crash. Não é um catálogo normalizado global: reutiliza os batches React Query sem um segundo índice de produtos.
- Ordem dos IDs sobreviventes mantida dentro de cada página com o mesmo cursor inicial; nunca se transferem produtos entre páginas servidor. Quando o cursor inicial muda, preserva-se a página recebida. Cursores permanecem derivados das respostas servidor, nunca do último item visual reordenado. Deduplicação partilhada continua ativa. Snapshot/âncora e medição masonry preservados; encontrada e corrigida corrida em que canonicalização da URL cancelava a restauração.
- Invalidações existentes após escritas de produto/categoria/pedido do vendedor propagam apenas para chaves públicas do catálogo/facets, sem invalidar auth, favoritos, notificações ou todo o QueryClient. Mudanças noutro dispositivo chegam pelo TTL. Não se criou canal realtime novo.

## Persistido / excluído
Persistido: `product-feed`, `home-featured`, `home-collections`, `public-categories`, `public-product-details`, `home-banners`, com campos públicos explícitos. Seller ID no detalhe é a associação pública da loja já mostrada pelo produto, não o dono da reserva.

Nunca persistido: queries admin/vendedor privado/perfil/pedidos/carrinho/mensagens/passkeys/notificações/favoritos; mutations, erros, meta, tokens, sessão, telefone, endereço, email privado e `reserved_by`. URLs assinadas, com credenciais ou argumentos de assinatura são excluídas também do cache de dimensões.

## Offline / PWA
- Skill PWA: worker `/sw.js` **gerado** por vite-plugin-pwa (`generateSW`), apenas build client, sem auto-injection/dev worker. Removido worker manual antigo. Uma única wrapper recusa app-shell em dev/previews/iframe/`?sw=off`; push continua através de `push-events.js`, importado pelo worker de produção e separado em preview.
- Imagens públicas apenas do bucket `products`, `/storage/v1/object/public/products/` e `/storage/v1/render/image/public/products/`: stale-while-revalidate, URL completa, CORS sem credenciais, resposta 200 legível, 300 entradas LRU / 7 dias / purge on quota. Thumbnails 500px, main 1000px e large 1200px não alterados; nenhuma busca adicional de originais.
- APIs, server functions, signed storage, HTML privado e OAuth nunca têm rota de cache. Navegação pública: NetworkFirst, timeout 3s, 30 páginas/24h; pedido sem cookies, resposta privada/no-store/Set-Cookie excluída. Assets same-origin hashed: CacheFirst, 120 entradas/30 dias e precache dos assets gerados. Versão `catalog-v2`; remove apenas caches antigos app-shell/assets/imagens da DERDALAX.
- Offline completo só após publicar e visitar páginas/imagens. Páginas não visitadas, dados privados e recursos não guardados continuam a precisar de rede. HTML público com `no-store` não é guardado por segurança; não prometemos offline para tais páginas. Não testado em PWA instalado físico nem domínio publicado nesta tarefa.

## Testes executados
- 42 testes / 152 assertions passaram em seis ficheiros: novo `tests/public-catalog-cache.test.ts`, list-context, catalogue-stability, product-navigation-sharing, product-image-frame e home-presentation; inclui regressão de fronteiras página/cursor.
- Explorar real 390px: 160–200 produtos em 4–5 batches, sem duplicados; produto -> browser voltar: âncora delta **0px**. Reabertura em nova página (QueryClient novo) com rede do catálogo bloqueada: mesmos IDs/batches/ordem recuperados do IndexedDB.
- Dados persistidos envelhecidos 31 min: aparecem antes da rede; reconexão e revalidação com catálogo real concluídas sem alterar a ordem.
- Worker gerado com opções reais, testado em origem localhost isolada (não no preview): imagem pública gravada com URL transformada completa, segunda imagem disponível offline, versão antiga removida, APIs e signed URLs sem entradas de cache. Erros de rede provocados para endpoints excluídos eram esperados, não erros runtime da app.
- Worker gerado sem warnings de geração; aviso não bloqueante do browserslist desatualizado. Último log automático de build/TypeScript: OK. Não foi executado build manual.
- Não alterou dados/backend, desenho, regras de preço/desconto/checkout ou segurança admin. Não há migration.

## Ficheiros
Novos: `src/lib/publicCachePolicy.ts`, `src/lib/publicCatalogCache.ts`, `src/lib/offlineCachePolicy.ts`, `public/push-events.js`, `public/offline-maintenance.js`, `tests/public-catalog-cache.test.ts`.

Alterados: `src/router.tsx`, `src/routes/__root.tsx`, `src/hooks/useProductFeed.ts`, `src/components/ListContextRestorer.tsx`, `src/components/product/ProductDetailPending.tsx`, `src/lib/productImageCache.ts`, `src/routes/index.tsx`, `src/routes/produto.$id.tsx`, `src/lib/serviceWorker.ts`, `vite.config.ts`, dependências/lockfiles, `AGENTS.md`, `roadmap.md`. `public/sw.js` manual removido; será produzido no build.