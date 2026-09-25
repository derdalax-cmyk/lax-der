import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

const TITLE = "Política de Privacidade | DERDALAX";
const DESC = "Conheça como o DERDALAX recolhe, utiliza, protege e gere os dados dos seus utilizadores.";

export const Route = createFileRoute("/politica-privacidade")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://derdalax.co.mz/politica-privacidade" }],
  }),
  component: PrivacyPolicyPage,
});

type Section = { id: string; title: string; paragraphs: string[]; list?: string[] };

const SECTIONS: Section[] = [
  {
    id: "politica",
    title: "Política de Privacidade",
    paragraphs: [
      "Esta Política de Privacidade explica como o DERDALAX recolhe, utiliza, armazena, protege e partilha as informações dos utilizadores da plataforma disponível em derdalax.co.mz e da respetiva aplicação instalável.",
      "Ao criar uma conta ou utilizar o DERDALAX, o utilizador reconhece ter lido esta política.",
    ],
  },
  {
    id: "sobre",
    title: "Sobre o DERDALAX",
    paragraphs: [
      "O DERDALAX é uma plataforma de comércio de moda em Moçambique que liga compradores a lojas e vendedores independentes. Os vendedores publicam peças, os compradores fazem pedidos e a entrega é combinada dentro da plataforma.",
    ],
  },
  {
    id: "recolhemos",
    title: "Informações que recolhemos",
    paragraphs: ["Recolhemos apenas as informações necessárias para o funcionamento da plataforma, agrupadas em:"],
    list: [
      "Dados de conta e perfil fornecidos pelo utilizador;",
      "Dados básicos de identificação recebidos do Google, quando escolhe entrar com Google;",
      "Dados de pedidos, mensagens e pedidos de suporte gerados durante a utilização;",
      "Dados técnicos mínimos, como a sessão de autenticação, preferências guardadas no dispositivo e o estado de ligação (online) na plataforma.",
    ],
  },
  {
    id: "fornecidas",
    title: "Informações fornecidas pelo utilizador",
    paragraphs: ["Durante o registo e a utilização, o utilizador pode fornecer:"],
    list: [
      "Nome, email, número de telefone e fotografia de perfil;",
      "Cidade e endereço de entrega;",
      "Conteúdo de mensagens trocadas com vendedores ou com o suporte;",
      "Avaliações e denúncias;",
      "No caso de vendedores: dados da loja, fotografias e descrições de produtos, preços, e os documentos e informações de pagamento pedidos no processo de candidatura a vendedor.",
    ],
  },
  {
    id: "google",
    title: "Informações obtidas através do Google",
    paragraphs: [
      "O DERDALAX utiliza o Google apenas como método de autenticação (\"Entrar com Google\"). Não solicitamos permissões adicionais além da autenticação básica.",
      "Com a autorização apresentada pelo Google no momento do início de sessão, recebemos apenas: o seu endereço de email, o seu nome e, quando disponível, a fotografia de perfil associada à conta Google, bem como um identificador da conta necessário para a autenticação.",
      "O DERDALAX não acede ao Gmail, Google Drive, contactos, calendário nem a quaisquer outros dados ou serviços da sua conta Google.",
    ],
  },
  {
    id: "utilizacao",
    title: "Como utilizamos as informações",
    paragraphs: ["As informações são utilizadas para:"],
    list: [
      "Criar e gerir a sua conta e manter a sessão iniciada;",
      "Processar pedidos, calcular valores e permitir a entrega;",
      "Permitir a comunicação entre comprador, vendedor e suporte;",
      "Mostrar produtos disponíveis na sua cidade;",
      "Verificar vendedores e prevenir fraude ou abuso;",
      "Enviar notificações e emails relacionados com a conta e os pedidos;",
      "Melhorar e garantir a segurança da plataforma.",
    ],
  },
  {
    id: "auth-google",
    title: "Autenticação com Google",
    paragraphs: [
      "Ao escolher \"Entrar com Google\", é redirecionado para o Google para confirmar a sua identidade. Após a confirmação, o email e o nome recebidos são usados para criar ou identificar a sua conta DERDALAX e preencher o seu perfil. A fotografia, quando fornecida, pode ser usada como imagem de perfil.",
      "Estes dados não são vendidos, não são usados para publicidade e não são partilhados com terceiros para fins próprios. Pode deixar de usar o Google a qualquer momento e revogar o acesso nas definições da sua conta Google.",
    ],
  },
  {
    id: "compras",
    title: "Compras, pedidos e vendedores",
    paragraphs: [
      "Quando faz um pedido, o vendedor responsável recebe as informações necessárias para o concluir: o seu nome, contacto, cidade/endereço de entrega, os produtos pedidos e a forma de pagamento escolhida.",
      "Os vendedores só podem usar estes dados para processar e entregar o pedido. Os colaboradores autorizados de uma loja acedem apenas às funções que lhes foram atribuídas, e as suas ações sobre produtos ficam registadas para auditoria.",
    ],
  },
  {
    id: "comunicacoes",
    title: "Comunicações e suporte",
    paragraphs: [
      "As mensagens trocadas nos chats de pedidos e com o suporte são guardadas para permitir o acompanhamento das conversas, a resolução de problemas e a análise de denúncias pela equipa do DERDALAX.",
    ],
  },
  {
    id: "notificacoes",
    title: "Notificações",
    paragraphs: [
      "Com a sua autorização, o DERDALAX pode enviar notificações no dispositivo (push) sobre pedidos, mensagens e novidades. Para isso guardamos a subscrição técnica do seu navegador. Também podem ser enviados emails de conta (confirmação, recuperação de senha, eliminação de conta).",
      "Pode desativar as notificações nas preferências do perfil ou nas definições do navegador.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies e armazenamento local",
    paragraphs: [
      "Utilizamos o armazenamento local do navegador e cookies essenciais para manter a sessão iniciada, guardar o carrinho, a cidade escolhida e preferências da aplicação. A aplicação instalável usa um service worker para funcionar de forma mais rápida e receber notificações.",
      "Não utilizamos cookies de publicidade de terceiros.",
    ],
  },
  {
    id: "fornecedores",
    title: "Serviços e fornecedores utilizados",
    paragraphs: ["Para funcionar, o DERDALAX recorre a fornecedores de confiança que tratam dados apenas em nosso nome:"],
    list: [
      "Alojamento, base de dados, autenticação e armazenamento de ficheiros na infraestrutura cloud da plataforma;",
      "Google, para o início de sessão com Google;",
      "Serviços de envio de email e de notificações push;",
      "Um serviço de inteligência artificial usado para analisar as fotografias de produtos enviadas pelos vendedores e sugerir nome e descrição.",
    ],
  },
  {
    id: "armazenamento",
    title: "Como armazenamos e protegemos os dados",
    paragraphs: [
      "Os dados são guardados em servidores seguros com ligação encriptada (HTTPS). O acesso é controlado por regras que garantem que cada utilizador só vê os seus próprios dados, e que vendedores e administradores só acedem ao necessário para as suas funções. Documentos sensíveis de vendedores ficam em armazenamento privado.",
    ],
  },
  {
    id: "partilha",
    title: "Quando podemos partilhar informações",
    paragraphs: ["Não vendemos os seus dados. Apenas partilhamos informações:"],
    list: [
      "Com o vendedor envolvido no seu pedido, na medida necessária;",
      "Com os fornecedores de serviços indicados acima;",
      "Quando exigido por lei ou por autoridade competente;",
      "Para proteger os direitos, a segurança e a integridade do DERDALAX e dos seus utilizadores.",
    ],
  },
  {
    id: "retencao",
    title: "Retenção dos dados",
    paragraphs: [
      "Mantemos os dados enquanto a conta estiver ativa. Após a eliminação da conta, os dados pessoais são removidos, podendo ser conservados apenas os registos de pedidos e transações exigidos por obrigações legais, contabilísticas ou de prevenção de fraude.",
    ],
  },
  {
    id: "direitos",
    title: "Direitos do utilizador",
    paragraphs: ["O utilizador pode, a qualquer momento:"],
    list: [
      "Consultar e corrigir os dados do seu perfil;",
      "Desativar notificações;",
      "Pedir informações sobre os dados tratados;",
      "Pedir a eliminação da conta e dos dados.",
    ],
  },
  {
    id: "eliminacao",
    title: "Eliminação da conta e dos dados",
    paragraphs: [
      "A eliminação pode ser pedida diretamente em Perfil → Excluir conta, com confirmação por email. Também pode pedir a eliminação escrevendo para suporte@derdalax.co.mz. Após confirmação, a conta e os dados pessoais associados são eliminados, exceto os que a lei obrigue a conservar.",
    ],
  },
  {
    id: "seguranca",
    title: "Segurança",
    paragraphs: [
      "Adotamos medidas técnicas e organizativas para proteger os dados contra acesso não autorizado, perda ou alteração. Nenhum sistema é totalmente infalível; recomendamos que mantenha a sua senha segura e não a partilhe.",
    ],
  },
  {
    id: "alteracoes",
    title: "Alterações desta política",
    paragraphs: [
      "Esta política pode ser atualizada. Alterações relevantes serão comunicadas na plataforma, e a data da última atualização é sempre indicada no final desta página.",
    ],
  },
  {
    id: "contacto",
    title: "Contacto",
    paragraphs: ["Para questões sobre privacidade ou sobre os seus dados, contacte: suporte@derdalax.co.mz"],
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink text-white">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-gold transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" /> Voltar ao DERDALAX
          </Link>
          <p className="font-display text-2xl tracking-[0.2em] text-gold">DERDALAX</p>
          <h1 className="font-display text-3xl md:text-5xl mt-4 leading-tight">POLÍTICA DE PRIVACIDADE</h1>
          <p className="mt-3 text-white/70">Como o DERDALAX recolhe, utiliza, protege e gere os seus dados.</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-10">
        <nav aria-label="Índice" className="rounded-xl border border-border p-5 mb-10">
          <h2 className="font-semibold text-foreground mb-3">Índice</h2>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm list-decimal list-inside text-muted-foreground">
            {SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="hover:text-gold">{s.title}</a></li>
            ))}
          </ol>
        </nav>

        <article className="space-y-10">
          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-20">
              <h2 className="font-display text-xl md:text-2xl text-foreground mb-3">
                <span className="text-gold mr-2">{i + 1}.</span>{s.title}
              </h2>
              <div className="space-y-3">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-[15px] leading-relaxed text-muted-foreground">{p}</p>
                ))}
                {s.list && (
                  <ul className="list-disc pl-5 space-y-1.5 text-[15px] leading-relaxed text-muted-foreground">
                    {s.list.map((li, k) => <li key={k}>{li}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </article>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground">Última atualização: 25 de setembro de 2026</p>
          <Link to="/" className="text-sm text-gold underline underline-offset-2">Voltar ao DERDALAX</Link>
        </div>
      </main>
    </div>
  );
}
