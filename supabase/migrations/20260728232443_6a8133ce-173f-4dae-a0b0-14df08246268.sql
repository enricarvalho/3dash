CREATE OR REPLACE FUNCTION public.sync_printer_hours_from_part()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_hours numeric := 0;
  new_hours numeric := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.printer_id IS NOT NULL THEN
    old_hours := COALESCE(OLD.print_minutes, 0) / 60.0;
    UPDATE public.printers
       SET horas_acumuladas = GREATEST(0, COALESCE(horas_acumuladas, 0) - old_hours)
     WHERE id = OLD.printer_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.printer_id IS NOT NULL THEN
    new_hours := COALESCE(NEW.print_minutes, 0) / 60.0;
    UPDATE public.printers
       SET horas_acumuladas = GREATEST(0, COALESCE(horas_acumuladas, 0) + new_hours)
     WHERE id = NEW.printer_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parts_sync_printer_hours ON public.parts;
CREATE TRIGGER parts_sync_printer_hours
AFTER INSERT OR DELETE ON public.parts
FOR EACH ROW EXECUTE FUNCTION public.sync_printer_hours_from_part();

DROP TRIGGER IF EXISTS parts_sync_printer_hours_update ON public.parts;
CREATE TRIGGER parts_sync_printer_hours_update
AFTER UPDATE OF printer_id, print_minutes ON public.parts
FOR EACH ROW
WHEN (OLD.printer_id IS DISTINCT FROM NEW.printer_id OR OLD.print_minutes IS DISTINCT FROM NEW.print_minutes)
EXECUTE FUNCTION public.sync_printer_hours_from_part();