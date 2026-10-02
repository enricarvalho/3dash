import { supabase } from "@/integrations/supabase/client";
import { diffFields, type QuoteChange } from "@/lib/quote-audit";

export type SaleChange = QuoteChange;

export type SaleAuditAction = "create" | "update" | "items" | "finance" | "cancel" | "delete";

export type SaleAuditEntry = {
  id: string;
  sale_id: string;
  sale_label: string | null;
  action: string;
  changes: SaleChange[];
  changed_by: string;
  created_at: string;
};

export const SALE_AUDIT_ACTION_LABEL: Record<string, string> = {
  create: "Venda registrada",
  update: "Dados editados",
  items: "Itens alterados",
  finance: "Lançamento financeiro",
  cancel: "Venda cancelada",
  delete: "Venda excluída",
};

export const SALE_FIELD_LABELS: Record<string, string> = {
  customer_label: "Cliente",
  sale_date: "Data da venda",
  status: "Status",
  payment_method: "Forma de pagamento",
  discount: "Desconto (R$)",
  total: "Total (R$)",
  cost_total: "Custo (R$)",
  notes: "Observações",
};

export { diffFields };

/** Registra uma alteração da venda com autor e data (auditoria). */
export async function logSaleAudit(params: {
  saleId: string;
  action: SaleAuditAction;
  changes?: SaleChange[];
  saleLabel?: string | null;
}) {
  const { error } = await supabase.from("sale_audit_log").insert({
    sale_id: params.saleId,
    sale_label: params.saleLabel ?? null,
    action: params.action,
    changes: (params.changes ?? []) as unknown as never,
  });
  if (error) console.error("Falha ao registrar auditoria da venda:", error.message);
}

export async function listSaleAudit(saleId: string): Promise<SaleAuditEntry[]> {
  const { data, error } = await supabase
    .from("sale_audit_log")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    changes: Array.isArray(row.changes) ? (row.changes as unknown as SaleChange[]) : [],
  })) as SaleAuditEntry[];
}

/** Eventos de exclusão/cancelamento de vendas (inclusive de vendas já removidas). */
export async function listSaleRemovalAudit(): Promise<SaleAuditEntry[]> {
  const { data, error } = await supabase
    .from("sale_audit_log")
    .select("*")
    .in("action", ["delete", "cancel"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    changes: Array.isArray(row.changes) ? (row.changes as unknown as SaleChange[]) : [],
  })) as SaleAuditEntry[];
}
