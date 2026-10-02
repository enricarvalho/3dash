import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { MaterialUse } from "./material-stock";

export type PartMaterial = Tables<"part_materials">;

export const listPartMaterials = async (partId?: string) => {
  let q = supabase.from("part_materials").select("*").order("position");
  if (partId) q = q.eq("part_id", partId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PartMaterial[];
};

/** Consumo atual de uma peça (filamentos + acessórios), com fallback para o campo antigo. */
export const partMaterialUses = (
  partId: string,
  rows: PartMaterial[] | undefined,
  fallback?: { material_id: string | null; material_grams: number | null },
): MaterialUse[] => {
  const list = (rows ?? []).filter((r) => r.part_id === partId);
  if (list.length)
    return list.map((r) => {
      const units = (r as { units?: number | null }).units;
      return units === null || units === undefined
        ? { material_id: r.material_id, grams: Number(r.grams) || 0 }
        : { material_id: r.material_id, grams: 0, units: Number(units) || 0 };
    });
  if (fallback?.material_id)
    return [{ material_id: fallback.material_id, grams: Number(fallback.material_grams) || 0 }];
  return [];
};

/** Substitui a lista de filamentos/acessórios de uma peça. */
export const savePartMaterials = async (partId: string, uses: MaterialUse[]) => {
  const { error: delError } = await supabase.from("part_materials").delete().eq("part_id", partId);
  if (delError) throw new Error(delError.message);
  const rows = uses
    .filter(
      (u) =>
        u.material_id &&
        (u.units === undefined ? (Number(u.grams) || 0) > 0 : (Number(u.units) || 0) > 0),
    )
    .map((u, i) => ({
      part_id: partId,
      material_id: u.material_id,
      grams: u.units === undefined ? Number(u.grams) || 0 : 0,
      units: u.units === undefined ? null : Number(u.units) || 0,
      position: i,
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("part_materials").insert(rows);
  if (error) throw new Error(error.message);
};
