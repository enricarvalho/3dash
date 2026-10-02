import type { Tables } from "@/integrations/supabase/types";

export type Printer = Tables<"printers">;
export type PrinterMaintenance = Tables<"printer_maintenances">;
export type PrinterCostPoint = Tables<"printer_cost_history">;

export const PRINTER_STATUSES = ["ativa", "manutencao", "inativa"] as const;
export const PRINTER_STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  manutencao: "Em manutenção",
  inativa: "Inativa",
};

export const MAINTENANCE_TYPES = ["preventiva", "corretiva"] as const;
export const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
};

export const LIFE_SCENARIOS = [
  {
    value: "conservador",
    label: "Conservador",
    hours: 5000,
    hint: "Uso severo, sem manutenção regular",
  },
  {
    value: "padrao",
    label: "Padrão da indústria",
    hours: 10000,
    hint: "Uso normal + manutenção preventiva",
  },
  {
    value: "otimista",
    label: "Otimista",
    hours: 15000,
    hint: "Uso leve + trocas pontuais",
  },
  {
    value: "personalizado",
    label: "Personalizado",
    hours: null,
    hint: "Defina as horas manualmente",
  },
] as const;

export const SCENARIO_LABEL: Record<string, string> = Object.fromEntries(
  LIFE_SCENARIOS.map((s) => [s.value, s.label]),
);

/** Custo de máquina por hora = valor de compra / vida útil em horas. */
export const machineCostPerHour = (valorCompra: number, vidaUtilHoras: number) =>
  vidaUtilHoras > 0 ? valorCompra / vidaUtilHoras : 0;

/** Custo de manutenção por hora = soma das manutenções previstas / vida útil. */
export const maintenanceCostPerHour = (
  maintenances: { custo_estimado: number | string }[],
  vidaUtilHoras: number,
) => {
  const total = maintenances.reduce((s, m) => s + (Number(m.custo_estimado) || 0), 0);
  return vidaUtilHoras > 0 ? total / vidaUtilHoras : 0;
};

/** Custo de energia por hora = (W / 1000) × tarifa kWh. */
export const energyCostPerHour = (watts: number | null | undefined, kwhPrice: number) =>
  ((Number(watts) || 0) / 1000) * (Number(kwhPrice) || 0);

export type PrinterCosts = {
  machine: number;
  maintenance: number;
  energy: number;
  total: number;
};

export const printerCosts = (
  printer: Pick<Printer, "valor_compra" | "vida_util_horas" | "potencia_watts">,
  maintenances: { custo_estimado: number | string }[] = [],
  kwhPrice = 0,
): PrinterCosts => {
  const life = Number(printer.vida_util_horas) || 0;
  const machine = machineCostPerHour(Number(printer.valor_compra) || 0, life);
  const maintenance = maintenanceCostPerHour(maintenances, life);
  const energy = energyCostPerHour(printer.potencia_watts, kwhPrice);
  return { machine, maintenance, energy, total: machine + maintenance + energy };
};

/** % da vida útil já consumida. */
export const lifeUsedPct = (horasAcumuladas: number, vidaUtilHoras: number) =>
  vidaUtilHoras > 0 ? Math.min(100, (horasAcumuladas / vidaUtilHoras) * 100) : 0;

/** Manutenções cujo intervalo de horas já foi ultrapassado. */
export const overdueMaintenances = (maintenances: PrinterMaintenance[], extraHours = 0) =>
  maintenances.filter((m) => {
    const period = Number(m.periodicidade_horas) || 0;
    if (!period) return false;
    return (Number(m.horas_desde_ultima) || 0) + extraHours >= period;
  });
