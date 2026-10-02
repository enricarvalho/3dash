import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { Hero } from "@/components/sections/Hero";
import { Services } from "@/components/sections/Services";
import { Process } from "@/components/sections/Process";
import { Why } from "@/components/sections/Why";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { WhatsAppFab } from "@/components/WhatsAppFab";

// abaixo da dobra: carregados sob demanda para aliviar o bundle inicial
const Portfolio = lazy(() =>
  import("@/components/sections/Portfolio").then((m) => ({ default: m.Portfolio })),
);
const Faq = lazy(() => import("@/components/sections/Faq").then((m) => ({ default: m.Faq })));
const QuoteForm = lazy(() =>
  import("@/components/sections/QuoteForm").then((m) => ({ default: m.QuoteForm })),
);
import logoBranca from "@/assets/logo-branca.png.asset.json";
import { getRequestOrigin } from "@/lib/origin.functions";

import { INSTAGRAM_URL, WHATSAPP_NUMBER } from "@/lib/contact";
import { FAQ_ITEMS } from "@/lib/faq";

const SITE_URL = "https://3dcreate.com.br";

const title = "Impressão 3D em Goiânia | 3D Create";
const description =
  "Impressão 3D em Goiânia: peças personalizadas, protótipos e itens de decoração com acabamento profissional. Orçamento rápido pelo WhatsApp.";

export const Route = createFileRoute("/")({
  loader: async () => ({ origin: await getRequestOrigin() }),
  head: ({ loaderData }) => {
    const image = `${loaderData?.origin ?? ""}${logoBranca.url}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/" },
        { property: "og:image", content: image },
        { property: "og:image:secure_url", content: image },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:alt", content: "Logo 3D Create" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": `${SITE_URL}/#business`,
            name: "3D Create",
            description,
            slogan: "Criamos ideias. Materializamos possibilidades.",
            url: `${SITE_URL}/`,
            image,
            logo: image,
            telephone: `+${WHATSAPP_NUMBER}`,
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
              { "@type": "State", name: "Goiás" },
            ],
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "Serviços de impressão 3D",
              itemListElement: [
                "Impressão 3D de peças personalizadas",
                "Prototipagem rápida em 3D",
                "Itens de decoração impressos em 3D",
                "Modelagem 3D sob medida",
              ].map((name) => ({
                "@type": "Offer",
                itemOffered: { "@type": "Service", name, areaServed: "Goiânia, GO" },
              })),
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        },
      ],
    };
  },
  component: Index,
});

function Index() {
  return (
    <main className="overflow-x-hidden">
      <Hero />
      <Services />
      <Process />
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <Portfolio />
      </Suspense>
      <Why />
      <Suspense fallback={<div className="min-h-[50vh]" />}>
        <Faq />
      </Suspense>
      <Suspense fallback={<div className="min-h-[70vh] bg-ink" />}>
        <QuoteForm />
      </Suspense>
      <SiteFooter />
      <WhatsAppFab />
    </main>
  );
}
