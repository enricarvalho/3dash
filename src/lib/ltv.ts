import type { Customer, Sale, SaleItem } from "@/lib/db";

/** Uma compra fechada (venda não cancelada) com os itens adquiridos. */
export type ClosedPurchase = {
  sale: Sale;
  items: SaleItem[];
};

export type CustomerLtv = {
  customer: Customer;
  name: string;
  /** Soma das vendas fechadas (pagas + pendentes). */
  ltv: number;
  /** Parte do LTV já paga. */
  paid: number;
  /** Parte do LTV ainda pendente de pagamento. */
  pending: number;
  profit: number;
  orders: number;
  itemsQty: number;
  avgTicket: number;
  firstPurchase: string | null;
  lastPurchase: string | null;
  /** Dias desde a última compra (null se nunca comprou). */
  daysSinceLast: number | null;
  /** Média de dias entre compras (null com menos de 2 compras). */
  avgDaysBetween: number | null;
  purchases: ClosedPurchase[];
};

const DAY = 86_400_000;
const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

export const isClosedSale = (s: Sale) => s.status !== "cancelado";

/** Agrupa os itens por venda. */
export function itemsBySaleId(items: SaleItem[]) {
  const map = new Map<string, SaleItem[]>();
  items.forEach((i) => {
    const list = map.get(i.sale_id) ?? [];
    list.push(i);
    map.set(i.sale_id, list);
  });
  return map;
}

/** Calcula o LTV de um cliente a partir das vendas dele. */
export function customerLtv(
  customer: Customer,
  sales: Sale[],
  itemsBySale: Map<string, SaleItem[]>,
  today = new Date(),
): CustomerLtv {
  const closed = sales
    .filter((s) => s.customer_id === customer.id && isClosedSale(s))
    .sort((a, b) => b.sale_date.localeCompare(a.sale_date));

  const purchases = closed.map((sale) => ({ sale, items: itemsBySale.get(sale.id) ?? [] }));
  const ltv = closed.reduce((s, v) => s + Number(v.total), 0);
  const paid = closed.filter((v) => v.status === "pago").reduce((s, v) => s + Number(v.total), 0);
  const cost = closed.reduce((s, v) => s + Number(v.cost_total), 0);
  const itemsQty = purchases.reduce(
    (s, p) => s + p.items.reduce((q, i) => q + Number(i.quantity), 0),
    0,
  );

  const lastPurchase = closed[0]?.sale_date ?? null;
  const firstPurchase = closed[closed.length - 1]?.sale_date ?? null;
  const daysSinceLast = lastPurchase
    ? Math.max(0, Math.floor((today.getTime() - toDate(lastPurchase).getTime()) / DAY))
    : null;
  const avgDaysBetween =
    closed.length >= 2 && firstPurchase && lastPurchase
      ? Math.round(
          (toDate(lastPurchase).getTime() - toDate(firstPurchase).getTime()) /
            DAY /
            (closed.length - 1),
        )
      : null;

  return {
    customer,
    name: customer.name,
    ltv,
    paid,
    pending: ltv - paid,
    profit: ltv - cost,
    orders: closed.length,
    itemsQty,
    avgTicket: closed.length ? ltv / closed.length : 0,
    firstPurchase,
    lastPurchase,
    daysSinceLast,
    avgDaysBetween,
    purchases,
  };
}

export function computeLtv(customers: Customer[], sales: Sale[], items: SaleItem[]) {
  const bySale = itemsBySaleId(items);
  return customers.map((c) => customerLtv(c, sales, bySale));
}
