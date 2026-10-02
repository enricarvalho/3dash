CREATE TABLE public.asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'manutencao',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  quantity_delta numeric NOT NULL DEFAULT 0,
  location text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_events TO authenticated;
GRANT ALL ON public.asset_events TO service_role;

ALTER TABLE public.asset_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own asset events" ON public.asset_events
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX asset_events_asset_id_idx ON public.asset_events (asset_id, event_date DESC);

CREATE TRIGGER update_asset_events_updated_at
  BEFORE UPDATE ON public.asset_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();