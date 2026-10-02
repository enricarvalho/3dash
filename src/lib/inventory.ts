import { supabase } from "@/integrations/supabase/client";
import { applyMaterialConsumption, type MaterialShortage, type MaterialUse } from "./material-stock";
import { listPartMaterials, partMaterialUses } from "./part-materials";

/** Quantidade vendida por peça (part_id) em um conjunto de itens. */
export const qtyByPart = (
  items: { part_id?: string | null; quantity: number | string }[],
) => {
  const map: Record<string, number> = {};
  items.forEach((i) => {
    if (!i.part_id) return;
    map[i.part_id] = (map[i.part_id] ?? 0) + (Number(i.quantity) || 0);
  });
  return map;
};

/** Diferença entre duas contagens: resultado positivo = precisa dar baixa. */
export const diffQty = (
  next: Record<string, number>,
  prev: Record<string, number>,
) => {
  const out: Record<string, number> = {};
  new Set([...Object.keys(next), ...Object.keys(prev)]).forEach((id) => {
    const d = (next[id] ?? 0) - (prev[id] ?? 0);
    if (d !== 0) out[id] = d;
  });
  return out;
};

/**
 * Aplica baixa/estorno no Inventário (itens de categoria "peca_pronta").
 * `consumed` positivo dá baixa; negativo devolve ao saldo.
 * Retorna nomes de peças cujo saldo ficou insuficiente (baixa limitada a zero).
 */
export const applyInventoryConsumption = async (
  consumed: Record<string, number>,
) => {
  const ids = Object.keys(consumed).filter((id) => consumed[id] !== 0);
  if (!ids.length) return { shortages: [] as string[] };

  const { data: parts, error: pErr } = await supabase
    .from("parts")
    .select("id, name, stock_quantity")
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);

  const shortages: string[] = [];
  for (const part of parts ?? []) {
    const desired = Number(part.stock_quantity) - consumed[part.id];
    const next = Math.max(desired, 0);
    if (desired < 0) shortages.push(part.name);
    if (next === Number(part.stock_quantity)) continue;
    const { error } = await supabase
      .from("parts")
      .update({ stock_quantity: next })
      .eq("id", part.id);
    if (error) throw new Error(error.message);
  }

  await syncPartAssets();
  return { shortages };
};

/** Quantidade vendida por material (itens de venda vinculados ao estoque). */
export const qtyByMaterial = (
  items: { material_id?: string | null; quantity: number | string }[],
) => {
  const map: Record<string, number> = {};
  items.forEach((i) => {
    if (!i.material_id) return;
    map[i.material_id] = (map[i.material_id] ?? 0) + (Number(i.quantity) || 0);
  });
  return map;
};

/**
 * Baixa (ou estorna) materiais do Estoque vendidos diretamente e sincroniza
 * os itens do Inventário vinculados a esses materiais.
 */
export const applyMaterialSaleConsumption = async (
  consumed: Record<string, number>,
  note = "Venda de item do estoque",
) => {
  const ids = Object.keys(consumed).filter((id) => Math.abs(consumed[id]) > 0.0000001);
  if (!ids.length) return { shortages: [] as string[] };

  const { data, error } = await supabase
    .from("materials")
    .select("id, name, color, unit, quantity")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const shortages: string[] = [];
  const rows = ids
    .filter((id) => (data ?? []).some((m) => m.id === id))
    .map((id) => {
      const mat = (data ?? []).find((m) => m.id === id)!;
      if (Number(mat.quantity) - consumed[id] < 0)
        shortages.push(`${mat.name}${mat.color ? ` ${mat.color}` : ""}`);
      return {
        material_id: id,
        quantity: -consumed[id],
        reason: consumed[id] > 0 ? "ajuste" : "ajuste",
        note,
      };
    });

  if (rows.length) {
    const { error: mvErr } = await supabase.from("stock_movements").insert(rows);
    if (mvErr) throw new Error(mvErr.message);
  }

  await syncMaterialAssets(ids);
  return { shortages };
};

/** Espelha saldo e imagem do Estoque nos itens de Inventário vinculados a materiais. */
export const syncMaterialAssets = async (materialIds?: string[]) => {
  let q = supabase
    .from("assets")
    .select("id, quantity, image_url, material_id")
    .not("material_id", "is", null);
  if (materialIds?.length) q = q.in("material_id", materialIds);
  const { data: assets, error } = await q;
  if (error) throw new Error(error.message);
  if (!assets?.length) return;

  const ids = [...new Set(assets.map((a) => a.material_id as string))];
  const { data: mats, error: matErr } = await supabase
    .from("materials")
    .select("id, quantity, image_url")
    .in("id", ids);
  if (matErr) throw new Error(matErr.message);

  for (const asset of assets) {
    const mat = (mats ?? []).find((m) => m.id === asset.material_id);
    if (!mat) continue;
    const next = Math.max(Number(mat.quantity), 0);

    // imagem: o estoque manda; se só o inventário tiver foto, ela sobe para o estoque
    if (!mat.image_url && asset.image_url) {
      const { error: mUpErr } = await supabase
        .from("materials")
        .update({ image_url: asset.image_url })
        .eq("id", mat.id);
      if (mUpErr) throw new Error(mUpErr.message);
      mat.image_url = asset.image_url;
    }

    const patch: { quantity?: number; image_url?: string | null } = {};
    if (next !== Number(asset.quantity)) patch.quantity = next;
    if ((mat.image_url ?? null) !== (asset.image_url ?? null)) patch.image_url = mat.image_url ?? null;
    if (!Object.keys(patch).length) continue;

    const { error: upErr } = await supabase.from("assets").update(patch).eq("id", asset.id);
    if (upErr) throw new Error(upErr.message);
  }
};


