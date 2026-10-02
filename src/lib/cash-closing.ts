// Fechamento de caixa mensal — cálculo puro, sem UI nem banco.
//
//   Entradas do mês − gastos da empresa = resultado
//   resultado − prejuízo de meses anteriores = base
//   base − reserva = valor a distribuir  → dividido pelo percentual de cada sócio
//   cota − retiradas (dinheiro + peças) − saldo devedor anterior = valor a receber
//
// A conferência compara, por forma de pagamento, o saldo esperado
// (inicial + entradas − saídas − distribuições) com o valor conferido.
import type { Partner, PartnerWithdrawal, Transaction } from "@/lib/db";
import { PARTNER_CATEGORIES, PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { isInKind } from "@/lib/partners";

export type MethodMap = Record<string, number>;

/** Lançamentos sem forma de pagamento ficam neste grupo. */
export const NO_METHOD = "nao_informado";
export const CLOSING_METHODS = [...PAYMENT_METHODS, NO_METHOD] as const;
export const methodLabel = (m: string) =>
  m === NO_METHOD ? "Não informado" : (PAYMENT_METHOD_LABEL[m] ?? m);

const round2 = (n: number) => Math.round(n * 100) / 100;
const add = (map: MethodMap, key: string, v: number) => {
  map[key] = round2((map[key] ?? 0) + v);
};
export const sumMap = (m: MethodMap) => round2(Object.values(m).reduce((s, v) => s + (v || 0), 0));

// ---------------------------------------------------------------------------
// Meses
// ---------------------------------------------------------------------------

/** "2026-09" → { month: "2026-09-01", start, end } */
export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    month: `${ym}-01`,
    start: `${ym}-01`,
    end: `${ym}-${String(last).padStart(2, "0")}`,
  };
}

