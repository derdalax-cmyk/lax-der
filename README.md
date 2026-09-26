# DERDALAX 

Cria um e-commerce completo para venda de roupas chamado "DERDALAX" em Moçambique.

**Tecnologias:**

- React com TypeScript

- Tailwind CSS

- React Router

- Supabase (Auth + Database + Storage)

**Paleta de Cores:**

- Preto: #0a0a0a

- Amarelo: #e4b363 (botões principais, destaques)

- Verde: #1a4d2e (hover, sucessos)

- Branco: #ffffff

- Cinza claro: #f8f8f8

- Cinza escuro: #6c6c6c

- Vermelho: #c44545 (erros, alertas)

**Fontes:**

- Corpo: 'Inter', sans-serif

- Títulos: 'Playfair Display', serif

**========== 1. AUTENTICAÇÃO E NÍVEIS DE ACESSO ==========**

**Métodos de login:**

- Login social (Google, Facebook, Apple - "Sign in with Apple")

- Login tradicional (email ou nunero/senha) como fallback

**Dois níveis de usuário:**

- **Admin**: Acesso total ao painel administrativo

- **Cliente**: Acesso à loja e perfil

**Fluxo pós-login (CLIENTE):**

1. Após o primeiro login social, exibir um modal/card obrigatório com:

   - Cidade (dropdown) - opções: Beira, Maputo, Nampula, Quelimane, Chimoio, Tete, Lichinga, Pemba, Xai-Xai, Inhambane

2. Cliente **NÃO** pode fazer compras sem preencher estes dados

3. Após preenchimento, os dados são guardados no perfil e o cliente pode comprar

4. O cliente pode editar estes dados no perfil a qualquer momento

**========== 2. SUPABASE TABLES ==========**

Cria as seguintes tabelas:

**users** (estende auth.users):

- id (uuid, primary key)

- email (text)

- name (text)

- phone (text)

- nr_documento (text) - NÚMERO DE DOCUMENTO OBRIGATÓRIO

- city (text)

- role (text) - 'admin' ou 'client'

- created_at (timestamp)

- updated_at (timestamp)

**products**:

- id (uuid, primary key)

- title (text)

- description (text)

- base_price (numeric)

- category (text)

- images (jsonb) - array de URLs

- is_unique (boolean) - default false (PEÇA ÚNICA)

- featured (boolean)

- status (text) - 'available', 'reserved', 'sold'

- reserved_by (uuid, references users.id)

- reserved_until (timestamp)

- created_at (timestamp)

**product_variations**:

- id (uuid, primary key)

- product_id (uuid, references products)

- size (text) -     os Tamanhos  devem ser escritos, maunualmente, pelos admin ao add o produto

- color (text)

- stock (integer) - default 0

- price (numeric) - nullable

- is_active (boolean) - default true

**orders**:

- id (uuid, primary key)

- user_id (uuid, references users)

- subtotal (numeric)

- shipping (numeric)

- total (numeric)

- status (text) - 'pending', 'paid', 'processing', 'sent', 'delivered', 'cancelled'

- payment_method (text) - 'e-mpesa', 'e-mola'

- payment_status (text)

- customer_name (text)

- customer_phone (text)

- shipping_address (jsonb)

- created_at (timestamp)

**order_items**:

- id (uuid, primary key)

- order_id (uuid, references orders)

- variation_id (uuid, references product_variations)

- quantity (integer)

- price (numeric)

**addresses**:

- id (uuid, primary key)

- user_id (uuid, references users)

- street (text)

- number (text)

- neighborhood (text)

- city (text)

- province (text)

- building (text) - opcional

- apartment (text) - opcional

- reference (text) - opcional

- is_default (boolean)

**favorites**:

- id (uuid, primary key)

- user_id (uuid, references users)

- product_id (uuid, references products)

- created_at (timestamp)

- unique constraint on (user_id, product_id)

**waiting_list** (fila de espera para peças únicas):

- id (uuid, primary key)

