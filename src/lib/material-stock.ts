import { supabase } from "@/integrations/supabase/client";

/**
 * Consumo de um item do estoque por peça.
 * - `grams`: filamentos (convertidos para a unidade do material).
 * - `units`: acessórios contados por unidade (argola, ímã, etc.).
 */
export type MaterialUse = { material_id: string | null; grams: number; units?: number };

export type MaterialShortage = {
  label: string;
  unit: string;
  missing: number;
  resulting: number;
};

type MovementRow = { material_id: string; quantity: number; reason: string; note: string | null };

/** Converte gramas para a unidade do material (kg, g). Outras unidades não são baixadas. */
export const gramsToUnit = (grams: number, unit: string) => {
  if (unit === "g") return grams;
  if (unit === "kg") return grams / 1000;
  return null;
};

export const materialLabel = (m: {
  name: string;
  color?: string | null;
  type?: string | null;
}) => [m.name, m.type, m.color].filter(Boolean).join(" · ");

const toList = (use: MaterialUse | MaterialUse[]) => (Array.isArray(use) ? use : [use]);

/** Multiplica o consumo por unidade pela quantidade produzida (mínimo 1 unidade). */
export const scaleUses = (
  uses: MaterialUse | MaterialUse[],
  quantity: number | string,
): MaterialUse[] => {
  const qty = Math.max(Math.floor(Number(quantity) || 0), 1);
  return toList(uses).map((u) => ({
    ...u,
    grams: (Number(u.grams) || 0) * qty,
    ...(u.units === undefined ? {} : { units: (Number(u.units) || 0) * qty }),
  }));
};

type Delta = { grams: number; units: number };

/** Soma o consumo por material (aceita múltiplos filamentos/acessórios na mesma peça). */
const accumulate = (deltas: Map<string, Delta>, list: MaterialUse[], sign: 1 | -1) => {
  for (const use of list) {
    const grams = Number(use.grams) || 0;
    const units = Number(use.units) || 0;
    if (!use.material_id || (!grams && !units)) continue;
    const cur = deltas.get(use.material_id) ?? { grams: 0, units: 0 };
    deltas.set(use.material_id, {
      grams: cur.grams + sign * grams,
      units: cur.units + sign * units,
    });
  }
};

/**
 * Calcula as movimentações necessárias (sem gravar) e o impacto no saldo.
 * `prev` é o consumo anterior (estorno) e `next` o novo consumo (baixa).
 * Ambos aceitam um único item ou uma lista de itens.
 */
export const planMaterialConsumption = async (
  next: MaterialUse | MaterialUse[],
  prev: MaterialUse | MaterialUse[] = { material_id: null, grams: 0 },
  note?: string,
) => {
  const deltas = new Map<string, Delta>();
  accumulate(deltas, toList(prev), 1);
  accumulate(deltas, toList(next), -1);

  const ids = [...deltas.keys()].filter((id) => {
    const d = deltas.get(id)!;
    return Math.abs(d.grams) > 0.0001 || Math.abs(d.units) > 0.0001;
  });
  const rows: MovementRow[] = [];
  const shortages: MaterialShortage[] = [];
  if (!ids.length) return { rows, shortages };

  const { data, error } = await supabase
    .from("materials")
    .select("id, name, color, type, unit, quantity")
    .in("id", ids);
  if (error) throw new Error(error.message);

  for (const id of ids) {
    const mat = (data ?? []).find((m) => m.id === id);
    if (!mat) continue;
    const d = deltas.get(id)!;
    const fromGrams = gramsToUnit(d.grams, mat.unit) ?? 0;
    const qty = fromGrams + d.units;
    if (!qty) continue;
    const resulting = Number(mat.quantity) + qty;
    if (resulting < 0)
      shortages.push({
        label: materialLabel(mat),
        unit: mat.unit,
        missing: Math.abs(resulting),
        resulting,
      });
    rows.push({
      material_id: id,
      quantity: qty,
      reason: qty < 0 ? "producao" : "ajuste",
      note: note ?? "Consumo de impressão",
    });
  }
  return { rows, shortages };
};

/** Grava as movimentações calculadas por `planMaterialConsumption`. */
export const commitMaterialMovements = async (rows: MovementRow[]) => {
  if (!rows.length) return;
  const { error } = await supabase.from("stock_movements").insert(rows);
  if (error) throw new Error(error.message);
};

/**
 * Registra a baixa (ou estorno) de filamento no estoque ao cadastrar/editar/excluir uma peça.
 * Movimenta apenas a diferença entre o consumo anterior e o novo.
 */
export const applyMaterialConsumption = async (
  next: MaterialUse | MaterialUse[],
  prev: MaterialUse | MaterialUse[] = { material_id: null, grams: 0 },
  note?: string,
) => {
  const { rows, shortages } = await planMaterialConsumption(next, prev, note);
  await commitMaterialMovements(rows);
  return { shortages };
};
