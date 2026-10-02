import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_METHOD_LABEL, SALE_STATUS_LABEL } from "@/lib/domain";
import { brl, dateBR, num } from "@/lib/format";
import type { ClosedPurchase } from "@/lib/ltv";

/** Lista as compras fechadas de um cliente com o que foi adquirido em cada uma. */
export function CustomerPurchases({ purchases }: { purchases: ClosedPurchase[] }) {
  if (!purchases.length)
    return <EmptyState message="Este cliente ainda não fechou nenhuma compra." />;

  return (
    <div className="space-y-3">
      {purchases.map(({ sale, items }) => {
        const profit = Number(sale.total) - Number(sale.cost_total);
        return (
          <div key={sale.id} className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{dateBR(sale.sale_date)}</span>
                <Badge variant={sale.status === "pago" ? "default" : "secondary"}>
                  {SALE_STATUS_LABEL[sale.status] ?? sale.status}
                </Badge>
                {sale.payment_method && (
                  <span className="text-muted-foreground">
                    {PAYMENT_METHOD_LABEL[sale.payment_method] ?? sale.payment_method}
                  </span>
                )}
                {sale.quote_id && (
                  <Link
                    to="/orcamentos/$quoteId"
                    params={{ quoteId: sale.quote_id }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  >
                    <FileText className="h-3 w-3" /> Ver orçamento
                  </Link>
                )}
              </div>
              <div className="text-right text-sm">
                <span className="font-semibold">{brl(Number(sale.total))}</span>
                <span
                  className={`ml-2 text-xs ${profit < 0 ? "text-destructive" : "text-emerald-600"}`}
                >
                  lucro {brl(profit)}
                </span>
              </div>
            </div>
            {items.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum item registrado.</p>
            ) : (
              <ul className="divide-y">
                {items.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {i.image_url && (
                        <img
                          src={i.image_url}
                          alt={i.description}
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      )}
                      <span className="truncate font-medium">{i.description}</span>
                      {!i.part_id && !i.material_id && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          avulso
                        </Badge>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-muted-foreground">
                      {num(Number(i.quantity), 0)} × {brl(Number(i.unit_price))} ={" "}
                      <span className="font-medium text-foreground">
                        {brl(Number(i.quantity) * Number(i.unit_price))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {sale.notes && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">{sale.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
