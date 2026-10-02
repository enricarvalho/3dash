import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Boxes,
  Wallet,
  History,
  Printer,
  Unlink,
} from "lucide-react";
import { AssetHistoryModal } from "@/components/AssetHistory";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";

import { PageHeader, EmptyState, StatCard } from "@/components/PageHeader";
import { Pager, useTableState } from "@/components/table-kit";
import { OwnerTag } from "@/components/OwnerTag";
import { PartImage } from "@/components/PartImage";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Badge } from "@/components/ui/badge";
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
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordDetailsModal, clickableRow } from "@/components/RecordDetailsModal";
import { listAssets, listMaterials, listParts, listPrinters, type Asset } from "@/lib/db";
import { materialLabel } from "@/lib/material-stock";
import { syncCatalogAssets, applyPartQuantityConsumption } from "@/lib/inventory";
import { useDeleteRecord, useSaveRecord } from "@/hooks/use-crud";
import { brl, dateBR, num } from "@/lib/format";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABEL,
} from "@/lib/domain";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [
      { title: pageTitle("Inventário") },
      {
        name: "description",
        content: "Patrimônio da empresa: equipamentos, ferramentas e peças prontas em estoque.",
      },
      { property: "og:title", content: pageTitle("Inventário") },
      {
        property: "og:description",
        content: "Patrimônio da empresa: equipamentos, ferramentas e peças prontas em estoque.",
      },
    ],
  }),
  component: InventarioPage,
});

const empty = {
  name: "",
  category: "equipamento",
  part_id: "",
  material_id: "",
  printer_id: "",
  origin_printer_id: "",
  quantity: "1",
  unit_value: "0",
  acquisition_date: "",
  location: "",
  condition: "bom",
  serial_number: "",
  image_url: null as string | null,
  notes: "",
};

