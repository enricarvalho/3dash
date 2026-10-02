CREATE TABLE public.part_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  part_id uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  grams numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_materials TO authenticated;
GRANT ALL ON public.part_materials TO service_role;

ALTER TABLE public.part_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team access part_materials" ON public.part_materials
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX part_materials_part_id_idx ON public.part_materials(part_id);

CREATE TRIGGER update_part_materials_updated_at
  BEFORE UPDATE ON public.part_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.part_materials (owner_id, part_id, material_id, grams, position)
SELECT owner_id, id, material_id, material_grams, 0
FROM public.parts
WHERE material_id IS NOT NULL AND material_grams > 0;