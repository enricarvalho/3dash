import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PartService = Tables<"part_services">;
export type PartServiceInput = {
  description: string;
  quantity: number;
  unit_cost: number;
};

export const listPartServices = async (partId?: string) => {
  let query = supabase.from("part_services").select("*").order("position");
  if (partId) query = query.eq("part_id", partId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PartService[];
};

export const savePartServices = async (partId: string, services: PartServiceInput[]) => {
  const { error: deleteError } = await supabase
    .from("part_services")
    .delete()
    .eq("part_id", partId);
  if (deleteError) throw new Error(deleteError.message);

  const rows = services
    .filter((service) => service.description.trim() && service.quantity > 0)
    .map((service, position) => ({
      part_id: partId,
      description: service.description.trim(),
      quantity: service.quantity,
      unit_cost: Math.max(service.unit_cost, 0),
      position,
    }));
  if (!rows.length) return;

  const { error } = await supabase.from("part_services").insert(rows);
  if (error) throw new Error(error.message);
};