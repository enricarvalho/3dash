import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, IdCard, MapPin } from "lucide-react";

import { PageHeader, StatCard, EmptyState } from "@/components/PageHeader";
import { formatAddress } from "@/lib/br-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerPurchases } from "@/components/CustomerPurchases";
import { getCustomer, listQuotes, listSaleItems, listSales, listTransactions } from "@/lib/db";
import { customerLtv, itemsBySaleId } from "@/lib/ltv";
import { brl, dateBR } from "@/lib/format";
import { QUOTE_STATUS_LABEL } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/clientes/$customerId")({
  head: () => ({
    meta: [
      { title: "Cliente · 3D Create" },
      { name: "description", content: "LTV, compras, orçamentos e pagamentos do cliente." },
    ],
  }),
  component: CustomerDetail,
  errorComponent: DetailError,
  notFoundComponent: () => <EmptyState message="Cliente não encontrado." />,
});

function DetailError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Não foi possível carregar o cliente: {message}</p>
      <Button
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const customer = useQuery({
    queryKey: ["customers", customerId],
    queryFn: () => getCustomer(customerId),
  });
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: listQuotes });
  const tx = useQuery({ queryKey: ["transactions"], queryFn: listTransactions });
  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const saleItems = useQuery({ queryKey: ["sale_items"], queryFn: () => listSaleItems() });

  const myQuotes = (quotes.data ?? []).filter((q) => q.customer_id === customerId);
  const myTx = (tx.data ?? []).filter((t) => t.customer_id === customerId);
  const received = myTx
    .filter((t) => t.kind === "entrada")
    .reduce((s, t) => s + Number(t.amount), 0);

  if (!customer.data) return <EmptyState message="Carregando cliente..." />;

  const ltv = customerLtv(
    customer.data,
    sales.data ?? [],
    itemsBySaleId(saleItems.data ?? []),
  );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/clientes">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={customer.data.name}
        description={customer.data.kind === "empresa" ? "Empresa" : "Pessoa física"}
        actions={<Badge variant="secondary">{customer.data.status}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          accent
          label="LTV"
          value={brl(ltv.ltv)}
          hint={ltv.pending > 0 ? `${brl(ltv.pending)} pendente` : `Total recebido ${brl(received)}`}
        />
        <StatCard
          label="Compras fechadas"
          value={String(ltv.orders)}
          hint={
            ltv.firstPurchase ? `Cliente desde ${dateBR(ltv.firstPurchase)}` : "Nenhuma compra ainda"
          }
        />
        <StatCard
          label="Ticket médio"
          value={brl(ltv.avgTicket)}
          hint={
            ltv.avgDaysBetween !== null
              ? `Compra a cada ${ltv.avgDaysBetween} dia${ltv.avgDaysBetween === 1 ? "" : "s"}`
              : undefined
          }
        />
        <StatCard
          label="Orçamentos"
          value={String(myQuotes.length)}
          hint={`${brl(myQuotes.reduce((s, q) => s + Number(q.total), 0))} orçados`}
        />
      </div>

      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Compras fechadas</h2>
          {ltv.lastPurchase && (
            <span className="text-xs text-muted-foreground">
              Última compra em {dateBR(ltv.lastPurchase)} (há {ltv.daysSinceLast} dia
              {ltv.daysSinceLast === 1 ? "" : "s"})
            </span>
          )}
        </div>
        <CustomerPurchases purchases={ltv.purchases} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Contato</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {customer.data.phone ? (
                <a href={`tel:${customer.data.phone.replace(/\D/g, "")}`} className="hover:underline">
                  {customer.data.phone}
                </a>
              ) : (
                "—"
              )}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {customer.data.email ? (
                <a href={`mailto:${customer.data.email}`} className="break-all hover:underline">
                  {customer.data.email}
                </a>
              ) : (
                "—"
              )}
            </p>
            {customer.data.legal_name && (
              <p className="text-xs text-muted-foreground">
                Razão social: {customer.data.legal_name}
              </p>
            )}
            {customer.data.doc_number && (
              <p className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-muted-foreground" /> {customer.data.doc_number}
              </p>
            )}
            {formatAddress(customer.data) && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{formatAddress(customer.data)}</span>
              </p>
            )}
            {customer.data.notes && (
              <p className="rounded-lg bg-muted p-2 text-muted-foreground">{customer.data.notes}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card lg:col-span-2">
          <h2 className="p-4 text-sm font-semibold">Orçamentos</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myQuotes.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link
                      to="/orcamentos/$quoteId"
                      params={{ quoteId: q.id }}
                      className="font-medium hover:underline"
                    >
                      {q.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{QUOTE_STATUS_LABEL[q.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dateBR(q.created_at)}</TableCell>
                  <TableCell className="text-right">{brl(Number(q.total))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {myQuotes.length === 0 && <EmptyState message="Nenhum orçamento para este cliente." />}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card">
        <h2 className="p-4 text-sm font-semibold">Pagamentos e lançamentos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myTx.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{dateBR(t.occurred_on)}</TableCell>
                <TableCell className="font-medium">{t.description}</TableCell>
                <TableCell>
                  <Badge variant={t.kind === "entrada" ? "default" : "secondary"}>{t.kind}</Badge>
                </TableCell>
                <TableCell className="text-right">{brl(Number(t.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {myTx.length === 0 && <EmptyState message="Nenhum lançamento vinculado." />}
      </div>
    </div>
  );
}
