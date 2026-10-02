import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, EmptyState } from "@/components/PageHeader";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { Pager, SortButton, useTableState } from "@/components/table-kit";
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
import {
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import { OwnerTag } from "@/components/OwnerTag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { listCustomers, type Customer } from "@/lib/db";
import { useDeleteRecord, useSaveRecord } from "@/hooks/use-crud";
import { dateBR } from "@/lib/format";
import { CUSTOMER_STATUSES } from "@/lib/domain";
import {
  CEP_FIELD_LABEL,
  type CepField,
  emailError,
  findDuplicateDoc,
  docError,
  formatAddress,
  lookupCep,
  lookupCnpj,
  maskCep,
  maskDoc,
  maskPhone,
} from "@/lib/br-format";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: pageTitle("Clientes") },
      { name: "description", content: "Cadastro e histórico dos clientes." },
    ],
  }),
  component: ClientesPage,
});

const empty = {
  name: "",
  kind: "fisica",
  phone: "",
  email: "",
  status: "ativo",
  notes: "",
  legal_name: "",
  doc_number: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

function ClientesPage() {
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  const save = useSaveRecord("customers");
  const remove = useDeleteRecord("customers");
  const navigate = useNavigate();
  const [details, setDetails] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [status, setStatus] = useState("todos");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMissing, setCepMissing] = useState<CepField[]>([]);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const streetRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  const fillFromCep = async (cep: string, silent = false) => {
    setCepLoading(true);
    const found = await lookupCep(cep);
    setCepLoading(false);
    if (!found) {
      setCepMissing([]);
      if (!silent) toast.error("CEP não encontrado. Preencha o endereço manualmente.");
      return;
    }
    // Só sobrescreve o que o CEP realmente trouxe — o que foi digitado à mão fica.
    setForm((f) => ({
      ...f,
      street: found.street || f.street,
      district: found.district || f.district,
      city: found.city || f.city,
      state: found.state || f.state,
    }));
    setCepMissing(found.missing);
    if (found.missing.length) {
      toast.warning(
        `CEP encontrado, mas sem ${found.missing.map((m) => CEP_FIELD_LABEL[m]).join(", ")}. Complete manualmente.`,
      );
      const refs: Record<CepField, React.RefObject<HTMLInputElement | null>> = {
        street: streetRef,
        district: districtRef,
        city: cityRef,
        state: stateRef,
      };
      setTimeout(() => refs[found.missing[0]].current?.focus(), 80);
    } else {
      toast.success("Endereço preenchido pelo CEP");
      setTimeout(() => numberRef.current?.focus(), 80);
    }
  };

  const fillFromCnpj = async (doc: string, silent = false) => {
    setCnpjLoading(true);
    const found = await lookupCnpj(doc);
    setCnpjLoading(false);
    if (!found) {
      if (!silent) toast.error("CNPJ não encontrado");
      return;
    }
    setForm((f) => ({
      ...f,
      name: f.name.trim() || found.name || found.legalName,
      legal_name: found.legalName || f.legal_name,
      phone: f.phone.trim() || found.phone,
      email: f.email.trim() || found.email,
      zip_code: found.zip_code || f.zip_code,
      street: found.street || f.street,
      number: found.number || f.number,
      complement: found.complement || f.complement,
      district: found.district || f.district,
      city: found.city || f.city,
      state: found.state || f.state,
    }));
    toast.success("Dados da empresa preenchidos");
  };

  const rows = (customers.data ?? []).filter((c) => status === "todos" || c.status === status);
  const table = useTableState(
    rows,
    (c) => `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.doc_number ?? ""} ${c.city ?? ""}`,
  );

  const openEdit = (c: Customer) => {
    setCepMissing([]);
    setEditing(c);
    setForm({
      name: c.name,
      kind: c.kind,
      phone: c.phone ?? "",
      email: c.email ?? "",
      status: c.status,
      notes: c.notes ?? "",
      legal_name: c.legal_name ?? "",
      doc_number: c.doc_number ?? "",
      zip_code: c.zip_code ?? "",
      street: c.street ?? "",
      number: c.number ?? "",
      complement: c.complement ?? "",
      district: c.district ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
    });
    setOpen(true);
  };

  const duplicate = findDuplicateDoc(customers.data, form.doc_number, editing?.id);
  const docErr = docError(form.doc_number, form.kind);

  const submit = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do cliente");
    if (docErr) return toast.error(docErr);
    if (duplicate)
      return toast.error(
        `${form.kind === "empresa" ? "CNPJ" : "CPF"} já cadastrado para "${duplicate.name}"`,
      );
    save.mutate(
      {
        id: editing?.id,
        values: {
          name: form.name.trim(),
          kind: form.kind,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
          legal_name: form.legal_name.trim() || null,
          doc_number: form.doc_number.trim() || null,
          zip_code: form.zip_code.trim() || null,
          street: form.street.trim() || null,
          number: form.number.trim() || null,
          complement: form.complement.trim() || null,
          district: form.district.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim().toUpperCase() || null,
        },
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Contatos, tags e histórico comercial."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ ...empty });
              setCepMissing([]);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CPF/CNPJ, e-mail, telefone ou cidade"
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {CUSTOMER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton label="Nome" onClick={() => table.toggleSort("name")} />
              </TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <SortButton label="Cadastro" onClick={() => table.toggleSort("created_at")} />
              </TableHead>
              <TableHead>Criado por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.paged.map((c) => (
              <TableRow
                key={c.id}
                className={clickableRow}
                onClick={() => setDetails(c)}
                title="Ver detalhes"
              >
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.kind === "empresa" ? "Empresa" : "Pessoa física"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.phone ?? null}
                  {c.email ? <span className="block text-xs">{c.email}</span> : null}
                  {!c.phone && !c.email && "—"}
                  {c.doc_number && <span className="block text-xs">{c.doc_number}</span>}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === "recorrente" ? "default" : "secondary"}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{dateBR(c.created_at)}</TableCell>
                <TableCell>
                  <OwnerTag ownerId={c.owner_id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {table.filtered.length === 0 && <EmptyState message="Nenhum cliente cadastrado." />}
        <Pager {...table} total={table.filtered.length} />
      </div>

      <RecordDetailsModal
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        title={details?.name ?? ""}
        subtitle={details?.kind === "empresa" ? "Empresa" : "Pessoa física"}
        fields={
          details
            ? [
                { label: "Status", value: details.status },
                {
                  label: details.kind === "empresa" ? "CNPJ" : "CPF",
                  value: details.doc_number || "—",
                },
                { label: "Telefone", value: details.phone || "—" },
                { label: "E-mail", value: details.email || "—" },
                { label: "Razão social", value: details.legal_name || "—" },
                { label: "Cadastro", value: dateBR(details.created_at) },
                { label: "Endereço", value: formatAddress(details) || "—", full: true },
                { label: "Observações", value: details.notes || "—", full: true },
              ]
            : []
        }
        actions={
          details ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  navigate({ to: "/clientes/$customerId", params: { customerId: details.id } })
                }
              >
                <ExternalLink className="h-4 w-4" /> Abrir ficha
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDetails(null);
                  openEdit(details);
                }}
              >
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  remove.mutate(details.id);
                  setDetails(null);
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </>
          ) : null
        }
      />

      <FormModal open={open} onOpenChange={setOpen}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>{editing ? "Editar cliente" : "Novo cliente"}</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
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
              <Label>WhatsApp / telefone</Label>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="(62) 99999-9999"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="contato@empresa.com.br"
                aria-invalid={!!emailError(form.email)}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {emailError(form.email) && (
                <p className="text-xs text-destructive">{emailError(form.email)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{form.kind === "empresa" ? "CNPJ" : "CPF"}</Label>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  aria-invalid={!!docErr}
                  aria-describedby="doc-error"
                  placeholder={form.kind === "empresa" ? "00.000.000/0000-00" : "000.000.000-00"}
                  value={form.doc_number}
                  onChange={(e) => {
                    const masked = maskDoc(e.target.value, form.kind);
                    setForm({ ...form, doc_number: masked });
                    if (form.kind === "empresa" && masked.replace(/\D/g, "").length === 14) {
                      void fillFromCnpj(masked, true);
                    }
                  }}
                />
                {form.kind === "empresa" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={cnpjLoading}
                    onClick={() => fillFromCnpj(form.doc_number)}
                  >
                    {cnpjLoading ? "Buscando..." : "Buscar CNPJ"}
                  </Button>
                )}
              </div>
              {docErr && (
                <p id="doc-error" className="text-xs text-destructive">
                  {docErr}
                </p>
              )}
              {duplicate && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    Já existe um cliente com este {form.kind === "empresa" ? "CNPJ" : "CPF"}:{" "}
                    <button
                      type="button"
                      className="font-medium underline"
                      onClick={() => {
                        setOpen(false);
                        openEdit(duplicate);
                      }}
                    >
                      {duplicate.name}
                    </button>
                    . Edite o cadastro existente em vez de duplicar.
                  </span>
                </div>
              )}
            </div>

            {form.kind === "empresa" && (
              <div className="space-y-1.5">
                <Label>Razão social</Label>
                <Input
                  value={form.legal_name}
                  onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Endereço</p>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.zip_code}
                    onChange={(e) => {
                      const masked = maskCep(e.target.value);
                      setForm({ ...form, zip_code: masked });
                      if (masked.replace(/\D/g, "").length === 8) void fillFromCep(masked, true);
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={cepLoading}
                    onClick={() => fillFromCep(form.zip_code)}
                  >
                    {cepLoading ? "Buscando..." : "Buscar CEP"}
                  </Button>
                </div>
              </div>
              {cepMissing.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    O CEP não retornou {cepMissing.map((m) => CEP_FIELD_LABEL[m]).join(", ")}.
                    Complete manualmente abaixo — os demais campos já foram preenchidos.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div className="space-y-1.5">
                  <Label>Rua / logradouro</Label>
                  <Input
                    ref={streetRef}
                    aria-invalid={cepMissing.includes("street") && !form.street}
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input
                    ref={numberRef}
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Complemento</Label>
                  <Input
                    value={form.complement}
                    onChange={(e) => setForm({ ...form, complement: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input
                    ref={districtRef}
                    aria-invalid={cepMissing.includes("district") && !form.district}
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input
                    ref={cityRef}
                    aria-invalid={cepMissing.includes("city") && !form.city}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>UF</Label>
                  <Input
                    ref={stateRef}
                    maxLength={2}
                    aria-invalid={cepMissing.includes("state") && !form.state}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={save.isPending}>
              Salvar
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>
    </div>
  );
}
