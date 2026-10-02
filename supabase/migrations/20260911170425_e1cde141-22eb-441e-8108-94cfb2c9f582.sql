CREATE TABLE public.part_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_services TO authenticated;
GRANT ALL ON public.part_services TO service_role;
ALTER TABLE public.part_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own part services"
ON public.part_services
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
CREATE INDEX part_services_part_id_position_idx ON public.part_services(part_id, position);
CREATE TRIGGER update_part_services_updated_at
BEFORE UPDATE ON public.part_services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();