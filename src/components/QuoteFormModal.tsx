import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Package, Plus, Trash2, UserPlus, Wrench } from "lucide-react";
import { toast } from "sonner";

import { ImageUploadField } from "@/components/ImageUploadField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormModal,
  FormModalBody,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
} from "@/components/ui/form-modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CEP_FIELD_LABEL, type CepField, docError, emailError, findDuplicateDoc, maskCep, maskDoc, maskPhone, lookupCep, lookupCnpj } from "@/lib/br-format";
import { logQuoteStatus } from "@/lib/quote-status";
import { logQuoteAudit } from "@/lib/quote-audit";
import { supabase } from "@/integrations/supabase/client";
import { getQuote, listCustomers, listMaterials, listParts, listQuoteItems } from "@/lib/db";
import { brl, minutesToHuman } from "@/lib/format";

type ItemKind = "peca" | "servico";

type ItemDraft = {
  key: string;
  kind: ItemKind;
  part_id: string;
  material_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  print_minutes: string;
  image_url: string | null;
};

const findDefaultMaterial = (list?: { id: string; name: string }[]) =>
  list?.find((m) => /preto\s*pla/i.test(m.name)) ??
  list?.find((m) => /pla/i.test(m.name) && /preto/i.test(m.name)) ??
  list?.find((m) => /pla/i.test(m.name)) ??
  null;

const newItem = (defaultMaterialId = ""): ItemDraft => ({
  key: crypto.randomUUID(),
  kind: "peca",
  part_id: "",
  material_id: defaultMaterialId,
  description: "",
  quantity: "1",
  unit_price: "0",
  print_minutes: "0",
  image_url: null,
});

/** Serviço adicional (modelagem, pintura, acabamento…): sem peça nem material. */
const newService = (): ItemDraft => ({
  key: crypto.randomUUID(),
  kind: "servico",
  part_id: "",
  material_id: "",
  description: "",
  quantity: "1",
  unit_price: "0",
  print_minutes: "0",
  image_url: null,
});

const emptyCustomer = {
  name: "",
  kind: "fisica",
  legal_name: "",
  phone: "",
  email: "",
  doc_number: "",
  zip_code: "",
  street: "",
  district: "",
  city: "",
  state: "",
};

