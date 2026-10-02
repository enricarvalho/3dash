import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CashClosing } from "@/lib/db";
import {
  monthLabel,
  monthRange,
  type DifferenceAdjustment,
  type Distribution,
  type MethodMap,
  type MonthFlows,
} from "@/lib/cash-closing";

export type CloseMonthInput = {
  ym: string;
  /** Fechamento reaberto deste mês, se houver (é atualizado em vez de criar outro). */
  existing: CashClosing | null;
  opening: MethodMap;
  flows: MonthFlows;
  distribution: Distribution;
  expected: MethodMap;
  counted: MethodMap;
  difference: number;
  differenceReason: string | null;
  /** Sobras/quebras da conferência, lançadas no financeiro junto com as distribuições. */
  adjustments: DifferenceAdjustment[];
  reserveBalance: number;
  notes: string | null;
};

/**
 * Grava o fechamento e lança no financeiro a distribuição de cada sócio
 * (saída "distribuicao_lucro" no último dia do mês) e as sobras/quebras de
 * caixa, todos vinculados ao fechamento (removidos ao reabrir).
 */
export async function closeMonth(input: CloseMonthInput) {
  const { ym, distribution: d } = input;
  const { month, end } = monthRange(ym);
  const { data: auth } = await supabase.auth.getUser();

  const values = {
    month,
    status: "fechado",
    opening: input.opening as Json,
    inflows: input.flows.inflows as Json,
    outflows: input.flows.outflows as Json,
    expected: input.expected as Json,
    counted: input.counted as Json,
    difference: input.difference,
    difference_reason: input.differenceReason,
    total_in: input.flows.totalIn,
    company_out: input.flows.companyOut,
    result: d.result,
    previous_loss: d.previousLoss,
    reserve_amount: d.reserveAmount,
    reserve_spent: input.flows.reserveSpent,
    reserve_balance: input.reserveBalance,
    distributable: d.distributable,
    loss_carry: d.lossCarry,
    partner_shares: d.shares as unknown as Json,
    notes: input.notes,
    closed_by: auth.user?.id ?? null,
    closed_at: new Date().toISOString(),
  };

  const { data: closing, error } = input.existing
    ? await supabase
        .from("cash_closings")
        .update(values)
        .eq("id", input.existing.id)
        .eq("status", "reaberto")
        .select()
        .single()
    : await supabase.from("cash_closings").insert(values).select().single();
  if (error) {
    if (error.code === "23505") throw new Error(`${monthLabel(ym)} já foi fechado.`);
    throw new Error(error.message);
  }

  const payouts = d.shares
    .filter((s) => s.payout > 0)
    .map((s) => ({
      kind: "saida",
      category: "distribuicao_lucro",
      description: `Distribuição de lucro · ${s.name} · ${monthLabel(ym)}`,
      amount: s.payout,
      occurred_on: end,
      payment_method: s.payment_method,
      cash_closing_id: closing.id,
    }));
  const generated = [
    ...payouts,
    ...input.adjustments.map((a) => ({ ...a, cash_closing_id: closing.id })),
  ];
  if (generated.length) {
    const { error: txErr } = await supabase.from("transactions").insert(generated);
    if (txErr) {
      // desfaz o fechamento para não ficar fechado sem os lançamentos
      if (input.existing)
        await supabase.from("cash_closings").update({ status: "reaberto" }).eq("id", closing.id);
      else await supabase.from("cash_closings").delete().eq("id", closing.id);
      throw new Error(txErr.message);
    }
  }
  return closing;
}

/**
 * Reabre o fechamento: remove as distribuições e sobras/quebras lançadas por ele e registra
 * quem reabriu, quando e por quê.
 */
export async function reopenMonth(closing: CashClosing, reason: string) {
  const { data: auth } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { error: txErr } = await supabase
    .from("transactions")
    .delete()
    .eq("cash_closing_id", closing.id);
  if (txErr) throw new Error(txErr.message);

  const history = Array.isArray(closing.reopen_history) ? closing.reopen_history : [];
  const { error } = await supabase
    .from("cash_closings")
    .update({
      status: "reaberto",
      reopened_by: auth.user?.id ?? null,
      reopened_at: now,
      reopen_reason: reason,
      reopen_history: [
        ...history,
        { at: now, by: auth.user?.id ?? null, reason, closed_at: closing.closed_at },
      ] as Json,
    })
    .eq("id", closing.id)
    .eq("status", "fechado");
  if (error) throw new Error(error.message);
}
