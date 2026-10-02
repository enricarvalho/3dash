import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Printer as PrinterIcon,
  Gauge,
  Wallet,
} from "lucide-react";

import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { Pager, useTableState } from "@/components/table-kit";
import { PrinterFormModal } from "@/components/PrinterFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { listPrinters, listPrinterMaintenances, type Printer } from "@/lib/db";
import { useDeleteRecord } from "@/hooks/use-crud";
import { brl, num } from "@/lib/format";
import { PRINTER_STATUSES, PRINTER_STATUS_LABEL, lifeUsedPct, printerCosts } from "@/lib/printers";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/impressoras/")({
  head: () => ({
    meta: [
      { title: pageTitle("Impressoras 3D") },
      {
        name: "description",
        content: "Cadastro de impressoras 3D com custo de depreciação e manutenção por hora.",
      },
      { property: "og:title", content: pageTitle("Impressoras 3D") },
      {
        property: "og:description",
        content: "Cadastro de impressoras 3D com custo de depreciação e manutenção por hora.",
      },
    ],
  }),
  component: ImpressorasPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ativa: "default",
  manutencao: "secondary",
  inativa: "outline",
};

function ImpressorasPage() {
  const printers = useQuery({ queryKey: ["printers"], queryFn: listPrinters });
  const maints = useQuery({
    queryKey: ["printer_maintenances"],
    queryFn: () => listPrinterMaintenances(),
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

  const remove = useDeleteRecord("printers", ["printer_maintenances", "printer_cost_history"]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [toDelete, setToDelete] = useState<Printer | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [details, setDetails] = useState<Printer | null>(null);
  const navigate = useNavigate();

  const rows = (printers.data ?? []).filter(
    (p) => statusFilter === "todos" || p.status === statusFilter,
  );
  const table = useTableState(rows, (p) => `${p.nome} ${p.marca ?? ""} ${p.modelo ?? ""}`);

  const costsOf = (p: Printer) =>
    printerCosts(
      p,
      (maints.data ?? []).filter((m) => m.printer_id === p.id),
      kwhPrice,
    );

  const active = rows.filter((p) => p.status === "ativa").length;
  const avgCost = rows.length ? rows.reduce((s, p) => s + costsOf(p).total, 0) / rows.length : 0;
  const parkValue = rows.reduce((s, p) => s + Number(p.valor_compra), 0);

  return (
    <div>
      <PageHeader
        title="Impressoras 3D"
        description="Equipamentos, vida útil e custo de máquina por hora usado na precificação."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova impressora
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Custo médio / hora"
          value={`${brl(avgCost)}/h`}
          icon={<Gauge className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Impressoras ativas"
          value={`${active} de ${rows.length}`}
          icon={<PrinterIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Valor do parque"
          value={brl(parkValue)}
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar impressora..."
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {PRINTER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PRINTER_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {table.paged.length === 0 ? (
        <EmptyState message="Nenhuma impressora cadastrada ainda." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Impressora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56">Vida útil consumida</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Custo / hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.paged.map((p) => {
                const c = costsOf(p);
                const pct = lifeUsedPct(Number(p.horas_acumuladas), Number(p.vida_util_horas));
                return (
                  <TableRow
                    key={p.id}
                    className={clickableRow}
                    onClick={() => setDetails(p)}
                    title="Ver detalhes"
                  >
                    <TableCell>
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {[p.marca, p.modelo].filter(Boolean).join(" · ") || "Sem marca/modelo"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                        {PRINTER_STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Progress value={pct} className="h-2" />
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {num(pct, 1)}% de {num(Number(p.vida_util_horas), 0)} h
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {num(Number(p.horas_acumuladas), 1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-base font-bold tracking-tight">{brl(c.total)}</span>
                      <span className="block text-xs text-muted-foreground">por hora</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pager
            page={table.page}
            totalPages={table.totalPages}
            setPage={table.setPage}
            total={table.filtered.length}
          />
        </div>
      )}

      <RecordDetailsModal
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        title={details?.nome ?? ""}
        subtitle={
          details
            ? [details.marca, details.modelo].filter(Boolean).join(" · ") || undefined
            : undefined
        }
        fields={
          details
            ? [
                {
                  label: "Status",
                  value: PRINTER_STATUS_LABEL[details.status] ?? details.status,
                },
                {
                  label: "Horas acumuladas",
                  value: `${num(Number(details.horas_acumuladas), 1)} h`,
                },
                { label: "Vida útil", value: `${num(Number(details.vida_util_horas), 0)} h` },
                {
                  label: "Vida útil consumida",
                  value: `${num(
                    lifeUsedPct(Number(details.horas_acumuladas), Number(details.vida_util_horas)),
                    1,
                  )}%`,
                },
                { label: "Custo / hora", value: `${brl(costsOf(details).total)}/h` },
                { label: "Data de aquisição", value: details.data_aquisicao ?? "—" },
              ]
            : []
        }
        actions={
          details ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  navigate({ to: "/impressoras/$printerId", params: { printerId: details.id } })
                }
              >
                <ExternalLink className="h-4 w-4" /> Abrir ficha
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const pr = details;
                  setDetails(null);
                  setEditing(pr);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const pr = details;
                  setDetails(null);
                  setToDelete(pr);
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </>
          ) : null
        }
      />

      <PrinterFormModal open={open} printer={editing} kwhPrice={kwhPrice} onOpenChange={setOpen} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir impressora?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.nome} e todo o histórico de manutenções e custos serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) remove.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