- product_id (uuid, references products)

- user_id (uuid, references users)

- position (integer)

- status (text) - 'waiting', 'notified', 'expired'

- notified_at (timestamp)

- reserved_until (timestamp)

- created_at (timestamp)

**========== 3. PÁGINAS ==========**

**Páginas Públicas:**

1. Home

2. Produtos (listagem com filtros)

3. Detalhes do Produto

4. Login (social + email/senha)

**Páginas Protegidas (Cliente):**

5. Carrinho

6. Checkout (3 etapas)

7. Perfil (dados, endereços, pedidos, favoritos)

**Páginas Protegidas (Admin):**

8. Admin Dashboard

   - Estatísticas (totais, gráficos)

   - Gestão de produtos (CRUD)

   - Gestão de pedidos

   - Gestão de utilizadores

**========== 4. FLUXO DE COMPRA ==========**

**Checkout em 3 etapas (obrigatório):**

**Etapa 1 - Informações Pessoais** (apenas se faltarem no perfil):

- Nome completo

- Email

- Telefone (+258)

**Etapa 2 - Endereço de Entrega:**

- Rua

- Número

- Bairro

- Cidade (dropdown)

- Província

- Ponto de referência

- Dados do prédio (opcional)

**Etapa 3 - Confirmação e Pagamento:**

- Resumo do pedido

- Seleção de pagamento (e-Mpesa ou e-Mola)

- Confirmação

**Regra de Frete:**

- Grátis acima de  X= "valor definido no painel admin pelo admin" MZN

- Caso contrário,   X= "valor definido no painel admin pelo admin" MZN

**========== 5. FUNCIONALIDADE ESPECIAL - PEÇAS ÚNICAS ==========**

**Produtos com flag 'is_unique':**

1. Quando adicionado ao carrinho:

   - Produto fica 'reserved' por 15 minutos

   - Mostrar badge "PEÇA ÚNICA" no card e detalhe

   - Mostrar contador regressivo no carrinho

2. Bloqueio para outros utilizadores:

   - Produto reservado mostra "Indisponível temporariamente"

   - Se disponível novamente, mostrar botão "Avise-me"

3. Fila de espera:

   - Utilizador pode entrar na fila

   - Quando reserva expirar, notificar próximo da fila

   - Dar 10 minutos para o utilizador reservar

4. Job automático (supabase cron) para limpar reservas expiradas a cada minuto

**========== 6. COMPONENTES REUTILIZÁVEIS ==========**

- ProductCard (imagem, título, preço, fav button, badge peça única)

- Navbar (logo, links, ícones busca, carrinho, favoritos, usuário)

- Footer (logo, links, redes sociais, contatos WhatsApp)

- Notification (feedback de ações)

- LoadingSpinner

- AddressForm (reutilizado em vários locais)

- OrderSummary (resumo do pedido)

**========== 7. ESTADO GLOBAL (CONTEXT API) ==========**

- user (dados do utilizador, incluindo  city)

- isAuthenticated (boolean)

- cart (itens no carrinho)

- favorites (IDs dos produtos favoritos)

**========== 8. REGRAS DE NEGÓCIO ==========**

- Admin pode visualizar lista de clientes e verificar quem completou o perfil

- Pagamento via e-Mpesa e e-Mola (integração real com gateway)

**========== 9. RESPONSIVIDADE ==========**

- Desktop: grid de 4-5 produtos

- Tablet: grid de 2-3 produtos

- Mobile: grid de 1-2 produtos

- Menu mobile com hambúrguer

- Checkout adaptado para cada tamanho de ecrã

**========== 10. INÍCIO DO DESENVOLVIMENTO ==========**

Começa pelo setup do projeto:

1. Configuração do Supabase (tabelas, RLS policies)

2. Configuração da autenticação social (Google, Facebook, Apple)

3. Componentes base (Navbar, Footer, Layout)

4. Página de Login com opções sociais

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://lax-der.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/67df5107-8177-480b-a27d-14dfb37e79d3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
