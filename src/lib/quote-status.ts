import { supabase } from "@/integrations/supabase/client";
import { QUOTE_STATUSES } from "@/lib/domain";

export type QuoteStatusEvent = {
  id: string;
  quote_id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  changed_by: string;
  created_at: string;
};

/** Fluxo sugerido: quais status fazem sentido a partir do atual. */
export const QUOTE_STATUS_FLOW: Record<string, string[]> = {
  rascunho: ["enviado", "recusado"],
  enviado: ["aprovado", "recusado", "rascunho"],
  aprovado: ["em_producao", "recusado"],
  recusado: ["rascunho", "enviado"],
  em_producao: ["concluido", "aprovado"],
  concluido: [],
};

export const nextStatuses = (current: string) =>
  QUOTE_STATUS_FLOW[current] ?? QUOTE_STATUSES.filter((s) => s !== current);

export async function listQuoteStatusHistory(quoteId: string): Promise<QuoteStatusEvent[]> {
  const { data, error } = await supabase
    .from("quote_status_history")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuoteStatusEvent[];
}

/** Registra uma mudança de status com data e usuário responsável. */
export async function logQuoteStatus(params: {
  quoteId: string;
  from: string | null;
  to: string;
  note?: string | null;
}) {
  const { error } = await supabase.from("quote_status_history").insert({
    quote_id: params.quoteId,
    from_status: params.from,
    to_status: params.to,
    note: params.note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
