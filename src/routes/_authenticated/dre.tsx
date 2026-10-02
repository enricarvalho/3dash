import { Fragment, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  Gauge,
  Minus,
  Percent,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listCustomers, listSaleItems, listSales, listTransactions } from "@/lib/db";
import {
  calcularContasAReceber,
  calcularDRE,
  calcularSerieMensal,
  periodoAnterior,
  periodoFromPreset,
  variacaoPercentual,
  type DRERow,
  type Periodo,
  type PeriodoPreset,
  type Regime,
} from "@/lib/dre";
import { downloadDrePdf } from "@/lib/dre-pdf";
import { brl, dateBR, downloadCSV, num } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({
    meta: [
      { title: "DRE · 3D Create" },
      {
        name: "description",
        content: "Demonstração do resultado: receitas, custos, despesas e lucro do período.",
      },
    ],
  }),
  component: DrePage,
});

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function labelPeriodo(preset: PeriodoPreset, p: Periodo) {
  const ini = new Date(`${p.inicio}T12:00:00`);
  if (preset === "mes" || preset === "mes_passado")
    return `${MESES[ini.getMonth()]} de ${ini.getFullYear()}`;
  if (preset === "trimestre")
    return `${Math.floor(ini.getMonth() / 3) + 1}º trimestre de ${ini.getFullYear()}`;
  if (preset === "ano") return `Ano de ${ini.getFullYear()}`;
  return `${dateBR(p.inicio)} a ${dateBR(p.fim)}`;
}

function valueColor(row: DRERow) {
  if (row.kind === "resultado" || row.kind === "subtotal")
    return row.value < 0 ? "text-destructive" : row.kind === "resultado" ? "text-emerald-600" : "";
  if (row.value === 0) return "text-muted-foreground";
  return row.kind === "receita" ? "text-emerald-600/90" : "text-destructive/90";
}

function Variacao({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground/60">—</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs tabular-nums",
        value === 0 ? "text-muted-foreground" : good ? "text-emerald-600" : "text-destructive",
      )}
    >
      <Icon className="h-3 w-3" />
      {num(Math.abs(value), 1)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  prev,
  icon,
  invert,
}: {
  label: string;
  value: number;
  prev: number;
  icon: ReactNode;
  invert?: boolean;
}) {
  const diff = value - prev;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{num(value, 1)}%</p>
      {diff !== 0 && (
        <p className={cn("mt-1 text-xs", good ? "text-emerald-600" : "text-destructive")}>
          {diff > 0 ? "+" : "−"}
          {num(Math.abs(diff), 1)} p.p. vs período anterior
        </p>
      )}
    </div>
  );
}

const SegButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {children}
  </button>
);

