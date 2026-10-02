import { createFileRoute, Link } from "@tanstack/react-router";
import { SmartImage } from "@/components/SmartImage";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { WHATSAPP_NUMBER, whatsappLink, INSTAGRAM_URL } from "@/lib/contact";
import { MapPin, Clock, Truck, CheckCircle2, Phone } from "lucide-react";

const SITE_URL = "https://3dcreate.com.br";

const title = "Impressão 3D em Goiânia | Serviço Local · 3D Create";
const description =
  "Serviço de impressão 3D em Goiânia e região: peças personalizadas, protótipos, decoração e modelagem. Atendimento local, orçamento rápido e entrega em Goiânia.";

const faqItems = [
  {
    q: "Vocês fazem impressão 3D em Goiânia?",
    a: "Sim. A 3D Create é um estúdio de impressão 3D sediado em Goiânia, GO. Atendemos pessoas físicas, empresas, makers e projetos acadêmicos em toda a Região Metropolitana.",
  },
  {
    q: "Quanto tempo demora para imprimir uma peça em 3D em Goiânia?",
    a: "O prazo varia com o tamanho, complexidade e material. Peças simples costumam ficar prontas em 24 a 72 horas. Protótipos e projetos urgentes podem ser priorizados — consulte nosso WhatsApp.",
  },
  {
    q: "Quais materiais vocês usam na impressão 3D?",
    a: "Trabalhamos com PLA, ABS, PETG e TPU. A escolha do material depende do uso: PLA para decoração e prototipagem, PETG para resistência, ABS para alta temperatura e TPU para flexibilidade.",
  },
  {
    q: "É possível fazer a entrega das peças impressas em Goiânia?",
    a: "Sim. Fazemos entrega em Goiânia e região metropolitana. Também disponibilizamos retirada no local e envio via transportadora para outras cidades.",
  },
  {
    q: "Como solicitar um orçamento de impressão 3D?",
    a: "É só enviar uma mensagem pelo WhatsApp com a descrição do projeto, fotos ou arquivo 3D (STL, OBJ, STEP). Respondemos com o valor e prazo em poucos minutos.",
  },
  {
    q: "Vocês modelam a peça antes de imprimir?",
    a: "Oferecemos modelagem 3D sob medida para quem ainda não tem o arquivo. Desenvolvemos o modelo digital, ajustamos para impressão e enviamos a peça pronta.",
  },
];

const services = [
  {
    name: "Peças personalizadas",
    description:
      "Objetos únicos feitos sob medida: brindes, presentes, acessórios, peças de reposição e tudo que sua imaginação projetar.",
    image: "/images/card-personalizados",
  },
  {
    name: "Protótipos rápidos",
    description:
      "Valide ideias e produtos em poucos dias. Impressão 3D de protótipos funcionais para testes, pitches e desenvolvimento de produto.",
    image: "/images/card-prototipos",
  },
  {
    name: "Decoração e arte",
    description:
      "Luminárias, vasos, esculturas e objetos de design impressos em 3D com acabamento de estúdio para ambientes únicos.",
    image: "/images/card-decoracao",
  },
];

const areas = [
  "Setor Marista",
  "Setor Bueno",
  "Jardim Goiás",
  "Setor Oeste",
  "Setor Sul",
  "Centro",
  "Aparecida de Goiânia",
  "Anápolis",
  "Trindade",
  "Senador Canedo",
  "Região Metropolitana de Goiânia",
];

