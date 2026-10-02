import { Reveal } from "../Reveal";
import { SmartImage } from "../SmartImage";
import { TiltCard } from "../TiltCard";

const services = [
  {
    title: "Personalizados",
    image: "/images/card-personalizados",
    text: "Peças sob medida a partir da sua ideia, desenho ou arquivo. Ajuste fino de encaixe, resistência e acabamento.",
  },
  {
    title: "Protótipos",
    image: "/images/card-prototipos",
    text: "Validação rápida de produto: modelos funcionais, testes de montagem e iterações em poucos dias.",
  },
  {
    title: "Decoração",
    image: "/images/card-decoracao",
    text: "Objetos, luminárias e esculturas com texturas de filamento que viram peça central do ambiente.",
  },
];

export function Services() {
  return (
    <section id="servicos" className="bg-background px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            O que fazemos
          </p>
          <h2 className="mt-5 max-w-2xl text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.02]">
            Três formas de tirar um projeto do digital.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {services.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.18}>
              <TiltCard className="group h-full">
                <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_20px_60px_-40px_oklch(0.3_0.15_280/0.6)] transition-[box-shadow,transform] duration-700 will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.015] hover:shadow-[0_30px_80px_-40px_oklch(0.5_0.24_290/0.55)]">
                  <div className="overflow-hidden">
                    <SmartImage
                      base={s.image}
                      alt={`Render 3D representando ${s.title.toLowerCase()}`}
                      width={1024}
                      height={768}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-7">
                    <h3 className="text-xl font-bold">{s.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                </article>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}