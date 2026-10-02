import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileDown, Mail, MoreHorizontal, Phone, Plus, Trash2, Factory } from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { useOwners } from "@/hooks/use-owners";
import { ImageUploadField } from "@/components/ImageUploadField";
import { PartImage } from "@/components/PartImage";
import { PrintHeader } from "@/components/PrintHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormModal, FormModalContent, FormModalHeader, FormModalTitle, FormModalBody } from "@/components/ui/form-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { QuoteStatusTimeline } from "@/components/QuoteStatusTimeline";
import { logQuoteStatus, nextStatuses } from "@/lib/quote-status";
import { QuoteAuditLog } from "@/components/QuoteAuditLog";
import { logQuoteAudit } from "@/lib/quote-audit";
import {
  getQuote,
  listCustomers,
  listMaterials,
  listParts,
  listQuoteItems,
  type Quote,
  type QuoteItem,
} from "@/lib/db";
import { useSaveRecord } from "@/hooks/use-crud";
import { brl, dateBR, minutesToHuman } from "@/lib/format";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/orcamentos/$quoteId")({
  head: () => ({
    meta: [
      { title: "Orçamento · 3D Create" },
      { name: "description", content: "Itens, valores e status do orçamento." },
    ],
  }),
  component: QuoteDetail,
  errorComponent: QuoteError,
  notFoundComponent: () => <EmptyState message="Orçamento não encontrado." />,
});

function QuoteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Erro ao carregar: {message}</p>
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

const emptyItem = {
  part_id: "",
  material_id: "",
  description: "",
  quantity: "1",
  unit_price: "0",
  print_minutes: "0",
  image_url: null as string | null,
};

