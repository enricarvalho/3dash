import { motion } from "motion/react";
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from "react";

/** Retenta o import dinâmico: falhas de rede/chunk obsoleto não podem quebrar a página. */
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType }>) {
  return lazy(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await factory();
      } catch {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    return { default: () => null };
  });
}

const ParticleField = lazyWithRetry(
  () => import("./three/ParticleField") as Promise<{ default: React.ComponentType }>,
);

/** Se o canvas 3D falhar, o hero continua renderizando sem ele. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Não carrega o bundle 3D em conexões econômicas ou dispositivos muito fracos. */
function shouldSkip3D() {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 2) return true;
  return false;
}

export function HeroCanvas() {
  const holder = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // carrega só quando o hero está visível e o navegador está ocioso
  useEffect(() => {
    if (shouldSkip3D()) return;
    const el = holder.current;
    if (!el) return;

    let idleId = 0;
    let timeoutId = 0;
    const schedule = () => {
      const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
        .requestIdleCallback;
      if (ric) idleId = ric(() => setMounted(true), { timeout: 1200 });
      else timeoutId = window.setTimeout(() => setMounted(true), 200);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          schedule();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      const cic = (window as Window & { cancelIdleCallback?: typeof cancelIdleCallback })
        .cancelIdleCallback;
      if (idleId && cic) cic(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div ref={holder} className="pointer-events-none absolute inset-0">
      {mounted && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2.6, ease: "easeOut" }}
        >
          <CanvasBoundary>
            <Suspense fallback={null}>
              <ParticleField />
            </Suspense>
          </CanvasBoundary>
        </motion.div>
      )}
    </div>
  );
}