// DRE (Demonstração do Resultado do Exercício) — cálculo puro, sem UI.
// Adaptado do módulo da StarGYN para os dados deste painel:
//   - receitas: vendas (módulo Vendas) + entradas avulsas do Financeiro
//   - custo: custo de produção das peças vendidas (sales.cost_total)
//   - despesas: saídas do Financeiro, agrupadas por categoria
import type { Sale, SaleItem, Transaction } from "@/lib/db";
import { PARTNER_CATEGORIES } from "@/lib/domain";

export type Regime = "competencia" | "caixa";

/** Período com datas ISO (YYYY-MM-DD), ambos inclusivos. */
export type Periodo = { inicio: string; fim: string };

export type DREDetail = { descricao: string; valor: number; data: string; meta?: string };

export type DRERowKind = "receita" | "deducao" | "custo" | "despesa" | "subtotal" | "resultado";

export type DRERow = {
  id: string;
  label: string;
  value: number;
  kind: DRERowKind;
  level: 0 | 1;
  emphasis?: boolean;
  hint?: string;
  detail?: DREDetail[];
};

export type DREResult = {
  regime: Regime;
  receitaBruta: number;
  receitaLiquida: number;
  lucroBruto: number;
  despesasOperacionais: number;
  resultadoLiquido: number;
  kpis: {
    margemBruta: number;
    margemLiquida: number;
    /** Despesas operacionais sobre a receita líquida. */
    pesoDespesas: number;
    /** % do faturado no período (competência) que ainda está pendente. */
    pendente: number;
  };
  rows: DRERow[];
};