export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const ymOf = (date: string) => date.slice(0, 7);

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
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} de ${y}`;
};

/** Mês só pode ser fechado depois que terminou. */
export const monthEnded = (ym: string, today: string) => monthRange(ym).end < today;

export type ClosingLike = {
  month: string;
  status: string;
};

/**
 * Próximo mês a fechar: um mês reaberto, senão o seguinte ao último fechado.
 * Sem fechamentos, retorna null (o primeiro mês é escolhido pelo usuário).
 */
export function nextMonthToClose(closings: ClosingLike[]): string | null {
  const reopened = closings.find((c) => c.status === "reaberto");
  if (reopened) return ymOf(reopened.month);
  const closed = closings.filter((c) => c.status === "fechado").map((c) => ymOf(c.month));
  if (!closed.length) return null;
  return addMonths(closed.sort().at(-1)!, 1);
}

// ---------------------------------------------------------------------------
// Movimento do mês
// ---------------------------------------------------------------------------

export type MonthFlows = {
  inflows: MethodMap;
  /** Todas as saídas do mês (inclui retiradas, investimentos e distribuições já lançadas). */
  outflows: MethodMap;
  totalIn: number;
  /** Gastos da empresa: saídas menos o que é dos sócios e o que foi pago com a reserva. */
  companyOut: number;
  /** Investimentos pagos com a reserva no mês. */
  reserveSpent: number;
};

export function monthFlows(transactions: Transaction[], ym: string, closingId?: string | null) {
  const { start, end } = monthRange(ym);
  const flows: MonthFlows = {
    inflows: {},
    outflows: {},
    totalIn: 0,
    companyOut: 0,
    reserveSpent: 0,
  };
  for (const t of transactions) {
    if (t.occurred_on < start || t.occurred_on > end) continue;
    // distribuições geradas pelo próprio fechamento entram à parte, como "payouts"
    if (t.cash_closing_id && t.cash_closing_id === closingId) continue;
    const method = t.payment_method || NO_METHOD;
    const v = Number(t.amount) || 0;
    if (t.kind === "entrada") {
      add(flows.inflows, method, v);
      flows.totalIn += v;
      continue;
    }
    add(flows.outflows, method, v);
    if (t.paid_from_reserve) flows.reserveSpent += v;
    else if (!PARTNER_CATEGORIES.includes(t.category)) flows.companyOut += v;
  }
  flows.totalIn = round2(flows.totalIn);
  flows.companyOut = round2(flows.companyOut);
  flows.reserveSpent = round2(flows.reserveSpent);
  return flows;
}

// ---------------------------------------------------------------------------
// Divisão entre os sócios
// ---------------------------------------------------------------------------

export type PartnerShare = {
  partner_id: string;
  name: string;
  share_pct: number;
  quota: number;
  /** Adiantamentos em dinheiro no mês. */
  cash: number;
  /** Peças/materiais retirados no mês. */
  in_kind: number;
  previous_debt: number;
  /** cota − descontos (pode ser negativo). */
  net: number;
  /** Valor pago ao sócio no fechamento. */
  payout: number;
  /** Saldo devedor levado para o mês seguinte. */
  debt: number;
  payment_method: string;
};

export type Distribution = {
  result: number;
  previousLoss: number;
  base: number;
  reserveAmount: number;
  distributable: number;
  lossCarry: number;
  shares: PartnerShare[];
};

export function computeDistribution(args: {
  result: number;
  previousLoss: number;
  /** Reserva pedida (limitada ao que há para distribuir). */
  reserve: number;
  partners: Partner[];
  withdrawals: PartnerWithdrawal[];
  ym: string;
  previousDebts: Record<string, number>;
  paymentMethods?: Record<string, string>;
}): Distribution {
  const base = round2(args.result - args.previousLoss);
  const reserveAmount = base > 0 ? round2(Math.min(Math.max(args.reserve, 0), base)) : 0;
  const distributable = base > 0 ? round2(base - reserveAmount) : 0;
  const lossCarry = base < 0 ? round2(-base) : 0;

  const { start, end } = monthRange(args.ym);
  const inMonth = args.withdrawals.filter((w) => w.withdrawn_on >= start && w.withdrawn_on <= end);

  // inclui sócios inativos que tenham retiradas ou dívida, com cota zero
  const involved = args.partners.filter(
    (p) =>
      p.active || inMonth.some((w) => w.partner_id === p.id) || (args.previousDebts[p.id] ?? 0) > 0,
  );
  const active = involved.filter((p) => p.active && Number(p.share_pct) > 0);
  let allocated = 0;

  const shares = involved.map<PartnerShare>((p) => {
    const isLastActive = active.length > 0 && p.id === active[active.length - 1].id;
    let quota = 0;
    if (p.active && Number(p.share_pct) > 0) {
      // o último sócio ativo absorve a diferença de centavos do arredondamento
      quota = isLastActive
        ? round2(distributable - allocated)
        : round2((distributable * Number(p.share_pct)) / 100);
      allocated = round2(allocated + quota);
    }
    const mine = inMonth.filter((w) => w.partner_id === p.id);
    const cash = round2(
      mine.filter((w) => !isInKind(w.kind)).reduce((s, w) => s + Number(w.amount), 0),
    );
    const in_kind = round2(
      mine.filter((w) => isInKind(w.kind)).reduce((s, w) => s + Number(w.amount), 0),
    );
    const previous_debt = round2(args.previousDebts[p.id] ?? 0);
    const net = round2(quota - cash - in_kind - previous_debt);
    return {
      partner_id: p.id,
      name: p.name,
      share_pct: Number(p.share_pct),
      quota,
      cash,
      in_kind,
      previous_debt,
      net,
      payout: Math.max(net, 0),
      debt: Math.max(-net, 0),
      payment_method: args.paymentMethods?.[p.id] ?? "pix",
    };
  });

  return {
    result: round2(args.result),
    previousLoss: round2(args.previousLoss),
    base,
    reserveAmount,
    distributable,
    lossCarry,
    shares,
  };
}

// ---------------------------------------------------------------------------
// Conferência por forma de pagamento
// ---------------------------------------------------------------------------

export type MethodCheck = {
  method: string;
  opening: number;
  inflow: number;
  outflow: number;
  payout: number;
  expected: number;
  counted: number;
  difference: number;
};

export function computeConference(args: {
  opening: MethodMap;
  flows: MonthFlows;
  shares: PartnerShare[];
  counted: MethodMap;
}): { rows: MethodCheck[]; expected: MethodMap; totalDifference: number } {
  const payouts: MethodMap = {};
  args.shares.forEach((s) => s.payout > 0 && add(payouts, s.payment_method, s.payout));

  const rows = CLOSING_METHODS.map((method) => {
    const opening = args.opening[method] ?? 0;
    const inflow = args.flows.inflows[method] ?? 0;
    const outflow = args.flows.outflows[method] ?? 0;
    const payout = payouts[method] ?? 0;
    const expected = round2(opening + inflow - outflow - payout);
    const counted = args.counted[method] ?? expected;
    return {
      method,
      opening,
      inflow,
      outflow,
      payout,
      expected,
      counted,
      difference: round2(counted - expected),
    };
  });

  const expected: MethodMap = {};
  rows.forEach((r) => (expected[r.method] = r.expected));
  return {
    rows,
    expected,
    totalDifference: round2(rows.reduce((s, r) => s + r.difference, 0)),
  };
}

/** Só mostra formas de pagamento com algum valor (mantém as principais sempre visíveis). */
export const visibleMethods = (rows: MethodCheck[]) =>
  rows.filter(
    (r) =>
      ["pix", "dinheiro"].includes(r.method) ||
      r.opening ||
      r.inflow ||
      r.outflow ||
      r.payout ||
      r.counted ||
      r.expected,
  );

/** Lançamento gerado pelo fechamento a partir da diferença da conferência. */
export type DifferenceAdjustment = {
  kind: "entrada" | "saida";
  category: "sobra_caixa" | "quebra_caixa";
  description: string;
  amount: number;
  occurred_on: string;
  payment_method: string | null;
};

/**
 * Converte as diferenças da conferência em lançamentos no último dia do mês:
 * sobra vira entrada "sobra_caixa" e falta vira saída "quebra_caixa".
 * Assim o saldo do financeiro bate com o conferido e a diferença aparece no DRE.
 */
export function differenceAdjustments(rows: MethodCheck[], ym: string): DifferenceAdjustment[] {
  const { end } = monthRange(ym);
  return rows
    .filter((r) => Math.abs(r.difference) >= 0.01)
    .map((r) => {
      const sobra = r.difference > 0;
      return {
        kind: sobra ? "entrada" : "saida",
        category: sobra ? "sobra_caixa" : "quebra_caixa",
        description: `${sobra ? "Sobra" : "Quebra"} de caixa · ${methodLabel(r.method)} · ${monthLabel(ym)}`,
        amount: round2(Math.abs(r.difference)),
        occurred_on: end,
        payment_method: r.method === NO_METHOD ? null : r.method,
      };
    });
}
