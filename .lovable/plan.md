# Colaboradores por loja (Equipe DERDALAX)

## Como entendi o pedido

A DERDALAX precisa de várias pessoas a cadastrar produtos ao mesmo tempo, cada uma com a sua própria conta, sem partilhar login de administrador e sem acesso a vendas, pagamentos, pedidos ou ao painel admin. O Administrador Superior atribui pessoas já registadas a lojas específicas, com uma função (hoje: "Gestor de Cadastro de Produtos"), e pode suspender ou remover esse acesso a qualquer momento. Tudo o que o colaborador faz fica registado (quem, quando, o quê, valor antigo e novo).

O que já existe e vai ser reaproveitado: contas e login, lojas/vendedores, produtos com variações e fotos, formulário de produto, painel do vendedor, painel admin e a página de cada loja no admin. Nada disso será duplicado nem alterado no aspeto visual.

## Onde ficam as novas opções

Na lista de vendedores do admin, dentro da ficha de cada loja — exatamente ao lado de onde hoje se define a "Cidade de venda":

```text
 Ficha da loja (admin > Vendedores > ver detalhes)
 ┌──────────────────────────────────────────────────────────┐
 │ [logo]  Loja Maria                        (Aprovado)     │
 │ Responsável / Email / Telefone / Localização             │
 │                                                          │
 │ CIDADE DE VENDA (só admin)                               │
 │ [ Maputo                     ]  [ Guardar ]              │
 │                                                          │
 │ COLABORADORES (só admin)              ← NOVO             │
 │ • joao@email.com  Gestor de Cadastro  ATIVO   [⋯]        │
 │ • ana@email.com   Gestor de Cadastro  SUSPENSO[⋯]        │
 │ [ + Adicionar colaborador ]                              │
 └──────────────────────────────────────────────────────────┘
```

"Adicionar colaborador" abre uma janela simples: e-mail da pessoa (conta já existente) + função + permissões pré-marcadas. Se o e-mail não tiver conta DERDALAX, avisamos e pedimos que a pessoa se registe primeiro — nunca criamos conta nova.

Nova página no menu do admin, "Equipe", com a visão global:

```text
 Admin > Equipe
 ┌──────────────────────────────────────────────────────────┐
 │ [pesquisar pessoa ou loja]   [função ▾] [estado ▾]       │
 │──────────────────────────────────────────────────────────│
 │ João   joao@email.com   Loja Maria   Cadastro   ATIVO    │
 │ Pedro  pedro@email.com  Loja Maria   Cadastro   ATIVO    │
 │ Ana    ana@email.com    Loja X       Cadastro   SUSPENSO │
 │        (suspender · reativar · remover · ver produtos)   │
 └──────────────────────────────────────────────────────────┘
```

Do lado do colaborador, no perfil dele aparece um bloco novo:

```text
 Perfil > Minhas responsabilidades
 ┌───────────────────────────────────────────┐
 │ [logo] Loja Maria                         │
 │        Gestor de Cadastro de Produtos     │
 │        25 produtos · 3 em revisão         │
 │                            [ ACESSAR ]    │
 └───────────────────────────────────────────┘
```

E o ambiente de trabalho dele, enxuto e só com o que a função permite:

```text
 DERDALAX · Loja Maria — Gestor de Cadastro de Produtos
 ┌──────────────────────────────────────────────────────────┐
 │ Cadastrados: 25   Em revisão: 3   Aprovados: 22          │
 │ [ + CADASTRAR PRODUTO ]                                  │
 │──────────────────────────────────────────────────────────│
 │ Camisola Quarter-Zip Creme   900 MT  em revisão [editar] │
 │ Calça Cargo Preta            750 MT  aprovado  [editar]  │
 └──────────────────────────────────────────────────────────┘
```

Sem menu de pedidos, vendas, pagamentos, mensalidade nem botão de apagar.

## Detalhes técnicos

**Base de dados (migração)**
- `collaborator_roles`: catálogo de funções (`slug`, `label`, `default_permissions text[]`), semeado com `product_manager` → `products.create`, `products.update`, `products.view`, `seller.view_basic`.
- `seller_collaborators`: `user_id`, `seller_id`, `role_slug`, `permissions text[]`, `status` enum (`active|suspended|removed`), `invited_by`, timestamps + trigger `set_updated_at`; único por (user_id, seller_id). GRANT a `authenticated`/`service_role`; RLS: o próprio vê as suas linhas, admin gere tudo.
- `activity_logs`: `actor_id`, `actor_email`, `seller_id`, `entity_type`, `entity_id`, `action`, `changes jsonb`, `created_at`. Só admin lê; escrita por função `security definer` (`log_activity`).
- Funções `security definer`: `has_seller_permission(_seller_id uuid, _perm text)` (ativo + permissão na lista, ou admin) e `my_collaborations()` (lojas + função + contadores de produtos para o perfil).
- RLS de `products`/`product_variations`: às políticas atuais de vendedor junta-se `has_seller_permission(seller_id,'products.create'|'products.update'|'products.view')` em INSERT/UPDATE/SELECT. DELETE fica restrito a dono da loja e admin — colaborador nunca apaga. Trigger `BEFORE UPDATE` em `products` impede colaborador de mudar `seller_id` (transferir loja) e trigger `AFTER INSERT/UPDATE` grava em `activity_logs` incluindo preço antigo/novo.
- Gestão de associações via funções `security definer` só-admin: `add_seller_collaborator(_email, _seller_id, _role, _permissions)`, `set_collaborator_status`, `set_collaborator_role` — resolvem o e-mail em `profiles`/`auth.users` e devolvem erro claro se não existir conta.

**Frontend**
- `src/hooks/useCollaborations.ts` — lojas do utilizador atual com função e permissões.
- `CollaboratorsSection.tsx` + `AddCollaboratorModal.tsx` dentro da ficha da loja em `src/routes/admin.vendedores.tsx` (ao lado do `CityEditor`).
- Nova rota `src/routes/admin.equipe.tsx` + item no menu do admin.
- Bloco "Minhas responsabilidades" em `src/routes/perfil.index.tsx`.
- Novas rotas `src/routes/colaborador.tsx` (layout com verificação de acesso), `colaborador.$sellerId.tsx` (painel) e reutilização de `ProductFormModal` em modo colaborador: `seller_id` fixo pela associação, sem apagar, sem campos financeiros.
- Segurança real no backend (RLS + funções), a UI apenas espelha; acesso direto por URL a `/admin` ou `/vendedor` continua bloqueado para colaboradores.

**Verificação**: testes com dados reais confirmando que o colaborador cria e edita produtos da loja atribuída, não apaga, não altera outra loja, perde acesso ao ser suspenso, e que cada ação aparece no registo de atividades.
