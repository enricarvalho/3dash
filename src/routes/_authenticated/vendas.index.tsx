import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History,
  Lock,
  Plus,
  Trash2,
  Pencil,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { Pager, SortButton, useTableState } from "@/components/table-kit";
import { SaleDetailsModal } from "@/components/SaleDetailsModal";
import { ReceiptModal } from "@/components/ReceiptModal";
import { SaleFormModal } from "@/components/SaleFormModal";
import { OwnerTag } from "@/components/OwnerTag";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCustomers, listParts, listSaleItems, listSales, type Sale } from "@/lib/db";
import { brl, dateBR, num } from "@/lib/format";
import {
  applyInventoryConsumption,
  applyMaterialSaleConsumption,
  diffQty,
  qtyByMaterial,
  qtyByPart,
} from "@/lib/inventory";

import { SALE_STATUSES, SALE_STATUS_LABEL } from "@/lib/domain";
import { logSaleAudit } from "@/lib/sale-audit";
import { SaleRemovalLog } from "@/components/SaleRemovalLog";
import { useClosedMonths } from "@/hooks/use-closed-months";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/vendas/")({
  head: () => ({
    meta: [
      { title: pageTitle("Vendas") },
      {
        name: "description",
        content: "Registre vendas de peças, acompanhe receita, custo e lucro por venda.",
      },
      { property: "og:title", content: pageTitle("Vendas") },
      {
        property: "og:description",
        content: "Registre vendas de peças, acompanhe receita, custo e lucro por venda.",
      },
    ],
  }),
  component: VendasPage,
});

