import { Reveal } from "../Reveal";

const steps = [
  { n: "01", t: "Conversa", d: "Você envia a ideia, referência ou arquivo pelo WhatsApp. Entendemos uso, prazo e material." },
  { n: "02", t: "Modelagem", d: "Modelamos ou ajustamos o 3D e enviamos a prévia para aprovação antes de imprimir." },
  { n: "03", t: "Impressão", d: "Produção com parâmetros calibrados para resistência, precisão dimensional e acabamento." },
  { n: "04", t: "Entrega", d: "Pós-processamento, conferência final e entrega em Goiânia ou envio para todo o Brasil." },
];

export function Process() {
  return (
    <section className="bg-secondary px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-7xl">
        <Reveal y={30}>
          <h2 className="max-w-2xl text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.02]">
            Como funciona
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.n} className="relative h-full">
              <Reveal y={24} delay={i * 0.2} className="h-full">
                <div className="group relative h-full bg-background p-8">
                  <span
                    className="brand-gradient absolute inset-x-0 top-0 h-[3px] origin-left"
                    aria-hidden
                  />
                  <span className="brand-text font-display text-4xl font-bold">{s.n}</span>
                  <h3 className="mt-5 text-lg font-bold">{s.t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
