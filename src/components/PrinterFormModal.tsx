import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import { supabase } from "@/integrations/supabase/client";
import { listPrinterMaintenances, type Printer } from "@/lib/db";
import { brl } from "@/lib/format";
import {
  LIFE_SCENARIOS,
  MAINTENANCE_TYPES,
  MAINTENANCE_TYPE_LABEL,
  PRINTER_STATUSES,
  PRINTER_STATUS_LABEL,
  machineCostPerHour,
  maintenanceCostPerHour,
  energyCostPerHour,
} from "@/lib/printers";

type MaintRow = {
  id?: string;
  tipo: string;
  descricao: string;
  periodicidade_horas: string;
  custo_estimado: string;
  data_ultima: string;
  horas_desde_ultima: string;
};

const emptyForm = {
  nome: "",
  marca: "",
  modelo: "",
  data_aquisicao: "",
  valor_compra: "0",
  cenario: "padrao",
  vida_util_horas: "10000",
  potencia_watts: "0",
  status: "ativa",
  horas_acumuladas: "0",
  observacoes: "",
};

const emptyMaint = (): MaintRow => ({
  tipo: "preventiva",
  descricao: "",
  periodicidade_horas: "",
  custo_estimado: "0",
  data_ultima: "",
  horas_desde_ultima: "0",
});

