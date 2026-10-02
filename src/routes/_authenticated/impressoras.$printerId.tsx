import { useState } from "react";
import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Timer, Gauge, Wrench, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader, StatCard, EmptyState } from "@/components/PageHeader";
import { PrinterFormModal } from "@/components/PrinterFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  getPrinter,
  listPrinterCostHistory,
  listPrinterMaintenances,
} from "@/lib/db";
import { brl, dateBR, num } from "@/lib/format";
import {
  MAINTENANCE_TYPE_LABEL,
  PRINTER_STATUS_LABEL,
  SCENARIO_LABEL,
  lifeUsedPct,
  overdueMaintenances,
  printerCosts,
} from "@/lib/printers";

export const Route = createFileRoute("/_authenticated/impressoras/$printerId")({
  head: () => ({
    meta: [
      { title: "Detalhe da impressora · 3D Create" },
      { name: "description", content: "Custo por hora, manutenções e histórico da impressora." },
      { property: "og:title", content: "Detalhe da impressora · 3D Create" },
      {
        property: "og:description",
        content: "Custo por hora, manutenções e histórico da impressora.",
      },
    ],
  }),
  component: PrinterDetail,
  errorComponent: DetailError,
  notFoundComponent: () => <EmptyState message="Impressora não encontrada." />,
});

function DetailError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar a impressora: {message}
      </p>
      <Button
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

