import { connection } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import {
  ALLOCATION_LABELS,
  LANDED_COST_LABELS,
  type LandedCostTypeValue,
} from '@/modules/purchasing/schemas';
import { buildPurchaseOrderPdf } from '@/modules/purchasing/pdf';
import { getPurchaseOrderForAdmin } from '@/modules/purchasing/queries';

/** Purchase order as a PDF for the supplier. Staff with purchasing.manage only; never cached. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const staff = await requireStaff();
  const { id } = await context.params;
  // A missing permission and a missing order look the same: nothing to see here.
  if (!hasPermission(staff, 'purchasing.manage') || !z.uuid().safeParse(id).success) {
    return new Response('Not found', { status: 404 });
  }
  const po = await getPurchaseOrderForAdmin(id);
  if (!po) return new Response('Not found', { status: 404 });

  const bytes = await buildPurchaseOrderPdf({
    poNumber: po.poNumber,
    status: po.status,
    createdAt: new Date(po.createdAt),
    expectedAt: po.expectedAt ? new Date(po.expectedAt) : null,
    supplier: po.supplier,
    notes: po.notes,
    lines: po.lines.map((line) => ({
      sku: line.sku,
      label: line.label,
      quantity: line.quantityOrdered,
      unitCost: line.unitCost,
      lineTotal: line.lineTotal,
    })),
    landedCosts: po.landedCosts.map((cost) => ({
      type: LANDED_COST_LABELS[cost.type as LandedCostTypeValue] ?? cost.type,
      method: ALLOCATION_LABELS[cost.method].toLowerCase(),
      amount: cost.amount,
    })),
    totals: po.totals,
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${po.poNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
