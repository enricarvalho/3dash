const onlyDigits = (v: string) => v.replace(/\D/g, "");

export function maskDoc(value: string, kind: "fisica" | "empresa" | string = "fisica") {
  const d = onlyDigits(value).slice(0, kind === "empresa" ? 14 : 11);
  if (kind === "empresa") {
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

export function maskCep(value: string) {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isValidCPF(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function isValidCNPJ(value: string) {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function isValidDoc(value: string, kind: string) {
  if (!value.trim()) return true;
  return kind === "empresa" ? isValidCNPJ(value) : isValidCPF(value);
}

/**
 * Mensagem de erro específica para CPF/CNPJ (ou null quando está ok/vazio).
 * Diferencia "faltam dígitos", "dígitos repetidos" e "dígito verificador inválido".
 */
export function docError(value: string, kind: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const d = onlyDigits(raw);
  const isCompany = kind === "empresa";
  const label = isCompany ? "CNPJ" : "CPF";
  const expected = isCompany ? 14 : 11;

  if (/[^0-9.\-/\s]/.test(raw)) return `${label} deve conter apenas números`;
  if (d.length < expected)
    return `${label} incompleto: faltam ${expected - d.length} dígito(s) de ${expected}`;
  if (d.length > expected) return `${label} deve ter exatamente ${expected} dígitos`;
  if (new RegExp(`^(\\d)\\1{${expected - 1}}$`).test(d))
    return `${label} inválido: todos os dígitos são iguais`;
  if (isCompany ? !isValidCNPJ(d) : !isValidCPF(d))
    return `${label} inválido: dígito verificador não confere. Confira os números digitados.`;
  return null;
}


export type CepField = "street" | "district" | "city" | "state";

export type CepAddress = {
  street: string;
  district: string;
  city: string;
  state: string;
  /** Campos que o serviço não retornou e precisam ser preenchidos à mão. */
  missing: CepField[];
};

export const CEP_FIELD_LABEL: Record<CepField, string> = {
  street: "rua",
  district: "bairro",
  city: "cidade",
  state: "UF",
};

async function fetchViaCep(d: string): Promise<Partial<Record<CepField, string>> | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, string> & { erro?: boolean | string };
    if (j.erro) return null;
    return {
      street: (j.logradouro ?? "").trim(),
      district: (j.bairro ?? "").trim(),
      city: (j.localidade ?? "").trim(),
      state: (j.uf ?? "").trim(),
    };
  } catch {
    return null;
  }
}

async function fetchBrasilApiCep(d: string): Promise<Partial<Record<CepField, string>> | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, any>;
    return {
      street: String(j.street ?? "").trim(),
      district: String(j.neighborhood ?? "").trim(),
      city: String(j.city ?? "").trim(),
      state: String(j.state ?? "").trim(),
    };
  } catch {
    return null;
  }
}

/**
 * Busca o endereço pelo CEP consultando ViaCEP e BrasilAPI ao mesmo tempo e
 * combinando os retornos (um provedor costuma completar o que o outro omite).
 * Retorna também a lista de campos que continuaram vazios.
 */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;

  const [a, b] = await Promise.all([fetchViaCep(d), fetchBrasilApiCep(d)]);
  if (!a && !b) return null;

  const pick = (f: CepField) => (a?.[f] || b?.[f] || "").trim();
  const result: CepAddress = {
    street: pick("street"),
    district: pick("district"),
    city: pick("city"),
    state: pick("state").toUpperCase(),
    missing: [],
  };
  result.missing = (["street", "district", "city", "state"] as CepField[]).filter((f) => !result[f]);
  return result;
}


export function formatAddress(c: {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}) {
  const line1 = [c.street, c.number].filter(Boolean).join(", ");
  const line2 = [c.complement, c.district].filter(Boolean).join(" · ");
  const line3 = [[c.city, c.state].filter(Boolean).join("/"), c.zip_code].filter(Boolean).join(" · ");
  return [line1, line2, line3].filter(Boolean).join(" — ");
}

export type CnpjCompany = {
  name: string;
  legalName: string;
  phone: string;
  email: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export async function lookupCnpj(cnpj: string): Promise<CnpjCompany | null> {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, any>;
    const legalName = (j.razao_social ?? "") as string;
    const fantasy = (j.nome_fantasia ?? "") as string;
    const street = [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(" ").trim();
    const ddd = j.ddd_telefone_1 ? String(j.ddd_telefone_1) : "";
    return {
      name: fantasy || legalName,
      legalName,
      phone: ddd,
      email: (j.email ?? "") as string,
      zip_code: j.cep ? maskCep(String(j.cep)) : "",
      street,
      number: j.numero ? String(j.numero) : "",
      complement: (j.complemento ?? "") as string,
      district: (j.bairro ?? "") as string,
      city: (j.municipio ?? "") as string,
      state: (j.uf ?? "") as string,
    };
  } catch {
    return null;
  }
}

/** Apenas os dígitos do documento, para comparação de duplicidade. */
export function docDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

/** Procura um cliente já cadastrado com o mesmo CPF/CNPJ (ignora máscara). */
export function findDuplicateDoc<T extends { id: string; doc_number: string | null }>(
  list: T[] | undefined,
  doc: string,
  excludeId?: string | null,
): T | null {
  const digits = docDigits(doc);
  if (digits.length < 11) return null;
  return (
    (list ?? []).find((c) => c.id !== excludeId && docDigits(c.doc_number) === digits) ?? null
  );
}

/** Máscara de telefone BR: (62) 99999-9999 ou (62) 3333-4444. */
export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, (m) => (m ? `(${m}` : ""));
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Valida e-mail de forma simples; vazio é considerado válido (campo opcional). */
export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "E-mail inválido";
}
