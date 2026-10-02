import { useEffect, useRef, useState, type ReactNode } from "react";
import { acquireHeroInput, getHeroInput, HERO_INPUT_LAYERS } from "@/lib/hero-input";

export function TiltCard({
  children,
  className = "",
  intensity = 8,
  deviceTilt = false,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  /** Também reage à inclinação do aparelho (mobile) enquanto visível. */
  deviceTilt?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!deviceTilt) return;
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const release = acquireHeroInput();

    let raf = 0;
    let visible = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // mesma fonte e mesma direção do hero, com o peso da camada de cards
      const input = getHeroInput();
      const w = HERO_INPUT_LAYERS.card * intensity;
      el.style.transform = `rotateX(${(input.y * w).toFixed(2)}deg) rotateY(${(
        input.x * w
      ).toFixed(2)}deg)`;
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        const next = entry.isIntersecting;
        if (next === visible) return;
        visible = next;
        if (visible && !raf) raf = requestAnimationFrame(tick);
        if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
          el.style.transform = "";
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      release();
    };
  }, [deviceTilt, intensity]);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setT({ x: -py * intensity, y: px * intensity });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      className={`[transform-style:preserve-3d] [perspective:1000px] transition-transform duration-500 ease-out ${className}`}
      style={{ transform: `rotateX(${t.x}deg) rotateY(${t.y}deg)` }}
    >
      {children}
    </div>
  );
}