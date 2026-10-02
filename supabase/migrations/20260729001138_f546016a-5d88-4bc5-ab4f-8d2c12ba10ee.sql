ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assets_material_id_idx ON public.assets(material_id);
CREATE INDEX IF NOT EXISTS sale_items_material_id_idx ON public.sale_items(material_id);