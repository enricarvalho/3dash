ALTER TABLE public.assets ADD COLUMN origin_printer_id uuid;

UPDATE public.assets SET origin_printer_id = printer_id WHERE printer_id IS NOT NULL;

-- Note: No FK constraint on origin_printer_id so it persists even if the printer is deleted.
