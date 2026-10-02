import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Lock, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Pager, SortButton, useTableState } from "@/components/table-kit";
import { PartnersManager } from "@/components/PartnersManager";
import { WithdrawalFormModal } from "@/components/WithdrawalFormModal";
import { useClosedMonths } from "@/hooks/use-closed-months";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  listCashClosings,
  listPartnerWithdrawals,
  listPartners,
  type PartnerWithdrawal,
} from "@/lib/db";
import type { PartnerShare } from "@/lib/cash-closing";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { brl, dateBR, num } from "@/lib/format";
import {
  WITHDRAWAL_KIND_LABEL,
  activeShareTotal,
  deleteWithdrawal,
  isInKind,
  totalsByPartner,
} from "@/lib/partners";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/socios")({
  head: () => ({
    meta: [
      { title: pageTitle("Sócios") },
      {
        name: "description",
        content: "Cadastro dos sócios e retiradas em dinheiro, peças e materiais.",
      },
    ],
  }),
  component: SociosPage,
});

const monthBounds = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
};

function SociosPage() {
  const qc = useQueryClient();
  const partners = useQuery({ queryKey: ["partners"], queryFn: listPartners });
  const withdrawals = useQuery({
    queryKey: ["partner_withdrawals"],
    queryFn: listPartnerWithdrawals,
  });

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [partnerFilter, setPartnerFilter] = useState("todos");
  const [managerOpen, setManagerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formPartner, setFormPartner] = useState<string | undefined>();
  const [toDelete, setToDelete] = useState<PartnerWithdrawal | null>(null);
  const { isClosed, closedMessage } = useClosedMonths();

  const list = useMemo(() => partners.data ?? [], [partners.data]);
  const all = useMemo(() => withdrawals.data ?? [], [withdrawals.data]);
  const nameOf = (id: string) => list.find((p) => p.id === id)?.name ?? "Sócio";

  const { start, end } = monthBounds(month);
  const year = month.slice(0, 4);
  const monthTotals = useMemo(() => totalsByPartner(all, start, end), [all, start, end]);
  const yearTotals = useMemo(
    () => totalsByPartner(all, `${year}-01-01`, `${year}-12-31`),
    [all, year],
  );

  // distribuições recebidas nos fechamentos do ano
  const closings = useQuery({ queryKey: ["cash_closings"], queryFn: listCashClosings });
  const distributedInYear = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of closings.data ?? []) {
      if (c.status !== "fechado" || !c.month.startsWith(year)) continue;
      const shares = (Array.isArray(c.partner_shares)
        ? c.partner_shares
        : []) as unknown as PartnerShare[];
      shares.forEach((s) => map.set(s.partner_id, (map.get(s.partner_id) ?? 0) + Number(s.payout)));
    }
    return map;
  }, [closings.data, year]);

  const rows = all.filter(
    (w) =>
      w.withdrawn_on >= start &&
      w.withdrawn_on <= end &&
      (partnerFilter === "todos" || w.partner_id === partnerFilter),
  );
  const table = useTableState(
    rows,
    (w) =>
      `${nameOf(w.partner_id)} ${w.description} ${WITHDRAWAL_KIND_LABEL[w.kind] ?? ""} ${w.notes ?? ""}`,
  );

  // mostra sócios ativos e inativos que tenham retiradas no ano
  const visible = list.filter((p) => p.active || yearTotals.get(p.id).count > 0);
  const shareTotal = activeShareTotal(list);

  const remove = useMutation({
    mutationFn: (w: PartnerWithdrawal) => deleteWithdrawal(w, nameOf(w.partner_id)),
    onSuccess: () => {
      [
        "partner_withdrawals",
        "transactions",
        "parts",
        "materials",
        "stock_movements",
        "assets",
      ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Retirada excluída e estoque estornado");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openForm = (partnerId?: string) => {
    setFormPartner(partnerId);
    setFormOpen(true);
  };

  const loading = partners.isLoading || withdrawals.isLoading;

  return (
    <div>
      <PageHeader
        title="Sócios"
        description="Participação de cada sócio e retiradas feitas durante o mês."
        actions={
          <>
            <Button variant="outline" onClick={() => setManagerOpen(true)}>
              <Users className="h-4 w-4" /> {list.length ? "Editar sócios" : "Cadastrar sócios"}
            </Button>
            <Button onClick={() => openForm()} disabled={!list.some((p) => p.active)}>
              <Plus className="h-4 w-4" /> Nova retirada
            </Button>
          </>
        }
      />

      {!loading && list.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Cadastre os sócios e o percentual de cada um para registrar retiradas e dividir o
            resultado no fechamento do mês.
          </p>
          <Button className="mt-4" onClick={() => setManagerOpen(true)}>
            <Users className="h-4 w-4" /> Cadastrar sócios
          </Button>
        </div>
      ) : (
        <>
          {list.length > 0 && Math.abs(shareTotal - 100) > 0.01 && (
            <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              Os percentuais dos sócios ativos somam {num(shareTotal, 3)}%. Ajuste em “Editar
              sócios” para somar 100%.
            </p>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="w-44"
              aria-label="Mês"
            />
            <Select value={partnerFilter} onValueChange={setPartnerFilter}>
              <SelectTrigger className="w-48" aria-label="Sócio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os sócios</SelectItem>
                {list.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar retirada..."
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const m = monthTotals.get(p.id);
              const y = yearTotals.get(p.id);
              return (
                <div key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.active ? `${num(Number(p.share_pct), 3)}% do resultado` : "Inativo"}
                      </p>
                    </div>
                    {p.active && (
                      <Button size="sm" variant="ghost" onClick={() => openForm(p.id)}>
                        <HandCoins className="h-4 w-4" /> Retirada
                      </Button>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Retiradas no mês</p>
                  <p className="text-2xl font-bold tracking-tight">{brl(m.total)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>Dinheiro {brl(m.dinheiro)}</span>
                    <span>Peças/materiais {brl(m.especie)}</span>
                  </div>
                  <div className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                    <p>
                      Retiradas em {year}:{" "}
                      <span className="font-medium text-foreground">{brl(y.total)}</span>
                    </p>
                    <p>
                      Distribuição recebida em {year}:{" "}
                      <span className="font-medium text-foreground">
                        {brl(distributedInYear.get(p.id) ?? 0)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {table.paged.length === 0 ? (
            <EmptyState message={loading ? "Carregando..." : "Nenhuma retirada neste mês."} />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton label="Data" onClick={() => table.toggleSort("withdrawn_on")} />
                    </TableHead>
                    <TableHead>Sócio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">
                      <SortButton label="Valor" onClick={() => table.toggleSort("amount")} />
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.paged.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          {dateBR(w.withdrawn_on)}
                          {isClosed(w.withdrawn_on) && (
                            <Lock
                              className="h-3 w-3 text-muted-foreground"
                              aria-label="Mês fechado"
                            />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{nameOf(w.partner_id)}</TableCell>
                      <TableCell>
                        <Badge variant={isInKind(w.kind) ? "secondary" : "outline"}>
                          {WITHDRAWAL_KIND_LABEL[w.kind] ?? w.kind}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>{w.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {w.kind === "dinheiro"
                            ? (PAYMENT_METHOD_LABEL[w.payment_method ?? ""] ??
                              "Forma não informada")
                            : Number(w.suggested_amount) !== Number(w.amount)
                              ? `Custo ${brl(Number(w.suggested_amount))}, valor ajustado`
                              : "Pelo custo"}
                          {w.notes && ` · ${w.notes}`}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {brl(Number(w.amount))}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setToDelete(w)}
                          disabled={isClosed(w.withdrawn_on)}
                          title={
                            isClosed(w.withdrawn_on) ? closedMessage(w.withdrawn_on) : undefined
                          }
                          aria-label="Excluir retirada"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager {...table} total={table.filtered.length} />
            </div>
          )}
        </>
      )}

      <PartnersManager open={managerOpen} onOpenChange={setManagerOpen} partners={list} />
      <WithdrawalFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        partners={list}
        defaultPartnerId={formPartner}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir retirada?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && isInKind(toDelete.kind)
                ? "O item volta para o estoque."
                : "O lançamento de saída no financeiro também será removido."}{" "}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) remove.mutate(toDelete);
              }}
              disabled={remove.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
