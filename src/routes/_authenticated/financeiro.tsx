import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { Pager, useTableState } from "@/components/table-kit";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listCustomers,
  listParts,
  listQuoteItems,
  listQuotes,
  listSaleItems,
  listSales,
  listTransactions,
} from "@/lib/db";
import { useDeleteRecord, useSaveRecord } from "@/hooks/use-crud";
import { useClosedMonths } from "@/hooks/use-closed-months";
import { brl, dateBR, downloadCSV, monthRange, num } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  SYSTEM_EXPENSE_CATEGORIES,
  SYSTEM_INCOME_CATEGORIES,
  categoryLabel,
} from "@/lib/domain";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: pageTitle("Financeiro") },
      { name: "description", content: "Fluxo de caixa, entradas, saídas e lucro do período." },
    ],
  }),
  component: FinanceiroPage,
});

const empty = {
  kind: "entrada",
  category: "venda",
  description: "",
  amount: "0",
  occurred_on: new Date().toISOString().slice(0, 10),
  payment_method: "pix",
  paid_from_reserve: false,
  quote_id: "",
  customer_id: "",
};

function FinanceiroPage() {
  const tx = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: listQuotes });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const items = useQuery({ queryKey: ["quote_items"], queryFn: () => listQuoteItems() });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const saleItems = useQuery({ queryKey: ["sale_items"], queryFn: () => listSaleItems() });
  const save = useSaveRecord("transactions");
  const { isClosed, closedMessage } = useClosedMonths();
  const remove = useDeleteRecord("transactions");

  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<(typeof table.paged)[number] | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [categoryFilter, setCategoryFilter] = useState("todas");

  const { start, end } = monthRange(period);
  const inPeriod = (tx.data ?? []).filter(
    (t) =>
      t.occurred_on >= start &&
      t.occurred_on <= end &&
      (categoryFilter === "todas" || t.category === categoryFilter),
  );
  const income = inPeriod
    .filter((t) => t.kind === "entrada")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = inPeriod
    .filter((t) => t.kind === "saida")
    .reduce((s, t) => s + Number(t.amount), 0);
  const balance = (tx.data ?? []).reduce(
    (s, t) => s + (t.kind === "entrada" ? Number(t.amount) : -Number(t.amount)),
    0,
  );

  const WON_STATUS = ["aprovado", "em_producao", "concluido"];
  const wonQuotes = (quotes.data ?? []).filter(
    (q) =>
      WON_STATUS.includes(q.status) &&
      q.created_at.slice(0, 10) >= start &&
      q.created_at.slice(0, 10) <= end,
  );
  const quoteDateById = new Map(wonQuotes.map((q) => [q.id, q.created_at.slice(0, 10)]));
  const partById = new Map((parts.data ?? []).map((p) => [p.id, p]));

  const salesInPeriod = (sales.data ?? []).filter(
    (s) => s.status !== "cancelado" && s.sale_date >= start && s.sale_date <= end,
  );
  const saleDateById = new Map(salesInPeriod.map((s) => [s.id, s.sale_date]));
  const discountBySale = new Map(salesInPeriod.map((s) => [s.id, Number(s.discount ?? 0)]));

  type SoldRow = { date: string; receita: number; venal: number };
  const venalOf = (partId: string | null, unitPrice: number) => {
    const part = partId ? partById.get(partId) : undefined;
    const sale = part ? Number(part.sale_price) : 0;
    return sale > 0 ? sale : unitPrice;
  };

  const soldRows: SoldRow[] = [];
  for (const i of items.data ?? []) {
    const date = quoteDateById.get(i.quote_id);
    if (!date) continue;
    const qty = Number(i.quantity);
    soldRows.push({
      date,
      receita: Number(i.unit_price) * qty,
      venal: venalOf(i.part_id, Number(i.unit_price)) * qty,
    });
  }
  // Vendas diretas (módulo Vendas) também compõem a receita do período
  const saleGross = new Map<string, number>();
  const saleItemRows: { saleId: string; row: SoldRow }[] = [];
  for (const i of saleItems.data ?? []) {
    const date = saleDateById.get(i.sale_id);
    if (!date) continue;
    const qty = Number(i.quantity);
    const receita = Number(i.unit_price) * qty;
    saleGross.set(i.sale_id, (saleGross.get(i.sale_id) ?? 0) + receita);
    saleItemRows.push({
      saleId: i.sale_id,
      row: { date, receita, venal: venalOf(i.part_id, Number(i.unit_price)) * qty },
    });
  }
  for (const { saleId, row } of saleItemRows) {
    const gross = saleGross.get(saleId) ?? 0;
    const discount = discountBySale.get(saleId) ?? 0;
    // rateia o desconto da venda proporcionalmente entre os itens
    const factor = gross > 0 ? Math.max(0, gross - discount) / gross : 1;
    soldRows.push({ ...row, receita: row.receita * factor });
  }

  const receitaVenda = soldRows.reduce((s, r) => s + r.receita, 0);
  const valorVenalTotal = soldRows.reduce((s, r) => s + r.venal, 0);
  const margemVenal = receitaVenda - valorVenalTotal;

  const table = useTableState(
    inPeriod,
    (t) =>
      `${t.description} ${categoryLabel(t.category)} ${PAYMENT_METHOD_LABEL[t.payment_method ?? ""] ?? ""}`,
  );

  const evolution = (() => {
    const sorted = [...inPeriod].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
    let acc = 0;
    return sorted.map((t) => {
      acc += t.kind === "entrada" ? Number(t.amount) : -Number(t.amount);
      return { data: dateBR(t.occurred_on), saldo: acc };
    });
  })();

  const marginEvolution = (() => {
    const byBucket = new Map<string, { receita: number; venal: number }>();
    for (const r of soldRows) {
      const key = period === "year" ? r.date.slice(0, 7) : r.date;
      const cur = byBucket.get(key) ?? { receita: 0, venal: 0 };
      cur.receita += r.receita;
      cur.venal += r.venal;
      byBucket.set(key, cur);
    }
    return [...byBucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        periodo:
          period === "year"
            ? new Date(`${key}-01T00:00:00`).toLocaleDateString("pt-BR", {
                month: "short",
                year: "2-digit",
              })
            : dateBR(key),
        receita: v.receita,
        venal: v.venal,
        margem: v.receita - v.venal,
      }));
  })();

  const submit = () => {
    if (!form.description.trim()) return toast.error("Descreva o lançamento");
    if (isClosed(form.occurred_on)) return toast.error(closedMessage(form.occurred_on));
    if (!Number(form.amount)) return toast.error("Informe um valor");
    save.mutate(
      {
        values: {
          kind: form.kind,
          category: form.category,
          description: form.description.trim(),
          amount: Math.abs(Number(form.amount)),
          occurred_on: form.occurred_on,
          payment_method: form.payment_method || null,
          paid_from_reserve:
            form.kind === "saida" && form.category === "investimento" && form.paid_from_reserve,
          quote_id: form.quote_id || null,
          customer_id: form.customer_id || null,
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ ...empty });
        },
      },
    );
  };

  const categories = form.kind === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Entradas, saídas e o lucro real do período."
        actions={
          <>
            <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Ano</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() =>
                downloadCSV(
                  `financeiro-margem-${start}-${end}.csv`,
                  marginEvolution.map((r) => ({
                    periodo: r.periodo,
                    receita_vendas: r.receita,
                    valor_venal: r.venal,
                    margem: r.margem,
                    margem_pct: r.receita ? num((r.margem / r.receita) * 100, 1) : 0,
                  })),
                )
              }
              disabled={marginEvolution.length === 0}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Novo lançamento
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard accent label="Saldo em caixa" value={brl(balance)} hint="Todos os lançamentos" />
        <StatCard label="Entradas do período" value={brl(income)} />
        <StatCard label="Saídas do período" value={brl(expense)} />
        <StatCard
          label="Lucro do período"
          value={brl(income - expense)}
          hint={income ? `Margem ${Math.round(((income - expense) / income) * 100)}%` : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Receita de vendas (peças)"
          value={brl(receitaVenda)}
          hint="Vendas + orçamentos aprovados no período"
        />
        <StatCard
          label="Valor venal das peças"
          value={brl(valorVenalTotal)}
          hint="Preço de tabela das peças vendidas"
        />
        <StatCard
          accent
          label="Margem (receita − valor venal)"
          value={brl(margemVenal)}
          hint={
            receitaVenda
              ? `${num((margemVenal / receitaVenda) * 100, 1)}% sobre a receita`
              : "Sem vendas no período"
          }
        />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Evolução do saldo no período</h2>
        <div className="mt-4 h-56">
          {evolution.length === 0 ? (
            <EmptyState message="Sem lançamentos no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution}>
                <defs>
                  <linearGradient id="saldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--brand-2)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                <XAxis dataKey="data" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  fill="url(#saldo)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Evolução da margem (receita − valor venal)</h2>
          <span className="text-xs text-muted-foreground">
            {period === "year" ? "Agrupado por mês" : "Agrupado por dia"}
          </span>
        </div>
        <div className="mt-4 h-64">
          {marginEvolution.length === 0 ? (
            <EmptyState message="Sem vendas no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginEvolution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                <XAxis dataKey="periodo" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="receita"
                  name="Receita"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="venal"
                  name="Valor venal"
                  stroke="var(--brand-2)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="margem"
                  name="Margem"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          className="min-w-56 flex-1"
          placeholder="Buscar lançamento"
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {[
              ...INCOME_CATEGORIES,
              ...SYSTEM_INCOME_CATEGORIES,
              ...EXPENSE_CATEGORIES,
              ...SYSTEM_EXPENSE_CATEGORIES,
            ]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.paged.map((t) => (
              <TableRow
                key={t.id}
                className={clickableRow}
                onClick={() => setDetails(t)}
                title="Ver detalhes"
              >
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {dateBR(t.occurred_on)}
                    {isClosed(t.occurred_on) && (
                      <Lock className="h-3 w-3 text-muted-foreground" aria-label="Mês fechado" />
                    )}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{t.description}</TableCell>
                <TableCell>
                  <Badge variant="outline">{categoryLabel(t.category)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.payment_method
                    ? (PAYMENT_METHOD_LABEL[t.payment_method] ?? t.payment_method)
                    : "Não informado"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {quotes.data?.find((q) => q.id === t.quote_id)?.title ??
                    customers.data?.find((c) => c.id === t.customer_id)?.name ??
                    "—"}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${t.kind === "entrada" ? "text-[var(--success)]" : "text-destructive"}`}
                >
                  {t.kind === "entrada" ? "+" : "-"}
                  {brl(Number(t.amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {table.filtered.length === 0 && <EmptyState message="Nenhum lançamento no período." />}
        <Pager {...table} total={table.filtered.length} />
      </div>

      <RecordDetailsModal
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        title={details?.description ?? ""}
        subtitle={details ? (details.kind === "entrada" ? "Entrada" : "Saída") : undefined}
        fields={
          details
            ? [
                { label: "Data", value: dateBR(details.occurred_on) },
                {
                  label: "Valor",
                  value: `${details.kind === "entrada" ? "+" : "-"}${brl(Number(details.amount))}`,
                },
                {
                  label: "Categoria",
                  value: `${categoryLabel(details.category)}${details.paid_from_reserve ? " · pago com a reserva" : ""}`,
                },
                {
                  label: "Forma de pagamento",
                  value: details.payment_method
                    ? (PAYMENT_METHOD_LABEL[details.payment_method] ?? details.payment_method)
                    : "Não informado",
                },
                {
                  label: "Vínculo",
                  value:
                    quotes.data?.find((q) => q.id === details.quote_id)?.title ??
                    customers.data?.find((c) => c.id === details.customer_id)?.name ??
                    "—",
                },
              ]
            : []
        }
        actions={
          details?.category === "retirada_socio" ? (
            <p className="text-sm text-muted-foreground">
              Retirada de sócio: para excluir, use a tela Sócios.
            </p>
          ) : details && isClosed(details.occurred_on) ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> {closedMessage(details.occurred_on)}
            </p>
          ) : details?.cash_closing_id ? (
            <p className="text-sm text-muted-foreground">
              Lançado pelo fechamento de caixa: para desfazer, reabra o mês em Fechamento.
            </p>
          ) : details ? (
            <Button
              variant="destructive"
              onClick={() => {
                remove.mutate(details.id);
                setDetails(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          ) : null
        }
      />

      <FormModal open={open} onOpenChange={setOpen}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>Novo lançamento</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm({ ...form, kind: v, category: v === "entrada" ? "venda" : "material" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {categoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.occurred_on}
                  onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => setForm({ ...form, payment_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.kind === "saida" && form.category === "investimento" && (
              <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <Checkbox
                  checked={form.paid_from_reserve}
                  onCheckedChange={(v) => setForm({ ...form, paid_from_reserve: v === true })}
                  className="mt-0.5"
                />
                <span>
                  Pago com a reserva para investimento
                  <span className="block text-xs text-muted-foreground">
                    Sai do saldo da reserva e não reduz o valor dividido entre os sócios no mês.
                  </span>
                </span>
              </label>
            )}
            <div className="space-y-1.5">
              <Label>Orçamento vinculado</Label>
              <Select
                value={form.quote_id || "none"}
                onValueChange={(v) => {
                  const quote = quotes.data?.find((q) => q.id === v);
                  setForm({
                    ...form,
                    quote_id: v === "none" ? "" : v,
                    customer_id: quote?.customer_id ?? form.customer_id,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {(quotes.data ?? []).map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={form.customer_id || "none"}
                onValueChange={(v) => setForm({ ...form, customer_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {(customers.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={submit} disabled={save.isPending}>
              Salvar lançamento
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>
    </div>
  );
}
