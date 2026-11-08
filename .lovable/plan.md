# Comunicação, marca e catálogo estável

## Restrição confirmada de Email
O domínio de email está ativo e a fila existente está saudável. Email está bloqueado nas campanhas porque a infraestrutura disponível permite apenas emails esperados por uma ação/evento específico do destinatário, não promoções, listas ou recuperação em massa. Consentimento e limites de 50–100 não mudam essa restrição.

Não ativar campanhas nem testes promocionais nessa fila; preservar emails de conta/pedidos. Email-only e Push+Email ficam dependentes de um serviço dedicado de marketing escolhido e ligado. Não criar um fornecedor paralelo sem essa decisão. A recuperação de perfis por lista também não será reclassificada como aviso individual.

## Comunicação que pode avançar já
- Limite Push selecionável de 50, 75 ou 100 destinatários por campanha; default 50, validado no servidor e na seleção da fila.
- Seleção determinística de destinatários elegíveis, mantendo segmentos/filtros, consentimento e subscrições válidas; unicidade campanha + destinatário + canal.
- Mostrar elegíveis totais, disponibilidade por canal, limite e quantidade máxima a enfileirar; confirmação explícita e histórico com limite, enfileirados, enviados, falhados e ignorados.
- Preservar step-up e auditoria sem acrescentar dados pessoais/corpos sensíveis aos logs. Teste Push apenas para o administrador, com feedback de falta de subscrição/opt-out.
- Rever claim/retries e estados de entrega para reduzir reenvios. Push não tem confirmação transacional com a fila: não prometer entrega exatamente uma vez após uma falha ambígua; privilegiar não repetir envios potencialmente aceites.

## Marca visível
Trocar apresentações textuais por `Derdalax` na navegação, páginas, diálogos, notificações, emails existentes, instalação e metadados. Manter imagens da marca e todos os identificadores técnicos, domínios, URLs, slugs, nomes de ficheiros, variáveis e objetos da base de dados.

## Catálogo sem tremulação
- Manter dados visíveis durante revalidação, sem skeleton para resultados já em cache.
- Separar a continuidade das páginas servidor da apresentação estável por IDs: conservar itens existentes e adiar novos itens que deslocariam quem está a navegar; permitir atualização completa ao reabrir/voltar ao topo.
- Preservar cursores, batches, persistência pública e `ListContextRestorer`; renovar só depois da restauração.
- Reusar dimensões e posicionamento masonry; evitar reinstalar medições e ocultar imagens já carregadas em cada refetch.
- Aplicar às listas Explorar, Categorias, Loja e faixas Home, sem modificar checkout, preços, descontos, pagamentos ou segurança admin.

## Detalhes técnicos e validação
- Migração aditiva através da ferramenta existente para limites/contadores e atualização das funções de audiência/fila, sem permissões públicas novas.
- Reutilizar funções de campanha, worker e componentes existentes; nenhum envio real a uma audiência durante testes.
- Testar limites 50/75/100, default, seleção determinística, unicidade, opt-out, ausência de subscrição e comportamento de retries; testar entradas malformadas no servidor.
- Verificar marca visível sem renomear identificadores, compilação automática e testes focados.
- No navegador, verificar revalidação com cache, ausência de skeleton/tremulação e scroll/âncora ao abrir produto e voltar; distinguir testes reais de testes isolados e verificações que dependam de acesso admin.
- Relatório final: causa do Email indisponível, limites, ficheiros, proteções, branding e resultados observados; testes Email ficam bloqueados até existir serviço de campanhas autorizado.
