import { Fragment, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, Gem, Repeat, Users, Wallet } from "lucide-react";

import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { Pager, SortButton, useTableState } from "@/components/table-kit";
import { CustomerPurchases } from "@/components/CustomerPurchases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCustomers, listSaleItems, listSales } from "@/lib/db";
import { brl, dateBR, downloadCSV, num } from "@/lib/format";
import { computeLtv, type CustomerLtv } from "@/lib/ltv";

export const Route = createFileRoute("/_authenticated/ltv")({
  head: () => ({
    meta: [
      { title: "LTV · 3D Create" },
      {
        name: "description",
        content: "Valor gerado por cliente ao longo do tempo e o que cada um comprou.",
      },
    ],
  }),
  component: LtvPage,
});

/** Classificação pela recência da última compra. */
const RECENCY = {
  ativo: { label: "Ativo", variant: "default" },
  risco: { label: "Em risco", variant: "secondary" },
  inativo: { label: "Inativo", variant: "outline" },
  sem: { label: "Sem compras", variant: "outline" },
} as const;
type Recency = keyof typeof RECENCY;

const recencyOf = (r: CustomerLtv): Recency =>
  r.daysSinceLast === null
    ? "sem"
    : r.daysSinceLast <= 90
      ? "ativo"
      : r.daysSinceLast <= 180
        ? "risco"
        : "inativo";

function LtvPage() {
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const saleItems = useQuery({ queryKey: ["sale_items"], queryFn: () => listSaleItems() });

  const [filter, setFilter] = useState("compradores");
  const [expanded, setExpanded] = useState<string | null>(null);

  const all = useMemo(
    () =>
      computeLtv(customers.data ?? [], sales.data ?? [], saleItems.data ?? []).sort(
        (a, b) => b.ltv - a.ltv,
      ),
    [customers.data, sales.data, saleItems.data],
  );

  const rows = all.filter((r) => {
    if (filter === "todos") return true;
    if (filter === "compradores") return r.orders > 0;
    return recencyOf(r) === filter;
  });

  const table = useTableState(
    rows,
    (r) =>
      `${r.name} ${r.customer.email ?? ""} ${r.customer.phone ?? ""} ${r.purchases
        .flatMap((p) => p.items.map((i) => i.description))
        .join(" ")}`,
  );

  const buyers = all.filter((r) => r.orders > 0);
  const totalLtv = buyers.reduce((s, r) => s + r.ltv, 0);
  const totalOrders = buyers.reduce((s, r) => s + r.orders, 0);
  const totalPending = buyers.reduce((s, r) => s + r.pending, 0);
  const repeat = buyers.filter((r) => r.orders >= 2).length;

  const exportCsv = () =>
    downloadCSV(
      "ltv-clientes.csv",
      table.filtered.map((r) => ({
        Cliente: r.name,
        Pedidos: r.orders,
        Itens: r.itemsQty,
        LTV: num(r.ltv),
        Pago: num(r.paid),
        Pendente: num(r.pending),
        Lucro: num(r.profit),
        "Ticket médio": num(r.avgTicket),
        "Primeira compra": dateBR(r.firstPurchase),
        "Última compra": dateBR(r.lastPurchase),
        Situação: RECENCY[recencyOf(r)].label,
        "Itens comprados": r.purchases
          .flatMap((p) => p.items.map((i) => `${num(Number(i.quantity), 0)}x ${i.description}`))
          .join(", "),
      })),
    );

  const loading = customers.isLoading || sales.isLoading || saleItems.isLoading;

  return (
    <div>
      <PageHeader
        title="LTV de clientes"
        description="Quanto cada cliente cadastrado já gerou e o que comprou em cada venda fechada."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!table.filtered.length}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          accent
          label="LTV médio"
          value={brl(buyers.length ? totalLtv / buyers.length : 0)}
          hint={`${brl(totalLtv)} no total`}
          icon={<Gem className="h-4 w-4" />}
        />
        <StatCard
          label="Ticket médio"
          value={brl(totalOrders ? totalLtv / totalOrders : 0)}
          hint={`${totalOrders} compra${totalOrders === 1 ? "" : "s"} fechada${totalOrders === 1 ? "" : "s"}`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Clientes compradores"
          value={`${buyers.length} de ${all.length}`}
          hint={
            all.length
              ? `${num((buyers.length / all.length) * 100, 0)}% dos cadastrados`
              : undefined
          }
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Recompra"
          value={buyers.length ? `${num((repeat / buyers.length) * 100, 0)}%` : "—"}
          hint={`${repeat} cliente${repeat === 1 ? "" : "s"} com 2+ compras · ${brl(totalPending)} pendente`}
          icon={<Repeat className="h-4 w-4" />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por cliente ou item comprado..."
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48" aria-label="Filtro">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compradores">Com compras</SelectItem>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            <SelectItem value="ativo">Ativos (até 90 dias)</SelectItem>
            <SelectItem value="risco">Em risco (91–180 dias)</SelectItem>
            <SelectItem value="inativo">Inativos (+180 dias)</SelectItem>
            <SelectItem value="sem">Sem compras</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {table.paged.length === 0 ? (
        <EmptyState message={loading ? "Carregando..." : "Nenhum cliente neste filtro."} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>
                  <SortButton label="Cliente" onClick={() => table.toggleSort("name")} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Compras" onClick={() => table.toggleSort("orders")} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="LTV" onClick={() => table.toggleSort("ltv")} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Ticket médio" onClick={() => table.toggleSort("avgTicket")} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Lucro" onClick={() => table.toggleSort("profit")} />
                </TableHead>
                <TableHead>
                  <SortButton
                    label="Última compra"
                    onClick={() => table.toggleSort("lastPurchase")}
                  />
                </TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.paged.map((r) => {
                const open = expanded === r.customer.id;
                const rec = RECENCY[recencyOf(r)];
                const toggle = () => setExpanded(open ? null : r.customer.id);
                return (
                  <Fragment key={r.customer.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={toggle}
                      tabIndex={0}
                      aria-expanded={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") toggle();
                      }}
                    >
                      <TableCell>
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/clientes/$customerId"
                          params={{ customerId: r.customer.id }}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.name}
                        </Link>
                        {r.orders > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {num(r.itemsQty, 0)} ite{r.itemsQty === 1 ? "m" : "ns"} · cliente desde{" "}
                            {dateBR(r.firstPurchase)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.orders}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {brl(r.ltv)}
                        {r.pending > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">
                            {brl(r.pending)} pendente
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{brl(r.avgTicket)}</TableCell>
                      <TableCell
                        className={`text-right ${r.profit < 0 ? "text-destructive" : "text-emerald-600"}`}
                      >
                        {brl(r.profit)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.lastPurchase ? (
                          <>
                            {dateBR(r.lastPurchase)}
                            <div className="text-xs">
                              há {r.daysSinceLast} dia{r.daysSinceLast === 1 ? "" : "s"}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rec.variant}>{rec.label}</Badge>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          {r.avgDaysBetween !== null && (
                            <p className="mb-3 text-xs text-muted-foreground">
                              Compra em média a cada {r.avgDaysBetween} dia
                              {r.avgDaysBetween === 1 ? "" : "s"}.
                            </p>
                          )}
                          <CustomerPurchases purchases={r.purchases} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <Pager {...table} total={table.filtered.length} />
        </div>
      )}
    </div>
  );
}
