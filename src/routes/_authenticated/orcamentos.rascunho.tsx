import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileDown, Info } from "lucide-react";
import { z } from "zod";

import { EmptyState, PageHeader, StatCard } from "@/components/PageHeader";
import { PartImage } from "@/components/PartImage";
import { PrintHeader, QuoteValidityNote } from "@/components/PrintHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { brl, minutesToHuman } from "@/lib/format";
import { pageTitle } from "@/lib/brand";

const draftSearchSchema = z.object({
  name: z.string().catch(""),
  imageUrl: z.string().nullable().catch(null),
  quantity: z.coerce.number().catch(1),
  unitPrice: z.coerce.number().catch(0),
  printMinutes: z.coerce.number().catch(0),
  notes: z.string().catch(""),
});

export const Route = createFileRoute("/_authenticated/orcamentos/rascunho")({
  validateSearch: (s: Record<string, unknown>) => draftSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: pageTitle("Orçamento avulso") },
      {
        name: "description",
        content: "Orçamento em PDF gerado a partir do cadastro de uma peça, sem salvar no catálogo.",
      },
    ],
  }),
  component: DraftQuotePage,
});

function DraftQuotePage() {
  const search = Route.useSearch();
  const hasData = !!search.name.trim();

  const [itemName, setItemName] = useState(search.name);
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [quantity, setQuantity] = useState(String(search.quantity || 1));
  const [unitPrice, setUnitPrice] = useState(String(search.unitPrice || 0));
  const [notes, setNotes] = useState(search.notes ?? "");

  // Nomeia a aba (e, por consequência, o PDF ao "Salvar como PDF") com o nome do cliente.
  useEffect(() => {
    const original = document.title;
    document.title = ["Orçamento avulso", itemName, clientName].filter((p) => p?.trim()).join(" - ");
    return () => {
      document.title = original;
    };
  }, [itemName, clientName]);

  if (!hasData) {
    return (
      <EmptyState message='Nenhum dado recebido. Volte para o cadastro de peças e clique em "Gerar orçamento em PDF".' />
    );
  }

  const qty = Math.max(Number(quantity) || 0, 0);
  const price = Math.max(Number(unitPrice) || 0, 0);
  const total = qty * price;
  const totalMinutes = qty * (Number(search.printMinutes) || 0);

  return (
    <div className="print:p-6">
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link to="/pecas">
            <ArrowLeft className="h-4 w-4" /> Voltar para Peças
          </Link>
        </Button>
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            Orçamento avulso gerado a partir dos dados do cadastro da peça — nada aqui foi salvo no
            sistema. Para acompanhar status, cliente e histórico deste orçamento, cadastre a peça no
            catálogo e crie um orçamento normal em Orçamentos.
          </p>
        </div>
      </div>

      <PrintHeader subtitle={`Orçamento · ${itemName || "Item avulso"}`} meta={clientName || undefined} />

      <PageHeader
        title={itemName || "Orçamento avulso"}
        description="Orçamento avulso — não vinculado ao catálogo de peças"
        actions={
          <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
            <FileDown className="h-4 w-4" /> Gerar PDF
          </Button>
        }
      />

      <div className="mt-4 grid gap-3 rounded-xl border bg-card p-4 print:hidden sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Descrição do item</Label>
          <Input value={itemName} onChange={(e) => setItemName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cliente (opcional)</Label>
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nome do cliente"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contato do cliente (opcional)</Label>
          <Input
            value={clientContact}
            onChange={(e) => setClientContact(e.target.value)}
            placeholder="Telefone ou e-mail"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Quantidade</Label>
            <Input
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Valor unitário (R$)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>
        </div>
      </div>

      {(clientName || clientContact) && (
        <p className="mt-2 hidden text-sm print:block">
          Cliente: {clientName}
          {clientContact ? ` · ${clientContact}` : ""}
        </p>
      )}

      <div className="print-grid-2 mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard accent label="Valor total" value={brl(total)} />
        <StatCard label="Tempo estimado" value={minutesToHuman(totalMinutes)} />
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4 print:border-0 print:bg-transparent print:p-0">
        <p className="text-xs text-muted-foreground print:hidden">Observações</p>
        {notes.trim() && (
          <p className="mt-2 hidden whitespace-pre-wrap text-sm leading-relaxed print:block">
            {notes}
          </p>
        )}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observações do orçamento..."
          className="mt-1 min-h-[100px] resize-y border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 print:hidden"
        />
      </div>

      <div className="mt-4 rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Valor un.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                <div className="flex items-center gap-3">
                  {search.imageUrl && (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                      <PartImage
                        src={search.imageUrl}
                        alt={itemName}
                        variant="thumb"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    {itemName || "Item avulso"}
                    <span className="block text-xs text-muted-foreground">
                      {minutesToHuman(Number(search.printMinutes) || 0)} por unidade
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">{qty}</TableCell>
              <TableCell className="text-right">{brl(price)}</TableCell>
              <TableCell className="text-right font-medium">{brl(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">Total do orçamento</span>
          <span className="text-lg font-bold">{brl(total)}</span>
        </div>
      </div>

      <QuoteValidityNote />
    </div>
  );
}
