import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { loadPdfLogo } from "@/lib/company-logo";

/** Dados de contato da empresa (Configurações), usados em cabeçalhos e PDFs. */
export function useCompanyProfile() {
  return useQuery({
    queryKey: ["profiles", "me", "contact"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "company, logo_url, contact_email, contact_phone, contact_instagram, contact_website, contact_address, pdf_footer_text",
        )
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}

/** Logo da empresa já convertida para o jsPDF (null quando não há logo ou ela não carrega). */
export function useCompanyPdfLogo() {
  const profile = useCompanyProfile();
  const url = profile.data?.logo_url ?? null;
  const logo = useQuery({
    queryKey: ["company-logo-pdf", url],
    queryFn: () => loadPdfLogo(url!).catch(() => null),
    enabled: !!url,
    staleTime: Infinity,
  });
  return {
    data: url ? (logo.data ?? null) : null,
    isLoading: profile.isLoading || (!!url && logo.isLoading),
  };
}
