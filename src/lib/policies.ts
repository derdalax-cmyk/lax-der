import {
  FileText, ShieldCheck, ListChecks, CreditCard, RotateCcw, Store, User,
  Truck, Star, Ban, Scale, Copyright, Megaphone, UserX,
  type LucideIcon,
} from "lucide-react";

export type PolicySection = { heading?: string; paragraphs: string[] };

export type Policy = {
  slug: string;
  title: string;
  short: string;
  icon: LucideIcon;
  /** cor de fundo do quadrado do ícone */
  tint: string;
  /** cor do ícone */
  iconColor: string;
  sections: PolicySection[];
};

const GOLD = "bg-gold/15";
const INK = "bg-ink/10";
const GOLD_ICON = "text-gold";
const INK_ICON = "text-ink";

export const POLICIES: Policy[] = [
  {
    slug: "termos-condicoes",
    title: "Termos e Condições de Uso",
    short: "Regras gerais de utilização da plataforma",
    icon: FileText, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Natureza da plataforma", paragraphs: [
        "Este é o contrato entre o Utilizador (comprador, revendedor ou visitante) e a Derdalax. A Derdalax é um marketplace tecnológico que intermedia negócios de moda; não é fabricante nem vendedora direta.",
        "O contrato de compra e venda é sempre entre comprador e revendedor. A Derdalax exige capacidade jurídica plena para comprar e maioridade de 18 anos para vender.",
      ]},
      { heading: "Conta e dados", paragraphs: [
        "Os dados fornecidos devem ser verídicos. A conta é pessoal e intransferível — cada pessoa só pode ter uma conta de comprador e uma de vendedor.",
      ]},
      { heading: "Condutas proibidas", paragraphs: [
        "É proibido: publicar conteúdo falso, ofensivo ou que viole direitos de terceiros; usar documentos ou dados bancários de terceiros; tentar contornar a mensalidade direcionando vendas para fora da plataforma; usar bots ou scraping; sobrecarregar a infraestrutura; criar avaliações falsas.",
        "A Derdalax pode remover conteúdo, suspender ou banir contas a qualquer momento em caso de violação, e reter valores por até 3 dias em caso de suspeita de fraude para auditoria.",
      ]},
      { heading: "Limitações e alterações", paragraphs: [
        "O serviço é fornecido \"como está\", sem garantia de disponibilidade contínua. A Derdalax não responde por defeitos de produtos de revendedores independentes nem por falhas de gateways de pagamento de terceiros.",
        "Litígios são resolvidos preferencialmente por mediação da própria plataforma antes de via judicial. Os Termos podem ser alterados a qualquer momento, com efeito imediato após publicação.",
      ]},
    ],
  },
  {
    slug: "privacidade-dados",
    title: "Política de Privacidade e Dados",
    short: "Como recolhemos, protegemos e eliminamos os seus dados",
    icon: ShieldCheck, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Dados recolhidos", paragraphs: [
        "Recolhemos nome, email, telefone, senha, endereço de entrega e histórico de compras. De revendedores, adicionalmente: BI ou Passaporte, selfie de verificação e NIB/IBAN ou conta móvel.",
        "Dados automáticos: endereço IP, tipo de navegador e cookies.",
      ]},
      { heading: "Como usamos", paragraphs: [
        "Usamos os dados para processar compras, validar identidade de vendedores, processar pagamentos, dar suporte, prevenir fraude e melhorar a plataforma.",
        "A Derdalax nunca vende ou aluga dados. Partilhamos apenas com o revendedor (nome, telefone e morada do comprador da respectiva venda), com provedores de pagamento (m-Pesa, e-Mola) e por obrigação legal.",
      ]},
      { heading: "Segurança e cookies", paragraphs: [
        "Aplicamos encriptação e controlo de acesso restrito, especialmente a documentos e dados bancários. Os cookies dividem-se em essenciais, desempenho, preferências e marketing — geríveis pelo utilizador nas definições, com aviso de consentimento no primeiro acesso.",
      ]},
      { heading: "Retenção e direitos", paragraphs: [
        "Dados de conta ativa mantidos enquanto a conta existir; documentos de verificação de vendedores mantidos por período razoável após encerramento da loja para efeitos fiscais e antifraude; contas eliminadas a pedido são apagadas em até 30 dias, exceto obrigação legal ou disputa em aberto.",
        "O utilizador tem o direito de aceder, corrigir ou eliminar os seus dados a qualquer momento, com resposta da Derdalax em até 15 dias úteis, através das definições da conta ou do suporte.",
      ]},
    ],
  },
  {
    slug: "conduta-comunidade",
    title: "Uso Aceitável e Conduta da Comunidade",
    short: "Condutas permitidas, proibidas e proteção da comunidade",
    icon: ListChecks, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Princípios", paragraphs: [
        "Respeito mútuo, honestidade nas descrições e comunicações, e boa-fé em negociações e disputas.",
      ]},
      { heading: "O que é proibido", paragraphs: [
        "Discurso de ódio, discriminação, assédio, ameaças e spam; tentar levar negociações para fora da plataforma para evitar a mensalidade ou proteções contratuais; múltiplas contas para contornar suspensões; coordenar avaliações falsas.",
      ]},
      { heading: "Monitorização e denúncias", paragraphs: [
        "A Derdalax monitoriza sinais de fraude (contas duplicadas, padrões de cancelamento anómalos, avaliações em massa) e pode reter valores em disputa por até 3 dias para investigação, com direito de defesa do utilizador antes de qualquer decisão definitiva, salvo risco iminente.",
        "Qualquer pessoa pode denunciar produtos suspeitos, comportamento fraudulento ou conteúdo ofensivo pelo botão de denúncia ou suporte. Denúncias são analisadas em até 3 dias úteis, com confidencialidade do denunciante; denúncias de má-fé podem ser penalizadas.",
      ]},
      { heading: "Idade mínima", paragraphs: [
        "A plataforma é destinada a maiores de 18 anos — contas de menores não supervisionados podem ser suspensas e transações canceladas.",
      ]},
    ],
  },
  {
    slug: "pagamentos-mensalidade",
    title: "Pagamentos e Mensalidade",
    short: "Como pagar, receber e manter a loja ativa",
    icon: CreditCard, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Modelos de pagamento", paragraphs: [
        "(a) Pagamento antecipado à distância via m-Pesa, e-Mola ou transferência bancária, combinado e comprovado no chat antes do envio.",
        "(b) Pagamento na entrega, em dinheiro ou carteira móvel, feito pessoalmente ao vendedor ou estafeta no momento e local da entrega, após o comprador conferir o produto.",
        "O método é indicado no checkout ou combinado no chat.",
      ]},
      { heading: "Registo no chat", paragraphs: [
        "Recomenda-se sempre registar o acordo no chat da plataforma como prova em caso de disputa — negociações totalmente fora da plataforma (por exemplo, WhatsApp pessoal) têm proteção limitada. A Derdalax não guarda dados de cartão nem credenciais de carteira móvel.",
      ]},
      { heading: "Mensalidade do vendedor", paragraphs: [
        "Em vez de comissão por venda, a Derdalax cobra dos vendedores uma mensalidade fixa para manter a loja ativa e visível, comunicada no registo da loja.",
        "Falta de pagamento pode suspender a loja temporariamente (produtos ocultos, mas gestão de pedidos em curso continua acessível) até regularização, com aviso prévio antes da suspensão e reativação automática após pagamento.",
        "Mudanças no valor ou periodicidade da mensalidade são avisadas com 15 dias de antecedência.",
      ]},
    ],
  },
  {
    slug: "devolucao-garantia",
    title: "Devolução, Cancelamento e Garantia",
    short: "Prazos e regras para trocar, cancelar ou devolver",
    icon: RotateCcw, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Prazo e condições", paragraphs: [
        "Devolução permitida até 3 dias corridos após receção, por arrependimento ou por defeito/desconformidade (tamanho, cor ou modelo errado).",
        "O produto deve estar sem uso, com etiquetas e embalagem original. Roupa íntima não é aceite para devolução.",
      ]},
      { heading: "Processo", paragraphs: [
        "Abrir pedido no perfil ou pelo suporte com fotos ou vídeo. Análise de qualidade em até 3 dias úteis.",
        "Custos de frete de devolução: por conta da Derdalax ou do vendedor se o erro for deles (defeito, envio errado); por conta do comprador se for por arrependimento ou troca de tamanho por opção própria.",
      ]},
      { heading: "Reembolso e cancelamento", paragraphs: [
        "Reembolso autorizado após aprovação da análise, devolvido à carteira móvel ou conta bancária usada em até 3 dias, ou como crédito de loja válido por 12 meses, à escolha do comprador.",
        "Cancelamento gratuito enquanto o pedido estiver pendente ou em processamento e não despachado. Após o envio, aplica-se a política de devolução. O vendedor só pode cancelar por falta real de stock, com reembolso em até 3 dias.",
      ]},
    ],
  },
  {
    slug: "vendedor-kyc",
    title: "Acordo e Verificação do Vendedor (KYC)",
    short: "Requisitos, obrigações e verificação de identidade do vendedor",
    icon: Store, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Requisitos", paragraphs: [
        "Ser maior de 18 anos, verificação de identidade concluída, dados de contacto, stock e bancários atualizados, cumprimento da política de produtos proibidos.",
      ]},
      { heading: "Documentos e verificação", paragraphs: [
        "Exigidos BI ou Passaporte (frente e verso) e selfie segurando o documento — analisados em até 3 dias úteis, podendo ser aprovados, pedir esclarecimento adicional, ou recusados se ilegíveis, inconsistentes ou suspeitos.",
        "Documentos falsos resultam em banimento imediato e definitivo, com possível comunicação às autoridades.",
      ]},
      { heading: "Obrigações e proteção", paragraphs: [
        "Descrever produtos com precisão, manter stock atualizado, despachar dentro dos prazos, responder mensagens em até 24h idealmente, cumprir obrigações fiscais próprias. O vendedor atua como comerciante independente, sem vínculo empregatício com a Derdalax.",
        "O vendedor tem proteção contra compradores abusivos (uso e devolução, ameaças, comprovativos falsos) — pode denunciar e bloquear compradores problemáticos, e qualquer retenção de saldo para investigação tem prazo máximo de 3 dias com motivo comunicado.",
      ]},
    ],
  },
  {
    slug: "protecao-comprador",
    title: "Acordo e Proteção do Comprador",
    short: "Direitos, obrigações e garantias de quem compra",
    icon: User, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Como se forma o contrato", paragraphs: [
        "A confirmação do pedido é uma proposta de compra dirigida ao vendedor; o contrato forma-se quando o vendedor aceita ou processa o pedido.",
      ]},
      { heading: "Obrigações do comprador", paragraphs: [
        "Fornecer dados de entrega corretos, pagar pelos meios aceites, estar disponível para receber e tratar o vendedor com respeito.",
      ]},
      { heading: "Direitos e proteções", paragraphs: [
        "Receber o produto conforme anunciado, solicitar troca, devolução ou reembolso, acionar mediação em caso de conflito e ter os dados protegidos.",
        "Se o produto não chegar, chegar danificado ou for muito diferente do anunciado, o comprador pode acionar devolução, reembolso e mediação. Vendedores com problemas recorrentes podem ser reportados para análise de conta.",
      ]},
      { heading: "Limites da proteção", paragraphs: [
        "Não cobre compras combinadas e pagas inteiramente fora da plataforma sem registo, arrependimento fora do prazo, ou danos por uso normal do produto após entrega.",
      ]},
    ],
  },
  {
    slug: "envio-logistica",
    title: "Envio, Logística e Entrega",
    short: "Prazos, responsabilidades e extravios",
    icon: Truck, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Expedição híbrida", paragraphs: [
        "A Derdalax opera com expedição híbrida: produtos podem sair de stock central ou diretamente do vendedor. O responsável pelo empacotamento é quem despacha.",
      ]},
      { heading: "Prazos", paragraphs: [
        "Prazo de despacho: até 3 dias úteis após confirmação de pagamento (ou, no caso de pagamento na entrega, conforme combinado).",
        "Código de rastreio ou contacto do estafeta deve ser atualizado no pedido em até 3 dias após o envio. O prazo de entrega varia por província ou cidade, exibido no checkout.",
      ]},
      { heading: "Endereço, falhas e extravios", paragraphs: [
        "Alteração de endereço só é aceite até 3 dias antes da expedição prevista. Se a entrega falhar por dados errados ou ausência do destinatário, a mercadoria retorna após 3 dias, e o reenvio corre por conta do comprador se o erro for dele.",
        "Extravios comprovados são reembolsados integralmente ou substituídos sem custo, após auditoria interna de até 3 dias.",
      ]},
    ],
  },
  {
    slug: "avaliacoes-comentarios",
    title: "Avaliações e Comentários",
    short: "Regras para avaliar produtos e vendedores",
    icon: Star, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Quem pode avaliar", paragraphs: [
        "Só compradores com compra confirmada e entregue podem avaliar.",
      ]},
      { heading: "Conteúdo esperado", paragraphs: [
        "As avaliações devem tratar da experiência real: qualidade, fidelidade à descrição, prazo e atendimento. Fotos do produto recebido são incentivadas.",
      ]},
      { heading: "Proibido e resposta", paragraphs: [
        "Proibido: ofensas pessoais, dados de terceiros, discurso discriminatório, spam, autoavaliação (comprar de si mesmo), pedir ou pagar avaliações falsas, ou ameaçar o vendedor para remover avaliação negativa legítima.",
        "O vendedor pode responder publicamente uma vez a cada avaliação. Avaliações que violem esta política podem ser removidas mediante denúncia ou deteção automática.",
      ]},
    ],
  },
  {
    slug: "suspensao-banimento",
    title: "Conta Suspensa e Banimento",
    short: "Quando e como suspendemos ou banimos contas",
    icon: Ban, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Suspensão temporária", paragraphs: [
        "Aplicada quando há suspeita razoável (fraude em investigação, denúncia em análise, produto potencialmente proibido), com funcionalidades limitadas até conclusão da análise, prazo alvo de 3 dias.",
      ]},
      { heading: "Banimento definitivo", paragraphs: [
        "Para casos comprovados de produtos falsificados, fraude financeira, identidade falsa, reincidência ou assédio grave. O utilizador é sempre notificado do motivo, salvo impedimento legal, e pode contestar em até 3 dias úteis apresentando provas.",
      ]},
      { heading: "Consequências", paragraphs: [
        "Após banimento: perda de acesso à conta, pedidos em curso geridos pela política de disputas, e saldos de fraude comprovada podem ser retidos para ressarcir compradores lesados.",
      ]},
    ],
  },
  {
    slug: "disputas-responsabilidade",
    title: "Resolução de Disputas e Isenção de Responsabilidade",
    short: "Como mediamos conflitos e os limites da nossa responsabilidade",
    icon: Scale, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Papel da Derdalax", paragraphs: [
        "A Derdalax é apenas uma intermediária tecnológica — não fabrica, não possui nem inspeciona os produtos vendidos por revendedores independentes, e não responde por vícios, atrasos ou extravios da responsabilidade deles, nem por falhas de operadoras de pagamento de terceiros.",
      ]},
      { heading: "Mediação", paragraphs: [
        "Em disputa, qualquer parte pode acionar a plataforma, que atua como mediadora, com até 3 dias úteis para pedir esclarecimentos e reter valores em disputa. Se não houver acordo no prazo, os valores são liberados conforme as provas apresentadas, ficando as partes livres para vias judiciais, mantendo-se o histórico do chat como prova disponível.",
      ]},
      { heading: "Limites de responsabilidade", paragraphs: [
        "Danos indiretos, lucros cessantes ou perda de dados estão fora da responsabilidade da Derdalax, no limite máximo permitido por lei.",
      ]},
    ],
  },
  {
    slug: "produtos-proibidos",
    title: "Produtos Proibidos e Propriedade Intelectual",
    short: "O que não pode ser vendido e direitos autorais",
    icon: Copyright, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Anúncios proibidos", paragraphs: [
        "É proibido anunciar: réplicas ou contrafações de marcas registadas; produtos com logótipos sem comprovação de autenticidade; imagens protegidas por direitos de autor de terceiros sem licença; roupas de fardo sem normas sanitárias; uniformes militares ou policiais restritos por lei; produtos de origem não declarada; informação de composição falsa.",
      ]},
      { heading: "Notificação e contranotificação", paragraphs: [
        "Titulares de marca podem denunciar violações com provas. Anúncios denunciados podem ser removidos em até 3 dias, com direito do vendedor a contranotificar com provas de autenticidade em até 3 dias úteis — sem resposta, a remoção torna-se definitiva.",
      ]},
      { heading: "Sanções", paragraphs: [
        "Vendas comprovadas de produtos falsificados levam a retenção de saldo por 3 dias, suspensão imediata da loja por 3 dias para auditoria, podendo resultar em banimento definitivo em caso de reincidência.",
      ]},
    ],
  },
  {
    slug: "publicidade-atendimento",
    title: "Publicidade, Promoções e Atendimento",
    short: "Descontos, destaques e como falar connosco",
    icon: Megaphone, tint: GOLD, iconColor: GOLD_ICON,
    sections: [
      { heading: "Promoções", paragraphs: [
        "Promoções oficiais da Derdalax seguem regras divulgadas em cada campanha. Vendedores podem criar descontos nos próprios produtos, desde que o preço \"de\" reflita um valor real anteriormente praticado.",
        "Publicidade enganosa sobre características ou disponibilidade é proibida.",
      ]},
      { heading: "Comunicações", paragraphs: [
        "O utilizador pode desativar comunicações de marketing a qualquer momento, mantendo apenas notificações essenciais de pedidos.",
      ]},
      { heading: "Atendimento", paragraphs: [
        "Disponível pelo chat de suporte dentro da plataforma, com meta de primeira resposta em até 24h em dias úteis. Casos de segurança da conta e disputas financeiras têm prioridade.",
      ]},
    ],
  },
  {
    slug: "menores-idade",
    title: "Política para Menores de Idade",
    short: "Uso da plataforma por menores de 18 anos",
    icon: UserX, tint: INK, iconColor: INK_ICON,
    sections: [
      { heading: "Idade mínima", paragraphs: [
        "A Derdalax não se destina a menores de 18 anos — o registo, seja como comprador ou vendedor, exige maioridade legal.",
        "Contas identificadas como pertencentes a menores sem supervisão podem ser suspensas e as transações pendentes canceladas.",
      ]},
      { heading: "Responsabilidade de adultos", paragraphs: [
        "Se um menor usar a conta de um adulto responsável, esse adulto assume total responsabilidade pelas ações realizadas.",
      ]},
      { heading: "Produtos infantis", paragraphs: [
        "Esta política não impede a venda de roupas e acessórios infantis — aplica-se apenas à titularidade da conta.",
      ]},
    ],
  },
];