export const Route = createFileRoute("/impressao-3d-goiania")({
  head: () => {
    const image = `${SITE_URL}/images/hero-render.png`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE_URL}/impressao-3d-goiania` },
        { property: "og:image", content: image },
        { property: "og:image:secure_url", content: image },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:alt", content: "Impressão 3D em Goiânia — 3D Create" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
        { name: "geo.region", content: "BR-GO" },
        { name: "geo.placename", content: "Goiânia" },
        { name: "geo.position", content: "-16.6869;-49.2648" },
        { name: "ICBM", content: "-16.6869, -49.2648" },
      ],
      links: [
        { rel: "canonical", href: `${SITE_URL}/impressao-3d-goiania` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": `${SITE_URL}/#business`,
            name: "3D Create",
            description,
            url: `${SITE_URL}/impressao-3d-goiania`,
            image: `${SITE_URL}/images/hero-render.png`,
            logo: `${SITE_URL}/__l5e/assets-v1/c9da81f2-78ac-4250-9e12-47dd648bbcbe/logo-branca.png`,
            telephone: `+${WHATSAPP_NUMBER}`,
            email: "contato@3dcreate.com.br",
            sameAs: [INSTAGRAM_URL],
            priceRange: "$$",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Goiânia",
              addressRegion: "GO",
              addressCountry: "BR",
            },
            geo: { "@type": "GeoCoordinates", latitude: -16.6869, longitude: -49.2648 },
            areaServed: [
              { "@type": "City", name: "Goiânia" },
              { "@type": "City", name: "Aparecida de Goiânia" },
              { "@type": "City", name: "Anápolis" },
              { "@type": "City", name: "Trindade" },
              { "@type": "City", name: "Senador Canedo" },
              { "@type": "State", name: "Goiás" },
            ],
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "Serviços de impressão 3D em Goiânia",
              itemListElement: services.map((s) => ({
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: s.name,
                  description: s.description,
                  areaServed: "Goiânia, GO",
                },
              })),
            },
            openingHoursSpecification: {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              opens: "09:00",
              closes: "18:00",
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqItems.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: `${SITE_URL}/`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Impressão 3D em Goiânia",
                item: `${SITE_URL}/impressao-3d-goiania`,
              },
            ],
          }),
        },
      ],
    };
  },
  component: Impressao3DGoiania,
});

const ease = [0.16, 1, 0.3, 1] as const;

function Impressao3DGoiania() {
  return (
    <main className="overflow-x-hidden">
      <HeroSection />
      <ServicesSection />
      <AreasSection />
      <ProcessSection />
      <FaqSection />
      <CtaSection />
      <SiteFooter />
      <WhatsAppFab />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[70svh] flex-col justify-center overflow-hidden bg-ink">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 110%, oklch(0.42 0.22 300 / 0.75) 0%, oklch(0.30 0.20 275 / 0.6) 35%, transparent 70%), radial-gradient(80% 60% at 20% 0%, oklch(0.40 0.20 265 / 0.45) 0%, transparent 60%)",
        }}
      />
      <header className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-5 sm:gap-4 sm:px-6 sm:py-6">
        <Link to="/" className="flex items-center gap-3">
          <Logo className="h-7 sm:h-8" />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-white/60">
          <Link to="/" className="hidden transition-colors hover:text-white sm:block">
            Início
          </Link>
          <a
            href={whatsappLink("Olá! Quero um orçamento de impressão 3D em Goiânia.")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition-colors hover:border-white/50"
          >
            Orçamento
          </a>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 py-20 text-center">
        <motion.p
          className="text-xs uppercase tracking-[0.35em] text-white/65"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease }}
        >
          Serviço local · Goiânia, GO
        </motion.p>

        <motion.h1
          className="mt-6 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-bold leading-[0.95] text-white"
          initial={{ opacity: 0, y: 34, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.6, delay: 0.5, ease }}
        >
          Impressão 3D em Goiânia
          <br />
          <span className="brand-text">do arquivo digital à peça pronta.</span>
        </motion.h1>

        <motion.p
          className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 1.0, ease }}
        >
          Peças personalizadas, protótipos e decoração impressos em 3D com atendimento em Goiânia e
          região metropolitana. Orçamento rápido, entrega local e acabamento profissional.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col gap-4 sm:flex-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 1.4, ease }}
        >
          <a
            href={whatsappLink("Olá! Quero um orçamento de impressão 3D em Goiânia.")}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full border border-white/25 px-8 text-base font-medium text-white transition-all duration-700 hover:border-transparent hover:shadow-[0_0_50px_-6px_oklch(0.686_0.194_318.3/0.85)]"
          >
            <span className="brand-gradient absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
            Solicitar orçamento em Goiânia
          </a>
          <Link
            to="/"
            hash="portfolio"
            className="inline-flex h-14 items-center justify-center rounded-full border border-white/15 px-8 text-base font-medium text-white/70 transition-all duration-700 hover:border-white/40 hover:bg-white/5 hover:text-white"
          >
            Ver portfólio
          </Link>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
}

