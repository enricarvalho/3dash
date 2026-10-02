import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FormModal,
  FormModalBody,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
} from "@/components/ui/form-modal";
import {
  deleteStockCategory,
  listStockCategories,
  saveStockCategory,
  type CategoryKind,
  type StockCategory,
} from "@/lib/stock-categories";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quantidade de itens por slug de categoria. */
  usage: Record<string, number>;
  kind?: CategoryKind;
};

export function StockCategoryManager({ open, onOpenChange, usage, kind = "estoque" }: Props) {
  const isParts = kind === "peca";
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ["stock_categories", kind],
    queryFn: () => listStockCategories(kind),
  });
  const [editing, setEditing] = useState<StockCategory | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  const reset = () => {
    setEditing(null);
    setName("");
    setActive(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stock_categories"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
    qc.invalidateQueries({ queryKey: ["parts"] });
  };

  const save = useMutation({
    mutationFn: () => saveStockCategory({ id: editing?.id, name, active, kind }),
    onSuccess: () => {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      reset();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (c: StockCategory) =>
      saveStockCategory({ id: c.id, name: c.name, active: !c.active, kind }),
    onSuccess: () => {
      toast.success("Situação da categoria atualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (c: StockCategory) => deleteStockCategory(c.id),
    onSuccess: () => {
      toast.success("Categoria excluída");
      reset();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = categories.data ?? [];

  return (
    <FormModal
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <FormModalContent>
        <FormModalHeader>
          <FormModalTitle>{isParts ? "Categorias de peças" : "Categorias do estoque"}</FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          <div className="rounded-xl border">
            {rows.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
            )}
            {rows.map((c) => {
              const used = usage[c.slug] ?? 0;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {used} {used === 1 ? "item" : "itens"} {isParts ? "no catálogo" : "no estoque"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={c.active ? "outline" : "secondary"}>
                      {c.active ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={c.active ? "Desativar" : "Reativar"}
                      aria-label={c.active ? "Desativar categoria" : "Reativar categoria"}
                      onClick={() => toggle.mutate(c)}
                    >
                      {c.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar categoria"
                      onClick={() => {
                        setEditing(c);
                        setName(c.name);
                        setActive(c.active);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir categoria"
                      onClick={() => {
                        if (used > 0) {
                          toast.error("Existem itens nessa categoria — desative-a em vez de excluir.");
                          return;
                        }
                        remove.mutate(c);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {editing ? `Editando "${editing.name}"` : "Nova categoria"}
            </p>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                placeholder={isParts ? "Ex.: Miniaturas" : "Ex.: Resinas"}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cat-active">Categoria ativa</Label>
              <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
                <Plus className="h-4 w-4" /> {editing ? "Salvar alterações" : "Criar categoria"}
              </Button>
              {editing && (
                <Button variant="outline" onClick={reset}>
                  Cancelar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Categorias inativas deixam de aparecer nos formulários, mas os itens já
              classificados continuam visíveis.
            </p>
          </div>
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
