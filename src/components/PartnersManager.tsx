import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Scale } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FormModal,
  FormModalBody,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
} from "@/components/ui/form-modal";
import type { Partner } from "@/lib/db";
import { equalShares } from "@/lib/partners";
import { num } from "@/lib/format";

type Draft = { id?: string; name: string; share_pct: string; active: boolean };

const toDraft = (p: Partner): Draft => ({
  id: p.id,
  name: p.name,
  share_pct: String(Number(p.share_pct)),
  active: p.active,
});

/** Cadastro dos sócios e do percentual de cada um na divisão do resultado. */
export function PartnersManager({
  open,
  onOpenChange,
  partners,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partners: Partner[];
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(
      partners.length
        ? partners.map(toDraft)
        : equalShares(3).map((pct, i) => ({
            name: `Sócio ${i + 1}`,
            share_pct: String(pct),
            active: true,
          })),
    );
  }, [open, partners]);

  const activeTotal =
    Math.round(
      rows.filter((r) => r.active).reduce((s, r) => s + (Number(r.share_pct) || 0), 0) * 1000,
    ) / 1000;

  const update = (i: number, patch: Partial<Draft>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const splitEqually = () => {
    const shares = equalShares(rows.filter((r) => r.active).length);
    let k = 0;
    setRows((prev) =>
      prev.map((r) =>
        r.active ? { ...r, share_pct: String(shares[k++]) } : { ...r, share_pct: "0" },
      ),
    );
  };

  const save = async () => {
    if (rows.some((r) => !r.name.trim())) return toast.error("Informe o nome de todos os sócios");
    if (Math.abs(activeTotal - 100) > 0.01)
      return toast.error(
        `Os percentuais dos sócios ativos somam ${num(activeTotal, 3)}%, precisam somar 100%`,
      );
    setSaving(true);
    try {
      for (const r of rows) {
        const values = {
          name: r.name.trim(),
          share_pct: Number(r.share_pct) || 0,
          active: r.active,
        };
        const { error } = r.id
          ? await supabase.from("partners").update(values).eq("id", r.id)
          : await supabase.from("partners").insert(values);
        if (error) throw new Error(error.message);
      }
      qc.invalidateQueries({ queryKey: ["partners"] });
      toast.success("Sócios salvos");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal open={open} onOpenChange={onOpenChange}>
      <FormModalContent>
        <FormModalHeader>
          <FormModalTitle>Sócios</FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          <p className="text-sm text-muted-foreground">
            O percentual define a parte de cada sócio no valor distribuído no fechamento do mês.
            Sócios inativos não participam da divisão, mas o histórico deles é mantido.
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_7rem_4rem] gap-2 text-xs font-medium text-muted-foreground">
              <span>Nome</span>
              <span>Percentual</span>
              <span className="text-center">Ativo</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id ?? `new-${i}`}
                className="grid grid-cols-[1fr_7rem_4rem] items-center gap-2"
              >
                <Input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  aria-label={`Nome do sócio ${i + 1}`}
                />
                <div className="relative">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={r.share_pct}
                    disabled={!r.active}
                    onChange={(e) => update(i, { share_pct: e.target.value })}
                    className="pr-7"
                    aria-label={`Percentual de ${r.name || `sócio ${i + 1}`}`}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={r.active}
                    onCheckedChange={(v) =>
                      update(i, { active: v, share_pct: v ? r.share_pct : "0" })
                    }
                    aria-label={`${r.name || `Sócio ${i + 1}`} ativo`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRows((prev) => [...prev, { name: "", share_pct: "0", active: true }])
                }
              >
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
              <Button variant="outline" size="sm" onClick={splitEqually}>
                <Scale className="h-4 w-4" /> Dividir igualmente
              </Button>
            </div>
            <span
              className={
                Math.abs(activeTotal - 100) > 0.01
                  ? "text-sm font-medium text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              Total: {num(activeTotal, 3)}%
            </span>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            Salvar sócios
          </Button>
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
