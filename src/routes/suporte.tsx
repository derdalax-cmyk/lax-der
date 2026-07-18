import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MessageCircle, Phone, Mail } from "lucide-react";
import { FloatingSupportChat } from "@/components/FloatingSupportChat";

export const Route = createFileRoute("/suporte")({
  head: () => ({ meta: [
    { title: "Suporte · DERDALAX" },
    { name: "description", content: "Apoio ao cliente DERDALAX: chat direto com a equipa, perguntas frequentes e contactos." },
  ]}),
  component: SuportePage,
});

const WHATSAPP = "258840000000";
const PHONE = "+258 84 000 0000";
const EMAIL = "apoio@derdalax.co.mz";

const FAQ = [
  { q: "Como faço uma encomenda?", a: "Adicione as peças ao carrinho, avance para o checkout, preencha os seus dados de entrega e conclua o pedido. O vendedor entrará em contacto pelo chat para combinar pagamento e envio." },
  { q: "Quais são os métodos de pagamento?", a: "Os métodos são combinados diretamente com cada vendedor via chat do pedido (normalmente e-Mpesa, e-Mola ou transferência)." },
  { q: "Quanto tempo demora a entrega?", a: "Depende do vendedor e da cidade. As entregas nas principais cidades demoram normalmente entre 2 a 5 dias úteis após confirmação." },
  { q: "O que são peças únicas?", a: "São peças exclusivas com apenas uma unidade disponível. Quando reservadas, ficam indisponíveis para outros clientes durante 15 minutos." },
  { q: "Posso trocar ou devolver?", a: "Sim. Contacte-nos até 7 dias após a receção para iniciar uma troca ou devolução." },
];

function SuportePage() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl">Suporte</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Fale diretamente connosco ou explore as perguntas frequentes.</p>
      </header>

      <div className="grid gap-6">
        <aside className="space-y-6">

          <div className="grid grid-cols-1 gap-3">
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer"
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-gold transition-colors">
              <MessageCircle className="w-5 h-5 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground truncate">{PHONE}</p>
              </div>
            </a>
            <a href={`tel:${PHONE.replace(/\s/g, "")}`}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-gold transition-colors">
              <Phone className="w-5 h-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-xs text-muted-foreground truncate">{PHONE}</p>
              </div>
            </a>
            <a href={`mailto:${EMAIL}`}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-gold transition-colors">
              <Mail className="w-5 h-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground truncate">{EMAIL}</p>
              </div>
            </a>
          </div>

          <div>
            <h2 className="font-display text-lg mb-3">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="bg-card border border-border rounded-2xl px-3">
              {FAQ.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </aside>
      </div>
    </div>
  );
}