function QuoteDetail() {
  const { quoteId } = Route.useParams();
  const qc = useQueryClient();
  const quote = useQuery({ queryKey: ["quotes", quoteId], queryFn: () => getQuote(quoteId) });
  const { ownerName } = useOwners();
  const items = useQuery({
    queryKey: ["quote_items", quoteId],
    queryFn: () => listQuoteItems(quoteId),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });
  const saveQuote = useSaveRecord("quotes");
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [form, setForm] = useState({ ...emptyItem });
  const [notes, setNotes] = useState(quote.data?.notes ?? "");

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("quotes").update({ notes }).eq("id", quoteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes", quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Observações atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ to, note }: { to: string; note: string }) => {
      const from = quote.data?.status ?? null;
      if (from === to) return { to, from };
      const { error } = await supabase.from("quotes").update({ status: to }).eq("id", quoteId);
      if (error) throw new Error(error.message);
      await logQuoteStatus({ quoteId, from, to, note });
      await logQuoteAudit({
        quoteId,
        action: "status",
        changes: [
          {
            field: "status",
            label: "Status",
            from: from ? (QUOTE_STATUS_LABEL[from] ?? from) : null,
            to: QUOTE_STATUS_LABEL[to] ?? to,
          },
          ...(note.trim() ? [{ field: "note", label: "Observação", from: null, to: note.trim() }] : []),
        ],
      });
      return { to, from };
    },
    onSuccess: ({ to, from }) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quotes", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote_status_history", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote_audit_log", quoteId] });
      setPendingStatus(null);
      setStatusNote("");
      toast.success(`Status alterado para ${QUOTE_STATUS_LABEL[to]}`);
      if (to === "concluido" && from !== "concluido") registerSaleFinance.mutate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeQuote = useMutation({
    mutationFn: async () => {
      await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      const title = quote.data?.title ?? "";
      qc.setQueryData(["quotes"], (old: Quote[] | undefined) =>
        (old ?? []).filter((q) => q.id !== quoteId),
      );
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      await qc.invalidateQueries({ queryKey: ["quote_items"] });
      toast.success(`Orçamento "${title}" excluído com sucesso`);
      navigate({ to: "/orcamentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = (items.data ?? []).reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unit_price),
    0,
  );

  const syncTotal = async (value: number) => {
    await supabase.from("quotes").update({ total: value }).eq("id", quoteId);
    qc.invalidateQueries({ queryKey: ["quotes"] });
  };

  const addItem = useMutation({
    mutationFn: async () => {
      if (!form.description.trim() && !form.part_id) throw new Error("Descreva o item");
      const part = parts.data?.find((p) => p.id === form.part_id);
      const { error } = await supabase.from("quote_items").insert({
        quote_id: quoteId,
        part_id: form.part_id || null,
        material_id: form.material_id || part?.material_id || null,
        description: form.description.trim() || part?.name || "Item",
        quantity: Number(form.quantity) || 1,
        unit_price: Number(form.unit_price) || 0,
        print_minutes: Number(form.print_minutes) || part?.print_minutes || 0,
        image_url: form.image_url ?? part?.image_url ?? null,
      });
      if (error) throw new Error(error.message);
      const newTotal = total + (Number(form.quantity) || 1) * (Number(form.unit_price) || 0);
      await syncTotal(newTotal);
      await logQuoteAudit({
        quoteId,
        action: "item_add",
        changes: [
          {
            field: "item",
            label: "Item",
            from: null,
            to: `${form.description.trim() || part?.name || "Item"} · ${Number(form.quantity) || 1}x ${brl(Number(form.unit_price) || 0)}`,
          },
          { field: "total", label: "Total", from: brl(total), to: brl(newTotal) },
        ],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote_items", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote_audit_log", quoteId] });
      toast.success("Item adicionado");
      setForm({ ...emptyItem });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (item: QuoteItem) => {
      const { error } = await supabase.from("quote_items").delete().eq("id", item.id);
      if (error) throw new Error(error.message);
      const newTotal = total - Number(item.quantity) * Number(item.unit_price);
      await syncTotal(newTotal);
      await logQuoteAudit({
        quoteId,
        action: "item_remove",
        changes: [
          {
            field: "item",
            label: "Item",
            from: `${item.description} · ${Number(item.quantity)}x ${brl(Number(item.unit_price))}`,
            to: null,
          },
          { field: "total", label: "Total", from: brl(total), to: brl(newTotal) },
        ],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote_items", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote_audit_log", quoteId] });
      toast.success("Item removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToProduction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "em_producao" })
        .eq("id", quoteId);
      if (error) throw new Error(error.message);
      await logQuoteStatus({
        quoteId,
        from: quote.data?.status ?? null,
        to: "em_producao",
        note: "Convertido em produção (baixa de estoque)",
      });
      await logQuoteAudit({
        quoteId,
        action: "production",
        changes: [
          {
            field: "status",
            label: "Status",
            from: quote.data?.status ? (QUOTE_STATUS_LABEL[quote.data.status] ?? quote.data.status) : null,
            to: QUOTE_STATUS_LABEL["em_producao"],
          },
          { field: "estoque", label: "Estoque", from: null, to: "Baixa de material aplicada" },
        ],
      });
      for (const item of items.data ?? []) {
        const part = parts.data?.find((p) => p.id === item.part_id);
        const materialId = item.material_id ?? part?.material_id ?? null;
        const grams = Number(part?.material_grams ?? 0) * Number(item.quantity);
        if (materialId && grams > 0) {
          await supabase.from("stock_movements").insert({
            material_id: materialId,
            quantity: -(grams / 1000),
            reason: "producao",
            note: `Produção do orçamento: ${quote.data?.title ?? ""}`,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      qc.invalidateQueries({ queryKey: ["quote_status_history", quoteId] });
      qc.invalidateQueries({ queryKey: ["quote_audit_log", quoteId] });
      toast.success("Orçamento em produção e estoque baixado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const registerSaleFinance = useMutation({
    mutationFn: async () => {
      if (!quote.data) return { created: false as const };
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("quote_id", quoteId);
      if (existing && existing.length > 0) return { created: false as const };

      const today = new Date().toISOString().slice(0, 10);
      const revenue = Number(quote.data.total) || 0;
      const cost = (items.data ?? []).reduce((s, i) => {
        const part = i.part_id ? parts.data?.find((p) => p.id === i.part_id) : undefined;
        const venal = part ? Number(part.sale_price) : Number(i.unit_price);
        return s + venal * Number(i.quantity);
      }, 0);

      const rows: {
        kind: string;
        category: string;
        description: string;
        amount: number;
        occurred_on: string;
        quote_id: string;
        customer_id: string | null;
      }[] = [];
      if (revenue > 0) {
        rows.push({
          kind: "entrada",
          category: "venda",
          description: `Venda: ${quote.data.title}`,
          amount: revenue,
          occurred_on: today,
          quote_id: quoteId,
          customer_id: quote.data.customer_id ?? null,
        });
      }
      if (cost > 0) {
        rows.push({
          kind: "saida",
          category: "custo",
          description: `Custo (valor venal): ${quote.data.title}`,
          amount: cost,
          occurred_on: today,
          quote_id: quoteId,
          customer_id: quote.data.customer_id ?? null,
        });
      }
      if (rows.length === 0) return { created: false as const };
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw new Error(error.message);
      await logQuoteAudit({
        quoteId,
        action: "finance",
        changes: [
          { field: "receita", label: "Receita lançada", from: null, to: brl(revenue) },
          { field: "custo", label: "Custo lançado", from: null, to: brl(cost) },
        ],
      });
      return { created: true as const, revenue, cost };
    },
    onSuccess: (result) => {
      if (result?.created) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["quote_audit_log", quoteId] });
        toast.success(
          `Financeiro atualizado: receita ${brl(result.revenue)} · custo ${brl(result.cost)}`,
        );
      }
    },
    onError: (e: Error) => toast.error(`Falha ao lançar no financeiro: ${e.message}`),
  });

  // Nomeia a aba (e, por consequência, o PDF ao "Salvar como PDF") com o nome do cliente.
  useEffect(() => {
    const original = document.title;
    if (quote.data) {
      const customerName = customers.data?.find((c) => c.id === quote.data?.customer_id)?.name;
      document.title = ["Orçamento", quote.data.title, customerName].filter(Boolean).join(" - ");
    }
    return () => {
      document.title = original;
    };
  }, [quote.data, customers.data]);

  if (!quote.data) return <EmptyState message="Carregando orçamento..." />;

  const customer = customers.data?.find((c) => c.id === quote.data?.customer_id);
  const totalMinutes = (items.data ?? []).reduce(
    (s, i) => s + Number(i.print_minutes) * Number(i.quantity),
    0,
  );

  return (
    <div className="print:p-6">
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link to="/orcamentos">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <PrintHeader
        subtitle={`Orçamento · ${quote.data.title}`}
        meta={customer?.name ?? undefined}
      />



      <PageHeader
        title={quote.data.title}
        description={`${customer?.name ?? "Sem cliente"} · criado em ${dateBR(quote.data.created_at)} por ${ownerName(quote.data.owner_id)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select
              value={quote.data.status}
              onValueChange={(v) => {
                if (v === quote.data?.status) return;
                setStatusNote("");
                setPendingStatus(v);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_STATUSES.map((s) => {
                  const suggested = nextStatuses(quote.data!.status).includes(s);
                  return (
                    <SelectItem key={s} value={s}>
                      {QUOTE_STATUS_LABEL[s]}
                      {!suggested && s !== quote.data!.status ? " (fora do fluxo)" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.print()}>
              <FileDown className="h-4 w-4" /> Gerar PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => convertToProduction.mutate()}
              disabled={convertToProduction.isPending}
            >
              <Factory className="h-4 w-4" /> Converter em produção
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Adicionar item
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Excluir orçamento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {customer && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Cliente</h2>
          <div className="print-grid-2 mt-2 grid gap-1 text-sm sm:grid-cols-2">
            <p className="font-medium">{customer.name}</p>
            <p className="text-muted-foreground">
              {customer.doc_number ? `Doc.: ${customer.doc_number}` : ""}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {customer.phone ? (
                <a href={`tel:${customer.phone.replace(/\D/g, "")}`} className="hover:underline">
                  {customer.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">Sem telefone</span>
              )}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {customer.email ? (
                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              ) : (
                <span className="text-muted-foreground">Sem e-mail</span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="print-grid-2 grid gap-4 sm:grid-cols-2">
        <StatCard accent label="Valor total" value={brl(total)} />
        <StatCard label="Tempo estimado" value={minutesToHuman(totalMinutes)} />
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4 print:border-0 print:bg-transparent print:p-0">
        <p className="text-xs text-muted-foreground print:hidden">Observações</p>
        {notes.trim() ? (
          <p className="mt-2 hidden whitespace-pre-wrap text-sm leading-relaxed print:block">
            {notes}
          </p>
        ) : null}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (quote.data?.notes ?? "")) {
              saveNotes.mutate();
            }
          }}
          placeholder="Digite as observações do orçamento..."
          className="mt-1 min-h-[120px] resize-y border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 print:hidden"
        />
      </div>



      <div className="mt-4 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Valor un.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="w-12 print:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items.data ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    {i.image_url && (
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <PartImage
                          src={i.image_url}
                          alt={i.description}
                          variant="thumb"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      {i.description}
                      <span className="block text-xs text-muted-foreground">
                        {minutesToHuman(i.print_minutes)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {materials.data?.find((m) => m.id === i.material_id)?.name ?? "—"}
                </TableCell>
                <TableCell className="text-right">{Number(i.quantity)}</TableCell>
                <TableCell className="text-right">{brl(Number(i.unit_price))}</TableCell>
                <TableCell className="text-right font-medium">
                  {brl(Number(i.quantity) * Number(i.unit_price))}
                </TableCell>
                <TableCell className="text-right print:hidden">
                  <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(items.data ?? []).length === 0 && <EmptyState message="Nenhum item neste orçamento." />}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">Total do orçamento</span>
          <span className="text-lg font-bold">{brl(total)}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 print:hidden">
        <QuoteStatusTimeline quoteId={quoteId} />
        <QuoteAuditLog quoteId={quoteId} />
      </div>

      <FormModal
        open={pendingStatus !== null}
        onOpenChange={(o) => {
          if (!o) setPendingStatus(null);
        }}
      >
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>
              Alterar status para {pendingStatus ? QUOTE_STATUS_LABEL[pendingStatus] : ""}
            </FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <p className="text-sm text-muted-foreground">
              De <strong>{QUOTE_STATUS_LABEL[quote.data.status]}</strong> para{" "}
              <strong>{pendingStatus ? QUOTE_STATUS_LABEL[pendingStatus] : ""}</strong>. A data e o
              usuário são registrados automaticamente.
            </p>
            {pendingStatus && !nextStatuses(quote.data.status).includes(pendingStatus) && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                Essa transição está fora do fluxo sugerido, mas pode ser registrada.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Ex.: cliente aprovou por WhatsApp"
              />
            </div>
            <Button
              className="w-full"
              disabled={changeStatus.isPending}
              onClick={() =>
                pendingStatus && changeStatus.mutate({ to: pendingStatus, note: statusNote })
              }
            >
              Confirmar mudança
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <p className="mt-4 hidden text-xs text-muted-foreground print:block">
        3D Create · Impressão 3D · Goiânia/GO — orçamento válido por 15 dias.
      </p>

      <FormModal open={open} onOpenChange={setOpen}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>Adicionar item</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <div className="space-y-1.5">
              <Label>Peça do catálogo</Label>
              <Select
                value={form.part_id || "none"}
                onValueChange={(v) => {
                  const part = parts.data?.find((p) => p.id === v);
                  setForm({
                    ...form,
                    part_id: v === "none" ? "" : v,
                    description: part?.name ?? form.description,
                    unit_price: part
                      ? String(
                          Number((part as unknown as { sale_price?: number }).sale_price) ||
                            part.estimated_cost,
                        )
                      : form.unit_price,

                    print_minutes: part ? String(part.print_minutes) : form.print_minutes,
                    material_id: part?.material_id ?? form.material_id,
                    image_url: part?.image_url ?? form.image_url,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Item avulso</SelectItem>
                  {(parts.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Select
                value={form.material_id || "none"}
                onValueChange={(v) => setForm({ ...form, material_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informar</SelectItem>
                  {(materials.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Qtd.</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor un.</Label>
                <Input
                  type="number"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Min.</Label>
                <Input
                  type="number"
                  value={form.print_minutes}
                  onChange={(e) => setForm({ ...form, print_minutes: e.target.value })}
                />
              </div>
            </div>
            <ImageUploadField
              label="Foto do produto ou arte"
              value={form.image_url}
              onChange={(path) => setForm({ ...form, image_url: path })}
            />
            <div className="rounded-lg bg-muted p-3 text-sm">

              Subtotal:{" "}
              <strong>{brl((Number(form.quantity) || 0) * (Number(form.unit_price) || 0))}</strong>
            </div>
            <Button className="w-full" onClick={() => addItem.mutate()} disabled={addItem.isPending}>
              Adicionar
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{quote.data?.title}" e todos os itens serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                removeQuote.mutate();
              }}
              disabled={removeQuote.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
