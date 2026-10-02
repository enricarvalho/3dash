import { describe, expect, it, vi, beforeEach } from "vitest";

type Material = { id: string; name: string; color: string | null; type: string | null; unit: string; quantity: number };

const state: { materials: Material[]; inserted: unknown[] } = { materials: [], inserted: [] };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "materials") {
        return {
          select: () => ({
            in: (_col: string, ids: string[]) => ({
              data: state.materials.filter((m) => ids.includes(m.id)),
              error: null,
            }),
          }),
        };
      }
      return {
        insert: (rows: unknown[]) => {
          state.inserted.push(...rows);
          return { error: null };
        },
      };
    },
  },
}));

const { applyMaterialConsumption, planMaterialConsumption, gramsToUnit } = await import("./material-stock");

const mat = (id: string, unit: string, quantity: number): Material => ({
  id,
  name: `Filamento ${id}`,
  color: "Preto",
  type: "PLA",
  unit,
  quantity,
});

beforeEach(() => {
  state.materials = [mat("A", "kg", 1), mat("B", "kg", 2), mat("C", "g", 500)];
  state.inserted = [];
});

const qty = (id: string) =>
  (state.inserted as { material_id: string; quantity: number }[])
    .filter((r) => r.material_id === id)
    .reduce((s, r) => s + r.quantity, 0);

describe("gramsToUnit", () => {
  it("converte g e kg e ignora outras unidades", () => {
    expect(gramsToUnit(50, "g")).toBe(50);
    expect(gramsToUnit(50, "kg")).toBe(0.05);
    expect(gramsToUnit(50, "un")).toBeNull();
  });
});

describe("baixa e estorno de filamento", () => {
  it("baixa o consumo ao criar uma peça", async () => {
    await applyMaterialConsumption({ material_id: "A", grams: 50 });
    expect(qty("A")).toBeCloseTo(-0.05);
  });

  it("estorna tudo ao excluir a peça", async () => {
    await applyMaterialConsumption({ material_id: null, grams: 0 }, { material_id: "A", grams: 50 });
    expect(qty("A")).toBeCloseTo(0.05);
  });

  it("movimenta apenas a diferença ao aumentar o consumo", async () => {
    await applyMaterialConsumption({ material_id: "A", grams: 80 }, { material_id: "A", grams: 50 });
    expect(qty("A")).toBeCloseTo(-0.03);
  });

  it("estorna a diferença ao reduzir o consumo", async () => {
    await applyMaterialConsumption({ material_id: "A", grams: 20 }, { material_id: "A", grams: 50 });
    expect(qty("A")).toBeCloseTo(0.03);
  });

  it("não movimenta nada quando o consumo não muda", async () => {
    await applyMaterialConsumption({ material_id: "A", grams: 50 }, { material_id: "A", grams: 50 });
    expect(state.inserted).toHaveLength(0);
  });

  it("estorna o material antigo e baixa o novo ao trocar de filamento", async () => {
    await applyMaterialConsumption({ material_id: "B", grams: 30 }, { material_id: "A", grams: 50 });
    expect(qty("A")).toBeCloseTo(0.05);
    expect(qty("B")).toBeCloseTo(-0.03);
  });

  it("respeita a unidade em gramas", async () => {
    await applyMaterialConsumption({ material_id: "C", grams: 120 });
    expect(qty("C")).toBeCloseTo(-120);
  });

  it("ciclo criar → editar → trocar → excluir volta ao saldo original", async () => {
    await applyMaterialConsumption({ material_id: "A", grams: 50 });
    await applyMaterialConsumption({ material_id: "A", grams: 80 }, { material_id: "A", grams: 50 });
    await applyMaterialConsumption({ material_id: "B", grams: 40 }, { material_id: "A", grams: 80 });
    await applyMaterialConsumption({ material_id: null, grams: 0 }, { material_id: "B", grams: 40 });
    expect(qty("A")).toBeCloseTo(0);
    expect(qty("B")).toBeCloseTo(0);
  });
});

describe("alerta de saldo negativo", () => {
  it("aponta a falta quando o consumo excede o saldo", async () => {
    const { shortages, rows } = await planMaterialConsumption({ material_id: "A", grams: 1500 });
    expect(rows).toHaveLength(1);
    expect(shortages).toHaveLength(1);
    expect(shortages[0].missing).toBeCloseTo(0.5);
    expect(shortages[0].resulting).toBeCloseTo(-0.5);
  });

  it("não alerta quando há saldo suficiente", async () => {
    const { shortages } = await planMaterialConsumption({ material_id: "B", grams: 500 });
    expect(shortages).toHaveLength(0);
  });

  it("planejar não grava movimentações", async () => {
    await planMaterialConsumption({ material_id: "A", grams: 10 });
    expect(state.inserted).toHaveLength(0);
  });
});

describe("quantidade de peças", () => {
  it("multiplica o consumo pela quantidade produzida", async () => {
    const { scaleUses } = await import("./material-stock");
    await applyMaterialConsumption(scaleUses({ material_id: "C", grams: 50 }, 5));
    expect(qty("C")).toBeCloseTo(-250);
  });

  it("estorna a diferença ao reduzir a quantidade", async () => {
    const { scaleUses } = await import("./material-stock");
    await applyMaterialConsumption(
      scaleUses({ material_id: "C", grams: 50 }, 2),
      scaleUses({ material_id: "C", grams: 50 }, 5),
    );
    expect(qty("C")).toBeCloseTo(150);
  });

  it("trata quantidade zero como uma unidade", async () => {
    const { scaleUses } = await import("./material-stock");
    await applyMaterialConsumption(scaleUses({ material_id: "C", grams: 50 }, 0));
    expect(qty("C")).toBeCloseTo(-50);
  });
});
