import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildPurchaseOrderPdf, pdfText, type PurchaseOrderDocument } from '../pdf';

const doc = (lines = 2): PurchaseOrderDocument => ({
  poNumber: 'PO-0042',
  status: 'ordered',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  expectedAt: new Date('2026-11-15T00:00:00Z'),
  supplier: { name: 'Dhaka Garments Ltd', phone: '+880 1700 000000', email: 'sales@example.com' },
  notes: 'Pack each shirt in a polybag. '.repeat(8),
  lines: Array.from({ length: lines }, (_, index) => ({
    sku: `OX-${index}`,
    label: 'Oxford shirt / White / M',
    quantity: 10,
    unitCost: '৳1,000.00',
    lineTotal: '৳10,000.00',
  })),
  landedCosts: [{ type: 'Freight', method: 'by value', amount: '৳1,500.00' }],
  totals: { goods: '৳20,000.00', landed: '৳1,500.00', total: '৳21,500.00' },
});

describe('purchase order PDF', () => {
  it('produces a PDF containing the order number', async () => {
    const bytes = await buildPurchaseOrderPdf(doc());
    const buffer = Buffer.from(bytes);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('adds pages for long orders', async () => {
    const short = await PDFDocument.load(await buildPurchaseOrderPdf(doc(3)));
    const long = await PDFDocument.load(await buildPurchaseOrderPdf(doc(80)));
    expect(short.getPageCount()).toBe(1);
    expect(long.getPageCount()).toBeGreaterThan(1);
    expect(short.getTitle()).toBe('Purchase order PO-0042');
  });

  it('shows the taka sign as BDT and never throws on other scripts', async () => {
    expect(pdfText('৳1,250.00')).toBe('BDT 1,250.00');
    expect(pdfText('শার্ট')).toBe('?????');
    const bytes = await buildPurchaseOrderPdf({ ...doc(1), notes: 'শার্ট emoji 🙂' });
    expect(bytes.length).toBeGreaterThan(500);
  });
});
