-- Bloqueio de alterações em meses com caixa fechado.
-- Para corrigir algo, o mês precisa ser reaberto (tela Fechamento), com motivo registrado.

CREATE OR REPLACE FUNCTION public.month_is_closed(_d date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _d IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.cash_closings
    WHERE status = 'fechado' AND month = date_trunc('month', _d)::date
  );
$$;

CREATE OR REPLACE FUNCTION public.raise_closed_month(_d date)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'O caixa de %/% está fechado. Para alterar, reabra o mês na tela Fechamento.',
    to_char(_d, 'MM'), to_char(_d, 'YYYY')
    USING ERRCODE = 'P0001';
END;
$$;

-- Lançamentos do financeiro. Exceção: distribuições geradas pelo próprio fechamento
-- (cash_closing_id), que são criadas ao fechar e removidas ao reabrir.
CREATE OR REPLACE FUNCTION public.guard_transactions_closed_month()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.cash_closing_id IS NULL
     AND public.month_is_closed(OLD.occurred_on) THEN
    PERFORM public.raise_closed_month(OLD.occurred_on);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.cash_closing_id IS NULL
     AND public.month_is_closed(NEW.occurred_on) THEN
    PERFORM public.raise_closed_month(NEW.occurred_on);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_transactions_closed_month ON public.transactions;
CREATE TRIGGER guard_transactions_closed_month
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_transactions_closed_month();

-- Vendas. Exceção: registrar o pagamento de uma venda pendente (pendente → pago)
-- sem mudar valores; o recebimento entra no financeiro com a data do pagamento.
CREATE OR REPLACE FUNCTION public.guard_sales_closed_month()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND public.month_is_closed(OLD.sale_date)
     AND OLD.status = 'pendente' AND NEW.status = 'pago'
     AND NEW.sale_date = OLD.sale_date
     AND NEW.total = OLD.total
     AND NEW.discount = OLD.discount
     AND NEW.cost_total = OLD.cost_total
     AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND public.month_is_closed(OLD.sale_date) THEN
    PERFORM public.raise_closed_month(OLD.sale_date);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND public.month_is_closed(NEW.sale_date) THEN
    PERFORM public.raise_closed_month(NEW.sale_date);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_sales_closed_month ON public.sales;
CREATE TRIGGER guard_sales_closed_month
BEFORE INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.guard_sales_closed_month();

-- Retiradas de sócios
CREATE OR REPLACE FUNCTION public.guard_partner_withdrawals_closed_month()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND public.month_is_closed(OLD.withdrawn_on) THEN
    PERFORM public.raise_closed_month(OLD.withdrawn_on);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND public.month_is_closed(NEW.withdrawn_on) THEN
    PERFORM public.raise_closed_month(NEW.withdrawn_on);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_partner_withdrawals_closed_month ON public.partner_withdrawals;
CREATE TRIGGER guard_partner_withdrawals_closed_month
BEFORE INSERT OR UPDATE OR DELETE ON public.partner_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_partner_withdrawals_closed_month();

-- Fechamentos: só o último mês fechado pode ser reaberto ou removido, e um mês só fecha
-- se o anterior estiver fechado (exceto o primeiro fechamento).
CREATE OR REPLACE FUNCTION public.guard_cash_closings_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- só o último fechamento pode ser removido (usado para desfazer um fechamento que falhou)
    IF EXISTS (SELECT 1 FROM public.cash_closings WHERE month > OLD.month) THEN
      RAISE EXCEPTION 'Só o último fechamento pode ser removido.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.status = 'reaberto' AND (TG_OP = 'INSERT' OR OLD.status = 'fechado')
     AND EXISTS (SELECT 1 FROM public.cash_closings WHERE month > NEW.month) THEN
    RAISE EXCEPTION 'Só o último mês fechado pode ser reaberto.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = 'fechado' AND (TG_OP = 'INSERT' OR OLD.status <> 'fechado')
     AND EXISTS (SELECT 1 FROM public.cash_closings WHERE id <> NEW.id)
     AND NOT EXISTS (
       SELECT 1 FROM public.cash_closings
       WHERE month = (NEW.month - interval '1 month')::date AND status = 'fechado'
     ) THEN
    RAISE EXCEPTION 'Feche o mês anterior antes deste.' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_cash_closings_order ON public.cash_closings;
CREATE TRIGGER guard_cash_closings_order
BEFORE INSERT OR UPDATE OR DELETE ON public.cash_closings
FOR EACH ROW EXECUTE FUNCTION public.guard_cash_closings_order();

REVOKE ALL ON FUNCTION public.month_is_closed(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.month_is_closed(date) TO authenticated;
