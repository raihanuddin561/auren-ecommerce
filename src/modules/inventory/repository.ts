import type { Tx } from '@/lib/db';

/**
 * Data access for stock. Reads are open to queries; every write below is called by the inventory
 * service only (INV-S4). Every statement that changes a level is conditional, so the CHECK
 * constraints are never the first line of defence (INV-S1, INV-S2).
 */

export interface AvailabilityRow {
  variantId: string;
  onHand: number;
  reserved: number;
}

/** Stock summed across the active locations, one row per variant that has any level. */
export async function sumLevelsByVariant(
  tx: Tx,
  variantIds: readonly string[],
): Promise<AvailabilityRow[]> {
  if (variantIds.length === 0) return [];
  const levels = await tx.inventoryLevel.groupBy({
    by: ['variantId'],
    where: { variantId: { in: [...variantIds] }, location: { isActive: true } },
    _sum: { onHand: true, reserved: true },
  });
  return levels.map((row) => ({
    variantId: row.variantId,
    onHand: row._sum.onHand ?? 0,
    reserved: row._sum.reserved ?? 0,
  }));
}

// ---------------------------------------------------------------------------------------------
// Level writes
// ---------------------------------------------------------------------------------------------

export interface LevelAfter {
  onHand: number;
  reserved: number;
}

interface LevelRow {
  on_hand: number;
  reserved: number;
}

const toLevel = (rows: LevelRow[]): LevelAfter | null =>
  rows[0] ? { onHand: rows[0].on_hand, reserved: rows[0].reserved } : null;

/** The warehouse new stock goes to when the caller does not name a location. */
export async function findDefaultLocationId(tx: Tx): Promise<string | null> {
  const location = await tx.location.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return location?.id ?? null;
}

export const locationIsActive = async (tx: Tx, locationId: string): Promise<boolean> =>
  (await tx.location.count({ where: { id: locationId, isActive: true } })) > 0;

/** Units on hand for a variant across every location, active or not. */
export async function sumOnHandAllLocations(tx: Tx, variantId: string): Promise<number> {
  const sum = await tx.inventoryLevel.aggregate({ where: { variantId }, _sum: { onHand: true } });
  return sum._sum.onHand ?? 0;
}

/** Adds stock, creating the level row on first receipt. Returns the level after the change. */
export async function addOnHand(
  tx: Tx,
  variantId: string,
  locationId: string,
  quantity: number,
): Promise<LevelAfter> {
  const rows = await tx.$queryRaw<LevelRow[]>`
    INSERT INTO inventory_levels (variant_id, location_id, on_hand, reserved, low_stock_threshold, updated_at)
    VALUES (${variantId}::uuid, ${locationId}::uuid, ${quantity}, 0, 5, now())
    ON CONFLICT (variant_id, location_id)
    DO UPDATE SET on_hand = inventory_levels.on_hand + ${quantity}, updated_at = now()
    RETURNING on_hand, reserved`;
  return toLevel(rows) as LevelAfter;
}

/** Removes stock that is not reserved. Null means there was not enough free stock. */
export async function removeFreeOnHand(
  tx: Tx,
  variantId: string,
  locationId: string,
  quantity: number,
): Promise<LevelAfter | null> {
  return toLevel(
    await tx.$queryRaw<LevelRow[]>`
      UPDATE inventory_levels
         SET on_hand = on_hand - ${quantity}, updated_at = now()
       WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid
         AND on_hand - reserved >= ${quantity}
       RETURNING on_hand, reserved`,
  );
}

/** Holds stock for a customer. Null means out of stock (INV-S2). */
export async function holdStock(
  tx: Tx,
  variantId: string,
  locationId: string,
  quantity: number,
): Promise<LevelAfter | null> {
  return toLevel(
    await tx.$queryRaw<LevelRow[]>`
      UPDATE inventory_levels
         SET reserved = reserved + ${quantity}, updated_at = now()
       WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid
         AND on_hand - reserved >= ${quantity}
       RETURNING on_hand, reserved`,
  );
}

/** Gives held stock back. */
export async function unholdStock(
  tx: Tx,
  variantId: string,
  locationId: string,
  quantity: number,
): Promise<LevelAfter | null> {
  return toLevel(
    await tx.$queryRaw<LevelRow[]>`
      UPDATE inventory_levels
         SET reserved = reserved - ${quantity}, updated_at = now()
       WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid
         AND reserved >= ${quantity}
       RETURNING on_hand, reserved`,
  );
}

