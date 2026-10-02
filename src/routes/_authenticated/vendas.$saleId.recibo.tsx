import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FileDown } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/PageHeader";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { Button } from "@/components/ui/button";
import { useReceiptData } from "@/lib/use-receipt-data";
import {
  buildSaleReceiptPdf,
  downloadSaleReceiptPdf,
  openSaleReceiptPdf,
  receiptFilename,
} from "@/lib/receipt-pdf";

export const Route = createFileRoute("/_authenticated/vendas/$saleId/recibo")({
  head: () => ({
    meta: [
      { title: "Recibo de venda · 3D Create" },
      { name: "description", content: "Recibo da venda com itens, valores e dados do cliente." },
      { property: "og:title", content: "Recibo de venda · 3D Create" },
      { property: "og:description", content: "Recibo da venda com itens, valores e dados do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceiptPage,
  notFoundComponent: () => <EmptyState message="Venda não encontrada." />,
});

function ReceiptPage() {
  const { saleId } = Route.useParams();
  const { data, isLoading, notFound } = useReceiptData(saleId);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    if (!data) return;
    try {
      setBuffer(buildSaleReceiptPdf(data).output("arraybuffer"));
    } catch {
      toast.error("Não foi possível gerar o recibo.");
    }
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando recibo...</p>;
  if (notFound || !data) return <EmptyState message="Venda não encontrada." />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link to="/vendas">
            <ArrowLeft className="h-4 w-4" /> Voltar para Vendas
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!openSaleReceiptPdf(data)) toast.error("Permita pop-ups para abrir o PDF.");
            }}
          >
            <ExternalLink className="h-4 w-4" /> Abrir em nova aba
          </Button>
          <Button
            onClick={() => {
              downloadSaleReceiptPdf(data);
              toast.success(`PDF gerado: ${receiptFilename(data)}`);
            }}
          >
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      </div>

      <h1 className="sr-only">Recibo nº {data.number}</h1>
      <div className="rounded-xl border bg-muted/40 p-4">
        <PdfCanvasViewer data={buffer} />
      </div>
    </div>
  );
}
