import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_quotes",
  title: "Listar orçamentos",
  description: "Lista os orçamentos com título, status, valor total e cliente vinculado.",
  inputSchema: {
    status: z.string().optional().describe("Filtrar por status do orçamento."),
    limit: z.number().int().optional().describe("Máximo de orçamentos (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("quotes")
      .select("id,title,status,total,notes,customer_id,created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});
