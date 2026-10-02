import * as React from "react";
import { ExternalLink, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";
import { useReceiptData } from "@/lib/use-receipt-data";
import {
  buildSaleReceiptPdf,
  downloadSaleReceiptPdf,
  openSaleReceiptPdf,
  receiptFilename,
} from "@/lib/receipt-pdf";

type Props = {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Pré-visualização do recibo em PDF dentro de uma modal.
 * O PDF é renderizado em um iframe (blob) com rolagem própria,
 * então nenhuma informação é cortada — o documento é o mesmo do download.
 */
export function ReceiptModal({ saleId, open, onOpenChange }: Props) {
  const { data, isLoading, notFound } = useReceiptData(open ? saleId : null);
  const [buffer, setBuffer] = React.useState<ArrayBuffer | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!open || !data) {
      setBuffer(null);
      return;
    }
    try {
      setFailed(false);
      setBuffer(buildSaleReceiptPdf(data).output("arraybuffer"));
    } catch {
      setFailed(true);
    }
  }, [open, data]);

  const handleDownload = () => {
    if (!data) return;
    try {
      downloadSaleReceiptPdf(data);
      toast.success(`PDF gerado: ${receiptFilename(data)}`);
    } catch {
      toast.error("Não foi possível gerar o PDF do recibo.");
    }
  };

  const handleOpen = () => {
    if (!data) return;
    if (!openSaleReceiptPdf(data)) toast.error("Permita pop-ups neste site para abrir o PDF.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(96vw,60rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>Recibo {data ? `nº ${data.number}` : "da venda"}</DialogTitle>
          <DialogDescription>
            Pré-visualização do PDF oficial da 3D Create. Role o documento para ver todas as páginas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-muted/40">
          {isLoading && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando recibo...
            </div>
          )}
          {!isLoading && notFound && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Venda não encontrada.
            </div>
          )}
          {!isLoading && !notFound && buffer && !failed && (
            <PdfCanvasViewer data={buffer} className="h-full overflow-y-auto p-4" />
          )}
          {failed && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
              Não foi possível exibir a pré-visualização neste navegador.
              <Button onClick={handleOpen} variant="outline">
                <ExternalLink className="h-4 w-4" /> Abrir PDF em nova aba
              </Button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={handleOpen} disabled={!data}>
            <ExternalLink className="h-4 w-4" /> Abrir em nova aba
          </Button>
          <Button onClick={handleDownload} disabled={!data}>
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
