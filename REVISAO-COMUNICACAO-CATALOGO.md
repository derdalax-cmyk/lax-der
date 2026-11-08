# Revisão de comunicação, marca e catálogo

## Entregue
- Push: 50, 75 ou 100 destinatários por campanha, padrão 50. O limite é de pessoas, não de mensagens para uma pessoa. Seleção determinística por utilizador, aplicada no servidor; filtros preservados.
- Estimativas e histórico mostram limite, elegíveis, enfileirados, aceites, falhas e motivos de exclusão.
- Elegibilidade Push é verificada na seleção e imediatamente antes do envio: preferências, conta não bloqueada e subscrição HTTPS com chaves válidas.
- Restrição única campanha/utilizador/canal e marca persistente anterior ao envio impedem repetição após entrega ambígua. Só falhas anteriores ao envio podem repetir. Isto privilegia ausência de duplicação, não garante entrega.
- Marca textual Derdalax aplicada a 79 ficheiros de interface, emails, metadados e manifesto, sem renomear identificadores, URLs ou domínios. Notificações antigas são normalizadas apenas na apresentação.
- Cache público preservado. Revalidação das listas adiada durante navegação abaixo do topo ou restauração; conteúdo antigo permanece. Revalidação em curso é cancelada se começar navegação/restauração. Masonry reutiliza a assinatura de IDs e alturas.

## Email: causa e bloqueio
O domínio de envio está ativo e os emails de conta/pedidos estão configurados. A infraestrutura existente destina-se exclusivamente a emails esperados por uma ação individual; não permite campanhas promocionais ou envios para listas, mesmo com consentimento e limite. Nenhum serviço de marketing dedicado foi encontrado. Por isso Email-only e Push+Email continuam indisponíveis, sem contornar unsubscribe/suppression e sem afetar os emails existentes.

O limite 50/75/100 está preparado por campanha, mas só o canal Push funciona nesta revisão. Não foram implementados nem enviados emails promocionais, nem testado um email de produtos. A ativação Email depende de ligar um serviço de marketing dedicado.

## Ficheiros principais
- `drizzle/migrations/0032_bounded_campaign_delivery.sql`
- `src/lib/campaigns.ts`, `campaigns.functions.ts`, `campaigns.server.ts`
- `src/routes/admin.comunicacao.tsx`
- `src/lib/publicCachePolicy.ts`, `publicCatalogCache.ts`
- `src/components/product/ProductMasonry.tsx`, `src/routes/loja.$id.tsx`
- `src/lib/brandText.ts`, `src/components/vendedor/SellerNotificationBell.tsx`
- `src/routes/api/public/email/dispatch.ts`, `public/push-events.js`
- Ficheiros de textos da interface, emails, metadados e manifesto; regras em `AGENTS.md`.
- `tests/admin-campaigns.test.ts`, `catalogue-stability.test.ts`, `campaign-delivery.test.ts`

## Verificação
- 103 testes passaram: limites, seleção determinística, unicidade, worker com opt-out, ausência de subscrição e reexecução sem duplicação; persistência pública e regressões existentes. Worker testado com envios simulados, nunca envio real a destinatários.
- Explorar mobile: abrir produto e voltar, desvio de âncora 0 px; evento online a meio da lista, 0 novos pedidos de feed e 0 deslocação.
- Categorias desktop: 90 frames sem deslocação de cards/scroll (0 px) durante evento online; sem erros runtime.
- Home estava sem produtos destacados/coleções visíveis nesta sessão, e Loja não apresentou produtos: estabilidade com dados nestas duas superfícies não foi validada.
- Admin autenticado chegou à verificação de administrador; nenhuma passkey/código foi contornada, logo envio/histórico Admin não foram exercitados de ponta a ponta.
- Compilação automática sem erros. Atualização com alterações reais de produtos e vários dispositivos não validada.
- A fila existente acorda ao enfileirar, verifica a cada minuto enquanto há trabalho e desliga após terminar; não foi criada uma verificação permanente adicional.

Não foram alteradas regras de checkout, pagamento, preços, descontos ou segurança administrativa.