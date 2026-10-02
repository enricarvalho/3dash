import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
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
import type { CashClosing, Partner, PartnerWithdrawal, Transaction } from "@/lib/db";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/domain";
import {
  NO_METHOD,
  computeConference,
  computeDistribution,
  differenceAdjustments,
  monthFlows,
  monthLabel,
  sumMap,
  methodLabel,
  visibleMethods,
  type MethodMap,
} from "@/lib/cash-closing";
import { closeMonth } from "@/lib/cash-closing-db";
import { brl, num } from "@/lib/format";
import { cn } from "@/lib/utils";

const asMap = (v: unknown): MethodMap =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as MethodMap) : {};

const money = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

function Line({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5 text-sm",
        strong && "border-t pt-2 font-semibold",
        muted && "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", strong && value < 0 && "text-destructive")}>
        {brl(value)}
      </span>
    </div>
  );
}

/**
 * Cálculo do fechamento do mês: resultado, reserva, divisão entre sócios e
 * conferência por forma de pagamento. Em `preview` mostra só os números.
 */
export function CashClosingPanel({
  ym,
  preview = false,
  transactions,
  partners,
  withdrawals,
  previous,
  existing,
  onClosed,
}: {
  ym: string;
  preview?: boolean;
  transactions: Transaction[];
  partners: Partner[];
  withdrawals: PartnerWithdrawal[];
  /** Fechamento do mês anterior (null no primeiro fechamento). */
  previous: CashClosing | null;
  /** Fechamento reaberto deste mês, se houver. */
  existing: CashClosing | null;
  onClosed?: () => void;
}) {
  const qc = useQueryClient();
  const isFirst = !previous;

  const [reserveMode, setReserveMode] = useState<"valor" | "pct">("valor");
  const [reserveInput, setReserveInput] = useState("");
  const [payMethods, setPayMethods] = useState<Record<string, string>>({});
  const [openingInput, setOpeningInput] = useState<Record<string, string>>({});
  const [countedInput, setCountedInput] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(existing?.difference_reason ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const flows = useMemo(() => monthFlows(transactions, ym), [transactions, ym]);
  const result = flows.totalIn - flows.companyOut;
  const previousLoss = Number(previous?.loss_carry ?? 0);
  const base = result - previousLoss;

  const previousDebts = useMemo(() => {
    const out: Record<string, number> = {};
    const shares = Array.isArray(previous?.partner_shares) ? previous.partner_shares : [];
    for (const s of shares as { partner_id: string; debt: number }[])
      out[s.partner_id] = Number(s.debt) || 0;
    return out;
  }, [previous]);

  const reserveRequested =
    reserveMode === "pct"
      ? (Math.max(base, 0) * (Number(reserveInput) || 0)) / 100
      : Number(reserveInput) || 0;

  const distribution = useMemo(
    () =>
      computeDistribution({
        result,
        previousLoss,
        reserve: preview ? 0 : reserveRequested,
        partners,
        withdrawals,
        ym,
        previousDebts,
        paymentMethods: payMethods,
      }),
    [
      result,
      previousLoss,
      reserveRequested,
      partners,
      withdrawals,
      ym,
      previousDebts,
      payMethods,
      preview,
    ],
  );

  const opening: MethodMap = useMemo(() => {
    if (previous) return asMap(previous.counted);
    const out: MethodMap = {};
    Object.entries(openingInput).forEach(([k, v]) => {
      const n = money(v);
      if (n) out[k] = n;
    });
    return out;
  }, [previous, openingInput]);

  const counted: MethodMap = {};
  Object.entries(countedInput).forEach(([k, v]) => {
    const n = money(v);
    if (n !== undefined && !Number.isNaN(n)) counted[k] = n;
  });

  const conference = computeConference({ opening, flows, shares: distribution.shares, counted });
  const rows = visibleMethods(conference.rows);
  const previousReserve = Number(previous?.reserve_balance ?? 0);
  const reserveBalance =
    Math.round((previousReserve + distribution.reserveAmount - flows.reserveSpent) * 100) / 100;
  const hasDifference =
    Math.abs(conference.totalDifference) >= 0.01 ||
    conference.rows.some((r) => Math.abs(r.difference) >= 0.01);
  const shareTotal = partners.filter((p) => p.active).reduce((s, p) => s + Number(p.share_pct), 0);
  const sharesOk = Math.abs(shareTotal - 100) <= 0.01;

  const close = useMutation({
    mutationFn: () => {
      const finalCounted: MethodMap = {};
      conference.rows.forEach((r) => {
        if (r.counted || r.expected) finalCounted[r.method] = r.counted;
      });
      return closeMonth({
        ym,
        existing,
        opening,
        flows,
        distribution,
        expected: conference.expected,
        counted: finalCounted,
        difference: conference.totalDifference,
        differenceReason: hasDifference ? reason.trim() : null,
        adjustments: differenceAdjustments(conference.rows, ym),
        reserveBalance,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      ["cash_closings", "transactions"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Caixa de ${monthLabel(ym)} fechado`);
      setConfirmOpen(false);
      onClosed?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tryClose = () => {
    if (!partners.some((p) => p.active)) return toast.error("Cadastre os sócios na tela Sócios");
    if (!sharesOk)
      return toast.error(
        `Os percentuais dos sócios somam ${num(shareTotal, 3)}%, ajuste para 100%`,
      );
    if (hasDifference && !reason.trim())
      return toast.error("Explique a diferença encontrada na conferência");
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">1. Resultado do mês</h3>
          <div className="mt-2">
            <Line label="Entradas" value={flows.totalIn} />
            <Line label="(−) Gastos da empresa" value={-flows.companyOut} />
            <Line label="= Resultado" value={result} strong />
            {previousLoss > 0 && (
              <>
                <Line label="(−) Prejuízo de meses anteriores" value={-previousLoss} />
                <Line label="= Base para dividir" value={base} strong />
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Retiradas dos sócios e investimentos pagos com a reserva não contam como gasto.
            {base < 0 &&
              " Mês com prejuízo: não há distribuição e o valor é compensado no próximo mês."}
          </p>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">2. Reserva para investimento</h3>
          {preview ? (
            <p className="mt-2 text-sm text-muted-foreground">
              A reserva é definida no fechamento do mês.
            </p>
          ) : (
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="reserva">Separar antes de dividir</Label>
                <Input
                  id="reserva"
                  type="number"
                  min="0"
                  step={reserveMode === "pct" ? "1" : "0.01"}
                  placeholder="0"
                  value={reserveInput}
                  onChange={(e) => setReserveInput(e.target.value)}
                  disabled={base <= 0}
                />
              </div>
              <Select
                value={reserveMode}
                onValueChange={(v) => setReserveMode(v as "valor" | "pct")}
              >
                <SelectTrigger className="w-28" aria-label="Tipo de reserva">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor">R$</SelectItem>
                  <SelectItem value="pct">% da base</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="mt-3">
            <Line label="Saldo da reserva no início do mês" value={previousReserve} muted />
            <Line label="(+) Separado neste fechamento" value={distribution.reserveAmount} muted />
            <Line label="(−) Usado em investimentos" value={-flows.reserveSpent} muted />
            <Line label="= Saldo da reserva" value={reserveBalance} strong />
          </div>
          {reserveRequested > distribution.reserveAmount + 0.004 && (
            <p className="mt-1 text-xs text-amber-600">
              A reserva foi limitada a {brl(distribution.reserveAmount)}, o valor disponível.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
          <h3 className="text-sm font-semibold">3. Divisão entre os sócios</h3>
          <span className="text-sm">
            A distribuir: <span className="font-semibold">{brl(distribution.distributable)}</span>
          </span>
        </div>
        {!sharesOk && partners.length > 0 && (
          <p className="mx-4 mb-2 text-xs text-destructive">
            Os percentuais dos sócios ativos somam {num(shareTotal, 3)}%. Ajuste na tela Sócios.
          </p>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sócio</TableHead>
                <TableHead className="text-right">Cota</TableHead>
                <TableHead className="text-right">Adiant. dinheiro</TableHead>
                <TableHead className="text-right">Peças/materiais</TableHead>
                <TableHead className="text-right">Devia</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                {!preview && <TableHead>Pagar via</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {distribution.shares.map((s) => (
                <TableRow key={s.partner_id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{num(s.share_pct, 3)}%</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(s.quota)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {s.cash ? `−${brl(s.cash)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {s.in_kind ? `−${brl(s.in_kind)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {s.previous_debt ? `−${brl(s.previous_debt)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-semibold tabular-nums">{brl(s.payout)}</div>
                    {s.debt > 0 && (
                      <div className="text-xs text-destructive">fica devendo {brl(s.debt)}</div>
                    )}
                  </TableCell>
                  {!preview && (
                    <TableCell>
                      <Select
                        value={s.payment_method}
                        onValueChange={(v) => setPayMethods((m) => ({ ...m, [s.partner_id]: v }))}
                        disabled={s.payout <= 0}
                      >
                        <SelectTrigger
                          className="h-8 w-36"
                          aria-label={`Forma de pagamento de ${s.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_METHOD_LABEL[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {distribution.shares.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum sócio cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {!preview && (
        <section className="rounded-xl border bg-card">
          <div className="p-4 pb-2">
            <h3 className="text-sm font-semibold">4. Conferência do caixa</h3>
            <p className="text-xs text-muted-foreground">
              Informe quanto realmente há em cada forma (dinheiro na gaveta, saldo do PIX/conta,
              cartão a receber). Campo vazio = igual ao esperado.
              {isFirst && " Primeiro fechamento: informe também o saldo inicial de cada forma."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Saldo inicial</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Distribuição</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="w-36 text-right">Conferido</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isFirst ? conference.rows : rows).map((r) => (
                  <TableRow key={r.method}>
                    <TableCell className="font-medium">{methodLabel(r.method)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {isFirst ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="ml-auto h-8 w-28 text-right"
                          placeholder="0,00"
                          value={openingInput[r.method] ?? ""}
                          onChange={(e) =>
                            setOpeningInput((m) => ({ ...m, [r.method]: e.target.value }))
                          }
                          aria-label={`Saldo inicial em ${methodLabel(r.method)}`}
                        />
                      ) : (
                        brl(r.opening)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {r.inflow ? `+${brl(r.inflow)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {r.outflow ? `−${brl(r.outflow)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {r.payout ? `−${brl(r.payout)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {brl(r.expected)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        className="ml-auto h-8 w-28 text-right"
                        placeholder={num(r.expected, 2)}
                        value={countedInput[r.method] ?? ""}
                        onChange={(e) =>
                          setCountedInput((m) => ({ ...m, [r.method]: e.target.value }))
                        }
                        aria-label={`Conferido em ${methodLabel(r.method)}`}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium tabular-nums",
                        r.difference > 0 && "text-emerald-600",
                        r.difference < 0 && "text-destructive",
                      )}
                    >
                      {Math.abs(r.difference) < 0.01
                        ? "ok"
                        : `${r.difference > 0 ? "sobra " : "falta "}${brl(Math.abs(r.difference))}`}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(sumMap(opening))}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(flows.totalIn)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(sumMap(flows.outflows))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(distribution.shares.reduce((s, x) => s + x.payout, 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(sumMap(conference.expected))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brl(conference.rows.reduce((s, r) => s + r.counted, 0))}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      conference.totalDifference < 0 && "text-destructive",
                    )}
                  >
                    {brl(conference.totalDifference)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="motivo">
                Explicação da diferença{hasDifference ? " (obrigatória)" : ""}
              </Label>
              <Textarea
                id="motivo"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!hasDifference}
                placeholder={
                  hasDifference ? "Ex.: troco errado, taxa da maquininha" : "Sem diferença"
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </section>
      )}

      {!preview && (
        <div className="flex justify-end">
          <Button size="lg" onClick={tryClose} disabled={close.isPending}>
            <Lock className="h-4 w-4" /> Fechar {monthLabel(ym)}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar o caixa de {monthLabel(ym)}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p>Resultado: {brl(result)}</p>
                <p>Reserva: {brl(distribution.reserveAmount)}</p>
                <p>
                  Distribuição:{" "}
                  {distribution.shares
                    .filter((s) => s.payout > 0)
                    .map((s) => `${s.name} ${brl(s.payout)}`)
                    .join(" · ") || "nenhuma"}
                </p>
                {hasDifference && (
                  <p>
                    Diferença na conferência:{" "}
                    {conference.rows
                      .filter((r) => Math.abs(r.difference) >= 0.01)
                      .map(
                        (r) =>
                          `${r.difference > 0 ? "sobra" : "quebra"} de ${brl(Math.abs(r.difference))} em ${methodLabel(r.method)}`,
                      )
                      .join(" · ")}
                  </p>
                )}
                <p className="pt-2">
                  As distribuições{hasDifference ? " e as sobras/quebras de caixa" : ""} serão
                  lançadas no Financeiro. Para corrigir depois, será preciso reabrir o mês
                  informando o motivo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                close.mutate();
              }}
              disabled={close.isPending}
            >
              Fechar mês
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
