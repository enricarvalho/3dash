import { supabase } from "@/integrations/supabase/client";

export type CategoryKind = "estoque" | "peca";

export type StockCategory = {
  id: string;
  owner_id: string;
  kind: CategoryKind;
  slug: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_STOCK_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "material", name: "Materiais" },
  { slug: "embalagem", name: "Embalagem" },
  { slug: "ferramenta", name: "Ferramenta" },
  { slug: "acessorio", name: "Acessório" },
  { slug: "outro", name: "Outro" },
];

export const DEFAULT_PART_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "personalizado", name: "Personalizado" },
  { slug: "prototipo", name: "Protótipo" },
  { slug: "decoracao", name: "Decoração" },
  { slug: "peca_tecnica", name: "Peça técnica" },
];

export function defaultsFor(kind: CategoryKind) {
  return kind === "peca" ? DEFAULT_PART_CATEGORIES : DEFAULT_STOCK_CATEGORIES;
}

/** Slug da categoria usada no cálculo das peças (filamentos e insumos). */
export const PRODUCTION_CATEGORY = "material";

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function listStockCategories(
  kind: CategoryKind = "estoque",
): Promise<StockCategory[]> {
  const { data, error } = await supabase
    .from("stock_categories")
    .select("*")
    .eq("kind", kind)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as StockCategory[];
  if (rows.length === 0) return seedDefaults(kind);
  return rows;
}

async function seedDefaults(kind: CategoryKind): Promise<StockCategory[]> {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from("stock_categories")
    .upsert(
      defaultsFor(kind).map((c) => ({ ...c, kind, owner_id: ownerId })),
      { onConflict: "owner_id,kind,slug" },
    )
    .select();
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as StockCategory[]).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveStockCategory(input: {
  id?: string;
  name: string;
  active: boolean;
  kind?: CategoryKind;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Informe o nome da categoria");
  if (input.id) {
    const { error } = await supabase
      .from("stock_categories")
      .update({ name, active: input.active })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("Sessão expirada");
  const slug = slugify(name);
  if (!slug) throw new Error("Nome de categoria inválido");
  const { error } = await supabase
    .from("stock_categories")
    .insert({ owner_id: ownerId, kind: input.kind ?? "estoque", slug, name, active: input.active });
  if (error) {
    throw new Error(
      error.code === "23505" ? "Já existe uma categoria com esse nome" : error.message,
    );
  }
}

export async function deleteStockCategory(id: string) {
  const { error } = await supabase.from("stock_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function categoryLabel(categories: StockCategory[], slug: string | null | undefined) {
  const key = slug ?? PRODUCTION_CATEGORY;
  return (
    categories.find((c) => c.slug === key)?.name ??
    DEFAULT_STOCK_CATEGORIES.find((c) => c.slug === key)?.name ??
    DEFAULT_PART_CATEGORIES.find((c) => c.slug === key)?.name ??
    key
  );
}
