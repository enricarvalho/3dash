import { useQuery } from "@tanstack/react-query";
import { Package, Pencil, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OwnerTag } from "@/components/OwnerTag";
import { SaleAuditLog } from "@/components/SaleAuditLog";
import {
  FormModal,
  FormModalContent,
  FormModalHeader,
  FormModalTitle,
  FormModalBody,
} from "@/components/ui/form-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAssets, listSaleItems, type Sale } from "@/lib/db";
import { brl, dateBR, num } from "@/lib/format";
import { qtyByPart } from "@/lib/inventory";
import { PAYMENT_METHOD_LABEL, SALE_STATUS_LABEL } from "@/lib/domain";

export function SaleDetailsModal({
  sale,
  customerName,
  customerContact = "",
  onClose,
  onEdit,
  onShowReceipt,
}: {
  sale: Sale | null;
  customerName: string;
  customerContact?: string;
  onClose: () => void;
  onEdit: (sale: Sale) => void;
  onShowReceipt?: (sale: Sale) => void;
}) {
  const items = useQuery({
    queryKey: ["sale_items", sale?.id],
    queryFn: () => listSaleItems(sale!.id),
    enabled: !!sale,
  });
  const assets = useQuery({ queryKey: ["assets"], queryFn: listAssets, enabled: !!sale });

  const list = items.data ?? [];
  const consumed = qtyByPart(list);
  const profit = sale ? Number(sale.total) - Number(sale.cost_total) : 0;

  return (
    <FormModal open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <FormModalContent className="max-w-3xl">
        <FormModalHeader>
          <FormModalTitle>Detalhes da venda</FormModalTitle>
        </FormModalHeader>
        <FormModalBody>
          {sale && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{customerName}</p>
                  {customerContact && (
                    <p className="text-sm text-muted-foreground">{customerContact}</p>
                  )}

                  <OwnerTag ownerId={sale.owner_id} />
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Data e pagamento</p>
                  <p className="font-medium">{dateBR(sale.sale_date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {sale.payment_method
                      ? (PAYMENT_METHOD_LABEL[sale.payment_method] ?? sale.payment_method)
                      : "—"}{" "}
                    ·{" "}
                    <Badge variant={sale.status === "pago" ? "default" : "secondary"}>
                      {SALE_STATUS_LABEL[sale.status] ?? sale.status}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i.image_url && (
                              <img
                                src={i.image_url}
                                alt={i.description}
                                className="h-9 w-9 rounded object-cover"
                              />
                            )}
                            <span className="font-medium">{i.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{num(Number(i.quantity), 0)}</TableCell>
                        <TableCell className="text-right">{brl(Number(i.unit_price))}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {brl(Number(i.unit_cost))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {brl(Number(i.quantity) * Number(i.unit_price))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!list.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          {items.isLoading ? "Carregando itens..." : "Nenhum item nesta venda."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="font-medium">{brl(Number(sale.discount))}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">{brl(Number(sale.total))}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Gasto</p>
                  <p className="font-medium">{brl(Number(sale.cost_total))}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Lucro</p>
                  <p className={`font-medium ${profit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {brl(profit)}
                    {Number(sale.total) > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({num((profit / Number(sale.total)) * 100, 1)}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" /> Baixa no Inventário
                </p>
                {Object.keys(consumed).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item vinculado ao cadastro de peças — sem baixa no inventário.
                  </p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {Object.entries(consumed).map(([partId, qty]) => {
                      const asset = (assets.data ?? []).find(
                        (a) => a.category === "peca_pronta" && a.part_id === partId,
                      );
                      const name =
                        list.find((i) => i.part_id === partId)?.description ?? "Peça";
                      return (
                        <li key={partId} className="flex items-center justify-between gap-2">
                          <span>
                            {name} · <span className="text-muted-foreground">-{num(qty, 0)} un.</span>
                          </span>
                          <span className="text-muted-foreground">
                            {asset
                              ? `saldo atual: ${num(Number(asset.quantity), 0)} un.`
                              : "sem item no inventário"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {sale.notes && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="whitespace-pre-wrap text-sm">{sale.notes}</p>
                </div>
              )}

              <SaleAuditLog saleId={sale.id} />


              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onShowReceipt?.(sale);
                  }}
                >
                  <Receipt className="h-4 w-4" /> Ver recibo
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    onEdit(sale);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Editar venda
                </Button>
              </div>
            </div>
          )}
        </FormModalBody>
      </FormModalContent>
    </FormModal>
  );
}
