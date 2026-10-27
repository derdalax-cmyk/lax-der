# Validação — catálogo e conta

## Alterações
- `src/lib/productFeed.ts`, `src/hooks/useProductFeed.ts`: carregamento automático de 40 produtos por lote, cursor por created_at/id, filtros isolados, cancelamento de pedidos obsoletos e deduplicação.
- `src/routes/explorar.tsx`, `src/routes/produtos.tsx`: sem paginação numerada, sem próxima/anterior ou botão de carregar mais; produtos acumulados até terminar.
- `src/routes/index.tsx`, `src/components/ProductCarousel.tsx`: ligações de navegação dizem «Ver tudo», não «Ver mais»; selecções editoriais/carrosséis preservados.
- `src/lib/ai-product.server.ts`, `src/lib/ai-product-validation.ts`: prompt factual e validação no servidor; remoção de frases sobre corpo/pessoas, rejeição de tipos inválidos e contradições detectáveis; material não identificado salvo etiqueta declarada legível. Modelo, endpoint, limites da chamada e autorização existentes preservados.
- `src/components/ProvinceCityFields.tsx`: Cidade manual, sugestões preservadas, «Ex: Beira».
- `src/routes/login.tsx`, `src/lib/validation.ts`, `src/lib/safeRedirect.ts`: bandeira e +258 fixo, número nacional formatado, home como destino por defeito independentemente de role.
- `tests/catalogue-account.test.ts`: testes focados, juntamente com os testes de segurança existentes.
- `AGENTS.md`, `roadmap.md`: documentação das decisões e tarefas.

## Resultados
- PASSOU: 44 testes, 91 asserções, incluindo os 12 testes de segurança existentes.
- PASSOU: Explorar e Catálogo chegaram a 212 produtos reais, 212 IDs únicos, sem paginação visual.
- PASSOU: pesquisa sem resultados limpa o conjunto; limpar pesquisa repõe produtos nas duas listas.
- PASSOU: cadastro mobile a 390×844 mostra bandeira, +258, número 84 000 0000 e Cidade Ex: Beira.
- PASSOU: sessão real de Admin em /login vai para /; /admin explícito e redirect=/admin vão para /admin/verificar.
- PASSOU: chamada real de IA com fotografia existente, sem guardar produto ou criar dados de teste, devolveu descrição validada e material Não identificado.
- PASSOU: build/TypeScript automático, sem erros de runtime no fluxo testado.
- Inspecção: loja, favoritos, produtos de vendedores e Admin não tinham controlos residuais de paginação de produtos; recomendações limitadas e selecções editoriais não são listas paginadas e foram preservadas.

## Limites
- A validação textual não comprova por si só cada detalhe visual nem a leitura de uma etiqueta; não é uma garantia de ausência de alucinações. Revisão humana continua obrigatória.
- Não foi criado novo utilizador nem exercitado OAuth Google com credenciais; testou-se o destino após sessão real de Admin hidratada.
- Categoria, sexo, cidade e preços foram preservados no pedido; o teste no navegador do reinício usou pesquisa. Não se executaram todas as combinações de filtros.
- Outras tarefas históricas abertas no roadmap não fazem parte deste pedido; a criação de pedido real continua dependente de autorização para notificar o vendedor.
- As alterações estão no preview; não foi feita publicação.

Revisão verificada antes desta documentação: `135155dc6631d9ff07680eef5b2bd272844e76d8` (versionamento gerido pela plataforma).