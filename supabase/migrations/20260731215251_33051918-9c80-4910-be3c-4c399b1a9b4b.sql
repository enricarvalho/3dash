CREATE TABLE public.stock_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_categories TO authenticated;
GRANT ALL ON public.stock_categories TO service_role;

ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their stock categories"
ON public.stock_categories FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER update_stock_categories_updated_at
BEFORE UPDATE ON public.stock_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.stock_categories (owner_id, slug, name)
SELECT p.id, d.slug, d.name
FROM public.profiles p
CROSS JOIN (VALUES
  ('material','Materiais'),
  ('embalagem','Embalagem'),
  ('ferramenta','Ferramenta'),
  ('acessorio','Acessório'),
  ('outro','Outro')
) AS d(slug, name)
ON CONFLICT (owner_id, slug) DO NOTHING;