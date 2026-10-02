import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowDownUp, Search, Pencil, Trash2, Copy, Tags } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Pager, SortButton, useTableState } from "@/components/table-kit";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { ImageUploadField } from "@/components/ImageUploadField";
import { PartImage } from "@/components/PartImage";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { listMaterials, listMovements, type Material } from "@/lib/db";
import { useDeleteRecord, useSaveRecord } from "@/hooks/use-crud";
import { brl, dateBR, num } from "@/lib/format";
import { syncMaterialAssets } from "@/lib/inventory";
import { MATERIAL_TYPES, MOVEMENT_REASONS, MOVEMENT_REASON_LABEL, stockStatus } from "@/lib/domain";
import { StockCategoryManager } from "@/components/StockCategoryManager";
import { categoryLabel, listStockCategories, PRODUCTION_CATEGORY } from "@/lib/stock-categories";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: pageTitle("Estoque") },
      {
        name: "description",
        content: "Filamentos e materiais, alertas de mínimo e movimentações.",
      },
    ],
  }),
  component: EstoquePage,
});

const emptyMaterial = {
  name: "",
  category: "material",
  type: "PLA",
  color: "",
  supplier: "",
  unit: "kg",
  cost_per_unit: "0",
  quantity: "0",
  min_quantity: "0",
  image_url: null as string | null,
};

