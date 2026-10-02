import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_parts",
  title: "Listar peças",
  description:
    "Lista as peças cadastradas com custo estimado, preço de venda, tempo de impressão e gramas de material.",
  inputSchema: {
    search: z.string().optional().describe("Filtro por nome da peça."),
    limit: z.number().int().optional().describe("Máximo de peças (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("parts")
      .select(
        "id,name,category,estimated_cost,sale_price,print_minutes,material_grams,stock_quantity",
      )
      .order("name")
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const items = (data ?? []).map((p) => ({
      ...p,
      margin: Number((p.sale_price ?? 0) - (p.estimated_cost ?? 0)),
    }));
    return jsonResult({ count: items.length, items });
  },
});
