import { supabase } from "@/integrations/supabase/client";
import type { Partner, PartnerWithdrawal } from "@/lib/db";
import {
  applyInventoryConsumption,
  applyMaterialSaleConsumption,
  syncMaterialAssets,
} from "@/lib/inventory";
import { applyMaterialConsumption, scaleUses, type MaterialUse } from "@/lib/material-stock";
import { listPartMaterials, partMaterialUses } from "@/lib/part-materials";

export const WITHDRAWAL_KINDS = ["dinheiro", "peca_estoque", "peca_produzida", "material"] as const;
export type WithdrawalKind = (typeof WITHDRAWAL_KINDS)[number];

export const WITHDRAWAL_KIND_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro (adiantamento)",
  peca_estoque: "Peça pronta do estoque",
  peca_produzida: "Peça produzida para uso próprio",
  material: "Material do estoque",
};

/** Retiradas que não tiram dinheiro do caixa, só abatem da cota do sócio. */
export const isInKind = (kind: string) => kind !== "dinheiro";

export type NewWithdrawal = {
  partner: Partner;
  kind: WithdrawalKind;
  withdrawn_on: string;
  description: string;
  part_id?: string | null;
  material_id?: string | null;
  quantity: number;
  suggested_amount: number;
  amount: number;
  payment_method?: string | null;
  notes?: string | null;
};

/** Consumo de filamento/acessórios para produzir `qty` unidades de uma peça. */
async function partUses(partId: string, qty: number): Promise<MaterialUse[]> {
  const [{ data: part, error }, rows] = await Promise.all([
    supabase.from("parts").select("material_id, material_grams").eq("id", partId).maybeSingle(),
    listPartMaterials(partId),
  ]);
  if (error) throw new Error(error.message);
  return scaleUses(partMaterialUses(partId, rows, part ?? undefined), qty);
}

/** Aplica (sinal 1) ou estorna (sinal -1) o efeito da retirada no estoque. */
async function applyStock(
  w: Pick<PartnerWithdrawal, "kind" | "part_id" | "material_id" | "quantity">,
  sign: 1 | -1,
  note: string,
): Promise<string[]> {
  const qty = Number(w.quantity) * sign;
  if (w.kind === "peca_estoque" && w.part_id) {
    const { shortages } = await applyInventoryConsumption({ [w.part_id]: qty });
    return shortages;
  }
  if (w.kind === "material" && w.material_id) {
    const { shortages } = await applyMaterialSaleConsumption({ [w.material_id]: qty }, note);
    return shortages;
  }
  if (w.kind === "peca_produzida" && w.part_id) {
    const uses = await partUses(w.part_id, Number(w.quantity));
    if (!uses.length) return [];
    const { shortages } =
      sign === 1
        ? await applyMaterialConsumption(uses, undefined, note)
        : await applyMaterialConsumption([], uses, note);
    const ids = uses.map((u) => u.material_id).filter((id): id is string => !!id);
    if (ids.length) await syncMaterialAssets(ids);
    return shortages.map((s) => s.label);
  }
  return [];
}

/**
 * Registra a retirada. Dinheiro vira saída "retirada_socio" no financeiro;
 * peças e materiais dão baixa no estoque.
 * Retorna os itens que ficaram com saldo insuficiente.
 */
export async function createWithdrawal(input: NewWithdrawal) {
  const { partner, ...w } = input;
  let transactionId: string | null = null;

  if (w.kind === "dinheiro") {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        kind: "saida",
        category: "retirada_socio",
        description: `Retirada · ${partner.name}${w.description ? ` · ${w.description}` : ""}`,
        amount: w.amount,
        occurred_on: w.withdrawn_on,
        payment_method: w.payment_method || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    transactionId = data.id;
  }

  const { data: row, error } = await supabase
    .from("partner_withdrawals")
    .insert({
      partner_id: partner.id,
      kind: w.kind,
      withdrawn_on: w.withdrawn_on,
      description: w.description,
      part_id: w.part_id || null,
      material_id: w.material_id || null,
      quantity: w.quantity,
      suggested_amount: w.suggested_amount,
      amount: w.amount,
      payment_method: w.kind === "dinheiro" ? w.payment_method || null : null,
      transaction_id: transactionId,
      notes: w.notes || null,
    })
    .select()
    .single();
  if (error) {
    if (transactionId) await supabase.from("transactions").delete().eq("id", transactionId);
    throw new Error(error.message);
  }

  try {
    return await applyStock(row, 1, `Retirada do sócio ${partner.name}`);
  } catch (e) {
    await supabase.from("partner_withdrawals").delete().eq("id", row.id);
    throw e;
  }
}

/** Exclui a retirada, estornando o estoque e removendo o lançamento no financeiro. */
export async function deleteWithdrawal(w: PartnerWithdrawal, partnerName: string) {
  await applyStock(w, -1, `Estorno de retirada do sócio ${partnerName}`);
  const { error } = await supabase.from("partner_withdrawals").delete().eq("id", w.id);
  if (error) throw new Error(error.message);
  if (w.transaction_id) {
    const { error: txErr } = await supabase
      .from("transactions")
      .delete()
      .eq("id", w.transaction_id);
    if (txErr) throw new Error(txErr.message);
  }
}

export type PartnerTotals = { dinheiro: number; especie: number; total: number; count: number };

const emptyTotals = (): PartnerTotals => ({ dinheiro: 0, especie: 0, total: 0, count: 0 });

/** Soma das retiradas por sócio dentro de um intervalo de datas (ISO, inclusivo). */
export function totalsByPartner(withdrawals: PartnerWithdrawal[], start: string, end: string) {
  const map = new Map<string, PartnerTotals>();
  for (const w of withdrawals) {
    if (w.withdrawn_on < start || w.withdrawn_on > end) continue;
    const t = map.get(w.partner_id) ?? emptyTotals();
    const v = Number(w.amount);
    if (isInKind(w.kind)) t.especie += v;
    else t.dinheiro += v;
    t.total += v;
    t.count += 1;
    map.set(w.partner_id, t);
  }
  return { get: (id: string) => map.get(id) ?? emptyTotals() };
}

/** Soma dos percentuais dos sócios ativos (deve dar 100). */
export const activeShareTotal = (partners: Partner[]) =>
  Math.round(partners.filter((p) => p.active).reduce((s, p) => s + Number(p.share_pct), 0) * 100) /
  100;

/** Percentuais iguais que somam exatamente 100 (o último absorve o arredondamento). */
export function equalShares(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((100 / n) * 1000) / 1000;
  return Array.from({ length: n }, (_, i) =>
    i === n - 1 ? Math.round((100 - base * (n - 1)) * 1000) / 1000 : base,
  );
}
