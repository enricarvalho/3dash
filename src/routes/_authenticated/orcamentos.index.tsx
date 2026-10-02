import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";


import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { Pager, useTableState } from "@/components/table-kit";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OwnerTag } from "@/components/OwnerTag";
import { QuoteDetailsPanel } from "@/components/QuoteDetailsPanel";
import { QuoteFormModal } from "@/components/QuoteFormModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { listCustomers, listParts, listQuotes, type Quote } from "@/lib/db";
import { brl, dateBR, num } from "@/lib/format";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL } from "@/lib/domain";
import { logQuoteStatus, nextStatuses } from "@/lib/quote-status";
import { logQuoteAudit } from "@/lib/quote-audit";

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  head: () => ({
    meta: [
      { title: pageTitle("Orçamentos") },
      { name: "description", content: "Pipeline de orçamentos, do rascunho à produção." },
    ],
  }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: listQuotes });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const allItems = useQuery({
    queryKey: ["quote_items", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quote_items").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const profile = useQuery({
    queryKey: ["profiles", "me", "margin"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("min_margin_pct")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
  });
  const minMarginPct = Number(profile.data?.min_margin_pct ?? 20);

  const navigate = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("todos");
  const [details, setDetails] = useState<Quote | null>(null);
  const [onlyLowMargin, setOnlyLowMargin] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const changeStatus = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) => {
      const current = quotes.data?.find((q) => q.id === id);
      const from = current?.status ?? null;
      if (from === to) return { id, to };
      const { error } = await supabase.from("quotes").update({ status: to }).eq("id", id);
      if (error) throw new Error(error.message);
      await logQuoteStatus({ quoteId: id, from, to });
      await logQuoteAudit({
        quoteId: id,
        action: "status",
        changes: [
          {
            field: "status",
            label: "Status",
            from: from ? (QUOTE_STATUS_LABEL[from] ?? from) : null,
            to: QUOTE_STATUS_LABEL[to] ?? to,
          },
        ],
      });
      return { id, to };
    },
    onSuccess: ({ id, to }) => {
      qc.setQueryData(["quotes"], (old: Quote[] | undefined) =>
        (old ?? []).map((q) => (q.id === id ? { ...q, status: to } : q)),
      );
      setDetails((d) => (d && d.id === id ? { ...d, status: to } : d));
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote_status_history", id] });
      qc.invalidateQueries({ queryKey: ["quote_audit", id] });
      toast.success(`Status alterado para ${QUOTE_STATUS_LABEL[to] ?? to}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("quote_items").delete().eq("quote_id", id);
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, id) => {
      const deleted = quotes.data?.find((q) => q.id === id);
      qc.setQueryData(["quotes"], (old: Quote[] | undefined) =>
        (old ?? []).filter((q) => q.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote_items"] });
      toast.success(`Orçamento "${deleted?.title ?? ""}" excluído com sucesso`);
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marginByQuote = (() => {
    const map = new Map<string, { receita: number; venal: number; pct: number | null }>();
    for (const q of quotes.data ?? []) map.set(q.id, { receita: 0, venal: 0, pct: null });
    for (const it of allItems.data ?? []) {
      const entry = map.get(it.quote_id);
      if (!entry) continue;
      const qty = Number(it.quantity);
      const part = parts.data?.find((p) => p.id === it.part_id);
      entry.receita += Number(it.unit_price) * qty;
      entry.venal += (part ? Number(part.sale_price) : Number(it.unit_price)) * qty;
    }
    for (const [id, v] of map) {
      v.pct = v.receita > 0 ? ((v.receita - v.venal) / v.receita) * 100 : null;
      map.set(id, v);
    }
    return map;
  })();

  const isLowMargin = (id: string) => {
    const m = marginByQuote.get(id);
    if (!m || m.pct === null) return false;
    return m.pct < minMarginPct;
  };

  const lowMarginCount = (quotes.data ?? []).filter((q) => isLowMargin(q.id)).length;

  const rows = (quotes.data ?? [])
    .filter((q) => status === "todos" || q.status === status)
    .filter((q) => !onlyLowMargin || isLowMargin(q.id));
  const table = useTableState(rows, (q) => q.title);
  const customerName = (id: string | null) =>
    customers.data?.find((c) => c.id === id)?.name ?? "Sem cliente";

  const totalOpen = (quotes.data ?? [])
    .filter((q) => ["enviado", "aprovado", "em_producao"].includes(q.status))
    .reduce((s, q) => s + Number(q.total), 0);
  const totalDone = (quotes.data ?? [])
    .filter((q) => q.status === "concluido")
    .reduce((s, q) => s + Number(q.total), 0);

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        description="Acompanhe o pipeline e converta aprovados em produção."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo orçamento
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard accent label="Em negociação / produção" value={brl(totalOpen)} />
        <StatCard label="Concluídos" value={brl(totalDone)} />
        <StatCard label="Total de orçamentos" value={String(quotes.data?.length ?? 0)} />
        <StatCard
          label={`Margem abaixo de ${num(minMarginPct, 1)}%`}
          value={String(lowMarginCount)}
          hint={lowMarginCount ? "Requer atenção" : "Tudo saudável"}
        />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {QUOTE_STATUSES.map((st) => {
              const cards = (quotes.data ?? []).filter((q) => q.status === st);
              return (
                <div
                  key={st}
                  className={`rounded-xl border bg-muted/40 p-2 transition ${
                    dragOver === st ? "border-primary ring-2 ring-primary/30" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(st);
                  }}
                  onDragLeave={() => setDragOver((s) => (s === st ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const id = dragId ?? e.dataTransfer.getData("text/plain");
                    setDragId(null);
                    if (!id) return;
                    const q = quotes.data?.find((x) => x.id === id);
                    if (!q || q.status === st) return;
                    changeStatus.mutate({ id, to: st });
                  }}
                >
                  <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {QUOTE_STATUS_LABEL[st]} · {cards.length}
                  </p>
                  <div className="min-h-16 space-y-2">
                    {cards.map((q) => {
                      const m = marginByQuote.get(q.id);
                      const low = isLowMargin(q.id);
                      return (
                        <div
                          key={q.id}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(e) => {
                            setDragId(q.id);
                            e.dataTransfer.setData("text/plain", q.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                          onClick={() => setDetails(q)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDetails(q);
                            }
                          }}
                          title="Ver detalhes"
                          className={`block cursor-grab rounded-lg border bg-card p-2 text-sm shadow-sm transition hover:border-primary active:cursor-grabbing ${
                            low ? "border-destructive/60 ring-1 ring-destructive/30" : ""
                          } ${dragId === q.id ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-medium">{q.title}</p>
                            {low && (
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {customerName(q.customer_id)}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{brl(Number(q.total))}</p>
                            {m?.pct !== null && m?.pct !== undefined && (
                              <span
                                className={`text-xs font-medium ${
                                  low ? "text-destructive" : "text-muted-foreground"
                                }`}
                              >
                                {num(m.pct, 1)}%
                              </span>
                            )}
                          </div>
                          <OwnerTag
                            ownerId={q.owner_id}
                            prefix="por"
                            className="mt-1 text-[11px]"
                          />
                        </div>
                      );
                    })}

                    {cards.length === 0 && (
                      <p className="px-1 py-3 text-xs text-muted-foreground">Vazio</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="lista" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar orçamento"
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {QUOTE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {QUOTE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 rounded-md border bg-card px-3 text-sm">
              <Checkbox
                checked={onlyLowMargin}
                onCheckedChange={(v) => setOnlyLowMargin(v === true)}
              />
              <span>Só margem abaixo de {num(minMarginPct, 1)}%</span>
            </label>
          </div>

          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orçamento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Criado por</TableHead>

                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map((q) => {
                  const m = marginByQuote.get(q.id);
                  const low = isLowMargin(q.id);
                  const negative = m && m.pct !== null && m.pct < 0;
                  return (
                    <TableRow
                      key={q.id}
                      className={`${clickableRow} ${low ? "bg-destructive/5" : ""}`}
                      onClick={() => setDetails(q)}
                      title="Ver detalhes"
                    >
                      <TableCell className="font-medium">{q.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {customerName(q.customer_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{QUOTE_STATUS_LABEL[q.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dateBR(q.created_at)}
                      </TableCell>
                      <TableCell>
                        <OwnerTag ownerId={q.owner_id} />
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {brl(Number(q.total))}
                      </TableCell>
                      <TableCell className="text-right">
                        {m && m.pct !== null ? (
                          low ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {negative ? "Negativa " : ""}
                              {num(m.pct, 1)}%
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">{num(m.pct, 1)}%</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {table.filtered.length === 0 && <EmptyState message="Nenhum orçamento encontrado." />}
            <Pager {...table} total={table.filtered.length} />
          </div>
        </TabsContent>
      </Tabs>

      <RecordDetailsModal
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        title={details?.title ?? ""}
        subtitle={details ? customerName(details.customer_id) : undefined}
        fields={
          details
            ? [
                { label: "Status", value: QUOTE_STATUS_LABEL[details.status] ?? details.status },
                { label: "Total", value: brl(Number(details.total)) },
                {
                  label: "Margem",
                  value: (() => {
                    const m = marginByQuote.get(details.id);
                    return m && m.pct !== null ? `${num(m.pct, 1)}%` : "—";
                  })(),
                },
                { label: "Criado em", value: dateBR(details.created_at) },
              ]
            : []
        }
        actions={undefined}
      >
        {details ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Fase atual:</span>
                <Badge variant="secondary">
                  {QUOTE_STATUS_LABEL[details.status] ?? details.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {nextStatuses(details.status).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ id: details.id, to: s })}
                  >
                    {QUOTE_STATUS_LABEL[s] ?? s}
                  </Button>
                ))}
                <Select
                  value=""
                  onValueChange={(v) => changeStatus.mutate({ id: details.id, to: v })}
                >
                  <SelectTrigger className="h-8 w-[150px]">
                    <SelectValue placeholder="Outra fase..." />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STATUSES.filter((s) => s !== details.status).map((s) => (
                      <SelectItem key={s} value={s}>
                        {QUOTE_STATUS_LABEL[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <QuoteDetailsPanel quote={details} />

            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setEditId(details.id);
                  setDetails(null);
                }}
              >
                <Pencil className="h-4 w-4" /> Editar orçamento
              </Button>
              <Button
                variant="destructive"

                onClick={() => {
                  const q = details;
                  setDetails(null);
                  setToDelete({ id: q.id, title: q.title });
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </div>
          </div>
        ) : null}
      </RecordDetailsModal>


      <QuoteFormModal
        key={editId ?? "new"}
        quoteId={editId}
        open={open || !!editId}
        onSaved={() => setEditId(null)}
        onOpenChange={(v) => {
          if (!v) setEditId(null);
          setOpen(v && !editId ? v : false);
        }}
        onCreated={(quoteId) => navigate({ to: "/orcamentos/$quoteId", params: { quoteId } })}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" e todos os itens serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) remove.mutate(toDelete.id);
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
