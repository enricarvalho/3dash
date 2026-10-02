import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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
          "company, contact_email, contact_phone, contact_instagram, contact_website, contact_address, pdf_footer_text",
        )
        .eq("id", auth.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });
}