function VendasPage() {
  const qc = useQueryClient();
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const saleItems = useQuery({ queryKey: ["sale_items"], queryFn: () => listSaleItems() });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const { isClosed, closedMessage } = useClosedMonths();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [toDelete, setToDelete] = useState<Sale | null>(null);
  const [details, setDetails] = useState<Sale | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [removalLogOpen, setRemovalLogOpen] = useState(false);
  const [period, setPeriod] = useState("mes");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const customerName = (id: string | null) =>
    (customers.data ?? []).find((c) => c.id === id)?.name ?? "Consumidor final";

  const saleCustomer = (s: Sale) =>
    s.customer_id ? customerName(s.customer_id) : s.guest_name || "Consumidor final";

  const itemsBySale = useMemo(() => {
    const map = new Map<string, { qty: number; total: number; cost: number }>();
    (saleItems.data ?? []).forEach((i) => {
      const cur = map.get(i.sale_id) ?? { qty: 0, total: 0, cost: 0 };
      const q = Number(i.quantity);
      map.set(i.sale_id, {
        qty: cur.qty + q,
        total: cur.total + q * Number(i.unit_price),
        cost: cur.cost + q * Number(i.unit_cost),
      });
    });
    return map;
  }, [saleItems.data]);

  const itemsTextBySale = useMemo(() => {
    const map = new Map<string, string>();
    (saleItems.data ?? []).forEach((i) => {
      map.set(i.sale_id, `${map.get(i.sale_id) ?? ""} ${i.description}`);
    });
    return map;
  }, [saleItems.data]);

  const range = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    if (period === "hoje") return { start: iso(now), end: iso(now) };
    if (period === "7dias") {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: iso(s), end: iso(now) };
    }
    if (period === "mes")
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    if (period === "mes_passado")
      return {
        start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    if (period === "personalizado") return { start: from || null, end: to || null };
    return { start: null, end: null };
  }, [period, from, to]);

  const rows = (sales.data ?? []).filter((s) => {
    if (statusFilter !== "todos" && s.status !== statusFilter) return false;
    if (range.start && s.sale_date < range.start) return false;
    if (range.end && s.sale_date > range.end) return false;
    return true;
  });
  const table = useTableState(
    rows,
    (s) =>
      `${s.notes ?? ""} ${saleCustomer(s)} ${s.guest_phone ?? ""} ${s.guest_email ?? ""} ${itemsTextBySale.get(s.id) ?? ""}`,
  );

  const totals = rows.reduce(
    (acc, s) => {
      if (s.status === "cancelado") return acc;
      return {
        receita: acc.receita + Number(s.total),
        custo: acc.custo + Number(s.cost_total),
      };
    },
    { receita: 0, custo: 0 },
  );
  const lucro = totals.receita - totals.custo;

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (sale: Sale) => {
    // em mês fechado só dá para registrar o pagamento de venda pendente
    if (isClosed(sale.sale_date) && sale.status !== "pendente")
      return toast.error(closedMessage(sale.sale_date));
    setEditing(sale);
    setOpen(true);
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const sale = (sales.data ?? []).find((s) => s.id === id);
      const prevItems = sale && sale.status !== "cancelado" ? await listSaleItems(id) : [];
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, amount")
        .eq("sale_id", id)
        .eq("category", "venda");
      const txTotal = (txs ?? []).reduce((acc, t) => acc + Number(t.amount || 0), 0);

      // registra a auditoria antes de remover a venda
      await logSaleAudit({
        saleId: id,
        action: "delete",
        saleLabel: sale ? saleCustomer(sale) : null,
        changes: [
          {
            field: "total",
            label: "Total da venda",
            from: brl(Number(sale?.total) || 0),
            to: "excluída",
          },
          {
            field: "transaction",
            label: "Lançamento no financeiro",
            from: txs?.length ? brl(txTotal) : "sem lançamento",
            to: "removido",
          },
        ],
      });

      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await applyInventoryConsumption(diffQty({}, qtyByPart(prevItems)));
      await applyMaterialSaleConsumption(diffQty({}, qtyByMaterial(prevItems)), "Estorno de venda");
    },
    onSuccess: () => {
      ["sales", "sale_items", "transactions", "assets", "materials", "stock_movements", "sale_audit_log"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

      toast.success("Venda excluída");
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Vendas"
        description="Registro de vendas de peças com receita, custo e lucro."
        actions={
          <>
            <Button variant="outline" onClick={() => setRemovalLogOpen(true)}>
              <History className="h-4 w-4" /> Exclusões
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Nova venda
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Receita" value={brl(totals.receita)} icon={<ShoppingCart className="h-4 w-4" />} accent />
        <StatCard label="Custo de produção" value={brl(totals.custo)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard
          label="Lucro"
          value={brl(lucro)}
          hint={totals.receita > 0 ? `${num((lucro / totals.receita) * 100, 1)}% de margem` : undefined}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por cliente, item ou observação..."
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7dias">Últimos 7 dias</SelectItem>
            <SelectItem value="mes">Mês atual</SelectItem>
            <SelectItem value="mes_passado">Mês passado</SelectItem>
            <SelectItem value="personalizado">Período personalizado</SelectItem>
            <SelectItem value="todos">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        {period === "personalizado" && (
          <>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
              aria-label="Data final"
            />
          </>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {SALE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SALE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {rows.length} venda{rows.length === 1 ? "" : "s"} no filtro
        </span>
      </div>

      {table.paged.length === 0 ? (
        <EmptyState message="Nenhuma venda registrada ainda." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton label="Data" onClick={() => table.toggleSort("sale_date")} />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead className="text-right">
                  <SortButton label="Total" onClick={() => table.toggleSort("total")} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton label="Custo" onClick={() => table.toggleSort("cost_total")} />
                </TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead>
                  <SortButton label="Status" onClick={() => table.toggleSort("status")} />
                </TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.paged.map((s) => {
                const agg = itemsBySale.get(s.id);
                const profit = Number(s.total) - Number(s.cost_total);
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setDetails(s)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setDetails(s);
                    }}
                  >
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {dateBR(s.sale_date)}
                        {isClosed(s.sale_date) && (
                          <Lock className="h-3 w-3 text-muted-foreground" aria-label="Mês fechado" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{saleCustomer(s)}</div>
                      <OwnerTag ownerId={s.owner_id} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{num(agg?.qty ?? 0, 0)} un.</TableCell>
                    <TableCell className="text-right font-medium">{brl(Number(s.total))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{brl(Number(s.cost_total))}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${profit < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {brl(profit)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "pago" ? "default" : "secondary"}>
                        {SALE_STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setReceiptId(s.id)}
                          aria-label="Ver recibo"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)} aria-label="Editar venda">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setToDelete(s)}
                          disabled={isClosed(s.sale_date)}
                          title={isClosed(s.sale_date) ? closedMessage(s.sale_date) : undefined}
                          aria-label="Excluir venda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pager {...table} total={table.filtered.length} />
        </div>
      )}

      <ReceiptModal
        saleId={receiptId}
        open={!!receiptId}
        onOpenChange={(o) => !o && setReceiptId(null)}
      />
      <SaleDetailsModal
        sale={details}
        customerName={details ? saleCustomer(details) : ""}
        customerContact={
          details && !details.customer_id
            ? [details.guest_phone, details.guest_email].filter(Boolean).join(" · ")
            : ""
        }
        onClose={() => setDetails(null)}
        onShowReceipt={(sale) => setReceiptId(sale.id)}
        onEdit={openEdit}
      />

      <SaleFormModal open={open} onOpenChange={setOpen} editing={editing} />
      <SaleRemovalLog open={removalLogOpen} onOpenChange={setRemovalLogOpen} />


      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens desta venda também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