function EstoquePage() {
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });
  const movements = useQuery({ queryKey: ["stock_movements"], queryFn: () => listMovements() });
  const save = useSaveRecord("materials");
  const remove = useDeleteRecord("materials", ["stock_movements"]);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState({ ...emptyMaterial });
  const [moveOpen, setMoveOpen] = useState(false);
  const [move, setMove] = useState({
    material_id: "",
    quantity: "1",
    reason: "producao",
    note: "",
  });
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [details, setDetails] = useState<Material | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["stock_categories", "estoque"],
    queryFn: () => listStockCategories("estoque"),
  });
  const categories = categoriesQuery.data ?? [];
  const activeCategories = categories.filter((c) => c.active);
  const categoryUsage = (materials.data ?? []).reduce<Record<string, number>>((acc, m) => {
    const key = m.category ?? PRODUCTION_CATEGORY;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  /** Mostra também a categoria já salva no item, mesmo se estiver inativa. */
  const formCategories = activeCategories.some((c) => c.slug === form.category)
    ? activeCategories
    : [...activeCategories, ...categories.filter((c) => c.slug === form.category)];

  const rows = (materials.data ?? []).filter((m) => {
    const st = stockStatus(Number(m.quantity), Number(m.min_quantity));
    return (
      (statusFilter === "todos" || st === statusFilter) &&
      (typeFilter === "todos" || m.type === typeFilter) &&
      (categoryFilter === "todos" || (m.category ?? PRODUCTION_CATEGORY) === categoryFilter)
    );
  });
  const table = useTableState(
    rows,
    (m) =>
      `${m.name} ${m.color ?? ""} ${m.type} ${m.supplier ?? ""} ${categoryLabel(categories, m.category)}`,
  );

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyMaterial });
    setOpen(true);
  };
  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      name: m.name,
      category: m.category ?? "material",
      type: m.type,
      color: m.color ?? "",
      supplier: m.supplier ?? "",
      unit: m.unit,
      cost_per_unit: String(m.cost_per_unit),
      quantity: String(m.quantity),
      min_quantity: String(m.min_quantity),
      image_url: m.image_url ?? null,
    });
    setOpen(true);
  };

  const openDuplicate = (m: Material) => {
    setEditing(null);
    setForm({
      name: `${m.name} (cópia)`,
      category: m.category ?? "material",
      type: m.type,
      color: m.color ?? "",
      supplier: m.supplier ?? "",
      unit: m.unit,
      cost_per_unit: String(m.cost_per_unit),
      quantity: "0",
      min_quantity: String(m.min_quantity),
      image_url: m.image_url ?? null,
    });
    setOpen(true);
    toast.info("Item duplicado — ajuste cor/quantidade e salve.");
  };

  const submit = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do material");
    save.mutate(
      {
        id: editing?.id,
        values: {
          name: form.name.trim(),
          category: form.category,
          type: form.type,

          color: form.color.trim() || null,
          supplier: form.supplier.trim() || null,
          unit: form.unit,
          cost_per_unit: Number(form.cost_per_unit) || 0,
          quantity: Number(form.quantity) || 0,
          min_quantity: Number(form.min_quantity) || 0,
          image_url: form.image_url,
        },
      },
      {
        onSuccess: async (row: { id?: string } | null) => {
          setOpen(false);
          const id = editing?.id ?? row?.id;
          // reflete a foto do item no inventário vinculado
          if (id) await syncMaterialAssets([id]).catch(() => undefined);
          qc.invalidateQueries({ queryKey: ["assets"], refetchType: "all" });
        },
      },

    );
  };

  const registerMovement = useMutation({
    mutationFn: async () => {
      if (!move.material_id) throw new Error("Selecione o material");
      const qty = Number(move.quantity);
      if (!qty) throw new Error("Informe a quantidade");
      const signed = move.reason === "compra" ? Math.abs(qty) : -Math.abs(qty);
      const { error } = await supabase.from("stock_movements").insert({
        material_id: move.material_id,
        quantity: move.reason === "ajuste" ? qty : signed,
        reason: move.reason,
        note: move.note.trim() || null,
      });
      if (error) throw new Error(error.message);
      await syncMaterialAssets([move.material_id]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Movimentação registrada");
      setMoveOpen(false);
      setMove({ material_id: "", quantity: "1", reason: "producao", note: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const materialName = (id: string) => materials.data?.find((m) => m.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Filamentos e materiais com alerta automático de estoque mínimo."
        actions={
          <>
            <Button variant="outline" onClick={() => setCatManagerOpen(true)}>
              <Tags className="h-4 w-4" /> Categorias
            </Button>
            <Button variant="outline" onClick={() => setMoveOpen(true)}>
              <ArrowDownUp className="h-4 w-4" /> Movimentar
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo material
            </Button>
          </>
        }
      />

      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="mov">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="itens" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar material, cor ou fornecedor"
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.name}
                    {c.active ? "" : " (inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {MATERIAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="esgotado">Esgotado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton label="Material" onClick={() => table.toggleSort("name")} />
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo / Cor</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Estoque" onClick={() => table.toggleSort("quantity")} />
                  </TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.paged.map((m) => {
                  const st = stockStatus(Number(m.quantity), Number(m.min_quantity));
                  return (
                    <TableRow
                      key={m.id}
                      className={clickableRow}
                      onClick={() => setDetails(m)}
                      title="Ver detalhes"
                    >
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          {m.image_url ? (
                            <span className="h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted">
                              <PartImage
                                src={m.image_url}
                                alt={m.name}
                                variant="thumb"
                                className="h-full w-full object-cover"
                              />
                            </span>
                          ) : null}
                          {m.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{categoryLabel(categories, m.category)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.type}
                        {m.color ? ` · ${m.color}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.supplier ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {num(Number(m.quantity), 3)} {m.unit}
                        <span className="block text-xs text-muted-foreground">
                          mín. {num(Number(m.min_quantity), 3)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{brl(Number(m.cost_per_unit))}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            st === "esgotado"
                              ? "destructive"
                              : st === "baixo"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {st === "ok" ? "OK" : st === "baixo" ? "Baixo" : "Esgotado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <OwnerTag ownerId={m.owner_id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {table.filtered.length === 0 && <EmptyState message="Nenhum material encontrado." />}
            <Pager {...table} total={table.filtered.length} />
          </div>
        </TabsContent>

        <TabsContent value="mov" className="mt-4">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(movements.data ?? []).slice(0, 100).map((mv) => (
                  <TableRow key={mv.id}>
                    <TableCell>{dateBR(mv.created_at)}</TableCell>
                    <TableCell className="font-medium">{materialName(mv.material_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {MOVEMENT_REASON_LABEL[mv.reason] ?? mv.reason}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${Number(mv.quantity) < 0 ? "text-destructive" : "text-[var(--success)]"}`}
                    >
                      {Number(mv.quantity) > 0 ? "+" : ""}
                      {num(Number(mv.quantity), 3)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{mv.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(movements.data ?? []).length === 0 && (
              <EmptyState message="Nenhuma movimentação registrada." />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <FormModal open={open} onOpenChange={setOpen}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>{editing ? "Editar material" : "Novo material"}</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <Row label="Nome">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Row>
            <Row label="Categoria">
              <div className="flex items-center gap-2">
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formCategories.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        {c.name}
                        {c.active ? "" : " (inativa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Criar ou editar categorias"
                  aria-label="Criar ou editar categorias"
                  onClick={() => setCatManagerOpen(true)}
                >
                  <Tags className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Apenas itens em "Materiais" aparecem no cadastro de peças.
              </p>
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Tipo">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Cor">
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </Row>
            </div>
            <Row label="Fornecedor">
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Unidade">
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="un">unidade</SelectItem>
                    <SelectItem value="L">litro</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Custo por unidade (R$)">
                <Input
                  type="number"
                  value={form.cost_per_unit}
                  onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })}
                />
              </Row>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Quantidade">
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </Row>
              <Row label="Mínimo de alerta">
                <Input
                  type="number"
                  value={form.min_quantity}
                  onChange={(e) => setForm({ ...form, min_quantity: e.target.value })}
                />
              </Row>
            </div>
            <Row label="Foto do item">
              <ImageUploadField
                label="Foto do item"
                value={form.image_url}
                onChange={(path) => setForm({ ...form, image_url: path })}
              />
            </Row>
            <Button className="w-full" onClick={submit} disabled={save.isPending}>
              Salvar
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <FormModal open={moveOpen} onOpenChange={setMoveOpen}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>Movimentar estoque</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <Row label="Material">
              <Select
                value={move.material_id}
                onValueChange={(v) => setMove({ ...move, material_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(materials.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} · {num(Number(m.quantity), 3)} {m.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Motivo">
              <Select value={move.reason} onValueChange={(v) => setMove({ ...move, reason: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {MOVEMENT_REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row
              label={
                move.reason === "ajuste" ? "Ajuste (use valor negativo para reduzir)" : "Quantidade"
              }
            >
              <Input
                type="number"
                value={move.quantity}
                onChange={(e) => setMove({ ...move, quantity: e.target.value })}
              />
            </Row>
            <Row label="Observação">
              <Textarea
                value={move.note}
                onChange={(e) => setMove({ ...move, note: e.target.value })}
              />
            </Row>
            <p className="text-xs text-muted-foreground">
              Compra soma ao estoque; uso em produção e perda dão baixa automaticamente.
            </p>
            <Button
              className="w-full"
              onClick={() => registerMovement.mutate()}
              disabled={registerMovement.isPending}
            >
              Registrar movimentação
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <StockCategoryManager
        open={catManagerOpen}
        onOpenChange={setCatManagerOpen}
        usage={categoryUsage}
      />

      <RecordDetailsModal
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        title={details?.name ?? ""}
        subtitle={details ? categoryLabel(categories, details.category) : undefined}
        children={
          details?.image_url ? (
            <div className="h-40 w-full overflow-hidden rounded-md border bg-muted">
              <PartImage
                src={details.image_url}
                alt={details.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : undefined
        }
        fields={
          details
            ? [
                { label: "Tipo", value: details.type },
                { label: "Cor", value: details.color || "—" },
                { label: "Fornecedor", value: details.supplier || "—" },
                {
                  label: "Estoque atual",
                  value: `${num(Number(details.quantity), 3)} ${details.unit}`,
                },
                {
                  label: "Estoque mínimo",
                  value: `${num(Number(details.min_quantity), 3)} ${details.unit}`,
                },
                { label: "Custo por unidade", value: brl(Number(details.cost_per_unit)) },
                {
                  label: "Status",
                  value: (() => {
                    const st = stockStatus(Number(details.quantity), Number(details.min_quantity));
                    return st === "ok" ? "OK" : st === "baixo" ? "Baixo" : "Esgotado";
                  })(),
                },
                { label: "Cadastro", value: dateBR(details.created_at) },
              ]
            : []
        }
        actions={
          details ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const m = details;
                  setDetails(null);
                  openDuplicate(m);
                }}
              >
                <Copy className="h-4 w-4" /> Duplicar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const m = details;
                  setDetails(null);
                  openEdit(m);
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
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
