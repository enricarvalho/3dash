import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import { useOwners } from "@/hooks/use-owners";
import { Badge } from "@/components/ui/badge";
import { AUDIT_ACTION_LABEL, listQuoteAudit } from "@/lib/quote-audit";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function QuoteAuditLog({ quoteId }: { quoteId: string }) {
  const { ownerName } = useOwners();
  const audit = useQuery({
    queryKey: ["quote_audit_log", quoteId],
    queryFn: () => listQuoteAudit(quoteId),
  });

  const entries = audit.data ?? [];

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <ClipboardList className="h-4 w-4 text-muted-foreground" /> Histórico de alterações
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="border-l-2 border-muted pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{AUDIT_ACTION_LABEL[e.action] ?? e.action}</Badge>
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
    </div>
  );
}