function InventarioPage() {
  const qc = useQueryClient();
  useQuery({
    queryKey: ["assets-sync"],
    queryFn: async () => {
      await syncCatalogAssets();
      await qc.invalidateQueries({ queryKey: ["assets"] });
      return true;
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const assets = useQuery({ queryKey: ["assets"], queryFn: listAssets });
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });
  const printers = useQuery({ queryKey: ["printers"], queryFn: listPrinters });
  const save = useSaveRecord("assets");
  const remove = useDeleteRecord("assets");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [toDelete, setToDelete] = useState<Asset | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [originFilter, setOriginFilter] = useState("todos");
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);
  const [details, setDetails] = useState<Asset | null>(null);

  const printerIds = new Set((printers.data ?? []).map((p) => p.id));
  const rows = (assets.data ?? []).filter((a) => {
    const matchesCategory = categoryFilter === "todos" || a.category === categoryFilter;
    const hasPrinterLink = a.printer_id !== null;
    const hasPrinterOrigin = a.origin_printer_id !== null;
    const printerLinkExists = hasPrinterLink && printerIds.has(a.printer_id!);
    const matchesOrigin =
      originFilter === "todos" ||
      (originFilter === "printer" && hasPrinterLink && printerLinkExists) ||
      (originFilter === "unlinked" && hasPrinterOrigin && !hasPrinterLink) ||
      (originFilter === "no_origin" && !hasPrinterOrigin && !hasPrinterLink);
    return matchesCategory && matchesOrigin;
  });
  const table = useTableState(
    rows,
    (a) =>
      `${a.name} ${a.location ?? ""} ${a.serial_number ?? ""} ${ASSET_CATEGORY_LABEL[a.category] ?? ""}`,
  );

  const totalValue = rows.reduce((s, a) => s + Number(a.quantity) * Number(a.unit_value), 0);
  const totalItems = rows.reduce((s, a) => s + Number(a.quantity), 0);
  const finishedParts = rows.filter((a) => a.category === "peca_pronta").length;

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const openEdit = (a: Asset) => {
    setEditing(a);
    setForm({
      name: a.name,
      category: a.category,
      part_id: a.part_id ?? "",
      material_id: a.material_id ?? "",
      printer_id: a.printer_id ?? "",
      origin_printer_id: a.origin_printer_id ?? "",
      quantity: String(a.quantity),
      unit_value: String(a.unit_value),
      acquisition_date: a.acquisition_date ?? "",
      location: a.location ?? "",
      condition: a.condition,
      serial_number: a.serial_number ?? "",
      image_url: a.image_url,
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const pickPart = (partId: string) => {
    const p = (parts.data ?? []).find((x) => x.id === partId);
    setForm((f) => ({
      ...f,
      part_id: partId,
      material_id: partId ? "" : f.material_id,
      printer_id: partId ? "" : f.printer_id,
      category: partId ? "peca_pronta" : f.category,
      name: p ? p.name : f.name,
      unit_value: p ? String(Number(p.estimated_cost) || 0) : f.unit_value,
      image_url: p ? (p.image_url ?? p.image_urls?.[0] ?? null) : f.image_url,
    }));
  };

  const pickMaterial = (materialId: string) => {
    const m = (materials.data ?? []).find((x) => x.id === materialId);
    setForm((f) => ({
      ...f,
      material_id: materialId,
      part_id: materialId ? "" : f.part_id,
      printer_id: materialId ? "" : f.printer_id,
      category: materialId ? "material" : f.category,
      name: m ? materialLabel(m) : f.name,
      quantity: m ? String(Number(m.quantity) || 0) : f.quantity,
      unit_value: m ? String(Number(m.cost_per_unit) || 0) : f.unit_value,
      image_url: m ? (m.image_url ?? f.image_url) : f.image_url,
      location: m ? f.location || "Estoque" : f.location,
    }));

  };

  const pickPrinter = (printerId: string) => {
    const p = (printers.data ?? []).find((x) => x.id === printerId);
    setForm((f) => ({
      ...f,
      printer_id: printerId,
      origin_printer_id: printerId || f.origin_printer_id,
      part_id: printerId ? "" : f.part_id,
      material_id: printerId ? "" : f.material_id,
      category: printerId ? "equipamento" : f.category,
      name: p ? [p.nome, p.marca, p.modelo].filter(Boolean).join(" · ") : f.name,
      quantity: p ? "1" : f.quantity,
      unit_value: p ? String(Number(p.valor_compra) || 0) : f.unit_value,
      acquisition_date: p ? (p.data_aquisicao ?? f.acquisition_date) : f.acquisition_date,
      serial_number: p ? f.serial_number : f.serial_number,
      notes: p ? (p.observacoes ?? f.notes) : f.notes,
    }));
  };

  const printerName = (id: string) => {
    const p = (printers.data ?? []).find((x) => x.id === id);
    return p ? [p.nome, p.marca, p.modelo].filter(Boolean).join(" · ") : "origem removida";
  };

  const unlinkPrinter = (a: Asset) =>
    save.mutate(
      {
        id: a.id,
        values: { printer_id: null, origin_printer_id: a.origin_printer_id ?? a.printer_id },
      },
      { onSuccess: () => toast.success("Item desvinculado da impressora") },
    );

  const submit = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do item");
    save.mutate(
      {
        id: editing?.id,
        values: {
          name: form.name.trim(),
          category: form.category,
          part_id: form.part_id || null,
          material_id: form.material_id || null,
          printer_id: form.printer_id || null,
          origin_printer_id: form.origin_printer_id || null,
          quantity: Number(form.quantity) || 0,
          unit_value: Number(form.unit_value) || 0,
          acquisition_date: form.acquisition_date || null,
          location: form.location.trim() || null,
          condition: form.condition,
          serial_number: form.serial_number.trim() || null,
          image_url: form.image_url,
          notes: form.notes.trim() || null,
        },
      },
      {
        onSuccess: async () => {
          setOpen(false);
          if (form.part_id) {
            const nextQty = Number(form.quantity) || 0;
            const prevQty =
              Number((parts.data ?? []).find((p) => p.id === form.part_id)?.stock_quantity) || 0;
            await supabase.from("parts").update({ stock_quantity: nextQty }).eq("id", form.part_id);
            try {
              const { shortages } = await applyPartQuantityConsumption(
                form.part_id,
                nextQty,
                prevQty,
              );
              if (shortages.length)
                toast.warning(
                  `Saldo negativo de filamento: ${shortages
                    .map((s) => `${s.label} (${num(s.missing, 3)} ${s.unit})`)
                    .join(", ")}`,
                );
              else if (nextQty !== prevQty)
                toast.success("Movimentação de filamento registrada no estoque");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha ao movimentar o filamento");
            }
            if (form.image_url) {
              await supabase
                .from("parts")
                .update({ image_url: form.image_url })
                .eq("id", form.part_id);
            }
            qc.invalidateQueries({ queryKey: ["parts"], refetchType: "all" });
            qc.invalidateQueries({ queryKey: ["materials"], refetchType: "all" });
            qc.invalidateQueries({ queryKey: ["stock_movements"], refetchType: "all" });
          }
          if (form.material_id) {
            // a imagem do item de inventário espelha o item do estoque
            await supabase
              .from("materials")
              .update({ image_url: form.image_url })
              .eq("id", form.material_id);
            qc.invalidateQueries({ queryKey: ["materials"], refetchType: "all" });
          }

        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Inventário"
        description="Patrimônio da empresa: equipamentos, ferramentas e peças já produzidas."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo item
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Valor do patrimônio"
          value={brl(totalValue)}
          icon={<Wallet className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Itens em inventário"
          value={num(totalItems, 0)}
          icon={<Boxes className="h-4 w-4" />}
        />
        <StatCard
          label="Peças prontas"
          value={String(finishedParts)}
          icon={<Package className="h-4 w-4" />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar item..."
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as categorias</SelectItem>
            {ASSET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {ASSET_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer origem</SelectItem>
            <SelectItem value="printer">Puxados de impressoras</SelectItem>
            <SelectItem value="unlinked">Desvinculados (origem removida)</SelectItem>
            <SelectItem value="no_origin">Sem origem</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {table.paged.length === 0 ? (
        <EmptyState message="Nenhum item de patrimônio cadastrado ainda." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor un.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead>Aquisição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.paged.map((a) => (
                <TableRow
                  key={a.id}
                  className={clickableRow}
                  onClick={() => setDetails(a)}
                  title="Ver detalhes"
                >
                  <TableCell>
                    <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted">
                      <PartImage
                        src={a.image_url}
                        alt={a.name}
                        variant="thumb"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.location || "Sem local"}
                      {a.serial_number ? ` · ${a.serial_number}` : ""}
                    </div>
                    {a.printer_id || a.origin_printer_id ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="gap-1">
                          <Printer className="h-3 w-3" />
                          {a.printer_id
                            ? `Impressora: ${printerName(a.printer_id)}`
                            : `Origem: ${printerName(a.origin_printer_id!)} (desvinculado)`}
                        </Badge>
                        {a.printer_id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              unlinkPrinter(a);
                            }}
                          >
                            <Unlink className="h-3 w-3" /> Desvincular
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <OwnerTag ownerId={a.owner_id} />
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary">
                      {ASSET_CATEGORY_LABEL[a.category] ?? a.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{num(Number(a.quantity), 0)}</TableCell>
                  <TableCell className="text-right">{brl(Number(a.unit_value))}</TableCell>
                  <TableCell className="text-right font-medium">
                    {brl(Number(a.quantity) * Number(a.unit_value))}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ASSET_CONDITION_LABEL[a.condition] ?? a.condition}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateBR(a.acquisition_date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager {...table} total={table.filtered.length} />
        </div>
      )}

      <FormModal open={open} onOpenChange={setOpen}>
        <FormModalContent className="max-w-2xl">
          <FormModalHeader>
            <FormModalTitle>
              {editing ? "Editar item do inventário" : "Novo item do inventário"}
            </FormModalTitle>
          </FormModalHeader>
          <FormModalBody className="space-y-4">
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label>Puxar do cadastro de peças</Label>
              <Select
                value={form.part_id || "none"}
                onValueChange={(v) => pickPart(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Item avulso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não vincular (item próprio)</SelectItem>
                  {(parts.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao vincular uma peça, nome, valor e foto são preenchidos automaticamente.
              </p>
            </div>

            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label>Puxar do estoque (materiais)</Label>
              <Select
                value={form.material_id || "none"}
                onValueChange={(v) => pickMaterial(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Não vincular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não vincular ao estoque</SelectItem>
                  {(materials.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {materialLabel(m)} · {num(Number(m.quantity), 3)} {m.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O saldo do item vinculado acompanha o Estoque e é abatido automaticamente quando o
                material é vendido.
              </p>
            </div>

            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label>Puxar da lista de impressoras</Label>
              <Select
                value={form.printer_id || "none"}
                onValueChange={(v) => pickPrinter(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Não vincular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não vincular a uma impressora</SelectItem>
                  {(printers.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.nome, p.marca, p.modelo].filter(Boolean).join(" · ")} ·{" "}
                      {brl(Number(p.valor_compra))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Traz nome, valor de compra e data de aquisição da impressora cadastrada como
                equipamento do patrimônio.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ASSET_CATEGORY_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.unit_value}
                  onChange={(e) => setForm({ ...form, unit_value: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data de aquisição</Label>
                <Input
                  type="date"
                  value={form.acquisition_date}
                  onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Condição</Label>
                <Select
                  value={form.condition}
                  onValueChange={(v) => setForm({ ...form, condition: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ASSET_CONDITION_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Localização</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Ex.: Ateliê, prateleira 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nº de série / patrimônio</Label>
                <Input
                  value={form.serial_number}
                  onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                />
              </div>
            </div>

            <ImageUploadField
              value={form.image_url}
              onChange={(path) => setForm((f) => ({ ...f, image_url: path }))}
              label="Foto do item"
            />

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="rounded-lg bg-gradient-to-br from-primary/5 to-purple-500/5 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor total deste item</span>
                <span className="font-semibold">
                  {brl((Number(form.quantity) || 0) * (Number(form.unit_value) || 0))}
                </span>
              </div>
            </div>

            <Button className="w-full" onClick={submit} disabled={save.isPending}>
              Salvar
            </Button>
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item do inventário?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && remove.mutate(toDelete.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecordDetailsModal
        open={!!details}
        onOpenChange={(o) => !o && setDetails(null)}
        title={details?.name ?? ""}
        subtitle={
          details ? (ASSET_CATEGORY_LABEL[details.category] ?? details.category) : undefined
        }
        fields={
          details
            ? [
                { label: "Quantidade", value: num(Number(details.quantity), 0) },
                { label: "Valor unitário", value: brl(Number(details.unit_value)) },
                {
                  label: "Valor total",
                  value: brl(Number(details.quantity) * Number(details.unit_value)),
                },
                {
                  label: "Condição",
                  value: ASSET_CONDITION_LABEL[details.condition] ?? details.condition,
                },
                { label: "Local", value: details.location || "—" },
                { label: "Nº de série", value: details.serial_number || "—" },
                { label: "Aquisição", value: dateBR(details.acquisition_date) },
                {
                  label: "Impressora",
                  value: details.printer_id
                    ? printerName(details.printer_id)
                    : details.origin_printer_id
                      ? `${printerName(details.origin_printer_id)} (desvinculado)`
                      : "—",
                },
                { label: "Observações", value: details.notes || "—", full: true },
              ]
            : []
        }
        actions={
          details ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const a = details;
                  setDetails(null);
                  setHistoryAsset(a);
                }}
              >
                <History className="h-4 w-4" /> Histórico
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const a = details;
                  setDetails(null);
                  openEdit(a);
                }}
              >
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const a = details;
                  setDetails(null);
                  setToDelete(a);
                }}
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </>
          ) : null
        }
      />

      <AssetHistoryModal asset={historyAsset} onOpenChange={(o) => !o && setHistoryAsset(null)} />
    </div>
  );
}