/** Turns held stock into a sale: on hand and reserved both go down. */
export async function consumeHeldStock(
  tx: Tx,
  variantId: string,
  locationId: string,
  quantity: number,
): Promise<LevelAfter | null> {
  return toLevel(
    await tx.$queryRaw<LevelRow[]>`
      UPDATE inventory_levels
         SET on_hand = on_hand - ${quantity}, reserved = reserved - ${quantity}, updated_at = now()
       WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid
         AND reserved >= ${quantity}
       RETURNING on_hand, reserved`,
  );
}

/** Locks one level row and returns it (an absolute count needs a stable starting point). */
export async function lockLevel(
  tx: Tx,
  variantId: string,
  locationId: string,
): Promise<LevelAfter | null> {
  return toLevel(
    await tx.$queryRaw<LevelRow[]>`
      SELECT on_hand, reserved FROM inventory_levels
       WHERE variant_id = ${variantId}::uuid AND location_id = ${locationId}::uuid
       FOR UPDATE`,
  );
}

export type MovementType =
  | 'receipt'
  | 'sale'
  | 'reservation'
  | 'release'
  | 'return_restock'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'write_off';

export interface MovementInput {
  variantId: string;
  locationId: string;
  type: MovementType;
  quantity: number;
  unitCostMinor?: bigint | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  actorId?: string | null;
}

export const insertMovement = (tx: Tx, input: MovementInput) =>
  tx.stockMovement.create({
    data: {
      variantId: input.variantId,
      locationId: input.locationId,
      type: input.type,
      quantity: input.quantity,
      unitCostMinor: input.unitCostMinor ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      reason: input.reason ?? null,
      actorId: input.actorId ?? null,
    },
  });

// ---------------------------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------------------------

export interface ReservationRow {
  id: string;
  variantId: string;
  locationId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  status: 'active' | 'committed' | 'released';
  expiresAt: Date;
}

/** Inserts a reservation unless this reference already holds one for the variant. True when inserted. */
export async function insertReservationIfAbsent(
  tx: Tx,
  input: {
    variantId: string;
    locationId: string;
    quantity: number;
    referenceType: string;
    referenceId: string;
    ttlSeconds: number;
  },
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO stock_reservations (id, variant_id, location_id, quantity, reference_type, reference_id, status, expires_at)
    VALUES (gen_random_uuid(), ${input.variantId}::uuid, ${input.locationId}::uuid, ${input.quantity},
            ${input.referenceType}, ${input.referenceId}, 'active',
            now() + make_interval(secs => ${input.ttlSeconds}))
    ON CONFLICT (reference_type, reference_id, variant_id) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

export const findReservation = (
  tx: Tx,
  referenceType: string,
  referenceId: string,
  variantId: string,
) =>
  tx.stockReservation.findUnique({
    where: { referenceType_referenceId_variantId: { referenceType, referenceId, variantId } },
  });

/** Locks the open reservations of one reference, in a stable order. */
export async function lockActiveReservations(
  tx: Tx,
  referenceType: string,
  referenceId: string,
): Promise<ReservationRow[]> {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      variant_id: string;
      location_id: string;
      quantity: number;
      reference_type: string;
      reference_id: string;
      status: ReservationRow['status'];
      expires_at: Date;
    }>
  >`
    SELECT id, variant_id, location_id, quantity, reference_type, reference_id, status, expires_at
      FROM stock_reservations
     WHERE reference_type = ${referenceType} AND reference_id = ${referenceId} AND status = 'active'
     ORDER BY variant_id
       FOR UPDATE`;
  return rows.map((row) => ({
    id: row.id,
    variantId: row.variant_id,
    locationId: row.location_id,
    quantity: row.quantity,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    status: row.status,
    expiresAt: row.expires_at,
  }));
}

export const resolveReservation = (tx: Tx, id: string, status: 'committed' | 'released') =>
  tx.$executeRaw`
    UPDATE stock_reservations SET status = ${status}::reservation_status, resolved_at = now()
     WHERE id = ${id}::uuid`;

/** Runs the database function that releases expired reservations and returns what it freed. */
export async function releaseExpiredReservations(tx: Tx, limit: number) {
  const rows = await tx.$queryRaw<
    Array<{ released_variant_id: string; released_quantity: number }>
  >`SELECT released_variant_id, released_quantity FROM release_expired_reservations(${limit}::integer)`;
  return rows.map((row) => ({
    variantId: row.released_variant_id,
    quantity: row.released_quantity,
  }));
}

