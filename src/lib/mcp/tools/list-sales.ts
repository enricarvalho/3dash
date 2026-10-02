import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_sales",
  title: "Listar vendas",
  description: "Lista as vendas registradas, com data, valor, custo e margem.",
  inputSchema: {
    from: z.string().optional().describe("Data inicial (YYYY-MM-DD)."),
    to: z.string().optional().describe("Data final (YYYY-MM-DD)."),
    limit: z.number().int().optional().describe("Máximo de vendas (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("sales")
      .select("id,sale_date,status,total,cost_total,discount,payment_method,customer_id,guest_name")
      .order("sale_date", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (from) q = q.gte("sale_date", from);
    if (to) q = q.lte("sale_date", to);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const items = (data ?? []).map((s) => ({
      ...s,
      profit: Number((s.total ?? 0) - (s.cost_total ?? 0)),
    }));
    return jsonResult({
      count: items.length,
      revenue: items.reduce((a, s) => a + (s.total ?? 0), 0),
      profit: items.reduce((a, s) => a + s.profit, 0),
      items,
    });
  },
});
