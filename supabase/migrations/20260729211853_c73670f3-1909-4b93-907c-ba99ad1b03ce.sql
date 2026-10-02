ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS printer_id uuid REFERENCES public.printers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS assets_printer_id_idx ON public.assets(printer_id);