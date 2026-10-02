import { Reveal } from "../Reveal";
import { FAQ_ITEMS } from "@/lib/faq";

export function Faq() {
  return (
    <section id="faq" className="bg-background px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Dúvidas frequentes
          </p>
          <h2 className="mt-4 text-[clamp(2rem,5.5vw,4rem)] font-bold leading-[1]">
            Impressão 3D em <span className="brand-text">Goiânia</span>: perguntas frequentes
          </h2>
        </Reveal>

        <dl className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border">
          {FAQ_ITEMS.map((item, i) => (
            <Reveal key={item.q} delay={i * 0.08}>
              <div className="h-full bg-background p-8 sm:p-10">
                <dt className="font-display text-lg font-bold leading-snug">{item.q}</dt>
                <dd className="mt-3 text-muted-foreground">{item.a}</dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
