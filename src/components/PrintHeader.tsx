import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { dateBR } from "@/lib/format";

type Props = {
  subtitle?: string;
  meta?: string;
};

const DEFAULT_FOOTER = "3D Create · Impressão 3D · Goiânia/GO";

function escapeForCssContent(input: string) {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function PrintHeader({ subtitle, meta }: Props) {
  const { data } = useQuery({
    queryKey: ["profiles", "me", "contact"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company, contact_email, contact_phone, contact_instagram, contact_website, contact_address, pdf_footer_text")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const company = data?.company || "3D Create";
  const line1 = [data?.contact_email, data?.contact_phone].filter(Boolean).join(" · ");
  const line2 = [data?.contact_instagram, data?.contact_website].filter(Boolean).join(" · ");
  const address = data?.contact_address;
  const footerText = (data?.pdf_footer_text?.trim() || DEFAULT_FOOTER);

  return (
    <>
      <style>{`@media print { @page { @bottom-left { content: "${escapeForCssContent(footerText)}"; } } }`}</style>
      <header className="mb-6 hidden items-start justify-between gap-6 border-b pb-4 print:flex">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div className="leading-tight">
            <p className="text-lg font-extrabold tracking-tight">{company}</p>
            <p className="text-[11px] text-muted-foreground">Impressão 3D · Goiânia/GO</p>
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

