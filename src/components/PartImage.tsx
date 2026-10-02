import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { getPartImageUrl, thumbPathFor } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

/** Só busca a URL assinada quando o elemento chega perto da viewport. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);

  return { ref, inView };
}

export function PartImage({
  src,
  alt,
  className,
  variant = "full",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  variant?: "full" | "thumb";
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [loaded, setLoaded] = useState(false);
  const resolved = src ? (variant === "thumb" ? thumbPathFor(src) : src) : "";

  const q = useQuery({
    queryKey: ["part-image", resolved],
    queryFn: () => getPartImageUrl(resolved),
    enabled: !!resolved && inView,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
  const fallback = useQuery({
    queryKey: ["part-image", src],
    queryFn: () => getPartImageUrl(src ?? ""),
    enabled: !!src && inView && variant === "thumb" && q.isError,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const url = q.data ?? fallback.data;

  if (!src) {
    return <span className="text-xs text-muted-foreground">Sem imagem</span>;
  }

  if (!url) {
    // placeholder ocupa o mesmo espaço, evitando reflow enquanto carrega
    return (
      <span
        ref={ref}
        className="block h-full min-h-8 w-full animate-pulse rounded-md bg-muted"
        aria-hidden
      />
    );
  }

  return (
    <span ref={ref} className="contents">
      <img
        src={url}
        alt={alt}
        className={cn(className, !loaded && "animate-pulse bg-muted")}
        loading="lazy"
        decoding="async"
        // @ts-expect-error fetchPriority ainda não tipado em todas as versões
        fetchpriority="low"
        onLoad={() => setLoaded(true)}
      />
    </span>
  );
}