export function QuoteFormModal({
  open,
  onOpenChange,
  onCreated,
  quoteId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (quoteId: string) => void;
  /** Quando informado, a modal edita o orçamento existente. */
  quoteId?: string | null;
  onSaved?: () => void;
}) {
  const isEdit = !!quoteId;
  const qc = useQueryClient();
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState<typeof emptyCustomer | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMissing, setCepMissing] = useState<CepField[]>([]);

  const customer = customers.data?.find((c) => c.id === customerId);

  const defaultMaterial = useMemo(() => findDefaultMaterial(materials.data), [materials.data]);
  const defaultMaterialId = defaultMaterial?.id ?? "";

  const reset = () => {
    setTitle("");
    setNotes("");
    setCustomerId("");
    setNewCustomer(null);
    setCepMissing([]);
    setItems([newItem(defaultMaterialId)]);
  };

  useEffect(() => {
    if (isEdit) return;
    if (!defaultMaterialId) return;
    setItems((prev) =>
      prev.map((i) =>
        i.kind === "peca" && !i.part_id && !i.material_id
          ? { ...i, material_id: defaultMaterialId }
          : i,
      ),
    );
  }, [defaultMaterialId, isEdit]);

  const existing = useQuery({
    queryKey: ["quote-edit", quoteId],
    queryFn: async () => ({
      quote: await getQuote(quoteId!),
      items: await listQuoteItems(quoteId!),
    }),
    enabled: open && isEdit,
  });

  useEffect(() => {
    if (!open || !isEdit || !existing.data) return;
    const { quote, items: rows } = existing.data;
    setTitle(quote?.title ?? "");
    setNotes(quote?.notes ?? "");
    setCustomerId(quote?.customer_id ?? "");

    setNewCustomer(null);
    setItems(
      rows.length
        ? rows.map((i) => ({
            key: i.id,
            kind: ((i as { kind?: string }).kind === "servico" ? "servico" : "peca") as ItemKind,
            part_id: i.part_id ?? "",
            material_id: i.material_id ?? "",
            description: i.description ?? "",
            quantity: String(i.quantity ?? 1),
            unit_price: String(i.unit_price ?? 0),
            print_minutes: String(i.print_minutes ?? 0),
            image_url: i.image_url,
          }))
        : [newItem(defaultMaterialId)],
    );
  }, [open, isEdit, existing.data]);




  const patch = (key: string, values: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...values } : i)));

  const total = useMemo(
    () =>
      items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0),
    [items],
  );

  /** Aviso de estoque — nunca bloqueia, apenas sinaliza. */
  const stockWarning = (item: ItemDraft) => {
    if (item.kind === "servico") return null;
    const part = parts.data?.find((p) => p.id === item.part_id);
    if (!item.part_id) return item.description.trim() ? "Item avulso (não cadastrado em Peças)" : null;
    const materialId = item.material_id || part?.material_id;
    const material = materials.data?.find((m) => m.id === materialId);
    if (!material) return "Sem material vinculado no estoque";
    const grams = Number(part?.material_grams ?? 0) * (Number(item.quantity) || 0);
    const needed = material.unit === "g" ? grams : grams / 1000;
    if (needed > 0 && Number(material.quantity) < needed)
      return `Estoque insuficiente de ${material.name}`;
    return null;
  };

  /** Campos obrigatórios do orçamento. */
  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Informe o título do orçamento");
    if (newCustomer) {
      if (!newCustomer.name.trim()) errs.push("Informe o nome do novo cliente");
    } else if (!customerId) {
      errs.push("Selecione o cliente do orçamento");
    }
    const filled = items.filter((i) => i.description.trim() || i.part_id);
    if (filled.length === 0) errs.push("Adicione ao menos um item (peça, item avulso ou serviço)");
    filled.forEach((i, idx) => {
      if (i.kind === "servico") {
        if (!i.description.trim())
          errs.push(`Serviço ${idx + 1}: descreva o serviço (ex.: modelagem 3D, pintura)`);
        return;
      }
      if (!i.part_id && !i.description.trim())
        errs.push(`Item ${idx + 1}: selecione a peça cadastrada ou descreva o item avulso`);
      const materialId = i.material_id || parts.data?.find((p) => p.id === i.part_id)?.material_id;
      if (!materialId) errs.push(`Item ${idx + 1}: selecione o material`);
    });
    return errs;
  }, [title, customerId, newCustomer, items, parts.data]);

  const create = useMutation({
    mutationFn: async () => {
      const filled = items.filter((i) => i.description.trim() || i.part_id);
      if (validationErrors.length) throw new Error(validationErrors[0]);


      let finalCustomerId = customerId || null;
      if (newCustomer) {
        if (!newCustomer.name.trim()) throw new Error("Informe o nome do novo cliente");
        const docMsg = docError(newCustomer.doc_number, newCustomer.kind);
        if (docMsg) throw new Error(docMsg);
        const dup = findDuplicateDoc(customers.data, newCustomer.doc_number);
        if (dup)
          throw new Error(
            `${newCustomer.kind === "empresa" ? "CNPJ" : "CPF"} já cadastrado para "${dup.name}". Selecione o cliente existente.`,
          );
        const { data, error } = await supabase
          .from("customers")
          .insert({
            name: newCustomer.name.trim(),
            kind: newCustomer.kind,
            phone: newCustomer.phone || null,
            email: newCustomer.email || null,
            legal_name: newCustomer.legal_name || null,
            doc_number: newCustomer.doc_number || null,
            zip_code: newCustomer.zip_code || null,
            street: newCustomer.street || null,
            district: newCustomer.district || null,
            city: newCustomer.city || null,
            state: newCustomer.state || null,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        finalCustomerId = data.id;
      }

      if (isEdit) {
        const { data: updated, error: upErr } = await supabase
          .from("quotes")
          .update({
            title: title.trim(),
            customer_id: finalCustomerId,
            notes: notes || null,
            total,
          })
          .eq("id", quoteId!)
          .select()
          .single();
        if (upErr) throw new Error(upErr.message);

        const { error: delErr } = await supabase
          .from("quote_items")
          .delete()
          .eq("quote_id", quoteId!);
        if (delErr) throw new Error(delErr.message);

        if (filled.length) {
          const part = (id: string) => parts.data?.find((p) => p.id === id);
          const rows = filled.map((i) => ({
            quote_id: quoteId!,
            kind: i.kind,
            part_id: i.kind === "servico" ? null : i.part_id || null,
            material_id:
              i.kind === "servico" ? null : i.material_id || part(i.part_id)?.material_id || null,
            description: i.description.trim() || part(i.part_id)?.name || "Item",
            quantity: Number(i.quantity) || 1,
            unit_price: Number(i.unit_price) || 0,
            print_minutes: i.kind === "servico" ? 0 : Number(i.print_minutes) || 0,
            image_url: i.image_url,
          }));
          const { error: itemsError } = await supabase.from("quote_items").insert(rows);
          if (itemsError) throw new Error(itemsError.message);
        }

        await logQuoteAudit({
          quoteId: quoteId!,
          action: "update",
          changes: [
            { field: "title", label: "Título", from: null, to: updated.title },
            { field: "total", label: "Total", from: null, to: brl(total) },
            { field: "itens", label: "Itens", from: null, to: String(filled.length) },
          ],
        });
        return updated;
      }

      const { data: quote, error } = await supabase
        .from("quotes")
        .insert({
          title: title.trim(),
          customer_id: finalCustomerId,
          notes: notes || null,
          total,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      await logQuoteStatus({ quoteId: quote.id, from: null, to: quote.status, note: "Orçamento criado" });

      if (filled.length) {
        const part = (id: string) => parts.data?.find((p) => p.id === id);
        const rows = filled.map((i) => ({
          quote_id: quote.id,
          kind: i.kind,
          part_id: i.kind === "servico" ? null : i.part_id || null,
          material_id:
            i.kind === "servico" ? null : i.material_id || part(i.part_id)?.material_id || null,
          description: i.description.trim() || part(i.part_id)?.name || "Item",
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          print_minutes: i.kind === "servico" ? 0 : Number(i.print_minutes) || 0,
          image_url: i.image_url,
        }));
        const { error: itemsError } = await supabase.from("quote_items").insert(rows);
        if (itemsError) throw new Error(itemsError.message);
      }
      await logQuoteAudit({
        quoteId: quote.id,
        action: "create",
        changes: [
          { field: "title", label: "Título", from: null, to: quote.title },
          { field: "total", label: "Total", from: null, to: brl(total) },
          { field: "itens", label: "Itens", from: null, to: String(filled.length) },
        ],
      });
      return quote;
    },
    onSuccess: (quote) => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["quote_items"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["quote-edit"] });
      toast.success(isEdit ? "Orçamento atualizado" : "Orçamento criado");
      reset();
      onOpenChange(false);
      if (isEdit) onSaved?.();
      else onCreated?.(quote.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalMinutes = items.reduce(
    (s, i) => s + (Number(i.print_minutes) || 0) * (Number(i.quantity) || 0),
    0,
  );

  return (
    <FormModal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <FormModalContent className="max-w-3xl">
        <FormModalHeader>
          <FormModalTitle>{isEdit ? "Editar orçamento" : "Novo orçamento"}</FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex.: Protótipo suporte industrial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Cliente</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNewCustomer(newCustomer ? null : { ...emptyCustomer });
                  setCustomerId("");
                }}
              >
                <UserPlus className="h-4 w-4" />
                {newCustomer ? "Escolher existente" : "Cadastrar novo"}
              </Button>
            </div>

            {newCustomer ? (
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={newCustomer.kind}
                    onValueChange={(v) => setNewCustomer({ ...newCustomer, kind: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fisica">Pessoa física</SelectItem>
                      <SelectItem value="empresa">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="(62) 99999-9999"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: maskPhone(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    placeholder="contato@empresa.com.br"
                    aria-invalid={!!emailError(newCustomer.email)}
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  />
                  {emailError(newCustomer.email) && (
                    <p className="text-xs text-destructive">{emailError(newCustomer.email)}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>{newCustomer.kind === "empresa" ? "CNPJ" : "CPF"}</Label>
                  <Input
                    inputMode="numeric"
                    aria-invalid={!!docError(newCustomer.doc_number, newCustomer.kind)}
                    placeholder={newCustomer.kind === "empresa" ? "00.000.000/0000-00" : "000.000.000-00"}
                    value={newCustomer.doc_number}
                    onChange={(e) => {
                      const masked = maskDoc(e.target.value, newCustomer.kind);
                      setNewCustomer((c) => (c ? { ...c, doc_number: masked } : c));
                      if (newCustomer.kind === "empresa" && masked.replace(/\D/g, "").length === 14) {
                        void (async () => {
                          const found = await lookupCnpj(masked);
                          if (!found) return;
                          setNewCustomer((c) => (c ? {
                            ...c,
                            name: c.name.trim() || found.name || found.legalName,
                            legal_name: found.legalName || c.legal_name,
                            phone: c.phone.trim() || found.phone,
                            email: c.email.trim() || found.email,
                            zip_code: found.zip_code || c.zip_code,
                            street: [found.street, found.number].filter(Boolean).join(", ") || c.street,
                            district: found.district || c.district,
                            city: found.city || c.city,
                            state: found.state || c.state,
                          } : c));
                          toast.success("Dados da empresa preenchidos");
                        })();
                      }
                    }}
                  />
                  {(() => {
                    const msg = docError(newCustomer.doc_number, newCustomer.kind);
                    return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
                  })()}
                  {(() => {
                    const dup = findDuplicateDoc(customers.data, newCustomer.doc_number);
                    if (!dup) return null;
                    return (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>
                          Já existe o cliente <strong>{dup.name}</strong> com este documento.{" "}
                          <button
                            type="button"
                            className="font-medium underline"
                            onClick={() => {
                              setNewCustomer(null);
                              setCustomerId(dup.id);
                            }}
                          >
                            Usar cliente existente
                          </button>
                        </span>
                      </div>
                    );
                  })()}
                </div>
                {newCustomer.kind === "empresa" && (
                  <div className="space-y-1.5">
                    <Label>Razão social</Label>
                    <Input
                      value={newCustomer.legal_name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, legal_name: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={newCustomer.zip_code}
                    onChange={(e) => {
                      const masked = maskCep(e.target.value);
                      setNewCustomer((c) => (c ? { ...c, zip_code: masked } : c));
                      if (masked.replace(/\D/g, "").length === 8) {
                        void (async () => {
                          setCepLoading(true);
                          const found = await lookupCep(masked);
                          setCepLoading(false);
                          if (!found) {
                            setCepMissing([]);
                            toast.error("CEP não encontrado. Preencha o endereço manualmente.");
                            return;
                          }
                          setNewCustomer((c) => (c ? {
                            ...c,
                            street: found.street || c.street,
                            district: found.district || c.district,
                            city: found.city || c.city,
                            state: found.state || c.state,
                          } : c));
                          setCepMissing(found.missing);
                          if (found.missing.length) {
                            toast.warning(
                              `CEP encontrado, mas sem ${found.missing.map((m) => CEP_FIELD_LABEL[m]).join(", ")}. Complete manualmente.`,
                            );
                          } else {
                            toast.success("Endereço preenchido pelo CEP");
                          }
                        })();
                      }
                    }}
                  />
                  {cepLoading && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
                </div>
                {cepMissing.length > 0 && (
                  <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>
                      O CEP não retornou {cepMissing.map((m) => CEP_FIELD_LABEL[m]).join(", ")}. Complete
                      manualmente abaixo.
                    </span>
                  </div>
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, número"
                    value={newCustomer.street}
                    onChange={(e) => setNewCustomer({ ...newCustomer, street: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input
                    value={newCustomer.district}
                    onChange={(e) => setNewCustomer({ ...newCustomer, district: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input
                      value={newCustomer.city}
                      onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>UF</Label>
                    <Input
                      maxLength={2}
                      value={newCustomer.state}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, state: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value={customerId || "none"}
                  onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Selecione o cliente</SelectItem>
                    {(customers.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customer && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="text-sm font-medium text-foreground">{customer.name}</p>
                    <p>{customer.kind === "empresa" ? "Empresa" : "Pessoa física"}</p>
                    <p>{[customer.phone, customer.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</p>
                    {customer.notes && <p className="mt-1">{customer.notes}</p>}
                  </div>
                )}
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Itens do orçamento</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((prev) => [...prev, newItem(defaultMaterialId)])}
                >
                  <Plus className="h-4 w-4" /> Adicionar item
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((prev) => [...prev, newService()])}
                >
                  <Wrench className="h-4 w-4" /> Adicionar serviço
                </Button>
              </div>
            </div>

            {items.map((item, index) => {
              const warning = stockWarning(item);
              const part = parts.data?.find((p) => p.id === item.part_id);
              const isService = item.kind === "servico";
              return (
                <div key={item.key} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {isService ? (
                        <>
                          <Wrench className="h-3.5 w-3.5" /> Serviço {index + 1}
                        </>
                      ) : (
                        <>Item {index + 1}</>
                      )}
                    </p>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {isService ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>
                          Descrição do serviço <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          placeholder="Ex.: Modelagem 3D, pintura, acabamento, montagem"
                          value={item.description}
                          onChange={(e) => patch(item.key, { description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Qtd.</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => patch(item.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor un.</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => patch(item.key, { unit_price: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center justify-end text-sm font-medium sm:col-span-2">
                        {brl((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                      </div>
                    </div>
                  ) : (
                  <>


                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Peça cadastrada ou avulsa <span className="text-destructive">*</span></Label>
                      <Select
                        value={item.part_id || "none"}
                        onValueChange={(v) => {
                          const p = parts.data?.find((x) => x.id === v);
                          patch(item.key, {
                            part_id: v === "none" ? "" : v,
                            description: p ? p.name : item.description,
                            unit_price: p
                              ? String(Number(p.sale_price) || Number(p.estimated_cost) || 0)
                              : item.unit_price,
                            print_minutes: p ? String(p.print_minutes) : item.print_minutes,
                            material_id: p?.material_id ?? item.material_id,
                            image_url: p?.image_url ?? item.image_url,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Item avulso" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Item avulso (não cadastrado)</SelectItem>
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
                        placeholder="Descreva a peça, arte ou serviço"
                        value={item.description}
                        onChange={(e) => patch(item.key, { description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Material <span className="text-destructive">*</span></Label>
                      <Select
                        value={item.material_id || part?.material_id || "none"}
                        onValueChange={(v) => patch(item.key, { material_id: v === "none" ? "" : v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o material" />

                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>Selecione o material</SelectItem>
                          {(materials.data ?? []).map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label>Qtd.</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => patch(item.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Preço un.</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => patch(item.key, { unit_price: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Min.</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.print_minutes}
                          onChange={(e) => patch(item.key, { print_minutes: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <ImageUploadField
                    label="Foto do produto ou arte"
                    value={item.image_url}
                    onChange={(path) => patch(item.key, { image_url: path })}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex flex-wrap items-center gap-2">
                      {warning && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {warning}
                        </Badge>
                      )}
                      {part && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {minutesToHuman(Number(item.print_minutes) || 0)} por unidade
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-foreground">
                      {brl((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                    </span>
                  </div>
                  </>
                  )}
                </div>
              );
            })}
          </section>

          <Separator />

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              placeholder="Prazo, condições de pagamento, detalhes de acabamento…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">
              {items.filter((i) => i.description.trim() || i.part_id).length} item(ns) ·{" "}
              {minutesToHuman(totalMinutes)} de impressão
            </span>
            <span className="text-base font-semibold">Total {brl(total)}</span>
          </div>

          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="mb-1 font-semibold">Campos obrigatórios pendentes</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {validationErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => create.mutate()}
            disabled={create.isPending || validationErrors.length > 0}
          >
            {create.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar orçamento"}
          </Button>

        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
