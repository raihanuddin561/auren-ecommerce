import { db } from '@/lib/db';
import { format, money, toDecimalString } from '@/lib/money';
import { canAddLandedCost, canReceive, isEditable, type PoStatus } from './po-state';
import * as repo from './repository';
import type { PoListParams } from './schemas';
import { orderTotals, variantLabels } from './service';

/** Console reads: call them after the staff check (purchasing.manage). All money leaves as text. */

const fmt = (minor: bigint, currency: string) => format(money(minor, currency));

export async function listSuppliersForAdmin(params: { q?: string; includeInactive: boolean }) {
  const rows = await repo.listSuppliers(db, {
    includeInactive: params.includeInactive,
    ...(params.q ? { q: params.q } : {}),
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    paymentTerms: row.paymentTerms,
    isActive: row.isActive,
    orderCount: row._count.purchaseOrders,
  }));
}

export async function getSupplierForAdmin(id: string) {
  return repo.findSupplier(db, id);
}

export const listSupplierOptions = () => repo.supplierOptions(db);

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  supplierName: string;
  status: PoStatus;
  createdAt: string;
  expectedAt: string | null;
  units: number;
  received: number;
  total: string;
}

export async function listPurchaseOrdersForAdmin(params: PoListParams) {
  const { rows, total } = await repo.listPurchaseOrders(db, params);
  return {
    total,
    pageSize: repo.PAGE_SIZE,
    rows: rows.map<PurchaseOrderRow>((row) => {
      const goods = row.items.reduce(
        (sum, item) => sum + item.unitCostMinor * BigInt(item.quantityOrdered),
        0n,
      );
      const landed = row.landedCosts.reduce((sum, cost) => sum + cost.amountMinor, 0n);
      return {
        id: row.id,
        poNumber: row.poNumber,
        supplierName: row.supplier.name,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        expectedAt: row.expectedAt?.toISOString() ?? null,
        units: row.items.reduce((sum, item) => sum + item.quantityOrdered, 0),
        received: row.items.reduce((sum, item) => sum + item.quantityReceived, 0),
        total: fmt(goods + landed, row.currency),
      };
    }),
  };
}

export interface PurchaseOrderLine {
  id: string;
  variantId: string;
  sku: string;
  label: string;
  quantityOrdered: number;
  quantityReceived: number;
  outstanding: number;
  /** Major units as typed in forms, for example 1250.50. */
  unitCostInput: string;
  unitCost: string;
  lineTotal: string;
  landedShare: string;
}

export interface PurchaseOrderDetail {
  id: string;
  poNumber: string;
  status: PoStatus;
  currency: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  createdAt: string;
  orderedAt: string | null;
  /** yyyy-mm-dd for date inputs. */
  expectedAtInput: string;
  expectedAt: string | null;
  notes: string | null;
  lines: PurchaseOrderLine[];
  landedCosts: Array<{
    id: string;
    type: string;
    amount: string;
    method: 'by_quantity' | 'by_value';
    note: string | null;
  }>;
  receipts: Array<{
    id: string;
    receivedAt: string;
    notes: string | null;
    lines: Array<{ label: string; quantity: number; unitCost: string; landed: string }>;
  }>;
  totals: { goods: string; landed: string; total: string };
  can: { edit: boolean; receive: boolean; cancel: boolean; addCost: boolean; removeCost: boolean };
}

export async function getPurchaseOrderForAdmin(id: string): Promise<PurchaseOrderDetail | null> {
  const po = await repo.findPurchaseOrder(db, id);
  if (!po) return null;
  const labels = await variantLabels(po.items.map((item) => item.variantId));
  const totals = orderTotals(po.items, po.landedCosts, po.currency);
  const itemLabel = new Map(po.items.map((item) => [item.id, labels.get(item.variantId)]));
  const labelOf = (variantLabel?: { productTitle: string; optionsLabel: string }) =>
    variantLabel
      ? `${variantLabel.productTitle}${variantLabel.optionsLabel ? ` / ${variantLabel.optionsLabel}` : ''}`
      : 'Unknown variant';
  const status = po.status as PoStatus;
  const received = po.items.reduce((sum, item) => sum + item.quantityReceived, 0);
  return {
    id: po.id,
    poNumber: po.poNumber,
    status,
    currency: po.currency,
    supplier: po.supplier,
    createdAt: po.createdAt.toISOString(),
    orderedAt: po.orderedAt?.toISOString() ?? null,
    expectedAtInput: po.expectedAt?.toISOString().slice(0, 10) ?? '',
    expectedAt: po.expectedAt?.toISOString() ?? null,
    notes: po.notes,
    lines: po.items.map((item) => {
      const label = labels.get(item.variantId);
      return {
        id: item.id,
        variantId: item.variantId,
        sku: label?.sku ?? '',
        label: labelOf(label),
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        outstanding: item.quantityOrdered - item.quantityReceived,
        unitCostInput: toDecimalString(money(item.unitCostMinor, po.currency)),
        unitCost: fmt(item.unitCostMinor, po.currency),
        lineTotal: fmt(item.unitCostMinor * BigInt(item.quantityOrdered), po.currency),
        landedShare: fmt(totals.landedPerLine.get(item.id) ?? 0n, po.currency),
      };
    }),
    landedCosts: po.landedCosts.map((cost) => ({
      id: cost.id,
      type: cost.type,
      amount: fmt(cost.amountMinor, po.currency),
      method: cost.allocationMethod,
      note: cost.note,
    })),
    receipts: po.receipts.map((receipt) => ({
      id: receipt.id,
      receivedAt: receipt.receivedAt.toISOString(),
      notes: receipt.notes,
      lines: receipt.items.map((line) => ({
        label: labelOf(itemLabel.get(line.poItemId)),
        quantity: line.quantity,
        unitCost: fmt(line.unitCostMinor, po.currency),
        landed: fmt(line.landedCostMinor, po.currency),
      })),
    })),
    totals: {
      goods: fmt(totals.goodsMinor, po.currency),
      landed: fmt(totals.landedMinor, po.currency),
      total: fmt(totals.totalMinor, po.currency),
    },
    can: {
      edit: isEditable(status),
      receive: canReceive(status),
      cancel: (status === 'draft' || status === 'ordered') && received === 0,
      addCost: canAddLandedCost(status),
      removeCost: (status === 'draft' || status === 'ordered') && received === 0,
    },
  };
}
