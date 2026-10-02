import { supabase } from "@/integrations/supabase/client";

export type QuoteChange = {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
};

export type QuoteAuditAction =
  | "create"
  | "update"
  | "status"
  | "item_add"
  | "item_remove"
  | "finance"
  | "production"
  | "delete";

export type QuoteAuditEntry = {
  id: string;
  quote_id: string;
  action: string;
  changes: QuoteChange[];
  changed_by: string;
  created_at: string;
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: "Orçamento criado",
  update: "Dados editados",
  status: "Status alterado",
  item_add: "Item adicionado",
  item_remove: "Item removido",
  finance: "Lançamento financeiro",
  production: "Enviado para produção",
  delete: "Orçamento excluído",
};

/** Compara dois objetos e devolve apenas os campos alterados. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): QuoteChange[] {
  const out: QuoteChange[] = [];
  for (const field of Object.keys(labels)) {
    const from = before[field];
    const to = after[field];
    const a = from === null || from === undefined ? "" : String(from);
    const b = to === null || to === undefined ? "" : String(to);
    if (a === b) continue;
    out.push({ field, label: labels[field], from: a || null, to: b || null });
  }
  return out;
}

/** Registra uma alteração do orçamento com autor e data (auditoria). */
export async function logQuoteAudit(params: {
  quoteId: string;
  action: QuoteAuditAction;
  changes?: QuoteChange[];
}) {
  const { error } = await supabase.from("quote_audit_log").insert({
    quote_id: params.quoteId,
    action: params.action,
    changes: (params.changes ?? []) as unknown as never,
  });
  if (error) console.error("Falha ao registrar auditoria:", error.message);
}

export async function listQuoteAudit(quoteId: string): Promise<QuoteAuditEntry[]> {
  const { data, error } = await supabase
    .from("quote_audit_log")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    changes: Array.isArray(row.changes) ? (row.changes as unknown as QuoteChange[]) : [],
  })) as QuoteAuditEntry[];
}
