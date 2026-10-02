import { cn } from "@/lib/utils";

type Props = {
  /** Caminho sem extensão, ex.: "/images/port-1" */
  base: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  onClick?: () => void;
};

/** Imagem WebP responsiva com dimensões fixas (evita CLS) e fallback PNG. */
export function SmartImage({
  base,
  alt,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority = false,
  className,
  onClick,
}: Props) {
  return (
    <img
      src={`${base}-1280.webp`}
      srcSet={`${base}-640.webp 640w, ${base}-1280.webp 1280w`}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      onClick={onClick}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallback) return;
        img.dataset.fallback = "1";
        img.srcset = "";
        img.src = `${base}.png`;
      }}
      className={cn("h-auto", className)}
    />
  );
}
