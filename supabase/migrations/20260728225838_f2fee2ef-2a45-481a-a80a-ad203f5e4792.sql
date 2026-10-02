REVOKE ALL ON FUNCTION public.log_printer_cost(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printers_cost_history_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.printer_maintenances_cost_history_trigger() FROM PUBLIC, anon, authenticated;