import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, FileDown, PiggyBank, RotateCcw, Vault } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { CashClosingPanel } from "@/components/CashClosingPanel";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOwners } from "@/hooks/use-owners";
import {
  listCashClosings,
  listPartnerWithdrawals,
  listPartners,
  listTransactions,
  type CashClosing,
} from "@/lib/db";
import {
  addMonths,
  methodLabel,
  monthEnded,
  monthLabel,
  nextMonthToClose,
  ymOf,
  type MethodMap,
  type PartnerShare,
} from "@/lib/cash-closing";
import { reopenMonth } from "@/lib/cash-closing-db";
import { downloadCashClosingPdf } from "@/lib/cash-closing-pdf";
import { useCompanyProfile } from "@/hooks/use-company-profile";
import { brl, dateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: pageTitle("Fechamento de caixa") },
      {
        name: "description",
        content: "Fechamento mensal: resultado, reserva, divisão entre os sócios e conferência.",
      },
    ],
  }),
  component: CaixaPage,
});

const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const asMap = (v: unknown): MethodMap =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as MethodMap) : {};
const sharesOf = (c: CashClosing) =>
  (Array.isArray(c.partner_shares) ? c.partner_shares : []) as unknown as PartnerShare[];

function CaixaPage() {
  const closings = useQuery({ queryKey: ["cash_closings"], queryFn: listCashClosings });
  const tx = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const partners = useQuery({ queryKey: ["partners"], queryFn: listPartners });
  const withdrawals = useQuery({
    queryKey: ["partner_withdrawals"],
    queryFn: listPartnerWithdrawals,
  });

  const today = localISO();
  const currentYm = today.slice(0, 7);
  const list = useMemo(() => closings.data ?? [], [closings.data]);
  const byYm = useMemo(() => new Map(list.map((c) => [ymOf(c.month), c])), [list]);

  const next = nextMonthToClose(list);
  const isFirst = next === null;
  const [firstYm, setFirstYm] = useState(() => addMonths(currentYm, -1));
  const targetYm = next ?? firstYm;
  const canClose = monthEnded(targetYm, today);
  const existing = byYm.get(targetYm)?.status === "reaberto" ? byYm.get(targetYm)! : null;
  const previousOf = (ym: string) => {
    const c = byYm.get(addMonths(ym, -1));
    return c?.status === "fechado" ? c : null;
  };

  const lastClosed = list.find((c) => c.status === "fechado") ?? null;
  const [tab, setTab] = useState<string>("fechar");
  const [details, setDetails] = useState<CashClosing | null>(null);

  const loading = closings.isLoading || tx.isLoading || partners.isLoading || withdrawals.isLoading;
  const panelData = {
    transactions: tx.data ?? [],
    partners: partners.data ?? [],
    withdrawals: withdrawals.data ?? [],
  };

  return (
    <div>
      <PageHeader
        title="Fechamento de caixa"
        description="Resultado do mês, reserva, divisão entre os sócios e conferência do caixa."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          accent
          label="Saldo da reserva"
          value={brl(Number(lastClosed?.reserve_balance ?? 0))}
          hint={
            lastClosed ? `Após ${monthLabel(ymOf(lastClosed.month))}` : "Nenhum fechamento ainda"
          }
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard
          label="Último fechamento"
          value={lastClosed ? monthLabel(ymOf(lastClosed.month)) : "—"}
          hint={
            lastClosed
              ? `Distribuído ${brl(Number(lastClosed.distributable))}`
              : "Faça o primeiro fechamento"
          }
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Próximo a fechar"
          value={monthLabel(targetYm)}
          hint={
            existing
              ? "Reaberto, precisa ser fechado de novo"
              : canClose
                ? "Pronto para fechar"
                : `Disponível a partir de ${dateBR(addMonths(targetYm, 1) + "-01")}`
          }
          icon={<Vault className="h-4 w-4" />}
        />
      </div>

      {loading ? (
        <EmptyState message="Carregando..." />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="fechar">Fechar mês</TabsTrigger>
            <TabsTrigger value="andamento">Mês em andamento</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({list.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="fechar" className="mt-4">
            {isFirst && (
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="primeiro-mes">Primeiro mês a fechar</Label>
                  <Input
                    id="primeiro-mes"
                    type="month"
                    max={addMonths(currentYm, -1)}
                    value={firstYm}
                    onChange={(e) => e.target.value && setFirstYm(e.target.value)}
                    className="w-44"
                  />
                </div>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Este é o primeiro fechamento. Escolha o mês e informe o saldo inicial de cada
                  forma de pagamento na conferência. Depois, os meses são fechados em sequência.
                </p>
              </div>
            )}
            {existing && (
              <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                {monthLabel(targetYm)} foi reaberto
                {existing.reopen_reason ? ` (“${existing.reopen_reason}”)` : ""}. Revise e feche de
                novo.
              </p>
            )}
            {canClose ? (
              <CashClosingPanel
                key={`${targetYm}-${existing?.id ?? "novo"}`}
                ym={targetYm}
                previous={previousOf(targetYm)}
                existing={existing}
                onClosed={() => setTab("historico")}
                {...panelData}
              />
            ) : (
              <EmptyState
                message={`${monthLabel(targetYm)} ainda não terminou. O fechamento fica disponível a partir de ${dateBR(addMonths(targetYm, 1) + "-01")}; veja a prévia em “Mês em andamento”.`}
              />
            )}
          </TabsContent>

          <TabsContent value="andamento" className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Prévia de {monthLabel(currentYm)} com os lançamentos até hoje. Os valores mudam até o
              fechamento.
            </p>
            <CashClosingPanel
              ym={currentYm}
              preview
              previous={previousOf(currentYm)}
              existing={null}
              {...panelData}
            />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {list.length === 0 ? (
              <EmptyState message="Nenhum mês fechado ainda." />
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="text-right">Reserva</TableHead>
                      <TableHead className="text-right">Distribuído</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((c) => (
                      <TableRow
                        key={c.id}
                        className={clickableRow}
                        onClick={() => setDetails(c)}
                        title="Ver detalhes"
                      >
                        <TableCell className="font-medium capitalize">
                          {monthLabel(ymOf(c.month))}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            Number(c.result) < 0 && "text-destructive",
                          )}
                        >
                          {brl(Number(c.result))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {brl(Number(c.reserve_amount))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {brl(Number(c.distributable))}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            Number(c.difference) < 0 && "text-destructive",
                            Number(c.difference) > 0 && "text-emerald-600",
                          )}
                        >
                          {Math.abs(Number(c.difference)) < 0.01 ? "—" : brl(Number(c.difference))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === "fechado" ? "default" : "secondary"}>
                            {c.status === "fechado" ? "Fechado" : "Reaberto"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <ClosingDetails
        closing={details}
        canReopen={
          !!details && details.status === "fechado" && details.id === lastClosed?.id && !existing
        }
        onClose={() => setDetails(null)}
      />
    </div>
  );
}

function ClosingDetails({
  closing,
  canReopen,
  onClose,
}: {
  closing: CashClosing | null;
  canReopen: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { ownerName } = useOwners();
  const profile = useCompanyProfile();
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");

  const reopen = useMutation({
    mutationFn: () => reopenMonth(closing!, reason.trim()),
    onSuccess: () => {
      ["cash_closings", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Mês reaberto. Os lançamentos do fechamento foram removidos do financeiro.");
      setReopening(false);
      setReason("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!closing) return null;
  const ym = ymOf(closing.month);
  const shares = sharesOf(closing);
  const counted = asMap(closing.counted);
  const expected = asMap(closing.expected);
  const history = (Array.isArray(closing.reopen_history) ? closing.reopen_history : []) as {
    at: string;
    by: string | null;
    reason: string;
  }[];

  return (
    <RecordDetailsModal
      open={!!closing}
      onOpenChange={(o) => {
        if (!o) {
          setReopening(false);
          onClose();
        }
      }}
      title={`Fechamento de ${monthLabel(ym)}`}
      subtitle={
        closing.status === "fechado"
          ? `Fechado por ${ownerName(closing.closed_by)} em ${new Date(closing.closed_at).toLocaleString("pt-BR")}`
          : "Reaberto"
      }
      fields={[
        { label: "Entradas", value: brl(Number(closing.total_in)) },
        { label: "Gastos da empresa", value: brl(Number(closing.company_out)) },
        { label: "Resultado", value: brl(Number(closing.result)) },
        { label: "Prejuízo anterior compensado", value: brl(Number(closing.previous_loss)) },
        { label: "Reserva separada", value: brl(Number(closing.reserve_amount)) },
        { label: "Saldo da reserva", value: brl(Number(closing.reserve_balance)) },
        { label: "Valor distribuído", value: brl(Number(closing.distributable)) },
        { label: "Prejuízo para o próximo mês", value: brl(Number(closing.loss_carry)) },
        ...(closing.difference_reason
          ? [{ label: "Explicação da diferença", value: closing.difference_reason, full: true }]
          : []),
        ...(closing.notes ? [{ label: "Observações", value: closing.notes, full: true }] : []),
      ]}
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCashClosingPdf(closing, ownerName(closing.closed_by), profile.data?.company)
            }
            disabled={closing.status !== "fechado"}
          >
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          {canReopen && !reopening && (
            <Button variant="outline" onClick={() => setReopening(true)}>
              <RotateCcw className="h-4 w-4" /> Reabrir mês
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Divisão entre os sócios</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sócio</TableHead>
                  <TableHead className="text-right">Cota</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Recebeu</TableHead>
                  <TableHead className="text-right">Ficou devendo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((s) => (
                  <TableRow key={s.partner_id}>
                    <TableCell>
                      {s.name}
                      {s.payout > 0 && (
                        <div className="text-xs text-muted-foreground">
                          via {methodLabel(s.payment_method)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(s.quota)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {brl(s.cash + s.in_kind + s.previous_debt)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {brl(s.payout)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.debt ? brl(s.debt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Conferência</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Conferido</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys({ ...expected, ...counted }).map((m) => {
                  const diff = (counted[m] ?? 0) - (expected[m] ?? 0);
                  return (
                    <TableRow key={m}>
                      <TableCell>{methodLabel(m)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(expected[m] ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(counted[m] ?? 0)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          diff < -0.004 && "text-destructive",
                          diff > 0.004 && "text-emerald-600",
                        )}
                      >
                        {Math.abs(diff) < 0.01 ? "ok" : brl(diff)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Reaberturas</h3>
            <ul className="space-y-1 text-sm">
              {history.map((h, i) => (
                <li key={i} className="text-muted-foreground">
                  {new Date(h.at).toLocaleString("pt-BR")} · {ownerName(h.by)}: {h.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {reopening && (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <Label htmlFor="motivo-reabertura">Por que reabrir {monthLabel(ym)}?</Label>
            <Textarea
              id="motivo-reabertura"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: venda lançada com valor errado"
            />
            <p className="text-xs text-muted-foreground">
              As distribuições e sobras/quebras de caixa lançadas no financeiro por este fechamento
              serão removidas. O mês precisa ser fechado de novo.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReopening(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!reason.trim() || reopen.isPending}
                onClick={() => reopen.mutate()}
              >
                Reabrir
              </Button>
            </div>
          </div>
        )}
      </div>
    </RecordDetailsModal>
  );
}
