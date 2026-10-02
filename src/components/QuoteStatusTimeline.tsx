import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { useOwners } from "@/hooks/use-owners";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABEL } from "@/lib/domain";
import { listQuoteStatusHistory } from "@/lib/quote-status";

const dateTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function QuoteStatusTimeline({ quoteId }: { quoteId: string }) {
  const { ownerName } = useOwners();
  const history = useQuery({
    queryKey: ["quote_status_history", quoteId],
    queryFn: () => listQuoteStatusHistory(quoteId),
  });

  const events = history.data ?? [];

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-muted-foreground" /> Histórico de status
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma mudança de status registrada ainda.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="border-l-2 border-muted pl-3">
              <div className="flex flex-wrap items-center gap-2">
                {e.from_status && (
                  <span className="text-xs text-muted-foreground">
                    {QUOTE_STATUS_LABEL[e.from_status] ?? e.from_status} →
                  </span>
                )}
                <Badge variant="secondary">
                  {QUOTE_STATUS_LABEL[e.to_status] ?? e.to_status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateTime(e.created_at)} · {ownerName(e.changed_by)}
              </p>
              {e.note && <p className="mt-1 text-sm">{e.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
