import { jsPDF } from "jspdf";

import { BRAND, companyName } from "./brand";


export type ReceiptItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type ReceiptData = {
  company: string;
  contactLines: string[];
  footerText: string;
  number: string;
  saleDate: string;
  issuedAt: string;
  status: string;
  paymentMethod: string;
  clientName: string;
  clientDoc?: string;
  clientContact?: string;
  clientAddress?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
};

/* ---------- identidade visual (white label) ---------- */
export const BRAND_FROM = BRAND.pdfFrom;
const BRAND_TO = BRAND.pdfTo;
export const INK = [24, 24, 34] as const;
export const MUTED = [112, 112, 130] as const;
export const LINE = [226, 226, 236] as const;

const M = { left: 16, right: 16, bottom: 18 };
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - M.left - M.right;
const BAND_H = 34;
const CONTENT_TOP = BAND_H + 12;
const CONTENT_BOTTOM = PAGE_H - M.bottom - 6;

export const money = (v: number) =>
  "R$ " +
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(v) || 0,
  );

const clean = (s: unknown) => String(s ?? "").replace(/\u00a0/g, " ").trim();

function mix(t: number) {
  return [
    Math.round(BRAND_FROM[0] + (BRAND_TO[0] - BRAND_FROM[0]) * t),
    Math.round(BRAND_FROM[1] + (BRAND_TO[1] - BRAND_FROM[1]) * t),
    Math.round(BRAND_FROM[2] + (BRAND_TO[2] - BRAND_FROM[2]) * t),
  ] as const;
}

/** Faixa com gradiente da marca (simulado por faixas verticais finas). */
export function gradientRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const steps = 90;
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const [r, g, b] = mix(i / (steps - 1));
    doc.setFillColor(r, g, b);
    doc.rect(x + i * sw, y, sw + 0.25, h, "F");
  }
}

/** Marca no topo do PDF: nome da empresa em branco sobre a faixa. Retorna a altura usada. */
export function drawBrandLockup(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  company?: string | null,
) {
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const lines = doc.splitTextToSize(companyName(company), w) as string[];
  doc.text(lines.slice(0, 2), x, y + 6);
  return 6 + (Math.min(lines.length, 2) - 1) * 6;
}

