-- Forma de pagamento nos lançamentos do financeiro (base para o fechamento de caixa)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method text;

-- Lançamentos gerados por vendas herdam a forma de pagamento da venda
UPDATE public.transactions t
SET payment_method = s.payment_method
FROM public.sales s
WHERE t.sale_id = s.id
  AND t.payment_method IS NULL;

CREATE INDEX IF NOT EXISTS transactions_occurred_on_idx ON public.transactions(occurred_on);
