ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS energy_price_kwh numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS printer_watts numeric NOT NULL DEFAULT 0;