export function buildSaleReceiptPdf(data: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setLineHeightFactor(1.35);
  const rightX = PAGE_W - M.right;

  const setText = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const wrap = (text: string, w: number): string[] =>
    doc.splitTextToSize(clean(text) || "—", w) as string[];

  /* ---------- cabeçalho institucional (todas as páginas) ---------- */
  const drawBand = () => {
    gradientRect(doc, 0, 0, PAGE_W, BAND_H);
    drawBrandLockup(doc, M.left, BAND_H / 2 - 4, 80, data.company);

    const infoW = rightX - (M.left + 80 + 10);
    const infoLines: string[] = data.contactLines.filter(Boolean).flatMap((l) => wrap(l, infoW));

    // alinhado à direita, ancorado na parte inferior da faixa
    const lineH = 3.6;
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    let hy = BAND_H - 4 - (infoLines.length - 1) * lineH;
    for (const line of infoLines) {
      if (hy > 4) doc.text(line, rightX, hy, { align: "right" });
      hy += lineH;
    }


  };

  const drawFooter = (page: number, pages: number) => {
    gradientRect(doc, M.left, PAGE_H - M.bottom, CONTENT_W, 0.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(MUTED);
    const label = wrap(data.footerText, CONTENT_W - 30)[0];
    doc.text(label, M.left, PAGE_H - M.bottom + 5);
    doc.text(`Página ${page} de ${pages}`, rightX, PAGE_H - M.bottom + 5, { align: "right" });
  };

  let y = CONTENT_TOP;
  drawBand();

  const newPage = () => {
    doc.addPage();
    drawBand();
    y = CONTENT_TOP;
  };
  const ensure = (h: number) => {
    if (y + h > CONTENT_BOTTOM) newPage();
  };

  /* ---------- título do documento ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setText(INK);
  doc.text(`Recibo nº ${clean(data.number)}`, M.left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(MUTED);
  doc.text(`Venda em ${clean(data.saleDate)}`, rightX, y - 4, { align: "right" });
  doc.text(`Emitido em ${clean(data.issuedAt)}`, rightX, y, { align: "right" });
  y += 8;

  /* ---------- cartões: cliente / pagamento ---------- */
  const gap = 6;
  const colW = (CONTENT_W - gap) / 2;
  const pad = 4.5;
  const innerW = colW - pad * 2;

  const clientBody = [data.clientDoc, data.clientContact, data.clientAddress]
    .filter(Boolean)
    .flatMap((l) => wrap(String(l), innerW));
  const payBody = [`Situação: ${clean(data.status)}`].flatMap((l) => wrap(l, innerW));

  const clientTitle = wrap(data.clientName, innerW).slice(0, 2);
  const payTitle = wrap(data.paymentMethod || "—", innerW).slice(0, 2);

  const cardH = (titleLines: number, bodyLines: number) =>
    pad + 4 + titleLines * 5 + (bodyLines ? 1.5 + bodyLines * 4 : 0) + pad;
  const boxH = Math.max(
    cardH(clientTitle.length, clientBody.length),
    cardH(payTitle.length, payBody.length),
    22,
  );

  ensure(boxH + 6);

  const drawCard = (x: number, label: string, titleLines: string[], bodyLines: string[]) => {
    doc.setFillColor(250, 250, 253);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.roundedRect(x, y, colW, boxH, 2.5, 2.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(BRAND_FROM[0], BRAND_FROM[1], BRAND_FROM[2]);
    doc.text(label.toUpperCase(), x + pad, y + pad + 2);

    doc.setFontSize(10);
    setText(INK);
    let ly = y + pad + 8;
    for (const l of titleLines) {
      doc.text(l, x + pad, ly);
      ly += 5;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(MUTED);
    ly += 1;
    for (const l of bodyLines) {
      doc.text(l, x + pad, ly);
      ly += 4;
    }
  };

  drawCard(M.left, "Cliente", clientTitle, clientBody);
  drawCard(M.left + colW + gap, "Pagamento", payTitle, payBody);
  y += boxH + 9;

  /* ---------- tabela de itens ---------- */
  const colQtyR = M.left + CONTENT_W * 0.58;
  const colUnitR = M.left + CONTENT_W * 0.78;
  const colSubR = rightX - 3;
  const descW = CONTENT_W * 0.58 - 3 - 14; // largura segura da descrição

  const drawTableHeader = () => {
    gradientRect(doc, M.left, y, CONTENT_W, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("ITEM", M.left + 3, y + 5.3);
    doc.text("QTD", colQtyR, y + 5.3, { align: "right" });
    doc.text("VALOR UNIT.", colUnitR, y + 5.3, { align: "right" });
    doc.text("SUBTOTAL", colSubR, y + 5.3, { align: "right" });
    y += 8;
    doc.setFont("helvetica", "normal");
  };

  ensure(24);
  drawTableHeader();

  const items = data.items.length
    ? data.items
    : [{ description: "Nenhum item nesta venda.", quantity: 0, unitPrice: 0 }];

  items.forEach((item, idx) => {
    doc.setFontSize(9);
    const descLines = wrap(item.description, descW);
    const rowH = Math.max(9, descLines.length * 4.3 + 4.5);

    if (y + rowH > CONTENT_BOTTOM) {
      newPage();
      drawTableHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(249, 249, 252);
      doc.rect(M.left, y, CONTENT_W, rowH, "F");
    }

    setText(INK);
    doc.setFontSize(9);
    doc.text(descLines, M.left + 3, y + 5.6);
    const baseline = y + 5.6;
    doc.text(String(item.quantity), colQtyR, baseline, { align: "right" });
    doc.text(money(item.unitPrice), colUnitR, baseline, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(money(item.quantity * item.unitPrice), colSubR, baseline, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += rowH;
    doc.setDrawColor(238, 238, 244);
    doc.line(M.left, y, rightX, y);
  });

  /* ---------- totais ---------- */
  const totalsW = 70;
  const totalsX = rightX - totalsW;
  const totalsH = 12 + (data.discount > 0 ? 5 : 0) + 12;
  ensure(totalsH + 4);
  y += 6;

  const totalRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(MUTED);
    doc.text(label, totalsX, y);
    setText(INK);
    doc.text(value, rightX, y, { align: "right" });
    y += 5.5;
  };

  totalRow("Subtotal", money(data.subtotal));
  if (data.discount > 0) totalRow("Desconto", `- ${money(data.discount)}`);

  y += 1.5;
  doc.setFillColor(246, 245, 255);
  doc.setDrawColor(BRAND_TO[0], BRAND_TO[1], BRAND_TO[2]);
  doc.roundedRect(totalsX, y, totalsW, 12, 2.5, 2.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND_FROM[0], BRAND_FROM[1], BRAND_FROM[2]);
  doc.text("TOTAL", totalsX + 5, y + 7.6);
  doc.setFontSize(12);
  setText(INK);
  doc.text(money(data.total), rightX - 5, y + 7.8, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 12 + 8;

  /* ---------- observações ---------- */
  if (data.notes?.trim()) {
    doc.setFontSize(9);
    const noteLines = wrap(data.notes, CONTENT_W - 9);
    const chunkH = (n: number) => n * 4.3 + 12;
    let remaining = noteLines;
    let first = true;
    while (remaining.length) {
      const available = CONTENT_BOTTOM - y - 12;
      let fit = Math.max(1, Math.floor((available - 12) / 4.3));
      if (available < 20) {
        newPage();
        continue;
      }
      fit = Math.min(fit, remaining.length);
      const part = remaining.slice(0, fit);
      remaining = remaining.slice(fit);
      const h = chunkH(part.length);
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setFillColor(252, 252, 254);
      doc.roundedRect(M.left, y, CONTENT_W, h, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(BRAND_FROM[0], BRAND_FROM[1], BRAND_FROM[2]);
      doc.text(first ? "OBSERVAÇÕES" : "OBSERVAÇÕES (CONT.)", M.left + 4.5, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setText(INK);
      doc.text(part, M.left + 4.5, y + 11);
      y += h + 7;
      first = false;
    }
  }

  /* ---------- declaração + assinaturas ---------- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const declLines = wrap(
    `Recebemos a importância de ${money(data.total)} referente aos itens acima descritos.`,
    CONTENT_W,
  );
  const blockH = declLines.length * 4.5 + 26;
  ensure(blockH);
  setText(MUTED);
  doc.text(declLines, M.left, y);
  y += declLines.length * 4.5 + 20;

  const signW = (CONTENT_W - 20) / 2;
  doc.setDrawColor(180, 180, 196);
  doc.line(M.left, y, M.left + signW, y);
  doc.line(M.left + signW + 20, y, rightX, y);
  doc.setFontSize(8);
  setText(MUTED);
  doc.text(wrap(`Assinatura ${data.company}`, signW)[0], M.left + signW / 2, y + 4.5, {
    align: "center",
  });
  doc.text("Assinatura do cliente", M.left + signW + 20 + signW / 2, y + 4.5, { align: "center" });

  /* ---------- rodapé em todas as páginas ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter(p, pages);
  }

  return doc;
}

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Normaliza um texto para uso seguro em nome de arquivo (sem acentos/espaços). */
function slugForFilename(text: string) {
  const slug = clean(text)
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "cliente";
}

export function receiptFilename(data: ReceiptData) {
  return `recibo-${slugForFilename(data.clientName)}-${data.number}.pdf`;
}

/** Blob URL do PDF (para pré-visualização em modal). */
export function saleReceiptPdfUrl(data: ReceiptData) {
  return URL.createObjectURL(buildSaleReceiptPdf(data).output("blob"));
}

/** Gera e baixa o PDF do recibo (funciona em Chrome, Safari, Firefox e mobile). */
export function downloadSaleReceiptPdf(data: ReceiptData) {
  const doc = buildSaleReceiptPdf(data);
  const filename = receiptFilename(data);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}

/** Abre o PDF numa nova aba (útil no iOS/Safari, onde o download direto é limitado). */
export function openSaleReceiptPdf(data: ReceiptData) {
  const url = saleReceiptPdfUrl(data);
  const win = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return !!win;
}
