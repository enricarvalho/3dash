CREATE OR REPLACE FUNCTION public.month_is_closed(_d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _d IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.cash_closings
    WHERE status = 'fechado' AND month = date_trunc('month', _d)::date
  );
$$;

CREATE OR REPLACE FUNCTION public.raise_closed_month(_d date)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O caixa de %/% está fechado. Para alterar, reabra o mês na tela Fechamento.',
    to_char(_d, 'MM'), to_char(_d, 'YYYY') USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_transactions_closed_month()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.cash_closing_id IS NULL AND public.month_is_closed(OLD.occurred_on) THEN
    PERFORM public.raise_closed_month(OLD.occurred_on);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.cash_closing_id IS NULL AND public.month_is_closed(NEW.occurred_on) THEN
    PERFORM public.raise_closed_month(NEW.occurred_on);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS guard_transactions_closed_month ON public.transactions;
CREATE TRIGGER guard_transactions_closed_month BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_transactions_closed_month();

CREATE OR REPLACE FUNCTION public.guard_sales_closed_month()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND public.month_is_closed(OLD.sale_date)
     AND OLD.status = 'pendente' AND NEW.status = 'pago'
     AND NEW.sale_date = OLD.sale_date AND NEW.total = OLD.total
     AND NEW.discount = OLD.discount AND NEW.cost_total = OLD.cost_total
     AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND public.month_is_closed(OLD.sale_date) THEN
    PERFORM public.raise_closed_month(OLD.sale_date);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND public.month_is_closed(NEW.sale_date) THEN
    PERFORM public.raise_closed_month(NEW.sale_date);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS guard_sales_closed_month ON public.sales;
CREATE TRIGGER guard_sales_closed_month BEFORE INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.guard_sales_closed_month();

CREATE OR REPLACE FUNCTION public.guard_partner_withdrawals_closed_month()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND public.month_is_closed(OLD.withdrawn_on) THEN
    PERFORM public.raise_closed_month(OLD.withdrawn_on);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND public.month_is_closed(NEW.withdrawn_on) THEN
    PERFORM public.raise_closed_month(NEW.withdrawn_on);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS guard_partner_withdrawals_closed_month ON public.partner_withdrawals;
CREATE TRIGGER guard_partner_withdrawals_closed_month BEFORE INSERT OR UPDATE OR DELETE ON public.partner_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_partner_withdrawals_closed_month();