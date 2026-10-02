import { useEffect, useRef, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Clock, X, Loader2, ImagePlus, Sparkles, CheckCircle2, Circle, ListChecks, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Pager, useTableState } from "@/components/table-kit";
import { OwnerTag } from "@/components/OwnerTag";
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
import { FormModal, FormModalContent, FormModalHeader, FormModalTitle, FormModalBody, FormModalDescription } from "@/components/ui/form-modal";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { listMaterials, listParts, listPrinterMaintenances, listPrinters, listQuoteItems, listQuotes, listSaleItems, listSales, type Part } from "@/lib/db";
import { printerCosts } from "@/lib/printers";
import {
  applyMaterialConsumption,
  materialLabel,
  planMaterialConsumption,
  scaleUses,
  type MaterialShortage,
  type MaterialUse,
} from "@/lib/material-stock";
import { listPartMaterials, partMaterialUses, savePartMaterials } from "@/lib/part-materials";
import { listPartServices, savePartServices, type PartServiceInput } from "@/lib/part-services";
import { syncPartAssets } from "@/lib/inventory";
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
import { useDeleteRecord, useSaveRecord } from "@/hooks/use-crud";
import {
  uploadPartImage,
  removePartImage,
  validateImageFile,
  ACCEPT_ATTR,
  MAX_FILE_MB,
} from "@/lib/image-upload";
import { brl, dateBR, minutesToHuman, num } from "@/lib/format";
import { StockCategoryManager } from "@/components/StockCategoryManager";
import { listStockCategories } from "@/lib/stock-categories";
import { Tags } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pecas")({
  head: () => ({
    meta: [
      { title: "Peças · 3D Create" },
      { name: "description", content: "Catálogo de peças modeladas e produzidas." },
    ],
  }),
  component: PecasPage,
});

type MatRow = { material_id: string; grams: string };
type AccRow = { material_id: string; units: string };
type ServiceRow = { description: string; quantity: string; unit_cost: string };

const emptyMatRow = (): MatRow => ({ material_id: "", grams: "0" });
const emptyAccRow = (): AccRow => ({ material_id: "", units: "1" });
const emptyServiceRow = (): ServiceRow => ({ description: "", quantity: "1", unit_cost: "0" });

/** Filamento padrão sugerido: Preto PLA (ou o primeiro PLA disponível). */
const findDefaultMaterial = (
  list: { id: string; name: string; type?: string | null; color?: string | null; category?: string | null }[],
) => {
  const mats = list.filter((m) => (m.category ?? "material") === "material");
  const text = (m: (typeof mats)[number]) =>
    `${m.name} ${m.type ?? ""} ${m.color ?? ""}`.toLowerCase();
  return (
    mats.find((m) => text(m).includes("pla") && text(m).includes("pret"))?.id ??
    mats.find((m) => text(m).includes("pla"))?.id ??
    ""
  );
};

const empty = {
  name: "",
  category: "personalizado",
  images: [] as string[],
  print_minutes: "0",
  mats: [emptyMatRow()] as MatRow[],
  accs: [] as AccRow[],
  services: [] as ServiceRow[],
  printer_id: "",
  estimated_cost: "0",
  energy_price_kwh: "0",
  printer_watts: "0",
  sale_price: "0",
  stock_quantity: "0",
  notes: "",

};

function PecasPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const parts = useQuery({ queryKey: ["parts"], queryFn: listParts });
  const materials = useQuery({ queryKey: ["materials"], queryFn: listMaterials });
  const partMaterials = useQuery({
    queryKey: ["part_materials"],
    queryFn: () => listPartMaterials(),
  });
  const partServices = useQuery({
    queryKey: ["part_services"],
    queryFn: () => listPartServices(),
  });
  const printers = useQuery({ queryKey: ["printers"], queryFn: listPrinters });
  const printerMaints = useQuery({
    queryKey: ["printer_maintenances"],
    queryFn: () => listPrinterMaintenances(),
  });
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: listQuotes });
  const quoteItems = useQuery({ queryKey: ["quote_items"], queryFn: () => listQuoteItems() });
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const saleItems = useQuery({ queryKey: ["sale_items"], queryFn: () => listSaleItems() });
  const profile = useQuery({
    queryKey: ["profiles", "me", "defaults"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("default_printer_watts, default_energy_price_kwh, price_multiplier")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
  });
  const defaultWatts = Number(profile.data?.default_printer_watts ?? 0);
  const defaultKwh = Number(profile.data?.default_energy_price_kwh ?? 0);
  const multiplier = Number(profile.data?.price_multiplier ?? 3) || 3;

  const save = useSaveRecord("parts", ["printers", "printer-cost-history"]);
  const remove = useDeleteRecord("parts", ["printers", "printer-cost-history"]);

  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    unitUse: MaterialUse[];
    nextUse: MaterialUse[];
    prevUse: MaterialUse[];
    shortages: MaterialShortage[];
  } | null>(null);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [priceTouched, setPriceTouched] = useState(false);
  const [costTouched, setCostTouched] = useState(false);
  const [category, setCategory] = useState("todas");
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const partCategoriesQuery = useQuery({
    queryKey: ["stock_categories", "peca"],
    queryFn: () => listStockCategories("peca"),
  });
  const partCategories = partCategoriesQuery.data ?? [];
  const activePartCategories = partCategories.filter((c) => c.active);
  const formPartCategories = activePartCategories.some((c) => c.slug === form.category)
    ? activePartCategories
    : [...activePartCategories, ...partCategories.filter((c) => c.slug === form.category)];
  const partCategoryUsage = (parts.data ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});
  const partCategoryLabel = (slug: string | null | undefined) =>
    partCategories.find((c) => c.slug === slug)?.name ?? slug ?? "—";
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading(true);
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        try {
          validateImageFile(file);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Arquivo inválido");
          continue;
        }
        setProgress({ pct: 0, label: `Enviando ${i + 1}/${list.length}` });
        try {
          const path = await uploadPartImage(file, (p) =>
            setProgress({ pct: p.percent, label: `${p.label} ${i + 1}/${list.length}` }),
          );
          setForm((f) => ({ ...f, images: [...f.images, path] }));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha no upload");
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = async (path: string) => {
    setForm((f) => ({ ...f, images: f.images.filter((i) => i !== path) }));
    if (path && !/^https?:\/\//i.test(path)) {
      await removePartImage(path).catch(() => undefined);
    }
  };

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const moveImage = (from: number, to: number) =>
    setForm((f) => {
      if (from === to || from < 0 || to < 0 || from >= f.images.length || to >= f.images.length) return f;
      const images = [...f.images];
      const [item] = images.splice(from, 1);
      images.splice(to, 0, item);
      return { ...f, images };
    });




  const printMinutes = Math.max(0, Number(form.print_minutes) || 0);
  const totalMinutes = { hours: Math.floor(printMinutes / 60), mins: printMinutes % 60 };
  const setDuration = (hours: number, mins: number) =>
    setForm((f) => ({
      ...f,
      print_minutes: String(Math.max(0, Math.round(hours)) * 60 + Math.max(0, Math.min(59, Math.round(mins)))),
    }));

  const rows = (parts.data ?? []).filter((p) => category === "todas" || p.category === category);
  const table = useTableState(rows, (p) => p.name, 12);

  const defaultMaterialId = findDefaultMaterial(materials.data ?? []);

  const openNew = () => {
    setEditing(null);
    setForm({
      ...empty,
      images: [],
      mats: [{ material_id: defaultMaterialId, grams: "0" }],
      accs: [],
      services: [],
      printer_watts: String(defaultWatts || 0),
      energy_price_kwh: String(defaultKwh || 0),
    });
    setPriceTouched(false);
    setCostTouched(false);
    setOpen(true);
  };

  // Aplica o filamento padrão quando a lista de materiais chega depois de abrir o form.
  useEffect(() => {
    if (!open || editing || !defaultMaterialId) return;
    setForm((f) =>
      f.mats.some((m) => m.material_id)
        ? f
        : { ...f, mats: f.mats.map((m, i) => (i === 0 ? { ...m, material_id: defaultMaterialId } : m)) },
    );
  }, [open, editing, defaultMaterialId]);

  const openEdit = (p: Part) => {
    setEditing(p);
    const gallery = (p as unknown as { image_urls?: string[] }).image_urls ?? [];
    const uses = partMaterialUses(p.id, partMaterials.data, p);
    const gramUses = uses.filter((u) => u.units === undefined);
    const unitUses = uses.filter((u) => u.units !== undefined);
    setForm({
      name: p.name,
      category: p.category,
      images: gallery.length ? gallery : p.image_url ? [p.image_url] : [],
      print_minutes: String(p.print_minutes),
      mats: gramUses.length
        ? gramUses.map((u) => ({ material_id: u.material_id ?? "", grams: String(u.grams) }))
        : [emptyMatRow()],
      accs: unitUses.map((u) => ({ material_id: u.material_id ?? "", units: String(u.units ?? 0) })),
      services: (partServices.data ?? [])
        .filter((s) => s.part_id === p.id)
        .map((s) => ({
          description: s.description,
          quantity: String(s.quantity),
          unit_cost: String(s.unit_cost),
        })),
      printer_id: (p as unknown as { printer_id?: string | null }).printer_id ?? "",
      estimated_cost: String(p.estimated_cost),
      energy_price_kwh: String((p as unknown as { energy_price_kwh?: number }).energy_price_kwh ?? 0),
      printer_watts: String((p as unknown as { printer_watts?: number }).printer_watts ?? 0),
      sale_price: String((p as unknown as { sale_price?: number }).sale_price ?? 0),
      stock_quantity: String((p as unknown as { stock_quantity?: number }).stock_quantity ?? 0),
      notes: p.notes ?? "",

    });
    setPriceTouched(true);
    setCostTouched(true);
    setOpen(true);
  };

  const formUses = (): MaterialUse[] => [
    ...form.mats
      .filter((m) => m.material_id && (Number(m.grams) || 0) > 0)
      .map((m) => ({ material_id: m.material_id, grams: Number(m.grams) || 0 })),
    ...form.accs
      .filter((a) => a.material_id && (Number(a.units) || 0) > 0)
      .map((a) => ({ material_id: a.material_id, grams: 0, units: Number(a.units) || 0 })),
  ];

  const totalGrams = form.mats.reduce((s, m) => s + (Number(m.grams) || 0), 0);

  const setMat = (idx: number, patch: Partial<MatRow>) =>
    setForm((f) => ({
      ...f,
      mats: f.mats.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  const addMat = () => setForm((f) => ({ ...f, mats: [...f.mats, emptyMatRow()] }));
  const removeMat = (idx: number) =>
    setForm((f) => {
      const mats = f.mats.filter((_, i) => i !== idx);
      return { ...f, mats: mats.length ? mats : [emptyMatRow()] };
    });

  const setAcc = (idx: number, patch: Partial<AccRow>) =>
    setForm((f) => ({ ...f, accs: f.accs.map((a, i) => (i === idx ? { ...a, ...patch } : a)) }));
  const addAcc = () => setForm((f) => ({ ...f, accs: [...f.accs, emptyAccRow()] }));
  const removeAcc = (idx: number) =>
    setForm((f) => ({ ...f, accs: f.accs.filter((_, i) => i !== idx) }));

  const setService = (idx: number, patch: Partial<ServiceRow>) =>
    setForm((f) => ({
      ...f,
      services: f.services.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  const addService = () => setForm((f) => ({ ...f, services: [...f.services, emptyServiceRow()] }));
  const removeService = (idx: number) =>
    setForm((f) => ({ ...f, services: f.services.filter((_, i) => i !== idx) }));

  const persist = (unitUse: MaterialUse[], nextUse: MaterialUse[], prevUse: MaterialUse[]) => {
    save.mutate(
      {
        id: editing?.id,
        values: {
          name: form.name.trim(),
          category: form.category,
          image_url: form.images[0] ?? null,
          image_urls: form.images,
          print_minutes: Number(form.print_minutes) || 0,
          material_id: unitUse[0]?.material_id ?? null,
          material_grams: unitUse.reduce((s, u) => s + u.grams, 0),
          printer_id: form.printer_id || null,
          estimated_cost: Number(form.estimated_cost) || 0,
          energy_price_kwh: Number(form.energy_price_kwh) || 0,
          printer_watts: Number(form.printer_watts) || 0,
          sale_price: Number(form.sale_price) || 0,
          stock_quantity: Number(form.stock_quantity) || 0,
          notes: form.notes.trim() || null,

        },
      },
      {
        onSuccess: async (saved) => {
          setOpen(false);
          const savedId = (saved as { id?: string })?.id ?? editing?.id;
          try {
            if (savedId) await savePartMaterials(savedId, unitUse);
            if (savedId) {
              const serviceRows: PartServiceInput[] = form.services
                .filter((s) => s.description.trim() && (Number(s.quantity) || 0) > 0)
                .map((s) => ({
                  description: s.description.trim(),
                  quantity: Number(s.quantity) || 0,
                  unit_cost: Number(s.unit_cost) || 0,
                }));
              await savePartServices(savedId, serviceRows);
              qc.invalidateQueries({ queryKey: ["part_services"] });
            }
            await applyMaterialConsumption(

              nextUse,
              prevUse,
              `Impressão da peça ${(saved as { name?: string })?.name ?? form.name.trim()}`,
            );
            qc.invalidateQueries({ queryKey: ["part_materials"] });
            qc.invalidateQueries({ queryKey: ["materials"] });
            qc.invalidateQueries({ queryKey: ["stock_movements"] });
            await syncPartAssets();
            qc.invalidateQueries({ queryKey: ["assets"] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao baixar o material do estoque");
          }
        },
      },
    );
  };

  const checklist = [
    { label: "Nome da peça", done: !!form.name.trim(), required: true },
    {
      label: "Filamento selecionado",
      done: form.mats.some((m) => !!m.material_id),
      required: true,
    },
    {
      label: "Gramas por filamento",
      done:
        form.mats.some((m) => !!m.material_id) &&
        form.mats.every((m) => !m.material_id || (Number(m.grams) || 0) > 0),
      required: true,
    },
    {
      label: "Tempo de impressão",
      done: (Number(form.print_minutes) || 0) > 0,
      required: true,
    },
    { label: "Impressora utilizada", done: !!form.printer_id, required: false },
    { label: "Valor venal", done: (Number(form.sale_price) || 0) > 0, required: false },
    { label: "Foto de referência", done: form.images.length > 0, required: false },
  ];
  const missingRequired = checklist.filter((c) => c.required && !c.done);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome da peça");
    if (!form.mats.some((m) => m.material_id))
      return toast.error("Selecione o filamento utilizado — obrigatório para o cálculo do preço");
    if (form.mats.some((m) => m.material_id && (Number(m.grams) || 0) <= 0))
      return toast.error("Informe as gramas de cada filamento selecionado");
    if (form.accs.some((a) => a.material_id && (Number(a.units) || 0) <= 0))
      return toast.error("Informe a quantidade de cada acessório selecionado");
    if (form.accs.some((a) => !a.material_id && (Number(a.units) || 0) > 0))
      return toast.error("Selecione o item do estoque para cada acessório adicionado");
    if ((Number(form.print_minutes) || 0) <= 0)
      return toast.error("Informe o tempo de impressão da peça");
    const unitUse = formUses();
    const nextUse = scaleUses(unitUse, form.stock_quantity);
    const prevUse = editing
      ? scaleUses(
          partMaterialUses(editing.id, partMaterials.data, editing),
          (editing as unknown as { stock_quantity?: number }).stock_quantity ?? 0,
        )
      : [];
    try {
      const { shortages } = await planMaterialConsumption(nextUse, prevUse);
      if (shortages.length) {
        setPendingSave({ unitUse, nextUse, prevUse, shortages });
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conferir o estoque");
      return;
    }
    persist(unitUse, nextUse, prevUse);
  };

  const deletePart = (p: Part) => {
    const prevUse = scaleUses(
      partMaterialUses(p.id, partMaterials.data, p),
      (p as unknown as { stock_quantity?: number }).stock_quantity ?? 0,
    );
    remove.mutate(p.id, {
      onSuccess: async () => {
        try {
          await applyMaterialConsumption([], prevUse, `Estorno pela exclusão da peça ${p.name}`);
          qc.invalidateQueries({ queryKey: ["part_materials"] });
          qc.invalidateQueries({ queryKey: ["materials"] });
          qc.invalidateQueries({ queryKey: ["stock_movements"] });
          qc.invalidateQueries({ queryKey: ["assets"] });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao estornar o material");
        }
      },
    });
  };





  const materialOf = (id: string | null | undefined) =>
    materials.data?.find((m) => m.id === id) ?? null;
  const materialName = (id: string | null) => {
    const m = materialOf(id);
    return m ? materialLabel(m) : "Sem material";
  };


  const selectedPrinter = (printers.data ?? []).find((pr) => pr.id === form.printer_id) ?? null;
  const selectedPrinterCosts = selectedPrinter
    ? printerCosts(
        selectedPrinter,
        (printerMaints.data ?? []).filter((m) => m.printer_id === selectedPrinter.id),
        Number(form.energy_price_kwh) || 0,
      )
    : { machine: 0, maintenance: 0, energy: 0, total: 0 };

  const pickPrinter = (id: string) => {
    const pr = (printers.data ?? []).find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      printer_id: id,
      printer_watts: pr?.potencia_watts ? String(Number(pr.potencia_watts)) : f.printer_watts,
    }));
  };

  const costCalc = (() => {
    const hours = (Number(form.print_minutes) || 0) / 60;
    const kwh = ((Number(form.printer_watts) || 0) / 1000) * hours;
    const energy = kwh * (Number(form.energy_price_kwh) || 0);
    const material = form.mats.reduce((sum, row) => {
      const mat = materials.data?.find((m) => m.id === row.material_id);
      const grams = Number(row.grams) || 0;
      if (!mat || !grams) return sum;
      const cost = Number(mat.cost_per_unit);
      return sum + (mat.unit === "g" ? grams * cost : (grams / 1000) * cost);
    }, 0);
    const accessories = form.accs.reduce((sum, row) => {
      const mat = materials.data?.find((m) => m.id === row.material_id);
      const units = Number(row.units) || 0;
      if (!mat || !units) return sum;
      return sum + units * Number(mat.cost_per_unit);
    }, 0);
    const services = form.services.reduce((sum, row) => {
      const qty = Number(row.quantity) || 0;
      const cost = Number(row.unit_cost) || 0;
      if (!row.description.trim() || !qty) return sum;
      return sum + qty * cost;
    }, 0);
    return {
      hours,
      kwh,
      energy,
      material,
      accessories,
      services,
      machinePerHour: selectedPrinterCosts.machine + selectedPrinterCosts.maintenance,
      machine: (selectedPrinterCosts.machine + selectedPrinterCosts.maintenance) * hours,
      total:
        energy +
        material +
        accessories +
        services +
        (selectedPrinterCosts.machine + selectedPrinterCosts.maintenance) * hours,
    };
  })();

  const baseCost = Number(form.estimated_cost) || costCalc.total;
  const suggestedPrice = baseCost * multiplier;

  const openDraftQuote = () => {
    if (!form.name.trim()) return toast.error("Informe o nome da peça para gerar o orçamento");
    const unitPrice = Number(form.sale_price) || suggestedPrice || Number(form.estimated_cost) || 0;
    if (!unitPrice) return toast.error("Informe o custo estimado ou o valor venal para gerar o orçamento");
    const href = router.buildLocation({
      to: "/orcamentos/rascunho",
      search: {
        name: form.name.trim(),
        imageUrl: form.images[0] ?? null,
        quantity: 1,
        unitPrice,
        printMinutes: Number(form.print_minutes) || 0,
        notes: form.notes.trim(),
      },
    }).href;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  // Recalcula o custo estimado sempre que insumos, tempo ou energia mudarem.
  const costInputsKey = [
    JSON.stringify(form.mats),
    JSON.stringify(form.accs),
    JSON.stringify(form.services),
    form.print_minutes,
    form.energy_price_kwh,
    form.printer_watts,
    form.printer_id,
    String(selectedPrinterCosts.machine + selectedPrinterCosts.maintenance),
  ].join("|");
  const lastCostInputs = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastCostInputs.current = null;
      return;
    }
    const changed = lastCostInputs.current !== null && lastCostInputs.current !== costInputsKey;
    lastCostInputs.current = costInputsKey;
    if (!changed && costTouched) return;
    const next = costCalc.total > 0 ? costCalc.total.toFixed(2) : "0";
    if (changed) setCostTouched(false);
    setForm((f) => (f.estimated_cost === next ? f : { ...f, estimated_cost: next }));
  }, [open, costInputsKey, costTouched, costCalc.total]);


  // Sugere automaticamente o preço (custo × multiplicador) enquanto o usuário não editar o valor.
  useEffect(() => {
    if (!open || priceTouched) return;
    const next = suggestedPrice > 0 ? suggestedPrice.toFixed(2) : "0";
    setForm((f) => (f.sale_price === next ? f : { ...f, sale_price: next }));
  }, [open, priceTouched, suggestedPrice]);


  const WON_STATUS = ["aprovado", "em_producao", "concluido"];
  const buildSalesSummary = (part: Part | null) => {
    if (!part) return null;
    const wonQuotes = new Map(
      (quotes.data ?? [])
        .filter((q) => WON_STATUS.includes(q.status))
        .map((q) => [q.id, q]),
    );
    const unitCost = Number(part.estimated_cost) || 0;

    const fromQuotes = (quoteItems.data ?? [])
      .filter((i) => i.part_id === part.id && wonQuotes.has(i.quote_id))
      .map((i) => {
        const q = wonQuotes.get(i.quote_id)!;
        const qty = Number(i.quantity);
        const receita = Number(i.unit_price) * qty;
        const gasto = unitCost * qty;
        return {
          id: i.id,
          origem: "Orçamento",
          date: q.created_at.slice(0, 10),
          qty,
          receita,
          gasto,
          margem: receita - gasto,
        };
      });

    const paidSales = new Map(
      (sales.data ?? []).filter((s) => s.status !== "cancelado").map((s) => [s.id, s]),
    );
    const fromSales = (saleItems.data ?? [])
      .filter((i) => i.part_id === part.id && paidSales.has(i.sale_id))
      .map((i) => {
        const s = paidSales.get(i.sale_id)!;
        const qty = Number(i.quantity);
        const receita = Number(i.unit_price) * qty;
        const gasto = (Number(i.unit_cost) || unitCost) * qty;
        return {
          id: i.id,
          origem: "Venda",
          date: s.sale_date,
          qty,
          receita,
          gasto,
          margem: receita - gasto,
        };
      });

    const rows = [...fromQuotes, ...fromSales].sort((a, b) => b.date.localeCompare(a.date));
    const totals = rows.reduce(
      (acc, r) => ({
        qty: acc.qty + r.qty,
        receita: acc.receita + r.receita,
        gasto: acc.gasto + r.gasto,
        margem: acc.margem + r.margem,
      }),
      { qty: 0, receita: 0, gasto: 0, margem: 0 },
    );
    return { rows, totals };
  };
  const salesSummary = buildSalesSummary(editing);

  const detailPart = detailId ? (parts.data ?? []).find((p) => p.id === detailId) ?? null : null;
  const detailSummary = buildSalesSummary(detailPart);
  const detailImages = detailPart
    ? ((detailPart as unknown as { image_urls?: string[] }).image_urls?.length
        ? (detailPart as unknown as { image_urls: string[] }).image_urls
        : detailPart.image_url
          ? [detailPart.image_url]
          : [])
    : [];
  const detailSalePrice = Number((detailPart as unknown as { sale_price?: number })?.sale_price ?? 0);
  const detailCost = Number(detailPart?.estimated_cost ?? 0);
  const detailMargin = detailSalePrice - detailCost;
  const detailPrinter = detailPart
    ? (printers.data ?? []).find(
        (pr) => pr.id === (detailPart as unknown as { printer_id?: string | null }).printer_id,
      ) ?? null
    : null;
  const detailUses = detailPart
    ? partMaterialUses(detailPart.id, partMaterials.data, detailPart)
    : [];
  const detailServices = detailPart
    ? (partServices.data ?? []).filter((s) => s.part_id === detailPart.id)
    : [];


  return (
    <div>
      <PageHeader
        title="Peças criadas"
        description="Catálogo com tempo de impressão, material e custo estimado."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova peça
          </Button>

        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar peça"
            value={table.search}
            onChange={(e) => table.setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {partCategories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {table.filtered.length === 0 ? (
        <EmptyState message="Nenhuma peça no catálogo ainda." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {table.paged.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailId(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailId(p.id);
                  }
                }}
                className="flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted p-2">
                  <PartImage
                    src={p.image_url}
                    alt={p.name}
                    variant="thumb"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <p className="min-w-0 break-words font-semibold leading-tight">{p.name}</p>
                    <Badge variant="secondary" className="shrink-0">
                      {partCategoryLabel(p.category)}
                    </Badge>
                  </div>

                  <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {minutesToHuman(p.print_minutes)} · {materialName(p.material_id)}
                    </span>
                  </p>
                  {(() => {
                    const all = partMaterialUses(p.id, partMaterials.data, p);
                    const uses = all.filter((u) => u.units === undefined);
                    const accs = all.filter((u) => u.units !== undefined);
                    const total = uses.reduce((s, u) => s + u.grams, 0);
                    if (total <= 0 && !accs.length) return null;
                    return (
                      <div className="flex flex-wrap gap-1">
                        {total > 0 && (
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {num(total, 0)} g de filamento
                          </Badge>
                        )}
                        {uses.length > 1 &&
                          uses.map((u, i) => (
                            <Badge key={i} variant="secondary" className="max-w-full text-[10px] font-normal">
                              <span className="truncate">
                                {materialName(u.material_id)} · {num(u.grams, 0)} g
                              </span>
                            </Badge>
                          ))}
                        {accs.map((u, i) => (
                          <Badge key={`a${i}`} variant="secondary" className="max-w-full text-[10px] font-normal">
                            <span className="truncate">
                              {num(u.units ?? 0, 0)}× {materialName(u.material_id)}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col">

                      <span className="text-sm font-semibold">
                        {brl(Number((p as unknown as { sale_price?: number }).sale_price ?? 0))}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Custo {brl(Number(p.estimated_cost))} · Estoque{" "}
                        {num(Number((p as unknown as { stock_quantity?: number }).stock_quantity ?? 0), 0)} un.
                      </span>
                    </div>

                    <span onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${p.name}`}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${p.name}`}
                        onClick={() => deletePart(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </div>
                  <OwnerTag ownerId={p.owner_id} prefix="Criado por" className="text-[11px]" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border bg-card">
            <Pager {...table} total={table.filtered.length} />
          </div>
        </>
      )}

      <FormModal open={!!detailPart} onOpenChange={(v) => !v && setDetailId(null)}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>{detailPart?.name ?? "Peça"}</FormModalTitle>
            <FormModalDescription>
              {detailPart
                ? `${partCategoryLabel(detailPart.category)} · ${minutesToHuman(detailPart.print_minutes)}`
                : ""}
            </FormModalDescription>
          </FormModalHeader>
          <FormModalBody>
            {detailPart && (
              <div className="space-y-4">
                {detailImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {detailImages.map((img, idx) => (
                      <div
                        key={img}
                        className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-muted p-1"
                      >
                        <PartImage
                          src={img}
                          alt={`${detailPart.name} — foto ${idx + 1}`}
                          variant="thumb"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Venda</p>
                    <p className="text-sm font-semibold">{brl(detailSalePrice)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Custo</p>
                    <p className="text-sm font-semibold">{brl(detailCost)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Margem</p>
                    <p
                      className={`text-sm font-semibold ${detailMargin < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {brl(detailMargin)}
                    </p>
                    {detailSalePrice > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {num((detailMargin / detailSalePrice) * 100, 1)}%
                      </p>
                    )}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Filamentos</dt>
                    <dd>
                      {detailUses.filter((u) => u.units === undefined).length === 0 ? (
                        "Sem material"
                      ) : (
                        <ul className="space-y-0.5">
                          {detailUses
                            .filter((u) => u.units === undefined)
                            .map((u, i) => (
                              <li key={i}>
                                {materialName(u.material_id)} — {num(u.grams, 0)} g
                              </li>
                            ))}
                        </ul>
                      )}
                    </dd>
                  </div>
                  {detailUses.some((u) => u.units !== undefined) && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Acessórios</dt>
                      <dd>
                        <ul className="space-y-0.5">
                          {detailUses
                            .filter((u) => u.units !== undefined)
                            .map((u, i) => (
                              <li key={i}>
                                {materialName(u.material_id)} — {num(u.units ?? 0, 0)} un
                              </li>
                            ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  {detailServices.length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Serviços extras</dt>
                      <dd>
                        <ul className="space-y-0.5">
                          {detailServices.map((s) => (
                            <li key={s.id}>
                              {s.description} — {num(Number(s.quantity), 0)} ×{" "}
                              {brl(Number(s.unit_cost))} = {brl(Number(s.quantity) * Number(s.unit_cost))}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">Consumo total</dt>
                    <dd>{num(detailUses.reduce((s, u) => s + u.grams, 0), 0)} g</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Impressora</dt>
                    <dd>{detailPrinter?.nome ?? "Não informada"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Tempo de impressão</dt>
                    <dd>{minutesToHuman(detailPart.print_minutes)}</dd>
                  </div>
                </dl>

                {detailPart.notes && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">Observações</p>
                    <p className="whitespace-pre-wrap">{detailPart.notes}</p>
                  </div>
                )}

                {detailSummary && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Histórico de vendas · {detailSummary.totals.qty} un.
                    </p>
                    {detailSummary.rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma venda registrada.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {detailSummary.rows.slice(0, 6).map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-muted-foreground">
                              {dateBR(r.date)} · {r.origem} · {r.qty} un.
                            </span>
                            <span className="shrink-0 font-medium">{brl(r.receita)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <OwnerTag ownerId={detailPart.owner_id} prefix="Criado por" className="text-[11px]" />

                <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                  <Button variant="outline" onClick={() => setDetailId(null)}>
                    Fechar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      deletePart(detailPart);
                      setDetailId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                  <Button
                    onClick={() => {
                      setDetailId(null);
                      openEdit(detailPart);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                </div>
              </div>
            )}
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <FormModal open={open} onOpenChange={setOpen}>
        <FormModalContent>
          <FormModalHeader>
            <FormModalTitle>{editing ? "Editar peça" : "Nova peça"}</FormModalTitle>
          </FormModalHeader>
          <FormModalBody>
            <div
              className={`sticky top-0 z-10 space-y-2 rounded-lg border p-3 backdrop-blur ${
                missingRequired.length
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-emerald-500/40 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="h-4 w-4 text-primary" />
                Checklist do cadastro
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {checklist.filter((c) => c.done).length}/{checklist.length}
                </span>
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {checklist.map((c) => (
                  <li
                    key={c.label}
                    className={`flex items-center gap-2 text-xs ${
                      c.done
                        ? "text-muted-foreground line-through"
                        : c.required
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {c.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {c.label}
                      {c.required && !c.done ? " *" : ""}
                    </span>
                    {c.done && <span className="ml-auto text-[10px] text-emerald-600">OK</span>}
                  </li>
                ))}
              </ul>
              {missingRequired.length > 0 && (
                <p className="text-xs text-destructive">
                  Itens obrigatórios pendentes: {missingRequired.map((c) => c.label).join(", ")}.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex items-center gap-2">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formPartCategories.map((c) => (
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
            </div>
            <div className="space-y-1.5">
              <Label>Fotos de referência</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {form.images.map((img, idx) => (
                  <div
                    key={img}
                    draggable={!uploading}
                    onDragStart={(e) => {
                      setDragIdx(idx);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (overIdx !== idx) setOverIdx(idx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIdx !== null) moveImage(dragIdx, idx);
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Foto ${idx + 1}${idx === 0 ? " (capa)" : ""}. Use as setas esquerda e direita para reordenar.`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        moveImage(idx, idx - 1);
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        moveImage(idx, idx + 1);
                      }
                    }}
                    className={`group relative aspect-square cursor-grab overflow-hidden rounded-lg border bg-muted/40 transition active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      dragIdx === idx ? "opacity-50" : ""
                    } ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex h-full w-full items-center justify-center p-1.5">
                      <PartImage
                        src={img}
                        alt={`Foto ${idx + 1}`}
                        variant="thumb"
                        className="pointer-events-none max-h-full max-w-full rounded object-contain"
                      />
                    </div>
                    {idx === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[9px] font-medium uppercase tracking-wide">
                        Capa
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Remover foto"
                      onClick={() => removeImage(img)}
                      disabled={uploading}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-1 text-destructive-foreground opacity-90 transition hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition hover:bg-muted/50 disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  {uploading ? "Enviando" : "Adicionar"}
                </button>
              </div>
              {form.images.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Arraste as fotos para reordenar — a primeira é a capa. Pelo teclado, use ← e →.
                </p>
              )}

              {uploading && progress && (
                <div className="space-y-1">
                  <Progress value={progress.pct} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.label}</span>
                    <span>{progress.pct}%</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Várias fotos por peça. JPG, PNG, WebP, GIF ou BMP — até {MAX_FILE_MB} MB cada. A primeira foto é usada como capa.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Filamentos utilizados <span className="text-destructive">*</span>
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addMat}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar filamento
                </Button>
              </div>
              {form.mats.map((row, idx) => {
                const mat = materialOf(row.material_id);
                return (
                  <div key={idx} className="rounded-lg border p-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <Select
                          value={row.material_id || "none"}
                          onValueChange={(v) => setMat(idx, { material_id: v === "none" ? "" : v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem material</SelectItem>
                            {(materials.data ?? [])
                              .filter(
                                (m) =>
                                  (m.category ?? "material") === "material" ||
                                  m.id === row.material_id,
                              )
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {materialLabel(m)} · {num(Number(m.quantity), 3)} {m.unit}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative w-full sm:w-32">
                        <Input
                          type="number"
                          min={0}
                          className="pr-8"
                          value={row.grams}
                          onChange={(e) => setMat(idx, { grams: e.target.value })}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          g
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover filamento"
                        onClick={() => removeMat(idx)}
                        disabled={form.mats.length === 1 && !row.material_id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {mat && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {materialLabel(mat)} — saldo {num(Number(mat.quantity), 3)} {mat.unit}. Ao
                        salvar, a diferença consumida é baixada do estoque.
                      </p>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Total consumido: {num(totalGrams, 0)} g em {form.mats.filter((m) => m.material_id).length}{" "}
                filamento(s).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Acessórios / itens por unidade</Label>
                <Button type="button" variant="outline" size="sm" onClick={addAcc}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar acessório
                </Button>
              </div>
              {form.accs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Opcional. Use para itens contados por unidade (argola de chaveiro, ímã, corrente).
                  A quantidade informada é baixada do estoque do item.
                </p>
              )}
              {form.accs.map((row, idx) => {
                const acc = materialOf(row.material_id);
                return (
                  <div key={idx} className="rounded-lg border p-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <Select
                          value={row.material_id || "none"}
                          onValueChange={(v) => setAcc(idx, { material_id: v === "none" ? "" : v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Selecione o item</SelectItem>
                            {(materials.data ?? [])
                              .filter(
                                (m) =>
                                  (m.category ?? "material") !== "material" ||
                                  m.id === row.material_id,
                              )
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {materialLabel(m)} · {num(Number(m.quantity), 3)} {m.unit}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative w-full sm:w-32">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          className="pr-9"
                          value={row.units}
                          onChange={(e) => setAcc(idx, { units: e.target.value })}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {acc?.unit ?? "un"}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover acessório"
                        onClick={() => removeAcc(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {acc && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {materialLabel(acc)} — saldo {num(Number(acc.quantity), 3)} {acc.unit}. Ao
                        salvar, a quantidade usada é baixada do estoque.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Serviços extras</Label>
                <Button type="button" variant="outline" size="sm" onClick={addService}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar serviço
                </Button>
              </div>
              {form.services.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Opcional. Use para serviços extras necessários para produzir a peça (modelagem,
                  pintura, acabamento, lixamento etc.). O custo é somado ao custo total da peça.
                </p>
              )}
              {form.services.map((row, idx) => {
                const qty = Number(row.quantity) || 0;
                const unitCost = Number(row.unit_cost) || 0;
                return (
                  <div key={idx} className="rounded-lg border p-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <Input
                          placeholder="Descrição do serviço (ex.: Modelagem 3D, Pintura)"
                          value={row.description}
                          onChange={(e) => setService(idx, { description: e.target.value })}
                        />
                      </div>
                      <div className="w-full sm:w-24">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          placeholder="Qtd"
                          value={row.quantity}
                          onChange={(e) => setService(idx, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="relative w-full sm:w-32">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="pl-8"
                          placeholder="Custo un."
                          value={row.unit_cost}
                          onChange={(e) => setService(idx, { unit_cost: e.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover serviço"
                        onClick={() => removeService(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {row.description.trim() && qty > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {num(qty, qty % 1 === 0 ? 0 : 2)} × {brl(unitCost)} = {brl(qty * unitCost)}
                      </p>
                    )}
                  </div>
                );
              })}
              {costCalc.services > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total em serviços: {brl(costCalc.services)}.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tempo médio de impressão</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      className="pr-9"
                      value={String(totalMinutes.hours)}
                      onChange={(e) => setDuration(Number(e.target.value) || 0, totalMinutes.mins)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      h
                    </span>
                  </div>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      className="pr-11"
                      value={String(totalMinutes.mins)}
                      onChange={(e) => setDuration(totalMinutes.hours, Number(e.target.value) || 0)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      min
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: {minutesToHuman(Number(form.print_minutes) || 0)}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Total de filamento</Label>
                <Input value={`${num(totalGrams, 0)} g`} readOnly disabled />
                <p className="text-xs text-muted-foreground">
                  Somatório das quantidades informadas em “Filamentos utilizados”.
                </p>
              </div>


            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Impressora utilizada</Label>
                <Select value={form.printer_id || "none"} onValueChange={(v) => pickPrinter(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a impressora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {(printers.data ?? [])
                      .filter((pr) => pr.status === "ativa")
                      .map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>
                          {pr.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedPrinter && (
                  <p className="text-xs text-muted-foreground">
                    {minutesToHuman(Number(form.print_minutes) || 0)} ×{" "}
                    {Math.max(Number(form.stock_quantity) || 0, 1)} un. serão somadas às horas de uso
                    de {selectedPrinter.nome}.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Custo de máquina (R$/hora)</Label>
                <Input
                  readOnly
                  value={brl(costCalc.machinePerHour)}
                  className="bg-muted/50 font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  {selectedPrinter
                    ? "Depreciação + manutenção da impressora selecionada."
                    : "Selecione uma impressora para incluir a depreciação."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço do kWh (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.energy_price_kwh}
                  onChange={(e) => setForm({ ...form, energy_price_kwh: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Potência da impressora (W)</Label>
                <Input
                  type="number"
                  value={form.printer_watts}
                  onChange={(e) => setForm({ ...form, printer_watts: e.target.value })}
                />
                {defaultWatts > 0 && Number(form.printer_watts) !== defaultWatts && (
                  <button
                    type="button"
                    className="text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => setForm({ ...form, printer_watts: String(defaultWatts) })}
                  >
                    Usar padrão configurado ({defaultWatts} W)
                  </button>
                )}
                {defaultWatts === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Defina a potência padrão em Configurações para preencher automaticamente.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Energia ({costCalc.kwh.toFixed(2)} kWh)
                </span>
                <span className="font-medium">{brl(costCalc.energy)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Material</span>
                <span className="font-medium">{brl(costCalc.material)}</span>
              </div>
              {costCalc.accessories > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Acessórios</span>
                  <span className="font-medium">{brl(costCalc.accessories)}</span>
                </div>
              )}
              {costCalc.services > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Serviços</span>
                  <span className="font-medium">{brl(costCalc.services)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Máquina ({minutesToHuman(Number(form.print_minutes) || 0)} ×{" "}
                  {brl(costCalc.machinePerHour)}/h)
                </span>
                <span className="font-medium">{brl(costCalc.machine)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Custo total de fabricação</span>
                <span className="font-semibold">{brl(costCalc.total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Este valor é aplicado automaticamente no custo estimado.
              </p>

            </div>
            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-1.5">
                <Label>Custo estimado (R$)</Label>
                <Input
                  type="number"
                  value={form.estimated_cost}
                  onChange={(e) => {
                    setCostTouched(true);
                    setForm({ ...form, estimated_cost: e.target.value });
                  }}

                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor venal (R$)</Label>
                <Input
                  type="number"
                  value={form.sale_price}
                  onChange={(e) => {
                    setPriceTouched(true);
                    setForm({ ...form, sale_price: e.target.value });
                  }}
                />
                {suggestedPrice > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setPriceTouched(true);
                      setForm({ ...form, sale_price: suggestedPrice.toFixed(2) });
                    }}
                  >
                    <Sparkles className="h-3 w-3" /> Sugerido {brl(suggestedPrice)} ({multiplier}× o custo)
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Quantidade em estoque (unidades prontas)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Essa quantidade aparece no Inventário e é baixada automaticamente nas vendas.
              </p>
            </div>


            <div className="space-y-3 rounded-lg border bg-gradient-to-br from-primary/5 to-purple-500/5 p-3 text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold">Cálculo do preço sugerido</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custo estimado</span>
                  <span className="font-medium">{brl(Number(form.estimated_cost) || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tempo de impressão</span>
                  <span className="font-medium">{minutesToHuman(Number(form.print_minutes) || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Energia usada</span>
                  <span className="font-medium">{costCalc.kwh.toFixed(2)} kWh</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Multiplicador aplicado</span>
                  <span className="font-medium">{multiplier}×</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Preço sugerido</span>
                  <span className="font-semibold text-primary">{brl(suggestedPrice)}</span>
                </div>
                {Number(form.sale_price) > 0 && Number(form.estimated_cost) > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Margem com valor venal atual</span>
                    <span className="font-medium">
                      {brl(Number(form.sale_price) - (Number(form.estimated_cost) || 0))}
                      {" "}
                      <span className="text-muted-foreground">
                        ({num(((Number(form.sale_price) - (Number(form.estimated_cost) || 0)) / Number(form.sale_price)) * 100, 1)}%)
                      </span>
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                O valor sugerido é baseado no custo estimado multiplicado por {multiplier}×. Ajuste o multiplicador em Configurações.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {salesSummary && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Vendas desta peça</h3>
                  <span className="text-xs text-muted-foreground">
                    {salesSummary.totals.qty} un. vendida{salesSummary.totals.qty === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-background p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Venda</p>
                    <p className="text-sm font-semibold">{brl(salesSummary.totals.receita)}</p>
                  </div>
                  <div className="rounded-md bg-background p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gasto</p>
                    <p className="text-sm font-semibold">{brl(salesSummary.totals.gasto)}</p>
                  </div>
                  <div className="rounded-md bg-background p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lucro</p>
                    <p
                      className={`text-sm font-semibold ${salesSummary.totals.margem < 0 ? "text-destructive" : "text-emerald-600"}`}
                    >
                      {brl(salesSummary.totals.margem)}
                    </p>
                    {salesSummary.totals.receita > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {num((salesSummary.totals.margem / salesSummary.totals.receita) * 100, 1)}%
                      </p>
                    )}
                  </div>
                </div>
                {salesSummary.rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Ainda não há vendas registradas para esta peça.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">Data</th>
                          <th className="px-2 py-1.5 font-medium">Origem</th>
                          <th className="px-2 py-1.5 text-right font-medium">Qtd</th>
                          <th className="px-2 py-1.5 text-right font-medium">Venda</th>
                          <th className="px-2 py-1.5 text-right font-medium">Gasto</th>
                          <th className="px-2 py-1.5 text-right font-medium">Lucro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesSummary.rows.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="px-2 py-1.5">{dateBR(r.date)}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{r.origem}</td>
                            <td className="px-2 py-1.5 text-right">{r.qty}</td>
                            <td className="px-2 py-1.5 text-right">{brl(r.receita)}</td>
                            <td className="px-2 py-1.5 text-right">{brl(r.gasto)}</td>
                            <td
                              className={`px-2 py-1.5 text-right font-medium ${r.margem < 0 ? "text-destructive" : ""}`}
                            >
                              {brl(r.margem)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}


            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={openDraftQuote}
              >
                <FileDown className="h-4 w-4" /> Gerar orçamento em PDF
              </Button>
              <Button
                className="w-full flex-1"
                onClick={submit}
                disabled={save.isPending || missingRequired.length > 0}
                title={
                  missingRequired.length
                    ? `Pendente: ${missingRequired.map((c) => c.label).join(", ")}`
                    : undefined
                }
              >
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              "Gerar orçamento em PDF" usa os dados já preenchidos acima (sem precisar salvar a
              peça no catálogo) e abre um orçamento avulso pronto para impressão em uma nova aba.
            </p>
          </FormModalBody>
        </FormModalContent>
      </FormModal>

      <AlertDialog open={!!pendingSave} onOpenChange={(o) => !o && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estoque insuficiente de filamento</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Salvar esta peça deixará o saldo negativo:</p>
                <ul className="space-y-1">
                  {(pendingSave?.shortages ?? []).map((s) => (
                    <li key={s.label} className="text-foreground">
                      <span className="font-medium">{s.label}</span> — faltam{" "}
                      {num(s.missing, 3)} {s.unit} (saldo final {num(s.resulting, 3)} {s.unit})
                    </li>
                  ))}
                </ul>
                <p>Deseja salvar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSave) persist(pendingSave.unitUse, pendingSave.nextUse, pendingSave.prevUse);
                setPendingSave(null);
              }}
            >
              Salvar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StockCategoryManager
        open={catManagerOpen}
        onOpenChange={setCatManagerOpen}
        usage={partCategoryUsage}
        kind="peca"
      />
    </div>

  );
}