export type DREInput = {
  sales: Sale[];
  saleItems: SaleItem[];
  transactions: Transaction[];
  customerName?: (id: string | null) => string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const within = (date: string | null | undefined, p: Periodo) =>
  !!date && date.slice(0, 10) >= p.inicio && date.slice(0, 10) <= p.fim;
const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

export const INCOME_LABEL: Record<string, string> = {
  venda: "Vendas lançadas no financeiro",
  servico: "Serviços",
  outros: "Outras receitas",
};

/** Despesas operacionais (saídas do financeiro que não são custo nem imposto). */
const OPEX = [
  { category: "energia", label: "Energia" },
  { category: "manutencao", label: "Manutenção" },
  { category: "outros", label: "Outras despesas" },
] as const;

export function calcularDRE(input: DREInput, regime: Regime, periodo: Periodo): DREResult {
  const { sales, saleItems, transactions } = input;
  const nameOf = (s: Sale) =>
    input.customerName?.(s.customer_id) ?? s.guest_name ?? "Consumidor final";

  const tx = transactions.filter((t) => within(t.occurred_on, periodo));
  const entradas = tx.filter((t) => t.kind === "entrada");
  const saidas = tx.filter((t) => t.kind === "saida");
  const saidasDe = (cat: string) => saidas.filter((t) => t.category === cat);
  const txDetail = (arr: Transaction[]): DREDetail[] =>
    arr.map((t) => ({ descricao: t.description, valor: Number(t.amount), data: t.occurred_on }));

  // --- Receita de vendas ---
  const grossBySale = new Map<string, number>();
  saleItems.forEach((i) =>
    grossBySale.set(
      i.sale_id,
      (grossBySale.get(i.sale_id) ?? 0) + Number(i.quantity) * Number(i.unit_price),
    ),
  );
  const saleGross = (s: Sale) => grossBySale.get(s.id) ?? Number(s.total) + Number(s.discount ?? 0);

  const closedInPeriod = sales.filter(
    (s) => s.status !== "cancelado" && within(s.sale_date, periodo),
  );

  let recVendas: number;
  let vendasDetail: DREDetail[];
  let descontos = 0;
  let descontosDetail: DREDetail[] = [];
  let cmv: number;
  let cmvDetail: DREDetail[];
  let cmvHint: string | undefined;

  if (regime === "competencia") {
    recVendas = sum(closedInPeriod, saleGross);
    vendasDetail = closedInPeriod.map((s) => ({
      descricao: `Venda · ${nameOf(s)}`,
      valor: saleGross(s),
      data: s.sale_date,
      meta: s.status === "pago" ? "pago" : "pendente",
    }));
    const comDesconto = closedInPeriod.filter((s) => Number(s.discount) > 0);
    descontos = sum(comDesconto, (s) => Number(s.discount));
    descontosDetail = comDesconto.map((s) => ({
      descricao: `Desconto · ${nameOf(s)}`,
      valor: Number(s.discount),
      data: s.sale_date,
    }));
    cmv = sum(closedInPeriod, (s) => Number(s.cost_total));
    cmvDetail = closedInPeriod
      .filter((s) => Number(s.cost_total) > 0)
      .map((s) => ({
        descricao: `Custo de produção · ${nameOf(s)}`,
        valor: Number(s.cost_total),
        data: s.sale_date,
      }));
    const compras = sum(saidasDe("material"), (t) => Number(t.amount));
    if (compras > 0)
      cmvHint = `Compras de material no período (${compras.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) vão para o estoque e não entram aqui`;
  } else {
    // Caixa: o que efetivamente entrou pelas vendas pagas (já líquido de desconto)
    const recebidas = entradas.filter((t) => t.sale_id);
    recVendas = sum(recebidas, (t) => Number(t.amount));
    vendasDetail = txDetail(recebidas);
    const material = saidasDe("material");
    cmv = sum(material, (t) => Number(t.amount));
    cmvDetail = txDetail(material);
    cmvHint = "No regime de caixa o custo é o que foi pago em material no período";
  }

  // --- Outras receitas (entradas do financeiro sem venda vinculada) ---
  const avulsas = entradas.filter((t) => !t.sale_id);
  const avulsasPorCat = Object.keys(INCOME_LABEL).map((cat) => {
    const arr = avulsas.filter((t) =>
      cat === "outros" ? !["venda", "servico"].includes(t.category) : t.category === cat,
    );
    return { cat, arr, valor: sum(arr, (t) => Number(t.amount)) };
  });
  const recAvulsas = sum(avulsasPorCat, (c) => c.valor);

  const receitaBruta = recVendas + recAvulsas;

  // Custo lançado pelo orçamento (valor venal das peças) também é custo do que foi vendido
  const custoOrcamentos = saidasDe("custo");
  cmv += sum(custoOrcamentos, (t) => Number(t.amount));
  cmvDetail = [...cmvDetail, ...txDetail(custoOrcamentos)];

  // --- Deduções ---
  const impostos = sum(saidasDe("impostos"), (t) => Number(t.amount));
  const deducoes = descontos + impostos;
  const receitaLiquida = receitaBruta - deducoes;
  const lucroBruto = receitaLiquida - cmv;

  // --- Despesas operacionais ---
  const opex = OPEX.map((o) => {
    const arr = saidasDe(o.category);
    return { ...o, arr, valor: sum(arr, (t) => Number(t.amount)) };
  });
  // categorias de saída desconhecidas entram em "Outras despesas"
  const known = [
    "material",
    "impostos",
    "custo",
    "investimento",
    ...PARTNER_CATEGORIES,
    ...OPEX.map((o) => o.category),
  ];
  const desconhecidas = saidas.filter((t) => !known.includes(t.category));
  const outras = opex.find((o) => o.category === "outros")!;
  outras.arr = [...outras.arr, ...desconhecidas];
  outras.valor += sum(desconhecidas, (t) => Number(t.amount));

  const despesasOperacionais = sum(opex, (o) => o.valor);
  const resultadoLiquido = lucroBruto - despesasOperacionais;

  // --- Abaixo do resultado: não são despesa da empresa ---
  const paraSocios = saidas.filter((t) => PARTNER_CATEGORIES.includes(t.category));
  const investimentos = saidasDe("investimento");
  const valorSocios = sum(paraSocios, (t) => Number(t.amount));
  const valorInvestimentos = sum(investimentos, (t) => Number(t.amount));

  // --- KPIs ---
  const faturado = sum(closedInPeriod, (s) => Number(s.total));
  const pendenteValor = sum(
    closedInPeriod.filter((s) => s.status === "pendente"),
    (s) => Number(s.total),
  );

  const rows: DRERow[] = [
    {
      id: "receita-bruta",
      label: "Receita Bruta",
      value: receitaBruta,
      kind: "subtotal",
      level: 0,
      emphasis: true,
    },
    {
      id: "rec-vendas",
      label: regime === "competencia" ? "Vendas de peças" : "Vendas recebidas",
      value: recVendas,
      kind: "receita",
      level: 1,
      detail: vendasDetail,
    },
    ...avulsasPorCat.map<DRERow>((c) => ({
      id: `rec-${c.cat}`,
      label: INCOME_LABEL[c.cat],
      value: c.valor,
      kind: "receita",
      level: 1,
      detail: txDetail(c.arr),
    })),
    { id: "deducoes", label: "(-) Deduções", value: -deducoes, kind: "deducao", level: 0 },
    {
      id: "descontos",
      label: "Descontos concedidos",
      value: -descontos,
      kind: "deducao",
      level: 1,
      detail: descontosDetail,
    },
    {
      id: "impostos",
      label: "Impostos sobre vendas",
      value: -impostos,
      kind: "deducao",
      level: 1,
      detail: txDetail(saidasDe("impostos")),
    },
    {
      id: "receita-liquida",
      label: "= Receita Líquida",
      value: receitaLiquida,
      kind: "subtotal",
      level: 0,
      emphasis: true,
    },
    {
      id: "cmv",
      label:
        regime === "competencia"
          ? "(-) Custo de produção das peças vendidas (CPV)"
          : "(-) Compras de material",
      value: -cmv,
      kind: "custo",
      level: 0,
      hint: cmvHint,
      detail: cmvDetail,
    },
    {
      id: "lucro-bruto",
      label: "= Lucro Bruto",
      value: lucroBruto,
      kind: "subtotal",
      level: 0,
      emphasis: true,
    },
    {
      id: "desp-op",
      label: "(-) Despesas Operacionais",
      value: -despesasOperacionais,
      kind: "despesa",
      level: 0,
    },
    ...opex.map<DRERow>((o) => ({
      id: `desp-${o.category}`,
      label: o.label,
      value: -o.valor,
      kind: "despesa",
      level: 1,
      detail: txDetail(o.arr),
    })),
    {
      id: "resultado-liquido",
      label: "= Resultado Líquido do Período",
      value: resultadoLiquido,
      kind: "resultado",
      level: 0,
      emphasis: true,
    },
    ...(valorSocios || valorInvestimentos
      ? ([
          {
            id: "socios",
            label: "(-) Distribuição e retiradas dos sócios",
            value: -valorSocios,
            kind: "despesa",
            level: 1,
            hint: "Não é despesa da empresa: é a parte do resultado entregue aos sócios",
            detail: txDetail(paraSocios),
          },
          {
            id: "investimentos",
            label: "(-) Investimentos em equipamentos",
            value: -valorInvestimentos,
            kind: "despesa",
            level: 1,
            hint: "Compra de bens duráveis, não entra no resultado",
            detail: txDetail(investimentos),
          },
          {
            id: "saldo-retido",
            label: "= Saldo retido na empresa",
            value: resultadoLiquido - valorSocios - valorInvestimentos,
            kind: "subtotal",
            level: 0,
            emphasis: true,
          },
        ] satisfies DRERow[])
      : []),
  ];

  return {
    regime,
    receitaBruta: round2(receitaBruta),
    receitaLiquida: round2(receitaLiquida),
    lucroBruto: round2(lucroBruto),
    despesasOperacionais: round2(despesasOperacionais),
    resultadoLiquido: round2(resultadoLiquido),
    kpis: {
      margemBruta: pct(lucroBruto, receitaLiquida),
      margemLiquida: pct(resultadoLiquido, receitaLiquida),
      pesoDespesas: pct(despesasOperacionais, receitaLiquida),
      pendente: pct(pendenteValor, faturado),
    },
    rows,
  };
}

// ---------------------------------------------------------------------------
// Contas a receber: vendas pendentes, por tempo desde a venda
// ---------------------------------------------------------------------------

export type AgingFaixa = { label: string; valor: number; quantidade: number };
export type ContasAReceber = { total: number; faixas: AgingFaixa[] };

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.floor(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from.slice(0, 10)}T12:00:00`).getTime()) /
      DAY,
  );

export function calcularContasAReceber(sales: Sale[], ref: string): ContasAReceber {
  const faixas: AgingFaixa[] = [
    { label: "Até 30 dias", valor: 0, quantidade: 0 },
    { label: "31 a 60 dias", valor: 0, quantidade: 0 },
    { label: "61 a 90 dias", valor: 0, quantidade: 0 },
    { label: "Mais de 90 dias", valor: 0, quantidade: 0 },
  ];
  for (const s of sales) {
    if (s.status !== "pendente" || s.sale_date > ref) continue;
    const dias = daysBetween(s.sale_date, ref);
    const f = faixas[dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : 3];
    f.valor += Number(s.total);
    f.quantidade += 1;
  }
  return { total: sum(faixas, (f) => f.valor), faixas };
}

// ---------------------------------------------------------------------------
// Períodos e série mensal
// ---------------------------------------------------------------------------

export type PeriodoPreset = "mes" | "mes_passado" | "trimestre" | "ano" | "custom";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function periodoFromPreset(
  preset: Exclude<PeriodoPreset, "custom">,
  ref = new Date(),
): Periodo {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (preset === "mes") return { inicio: iso(new Date(y, m, 1)), fim: iso(new Date(y, m + 1, 0)) };
  if (preset === "mes_passado")
    return { inicio: iso(new Date(y, m - 1, 1)), fim: iso(new Date(y, m, 0)) };
  if (preset === "trimestre") {
    const q = Math.floor(m / 3) * 3;
    return { inicio: iso(new Date(y, q, 1)), fim: iso(new Date(y, q + 3, 0)) };
  }
  return { inicio: iso(new Date(y, 0, 1)), fim: iso(new Date(y, 11, 31)) };
}

/** Período imediatamente anterior, com a mesma duração (meses inteiros quando possível). */
export function periodoAnterior(p: Periodo): Periodo {
  const ini = new Date(`${p.inicio}T12:00:00`);
  const fim = new Date(`${p.fim}T12:00:00`);
  const isMonthStart = ini.getDate() === 1;
  const isMonthEnd = new Date(fim.getFullYear(), fim.getMonth() + 1, 0).getDate() === fim.getDate();
  if (isMonthStart && isMonthEnd) {
    const months =
      (fim.getFullYear() - ini.getFullYear()) * 12 + fim.getMonth() - ini.getMonth() + 1;
    return {
      inicio: iso(new Date(ini.getFullYear(), ini.getMonth() - months, 1)),
      fim: iso(new Date(ini.getFullYear(), ini.getMonth(), 0)),
    };
  }
  const dias = Math.round((fim.getTime() - ini.getTime()) / DAY) + 1;
  const novoFim = new Date(ini.getTime() - DAY);
  return { inicio: iso(new Date(novoFim.getTime() - (dias - 1) * DAY)), fim: iso(novoFim) };
}

export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return round2(((atual - anterior) / Math.abs(anterior)) * 100);
}

export type DREMonthlyPoint = {
  mes: string;
  receitaLiquida: number;
  lucroBruto: number;
  resultadoLiquido: number;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function calcularSerieMensal(
  input: DREInput,
  regime: Regime,
  numMeses: number,
  ref = new Date(),
): DREMonthlyPoint[] {
  const out: DREMonthlyPoint[] = [];
  for (let i = numMeses - 1; i >= 0; i--) {
    const base = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const periodo = periodoFromPreset("mes", base);
    const dre = calcularDRE(input, regime, periodo);
    out.push({
      mes: `${MESES[base.getMonth()]}/${String(base.getFullYear()).slice(2)}`,
      receitaLiquida: dre.receitaLiquida,
      lucroBruto: dre.lucroBruto,
      resultadoLiquido: dre.resultadoLiquido,
    });
  }
  return out;
}
