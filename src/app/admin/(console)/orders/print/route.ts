import { connection } from 'next/server';
import { z } from 'zod';
import { isDomainError } from '@/lib/errors';
import { hasPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { buildOrderDocuments } from '@/modules/orders/documents';
import { MAX_BATCH, loadOrderDocuments } from '@/modules/orders/queries';

/**
 * Batch print for confirmed orders only: invoices or packing slips in one PDF. Needs orders.fulfill.
 * One unconfirmed order in the list refuses the whole batch, so nothing unverified is ever printed.
 */
export async function GET(request: Request) {
  await connection();
  const staff = await requireStaff();
  if (!hasPermission(staff, 'orders.fulfill')) return new Response('Not found', { status: 404 });
  const params = new URL(request.url).searchParams;
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean);
  const kind = params.get('kind') === 'invoice' ? 'invoice' : 'packing_slip';
  if (
    ids.length === 0 ||
    ids.length > MAX_BATCH ||
    !ids.every((id) => z.uuid().safeParse(id).success)
  ) {
    return new Response(`Choose between 1 and ${MAX_BATCH} orders.`, { status: 400 });
  }
  try {
    const documents = await loadOrderDocuments([...new Set(ids)]);
    const bytes = await buildOrderDocuments(documents, kind);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="orders-${kind}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (isDomainError(error)) {
      return new Response(error.code === 'NOT_FOUND' ? 'Not found' : error.message, {
        status: error.code === 'NOT_FOUND' ? 404 : 409,
      });
    }
    throw error;
  }
}
