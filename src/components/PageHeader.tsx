import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-xl bg-brand-gradient p-4 text-brand-foreground shadow-[var(--shadow-brand)]"
          : "rounded-xl border bg-card p-4"
      }
    >
      <div className="flex items-center justify-between">
        <p className={accent ? "text-xs font-medium opacity-90" : "text-xs font-medium text-muted-foreground"}>
          {label}
        </p>
        {icon && <span className={accent ? "opacity-90" : "text-muted-foreground"}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && (
        <p className={accent ? "mt-1 text-xs opacity-90" : "mt-1 text-xs text-muted-foreground"}>{hint}</p>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