export function PrinterFormModal({
  open,
  printer,
  kwhPrice = 0,
  onOpenChange,
}: {
  open: boolean;
  printer: Printer | null;
  kwhPrice?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [maints, setMaints] = useState<MaintRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const existing = useQuery({
    queryKey: ["printer_maintenances", printer?.id],
    queryFn: () => listPrinterMaintenances(printer!.id),
    enabled: open && !!printer,
  });

  useEffect(() => {
    if (!open) return;
    setRemoved([]);
    if (printer) {
      setForm({
        nome: printer.nome,
        marca: printer.marca ?? "",
        modelo: printer.modelo ?? "",
        data_aquisicao: printer.data_aquisicao ?? "",
        valor_compra: String(printer.valor_compra ?? 0),
        cenario: printer.cenario,
        vida_util_horas: String(printer.vida_util_horas ?? 0),
        potencia_watts: String(printer.potencia_watts ?? 0),
        status: printer.status,
        horas_acumuladas: String(printer.horas_acumuladas ?? 0),
        observacoes: printer.observacoes ?? "",
      });
    } else {
      setForm({ ...emptyForm });
      setMaints([]);
    }
  }, [open, printer]);

  useEffect(() => {
    if (open && printer && existing.data) {
      setMaints(
        existing.data.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          descricao: m.descricao,
          periodicidade_horas: m.periodicidade_horas == null ? "" : String(m.periodicidade_horas),
          custo_estimado: String(m.custo_estimado ?? 0),
          data_ultima: m.data_ultima ?? "",
          horas_desde_ultima: String(m.horas_desde_ultima ?? 0),
        })),
      );
    }
  }, [open, printer, existing.data]);

  const life = Number(form.vida_util_horas) || 0;
  const machine = machineCostPerHour(Number(form.valor_compra) || 0, life);
  const maintenance = maintenanceCostPerHour(maints, life);
  const energy = energyCostPerHour(Number(form.potencia_watts) || 0, kwhPrice);
  const total = machine + maintenance + energy;

  const pickScenario = (value: string) => {
    const s = LIFE_SCENARIOS.find((x) => x.value === value);
    setForm((f) => ({
      ...f,
      cenario: value,
      vida_util_horas: s?.hours ? String(s.hours) : f.vida_util_horas,
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome da impressora");
      if (life <= 0) throw new Error("Informe a vida útil em horas");
      const values = {
        nome: form.nome.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        data_aquisicao: form.data_aquisicao || null,
        valor_compra: Number(form.valor_compra) || 0,
        cenario: form.cenario,
        vida_util_horas: life,
        potencia_watts: Number(form.potencia_watts) || null,
        status: form.status,
        horas_acumuladas: Number(form.horas_acumuladas) || 0,
        observacoes: form.observacoes.trim() || null,
      };

      let printerId = printer?.id;
      if (printerId) {
        const { error } = await supabase.from("printers").update(values).eq("id", printerId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("printers").insert(values).select().single();
        if (error) throw new Error(error.message);
        printerId = data.id;
      }

      if (removed.length) {
        const { error } = await supabase.from("printer_maintenances").delete().in("id", removed);
        if (error) throw new Error(error.message);
      }

      for (const m of maints) {
        if (!m.descricao.trim()) continue;
        const payload = {
          printer_id: printerId!,
          tipo: m.tipo,
          descricao: m.descricao.trim(),
          periodicidade_horas: m.periodicidade_horas ? Number(m.periodicidade_horas) : null,
          custo_estimado: Number(m.custo_estimado) || 0,
          data_ultima: m.data_ultima || null,
          horas_desde_ultima: Number(m.horas_desde_ultima) || 0,
        };
        const { error } = m.id
          ? await supabase.from("printer_maintenances").update(payload).eq("id", m.id)
          : await supabase.from("printer_maintenances").insert(payload);
        if (error) throw new Error(error.message);
      }
      return printerId!;
    },
    onSuccess: (id) => {
      ["printers", "printer_maintenances", "printer_cost_history"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
      qc.invalidateQueries({ queryKey: ["printers", id] });
      toast.success(printer ? "Impressora atualizada" : "Impressora cadastrada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMaint = (idx: number, patch: Partial<MaintRow>) =>
    setMaints((list) => list.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const dropMaint = (idx: number) => {
    const row = maints[idx];
    if (row.id) setRemoved((r) => [...r, row.id!]);
    setMaints((list) => list.filter((_, i) => i !== idx));
  };

  return (
    <FormModal open={open} onOpenChange={onOpenChange}>
      <FormModalContent>
        <FormModalHeader>
          <FormModalTitle>{printer ? "Editar impressora" : "Nova impressora"}</FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Bambu Lab P1S — Bancada 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de aquisição</Label>
              <Input
                type="date"
                value={form.data_aquisicao}
                onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor de compra (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_compra}
                onChange={(e) => setForm({ ...form, valor_compra: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cenário de vida útil</Label>
              <Select value={form.cenario} onValueChange={pickScenario}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFE_SCENARIOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                      {s.hours ? ` · ${s.hours.toLocaleString("pt-BR")} h` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {LIFE_SCENARIOS.find((s) => s.value === form.cenario)?.hint}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Vida útil (horas)</Label>
              <Input
                type="number"
                value={form.vida_util_horas}
                onChange={(e) =>
                  setForm({ ...form, vida_util_horas: e.target.value, cenario: "personalizado" })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Potência (W)</Label>
              <Input
                type="number"
                value={form.potencia_watts}
                onChange={(e) => setForm({ ...form, potencia_watts: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINTER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PRINTER_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Horas acumuladas</Label>
              <Input
                type="number"
                value={form.horas_acumuladas}
                onChange={(e) => setForm({ ...form, horas_acumuladas: e.target.value })}
              />
            </div>
          </div>

          {/* Preview do cálculo em tempo real */}
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Máquina / hora</span>
              <span className="font-medium">{brl(machine)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Manutenção / hora</span>
              <span className="font-medium">{brl(maintenance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Energia / hora {kwhPrice > 0 ? `(${brl(kwhPrice)}/kWh)` : "(tarifa não configurada)"}
              </span>
              <span className="font-medium">{brl(energy)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Custo estimado</span>
              <span className="text-lg font-bold tracking-tight">{brl(total)}/hora</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Manutenções previstas</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMaints((l) => [...l, emptyMaint()])}
              >
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
            {maints.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Nenhuma manutenção cadastrada. Elas são rateadas pela vida útil no custo/hora.
              </p>
            )}
            {maints.map((m, idx) => (
              <div key={m.id ?? `new-${idx}`} className="space-y-2 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <Select value={m.tipo} onValueChange={(v) => setMaint(idx, { tipo: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {MAINTENANCE_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Descrição (ex.: troca de bico)"
                    value={m.descricao}
                    onChange={(e) => setMaint(idx, { descricao: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remover manutenção"
                    onClick={() => dropMaint(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Periodicidade (h)</Label>
                    <Input
                      type="number"
                      value={m.periodicidade_horas}
                      onChange={(e) => setMaint(idx, { periodicidade_horas: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Custo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={m.custo_estimado}
                      onChange={(e) => setMaint(idx, { custo_estimado: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Última</Label>
                    <Input
                      type="date"
                      value={m.data_ultima}
                      onChange={(e) => setMaint(idx, { data_ultima: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Horas desde a última</Label>
                    <Input
                      type="number"
                      value={m.horas_desde_ultima}
                      onChange={(e) => setMaint(idx, { horas_desde_ultima: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
