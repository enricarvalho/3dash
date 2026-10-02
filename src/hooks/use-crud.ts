import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type TableName =
  | "materials"
  | "customers"
  | "parts"
  | "quotes"
  | "quote_items"
  | "transactions"
  | "stock_movements"
  | "profiles"
  | "sales"
  | "sale_items"
  | "assets"
  | "printers"
  | "printer_maintenances"
  | "partners";

export function useSaveRecord(table: TableName, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase.from(table) as any;
      const query = id
        ? client.update(values).eq("id", id).select().single()
        : client.insert(values).select().single();
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    },

    onSuccess: (_d, vars) => {
      [table, ...invalidate].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      toast.success(vars.id ? "Registro atualizado" : "Registro criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRecord(table: TableName, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      [table, ...invalidate].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      toast.success("Registro excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
