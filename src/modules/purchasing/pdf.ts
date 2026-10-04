import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/** The data a purchase order document needs; text and money arrive already formatted. */
export interface PurchaseOrderDocument {
  poNumber: string;
  status: string;
  createdAt: Date;
  expectedAt: Date | null;
  supplier: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  };
  notes?: string | null;
  lines: Array<{
    sku: string;
    label: string;
    quantity: number;
    unitCost: string;
    lineTotal: string;
  }>;
  landedCosts: Array<{ type: string; method: string; amount: string }>;
  totals: { goods: string; landed: string; total: string };
}

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.06, 0.06, 0.06);
const STONE = rgb(0.45, 0.43, 0.4);
const GOLD = rgb(0.66, 0.53, 0.35);

/** Standard PDF fonts only cover Latin-1: show the taka sign as BDT and replace anything else. */
export function pdfText(value: string): string {
  return value
    .replace(/৳/g, 'BDT ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E -ÿ]/g, '?');
}

const dateText = (date: Date) =>
  date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Truncates text with an ellipsis so it fits the column. */
function fit(font: PDFFont, text: string, size: number, width: number): string {
  let value = pdfText(text);
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > width) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

/** Builds the purchase order PDF (A4). Pure: no database, no clock. */
export async function buildPurchaseOrderPdf(doc: PurchaseOrderDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfText(`Purchase order ${doc.poNumber}`));
  pdf.setAuthor('AUREN');
  pdf.setCreator('AUREN');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const right = PAGE.width - MARGIN;

  const text = (
    value: string,
    x: number,
    size = 10,
    options: { font?: PDFFont; color?: ReturnType<typeof rgb>; alignRight?: boolean } = {},
  ) => {
    const font = options.font ?? regular;
    const content = pdfText(value);
    const width = font.widthOfTextAtSize(content, size);
    page.drawText(content, {
      x: options.alignRight ? x - width : x,
      y,
      size,
      font,
      color: options.color ?? INK,
    });
  };
  const rule = (color = rgb(0.85, 0.83, 0.8)) => {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.5, color });
  };

  // Header
  text('AUREN', MARGIN, 20, { font: bold });
  text('PURCHASE ORDER', right, 12, { font: bold, alignRight: true });
  y -= 18;
  text(doc.poNumber, right, 11, { alignRight: true });
  y -= 14;
  text(`Date ${dateText(doc.createdAt)}`, right, 9, { color: STONE, alignRight: true });
  y -= 12;
  text(doc.expectedAt ? `Expected ${dateText(doc.expectedAt)}` : 'No delivery date set', right, 9, {
    color: STONE,
    alignRight: true,
  });
  y -= 10;
  rule(GOLD);
  y -= 22;

  // Supplier
  text('SUPPLIER', MARGIN, 8, { font: bold, color: STONE });
  y -= 14;
  text(doc.supplier.name, MARGIN, 11, { font: bold });
  for (const line of [doc.supplier.address, doc.supplier.phone, doc.supplier.email]) {
    if (!line) continue;
    y -= 13;
    text(line, MARGIN, 9);
  }
  y -= 28;

  // Lines
  const columns = {
    sku: MARGIN,
    item: MARGIN + 100,
    qty: right - 190,
    unit: right - 100,
    total: right,
  };
  const header = () => {
    text('SKU', columns.sku, 8, { font: bold, color: STONE });
    text('ITEM', columns.item, 8, { font: bold, color: STONE });
    text('QTY', columns.qty, 8, { font: bold, color: STONE, alignRight: true });
    text('UNIT COST', columns.unit, 8, { font: bold, color: STONE, alignRight: true });
    text('TOTAL', columns.total, 8, { font: bold, color: STONE, alignRight: true });
    y -= 8;
    rule();
    y -= 14;
  };
  header();
  for (const line of doc.lines) {
    if (y < MARGIN + 150) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
      header();
    }
    text(fit(regular, line.sku, 9, 92), columns.sku, 9);
    text(fit(regular, line.label, 9, columns.qty - columns.item - 40), columns.item, 9);
    text(String(line.quantity), columns.qty, 9, { alignRight: true });
    text(line.unitCost, columns.unit, 9, { alignRight: true });
    text(line.lineTotal, columns.total, 9, { alignRight: true });
    y -= 16;
  }
  rule();
  y -= 18;

  // Totals
  const total = (label: string, value: string, strong = false) => {
    if (y < MARGIN + 30) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
    text(label, right - 120, strong ? 10 : 9, { font: strong ? bold : regular, alignRight: true });
    text(value, right, strong ? 10 : 9, { font: strong ? bold : regular, alignRight: true });
    y -= 15;
  };
  total('Goods', doc.totals.goods);
  for (const cost of doc.landedCosts) total(`${cost.type} (${cost.method})`, cost.amount);
  total('Landed costs', doc.totals.landed);
  total('Total', doc.totals.total, true);

  if (doc.notes) {
    y -= 10;
    text('NOTES', MARGIN, 8, { font: bold, color: STONE });
    y -= 13;
    const words = pdfText(doc.notes).split(' ');
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (regular.widthOfTextAtSize(next, 9) > right - MARGIN) {
        text(current, MARGIN, 9);
        y -= 12;
        current = word;
      } else {
        current = next;
      }
    }
    if (current) text(current, MARGIN, 9);
  }

  return pdf.save();
}
