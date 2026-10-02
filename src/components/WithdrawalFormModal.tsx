import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  FormModalBody,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
} from "@/components/ui/form-modal";
import { listMaterials, listParts, type Partner } from "@/lib/db";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/domain";
import { brl, num } from "@/lib/format";
import { materialLabel } from "@/lib/material-stock";
import {
  WITHDRAWAL_KINDS,
  WITHDRAWAL_KIND_LABEL,
  createWithdrawal,
  type WithdrawalKind,
} from "@/lib/partners";
import { useClosedMonths } from "@/hooks/use-closed-months";

const today = () => new Date().toISOString().slice(0, 10);

const empty = (partnerId = "") => ({
  partner_id: partnerId,
  kind: "dinheiro" as WithdrawalKind,
  withdrawn_on: today(),
  description: "",
  part_id: "",
  material_id: "",
  quantity: "1",
  amount: "",
  payment_method: "pix",
  notes: "",
});

/** Registra uma retirada de sócio: dinheiro, peça (estoque ou produzida) ou material. */
export function WithdrawalFormModal({
  open,
  onOpenChange,
  partners,
  defaultPartnerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partners: Partner[];
  defaultPartnerId?: string;
}) {
  const qc = useQueryClient();
  const { isClosed, closedMessage } = useClosedMonths();
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts, enabled: open });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials, enabled: open });
  const [form, setForm] = useState(empty());
  // o valor só acompanha a sugestão até o usuário editar
  const [amountTouched, setAmountTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(empty(defaultPartnerId ?? partners.find((p) => p.active)?.id ?? ""));
    setAmountTouched(false);
  }, [open, defaultPartnerId, partners]);

  const part = (parts.data ?? []).find((p) => p.id === form.part_id);
  const material = (materials.data ?? []).find((m) => m.id === form.material_id);
  const qty = Number(form.quantity) || 0;
  const isPart = form.kind === "peca_estoque" || form.kind === "peca_produzida";

  const suggested = useMemo(() => {
    if (isPart && part) return Number(part.estimated_cost) * qty;
    if (form.kind === "material" && material) return Number(material.cost_per_unit) * qty;
    return 0;
  }, [isPart, part, material, form.kind, qty]);

  useEffect(() => {
    if (form.kind !== "dinheiro" && !amountTouched)
      setForm((f) => ({ ...f, amount: suggested ? suggested.toFixed(2) : "" }));
  }, [suggested, form.kind, amountTouched]);

  const save = useMutation({
    mutationFn: async () => {
      const partner = partners.find((p) => p.id === form.partner_id);
      if (!partner) throw new Error("Escolha o sócio");
      if (isClosed(form.withdrawn_on)) throw new Error(closedMessage(form.withdrawn_on));
      if (isPart && !part) throw new Error("Escolha a peça");
      if (form.kind === "material" && !material) throw new Error("Escolha o material");
      if (form.kind !== "dinheiro" && qty <= 0) throw new Error("Informe a quantidade");
      const amount = Number(form.amount);
      if (!(amount >= 0) || (form.kind === "dinheiro" && !amount))
        throw new Error("Informe o valor");
      const description =
        form.description.trim() ||
        (isPart && part
          ? `${num(qty, 0)}x ${part.name}`
          : material
            ? `${num(qty, 3)} ${material.unit} ${materialLabel(material)}`
            : "");
      return createWithdrawal({
        partner,
        kind: form.kind,
        withdrawn_on: form.withdrawn_on,
        description: description || "Adiantamento",
        part_id: isPart ? form.part_id : null,
        material_id: form.kind === "material" ? form.material_id : null,
        quantity: form.kind === "dinheiro" ? 1 : qty,
        suggested_amount: suggested,
        amount,
        payment_method: form.kind === "dinheiro" ? form.payment_method : null,
        notes: form.notes.trim() || null,
      });
    },
    onSuccess: (shortages) => {
      [
        "partner_withdrawals",
        "transactions",
        "parts",
        "materials",
        "stock_movements",
        "assets",
      ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Retirada registrada");
      if (shortages.length) toast.warning(`Saldo insuficiente no estoque: ${shortages.join(", ")}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <FormModal open={open} onOpenChange={onOpenChange}>
      <FormModalContent>
        <FormModalHeader>
          <FormModalTitle>Nova retirada de sócio</FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sócio</Label>
              <Select
                value={form.partner_id}
                onValueChange={(v) => setForm({ ...form, partner_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {partners
                    .filter((p) => p.active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.withdrawn_on}
                onChange={(e) => setForm({ ...form, withdrawn_on: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>O que foi retirado</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => {
                setForm({ ...form, kind: v as WithdrawalKind, amount: "" });
                setAmountTouched(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WITHDRAWAL_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {WITHDRAWAL_KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.kind === "dinheiro" &&
                "Sai do caixa agora e é descontado da parte do sócio no fechamento do mês."}
              {form.kind === "peca_estoque" &&
                "Dá baixa da peça pronta no estoque. Não sai dinheiro do caixa; o valor é descontado da parte do sócio."}
              {form.kind === "peca_produzida" &&
                "Dá baixa do filamento e acessórios usados na peça. O valor é descontado da parte do sócio."}
              {form.kind === "material" &&
                "Dá baixa do material no estoque. O valor é descontado da parte do sócio."}
            </p>
          </div>

          {isPart && (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="space-y-1.5">
                <Label>Peça</Label>
                <SearchSelect
                  value={form.part_id}
                  onChange={(v) => setForm({ ...form, part_id: v })}
                  placeholder="Escolha a peça"
                  options={(parts.data ?? []).map((p) => ({
                    value: p.id,
                    label: p.name,
                    hint:
                      form.kind === "peca_estoque"
                        ? `${num(Number(p.stock_quantity), 0)} em estoque`
                        : undefined,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Qtd</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            </div>
          )}

          {form.kind === "material" && (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="space-y-1.5">
                <Label>Material</Label>
                <SearchSelect
                  value={form.material_id}
                  onChange={(v) => setForm({ ...form, material_id: v })}
                  placeholder="Escolha o material"
                  options={(materials.data ?? []).map((m) => ({
                    value: m.id,
                    label: materialLabel(m),
                    hint: `${num(Number(m.quantity), 3)} ${m.unit}`,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Qtd {material ? `(${material.unit})` : ""}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor descontado do sócio (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => {
                  setAmountTouched(true);
                  setForm({ ...form, amount: e.target.value });
                }}
              />
              {form.kind !== "dinheiro" && (
                <p className="text-xs text-muted-foreground">
                  Sugerido pelo custo: {brl(suggested)}
                  {isPart && part && Number(part.sale_price) > 0 && (
                    <> · preço de venda {brl(Number(part.sale_price) * qty)}</>
                  )}
                </p>
              )}
            </div>
            {form.kind === "dinheiro" && (
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
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={form.description}
              placeholder={
                form.kind === "dinheiro" ? "Ex.: adiantamento" : "Gerada automaticamente"
              }
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            Registrar retirada
          </Button>
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
