ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS transactions_sale_id_idx ON public.transactions(sale_id);
DELETE FROM public.transactions WHERE category = 'venda' AND sale_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.sales);