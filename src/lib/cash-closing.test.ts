import { describe, expect, it } from "vitest";

import type { Partner, PartnerWithdrawal, Transaction } from "@/lib/db";
import {
  computeConference,
  computeDistribution,
  differenceAdjustments,
  monthFlows,
  monthRange,
  nextMonthToClose,
} from "@/lib/cash-closing";

const tx = (p: Partial<Transaction>): Transaction =>
  ({
    id: Math.random().toString(),
    kind: "saida",
    category: "outros",
    amount: 0,
    occurred_on: "2026-09-15",
    payment_method: "pix",
    paid_from_reserve: false,
    cash_closing_id: null,
    ...p,
  }) as Transaction;

const partner = (id: string, share = 33.333, active = true): Partner =>
  ({ id, name: id.toUpperCase(), share_pct: share, active }) as Partner;

const wd = (p: Partial<PartnerWithdrawal>): PartnerWithdrawal =>
  ({
    id: Math.random().toString(),
    kind: "dinheiro",
    amount: 0,
    withdrawn_on: "2026-09-10",
    ...p,
  }) as PartnerWithdrawal;

const socios = [partner("a"), partner("b"), partner("c", 33.334)];

describe("meses", () => {
  it("monthRange cobre o mês inteiro", () => {
    expect(monthRange("2026-02")).toEqual({
      month: "2026-02-01",
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("próximo mês: reaberto tem prioridade, senão o seguinte ao último fechado", () => {
    expect(nextMonthToClose([])).toBeNull();
    expect(
      nextMonthToClose([
        { month: "2026-07-01", status: "fechado" },
        { month: "2026-08-01", status: "fechado" },
      ]),
    ).toBe("2026-09");
    expect(
      nextMonthToClose([
        { month: "2026-07-01", status: "fechado" },
        { month: "2026-08-01", status: "reaberto" },
      ]),
    ).toBe("2026-08");
    expect(nextMonthToClose([{ month: "2026-12-01", status: "fechado" }])).toBe("2027-01");
  });
});

describe("monthFlows", () => {
  it("separa gastos da empresa do que é dos sócios e da reserva", () => {
    const f = monthFlows(
      [
        tx({ kind: "entrada", amount: 1000 }),
        tx({ kind: "entrada", amount: 200, payment_method: "dinheiro" }),
        tx({ kind: "entrada", amount: 50, payment_method: null }),
        tx({ category: "energia", amount: 100 }),
        tx({ category: "retirada_socio", amount: 80, payment_method: "dinheiro" }),
        tx({ category: "investimento", amount: 300, paid_from_reserve: true }),
        tx({ category: "investimento", amount: 40 }),
        tx({ kind: "entrada", amount: 999, occurred_on: "2026-10-01" }),
      ],
      "2026-09",
    );
    expect(f.totalIn).toBe(1250);
    expect(f.inflows).toEqual({ pix: 1000, dinheiro: 200, nao_informado: 50 });
    expect(f.outflows).toEqual({ pix: 440, dinheiro: 80 });
    expect(f.companyOut).toBe(140);
    expect(f.reserveSpent).toBe(300);
  });

  it("ignora as distribuições do próprio fechamento", () => {
    const f = monthFlows(
      [tx({ category: "distribuicao_lucro", amount: 500, cash_closing_id: "x" })],
      "2026-09",
      "x",
    );
    expect(f.outflows).toEqual({});
  });
});

describe("computeDistribution", () => {
  it("separa reserva, divide igual e desconta retiradas", () => {
    const d = computeDistribution({
      result: 3100,
      previousLoss: 0,
      reserve: 100,
      partners: socios,
      ym: "2026-09",
      previousDebts: {},
      withdrawals: [
        wd({ partner_id: "a", amount: 200 }),
        wd({ partner_id: "a", kind: "peca_estoque", amount: 50 }),
        wd({ partner_id: "b", amount: 1500 }),
      ],
    });
    expect(d.reserveAmount).toBe(100);
    expect(d.distributable).toBe(3000);
    expect(d.shares.map((s) => s.quota)).toEqual([999.99, 999.99, 1000.02]);
    expect(d.shares.reduce((s, x) => s + x.quota, 0)).toBeCloseTo(3000, 6);

    const [a, b, c] = d.shares;
    expect(a).toMatchObject({ cash: 200, in_kind: 50, net: 749.99, payout: 749.99, debt: 0 });
    // B retirou mais que a cota: não recebe e fica devendo
    expect(b).toMatchObject({ cash: 1500, payout: 0, debt: 500.01 });
    expect(c.payout).toBe(1000.02);
  });

  it("saldo devedor anterior é descontado da cota", () => {
    const d = computeDistribution({
      result: 300,
      previousLoss: 0,
      reserve: 0,
      partners: socios,
      ym: "2026-09",
      previousDebts: { b: 40 },
      withdrawals: [],
    });
    expect(d.shares[1]).toMatchObject({ quota: 100, previous_debt: 40, payout: 60 });
  });

  it("prejuízo não distribui e é levado para o mês seguinte", () => {
    const d = computeDistribution({
      result: -250,
      previousLoss: 100,
      reserve: 500,
      partners: socios,
      ym: "2026-09",
      previousDebts: {},
      withdrawals: [wd({ partner_id: "a", amount: 30 })],
    });
    expect(d).toMatchObject({ base: -350, reserveAmount: 0, distributable: 0, lossCarry: 350 });
    expect(d.shares[0]).toMatchObject({ quota: 0, payout: 0, debt: 30 });
  });

  it("prejuízo anterior é compensado antes de dividir e a reserva é limitada", () => {
    const d = computeDistribution({
      result: 500,
      previousLoss: 200,
      reserve: 1000,
      partners: socios,
      ym: "2026-09",
      previousDebts: {},
      withdrawals: [],
    });
    expect(d).toMatchObject({ base: 300, reserveAmount: 300, distributable: 0, lossCarry: 0 });
  });

  it("sócio inativo com retirada aparece com cota zero", () => {
    const d = computeDistribution({
      result: 100,
      previousLoss: 0,
      reserve: 0,
      partners: [partner("a", 100), partner("x", 0, false)],
      ym: "2026-09",
      previousDebts: {},
      withdrawals: [wd({ partner_id: "x", amount: 20 })],
    });
    expect(d.shares.map((s) => [s.partner_id, s.quota, s.debt])).toEqual([
      ["a", 100, 0],
      ["x", 0, 20],
    ]);
  });
});

describe("computeConference", () => {
  it("esperado = inicial + entradas − saídas − distribuições, por forma", () => {
    const flows = monthFlows(
      [
        tx({ kind: "entrada", amount: 1000 }),
        tx({ kind: "entrada", amount: 200, payment_method: "dinheiro" }),
        tx({ category: "energia", amount: 100 }),
      ],
      "2026-09",
    );
    const d = computeDistribution({
      result: 1100,
      previousLoss: 0,
      reserve: 0,
      partners: [partner("a", 50), partner("b", 50)],
      ym: "2026-09",
      previousDebts: {},
      withdrawals: [],
      paymentMethods: { a: "pix", b: "dinheiro" },
    });
    const c = computeConference({
      opening: { pix: 500, dinheiro: 100 },
      flows,
      shares: d.shares,
      counted: { pix: 850, dinheiro: 0 },
    });
    const pix = c.rows.find((r) => r.method === "pix")!;
    const din = c.rows.find((r) => r.method === "dinheiro")!;
    expect(pix).toMatchObject({ expected: 500 + 1000 - 100 - 550, difference: 0 });
    expect(din).toMatchObject({ expected: 100 + 200 - 550, counted: 0, difference: 250 });
    expect(c.totalDifference).toBe(250);
  });
});

describe("differenceAdjustments", () => {
  it("sobra vira entrada, falta vira saída, no último dia do mês", () => {
    const flows = monthFlows([tx({ kind: "entrada", amount: 100 })], "2026-09");
    const c = computeConference({
      opening: { dinheiro: 50 },
      flows,
      shares: [],
      counted: { pix: 110, dinheiro: 45.5 },
    });
    expect(differenceAdjustments(c.rows, "2026-09")).toEqual([
      {
        kind: "entrada",
        category: "sobra_caixa",
        description: "Sobra de caixa · PIX · setembro de 2026",
        amount: 10,
        occurred_on: "2026-09-30",
        payment_method: "pix",
      },
      {
        kind: "saida",
        category: "quebra_caixa",
        description: "Quebra de caixa · Dinheiro · setembro de 2026",
        amount: 4.5,
        occurred_on: "2026-09-30",
        payment_method: "dinheiro",
      },
    ]);
  });

  it("sem diferença, nenhum lançamento", () => {
    const flows = monthFlows([], "2026-09");
    const c = computeConference({ opening: { pix: 10 }, flows, shares: [], counted: {} });
    expect(differenceAdjustments(c.rows, "2026-09")).toEqual([]);
  });
});
