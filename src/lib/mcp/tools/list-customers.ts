import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_customers",
  title: "Listar clientes",
  description: "Lista os clientes cadastrados, com contato, documento e cidade.",
  inputSchema: {
    search: z.string().optional().describe("Filtro por nome do cliente."),
    limit: z.number().int().optional().describe("Máximo de clientes (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("customers")
      .select("id,name,kind,doc_number,email,phone,city,state,status")
      .order("name")
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});
