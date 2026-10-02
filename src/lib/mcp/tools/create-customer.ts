import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "create_customer",
  title: "Cadastrar cliente",
  description: "Cadastra um novo cliente na 3D Create.",
  inputSchema: {
    name: z.string().trim().describe("Nome do cliente ou razão social."),
    kind: z.enum(["pf", "pj"]).optional().describe("Pessoa física (pf) ou jurídica (pj)."),
    email: z.string().optional(),
    phone: z.string().optional(),
    doc_number: z.string().optional().describe("CPF ou CNPJ."),
    city: z.string().optional(),
    state: z.string().optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    if (!input.name.trim()) return errorResult("O nome do cliente é obrigatório.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...input, kind: input.kind ?? "pf", owner_id: ctx.getUserId() })
      .select("id,name,kind,email,phone")
      .maybeSingle();
    if (error) return errorResult(error.message);
    return jsonResult({ customer: data });
  },
});
