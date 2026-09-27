# Remover avisos de cidade vazia e convidar visitantes a criar conta

## Alterações
- Simplificar o estado vazio da página inicial e do Explorar: quando a cidade não tiver produtos, mostrar apenas a mensagem genérica “Nenhuma peça encontrada.”, sem mencionar a cidade e sem ações para trocar ou limpar a seleção.
- Ajustar o aviso global de cidade para aparecer somente enquanto nenhuma cidade tiver sido escolhida; uma cidade escolhida nunca fará esse aviso reaparecer por falta de produtos.
- Criar um convite compacto e não bloqueante na página inicial para visitantes sem sessão, com marca, título, texto, fechar, “Criar conta” e “Entrar”.
- Exibir o convite alguns segundos após a página carregar e guardar o encerramento localmente durante 24 horas.
- Fazer `/login?mode=signup` abrir diretamente o formulário “Criar conta”, mantendo `/login` em “Entrar”.

## Validação
- Confirmar no navegador que uma cidade sem produtos usa apenas o estado vazio genérico.
- Confirmar que o convite aparece para visitante, fecha e permanece oculto após recarregar.
- Confirmar que “Criar conta” abre o separador certo e que uma sessão autenticada nunca mostra o convite.

## Detalhes técnicos
- Reutilizar `useAuth`, os botões existentes e os tokens visuais atuais.
- A leitura de `localStorage` e o atraso de exibição serão executados apenas no navegador, evitando diferenças no carregamento inicial.
