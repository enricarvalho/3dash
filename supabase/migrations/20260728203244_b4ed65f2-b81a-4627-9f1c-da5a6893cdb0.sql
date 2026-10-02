CREATE TABLE public.quote_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_status_history TO authenticated;
GRANT ALL ON public.quote_status_history TO service_role;

ALTER TABLE public.quote_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own quote status history" ON public.quote_status_history
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX quote_status_history_quote_id_idx ON public.quote_status_history (quote_id, created_at DESC);