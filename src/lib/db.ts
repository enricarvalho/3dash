import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Material = Tables<"materials">;
export type StockMovement = Tables<"stock_movements">;
export type Customer = Tables<"customers">;
export type Part = Tables<"parts">;
export type Quote = Tables<"quotes">;
export type QuoteItem = Tables<"quote_items">;
export type Transaction = Tables<"transactions">;

const unwrap = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
};

export const listMaterials = async () =>
  unwrap<Material[]>(await supabase.from("materials").select("*").order("name"));

export const listMovements = async (materialId?: string) => {
  let q = supabase.from("stock_movements").select("*").order("created_at", { ascending: false });
  if (materialId) q = q.eq("material_id", materialId);
  return unwrap<StockMovement[]>(await q);
};

export const listCustomers = async () =>
  unwrap<Customer[]>(await supabase.from("customers").select("*").order("name"));

export const listParts = async () =>
  unwrap<Part[]>(await supabase.from("parts").select("*").order("name"));

export const listQuotes = async () =>
  unwrap<Quote[]>(await supabase.from("quotes").select("*").order("created_at", { ascending: false }));

export const listQuoteItems = async (quoteId?: string) => {
  let q = supabase.from("quote_items").select("*").order("created_at");
  if (quoteId) q = q.eq("quote_id", quoteId);
  return unwrap<QuoteItem[]>(await q);
};

export const listTransactions = async () =>
  unwrap<Transaction[]>(
    await supabase.from("transactions").select("*").order("occurred_on", { ascending: false }),
  );

export const getQuote = async (id: string) => {
  const res = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

export const getCustomer = async (id: string) => {
  const res = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data;
};

export type Sale = Tables<"sales">;
export type SaleItem = Tables<"sale_items">;
export type Asset = Tables<"assets">;

export const listSales = async () =>
  unwrap<Sale[]>(
    await supabase.from("sales").select("*").order("sale_date", { ascending: false }),
  );

export const listSaleItems = async (saleId?: string) => {
  let q = supabase.from("sale_items").select("*").order("created_at");
  if (saleId) q = q.eq("sale_id", saleId);
  return unwrap<SaleItem[]>(await q);
};

export const listAssets = async () =>
  unwrap<Asset[]>(await supabase.from("assets").select("*").order("name"));

export type AssetEvent = Tables<"asset_events">;

export const listAssetEvents = async (assetId: string) =>
  unwrap<AssetEvent[]>(
    await supabase
      .from("asset_events")
      .select("*")
      .eq("asset_id", assetId)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false }),
  );

export const getSale = async (id: string) => {
  const res = await supabase.from("sales").select("*").eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data as Sale | null;
};

export type Printer = Tables<"printers">;
export type PrinterMaintenance = Tables<"printer_maintenances">;
export type PrinterCostPoint = Tables<"printer_cost_history">;

export const listPrinters = async () =>
  unwrap<Printer[]>(await supabase.from("printers").select("*").order("nome"));

export const getPrinter = async (id: string) => {
  const res = await supabase.from("printers").select("*").eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data as Printer | null;
};

export const listPrinterMaintenances = async (printerId?: string) => {
  let q = supabase.from("printer_maintenances").select("*").order("created_at");
  if (printerId) q = q.eq("printer_id", printerId);
  return unwrap<PrinterMaintenance[]>(await q);
};

export const listPrinterCostHistory = async (printerId: string) =>
  unwrap<PrinterCostPoint[]>(
    await supabase
      .from("printer_cost_history")
      .select("*")
      .eq("printer_id", printerId)
      .order("created_at"),
  );

export type Partner = Tables<"partners">;
export type PartnerWithdrawal = Tables<"partner_withdrawals">;

export const listPartners = async () =>
  unwrap<Partner[]>(await supabase.from("partners").select("*").order("created_at"));

export const listPartnerWithdrawals = async () =>
  unwrap<PartnerWithdrawal[]>(
    await supabase
      .from("partner_withdrawals")
      .select("*")
      .order("withdrawn_on", { ascending: false })
      .order("created_at", { ascending: false }),
  );

export type CashClosing = Tables<"cash_closings">;

export const listCashClosings = async () =>
  unwrap<CashClosing[]>(
    await supabase.from("cash_closings").select("*").order("month", { ascending: false }),
  );
