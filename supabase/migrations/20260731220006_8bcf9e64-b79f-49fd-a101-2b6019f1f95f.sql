ALTER TABLE public.stock_categories ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'estoque';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_categories_owner_id_slug_key') THEN
    ALTER TABLE public.stock_categories DROP CONSTRAINT stock_categories_owner_id_slug_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS stock_categories_owner_kind_slug_key
  ON public.stock_categories (owner_id, kind, slug);

INSERT INTO public.stock_categories (owner_id, kind, slug, name, active)
SELECT DISTINCT c.owner_id, 'peca', d.slug, d.name, true
FROM public.stock_categories c
CROSS JOIN (VALUES
  ('personalizado', 'Personalizado'),
  ('decoracao', 'Decoração'),
  ('funcional', 'Funcional'),
  ('prototipo', 'Protótipo'),
  ('reposicao', 'Reposição')
) AS d(slug, name)
ON CONFLICT DO NOTHING;