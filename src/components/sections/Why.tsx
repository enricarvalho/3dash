import { CountUp } from "../CountUp";
import { Reveal } from "../Reveal";
import { SmartImage } from "../SmartImage";

const stats = [
  { k: "+500", l: "peças impressas" },
  { k: "48h", l: "prazo médio de protótipo" },
  { k: "0,1mm", l: "precisão de camada" },
  { k: "100%", l: "aprovação antes de imprimir" },
];

export function Why() {
  return (
    <section className="bg-secondary px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <h2 className="max-w-3xl text-[clamp(2rem,5.5vw,4rem)] font-bold leading-[1]">
              Por que a <span className="brand-text">3D Create</span>
            </h2>
            <p className="mt-6 max-w-xl text-muted-foreground">
              Estúdio de impressão em Goiânia obcecado por tolerância, acabamento e prazo
              cumprido. Cada camada é calibrada — e cada peça sai conferida.
            </p>
            <span className="brand-gradient mt-8 block h-1 w-40 rounded-full" aria-hidden />
          </Reveal>
          <Reveal delay={0.2}>
            <SmartImage
              base="/images/hero-render"
              alt="Peça sendo impressa camada por camada com partículas de luz saindo do bico da impressora 3D"
              width={1280}
              height={960}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="aspect-[4/3] w-full rounded-3xl object-cover"
            />
          </Reveal>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.k} delay={i * 0.14}>
              <div className="h-full bg-background p-10">
                <p className="font-display text-[clamp(2.5rem,6vw,4rem)] font-bold leading-none tracking-tighter tabular-nums">
                  <CountUp value={s.k} />
                </p>
                <p className="mt-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  {s.l}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
