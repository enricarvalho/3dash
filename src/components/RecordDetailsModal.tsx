import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DetailField = {
  label: string;
  value: ReactNode;
  full?: boolean;
};

/**
 * Modal de detalhamento usado nas listagens.
 * Abre ao clicar em qualquer lugar da linha e concentra as ações do registro.
 */
export function RecordDetailsModal({
  open,
  onOpenChange,
  title,
  subtitle,
  fields,
  children,
  actions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  fields?: DetailField[];
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        {fields && fields.length > 0 && (
          <dl className="grid gap-3 sm:grid-cols-2">
            {fields.map((f, i) => (
              <div key={`${f.label}-${i}`} className={f.full ? "sm:col-span-2" : undefined}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                <dd className="mt-0.5 text-sm font-medium break-words">{f.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}

        {children}

        {actions ? (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">{actions}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Classe padrão para linhas clicáveis das tabelas. */
export const clickableRow = "cursor-pointer transition-colors hover:bg-muted/50";
