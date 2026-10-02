import { useQuery } from "@tanstack/react-query";

import { listCashClosings } from "@/lib/db";
import { monthLabel } from "@/lib/cash-closing";

/** Meses com caixa fechado: lançamentos, vendas e retiradas desses meses ficam bloqueados. */
export function useClosedMonths() {
  const { data } = useQuery({ queryKey: ["cash_closings"], queryFn: listCashClosings });
  const closed = new Set(
    (data ?? []).filter((c) => c.status === "fechado").map((c) => c.month.slice(0, 7)),
  );
  const isClosed = (date?: string | null) => !!date && closed.has(date.slice(0, 7));
  const closedMessage = (date: string) =>
    `O caixa de ${monthLabel(date.slice(0, 7))} está fechado. Para alterar, reabra o mês na tela Fechamento.`;
  return { isClosed, closedMessage };
}