function DrePage() {
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const saleItems = useQuery({ queryKey: ["sale_items"], queryFn: () => listSaleItems() });
  const tx = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const [regime, setRegime] = useState<Regime>("competencia");
  const [preset, setPreset] = useState<PeriodoPreset>("mes");
  const [customInicio, setCustomInicio] = useState(() => periodoFromPreset("mes").inicio);
  const [customFim, setCustomFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const periodo = useMemo<Periodo>(
    () =>
      preset === "custom" ? { inicio: customInicio, fim: customFim } : periodoFromPreset(preset),
    [preset, customInicio, customFim],
  );
  const periodoAnt = useMemo(() => periodoAnterior(periodo), [periodo]);

  const input = useMemo(() => {
    const names = new Map((customers.data ?? []).map((c) => [c.id, c.name]));
    return {
      sales: sales.data ?? [],
      saleItems: saleItems.data ?? [],
      transactions: tx.data ?? [],
      customerName: (id: string | null) => (id ? (names.get(id) ?? null) : null),
    };
  }, [sales.data, saleItems.data, tx.data, customers.data]);

  const result = useMemo(() => calcularDRE(input, regime, periodo), [input, regime, periodo]);
  const anterior = useMemo(
    () => calcularDRE(input, regime, periodoAnt),
    [input, regime, periodoAnt],
  );
  const contas = useMemo(
    () => calcularContasAReceber(input.sales, periodo.fim),
    [input.sales, periodo.fim],
  );
  const serie = useMemo(() => calcularSerieMensal(input, regime, 6), [input, regime]);

  const prevById = new Map(anterior.rows.map((r) => [r.id, r.value]));
  const periodoLabel = labelPeriodo(preset, periodo);
  const loading = sales.isLoading || saleItems.isLoading || tx.isLoading;
  const semDados = result.rows.every((r) => r.value === 0);
  const maxFaixa = Math.max(1, ...contas.faixas.map((f) => f.valor));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () =>
    downloadCSV(
      `dre-${periodo.inicio}-${periodo.fim}-${regime}.csv`,
      result.rows.map((r) => ({
        Conta: r.label,
        Valor: num(r.value),
        "Período anterior": num(prevById.get(r.id) ?? 0),
      })),
    );

  return (
    <div>
      <PageHeader
        title="DRE"
        description={`Demonstração do resultado · ${periodoLabel}`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={semDados}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="outline"
              disabled={semDados}
              onClick={() => downloadDrePdf({ result, anterior, contas, serie, periodoLabel })}
            >
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          <SegButton active={regime === "competencia"} onClick={() => setRegime("competencia")}>
            <Scale className="h-3.5 w-3.5" /> Competência
          </SegButton>
          <SegButton active={regime === "caixa"} onClick={() => setRegime("caixa")}>
            <Banknote className="h-3.5 w-3.5" /> Caixa
          </SegButton>
        </div>
        <Select value={preset} onValueChange={(v) => setPreset(v as PeriodoPreset)}>
          <SelectTrigger className="w-48" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Mês atual</SelectItem>
            <SelectItem value="mes_passado">Mês passado</SelectItem>
            <SelectItem value="trimestre">Trimestre atual</SelectItem>
            <SelectItem value="ano">Ano atual</SelectItem>
            <SelectItem value="custom">Período personalizado</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <>
            <Input
              type="date"
              value={customInicio}
              onChange={(e) => setCustomInicio(e.target.value)}
              className="w-40"
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={customFim}
              onChange={(e) => setCustomFim(e.target.value)}
              className="w-40"
              aria-label="Data final"
            />
          </>
        )}
        <span className="text-xs text-muted-foreground">
          {regime === "competencia"
            ? "Receitas e custos pela data da venda, pagas ou não."
            : "Somente o que entrou e saiu do caixa no período."}
        </span>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Margem bruta"
          value={result.kpis.margemBruta}
          prev={anterior.kpis.margemBruta}
          icon={<Percent className="h-4 w-4" />}
        />
        <KpiCard
          label="Margem líquida"
          value={result.kpis.margemLiquida}
          prev={anterior.kpis.margemLiquida}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          label="Peso das despesas"
          value={result.kpis.pesoDespesas}
          prev={anterior.kpis.pesoDespesas}
          icon={<Gauge className="h-4 w-4" />}
          invert
        />
        <KpiCard
          label="Vendas pendentes"
          value={result.kpis.pendente}
          prev={anterior.kpis.pendente}
          icon={<AlertTriangle className="h-4 w-4" />}
          invert
        />
      </div>

      {loading ? (
        <EmptyState message="Carregando dados financeiros..." />
      ) : semDados ? (
        <EmptyState message="Nenhuma venda ou lançamento neste período. Ajuste o período ou o regime." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card lg:col-span-2">
              <div className="flex items-baseline justify-between p-4">
                <h2 className="text-sm font-semibold">Demonstração do resultado</h2>
                <span className="text-xs text-muted-foreground">
                  Regime de {regime === "competencia" ? "competência" : "caixa"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Conta</th>
                      <th className="px-4 py-2 text-right font-medium">Valor</th>
                      <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                        Anterior
                      </th>
                      <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                        Var.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => {
                      const expandable = !!row.detail?.length;
                      const open = expanded.has(row.id);
                      const prev = prevById.get(row.id) ?? 0;
                      const invert =
                        row.kind !== "receita" &&
                        row.kind !== "subtotal" &&
                        row.kind !== "resultado";
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className={cn(
                              "border-b border-border/50",
                              row.emphasis && "bg-muted/40",
                              row.kind === "resultado" && "bg-primary/5",
                              expandable && "cursor-pointer hover:bg-muted/30",
                            )}
                            onClick={() => expandable && toggle(row.id)}
                            onKeyDown={(e) => expandable && e.key === "Enter" && toggle(row.id)}
                            tabIndex={expandable ? 0 : undefined}
                            aria-expanded={expandable ? open : undefined}
                          >
                            <td className={cn("px-4 py-2", row.level === 1 && "pl-9")}>
                              <span
                                className={cn(
                                  "flex items-center gap-1.5",
                                  row.emphasis ? "font-semibold" : "text-muted-foreground",
                                )}
                              >
                                {expandable &&
                                  (open ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                  ))}
                                {row.label}
                              </span>
                              {row.hint && (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                                  {row.hint}
                                </span>
                              )}
                            </td>
                            <td
                              className={cn(
                                "whitespace-nowrap px-4 py-2 text-right tabular-nums",
                                row.emphasis ? "font-semibold" : "font-medium",
                                valueColor(row),
                              )}
                            >
                              {brl(row.value)}
                            </td>
                            <td className="hidden whitespace-nowrap px-4 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                              {brl(prev)}
                            </td>
                            <td className="hidden px-4 py-2 text-right sm:table-cell">
                              {/* custos/despesas são negativos: queda no valor absoluto é melhora */}
                              <Variacao
                                value={
                                  invert
                                    ? variacaoPercentual(Math.abs(row.value), Math.abs(prev))
                                    : variacaoPercentual(row.value, prev)
                                }
                                invert={invert}
                              />
                            </td>
                          </tr>
                          {expandable && open && (
                            <tr className="bg-muted/20">
                              <td colSpan={4} className="px-4 py-2">
                                <div className="divide-y rounded-md border bg-background/60">
                                  {row.detail!.map((d, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs"
                                    >
                                      <span className="min-w-0 truncate text-muted-foreground">
                                        {d.descricao}
                                        {d.meta && (
                                          <span className="ml-1.5 text-[10px] text-primary/80">
                                            · {d.meta}
                                          </span>
                                        )}
                                      </span>
                                      <span className="flex shrink-0 items-center gap-3">
                                        <span className="tabular-nums text-muted-foreground/70">
                                          {dateBR(d.data)}
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {brl(d.valor)}
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4 text-muted-foreground" /> Contas a receber
              </h2>
              <p className="mt-1 text-2xl font-bold tabular-nums">{brl(contas.total)}</p>
              <p className="text-xs text-muted-foreground">
                Vendas pendentes até {dateBR(periodo.fim)}, por tempo desde a venda
              </p>
              <div className="mt-4 space-y-3">
                {contas.faixas.map((f, i) => (
                  <div key={f.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {f.label}
                        {f.quantidade > 0 && (
                          <span className="ml-1 opacity-70">({f.quantidade})</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          f.valor === 0
                            ? "text-muted-foreground"
                            : i >= 2
                              ? "text-destructive"
                              : i === 1
                                ? "text-amber-600"
                                : "",
                        )}
                      >
                        {brl(f.valor)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          i >= 2 ? "bg-destructive" : i === 1 ? "bg-amber-500" : "bg-primary",
                        )}
                        style={{ width: `${(f.valor / maxFaixa) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Evolução — últimos 6 meses</h2>
              <span className="text-xs text-muted-foreground">
                Regime de {regime === "competencia" ? "competência" : "caixa"}
              </span>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
                  <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                  <Bar
                    dataKey="receitaLiquida"
                    name="Receita líquida"
                    fill="var(--brand)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="lucroBruto"
                    name="Lucro bruto"
                    fill="var(--brand-2)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="resultadoLiquido"
                    name="Resultado líquido"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Indicador</th>
                    {serie.map((p) => (
                      <th
                        key={p.mes}
                        className="whitespace-nowrap px-3 py-2 text-right font-medium"
                      >
                        {p.mes}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Receita líquida", "receitaLiquida"],
                      ["Lucro bruto", "lucroBruto"],
                      ["Resultado líquido", "resultadoLiquido"],
                    ] as const
                  ).map(([label, key]) => (
                    <tr
                      key={key}
                      className={cn(
                        "border-b border-border/50",
                        key === "resultadoLiquido" && "bg-primary/5 font-semibold",
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{label}</td>
                      {serie.map((p) => (
                        <td
                          key={p.mes}
                          className={cn(
                            "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                            key === "resultadoLiquido" &&
                              (p[key] < 0 ? "text-destructive" : "text-emerald-600"),
                          )}
                        >
                          {brl(p[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