/** Espelha as peças cadastradas nos itens de Inventário (mantém nome, valor e imagem). */
export const syncPartAssets = async () => {
  const [{ data: parts, error: pErr }, { data: assets, error: aErr }] = await Promise.all([
    supabase.from("parts").select("id, name, estimated_cost, image_url, image_urls, stock_quantity"),
    supabase.from("assets").select("id, name, unit_value, image_url, quantity, part_id").not("part_id", "is", null),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (aErr) throw new Error(aErr.message);

  const missing = (parts ?? []).filter((p) => !(assets ?? []).some((a) => a.part_id === p.id));
  if (missing.length) {
    const { error } = await supabase.from("assets").insert(
      missing.map((p) => ({
        name: p.name,
        category: "peca_pronta",
        part_id: p.id,
        quantity: Math.max(Number(p.stock_quantity) || 0, 0),
        unit_value: Number(p.estimated_cost) || 0,
        image_url: p.image_url ?? p.image_urls?.[0] ?? null,
      })),
    );
    if (error) throw new Error(error.message);
  }

  for (const asset of assets ?? []) {
    const part = (parts ?? []).find((p) => p.id === asset.part_id);
    if (!part) continue;
    const image = part.image_url ?? part.image_urls?.[0] ?? null;
    const value = Number(part.estimated_cost) || 0;
    const qty = Math.max(Number(part.stock_quantity) || 0, 0);
    if (
      asset.name === part.name &&
      Number(asset.unit_value) === value &&
      asset.image_url === image &&
      Number(asset.quantity) === qty
    )
      continue;
    const { error } = await supabase
      .from("assets")
      .update({ name: part.name, unit_value: value, image_url: image, quantity: qty })
      .eq("id", asset.id);
    if (error) throw new Error(error.message);
  }
};

/** Cria itens de Inventário para materiais do Estoque ainda não vinculados. */
export const syncStockAssets = async () => {
  const [{ data: materials, error: mErr }, { data: assets, error: aErr }] = await Promise.all([
    supabase.from("materials").select("id, name, color, type, quantity, cost_per_unit, image_url"),
    supabase.from("assets").select("id, material_id").not("material_id", "is", null),
  ]);
  if (mErr) throw new Error(mErr.message);
  if (aErr) throw new Error(aErr.message);

  const missing = (materials ?? []).filter((m) => !(assets ?? []).some((a) => a.material_id === m.id));
  if (missing.length) {
    const { error } = await supabase.from("assets").insert(
      missing.map((m) => ({
        name: [m.name, m.type, m.color].filter(Boolean).join(" · "),
        category: "material",
        material_id: m.id,
        quantity: Math.max(Number(m.quantity), 0),
        unit_value: Number(m.cost_per_unit) || 0,
        image_url: m.image_url ?? null,
        location: "Estoque",
      })),
    );

    if (error) throw new Error(error.message);
  }
  await syncMaterialAssets();
};

/** Sincroniza Estoque + Peças com o Inventário. */
export const syncCatalogAssets = async () => {
  await syncStockAssets();
  await syncPartAssets();
  return true;
};

/**
 * Registra a movimentação de filamento quando a quantidade de uma peça muda
 * pelo Inventário. Aumentar dá baixa proporcional; reduzir estorna.
 */
export const applyPartQuantityConsumption = async (
  partId: string,
  nextQuantity: number | string,
  prevQuantity: number | string,
) => {
  const next = Math.max(Number(nextQuantity) || 0, 0);
  const prev = Math.max(Number(prevQuantity) || 0, 0);
  if (next === prev) return { shortages: [] as MaterialShortage[] };

  const [{ data: part, error }, rows] = await Promise.all([
    supabase.from("parts").select("material_id, material_grams").eq("id", partId).maybeSingle(),
    listPartMaterials(partId),
  ]);
  if (error) throw new Error(error.message);

  const uses = partMaterialUses(partId, rows, part ?? undefined);
  if (!uses.length) return { shortages: [] as MaterialShortage[] };

  const scale = (qty: number): MaterialUse[] =>
    uses.map((u) => ({ ...u, grams: (Number(u.grams) || 0) * qty }));

  return applyMaterialConsumption(
    scale(next),
    scale(prev),
    "Ajuste de quantidade no inventário",
  );
};
