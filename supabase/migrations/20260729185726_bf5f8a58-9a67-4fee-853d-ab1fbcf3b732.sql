CREATE TABLE public.sale_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'update',
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_audit_log TO authenticated;
GRANT ALL ON public.sale_audit_log TO service_role;

ALTER TABLE public.sale_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team access sale_audit_log" ON public.sale_audit_log
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX sale_audit_log_sale_id_idx ON public.sale_audit_log (sale_id, created_at DESC);