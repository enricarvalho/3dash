DO $$
DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['asset_events','assets','customers','materials','parts','quote_audit_log','quote_items','quote_status_history','quotes','sale_items','sales','stock_movements','transactions']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p, t);
    END LOOP;
    EXECUTE format($f$CREATE POLICY "team access %1$s" ON public.%1$I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)$f$, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "profiles readable by team" ON public.profiles;
CREATE POLICY "profiles readable by team" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE ALL ON public.profiles FROM anon;