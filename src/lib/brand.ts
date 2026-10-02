// Identidade padrão do produto (white label). Os dados da empresa de cada
// cliente vêm de `profiles` (Configurações); estes valores são só o fallback.

export const BRAND = {
  appName: "Painel operacional",
  appTagline: "Produção e gestão",
  defaultCompany: "Sua empresa",
  /** Gradiente dos PDFs — manter em sincronia com --brand / --brand-2 em styles.css. */
  pdfFrom: [75, 75, 255] as const,
  pdfTo: [155, 77, 255] as const,
};

/** Título de página no padrão "Seção · Nome do app". */
export const pageTitle = (section: string) => `${section} · ${BRAND.appName}`;

export const companyName = (company?: string | null) => company?.trim() || BRAND.defaultCompany;

/** Rodapé dos documentos impressos quando a empresa não definiu um texto próprio. */
export const footerText = (company?: string | null, custom?: string | null) =>
  custom?.trim() || companyName(company);