export async function hasSaleMovements(
  tx: Tx,
  referenceType: string,
  referenceId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM stock_movements
      WHERE reference_type = ${referenceType} AND reference_id = ${referenceId} AND type = 'sale'
    ) AS "exists"`;
  return Boolean(rows[0]?.exists);
}

export async function hasRestockMovements(
  tx: Tx,
  referenceType: string,
  referenceId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM stock_movements
      WHERE reference_type = ${referenceType} AND reference_id = ${referenceId} AND type = 'return_restock'
    ) AS "exists"`;
  return Boolean(rows[0]?.exists);
}

// ---------------------------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------------------------

export interface ReconcileRow {
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  ledgerOnHand: number;
  ledgerReserved: number;
}

/**
 * Compares every level with the sum of its ledger (INV-S3). `reservation` and `release` movements
 * explain `reserved`; every other type explains `on_hand`. Returns only the rows that disagree.
 */
export async function findLedgerMismatches(tx: Tx, variantId?: string): Promise<ReconcileRow[]> {
  const only = variantId ?? null;
  const rows = await tx.$queryRaw<
    Array<{
      variant_id: string;
      location_id: string;
      on_hand: number;
      reserved: number;
      ledger_on_hand: bigint;
      ledger_reserved: bigint;
    }>
  >`
    SELECT l.variant_id, l.location_id, l.on_hand, l.reserved,
           COALESCE(SUM(m.quantity) FILTER (WHERE m.type NOT IN ('reservation', 'release')), 0) AS ledger_on_hand,
           COALESCE(SUM(m.quantity) FILTER (WHERE m.type IN ('reservation', 'release')), 0) AS ledger_reserved
      FROM inventory_levels l
      LEFT JOIN stock_movements m ON m.variant_id = l.variant_id AND m.location_id = l.location_id
     WHERE (${only}::uuid IS NULL OR l.variant_id = ${only}::uuid)
     GROUP BY l.variant_id, l.location_id, l.on_hand, l.reserved
    HAVING l.on_hand <> COALESCE(SUM(m.quantity) FILTER (WHERE m.type NOT IN ('reservation', 'release')), 0)
        OR l.reserved <> COALESCE(SUM(m.quantity) FILTER (WHERE m.type IN ('reservation', 'release')), 0)`;
  return rows.map((row) => ({
    variantId: row.variant_id,
    locationId: row.location_id,
    onHand: row.on_hand,
    reserved: row.reserved,
    ledgerOnHand: Number(row.ledger_on_hand),
    ledgerReserved: Number(row.ledger_reserved),
  }));
}

// ---------------------------------------------------------------------------------------------
// Console reads
// ---------------------------------------------------------------------------------------------

export const PAGE_SIZE = 25;

