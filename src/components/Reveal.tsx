import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Animação de entrada 100% CSS disparada por IntersectionObserver.
 * `will-change` é aplicado só enquanto a transição roda e removido no fim.
 */
export function Reveal({
  children,
  delay = 0,
  y = 40,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-revealed");
      el.style.willChange = "";
      return;
    }
    const done = () => {
      el.style.willChange = "";
      el.removeEventListener("transitionend", done);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        el.style.willChange = "transform, opacity, filter";
        el.addEventListener("transitionend", done);
        el.classList.add("is-revealed");
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener("transitionend", done);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={
        {
          "--reveal-y": `${y}px`,
          "--reveal-delay": `${delay}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
