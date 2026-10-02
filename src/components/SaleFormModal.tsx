import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SearchSelect } from "@/components/SearchSelect";
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
import { listCustomers, listMaterials, listParts, listSaleItems, type Sale } from "@/lib/db";
import { materialLabel } from "@/lib/material-stock";
import { brl, num } from "@/lib/format";
import {
  applyInventoryConsumption,
  applyMaterialSaleConsumption,
  diffQty,
  qtyByMaterial,
  qtyByPart,
} from "@/lib/inventory";
import { diffFields, logSaleAudit, SALE_FIELD_LABELS } from "@/lib/sale-audit";
import { useClosedMonths } from "@/hooks/use-closed-months";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  SALE_STATUSES,
  SALE_STATUS_LABEL,
} from "@/lib/domain";

type ItemForm = {
  key: string;
  part_id: string;
  material_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
  image_url: string | null;
};

const newItem = (): ItemForm => ({
  key: crypto.randomUUID(),
  part_id: "",
  material_id: "",
  description: "",
  quantity: "1",
  unit_price: "0",
  unit_cost: "0",
  image_url: null,
});

const emptySale = () => ({
  customer_id: "",
  guest_name: "",
  guest_phone: "",
  guest_email: "",
  sale_date: new Date().toISOString().slice(0, 10),
  status: "pago",
  payment_method: "pix",
  discount: "0",
  notes: "",
});

export type SaleFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Sale | null;
  onSaved?: (saleId: string) => void;
};

