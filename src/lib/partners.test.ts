import { describe, expect, it } from "vitest";

import type { Partner, PartnerWithdrawal } from "@/lib/db";
import { activeShareTotal, equalShares, totalsByPartner } from "@/lib/partners";

const w = (p: Partial<PartnerWithdrawal>): PartnerWithdrawal =>
  ({
    id: Math.random().toString(),
    partner_id: "a",
    kind: "dinheiro",
    amount: 0,
    withdrawn_on: "2026-09-10",
    ...p,
  }) as PartnerWithdrawal;

describe("equalShares", () => {
  it("divide 100% em partes que somam exatamente 100", () => {
    const s = equalShares(3);
    expect(s).toEqual([33.333, 33.333, 33.334]);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(equalShares(2)).toEqual([50, 50]);
    expect(equalShares(0)).toEqual([]);
  });
});

describe("activeShareTotal", () => {
  it("soma só os sócios ativos", () => {
    const partners = [
      { share_pct: 33.333, active: true },
      { share_pct: 33.333, active: true },
      { share_pct: 33.334, active: true },
      { share_pct: 50, active: false },
    ] as Partner[];
    expect(activeShareTotal(partners)).toBe(100);
  });
});

describe("totalsByPartner", () => {
  it("separa dinheiro de peças/materiais e respeita o período", () => {
    const t = totalsByPartner(
      [
        w({ amount: 100 }),
        w({ kind: "peca_estoque", amount: 30 }),
        w({ kind: "material", amount: 5 }),
        w({ partner_id: "b", amount: 70 }),
        w({ amount: 999, withdrawn_on: "2026-08-31" }),
      ],
      "2026-09-01",
      "2026-09-30",
    );
    expect(t.get("a")).toEqual({ dinheiro: 100, especie: 35, total: 135, count: 3 });
    expect(t.get("b").total).toBe(70);
    expect(t.get("c")).toEqual({ dinheiro: 0, especie: 0, total: 0, count: 0 });
  });
});
