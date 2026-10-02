import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "financial_summary",
  title: "Resumo financeiro",
  description:
    "Resumo do fluxo de caixa em um período: total de entradas, saídas, saldo e totais por categoria.",
  inputSchema: {
    from: z.string().optional().describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().optional().describe("Data final (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let q = supabase.from("transactions").select("kind,category,amount,occurred_on");
    if (from) q = q.gte("occurred_on", from);
    if (to) q = q.lte("occurred_on", to);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const rows = data ?? [];
    // o financeiro grava kind = "entrada" | "saida"
    const sum = (list: typeof rows) => list.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const entradas = rows.filter((r) => r.kind === "entrada");
    const saidas = rows.filter((r) => r.kind === "saida");
    const income = sum(entradas);
    const expense = sum(saidas);
    // separado por tipo: a mesma categoria (ex.: "outros") existe nos dois lados
    const byCategory = (list: typeof rows) => {
      const out: Record<string, number> = {};
      for (const r of list) out[r.category] = (out[r.category] ?? 0) + (Number(r.amount) || 0);
      return out;
    };
    return jsonResult({
      period: { from: from ?? null, to: to ?? null },
      entries: rows.length,
      income,
      expense,
      balance: income - expense,
      by_category: { income: byCategory(entradas), expense: byCategory(saidas) },
    });
  },
});
