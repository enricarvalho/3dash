import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_stock",
  title: "Listar estoque",
  description:
    "Lista os itens do estoque (filamentos e insumos) com quantidade, unidade, custo e estoque mínimo.",
  inputSchema: {
    search: z.string().optional().describe("Filtro por nome do item."),
    only_low: z.boolean().optional().describe("Retornar apenas itens abaixo do estoque mínimo."),
    limit: z.number().int().optional().describe("Máximo de itens (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, only_low, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("materials")
      .select("id,name,color,type,category,quantity,unit,min_quantity,cost_per_unit,supplier")
      .order("name")
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    const rows = only_low ? (data ?? []).filter((r) => r.quantity <= r.min_quantity) : (data ?? []);
    return jsonResult({ count: rows.length, items: rows });
  },
});
