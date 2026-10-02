-- Shared team visibility for all authenticated users
DROP POLICY IF EXISTS "own assets" ON public.assets;
DROP POLICY IF EXISTS "own asset events" ON public.asset_events;
DROP POLICY IF EXISTS "own customers" ON public.customers;
DROP POLICY IF EXISTS "own materials" ON public.materials;
DROP POLICY IF EXISTS "own movements" ON public.stock_movements;
DROP POLICY IF EXISTS "own parts" ON public.parts;
DROP POLICY IF EXISTS "own quotes" ON public.quotes;
DROP POLICY IF EXISTS "own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "own quote status history" ON public.quote_status_history;
DROP POLICY IF EXISTS "own quote audit" ON public.quote_audit_log;
DROP POLICY IF EXISTS "own sales" ON public.sales;
DROP POLICY IF EXISTS "own sale items" ON public.sale_items;
DROP POLICY IF EXISTS "own transactions" ON public.transactions;
DROP POLICY IF EXISTS "own profile" ON public.profiles;

CREATE POLICY "team assets" ON public.assets FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team asset events" ON public.asset_events FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team materials" ON public.materials FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team movements" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team parts" ON public.parts FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team quotes" ON public.quotes FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team quote items" ON public.quote_items FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team quote status history" ON public.quote_status_history FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team quote audit" ON public.quote_audit_log FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team sale items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "team transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "profiles readable by team" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets, public.asset_events, public.customers, public.materials, public.stock_movements, public.parts, public.quotes, public.quote_items, public.quote_status_history, public.quote_audit_log, public.sales, public.sale_items, public.transactions, public.profiles TO authenticated;
GRANT ALL ON public.assets, public.asset_events, public.customers, public.materials, public.stock_movements, public.parts, public.quotes, public.quote_items, public.quote_status_history, public.quote_audit_log, public.sales, public.sale_items, public.transactions, public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.materials SET quantity = quantity + NEW.quantity WHERE id = NEW.material_id;
  RETURN NEW;
END; $function$;