function ServicesSection() {
  return (
    <section className="bg-background px-6 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Serviços de impressão 3D em Goiânia
          </h2>
          <p className="mt-4 text-muted-foreground">
            Produzimos peças com impressoras 3D de precisão, entregando acabamento profissional para
            projetos de todos os tamanhos.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: i * 0.15, ease }}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <SmartImage
                  base={service.image}
                  alt={service.name}
                  width={1024}
                  height={768}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-xl font-semibold">{service.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AreasSection() {
  return (
    <section className="bg-muted/30 px-6 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Áreas atendidas
            </h2>
            <p className="mt-4 text-muted-foreground">
              Atendemos Goiânia e cidades vizinhas com opções de entrega, retirada ou envio. Seja qual
              for o seu bairro, envie o projeto e combinamos a melhor forma de receber a peça.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {areas.map((area) => (
                <li key={area} className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" /> {area}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<Clock className="h-6 w-6 text-primary" />}
              title="Prazo ágil"
              text="Peças simples em 24–72h. Projetos urgentes com priorização sob consulta."
            />
            <InfoCard
              icon={<Truck className="h-6 w-6 text-primary" />}
              title="Entrega local"
              text="Entregamos em Goiânia e região metropolitana. Também enviamos para todo o Brasil."
            />
            <InfoCard
              icon={<CheckCircle2 className="h-6 w-6 text-primary" />}
              title="Acabamento profissional"
              text="Remoção de suportes, lixamento leve e tratamento de superfície quando necessário."
            />
            <InfoCard
              icon={<Phone className="h-6 w-6 text-primary" />}
              title="Atendimento direto"
              text="Orçamento via WhatsApp com resposta rápida e acompanhamento do pedido."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="font-display font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ProcessSection() {
  const steps = [
    { n: "01", title: "Envie o projeto", text: "Mande a ideia, foto, desenho ou arquivo 3D pelo WhatsApp." },
    { n: "02", title: "Orçamento rápido", text: "Analisamos o modelo, material ideal e prazo. Você aprova." },
    { n: "03", title: "Impressão 3D", text: "Imprimimos em Goiânia com acompanhamento e controle de qualidade." },
    { n: "04", title: "Entrega pronta", text: "Receba a peça finalizada com acabamento profissional." },
  ];

  return (
    <section className="bg-background px-6 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Como funciona o serviço local
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: i * 0.15, ease }}
              className="relative"
            >
              <span className="font-display text-5xl font-bold text-primary/20">{step.n}</span>
              <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="bg-muted/30 px-6 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Perguntas frequentes sobre impressão 3D em Goiânia
        </h2>
        <dl className="mt-12 space-y-6">
          {faqItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.7, delay: i * 0.1, ease }}
              className="rounded-xl border border-border bg-card p-6"
            >
              <dt className="font-display text-lg font-semibold">{item.q}</dt>
              <dd className="mt-2 text-muted-foreground">{item.a}</dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="relative isolate bg-ink px-6 py-24 sm:px-8 lg:px-12">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 100%, oklch(0.42 0.22 300 / 0.5) 0%, transparent 60%)",
        }}
      />
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Pronto para imprimir sua ideia em Goiânia?
        </h2>
        <p className="mt-4 text-lg text-white/60">
          Solicite um orçamento gratuito pelo WhatsApp. Respondemos em minutos.
        </p>
        <a
          href={whatsappLink("Olá! Quero um orçamento de impressão 3D em Goiânia.")}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative mx-auto mt-10 inline-flex h-14 items-center justify-center overflow-hidden rounded-full border border-white/25 px-8 text-base font-medium text-white transition-all duration-700 hover:border-transparent hover:shadow-[0_0_50px_-6px_oklch(0.686_0.194_318.3/0.85)]"
        >
          <span className="brand-gradient absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
          Solicitar orçamento pelo WhatsApp
        </a>
      </div>
    </section>
  );
}
