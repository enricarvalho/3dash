import { describe, expect, it } from "vitest";

import type { Sale, SaleItem, Transaction } from "@/lib/db";
import { calcularContasAReceber, calcularDRE, periodoAnterior } from "@/lib/dre";

const sale = (p: Partial<Sale>): Sale =>
  ({
    id: "s1",
    customer_id: null,
    guest_name: null,
    status: "pago",
    sale_date: "2026-09-10",
    total: 0,
    discount: 0,
    cost_total: 0,
    ...p,
  }) as Sale;

const item = (p: Partial<SaleItem>): SaleItem =>
  ({ id: Math.random().toString(), quantity: 1, unit_price: 0, unit_cost: 0, ...p }) as SaleItem;

const tx = (p: Partial<Transaction>): Transaction =>
  ({
    id: Math.random().toString(),
    kind: "saida",
    category: "outros",
    description: "x",
    amount: 0,
    occurred_on: "2026-09-15",
    sale_id: null,
    ...p,
  }) as Transaction;

const setembro = { inicio: "2026-09-01", fim: "2026-09-30" };
const row = (r: ReturnType<typeof calcularDRE>, id: string) =>
  r.rows.find((x) => x.id === id)!.value;

const input = {
  sales: [
    // venda paga: bruto 200, desconto 20, custo 60
    sale({ id: "a", total: 180, discount: 20, cost_total: 60 }),
    // venda pendente: bruto 100, custo 30
    sale({ id: "b", status: "pendente", total: 100, cost_total: 30, sale_date: "2026-09-20" }),
    // cancelada: ignorada
    sale({ id: "c", status: "cancelado", total: 999, cost_total: 500 }),
    // fora do período
    sale({ id: "d", total: 50, cost_total: 10, sale_date: "2026-08-31" }),
  ],
  saleItems: [
    item({ sale_id: "a", quantity: 2, unit_price: 100 }),
    item({ sale_id: "b", quantity: 1, unit_price: 100 }),
  ],
  transactions: [
    tx({
      kind: "entrada",
      category: "venda",
      amount: 180,
      sale_id: "a",
      occurred_on: "2026-09-10",
    }),
    tx({ kind: "entrada", category: "servico", amount: 40 }),
    tx({ category: "impostos", amount: 15 }),
    tx({ category: "material", amount: 80 }),
    tx({ category: "energia", amount: 25 }),
    tx({ category: "manutencao", amount: 10 }),
  ],
};

describe("calcularDRE", () => {
  it("competência: reconhece vendas pela data, com desconto e custo de produção", () => {
    const r = calcularDRE(input, "competencia", setembro);
    expect(row(r, "rec-vendas")).toBe(300);
    expect(row(r, "rec-servico")).toBe(40);
    // a entrada da venda paga não é contada duas vezes
    expect(r.receitaBruta).toBe(340);
    expect(row(r, "descontos")).toBe(-20);
    expect(row(r, "impostos")).toBe(-15);
    expect(r.receitaLiquida).toBe(305);
    // compra de material vai para o estoque; custo é o de produção
    expect(row(r, "cmv")).toBe(-90);
    expect(r.lucroBruto).toBe(215);
    expect(r.despesasOperacionais).toBe(35);
    expect(r.resultadoLiquido).toBe(180);
    expect(r.kpis.pendente).toBeCloseTo(35.71, 2);
  });

  it("caixa: só o que entrou e saiu do caixa", () => {
    const r = calcularDRE(input, "caixa", setembro);
    expect(row(r, "rec-vendas")).toBe(180);
    expect(r.receitaBruta).toBe(220);
    expect(row(r, "descontos")).toBe(-0);
    expect(r.receitaLiquida).toBe(205);
    expect(row(r, "cmv")).toBe(-80);
    expect(r.resultadoLiquido).toBe(205 - 80 - 35);
  });
});

describe("categorias especiais", () => {
  const extra = {
    ...input,
    transactions: [
      ...input.transactions,
      tx({ category: "custo", amount: 12 }),
      tx({ category: "investimento", amount: 300 }),
      tx({ category: "retirada_socio", amount: 50 }),
      tx({ category: "distribuicao_lucro", amount: 70 }),
    ],
  };

  it("custo de orçamento entra no CPV", () => {
    const r = calcularDRE(extra, "competencia", setembro);
    expect(row(r, "cmv")).toBe(-102);
  });

  it("investimento e sócios ficam abaixo do resultado, não como despesa", () => {
    const r = calcularDRE(extra, "competencia", setembro);
    expect(r.despesasOperacionais).toBe(35);
    expect(r.resultadoLiquido).toBe(305 - 102 - 35);
    expect(row(r, "socios")).toBe(-120);
    expect(row(r, "investimentos")).toBe(-300);
    expect(row(r, "saldo-retido")).toBe(168 - 120 - 300);
  });

  it("sem sócios nem investimentos, as linhas extras não aparecem", () => {
    const r = calcularDRE(input, "competencia", setembro);
    expect(r.rows.find((x) => x.id === "saldo-retido")).toBeUndefined();
  });
});

describe("calcularContasAReceber", () => {
  it("agrupa vendas pendentes por tempo desde a venda", () => {
    const c = calcularContasAReceber(
      [
        sale({ id: "1", status: "pendente", total: 10, sale_date: "2026-09-25" }),
        sale({ id: "2", status: "pendente", total: 20, sale_date: "2026-08-15" }),
        sale({ id: "3", status: "pendente", total: 40, sale_date: "2026-05-01" }),
        sale({ id: "4", status: "pago", total: 99, sale_date: "2026-09-25" }),
      ],
      "2026-09-30",
    );
    expect(c.total).toBe(70);
    expect(c.faixas.map((f) => f.valor)).toEqual([10, 20, 0, 40]);
  });
});

describe("periodoAnterior", () => {
  it("usa meses inteiros quando o período é de meses completos", () => {
    expect(periodoAnterior({ inicio: "2026-03-01", fim: "2026-03-31" })).toEqual({
      inicio: "2026-02-01",
      fim: "2026-02-28",
    });
    expect(periodoAnterior({ inicio: "2026-07-01", fim: "2026-09-30" })).toEqual({
      inicio: "2026-04-01",
      fim: "2026-06-30",
    });
  });
});
