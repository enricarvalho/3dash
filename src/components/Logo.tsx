import { useCompanyProfile } from "@/hooks/use-company-profile";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Box } from "lucide-react";

/** Logo da empresa (quando enviada em Configurações) ou o ícone padrão. */
export function Logo({
  className,
  size = 36,
  src,
}: {
  className?: string;
  size?: number;
  src?: string | null;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt="Logo da empresa"
        className={cn("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={BRAND.appName}
    >
      <Box aria-hidden="true" style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={1.8} />
    </span>
  );
}

export function LogoWordmark({ collapsed = false }: { collapsed?: boolean }) {
  const { data } = useCompanyProfile();
  const company = data?.company?.trim();
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={32} src={data?.logo_url} />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-sm font-bold">{company || BRAND.appName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{BRAND.appTagline}</p>
        </div>
      )}
    </div>
  );
}