export function SaleFormModal({ open, onOpenChange, editing, onSaved }: SaleFormModalProps) {
  const { isClosed, closedMessage } = useClosedMonths();
  const qc = useQueryClient();
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });

  const [form, setForm] = useState(emptySale);
  const [items, setItems] = useState<ItemForm[]>([newItem()]);

  const isOpen = open;

  const reset = (sale?: Sale | null) => {
    if (sale) {
      setForm({
        customer_id: sale.customer_id ?? "",
        guest_name: sale.guest_name ?? "",
        guest_phone: sale.guest_phone ?? "",
        guest_email: sale.guest_email ?? "",
        sale_date: sale.sale_date,
        status: sale.status,
        payment_method: sale.payment_method ?? "pix",
        discount: String(sale.discount),
        notes: sale.notes ?? "",
      });
      listSaleItems(sale.id).then((list) =>
        setItems(
          list.length
            ? list.map((i) => ({
                key: i.id,
                part_id: i.part_id ?? "",
                material_id: i.material_id ?? "",
                description: i.description,
                quantity: String(i.quantity),
                unit_price: String(i.unit_price),
                unit_cost: String(i.unit_cost),
                image_url: i.image_url,
              }))
            : [newItem()],
        ),
      );
    } else {
      setForm(emptySale());
      setItems([newItem()]);
    }
  };

  // sincroniza estado interno quando a prop editing muda / modal abre
  const [lastEditingId, setLastEditingId] = useState<string | null | undefined>(undefined);
  const editingId = editing?.id ?? null;
  if (editingId !== lastEditingId) {
    setLastEditingId(editingId);
    reset(editing);
  }

  const customerName = (id: string | null) =>
    (customers.data ?? []).find((c) => c.id === id)?.name ?? "Consumidor final";

  const calc = items.reduce(
    (acc, i) => {
      const q = Number(i.quantity) || 0;
      return {
        total: acc.total + q * (Number(i.unit_price) || 0),
        cost: acc.cost + q * (Number(i.unit_cost) || 0),
      };
    },
    { total: 0, cost: 0 },
  );
  const discount = Number(form.discount) || 0;
  const finalTotal = Math.max(calc.total - discount, 0);
  const finalProfit = finalTotal - calc.cost;

  const pickCatalog = (key: string, value: string) => {
    const materialId = value.startsWith("mat:") ? value.slice(4) : "";
    const partId = materialId ? "" : value;
    const m = (materials.data ?? []).find((x) => x.id === materialId);
    if (materialId) {
      setItems((list) =>
        list.map((i) =>
          i.key === key
            ? {
                ...i,
                part_id: "",
                material_id: materialId,
                description: m ? materialLabel(m) : i.description,
                unit_price: m ? String(Number(m.cost_per_unit) || 0) : i.unit_price,
                unit_cost: m ? String(Number(m.cost_per_unit) || 0) : i.unit_cost,
              }
            : i,
        ),
      );
      return;
    }
    const p = (parts.data ?? []).find((x) => x.id === partId);
    setItems((list) =>
      list.map((i) =>
        i.key === key
          ? {
              ...i,
              material_id: "",
              part_id: partId,
              description: p ? p.name : i.description,
              unit_price: p ? String(Number(p.sale_price) || 0) : i.unit_price,
              unit_cost: p ? String(Number(p.estimated_cost) || 0) : i.unit_cost,
              image_url: p ? (p.image_url ?? p.image_urls?.[0] ?? null) : i.image_url,
            }
          : i,
      ),
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      const valid = items.filter((i) => i.description.trim() && Number(i.quantity) > 0);
      if (!valid.length) throw new Error("Adicione ao menos um item com descrição e quantidade");

      // mês fechado: só é possível registrar o pagamento de uma venda pendente, sem mudar valores
      const payingClosed =
        !!editing &&
        isClosed(editing.sale_date) &&
        editing.status === "pendente" &&
        form.status === "pago";
      if (editing && isClosed(editing.sale_date) && !payingClosed)
        throw new Error(closedMessage(editing.sale_date));
      if (isClosed(form.sale_date) && !payingClosed) throw new Error(closedMessage(form.sale_date));

      const payload = {
        customer_id: form.customer_id || null,
        guest_name: form.customer_id ? null : form.guest_name.trim().slice(0, 100) || null,
        guest_phone: form.customer_id ? null : form.guest_phone.trim().slice(0, 20) || null,
        guest_email: form.customer_id ? null : form.guest_email.trim().slice(0, 255) || null,
        sale_date: form.sale_date,
        status: form.status,
        payment_method: form.payment_method,
        discount,
        total: finalTotal,
        cost_total: calc.cost,
        notes: form.notes.trim() || null,
      };

      const prevItems =
        editing && editing.status !== "cancelado"
          ? await listSaleItems(editing.id)
          : [];
      const prevQty = qtyByPart(prevItems);
      const prevMatQty = qtyByMaterial(prevItems);

      let saleId = editing?.id;
      if (saleId) {
        const { error } = await supabase.from("sales").update(payload).eq("id", saleId);
        if (error) throw new Error(error.message);
        await supabase.from("sale_items").delete().eq("sale_id", saleId);
      } else {
        const { data, error } = await supabase.from("sales").insert(payload).select().single();
        if (error) throw new Error(error.message);
        saleId = data.id;
      }

      const { error: itemsError } = await supabase.from("sale_items").insert(
        valid.map((i) => ({
          sale_id: saleId!,
          part_id: i.part_id || null,
          material_id: i.material_id || null,
          description: i.description.trim(),
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          unit_cost: Number(i.unit_cost) || 0,
          image_url: i.image_url,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);

      // sincroniza o lançamento financeiro vinculado à venda
      const shouldHaveTx = form.status === "pago" && finalTotal > 0;
      const txPayload = {
        kind: "entrada",
        category: "venda",
        description: `Venda · ${form.customer_id ? customerName(form.customer_id) : form.guest_name.trim() || "Consumidor final"}`,
        amount: finalTotal,
        // pagamento de venda de mês fechado entra no caixa na data de hoje
        occurred_on: payingClosed ? new Date().toISOString().slice(0, 10) : form.sale_date,
        customer_id: form.customer_id || null,
        sale_id: saleId!,
        payment_method: form.payment_method || null,
      };
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("sale_id", saleId!)
        .eq("category", "venda");

      if (shouldHaveTx) {
        if (existingTx?.length) {
          const [keep, ...extras] = existingTx;
          await supabase.from("transactions").update(txPayload).eq("id", keep.id);
          if (extras.length)
            await supabase
              .from("transactions")
              .delete()
              .in("id", extras.map((t) => t.id));
        } else {
          await supabase.from("transactions").insert(txPayload);
        }
      } else if (existingTx?.length) {
        await supabase
          .from("transactions")
          .delete()
          .in("id", existingTx.map((t) => t.id));
      }

      // ---- auditoria da venda e do lançamento financeiro ----
      const label = (customerId: string | null, guest: string | null) =>
        customerId ? customerName(customerId) : guest?.trim() || "Consumidor final";
      const itemsText = (list: { description: string; quantity: number | string }[]) =>
        list.map((i) => `${i.description} (${Number(i.quantity) || 0})`).join(", ");

      if (editing) {
        const before = {
          customer_label: label(editing.customer_id, editing.guest_name),
          sale_date: editing.sale_date,
          status: SALE_STATUS_LABEL[editing.status] ?? editing.status,
          payment_method:
            PAYMENT_METHOD_LABEL[editing.payment_method ?? ""] ?? editing.payment_method,
          discount: brl(Number(editing.discount) || 0),
          total: brl(Number(editing.total) || 0),
          cost_total: brl(Number(editing.cost_total) || 0),
          notes: editing.notes ?? "",
        };
        const after = {
          customer_label: label(payload.customer_id, payload.guest_name),
          sale_date: payload.sale_date,
          status: SALE_STATUS_LABEL[payload.status] ?? payload.status,
          payment_method:
            PAYMENT_METHOD_LABEL[payload.payment_method] ?? payload.payment_method,
          discount: brl(discount),
          total: brl(finalTotal),
          cost_total: brl(calc.cost),
          notes: payload.notes ?? "",
        };
        const changes = diffFields(before, after, SALE_FIELD_LABELS);
        if (changes.length)
          await logSaleAudit({
            saleId: saleId!,
            action: "update",
            changes,
            saleLabel: after.customer_label,
          });

        if (editing.status !== "cancelado" && payload.status === "cancelado")
          await logSaleAudit({
            saleId: saleId!,
            action: "cancel",
            saleLabel: after.customer_label,
            changes: [
              {
                field: "status",
                label: "Status",
                from: before.status,
                to: after.status,
              },
              {
                field: "transaction",
                label: "Lançamento no financeiro",
                from: existingTx?.length ? before.total : "sem lançamento",
                to: "removido",
              },
            ],
          });


        const beforeItems = itemsText(await Promise.resolve(prevItems));
        const afterItems = itemsText(
          valid.map((i) => ({ description: i.description.trim(), quantity: i.quantity })),
        );
        if (beforeItems !== afterItems)
          await logSaleAudit({
            saleId: saleId!,
            action: "items",
            changes: [
              { field: "items", label: "Itens", from: beforeItems || null, to: afterItems || null },
            ],
          });

        const hadTx = Boolean(existingTx?.length);
        if (hadTx !== shouldHaveTx || (shouldHaveTx && before.total !== after.total)) {
          await logSaleAudit({
            saleId: saleId!,
            action: "finance",
            changes: [
              {
                field: "transaction",
                label: "Lançamento no financeiro",
                from: hadTx ? before.total : "sem lançamento",
                to: shouldHaveTx ? after.total : "removido",
              },
            ],
          });
        }
      } else {
        await logSaleAudit({
          saleId: saleId!,
          action: "create",
          changes: [
            {
              field: "total",
              label: "Total",
              from: null,
              to: brl(finalTotal),
            },
          ],
        });
        if (shouldHaveTx)
          await logSaleAudit({
            saleId: saleId!,
            action: "finance",
            changes: [
              {
                field: "transaction",
                label: "Lançamento no financeiro",
                from: "sem lançamento",
                to: brl(finalTotal),
              },
            ],
          });
      }



      const nextQty = form.status === "cancelado" ? {} : qtyByPart(valid);
      const { shortages } = await applyInventoryConsumption(diffQty(nextQty, prevQty));

      const nextMatQty = form.status === "cancelado" ? {} : qtyByMaterial(valid);
      const { shortages: matShortages } = await applyMaterialSaleConsumption(
        diffQty(nextMatQty, prevMatQty),
      );
      return { saleId: saleId!, shortages: [...shortages, ...matShortages] };
    },
    onSuccess: async ({ saleId, shortages }) => {
      // refetchType "all" força recálculo imediato do dashboard/relatórios
      // mesmo quando essas telas não estão montadas
      await Promise.all(
        [
          "sales",
          "sale_items",
          "transactions",
          "assets",
          "materials",
          "stock_movements",
          "sale_audit_log",
          "quotes",
          "quote_items",
          "parts",
          "customers",
        ].map((k) => qc.invalidateQueries({ queryKey: [k], refetchType: "all" })),
      );
      toast.success(editing ? "Venda atualizada" : "Venda registrada");
      if (shortages.length)
        toast.warning(`Saldo insuficiente no inventário: ${shortages.join(", ")} (zerado)`);
      onOpenChange(false);
      onSaved?.(saleId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <FormModal open={isOpen} onOpenChange={onOpenChange}>
      <FormModalContent className="max-w-3xl">
        <FormModalHeader>
          <FormModalTitle>{editing ? "Editar venda" : "Nova venda"}</FormModalTitle>
        </FormModalHeader>
        <FormModalBody className="space-y-4">
          {editing && isClosed(editing.sale_date) && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              Esta venda é de um mês com caixa fechado. Só é possível mudar o status para{" "}
              <strong>Pago</strong>, sem alterar valores ou itens; o recebimento entra no financeiro
              com a data de hoje.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Cliente</Label>
              <SearchSelect
                ariaLabel="Cliente"
                value={form.customer_id || "none"}
                onChange={(v) => setForm({ ...form, customer_id: v === "none" ? "" : v })}
                options={[
                  { value: "none", label: "Sem cadastro / consumidor final" },
                  ...(customers.data ?? []).map((c) => ({
                    value: c.id,
                    label: c.name,
                    hint: c.phone ?? c.doc_number ?? undefined,
                  })),
                ]}
                placeholder="Buscar cliente cadastrado..."
                searchPlaceholder="Buscar por nome, telefone ou documento..."
                emptyText="Nenhum cliente encontrado."
              />
            </div>
            {!form.customer_id && (
              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:col-span-2 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">
                    Cliente não cadastrado — informe os dados apenas para esta venda (opcional).
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={form.guest_name}
                    maxLength={100}
                    onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={form.guest_phone}
                    maxLength={20}
                    onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                    placeholder="(62) 90000-0000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    value={form.guest_email}
                    maxLength={255}
                    onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
                    placeholder="cliente@email.com"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.sale_date}
                onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SALE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <SelectTrigger>
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
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Itens da venda</h3>
              <Button size="sm" variant="outline" onClick={() => setItems([...items, newItem()])}>
                <Plus className="h-4 w-4" /> Item
              </Button>
            </div>
            {items.map((i) => (
              <div key={i.key} className="grid gap-2 rounded-md border bg-muted/30 p-2 sm:grid-cols-12">
                <div className="space-y-1 sm:col-span-4">
                  <Label className="text-xs">Peça ou material</Label>
                  <SearchSelect
                    ariaLabel="Peça ou material"
                    value={i.material_id ? `mat:${i.material_id}` : i.part_id || "none"}
                    onChange={(v) => pickCatalog(i.key, v === "none" ? "" : v)}
                    options={[
                      { value: "none", label: "Item avulso" },
                      ...(parts.data ?? []).map((p) => ({
                        value: p.id,
                        label: p.name,
                        hint: brl(Number(p.sale_price) || 0),
                      })),
                      ...(materials.data ?? []).map((m) => ({
                        value: `mat:${m.id}`,
                        label: `Estoque · ${materialLabel(m)}`,
                        hint: `${num(Number(m.quantity), 3)} ${m.unit}`,
                      })),
                    ]}
                    placeholder="Buscar peça ou material..."
                    searchPlaceholder="Buscar peça ou material do estoque..."
                    emptyText="Nenhum item encontrado."
                  />
                </div>

                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={i.description}
                    onChange={(e) =>
                      setItems((l) =>
                        l.map((x) => (x.key === i.key ? { ...x, description: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs">Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={i.quantity}
                    onChange={(e) =>
                      setItems((l) =>
                        l.map((x) => (x.key === i.key ? { ...x, quantity: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Venda (un.)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={i.unit_price}
                    onChange={(e) =>
                      setItems((l) =>
                        l.map((x) => (x.key === i.key ? { ...x, unit_price: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Custo (un.)</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={i.unit_cost}
                      onChange={(e) =>
                        setItems((l) =>
                          l.map((x) => (x.key === i.key ? { ...x, unit_cost: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remover item"
                      onClick={() => setItems((l) => (l.length > 1 ? l.filter((x) => x.key !== i.key) : l))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-gradient-to-br from-primary/5 to-purple-500/5 p-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total da venda</p>
              <p className="text-sm font-semibold">{brl(finalTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gasto (custo)</p>
              <p className="text-sm font-semibold">{brl(calc.cost)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lucro</p>
              <p className={`text-sm font-semibold ${finalProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                {brl(finalProfit)}
                {finalTotal > 0 && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    ({num((finalProfit / finalTotal) * 100, 1)}%)
                  </span>
                )}
              </p>
            </div>
          </div>

          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar venda
          </Button>
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