function PrinterDetail() {
  const { printerId } = Route.useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [hours, setHours] = useState("1");

  const printer = useQuery({
    queryKey: ["printers", printerId],
    queryFn: () => getPrinter(printerId),
  });
  const maints = useQuery({
    queryKey: ["printer_maintenances", printerId],
    queryFn: () => listPrinterMaintenances(printerId),
  });
  const history = useQuery({
    queryKey: ["printer_cost_history", printerId],
    queryFn: () => listPrinterCostHistory(printerId),
  });
  const profile = useQuery({
    queryKey: ["profiles", "me", "defaults"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("default_energy_price_kwh")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
  });
  const kwhPrice = Number(profile.data?.default_energy_price_kwh ?? 0);

  const addHours = useMutation({
    mutationFn: async () => {
      const p = printer.data;
      const delta = Number(hours) || 0;
      if (!p) throw new Error("Impressora não encontrada");
      if (delta <= 0) throw new Error("Informe as horas de uso");
      const { error } = await supabase
        .from("printers")
        .update({ horas_acumuladas: Number(p.horas_acumuladas) + delta })
        .eq("id", p.id);
      if (error) throw new Error(error.message);

      const list = maints.data ?? [];
      for (const m of list) {
        const { error: mErr } = await supabase
          .from("printer_maintenances")
          .update({ horas_desde_ultima: Number(m.horas_desde_ultima) + delta })
          .eq("id", m.id);
        if (mErr) throw new Error(mErr.message);
      }
      return overdueMaintenances(list, delta);
    },
    onSuccess: (due) => {
      qc.invalidateQueries({ queryKey: ["printers"] });
      qc.invalidateQueries({ queryKey: ["printer_maintenances"] });
      setHoursOpen(false);
      setHours("1");
      if (due.length) {
        toast.warning(
          `Manutenção pendente: ${due.map((m) => m.descricao).join(", ")}`,
          { duration: 8000 },
        );
      } else {
        toast.success("Horas de uso lançadas");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = printer.data;
  if (printer.isLoading) return <EmptyState message="Carregando impressora..." />;
  if (!p) return <EmptyState message="Impressora não encontrada." />;

  const list = maints.data ?? [];
  const costs = printerCosts(p, list, kwhPrice);
  const pct = lifeUsedPct(Number(p.horas_acumuladas), Number(p.vida_util_horas));
  const due = overdueMaintenances(list);
  const chartData = (history.data ?? []).map((h) => ({
    date: dateBR(h.created_at),
    total: Number(h.custo_hora_total),
    maquina: Number(h.custo_hora_maquina),
  }));

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link to="/impressoras">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={p.nome}
        description={
          [p.marca, p.modelo].filter(Boolean).join(" · ") ||
          "Equipamento sem marca/modelo informados"
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setHoursOpen(true)}>
              <Timer className="h-4 w-4" /> Lançar horas de uso
            </Button>
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          </>
        }
      />

      {due.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="font-medium">Manutenções pendentes</p>
            <p className="text-muted-foreground">{due.map((m) => m.descricao).join(" · ")}</p>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard
          label="Custo total / hora"
          value={`${brl(costs.total)}/h`}
          hint="Máquina + manutenção + energia"
          icon={<Gauge className="h-4 w-4" />}
          accent
        />
        <StatCard label="Máquina / hora" value={brl(costs.machine)} />
        <StatCard label="Manutenção / hora" value={brl(costs.maintenance)} />
        <StatCard
          label="Energia / hora"
          value={brl(costs.energy)}
          hint={kwhPrice > 0 ? `${brl(kwhPrice)} por kWh` : "Configure a tarifa de kWh"}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Dados gerais</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Status" value={PRINTER_STATUS_LABEL[p.status] ?? p.status} />
            <Info label="Cenário" value={SCENARIO_LABEL[p.cenario] ?? p.cenario} />
            <Info label="Valor de compra" value={brl(Number(p.valor_compra))} />
            <Info label="Aquisição" value={dateBR(p.data_aquisicao)} />
            <Info label="Vida útil" value={`${num(Number(p.vida_util_horas), 0)} h`} />
            <Info
              label="Potência"
              value={p.potencia_watts ? `${num(Number(p.potencia_watts), 0)} W` : "—"}
            />
          </dl>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Vida útil consumida</span>
              <span>
                {num(Number(p.horas_acumuladas), 1)} h · {num(pct, 1)}%
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
          {p.observacoes && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{p.observacoes}</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Evolução do custo / hora</h2>
          {chartData.length < 2 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              O gráfico aparece após novas alterações de custo.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => brl(Number(v))} width={80} />
                <RTooltip formatter={(v: number) => brl(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} name="Total" />
                <Line
                  type="monotone"
                  dataKey="maquina"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  name="Máquina"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Manutenções previstas</h2>
        </div>
        {list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma manutenção cadastrada.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Periodicidade</TableHead>
                <TableHead className="text-right">Horas desde a última</TableHead>
                <TableHead>Última</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((m) => {
                const isDue =
                  Number(m.periodicidade_horas) > 0 &&
                  Number(m.horas_desde_ultima) >= Number(m.periodicidade_horas);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.descricao}
                      {isDue && (
                        <Badge variant="destructive" className="ml-2">
                          Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{MAINTENANCE_TYPE_LABEL[m.tipo] ?? m.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.periodicidade_horas ? `${num(Number(m.periodicidade_horas), 0)} h` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {num(Number(m.horas_desde_ultima), 1)} h
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dateBR(m.data_ultima)}</TableCell>
                    <TableCell className="text-right">{brl(Number(m.custo_estimado))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <PrinterFormModal
        open={editOpen}
        printer={p}
        kwhPrice={kwhPrice}
        onOpenChange={setEditOpen}
      />

      <FormModal open={hoursOpen} onOpenChange={setHoursOpen}>
        <FormModalContent className="sm:max-w-md">
          <FormModalHeader>
            <FormModalTitle>Lançar horas de uso</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <div className="space-y-1.5">
              <Label>Horas impressas</Label>
              <Input
                type="number"
                step="0.1"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Serão somadas às {num(Number(p.horas_acumuladas), 1)} h acumuladas e às manutenções
                em aberto.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setHoursOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => addHours.mutate()} disabled={addHours.isPending}>
                Lançar
              </Button>
            </div>
          </FormModalBody>
        </FormModalContent>
      </FormModal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
