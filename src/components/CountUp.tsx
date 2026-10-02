import { useEffect, useRef, useState } from "react";

/** Extrai prefixo, número (aceita vírgula decimal) e sufixo de "+500", "0,1mm". */
function parse(value: string) {
  const match = value.match(/^(\D*)([\d.,]+)(.*)$/);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;
  const decimals = raw.includes(",") ? raw.split(",")[1].length : 0;
  const num = Number(raw.replace(".", "").replace(",", "."));
  if (Number.isNaN(num)) return null;
  return { prefix, num, suffix, decimals };
}

const format = (n: number, decimals: number) =>
  n.toFixed(decimals).replace(".", ",");

/** Contagem animada disparada quando o número entra no viewport. */
export function CountUp({ value, duration = 1600 }: { value: string; duration?: number }) {
  const parsed = parse(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() =>
    parsed ? `${parsed.prefix}${format(0, parsed.decimals)}${parsed.suffix}` : value,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || !parsed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(
            `${parsed.prefix}${format(parsed.num * eased, parsed.decimals)}${parsed.suffix}`,
          );
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span ref={ref} aria-label={value}>
      {display}
    </span>
  );
}