export interface StockRow {
  variantId: string;
  productId: string;
  productTitle: string;
  productStatus: string;
  sku: string;
  optionsLabel: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  avgCostMinor: bigint;
  currency: string;
}

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function listStock(
  tx: Tx,
  params: {
    q?: string | undefined;
    status: 'all' | 'in_stock' | 'low' | 'out' | 'no_cost';
    categoryId?: string | undefined;
    page: number;
  },
): Promise<{ rows: StockRow[]; total: number }> {
  const pattern = params.q ? likePattern(params.q) : null;
  const category = params.categoryId ?? null;
  const offset = (params.page - 1) * PAGE_SIZE;
  const rows = await tx.$queryRaw<
    Array<{
      variant_id: string;
      product_id: string;
      title: string;
      product_status: string;
      variant_status: string;
      sku: string;
      options_label: string;
      on_hand: number;
      reserved: number;
      threshold: number;
      avg_cost_minor: bigint;
      currency: string;
      total: bigint;
    }>
  >`
    WITH stock AS (
      SELECT v.id AS variant_id, p.id AS product_id, p.title, p.status::text AS product_status, v.status::text AS variant_status, v.sku,
             v.avg_cost_minor, v.currency, v.position,
             COALESCE((SELECT string_agg(ov.label, ' / ' ORDER BY po.position)
                         FROM variant_option_values vov
                         JOIN product_option_values ov ON ov.id = vov.option_value_id
                         JOIN product_options po ON po.id = ov.option_id
                        WHERE vov.variant_id = v.id), '') AS options_label,
             COALESCE(SUM(l.on_hand), 0)::int AS on_hand,
             COALESCE(SUM(l.reserved), 0)::int AS reserved,
             COALESCE(MIN(l.low_stock_threshold), 5)::int AS threshold
        FROM product_variants v
        JOIN products p ON p.id = v.product_id AND p.deleted_at IS NULL
        LEFT JOIN inventory_levels l ON l.variant_id = v.id
       WHERE (${pattern}::text IS NULL OR p.title ILIKE ${pattern} OR v.sku ILIKE ${pattern})
         AND (${category}::uuid IS NULL OR p.category_id = ${category}::uuid)
       GROUP BY v.id, p.id
    )
    SELECT *, COUNT(*) OVER() AS total FROM stock
     WHERE CASE ${params.status}
             WHEN 'out' THEN on_hand - reserved <= 0
             WHEN 'low' THEN on_hand - reserved > 0 AND on_hand - reserved <= threshold
             WHEN 'in_stock' THEN on_hand - reserved > threshold
             WHEN 'no_cost' THEN avg_cost_minor <= 0 AND variant_status <> 'archived' AND product_status <> 'archived'
             ELSE TRUE END
     ORDER BY title, position, sku
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  return {
    total: rows[0] ? Number(rows[0].total) : 0,
    rows: rows.map((row) => ({
      variantId: row.variant_id,
      productId: row.product_id,
      productTitle: row.title,
      productStatus: row.product_status,
      sku: row.sku,
      optionsLabel: row.options_label,
      onHand: row.on_hand,
      reserved: row.reserved,
      available: Math.max(0, row.on_hand - row.reserved),
      lowStockThreshold: row.threshold,
      avgCostMinor: row.avg_cost_minor,
      currency: row.currency,
    })),
  };
}

/** Variants that cannot be ordered for lack of a cost: live products and variants, cost still zero. */
export async function countVariantsWithoutCost(tx: Tx): Promise<number> {
  return tx.productVariant.count({
    where: {
      avgCostMinor: { lte: 0n },
      status: { not: 'archived' },
      product: { deletedAt: null, status: { not: 'archived' } },
    },
  });
}

export interface MovementRow {
  id: string;
  createdAt: Date;
  type: string;
  quantity: number;
  unitCostMinor: bigint | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  sku: string;
  productTitle: string;
  variantId: string;
  actorName: string | null;
}

export async function listMovements(
  tx: Tx,
  params: { variantId?: string | undefined; type?: string | undefined; page: number },
): Promise<{ rows: MovementRow[]; total: number }> {
  const variant = params.variantId ?? null;
  const type = params.type ?? null;
  const offset = (params.page - 1) * PAGE_SIZE;
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      created_at: Date;
      type: string;
      quantity: number;
      unit_cost_minor: bigint | null;
      reference_type: string | null;
      reference_id: string | null;
      reason: string | null;
      sku: string;
      title: string;
      variant_id: string;
      actor_name: string | null;
      total: bigint;
    }>
  >`
    SELECT m.id, m.created_at, m.type::text AS type, m.quantity, m.unit_cost_minor, m.reference_type,
           m.reference_id, m.reason, v.sku, p.title, v.id AS variant_id, u.name AS actor_name,
           COUNT(*) OVER() AS total
      FROM stock_movements m
      JOIN product_variants v ON v.id = m.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON u.id = m.actor_id
     WHERE (${variant}::uuid IS NULL OR m.variant_id = ${variant}::uuid)
       AND (${type}::text IS NULL OR m.type::text = ${type})
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  return {
    total: rows[0] ? Number(rows[0].total) : 0,
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      type: row.type,
      quantity: row.quantity,
      unitCostMinor: row.unit_cost_minor,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      reason: row.reason,
      sku: row.sku,
      productTitle: row.title,
      variantId: row.variant_id,
      actorName: row.actor_name,
    })),
  };
}

export const findVariantLabel = async (tx: Tx, variantId: string) => {
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: { sku: true, product: { select: { title: true } } },
  });
  return variant ? { sku: variant.sku, productTitle: variant.product.title } : null;
};

/**
 * Products with at least one active variant that can be sold now (on hand minus reserved, summed
 * over the active locations, above zero). Read-only; used by the storefront "In stock" filter.
 */
export async function listInStockProductIds(tx: Tx): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ product_id: string }>>`
    SELECT DISTINCT v.product_id
    FROM product_variants v
    JOIN (
      SELECT il.variant_id
      FROM inventory_levels il
      JOIN locations l ON l.id = il.location_id AND l.is_active
      GROUP BY il.variant_id
      HAVING SUM(il.on_hand) - SUM(il.reserved) > 0
    ) s ON s.variant_id = v.id
    WHERE v.status = 'active'
  `;
  return rows.map((row) => row.product_id);
}
