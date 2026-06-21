## Reestruturação DERDALAX

Plano cobrindo as Etapas 1–5 em detalhe. A Etapa 6 ficou cortada na tua mensagem — incluo uma proposta base e confirmo contigo no fim.

---

### ETAPA 1 — Navegação (menu inferior)

- Novo componente `BottomNav.tsx`: barra fixa no fundo (mobile-first), 4 itens — Início (`/`), Explorar (`/explorar`), Categorias (`/categorias`), Suporte (`/suporte`). Ícone ativo a dourado (#e4b363 / token `gold`).
- No desktop (`md:`), a barra inferior esconde-se e os mesmos 4 links aparecem no header (atualizar `Navbar.tsx`).
- Header mantém ícones de **Carrinho** e **Perfil/Conta** (acesso a `/carrinho`, `/perfil`/`/login`).
- Adicionar `padding-bottom` ao layout no mobile para o conteúdo não ficar tapado pela barra.

### ETAPA 2 — Página inicial (`/`)

- **Hero**: título "Moda com história, estilo com futuro", subtítulo "Peças únicas, selecionadas para você", botão "Explorar coleção" → `/explorar`.
- **Carrosséis horizontais** (scroll-x livre, sem dots, snap; card ~70% no mobile / ~22% no desktop):
  - ⭐ Destaques da semana → produtos `featured = true`.
  - Secções dinâmicas vindas da tabela de **categorias de destaque** (ver Etapa 3), ex.: 👕 Camisas, 👖 Calças, 👟 Sapatos.
- Botão "Ver mais …" no fim de cada secção → `/produtos?categoria=<slug>`.
- Componente reutilizável `ProductCarousel.tsx` + card compacto.

### ETAPA 3 — Admin: categorias de destaque

**Base de dados** (migração):
- `featured_collections` (id, name, slug, icon, sort_order, created_at) — secções de destaque.
- `featured_collection_products` (collection_id, product_id, sort_order) — associação N:N com ordem manual.
- GRANTs + RLS: leitura pública (`anon`/`authenticated`), escrita só admin via `has_role`.

**UI** (`/admin/categorias-destaque`):
- Lista com nome, slug, nº de produtos, ações; reordenar por drag&drop (lib `@dnd-kit`).
- Modal "Nova categoria de destaque": nome, slug auto-gerado, escolha de ícone (emoji).
- Editar: adicionar/remover produtos e reordená-los (drag&drop).
- No `ProductFormModal`: multiselect "Categorias de destaque" para escolher onde o produto aparece.

### ETAPA 4 — Explorar e Categorias

- **`/explorar`**: grid masonry (estilo Pinterest) com todos os produtos, barra de busca, filtro por categoria, ordenação (recentes/preço asc/desc) e "Ver mais" (load more).
- **`/categorias`**: lista das categorias fixas (camisas, calças, sapatos, chapéus, calções, casacos) com ícone, nome e contagem de produtos → `/produtos?categoria=<slug>`.
- `/produtos` passa a ler `?categoria=` via search params para pré-filtrar.

### ETAPA 5 — Suporte (`/suporte`)

- FAQ (acordeão), contactos (WhatsApp, telefone, email com links), e secção de localização.

### ETAPA 6 — Serviços de pagamento (proposta — confirmar)

Como o texto ficou cortado, proponho: criar `src/services/payment/` com uma interface comum `PaymentProvider` e um adaptador Paysuite a apontar para a server function/webhook já existentes, deixando preparado para outros provedores (e-Mpesa/e-Mola). **Confirma o conteúdo exato que pretendias aqui.**

---

### Notas técnicas

- Rotas novas: `src/routes/explorar.tsx`, `admin.categorias-destaque.tsx`; reescrever `categorias.tsx` e `suporte.tsx`.
- `produtos.tsx` migra para `validateSearch` (zod) para o filtro `categoria`.
- Drag&drop: adicionar `@dnd-kit/core` + `@dnd-kit/sortable`.
- Leituras públicas das coleções de destaque via cliente browser (RLS com SELECT para `anon`).
- Sem alterações ao fluxo de checkout/pagamento já funcional, apenas a camada de organização da Etapa 6.

Confirmas este plano (e o conteúdo da Etapa 6) para eu começar a construir?