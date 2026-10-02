import { Logo } from "@/components/Logo";
import { useCompanyProfile } from "@/hooks/use-company-profile";
import { companyName, footerText as resolveFooter } from "@/lib/brand";
import { dateBR } from "@/lib/format";

type Props = {
  subtitle?: string;
  meta?: string;
};

function escapeForCssContent(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function PrintHeader({ subtitle, meta }: Props) {
  const { data } = useCompanyProfile();

  const company = companyName(data?.company);
  const line1 = [data?.contact_email, data?.contact_phone].filter(Boolean).join(" · ");
  const line2 = [data?.contact_instagram, data?.contact_website].filter(Boolean).join(" · ");
  const address = data?.contact_address;
  const footerText = resolveFooter(data?.company, data?.pdf_footer_text);

  return (
    <>
      <style>{`@media print { @page { @bottom-left { content: "${escapeForCssContent(footerText)}"; } } }`}</style>
      <header className="mb-6 hidden items-start justify-between gap-6 border-b pb-4 print:flex">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight">{company}</p>
            <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
              {line1 && <p>{line1}</p>}
              {line2 && <p>{line2}</p>}
              {address && <p>{address}</p>}
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          {subtitle && <p className="text-sm font-semibold text-foreground">{subtitle}</p>}
          {meta && <p>{meta}</p>}
          <p>Emitido em {dateBR(new Date().toISOString())}</p>
        </div>
      </header>
    </>
  );
}


/** Nota impressa ao final dos orçamentos. */
export function QuoteValidityNote() {
  const { data } = useCompanyProfile();
  return (
    <p className="mt-4 hidden text-xs text-muted-foreground print:block">
      {companyName(data?.company)} — orçamento válido por 15 dias.
    </p>
  );
}
