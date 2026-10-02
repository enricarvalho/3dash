DELETE FROM public.stock_categories WHERE kind = 'peca' AND slug IN ('funcional','reposicao');

INSERT INTO public.stock_categories (owner_id, kind, slug, name, active)
SELECT DISTINCT c.owner_id, 'peca', 'peca_tecnica', 'Peça técnica', true
FROM public.stock_categories c
ON CONFLICT DO NOTHING;