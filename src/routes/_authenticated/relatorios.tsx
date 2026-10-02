import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { PrintHeader } from "@/components/PrintHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listCustomers,
  listMaterials,
  listParts,
  listQuoteItems,
  listQuotes,
  listTransactions,
} from "@/lib/db";
import { brl, dateBR, downloadCSV, minutesToHuman, monthRange, num } from "@/lib/format";
import { QUOTE_STATUS_LABEL } from "@/lib/domain";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: pageTitle("Relatórios") },
      {
        name: "description",
        content: "Faturamento, clientes que mais compram, materiais consumidos e taxa de conversão.",
      },
    ],
  }),
  component: RelatoriosPage,
});

const PIE_COLORS = ["#4B4BFF", "#7A4BFF", "#9B4DFF", "#B984FF", "#5F8BFF", "#C7B3FF"];

function RelatoriosPage() {
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("quarter");
  const { start, end } = monthRange(period);

  const tx = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: listQuotes });
  const items = useQuery({ queryKey: ["quote_items"], queryFn: () => listQuoteItems() });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });

  const txPeriod = (tx.data ?? []).filter((t) => t.occurred_on >= start && t.occurred_on <= end);
  const income = txPeriod.filter((t) => t.kind === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const expense = txPeriod.filter((t) => t.kind === "saida").reduce((s, t) => s + Number(t.amount), 0);

  const quotesPeriod = (quotes.data ?? []).filter(
    (q) => q.created_at.slice(0, 10) >= start && q.created_at.slice(0, 10) <= end,
  );
  const won = quotesPeriod.filter((q) => ["aprovado", "em_producao", "concluido"].includes(q.status));
  const conversion = quotesPeriod.length ? (won.length / quotesPeriod.length) * 100 : 0;
  const ticket = won.length ? won.reduce((s, q) => s + Number(q.total), 0) / won.length : 0;

  const revenueByMonth = (() => {
    const map = new Map<string, { mes: string; entradas: number; saidas: number }>();
    for (const t of txPeriod) {
      const key = t.occurred_on.slice(0, 7);
      const row = map.get(key) ?? { mes: key.split("-").reverse().join("/"), entradas: 0, saidas: 0 };
      if (t.kind === "entrada") row.entradas += Number(t.amount);
      else row.saidas += Number(t.amount);
      map.set(key, row);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  })();

  const topCustomers = (customers.data ?? [])
    .map((c) => {
      const total = (quotes.data ?? [])
        .filter((q) => q.customer_id === c.id && q.status === "concluido")
        .reduce((s, q) => s + Number(q.total), 0);
      const count = (quotes.data ?? []).filter((q) => q.customer_id === c.id).length;
      return { name: c.name, total, count };
    })
    .filter((c) => c.total > 0 || c.count > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const statusPie = Object.entries(
    quotesPeriod.reduce<Record<string, number>>((acc, q) => {
      acc[q.status] = (acc[q.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([status, value]) => ({ name: QUOTE_STATUS_LABEL[status] ?? status, value }));

  const materialUse = (materials.data ?? [])
    .map((m) => {
      const used = (items.data ?? []).filter((i) => i.material_id === m.id).length;
      return { name: m.name, usos: used, estoque: Number(m.quantity) };
    })
    .filter((m) => m.usos > 0)
    .sort((a, b) => b.usos - a.usos)
    .slice(0, 8);

  const printTime = (items.data ?? []).reduce(
    (s, i) => s + Number(i.print_minutes) * Number(i.quantity),
    0,
  );

  const wonQuoteIds = new Set(won.map((q) => q.id));
  const soldItems = (items.data ?? []).filter((i) => wonQuoteIds.has(i.quote_id));
  const marginByPart = (() => {
    const map = new Map<
      string,
      { name: string; qtd: number; receita: number; venal: number; margem: number }
    >();
    for (const i of soldItems) {
      const part = i.part_id ? parts.data?.find((p) => p.id === i.part_id) : undefined;
      const key = part?.id ?? `avulso:${i.description}`;
      const name = part?.name ?? i.description;
      const qtd = Number(i.quantity);
      const receita = Number(i.unit_price) * qtd;
      const venal = (part ? Number(part.sale_price) : Number(i.unit_price)) * qtd;
      const row = map.get(key) ?? { name, qtd: 0, receita: 0, venal: 0, margem: 0 };
      row.qtd += qtd;
      row.receita += receita;
      row.venal += venal;
      row.margem = row.receita - row.venal;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.receita - a.receita);
  })();
  const totalReceitaPecas = marginByPart.reduce((s, r) => s + r.receita, 0);
  const totalVenal = marginByPart.reduce((s, r) => s + r.venal, 0);
  const totalMargem = totalReceitaPecas - totalVenal;


  const exportFinance = () =>
    downloadCSV(
      `financeiro-${start}-${end}.csv`,
      txPeriod.map((t) => ({
        data: dateBR(t.occurred_on),
        tipo: t.kind,
        categoria: t.category,
        descricao: t.description,
        valor: Number(t.amount),
      })),
    );

  const exportQuotes = () =>
    downloadCSV(
      `orcamentos-${start}-${end}.csv`,
      quotesPeriod.map((q) => ({
        titulo: q.title,
        cliente: customers.data?.find((c) => c.id === q.customer_id)?.name ?? "",
        status: QUOTE_STATUS_LABEL[q.status] ?? q.status,
        total: Number(q.total),
        criado_em: dateBR(q.created_at),
      })),
    );

  const exportMargin = () =>
    downloadCSV(
      `margem-por-peca-${start}-${end}.csv`,
      marginByPart.map((r) => ({
        peca: r.name,
        quantidade: r.qtd,
        receita: r.receita,
        valor_venal: r.venal,
        margem: r.margem,
        margem_pct: r.receita ? Number(((r.margem / r.receita) * 100).toFixed(2)) : 0,
      })),
    );

  const periodLabel =
    period === "month" ? "Este mês" : period === "quarter" ? "Trimestre atual" : "Ano atual";

  return (
    <div className="print:p-6">
      <PrintHeader subtitle="Relatório gerencial" meta={periodLabel} />
      <div className="print:hidden">
      <PageHeader
        title="Relatórios"
        description="A leitura do negócio: faturamento, conversão e consumo."
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
            <Button variant="outline" onClick={exportFinance}>
              <Download className="h-4 w-4" /> CSV financeiro
            </Button>
            <Button variant="outline" onClick={exportQuotes}>
              <Download className="h-4 w-4" /> CSV orçamentos
            </Button>
            <Button variant="outline" onClick={exportMargin}>
              <Download className="h-4 w-4" /> CSV margem por peça
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <FileDown className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </>
        }
      />
      </div>



      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard accent label="Faturamento" value={brl(income)} hint={`Lucro ${brl(income - expense)}`} />
        <StatCard label="Taxa de conversão" value={`${num(conversion, 1)}%`} hint={`${won.length} de ${quotesPeriod.length} orçamentos`} />
        <StatCard label="Ticket médio" value={brl(ticket)} />
        <StatCard label="Horas de impressão" value={minutesToHuman(printTime)} hint="Todos os itens orçados" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Entradas x saídas por mês</h2>
          <div className="mt-4 h-64">
            {revenueByMonth.length === 0 ? (
              <EmptyState message="Sem movimentações no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                  <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                  <Bar dataKey="entradas" name="Entradas" fill="var(--brand)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="var(--brand-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Orçamentos por status</h2>
          <div className="mt-4 h-64">
            {statusPie.length === 0 ? (
              <EmptyState message="Sem orçamentos no período." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {statusPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">Clientes que mais compram</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Orçamentos</TableHead>
                <TableHead className="text-right">Concluído</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomers.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right font-medium">{brl(c.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {topCustomers.length === 0 && <EmptyState message="Ainda sem histórico de clientes." />}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Materiais mais utilizados</h2>
          <div className="mt-4 h-64">
            {materialUse.length === 0 ? (
              <EmptyState message="Nenhum material vinculado a itens ainda." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialUse} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" width={110} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="usos" name="Itens orçados" fill="var(--brand)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Margem por peça</h2>
            <p className="text-xs text-muted-foreground">
              Receita das peças vendidas menos o valor venal cadastrado.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-right text-xs">
            <div>
              <div className="text-muted-foreground">Receita</div>
              <div className="text-sm font-semibold">{brl(totalReceitaPecas)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Valor venal</div>
              <div className="text-sm font-semibold">{brl(totalVenal)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Margem</div>
              <div
                className={`text-sm font-semibold ${
                  totalMargem >= 0 ? "text-[var(--success)]" : "text-destructive"
                }`}
              >
                {brl(totalMargem)}
                {totalReceitaPecas ? ` (${num((totalMargem / totalReceitaPecas) * 100, 1)}%)` : ""}
              </div>
            </div>
          </div>
        </div>
        {marginByPart.length === 0 ? (
          <EmptyState message="Sem peças vendidas no período." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peça</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Valor venal</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marginByPart.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{num(r.qtd, 0)}</TableCell>
                  <TableCell className="text-right">{brl(r.receita)}</TableCell>
                  <TableCell className="text-right">{brl(r.venal)}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      r.margem >= 0 ? "text-[var(--success)]" : "text-destructive"
                    }`}
                  >
                    {brl(r.margem)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.receita ? `${num((r.margem / r.receita) * 100, 1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
