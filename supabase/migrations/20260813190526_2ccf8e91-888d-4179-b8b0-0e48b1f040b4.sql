ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS image_url text;

CREATE OR REPLACE FUNCTION public.sync_printer_hours_from_part()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_hours numeric := 0;
  new_hours numeric := 0;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.printer_id IS NOT NULL THEN
    old_hours := (COALESCE(OLD.print_minutes, 0) / 60.0) * GREATEST(COALESCE(OLD.stock_quantity, 0), 1);
    UPDATE public.printers
       SET horas_acumuladas = GREATEST(0, COALESCE(horas_acumuladas, 0) - old_hours)
     WHERE id = OLD.printer_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.printer_id IS NOT NULL THEN
    new_hours := (COALESCE(NEW.print_minutes, 0) / 60.0) * GREATEST(COALESCE(NEW.stock_quantity, 0), 1);
    UPDATE public.printers
       SET horas_acumuladas = GREATEST(0, COALESCE(horas_acumuladas, 0) + new_hours)
     WHERE id = NEW.printer_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.printers p
   SET horas_acumuladas = COALESCE((
     SELECT SUM((COALESCE(pa.print_minutes, 0) / 60.0) * GREATEST(COALESCE(pa.stock_quantity, 0), 1))
       FROM public.parts pa
      WHERE pa.printer_id = p.id
   ), 0);