import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  ShoppingCart,
  Vault,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SaleFormModal } from "@/components/SaleFormModal";
import { PageHeader, StatCard, EmptyState } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listCashClosings,
  listMaterials,
  listParts,
  listQuotes,
  listTransactions,
  listCustomers,
} from "@/lib/db";
import { addMonths, monthLabel, nextMonthToClose } from "@/lib/cash-closing";
import { brl, dateBR, num } from "@/lib/format";
import { QUOTE_STATUS_LABEL, stockStatus } from "@/lib/domain";
import { materialLabel } from "@/lib/material-stock";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · 3D Create" },
      { name: "description", content: "Visão geral do mês: caixa, orçamentos e estoque." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: listQuotes });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const tx = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const now = new Date();
  const closings = useQuery({ queryKey: ["cash_closings"], queryFn: listCashClosings });
  const closingAlert = (() => {
    if (!closings.data) return null;
    const lastMonth = addMonths(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      -1,
    );
    const reopened = closings.data.find((c) => c.status === "reaberto");
    if (reopened)
      return `O caixa de ${monthLabel(reopened.month.slice(0, 7))} foi reaberto e precisa ser fechado de novo.`;
    const next = nextMonthToClose(closings.data);
    if (!next) return "Nenhum mês com caixa fechado ainda. Faça o primeiro fechamento.";
    if (next > lastMonth) return null;
    return `O caixa de ${monthLabel(next)} ainda não foi fechado.`;
  })();
  const [saleOpen, setSaleOpen] = useState(false);
  const monthTx = (tx.data ?? []).filter((t) => {
    const d = new Date(`${t.occurred_on}T12:00:00`);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = monthTx.filter((t) => t.kind === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx.filter((t) => t.kind === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const balance = (tx.data ?? []).reduce(
    (s, t) => s + (t.kind === "entrada" ? Number(t.amount) : -Number(t.amount)),
    0,
  );

  const pending = (quotes.data ?? []).filter((q) =>
    ["rascunho", "enviado", "aprovado", "em_producao"].includes(q.status),
  );
  const lowStock = (materials.data ?? []).filter(
    (m) => stockStatus(Number(m.quantity), Number(m.min_quantity)) !== "ok",
  );

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const rows = (tx.data ?? []).filter((t) => {
      const td = new Date(`${t.occurred_on}T12:00:00`);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    return {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      entradas: rows.filter((r) => r.kind === "entrada").reduce((s, r) => s + Number(r.amount), 0),
      saidas: rows.filter((r) => r.kind === "saida").reduce((s, r) => s + Number(r.amount), 0),
    };
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Visão geral de ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setSaleOpen(true)} className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Nova venda
            </Button>
            <Button asChild>
              <Link to="/orcamentos">Novo orçamento</Link>
            </Button>
          </>
        }
      />

      {closingAlert && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-center gap-2 text-sm">
            <Vault className="h-4 w-4 text-amber-600" />
            {closingAlert}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/caixa">Ir para o fechamento</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="Saldo em caixa"
          value={brl(balance)}
          hint={`${customers.data?.length ?? 0} clientes cadastrados`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Entradas do mês"
          value={brl(income)}
          hint="Recebimentos confirmados"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <StatCard
          label="Saídas do mês"
          value={brl(expense)}
          hint={`Lucro: ${brl(income - expense)}`}
          icon={<ArrowDownRight className="h-4 w-4" />}
        />
        <StatCard
          label="Orçamentos em aberto"
          value={String(pending.length)}
          hint={brl(pending.reduce((s, q) => s + Number(q.total), 0))}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Entradas x saídas (6 meses)</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="entradas" radius={[6, 6, 0, 0]} fill="var(--brand)" />
                <Bar dataKey="saidas" radius={[6, 6, 0, 0]} fill="var(--brand-2)">
                  {chartData.map((_, i) => (
                    <Cell key={i} fillOpacity={0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-[var(--warning)]" /> Estoque em alerta
          </h2>
          <div className="mt-3 space-y-2">
            {lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground">Todo o estoque está acima do mínimo.</p>
            )}
            {lowStock.slice(0, 6).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <span className="truncate">
                  {materialLabel(m)}
                </span>
                <Badge variant={Number(m.quantity) <= 0 ? "destructive" : "secondary"}>
                  {num(Number(m.quantity))} {m.unit}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Orçamentos pendentes</h2>
          <div className="mt-3 space-y-2">
            {pending.length === 0 && <EmptyState message="Nenhum orçamento em aberto." />}
            {pending.slice(0, 5).map((q) => (
              <Link
                key={q.id}
                to="/orcamentos/$quoteId"
                params={{ quoteId: q.id }}
                className="flex items-center justify-between rounded-lg border p-2 text-sm hover:bg-accent"
              >
                <span className="truncate">{q.title}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{QUOTE_STATUS_LABEL[q.status]}</Badge>
                  <span className="font-medium">{brl(Number(q.total))}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Últimas peças cadastradas</h2>
          <div className="mt-3 space-y-2">
            {(parts.data ?? []).length === 0 && <EmptyState message="Nenhuma peça no catálogo." />}
            {(parts.data ?? []).slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground">{dateBR(p.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SaleFormModal open={saleOpen} onOpenChange={setSaleOpen} />
    </div>
  );
}
