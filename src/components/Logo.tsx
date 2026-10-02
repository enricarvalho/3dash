import { cn } from "@/lib/utils";
import markAsset from "@/assets/3dcreate-mark.png.asset.json";

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-gradient",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={markAsset.url}
        alt="3D Create"
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        className="object-contain"
        style={{ width: size * 0.62, height: size * 0.62 }}
      />
    </span>
  );
}

export function LogoWordmark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={32} />
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight">3D Create</p>
          <p className="text-[11px] text-muted-foreground">Gestão · Goiânia</p>
        </div>
      )}
    </div>
  );
}
