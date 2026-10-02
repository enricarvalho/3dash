import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { HeroCanvas } from "../HeroCanvas";
import { Logo } from "../Logo";
import { TiltPermissionButton } from "../TiltPermissionButton";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 110%, oklch(0.42 0.22 300 / 0.75) 0%, oklch(0.30 0.20 275 / 0.6) 35%, transparent 70%), radial-gradient(80% 60% at 20% 0%, oklch(0.40 0.20 265 / 0.45) 0%, transparent 60%)",
        }}
      />
      <HeroCanvas />

      <header className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-5 sm:gap-4 sm:px-6 sm:py-6">
        <motion.div
          className="flex min-w-0 items-center gap-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease }}
        >
          <Logo />
        </motion.div>
        <motion.nav
          className="flex items-center gap-6 text-sm text-white/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.5 }}
        >
          <a href="#servicos" className="hidden transition-colors hover:text-white sm:block">
            Serviços
          </a>
          <a href="#portfolio" className="hidden transition-colors hover:text-white sm:block">
            Portfólio
          </a>
          <Link
            to="/impressao-3d-goiania"
            className="hidden transition-colors hover:text-white sm:block"
          >
            Goiânia
          </Link>
          <a
            href="#orcamento"
            className="rounded-full border border-white/20 px-4 py-2 text-white transition-colors hover:border-white/50"
          >
            Orçamento
          </a>
        </motion.nav>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-10 px-6 pb-24 pt-10 lg:grid-cols-2">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        <motion.p
          className="text-xs uppercase tracking-[0.35em] text-white/65"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 0.8, ease }}
        >
          Impressão 3D · Goiânia, GO
        </motion.p>

        <motion.h1
          className="mt-8 font-display text-[clamp(2.6rem,7vw,5rem)] font-bold leading-[0.95] text-white"
          initial={{ opacity: 0, y: 34, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.8, delay: 1.1, ease }}
        >
          Impressão 3D em Goiânia:
          <br />
          <span className="brand-text">criamos ideias, materializamos possibilidades.</span>
        </motion.h1>

        <motion.p
          className="mt-8 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.6, delay: 1.7, ease }}
        >
          Peças personalizadas, protótipos funcionais e objetos de decoração impressos em 3D
          com acabamento de estúdio — do arquivo à peça pronta na sua mão.
        </motion.p>

        <motion.div
          className="mt-12 flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row sm:items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.6, delay: 2.2, ease }}
        >
          <a
            href="#orcamento"
            className="group relative inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-full border border-white/25 px-8 text-center text-base font-medium leading-none text-white transition-all duration-700 hover:border-transparent hover:shadow-[0_0_50px_-6px_oklch(0.686_0.194_318.3/0.85)] sm:w-64"
          >
            <span className="brand-gradient absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
            Solicite seu orçamento
          </a>
          <a
            href="#portfolio"
            onClick={(e) => {
              const target = document.getElementById("portfolio");
              if (!target) return;
              e.preventDefault();
              const reduced = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
              ).matches;
              target.scrollIntoView({
                behavior: reduced ? "auto" : "smooth",
                block: "start",
              });
              history.replaceState(null, "", "#portfolio");
            }}
            className="inline-flex h-14 w-full items-center justify-center rounded-full border border-white/15 px-8 text-center text-base font-medium leading-none text-white/70 transition-all duration-700 hover:border-white/40 hover:bg-white/5 hover:text-white sm:w-64"
          >
            Ver portfólio
          </a>
        </motion.div>

        <motion.div
          className="mt-6 lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 2.6 }}
        >
          <TiltPermissionButton />
        </motion.div>
        </div>
        {/* coluna reservada para o objeto 3D renderizado no canvas */}
        <div className="hidden lg:block" aria-hidden />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
    </section>
  );
}