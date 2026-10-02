import { jsPDF } from "jspdf";

import type { CashClosing } from "@/lib/db";
import {
  CLOSING_METHODS,
  methodLabel,
  monthLabel,
  type MethodMap,
  type PartnerShare,
} from "@/lib/cash-closing";
import { INK, LINE, MUTED, drawBrandLockup, gradientRect, money } from "@/lib/receipt-pdf";

const PAGE_W = 210;
const PAGE_H = 297;
const LEFT = 16;
const RIGHT = PAGE_W - 16;
const BOTTOM = PAGE_H - 20;

const asMap = (v: unknown): MethodMap =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as MethodMap) : {};

/** PDF do fechamento mensal: resultado, reserva, divisão por sócio e conferência. */
export function downloadCashClosingPdf(
  c: CashClosing,
  closedByName: string,
  company?: string | null,
) {
  const ym = c.month.slice(0, 7);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const setText = (col: readonly number[]) => doc.setTextColor(col[0], col[1], col[2]);

  gradientRect(doc, 0, 0, PAGE_W, 30);
  drawBrandLockup(doc, LEFT, 9, 90, company);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Fechamento de caixa", RIGHT, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(monthLabel(ym), RIGHT, 20, { align: "right" });

  let y = 42;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 20;
    }
  };
  const section = (title: string) => {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(INK);
    doc.text(title, LEFT, y);
    y += 2;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.line(LEFT, y, RIGHT, y);
    y += 5;
  };
  const line = (label: string, value: number, bold = false) => {
    ensure(6);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    setText(bold ? INK : MUTED);
    doc.text(label, LEFT + 1, y);
    setText(INK);
    doc.text(money(value), RIGHT, y, { align: "right" });
    y += 5.5;
  };
  const table = (headers: string[], rows: (string | number)[][], widths: number[]) => {
    const xs: number[] = [];
    let x = LEFT;
    widths.forEach((w) => {
      x += w;
      xs.push(x);
    });
    ensure(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(MUTED);
    headers.forEach((h, i) =>
      i === 0 ? doc.text(h, LEFT + 1, y) : doc.text(h, xs[i], y, { align: "right" }),
    );
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    for (const r of rows) {
      ensure(6);
      r.forEach((v, i) => {
        setText(i === 0 ? INK : MUTED);
        const text = typeof v === "number" ? money(v) : v;
        if (i === 0) doc.text(text, LEFT + 1, y);
        else doc.text(text, xs[i], y, { align: "right" });
      });
      y += 5.5;
    }
    y += 3;
  };

  section("Resultado do mês");
  line("Entradas", Number(c.total_in));
  line("(-) Gastos da empresa", -Number(c.company_out));
  line("= Resultado", Number(c.result), true);
  if (Number(c.previous_loss) > 0)
    line("(-) Prejuízo de meses anteriores", -Number(c.previous_loss));
  line("(-) Reserva para investimento", -Number(c.reserve_amount));
  line("= Valor distribuído", Number(c.distributable), true);
  if (Number(c.loss_carry) > 0) line("Prejuízo levado para o próximo mês", Number(c.loss_carry));
  line("Saldo da reserva após o fechamento", Number(c.reserve_balance));
  y += 4;

  section("Divisão entre os sócios");
  const shares = (Array.isArray(c.partner_shares)
    ? c.partner_shares
    : []) as unknown as PartnerShare[];
  table(
    ["Sócio", "Cota", "Dinheiro", "Peças", "Devia", "Recebe", "Fica devendo"],
    shares.map((s) => [
      `${s.name} (${s.share_pct.toLocaleString("pt-BR")}%)`,
      s.quota,
      s.cash,
      s.in_kind,
      s.previous_debt,
      s.payout,
      s.debt,
    ]),
    [52, 20, 20, 20, 20, 20, 22],
  );

  section("Conferência por forma de pagamento");
  const opening = asMap(c.opening);
  const inflows = asMap(c.inflows);
  const outflows = asMap(c.outflows);
  const expected = asMap(c.expected);
  const counted = asMap(c.counted);
  const methods = CLOSING_METHODS.filter(
    (m) =>
      opening[m] ||
      inflows[m] ||
      outflows[m] ||
      expected[m] ||
      counted[m] ||
      shares.some((s) => s.payout > 0 && s.payment_method === m),
  );
  const payouts: MethodMap = {};
  shares.forEach((s) => {
    if (s.payout > 0) payouts[s.payment_method] = (payouts[s.payment_method] ?? 0) + s.payout;
  });
  table(
    ["Forma", "Inicial", "Entradas", "Saídas", "Distrib.", "Esperado", "Conferido", "Diferença"],
    methods.map((m) => [
      methodLabel(m),
      opening[m] ?? 0,
      inflows[m] ?? 0,
      outflows[m] ?? 0,
      payouts[m] ?? 0,
      expected[m] ?? 0,
      counted[m] ?? 0,
      (counted[m] ?? 0) - (expected[m] ?? 0),
    ]),
    [32, 20, 20, 20, 20, 22, 22, 22],
  );

  const textBlock = (label: string, text: string | null) => {
    if (!text) return;
    const lines = doc.splitTextToSize(text, RIGHT - LEFT - 2) as string[];
    ensure(8 + lines.length * 4.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(INK);
    doc.text(label, LEFT, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    setText(MUTED);
    doc.text(lines, LEFT + 1, y);
    y += lines.length * 4.5 + 3;
  };
  if (Math.abs(Number(c.difference)) >= 0.01) {
    ensure(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text(
      "As diferenças foram lançadas no financeiro como sobra (entrada) ou quebra de caixa (saída).",
      LEFT + 1,
      y,
    );
    y += 7;
  }
  textBlock("Explicação da diferença", c.difference_reason);
  textBlock("Observações", c.notes);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    setText(MUTED);
    doc.text(
      `Fechado por ${closedByName} em ${new Date(c.closed_at).toLocaleString("pt-BR")}`,
      LEFT,
      PAGE_H - 10,
    );
    doc.text(`Página ${i} de ${pages}`, RIGHT, PAGE_H - 10, { align: "right" });
  }
  doc.save(`fechamento-caixa-${ym}.pdf`);
}
