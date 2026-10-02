CREATE TABLE public.printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL,
  marca text,
  modelo text,
  data_aquisicao date,
  valor_compra numeric(12,2) NOT NULL DEFAULT 0,
  cenario text NOT NULL DEFAULT 'padrao' CHECK (cenario IN ('conservador','padrao','otimista','personalizado')),
  vida_util_horas numeric(12,2) NOT NULL DEFAULT 10000,
  potencia_watts numeric(12,2),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','manutencao','inativa')),
  horas_acumuladas numeric(12,2) NOT NULL DEFAULT 0,
  custo_hora_maquina numeric(12,4) GENERATED ALWAYS AS (valor_compra / nullif(vida_util_horas,0)) STORED,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printers TO authenticated;
GRANT ALL ON public.printers TO service_role;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access printers" ON public.printers FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON public.printers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.printer_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  printer_id uuid NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'preventiva' CHECK (tipo IN ('preventiva','corretiva')),
  descricao text NOT NULL,
  periodicidade_horas numeric(12,2),
  custo_estimado numeric(12,2) NOT NULL DEFAULT 0,
  data_ultima date,
  horas_desde_ultima numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_maintenances TO authenticated;
GRANT ALL ON public.printer_maintenances TO service_role;
ALTER TABLE public.printer_maintenances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access printer_maintenances" ON public.printer_maintenances FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_printer_maintenances_updated_at BEFORE UPDATE ON public.printer_maintenances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.printer_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  printer_id uuid NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  custo_hora_maquina numeric(12,4) NOT NULL DEFAULT 0,
  custo_hora_manutencao numeric(12,4) NOT NULL DEFAULT 0,
  custo_hora_total numeric(12,4) NOT NULL DEFAULT 0,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.printer_cost_history TO authenticated;
GRANT ALL ON public.printer_cost_history TO service_role;
ALTER TABLE public.printer_cost_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team access printer_cost_history" ON public.printer_cost_history FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_printer_maintenances_printer ON public.printer_maintenances(printer_id);
CREATE INDEX idx_printer_cost_history_printer ON public.printer_cost_history(printer_id, created_at);

ALTER TABLE public.parts ADD COLUMN printer_id uuid REFERENCES public.printers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.log_printer_cost(_printer_id uuid, _motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  manut numeric := 0;
  maq numeric := 0;
BEGIN
  SELECT * INTO p FROM public.printers WHERE id = _printer_id;
  IF NOT FOUND THEN RETURN; END IF;
  maq := COALESCE(p.custo_hora_maquina, 0);
  SELECT COALESCE(SUM(custo_estimado), 0) / NULLIF(p.vida_util_horas, 0)
    INTO manut FROM public.printer_maintenances WHERE printer_id = _printer_id;
  manut := COALESCE(manut, 0);
  INSERT INTO public.printer_cost_history (owner_id, printer_id, custo_hora_maquina, custo_hora_manutencao, custo_hora_total, motivo)
  VALUES (p.owner_id, _printer_id, maq, manut, maq + manut, _motivo);
END; $$;

CREATE OR REPLACE FUNCTION public.printers_cost_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_printer_cost(NEW.id, 'cadastro');
  ELSIF NEW.valor_compra IS DISTINCT FROM OLD.valor_compra
     OR NEW.vida_util_horas IS DISTINCT FROM OLD.vida_util_horas THEN
    PERFORM public.log_printer_cost(NEW.id, 'atualizacao da impressora');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER printers_cost_history AFTER INSERT OR UPDATE ON public.printers
FOR EACH ROW EXECUTE FUNCTION public.printers_cost_history_trigger();

CREATE OR REPLACE FUNCTION public.printer_maintenances_cost_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_printer_cost(OLD.printer_id, 'manutencao removida');
    RETURN OLD;
  END IF;
  PERFORM public.log_printer_cost(NEW.printer_id, 'manutencao ' || TG_OP);
  RETURN NEW;
END; $$;

CREATE TRIGGER printer_maintenances_cost_history AFTER INSERT OR UPDATE OR DELETE ON public.printer_maintenances
FOR EACH ROW EXECUTE FUNCTION public.printer_maintenances_cost_history_trigger();