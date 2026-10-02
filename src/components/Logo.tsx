import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Box } from "lucide-react";

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
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
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={32} />
      {!collapsed && (
        <div className="leading-tight">
          <p className="font-display text-sm font-bold">{BRAND.appName}</p>
          <p className="text-[11px] text-muted-foreground">{BRAND.appTagline}</p>
        </div>
      )}
    </div>
  );
}
