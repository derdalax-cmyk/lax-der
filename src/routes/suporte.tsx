import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MessageCircle, Phone, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/suporte")({
  head: () => ({ meta: [
    { title: "Suporte · DERDALAX" },
    { name: "description", content: "Apoio ao cliente DERDALAX: perguntas frequentes, contactos por WhatsApp, telefone e email." },
  ]}),
  component: SuportePage,
});

const WHATSAPP = "258840000000";
const PHONE = "+258 84 000 0000";
const EMAIL = "apoio@derdalax.co.mz";

const FAQ = [
  { q: "Como faço uma encomenda?", a: "Adicione as peças ao carrinho, avance para o checkout, preencha os seus dados de entrega e conclua o pagamento por e-Mpesa ou e-Mola." },
  { q: "Quais são os métodos de pagamento?", a: "Aceitamos e-Mpesa e e-Mola. O pagamento é processado de forma segura no momento do checkout." },
  { q: "Quanto tempo demora a entrega?", a: "As entregas nas principais cidades de Moçambique demoram normalmente entre 2 a 5 dias úteis após a confirmação do pagamento." },
  { q: "O que são peças únicas?", a: "São peças exclusivas com apenas uma unidade disponível. Quando reservadas, ficam indisponíveis para outros clientes durante 15 minutos." },
  { q: "Posso trocar ou devolver?", a: "Sim. Contacte o nosso apoio até 7 dias após a receção para iniciar uma troca ou devolução." },
];

function SuportePage() {
  return (
    <div className="max-w-[900px] mx-auto px-5 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Suporte</h1>
        <p className="text-muted-foreground mt-2">Estamos aqui para ajudar.</p>
      </header>

      {/* Contactos */}
      <section className="grid sm:grid-cols-3 gap-4 mb-12">
        <a
          href={`https://wa.me/${WHATSAPP}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2 hover:border-gold transition-colors"
        >
          <MessageCircle className="w-6 h-6 text-success" />
          <span className="font-medium">WhatsApp</span>
          <span className="text-sm text-muted-foreground">{PHONE}</span>
        </a>
        <a
          href={`tel:${PHONE.replace(/\s/g, "")}`}
          className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2 hover:border-gold transition-colors"
        >
          <Phone className="w-6 h-6 text-ink" />
          <span className="font-medium">Telefone</span>
          <span className="text-sm text-muted-foreground">{PHONE}</span>
        </a>
        <a
          href={`mailto:${EMAIL}`}
          className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2 hover:border-gold transition-colors"
        >
          <Mail className="w-6 h-6 text-ink" />
          <span className="font-medium">Email</span>
          <span className="text-sm text-muted-foreground break-all">{EMAIL}</span>
        </a>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="font-display text-2xl mb-4">Perguntas frequentes</h2>
        <Accordion type="single" collapsible className="bg-card border border-border rounded-2xl px-4">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Localização */}
      <section>
        <h2 className="font-display text-2xl mb-4">Onde estamos</h2>
        <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-3">
          <MapPin className="w-6 h-6 text-gold shrink-0" />
          <div>
            <p className="font-medium">DERDALAX</p>
            <p className="text-sm text-muted-foreground">Maputo, Moçambique</p>
            <p className="text-sm text-muted-foreground mt-1">Horário: Seg–Sáb, 09h00–18h00</p>
          </div>
        </div>
      </section>
    </div>
  );
}
