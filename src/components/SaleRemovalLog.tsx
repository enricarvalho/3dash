import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { useOwners } from "@/hooks/use-owners";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SALE_AUDIT_ACTION_LABEL, listSaleRemovalAudit } from "@/lib/sale-audit";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SaleRemovalLog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { ownerName } = useOwners();
  const audit = useQuery({
    queryKey: ["sale_audit_log", "removals"],
    queryFn: listSaleRemovalAudit,
    enabled: open,
  });

  const entries = audit.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Exclusões e cancelamentos
          </DialogTitle>
          <DialogDescription>
            Registro de vendas excluídas ou canceladas, com data, hora, usuário e o efeito no
            financeiro.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
        ) : (
          <ol className="space-y-3">
            {entries.map((e) => (
              <li key={e.id} className="border-l-2 border-muted pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {SALE_AUDIT_ACTION_LABEL[e.action] ?? e.action}
                  </Badge>
                  {e.sale_label && <span className="text-sm font-medium">{e.sale_label}</span>}
                  <span className="text-xs text-muted-foreground">
                    {dateTime(e.created_at)} · {ownerName(e.changed_by)}
                  </span>
                </div>
                {e.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-1 text-xs">
                    {e.changes.map((c, idx) => (
                      <li key={`${e.id}-${idx}`} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{c.label}:</span>{" "}
                        <span className="line-through">{c.from ?? "—"}</span> →{" "}
                        <span className="text-foreground">{c.to ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
