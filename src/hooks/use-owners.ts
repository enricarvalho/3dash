import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

type OwnerInfo = { id: string; name: string };

/**
 * Nomes dos usuários responsáveis pelos registros visíveis (owner_id).
 * As políticas de acesso limitam a leitura aos perfis permitidos.
 */
export function useOwners() {
  const { data } = useQuery({
    queryKey: ["profiles", "owners"],
    queryFn: async (): Promise<{ owners: OwnerInfo[]; currentId: string | null }> => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: rows } = await supabase.from("profiles").select("id, full_name");
      const email = auth.user?.email ?? null;
      const owners = (rows ?? []).map((r) => ({
        id: r.id,
        name: (r.full_name?.trim() || (r.id === auth.user?.id ? email : null) || "Usuário") as string,
      }));
      return { owners, currentId: auth.user?.id ?? null };
    },
    staleTime: 60_000,
  });

  const ownerName = (ownerId?: string | null) => {
    if (!ownerId) return "—";
    return data?.owners.find((o) => o.id === ownerId)?.name ?? "Usuário";
  };

  return { owners: data?.owners ?? [], currentUserId: data?.currentId ?? null, ownerName };
}
