-- Fechamento de caixa mensal: divisão do resultado entre os sócios e conferência por forma de pagamento
CREATE TABLE IF NOT EXISTS public.cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  month date NOT NULL UNIQUE CHECK (extract(day FROM month) = 1),
  status text NOT NULL DEFAULT 'fechado' CHECK (status IN ('fechado','reaberto')),
  -- valores por forma de pagamento: {"pix": 100, "dinheiro": 50, ...}
  opening jsonb NOT NULL DEFAULT '{}'::jsonb,
  inflows jsonb NOT NULL DEFAULT '{}'::jsonb,
  outflows jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected jsonb NOT NULL DEFAULT '{}'::jsonb,
  counted jsonb NOT NULL DEFAULT '{}'::jsonb,
  difference numeric(12,2) NOT NULL DEFAULT 0,
  difference_reason text,
  total_in numeric(12,2) NOT NULL DEFAULT 0,
  company_out numeric(12,2) NOT NULL DEFAULT 0,
  result numeric(12,2) NOT NULL DEFAULT 0,
  previous_loss numeric(12,2) NOT NULL DEFAULT 0,
  reserve_amount numeric(12,2) NOT NULL DEFAULT 0,
  reserve_spent numeric(12,2) NOT NULL DEFAULT 0,
  reserve_balance numeric(12,2) NOT NULL DEFAULT 0,
  distributable numeric(12,2) NOT NULL DEFAULT 0,
  loss_carry numeric(12,2) NOT NULL DEFAULT 0,
  -- divisão por sócio (cota, descontos, valor pago, saldo devedor)
  partner_shares jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  closed_by uuid DEFAULT auth.uid(),
  closed_at timestamptz NOT NULL DEFAULT now(),
  reopened_by uuid,
  reopened_at timestamptz,
  reopen_reason text,
  reopen_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_closings TO authenticated;
GRANT ALL ON public.cash_closings TO service_role;
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access cash_closings" ON public.cash_closings FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_cash_closings_updated_at BEFORE UPDATE ON public.cash_closings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lançamentos de distribuição gerados pelo fechamento (removidos ao reabrir)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS cash_closing_id uuid REFERENCES public.cash_closings(id) ON DELETE SET NULL;
-- Investimento pago com a reserva: não conta como gasto do mês
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_from_reserve boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS transactions_cash_closing_id_idx ON public.transactions(cash_closing_id);
