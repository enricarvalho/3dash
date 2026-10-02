import { useEffect, useState } from "react";
import { Reveal } from "../Reveal";
import { SmartImage } from "../SmartImage";
import { TiltCard } from "../TiltCard";

const works = [
  { img: "/images/port-1", t: "Maquete arquitetônica", m: "PLA · escala 1:100" },
  { img: "/images/port-2", t: "Chassi de drone", m: "PETG · alta rigidez" },
  { img: "/images/port-3", t: "Colecionável autoral", m: "Resina · detalhe fino" },
  { img: "/images/port-4", t: "Luminária pendente", m: "PLA translúcido" },
  { img: "/images/port-5", t: "Gabaritos industriais", m: "ABS · uso em linha" },
  { img: "/images/port-6", t: "Troféu personalizado", m: "PLA · acabamento metálico" },
];

export function Portfolio() {
  const [open, setOpen] = useState<number | null>(null);
  const active = open === null ? null : works[open];

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  return (
    <section id="portfolio" className="bg-background px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Portfólio</p>
          <h2 className="mt-5 max-w-2xl text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.02]">
            Peças que saíram da nossa mesa.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {works.map((w, i) => (
            <Reveal key={w.t} delay={(i % 3) * 0.15}>
              <TiltCard deviceTilt intensity={6}>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`Ampliar imagem: ${w.t}`}
                  className="group relative block w-full overflow-hidden rounded-3xl bg-ink text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-purple"
                >
                  <SmartImage
                    base={w.img}
                    alt={w.t}
                    width={1024}
                    height={1024}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="aspect-square w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.07]"
                  />
                  <span className="absolute inset-x-0 bottom-0 block translate-y-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-7 opacity-0 transition-all duration-700 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    <span className="block font-display text-lg font-bold text-white">{w.t}</span>
                    <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-white/55">
                      {w.m}
                    </span>
                  </span>
                </button>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.t}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
        >
          <div
            className="relative max-h-full w-full max-w-3xl overflow-hidden rounded-3xl bg-ink"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`${active.img}-1280.webp`}
              alt={active.t}
              width={1024}
              height={1024}
              loading="lazy"
              decoding="async"
              className="aspect-square w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-7">
              <p className="font-display text-xl font-bold text-white">{active.t}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/60">{active.m}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl leading-none text-white transition-colors hover:bg-black/80"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
