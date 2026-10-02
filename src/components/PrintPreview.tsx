import { Logo } from "@/components/Logo";
import { dateBR } from "@/lib/format";

type ContactData = {
  company?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_instagram?: string;
  contact_website?: string;
  contact_address?: string;
  pdf_footer_text?: string;

};

type Props = {
  data: ContactData;
  subtitle?: string;
  meta?: string;
};

export function PrintPreview({ data, subtitle = "Orçamento #0001", meta = "Cliente exemplo" }: Props) {
  const company = data.company || "3D Create";
  const line1 = [data.contact_email, data.contact_phone].filter(Boolean).join(" · ");
  const line2 = [data.contact_instagram, data.contact_website].filter(Boolean).join(" · ");
  const address = data.contact_address;
  const footerText = data.pdf_footer_text?.trim() || `${company} · Impressão 3D · Goiânia/GO`;


  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Pré-visualização do PDF (A4)
      </p>
      <div
        className="mx-auto flex flex-col bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
        style={{ aspectRatio: "210 / 297", width: "100%", maxWidth: 360 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <div className="leading-tight">
              <p className="text-[11px] font-extrabold tracking-tight">{company}</p>
              <p className="text-[7px] text-slate-500">Impressão 3D · Goiânia/GO</p>
              <div className="mt-0.5 space-y-[1px] text-[6px] text-slate-500">
                {line1 && <p>{line1}</p>}
                {line2 && <p>{line2}</p>}
                {address && <p>{address}</p>}
              </div>
            </div>
          </div>
          <div className="text-right text-[6px] text-slate-500">
            <p className="text-[8px] font-semibold text-slate-900">{subtitle}</p>
            <p>{meta}</p>
            <p>Emitido em {dateBR(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Body placeholder */}
        <div className="flex-1 space-y-1.5 px-4 py-4">
          <div className="h-1.5 w-2/3 rounded bg-slate-200" />
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-5/6 rounded bg-slate-100" />
          <div className="mt-3 h-16 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-1/2 rounded bg-slate-200" />
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-4/6 rounded bg-slate-100" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-[6px] text-slate-500">
          <span className="line-clamp-2 whitespace-pre-line">{footerText}</span>

          <span>Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
}
