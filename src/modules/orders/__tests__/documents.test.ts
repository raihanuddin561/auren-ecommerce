import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildOrderDocuments, pdfText, type OrderDocument } from '../documents';

const doc = (orderNumber: string, lines = 2): OrderDocument => ({
  orderNumber,
  placedAt: new Date('2026-10-05T09:00:00Z'),
  channel: 'Website',
  customer: { name: 'Ayaan Rahman', phone: '+8801712345678', email: 'ayaan@example.com' },
  addressLines: ['House 4, Road 2', 'Mirpur, Dhaka', 'Dhaka, Dhaka 1216'],
  deliveryLabel: 'Standard (Inside Dhaka)',
  paymentLabel: 'Cash on delivery',
  collectOnDelivery: '৳5,130',
  note: 'Please call before you come. '.repeat(8),
  courier: 'Sundarban',
  trackingNumber: 'SB-1001',
  lines: Array.from({ length: lines }, (_, index) => ({
    sku: `SKU-${index}`,
    title: `Oxford shirt with a very long name that must be cut to fit the column ${index}`,
    variantLabel: 'Sand / M',
    quantity: 2,
    unitPrice: '৳2,500',
    lineTotal: '৳5,000',
    replacement: false,
  })),
  totals: {
    subtotal: '৳5,000',
    discount: null,
    shipping: '৳130',
    total: '৳5,130',
    paid: null,
    refunded: null,
    due: '৳5,130',
  },
});

const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('order documents (6.6)', () => {
  it('builds an invoice and a packing slip as valid PDFs', async () => {
    for (const kind of ['invoice', 'packing_slip'] as const) {
      const bytes = await buildOrderDocuments([doc('AUR-100001')], kind);
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
      expect(await pageCount(bytes)).toBe(1);
    }
  });

  it('prints a batch into one PDF with a page per order, and long orders continue on a new page', async () => {
    const batch = await buildOrderDocuments(
      [doc('AUR-100001'), doc('AUR-100002'), doc('AUR-100003')],
      'packing_slip',
    );
    expect(await pageCount(batch)).toBe(3);
    const long = await buildOrderDocuments([doc('AUR-100004', 60)], 'invoice');
    expect(await pageCount(long)).toBeGreaterThan(1);
  });

  it('survives characters the standard fonts cannot draw', async () => {
    expect(pdfText('৳2,500 অা')).toBe('BDT 2,500 ??');
    const odd = doc('AUR-100005');
    odd.customer.name = 'আয়ান রহমান';
    odd.note = 'ঢাকা';
    expect(await pageCount(await buildOrderDocuments([odd], 'invoice'))).toBe(1);
  });
});
