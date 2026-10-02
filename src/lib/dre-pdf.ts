import { jsPDF } from "jspdf";

import type { ContasAReceber, DREMonthlyPoint, DREResult } from "@/lib/dre";
import { INK, LINE, MUTED, drawBrandLockup, gradientRect, money } from "@/lib/receipt-pdf";

const PAGE_W = 210;
const PAGE_H = 297;
const LEFT = 16;
const RIGHT = PAGE_W - 16;
const BOTTOM = PAGE_H - 20;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** PDF da DRE: demonstração, contas a receber e comparativo mensal. */
export function downloadDrePdf({
  result,
  anterior,
  contas,
  serie,
  periodoLabel,
}: {
  result: DREResult;
  anterior: DREResult;
  contas: ContasAReceber;
  serie: DREMonthlyPoint[];
  periodoLabel: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const setText = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const prev = new Map(anterior.rows.map((r) => [r.id, r.value]));

  gradientRect(doc, 0, 0, PAGE_W, 30);
  drawBrandLockup(doc, LEFT, 8, 44);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("DRE — Demonstração do Resultado", RIGHT, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${periodoLabel} · regime de ${result.regime === "competencia" ? "competência" : "caixa"}`,
    RIGHT,
    20,
    { align: "right" },
  );

  let y = 42;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 20;
    }
  };
  const section = (title: string) => {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(INK);
    doc.text(title, LEFT, y);
    y += 6;
  };

  // --- Demonstração ---
  section("Demonstração do resultado");
  doc.setFontSize(8);
  setText(MUTED);
  doc.text("CONTA", LEFT, y);
  doc.text("PERÍODO", RIGHT - 34, y, { align: "right" });
  doc.text("ANTERIOR", RIGHT, y, { align: "right" });
  y += 2;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.line(LEFT, y, RIGHT, y);
  y += 5;

  for (const row of result.rows) {
    ensure(7);
    const bold = row.emphasis;
    if (bold) {
      doc.setFillColor(244, 244, 250);
      doc.rect(LEFT, y - 4, RIGHT - LEFT, 6, "F");
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    setText(bold ? INK : MUTED);
    doc.text(row.label, LEFT + (row.level === 1 ? 5 : 1), y);
    if (row.kind === "resultado")
      doc.setTextColor(
        row.value >= 0 ? 5 : 200,
        row.value >= 0 ? 150 : 30,
        row.value >= 0 ? 105 : 30,
      );
    else setText(INK);
    doc.text(money(row.value), RIGHT - 34, y, { align: "right" });
    setText(MUTED);
    doc.text(money(prev.get(row.id) ?? 0), RIGHT, y, { align: "right" });
    y += 6;
  }

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(MUTED);
  doc.text(
    `Margem bruta ${pct(result.kpis.margemBruta)} · Margem líquida ${pct(result.kpis.margemLiquida)} · Despesas ${pct(result.kpis.pesoDespesas)} da receita líquida`,
    LEFT,
    y,
  );
  y += 10;

  // --- Contas a receber ---
  section(`Contas a receber · ${money(contas.total)}`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const f of contas.faixas) {
    ensure(6);
    setText(MUTED);
    doc.text(`${f.label} (${f.quantidade})`, LEFT + 1, y);
    setText(INK);
    doc.text(money(f.valor), RIGHT, y, { align: "right" });
    y += 5.5;
  }
  y += 6;

  // --- Comparativo mensal ---
  section("Comparativo mensal");
  const colW = (RIGHT - LEFT - 38) / serie.length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(MUTED);
  serie.forEach((p, i) => doc.text(p.mes, LEFT + 38 + colW * (i + 1), y, { align: "right" }));
  y += 5;
  const linhas: [string, keyof DREMonthlyPoint][] = [
    ["Receita líquida", "receitaLiquida"],
    ["Lucro bruto", "lucroBruto"],
    ["Resultado líquido", "resultadoLiquido"],
  ];
  doc.setFontSize(8.5);
  for (const [label, key] of linhas) {
    ensure(6);
    setText(MUTED);
    doc.text(label, LEFT + 1, y);
    setText(INK);
    serie.forEach((p, i) =>
      doc.text(money(p[key] as number), LEFT + 38 + colW * (i + 1), y, { align: "right" }),
    );
    y += 5.5;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, LEFT, PAGE_H - 10);
    doc.text(`Página ${i} de ${pages}`, RIGHT, PAGE_H - 10, { align: "right" });
  }

  const slug = periodoLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`dre-${slug}.pdf`);
}
