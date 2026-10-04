import type { Prisma } from '@/generated/prisma/client';
import type { Tx } from '@/lib/db';

/** Data access for suppliers, purchase orders, landed costs and goods receipts. No rules here. */

export const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------------------------

export const listSuppliers = (
  tx: Tx,
  params: { q?: string | undefined; includeInactive: boolean },
) =>
  tx.supplier.findMany({
    where: {
      ...(params.includeInactive ? {} : { isActive: true }),
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { contactName: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { purchaseOrders: true } } },
  });

export const findSupplier = (tx: Tx, id: string) => tx.supplier.findUnique({ where: { id } });

export const createSupplier = (tx: Tx, data: Prisma.SupplierUncheckedCreateInput) =>
  tx.supplier.create({ data });

export const updateSupplier = (tx: Tx, id: string, data: Prisma.SupplierUncheckedUpdateInput) =>
  tx.supplier.update({ where: { id }, data });

export const supplierOptions = (tx: Tx) =>
  tx.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

// ---------------------------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------------------------

const detailInclude = {
  supplier: { select: { id: true, name: true, email: true, phone: true, address: true } },
  items: { orderBy: { id: 'asc' as const } },
  landedCosts: { orderBy: { createdAt: 'asc' as const } },
  receipts: {
    orderBy: { receivedAt: 'desc' as const },
    include: { items: true },
  },
} satisfies Prisma.PurchaseOrderInclude;

export const findPurchaseOrder = (tx: Tx, id: string) =>
  tx.purchaseOrder.findUnique({ where: { id }, include: detailInclude });

/** Locks the order row for the length of the transaction. */
export async function lockPurchaseOrder(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<
    Array<{ id: string; status: string; currency: string; supplier_id: string }>
  >`SELECT id, status::text AS status, currency, supplier_id FROM purchase_orders WHERE id = ${id}::uuid FOR UPDATE`;
  const row = rows[0];
  return row
    ? { id: row.id, status: row.status, currency: row.currency, supplierId: row.supplier_id }
    : null;
}

export async function listPurchaseOrders(
  tx: Tx,
  params: { status: string; supplierId?: string | undefined; page: number },
) {
  const where: Prisma.PurchaseOrderWhereInput = {
    ...(params.status === 'all' ? {} : { status: params.status as never }),
    ...(params.supplierId ? { supplierId: params.supplierId } : {}),
  };
  const [rows, total] = await Promise.all([
    tx.purchaseOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        supplier: { select: { name: true } },
        items: { select: { quantityOrdered: true, quantityReceived: true, unitCostMinor: true } },
        landedCosts: { select: { amountMinor: true } },
      },
    }),
    tx.purchaseOrder.count({ where }),
  ]);
  return { rows, total };
}

export const createPurchaseOrder = (
  tx: Tx,
  data: Omit<Prisma.PurchaseOrderUncheckedCreateInput, 'items'>,
) => tx.purchaseOrder.create({ data });

export const updatePurchaseOrder = (
  tx: Tx,
  id: string,
  data: Prisma.PurchaseOrderUncheckedUpdateInput,
) => tx.purchaseOrder.update({ where: { id }, data });

export const replaceItems = async (
  tx: Tx,
  poId: string,
  items: ReadonlyArray<{ variantId: string; quantityOrdered: number; unitCostMinor: bigint }>,
) => {
  await tx.purchaseOrderItem.deleteMany({ where: { poId } });
  await tx.purchaseOrderItem.createMany({ data: items.map((item) => ({ poId, ...item })) });
};

export const listItems = (tx: Tx, poId: string) =>
  tx.purchaseOrderItem.findMany({ where: { poId }, orderBy: { id: 'asc' } });

/** Raises the received quantity if it still fits the order; false when it would exceed it. */
export async function addReceivedQuantity(
  tx: Tx,
  itemId: string,
  quantity: number,
): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE purchase_order_items
       SET quantity_received = quantity_received + ${quantity}
     WHERE id = ${itemId}::uuid AND quantity_received + ${quantity} <= quantity_ordered`;
  return updated === 1;
}

export const countReceivedUnits = async (tx: Tx, poId: string) => {
  const sum = await tx.purchaseOrderItem.aggregate({
    where: { poId },
    _sum: { quantityReceived: true },
  });
  return sum._sum.quantityReceived ?? 0;
};

// ---------------------------------------------------------------------------------------------
// Landed costs
// ---------------------------------------------------------------------------------------------

export const listLandedCosts = (tx: Tx, poId: string) =>
  tx.landedCost.findMany({ where: { poId }, orderBy: { createdAt: 'asc' } });

export const createLandedCost = (tx: Tx, data: Prisma.LandedCostUncheckedCreateInput) =>
  tx.landedCost.create({ data });

export const findLandedCost = (tx: Tx, id: string) => tx.landedCost.findUnique({ where: { id } });

export const deleteLandedCost = (tx: Tx, id: string) => tx.landedCost.delete({ where: { id } });

// ---------------------------------------------------------------------------------------------
// Goods receipts
// ---------------------------------------------------------------------------------------------

export const createReceipt = (
  tx: Tx,
  data: { poId: string; locationId: string; receivedBy: string | null; notes: string | null },
) => tx.goodsReceipt.create({ data });

export const createReceiptItem = (
  tx: Tx,
  data: {
    receiptId: string;
    poItemId: string;
    quantity: number;
    unitCostMinor: bigint;
    landedCostMinor: bigint;
  },
) => tx.goodsReceiptItem.create({ data });

/** Landed cost that earlier deliveries of an order line already carried. */
export async function landedAllocatedBefore(tx: Tx, poItemId: string): Promise<bigint> {
  const sum = await tx.goodsReceiptItem.aggregate({
    where: { poItemId },
    _sum: { landedCostMinor: true },
  });
  return sum._sum.landedCostMinor ?? 0n;
}
