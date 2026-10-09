import { connection } from 'next/server';
import { z } from 'zod';
import { isDomainError } from '@/lib/errors';
import { hasPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import { buildOrderDocuments, type DocumentKind } from '@/modules/orders/documents';
import { loadOrderDocuments } from '@/modules/orders/queries';

/** One order as an invoice or a packing slip PDF. Staff with orders.read; confirmed orders only; never cached. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const staff = await requireStaff();
  const { id } = await context.params;
  const kind: DocumentKind =
    new URL(request.url).searchParams.get('kind') === 'packing_slip' ? 'packing_slip' : 'invoice';
  // A missing permission and a missing order look the same: nothing to see here.
  if (!hasPermission(staff, 'orders.read') || !z.uuid().safeParse(id).success) {
    return new Response('Not found', { status: 404 });
  }
  try {
    const documents = await loadOrderDocuments([id]);
    const bytes = await buildOrderDocuments(documents, kind);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${documents[0]!.orderNumber}-${kind}.pdf"`,
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
