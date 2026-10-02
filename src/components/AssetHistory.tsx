import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, Trash2, Wrench, MoveRight, Wallet, Scale, StickyNote } from "lucide-react";
import { toast } from "sonner";

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
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import { supabase } from "@/integrations/supabase/client";
import { listAssetEvents, type Asset } from "@/lib/db";
import { brl, dateBR, num } from "@/lib/format";
import { ASSET_EVENT_KINDS, ASSET_EVENT_KIND_LABEL } from "@/lib/domain";

const KIND_ICON: Record<string, React.ReactNode> = {
  manutencao: <Wrench className="h-4 w-4" />,
  movimentacao: <MoveRight className="h-4 w-4" />,
  custo: <Wallet className="h-4 w-4" />,
  ajuste: <Scale className="h-4 w-4" />,
  nota: <StickyNote className="h-4 w-4" />,
};

const emptyEvent = () => ({
  kind: "manutencao",
  event_date: new Date().toISOString().slice(0, 10),
  description: "",
  cost: "0",
  quantity_delta: "0",
  location: "",
  notes: "",
});

export function AssetHistoryModal({
  asset,
  onOpenChange,
}: {
  asset: Asset | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyEvent());

  const events = useQuery({
    queryKey: ["asset_events", asset?.id],
    queryFn: () => listAssetEvents(asset!.id),
    enabled: !!asset,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      if (!form.description.trim()) throw new Error("Descreva o que aconteceu");
      const delta = Number(form.quantity_delta) || 0;
      const { error } = await supabase.from("asset_events").insert({
        asset_id: asset.id,
        kind: form.kind,
        event_date: form.event_date,
        description: form.description.trim(),
        cost: Number(form.cost) || 0,
        quantity_delta: delta,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw new Error(error.message);

      // ajustes e movimentações podem alterar o saldo e o local do item
      const patch: { quantity?: number; location?: string } = {};
      if (delta !== 0) patch.quantity = Math.max(Number(asset.quantity) + delta, 0);
      if (form.location.trim() && form.kind === "movimentacao") patch.location = form.location.trim();
      if (Object.keys(patch).length) {
        const { error: upErr } = await supabase.from("assets").update(patch).eq("id", asset.id);
        if (upErr) throw new Error(upErr.message);
      }

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset_events", asset?.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      setForm(emptyEvent());
      toast.success("Registro adicionado ao histórico");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (ev: { id: string; quantity_delta: number }) => {
      const { error } = await supabase.from("asset_events").delete().eq("id", ev.id);
      if (error) throw new Error(error.message);
      if (asset && Number(ev.quantity_delta) !== 0) {
        await supabase
          .from("assets")
          .update({ quantity: Math.max(Number(asset.quantity) - Number(ev.quantity_delta), 0) })
          .eq("id", asset.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset_events", asset?.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Registro removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = events.data ?? [];
  const totalCost = list.reduce((s, e) => s + Number(e.cost), 0);

  return (
    <FormModal open={!!asset} onOpenChange={onOpenChange}>
      <FormModalContent className="max-w-3xl">
        <FormModalHeader>
          <FormModalTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico · {asset?.name}
          </FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          <div className="mb-4 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-muted-foreground">Registros</div>
                <div className="font-medium">{list.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Custo acumulado</div>
                <div className="font-medium">{brl(totalCost)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Saldo atual</div>
                <div className="font-medium">{num(Number(asset?.quantity ?? 0), 0)} un.</div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-kind">Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger id="ev-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_EVENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ASSET_EVENT_KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Data</Label>
              <Input
                id="ev-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-desc">Descrição</Label>
              <Input
                id="ev-desc"
                placeholder="Ex.: troca do bico da impressora"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-cost">Custo (R$)</Label>
              <Input
                id="ev-cost"
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-qty">Ajuste de quantidade</Label>
              <Input
                id="ev-qty"
                type="number"
                step="1"
                value={form.quantity_delta}
                onChange={(e) => setForm({ ...form, quantity_delta: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use valores negativos para dar baixa. 0 mantém o saldo.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-loc">Local / destino</Label>
              <Input
                id="ev-loc"
                placeholder="Ex.: Bancada 2"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-notes">Observações</Label>
              <Textarea
                id="ev-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button onClick={() => add.mutate()} disabled={add.isPending}>
                <Plus className="h-4 w-4" /> Adicionar ao histórico
              </Button>
            </div>
          </div>

          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum registro no histórico deste item ainda.
            </p>
          ) : (
            <ol className="space-y-3">
              {list.map((e) => (
                <li key={e.id} className="flex gap-3 rounded-lg border p-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {KIND_ICON[e.kind] ?? <StickyNote className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{ASSET_EVENT_KIND_LABEL[e.kind] ?? e.kind}</Badge>
                      <span className="text-xs text-muted-foreground">{dateBR(e.event_date)}</span>
                      {Number(e.cost) !== 0 && (
                        <span className="text-xs font-medium">{brl(Number(e.cost))}</span>
                      )}
                      {Number(e.quantity_delta) !== 0 && (
                        <span className="text-xs text-muted-foreground">
                          {Number(e.quantity_delta) > 0 ? "+" : ""}
                          {num(Number(e.quantity_delta), 0)} un.
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-medium">{e.description}</div>
                    {(e.location || e.notes) && (
                      <div className="text-xs text-muted-foreground">
                        {e.location ? `Local: ${e.location}` : ""}
                        {e.location && e.notes ? " · " : ""}
                        {e.notes ?? ""}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir registro"
                    onClick={() =>
                      remove.mutate({ id: e.id, quantity_delta: Number(e.quantity_delta) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
