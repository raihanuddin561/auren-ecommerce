import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * Branded PDF documents for an order (6.6): the invoice the customer keeps and the packing slip that
 * travels in the parcel. Pure: no database, no clock. A batch is one PDF with every order's pages,
 * so a day's confirmed orders print in one go. Text arrives already formatted; the standard PDF fonts
 * only cover Latin-1, so the taka sign prints as BDT and anything else is replaced.
 */

export interface OrderDocument {
  orderNumber: string;
  placedAt: Date;
  /** The customer's channel: Website, Phone, WhatsApp ... */
  channel: string;
  customer: { name: string; phone: string; email: string | null };
  addressLines: string[];
  deliveryLabel: string;
  paymentLabel: string;
  /** Cash still to collect on delivery (formatted), or null when nothing is due. */
  collectOnDelivery: string | null;
  note: string | null;
  courier: string | null;
  trackingNumber: string | null;
  lines: Array<{
    sku: string;
    title: string;
    variantLabel: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
    replacement: boolean;
  }>;
  totals: {
    subtotal: string;
    discount: string | null;
    shipping: string;
    total: string;
    paid: string | null;
    refunded: string | null;
    due: string | null;
  };
}

export type DocumentKind = 'invoice' | 'packing_slip';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.06, 0.06, 0.06);
const STONE = rgb(0.45, 0.43, 0.4);
const GOLD = rgb(0.66, 0.53, 0.35);
const LINE = rgb(0.85, 0.83, 0.8);

export function pdfText(value: string): string {
  return value
    .replace(/৳/g, 'BDT ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E -ÿ]/g, '?');
}

const dateText = (date: Date) =>
  date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  });

function fit(font: PDFFont, text: string, size: number, width: number): string {
  let value = pdfText(text);
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > width) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
}

/** Builds one PDF with a document of the given kind for each order, in order. */
export async function buildOrderDocuments(
  orders: readonly OrderDocument[],
  kind: DocumentKind,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    pdfText(
      orders.length === 1
        ? `${kind === 'invoice' ? 'Invoice' : 'Packing slip'} ${orders[0]!.orderNumber}`
        : `${kind === 'invoice' ? 'Invoices' : 'Packing slips'} (${orders.length})`,
    ),
  );
  pdf.setAuthor('AUREN');
  pdf.setCreator('AUREN');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const right = PAGE.width - MARGIN;
  const slip = kind === 'packing_slip';

  for (const doc of orders) {
    let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
    let y = PAGE.height - MARGIN;

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
    const rule = (color = LINE) => {
      page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.5, color });
    };
    const newPage = () => {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    };

    // Header
    text('AUREN', MARGIN, 20, { font: bold });
    text(slip ? 'PACKING SLIP' : 'INVOICE', right, 12, { font: bold, alignRight: true });
    y -= 18;
    text(doc.orderNumber, right, 11, { alignRight: true });
    y -= 14;
    text(`Placed ${dateText(doc.placedAt)} · ${doc.channel}`, right, 9, {
      color: STONE,
      alignRight: true,
    });
    y -= 10;
    rule(GOLD);
    y -= 22;

    // Customer and delivery side by side
    const mid = MARGIN + 270;
    const top = y;
    text(slip ? 'DELIVER TO' : 'BILLED TO', MARGIN, 8, { font: bold, color: STONE });
    y -= 14;
    text(doc.customer.name, MARGIN, 11, { font: bold });
    for (const line of doc.addressLines) {
      y -= 13;
      text(fit(regular, line, 9, 250), MARGIN, 9);
    }
    y -= 13;
    text(doc.customer.phone, MARGIN, 9);
    if (!slip && doc.customer.email) {
      y -= 13;
      text(doc.customer.email, MARGIN, 9);
    }
    const leftBottom = y;
    y = top;
    text('DELIVERY', mid, 8, { font: bold, color: STONE });
    y -= 14;
    text(fit(regular, doc.deliveryLabel, 10, right - mid), mid, 10);
    y -= 13;
    text(fit(regular, `Payment: ${doc.paymentLabel}`, 9, right - mid), mid, 9, { color: STONE });
    if (doc.courier) {
      y -= 13;
      text(fit(regular, `Courier: ${doc.courier}`, 9, right - mid), mid, 9, { color: STONE });
    }
    if (doc.trackingNumber) {
      y -= 13;
      text(fit(regular, `Tracking: ${doc.trackingNumber}`, 9, right - mid), mid, 9, {
        color: STONE,
      });
    }
    if (slip && doc.collectOnDelivery) {
      y -= 18;
      text('COLLECT ON DELIVERY', mid, 8, { font: bold, color: STONE });
      y -= 16;
      text(doc.collectOnDelivery, mid, 14, { font: bold });
    }
    y = Math.min(y, leftBottom) - 28;

    // Lines
    const columns = slip
      ? { sku: MARGIN, item: MARGIN + 100, qty: right, unit: right, total: right }
      : {
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
      if (!slip) {
        text('PRICE', columns.unit, 8, { font: bold, color: STONE, alignRight: true });
        text('TOTAL', columns.total, 8, { font: bold, color: STONE, alignRight: true });
      }
      y -= 8;
      rule();
      y -= 14;
    };
    header();
    for (const line of doc.lines) {
      if (y < MARGIN + 160) {
        newPage();
        header();
      }
      text(fit(regular, line.sku, 9, 92), columns.sku, 9);
      const label = `${line.title}${line.variantLabel ? ` (${line.variantLabel})` : ''}${line.replacement ? ' (replacement)' : ''}`;
      text(fit(regular, label, 9, columns.qty - columns.item - (slip ? 90 : 40)), columns.item, 9);
      text(String(line.quantity), columns.qty, slip ? 11 : 9, {
        alignRight: true,
        ...(slip ? { font: bold } : {}),
      });
      if (!slip) {
        text(line.unitPrice, columns.unit, 9, { alignRight: true });
        text(line.lineTotal, columns.total, 9, { alignRight: true });
      }
      y -= 16;
    }
    rule();
    y -= 18;

    if (!slip) {
      const total = (label: string, value: string, strong = false) => {
        if (y < MARGIN + 30) newPage();
        text(label, right - 120, strong ? 10 : 9, {
          font: strong ? bold : regular,
          alignRight: true,
        });
        text(value, right, strong ? 10 : 9, { font: strong ? bold : regular, alignRight: true });
        y -= 15;
      };
      total('Subtotal', doc.totals.subtotal);
      if (doc.totals.discount) total('Discount', doc.totals.discount);
      total('Delivery', doc.totals.shipping);
      total('Total', doc.totals.total, true);
      if (doc.totals.paid) total('Paid', doc.totals.paid);
      if (doc.totals.refunded) total('Refunded', doc.totals.refunded);
      if (doc.totals.due) total('To pay on delivery', doc.totals.due, true);
      y -= 6;
      text('Prices include VAT where it applies.', MARGIN, 8, { color: STONE });
      y -= 12;
    }

    if (doc.note) {
      if (y < MARGIN + 60) newPage();
      y -= 8;
      text('NOTE FROM THE CUSTOMER', MARGIN, 8, { font: bold, color: STONE });
      y -= 13;
      let current = '';
      for (const word of pdfText(doc.note).split(' ')) {
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

    // Footer on the last page of each document
    page.drawText(
      pdfText(slip ? 'Thank you for choosing AUREN.' : 'AUREN. Thank you for your order.'),
      {
        x: MARGIN,
        y: MARGIN - 20,
        size: 8,
        font: regular,
        color: STONE,
      },
    );
  }

  return pdf.save();
}
