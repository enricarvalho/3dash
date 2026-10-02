CREATE OR REPLACE FUNCTION public.guard_cash_closings_order()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
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
     AND NOT EXISTS (SELECT 1 FROM public.cash_closings
                     WHERE month = (NEW.month - interval '1 month')::date AND status = 'fechado') THEN
    RAISE EXCEPTION 'Feche o mês anterior antes deste.' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS guard_cash_closings_order ON public.cash_closings;
CREATE TRIGGER guard_cash_closings_order BEFORE INSERT OR UPDATE OR DELETE ON public.cash_closings
FOR EACH ROW EXECUTE FUNCTION public.guard_cash_closings_order();

REVOKE ALL ON FUNCTION public.month_is_closed(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.month_is_closed(date) TO authenticated;