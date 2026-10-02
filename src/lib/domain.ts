export const MATERIAL_TYPES = ["PLA", "ABS", "PETG", "TPU", "RESINA", "OUTRO"] as const;

/** Classificação do item no estoque. Só "material" entra no cálculo das peças. */
export const STOCK_CATEGORIES = ["material", "embalagem", "ferramenta", "acessorio", "outro"] as const;
export const STOCK_CATEGORY_LABEL: Record<string, string> = {
  material: "Materiais",
  embalagem: "Embalagem",
  ferramenta: "Ferramenta",
  acessorio: "Acessório",
  outro: "Outro",
};


export const QUOTE_STATUSES = [
  "rascunho",
  "enviado",
  "aprovado",
  "recusado",
  "em_producao",
  "concluido",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  em_producao: "Em produção",
  concluido: "Concluído",
};

export const PART_CATEGORIES = ["personalizado", "prototipo", "decoracao", "peca_tecnica"] as const;
export const PART_CATEGORY_LABEL: Record<string, string> = {
  personalizado: "Personalizado",
  prototipo: "Protótipo",
  decoracao: "Decoração",
  peca_tecnica: "Peça técnica",
};

export const CUSTOMER_STATUSES = ["lead", "ativo", "recorrente", "inativo"] as const;
export const MOVEMENT_REASONS = ["compra", "producao", "ajuste", "perda"] as const;
export const MOVEMENT_REASON_LABEL: Record<string, string> = {
  compra: "Compra",
  producao: "Uso em produção",
  ajuste: "Ajuste",
  perda: "Perda",
};

export const INCOME_CATEGORIES = ["venda", "servico", "outros"] as const;
/** Categorias de saída disponíveis no lançamento manual. */
export const EXPENSE_CATEGORIES = [
  "material",
  "manutencao",
  "energia",
  "impostos",
  "investimento",
  "outros",
] as const;
/**
 * Categorias de saída geradas pelo sistema (não aparecem no lançamento manual):
 * custo do orçamento, retiradas e distribuição de lucro aos sócios.
 */
export const SYSTEM_EXPENSE_CATEGORIES = [
  "custo",
  "retirada_socio",
  "distribuicao_lucro",
  "quebra_caixa",
] as const;
/** Entradas geradas pelo sistema (sobra apurada no fechamento de caixa). */
export const SYSTEM_INCOME_CATEGORIES = ["sobra_caixa"] as const;
/** Saídas que são dos sócios, não gasto da empresa. */
export const PARTNER_CATEGORIES = ["retirada_socio", "distribuicao_lucro"];

export const TRANSACTION_CATEGORY_LABEL: Record<string, string> = {
  venda: "Venda",
  servico: "Serviço",
  outros: "Outros",
  material: "Material",
  manutencao: "Manutenção",
  energia: "Energia",
  impostos: "Impostos",
  investimento: "Investimento / equipamento",
  custo: "Custo de orçamento",
  retirada_socio: "Retirada de sócio",
  distribuicao_lucro: "Distribuição de lucro",
  sobra_caixa: "Sobra de caixa",
  quebra_caixa: "Quebra de caixa",
};
export const categoryLabel = (c: string) => TRANSACTION_CATEGORY_LABEL[c] ?? c;

export const stockStatus = (quantity: number, min: number) =>
  quantity <= 0 ? "esgotado" : quantity <= min ? "baixo" : "ok";

export const SALE_STATUSES = ["pago", "pendente", "cancelado"] as const;
export const SALE_STATUS_LABEL: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  cancelado: "Cancelado",
};

export const PAYMENT_METHODS = ["pix", "dinheiro", "cartao", "boleto", "transferencia", "outro"] as const;
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  boleto: "Boleto",
  transferencia: "Transferência",
  outro: "Outro",
};

export const ASSET_CATEGORIES = ["equipamento", "peca_pronta", "material", "ferramenta", "movel", "outro"] as const;
export const ASSET_CATEGORY_LABEL: Record<string, string> = {
  equipamento: "Equipamento",
  peca_pronta: "Peça pronta",
  material: "Material do estoque",
  ferramenta: "Ferramenta",
  movel: "Móvel",
  outro: "Outro",
};

export const ASSET_CONDITIONS = ["novo", "bom", "regular", "manutencao", "baixado"] as const;
export const ASSET_CONDITION_LABEL: Record<string, string> = {
  novo: "Novo",
  bom: "Bom",
  regular: "Regular",
  manutencao: "Em manutenção",
  baixado: "Baixado",
};

export const ASSET_EVENT_KINDS = ["manutencao", "movimentacao", "custo", "ajuste", "nota"] as const;
export const ASSET_EVENT_KIND_LABEL: Record<string, string> = {
  manutencao: "Manutenção",
  movimentacao: "Movimentação",
  custo: "Custo",
  ajuste: "Ajuste de quantidade",
  nota: "Observação",
};
