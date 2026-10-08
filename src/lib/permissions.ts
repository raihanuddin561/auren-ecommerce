import { DomainError } from './errors';

/** Staff roles (ARCHITECTURE section 11). Mirrors the `staff_role` database enum. */
export const STAFF_ROLES = [
  'owner',
  'admin',
  'manager',
  'order_verifier',
  'fulfillment',
  'finance',
  'content_editor',
  'support',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Every permission the admin console can check, as `<area>.<action>`.
 * Add new ones here and in a migration that inserts them into `role_permissions`.
 */
export const PERMISSIONS = [
  'orders.read',
  'orders.update',
  /** Verify and confirm an order. Nothing reaches fulfillment without it (ADR-015, INV-O1). */
  'orders.verify',
  'orders.cancel',
  'orders.refund',
  'orders.fulfill',
  'catalog.read',
  'catalog.write',
  'catalog.publish',
  'inventory.read',
  'inventory.adjust',
  'purchasing.manage',
  'shipping.manage',
  'returns.manage',
  'customers.read',
  'customers.write',
  'promotions.manage',
  'reviews.moderate',
  'content.manage',
  'finance.read',
  'finance.write',
  'analytics.read',
  'settings.manage',
  'audit.read',
  /** Approve or reject another staff member's high-value refund or adjustment (maker-checker). */
  'approvals.decide',
  'staff.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const without = (excluded: readonly Permission[]): Permission[] =>
  PERMISSIONS.filter((p) => !excluded.includes(p));

/**
 * Default grants per role, inserted by the migration that creates `role_permissions` and then
 * editable by the owner. `orders.verify` defaults to owner, admin, manager, support and the
 * dedicated order_verifier role (ARCHITECTURE section 6.1).
 */
export const DEFAULT_ROLE_PERMISSIONS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  owner: PERMISSIONS,
  admin: without(['staff.manage']),
  manager: [
    'orders.read',
    'orders.update',
    'orders.verify',
    'orders.cancel',
    'orders.refund',
    'orders.fulfill',
    'catalog.read',
    'catalog.write',
    'catalog.publish',
    'inventory.read',
    'inventory.adjust',
    'purchasing.manage',
    'shipping.manage',
    'returns.manage',
    'customers.read',
    'customers.write',
    'promotions.manage',
    'reviews.moderate',
    'analytics.read',
    'approvals.decide',
  ],
  order_verifier: [
    'orders.read',
    'orders.update',
    'orders.verify',
    'orders.cancel',
    'customers.read',
  ],
  fulfillment: ['orders.read', 'orders.fulfill', 'shipping.manage', 'inventory.read'],
  finance: ['orders.read', 'finance.read', 'finance.write', 'analytics.read', 'purchasing.manage'],
  content_editor: ['catalog.read', 'content.manage', 'reviews.moderate'],
  support: [
    'orders.read',
    'orders.update',
    'orders.verify',
    'orders.cancel',
    'returns.manage',
    'customers.read',
    'customers.write',
  ],
};

/** What the server knows about the signed-in staff member for one request. */
export interface StaffContext {
  /** staff_members.id */
  id: string;
  userId: string;
  role: StaffRole;
  name: string;
  email: string;
  permissions: ReadonlySet<Permission>;
}

/** The owner role always holds every permission, so it can never lock itself out. */
export function hasPermission(staff: StaffContext, permission: Permission): boolean {
  return staff.role === 'owner' || staff.permissions.has(permission);
}

/**
 * Who sees what a variant costs: staff who buy stock, read finance, or set the cost themselves
 * (inventory.adjust). Everyone else sees only whether a cost exists.
 */
export const canSeeCostOfGoods = (staff: StaffContext): boolean =>
  hasPermission(staff, 'purchasing.manage') ||
  hasPermission(staff, 'finance.read') ||
  hasPermission(staff, 'inventory.adjust');

/** Throws FORBIDDEN unless the staff member holds the permission. Call it in every admin action. */
export function assertPermission(staff: StaffContext, permission: Permission): void {
  if (!hasPermission(staff, permission)) {
    // The message stays generic for clients; the cause records which permission was missing.
    throw new DomainError('FORBIDDEN', undefined, {
      cause: new Error(`staff ${staff.id} lacks ${permission}`),
    });
  }
}

const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);

/** Drops unknown permission strings (for example a grant removed in a later release). */
export const toPermissionSet = (values: readonly string[]): Set<Permission> =>
  new Set(values.filter(isPermission));
