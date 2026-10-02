-- Sócios e retiradas (base para a divisão do resultado no fechamento de caixa)
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  share_pct numeric(6,3) NOT NULL DEFAULT 33.333 CHECK (share_pct >= 0 AND share_pct <= 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access partners" ON public.partners FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  withdrawn_on date NOT NULL DEFAULT current_date,
  kind text NOT NULL CHECK (kind IN ('dinheiro','peca_estoque','peca_produzida','material')),
  description text NOT NULL,
  part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  suggested_amount numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_method text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_withdrawals TO authenticated;
GRANT ALL ON public.partner_withdrawals TO service_role;
ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access partner_withdrawals" ON public.partner_withdrawals FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_partner_withdrawals_partner ON public.partner_withdrawals(partner_id, withdrawn_on);
CREATE INDEX IF NOT EXISTS idx_partner_withdrawals_date ON public.partner_withdrawals(withdrawn_on);
