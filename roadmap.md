# Roadmap

- [x] Limitar campanhas Push a 50/75/100, rever elegibilidade, fila, testes e histórico (sem envio real; Admin mantém verificação).
- [x] Atualizar marca textual visível para Derdalax sem renomear identificadores.
- [x] Estabilizar revalidação do catálogo e verificar scroll, imagens e retorno (Explorar/Categorias validados; Home sem destaques, Loja sem dados visíveis nesta sessão).
- [ ] Ativar campanhas Email e validar email-only/dual-channel: bloqueado pela ausência de serviço dedicado de marketing.

- [x] Persistir apenas catálogo público com TTL, limites e recuperação segura de quota.
- [x] Migrar cache offline para worker gerado, preservar push e excluir dados privados.
- [x] Validar reabertura, retorno, revalidação, segurança e falhas de armazenamento (offline em origem isolada; publicação/aparelho real não testados).

- [x] Restaurar seleção lateral e produtos em Categorias; mover Ver tudo para o fim da faixa e compactar espaços Home (testes visuais com dados isolados; dados reais indisponíveis).

- [x] Compactar popup Roleta, melhorar interação dos banners, espaços Home e navegação mobile; atualizar fontes.
- [x] Limitar coleções Home a 20 e ligar categorias correspondentes ao Explorar.
- [x] Garantir categorias de moda sem remover referências ou produtos existentes.
- [x] Testar pacote visual em mobile/desktop, interações e regressões.

- [x] Estabilizar proporções persistentes, premedição limitada e masonry partilhado.
- [x] Pausar sentinel na restauração; alinhar âncora após layout estável com uma única correção.
- [x] Validar cache, prefetch, cold/warm load e retornos repetidos; documentar limites.

- [x] Adaptar grelhas de produtos a masonry sem mudar filtros, ordem ou carregamento.
- [x] Respeitar proporções naturais nos cards e galeria, sem cortar a peça.
- [x] Validar proporções e grelhas desktop/mobile; documentar ficheiros e revisão.

- [x] Preservar contexto/ordem/scroll das listas e corrigir preços em cards mobile.
- [x] Recomendações reais e partilha/metadata por produto; validar navegação e testes.
- [x] Ampliar recomendações do produto: até 30 da mesma categoria e até 50 do vendedor, sem login.

- [x] Remover paginação de produtos e validar carregamento automático/filtros/duplicados.
- [x] Reforçar prompt e pós-validação IA sem alterar autorização ou modelo.
- [x] Ajustar cidade/WhatsApp no cadastro e destino normal do login Admin.
- [x] Executar testes focados e verificar páginas desktop/mobile e erros.

- [x] Fechar INSERT direto de pedidos; RPC mantém execução autenticada e validação confirmada.
- [x] Remover identificação da reserva das respostas públicas e validar loja/carrinho/Admin.
- [x] Documentar testes finais e dependência Zod pendente sem upgrade major em SECURITY-CLOSURE.md.
- [ ] Validar criação completa de pedido e leitura pela UI: sem ligação transacional privilegiada; pedido real notificaria vendedor.

- [x] Permitir editar o título principal por banner no Admin e validar a apresentação na página inicial.

- [x] Adicionar selo DERDALAX opcional, arrastável e redimensionável no editor partilhado.
- [x] Validar composição guardada, rotação/recorte e interação mobile sem guardar dados de teste.

- [ ] Remover mensagens e ações de cidade sem produtos na página inicial e no Explorar.
- [ ] Limitar o aviso de cidade a visitantes que ainda não escolheram uma cidade.
- [ ] Adicionar convite de criação de conta na página inicial, com adiamento de 24 horas após fechar.
- [ ] Abrir o formulário de cadastro por `/login?mode=signup`.
- [ ] Validar os comportamentos para visitante e utilizador autenticado.
- [x] Notificações TWA: "Ativar" pede sempre a permissão do sistema diretamente.
- [x] Adicionar preço original opcional por produto e apresentar desconto válido no formulário, cartões e detalhe.
- [x] Roleta DERDALAX (campanhas, códigos, indicações, sorteio no servidor, desconto por produto participante, admin).
- [x] Auditoria de segurança: checkout server-side (create_order_secure), finalização idempotente, proteção de aprovação de produtos, cooldown da Roleta, headers de segurança, SW sem cache privado, logout com limpeza, auditoria de ações admin, whitelist de imagens no storage.
