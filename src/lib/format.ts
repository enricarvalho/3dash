export const brl = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

export const num = (value: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(value ?? 0));

export const dateBR = (value: string | null | undefined) => {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return d.toLocaleDateString("pt-BR");
};

export const minutesToHuman = (minutes: number | null | undefined) => {
  const m = Number(minutes ?? 0);
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h ? `${h}h${rest ? ` ${rest}min` : ""}` : `${rest}min`;
};

export const monthRange = (period: "month" | "quarter" | "year", ref = new Date()) => {
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  const start =
    period === "month"
      ? new Date(ref.getFullYear(), ref.getMonth(), 1)
      : period === "quarter"
        ? new Date(ref.getFullYear(), ref.getMonth() - 2, 1)
        : new Date(ref.getFullYear(), 0, 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
};

export const toCSV = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join(
    "\n",
  );
};

export const downloadCSV = (filename: string, rows: Record<string, unknown>[]) => {
  const blob = new Blob(["\uFEFF" + toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
