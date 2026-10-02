CREATE TABLE public.quote_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  quote_id uuid NOT NULL,
  action text NOT NULL DEFAULT 'update',
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_audit_log TO authenticated;
GRANT ALL ON public.quote_audit_log TO service_role;

ALTER TABLE public.quote_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own quote audit" ON public.quote_audit_log
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX quote_audit_log_quote_id_idx ON public.quote_audit_log (quote_id, created_at DESC);