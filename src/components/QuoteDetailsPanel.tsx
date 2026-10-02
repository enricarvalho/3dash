import { useQuery } from "@tanstack/react-query";

import { PartImage } from "@/components/PartImage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listCustomers, listQuoteItems, type Quote } from "@/lib/db";
import { brl, dateBR, minutesToHuman } from "@/lib/format";

/** Detalhamento completo (somente leitura) de um orçamento, para uso em modais. */
export function QuoteDetailsPanel({ quote }: { quote: Quote }) {
  const items = useQuery({
    queryKey: ["quote_items", quote.id],
    queryFn: () => listQuoteItems(quote.id),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const customer = customers.data?.find((c) => c.id === quote.customer_id) ?? null;
  const rows = items.data ?? [];
  const total = rows.reduce((acc, i) => acc + Number(i.quantity) * Number(i.unit_price), 0);
  const minutes = rows.reduce((acc, i) => acc + Number(i.print_minutes) * Number(i.quantity), 0);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
          {customer ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{customer.name}</p>
              {customer.doc_number ? (
                <p className="text-muted-foreground">{customer.doc_number}</p>
              ) : null}
              {customer.phone ? <p className="text-muted-foreground">{customer.phone}</p> : null}
              {customer.email ? <p className="text-muted-foreground">{customer.email}</p> : null}
              {customer.city ? (
                <p className="text-muted-foreground">
                  {[customer.street, customer.number, customer.district].filter(Boolean).join(", ")}
                  {customer.street ? " — " : ""}
                  {customer.city}
                  {customer.state ? `/${customer.state}` : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem cliente vinculado</p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Resumo</p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Itens: </span>
              {rows.length}
            </p>
            <p>
              <span className="text-muted-foreground">Tempo de impressão: </span>
              {minutesToHuman(minutes)}
            </p>
            <p>
              <span className="text-muted-foreground">Criado em: </span>
              {dateBR(quote.created_at)}
            </p>
            <p className="text-base font-semibold">Total: {brl(total || Number(quote.total))}</p>
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Itens</p>
        {items.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando itens…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item lançado neste orçamento.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      {i.image_url ? (
                        <PartImage
                          src={i.image_url}
                          alt={i.description}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {i.description}
                        {(i as { kind?: string }).kind === "servico" ? (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Serviço
                          </span>
                        ) : null}
                      </p>
                      {i.print_minutes ? (
                        <p className="text-xs text-muted-foreground">
                          {minutesToHuman(Number(i.print_minutes))} por unidade
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="text-right">{brl(Number(i.unit_price))}</TableCell>
                    <TableCell className="text-right font-medium">
                      {brl(Number(i.quantity) * Number(i.unit_price))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {quote.notes ? (
        <section>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Observações</p>
          <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">
            {quote.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
