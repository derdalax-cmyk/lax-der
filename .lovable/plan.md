# Corrigir pedido de permissão de notificações no TWA

## Alterações
- Manter o banner automático e iniciar o pedido nativo apenas ao tocar em **Ativar**.
- Remover os bloqueios antecipados baseados apenas em `Notification.permission === "denied"` no banner e no Perfil.
- Em cada tentativa manual, chamar diretamente `Notification.requestPermission()` antes do registo push, incluindo no TWA.
- Distinguir uma recusa normal de um bloqueio persistente: a primeira mostra uma mensagem simples; apenas tentativas posteriores persistentemente negadas mencionam as definições.
- Preservar `/sw.js`, VAPID, armazenamento das subscrições, layout, rotas e restantes funcionalidades.

## Verificação
- Executar a verificação TypeScript relevante.
- Confirmar o resultado do build automático e rever os ficheiros alterados.

## Detalhes técnicos
- A lógica ficará concentrada no hook existente; banner e linha do Perfil continuarão a reutilizar `subscribe()`.
- O estado de uma tentativa anterior será guardado localmente apenas para escolher a mensagem adequada, sem bloquear novas tentativas.
