import * as React from "react";
import { Loader2 } from "lucide-react";

/**
 * Renderiza um PDF (ArrayBuffer) como imagens de páginas dentro de um container rolável.
 * Evita depender do visualizador nativo do navegador (que não existe em vários mobiles),
 * garantindo que nada seja cortado na pré-visualização.
 */
export function PdfCanvasViewer({ data, className }: { data: ArrayBuffer | null; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const outerRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");

  React.useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    setStatus("loading");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

        const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
        if (cancelled) return;
        container.innerHTML = "";

        const outerWidth = outerRef.current?.clientWidth ?? container.clientWidth;
        const availableWidth = Math.min(820, Math.max(320, outerWidth - 40));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = availableWidth / base.width;
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";
          canvas.className = "rounded-md border bg-white shadow-sm";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `Página ${i} do recibo`);

          const wrapper = document.createElement("div");
          wrapper.style.maxWidth = `${availableWidth}px`;
          wrapper.style.margin = "0 auto 16px";
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport } as never).promise;
        }
        if (!cancelled) setStatus("done");
      } catch (err) {
        console.error("[PdfCanvasViewer]", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div ref={outerRef} className={className}>
      {status !== "done" && (
        <div className="flex h-full items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          {status === "error" ? (
            "Não foi possível exibir a pré-visualização. Use “Baixar PDF”."
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Preparando pré-visualização...
            </>
          )}
        </div>
      )}
      <div ref={containerRef} className={status === "done" ? "" : "invisible h-0 overflow-hidden"} />
    </div>
  );
}
