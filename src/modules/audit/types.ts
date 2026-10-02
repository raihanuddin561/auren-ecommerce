/** Dotted `<entity>.<verb>` names, for example `order.confirm` or `product.update`. */
export type AuditAction = string;

export interface AuditInput {
  /** The staff user performing the change; null only for system actions. */
  actorId: string | null;
  action: AuditAction;
  /** Entity kind, stored as entity_type: `order`, `product`, `setting`... */
  entity: string;
  entityId: string;
  /** State before the change (null for creates). Sensitive fields are redacted automatically. */
  before?: unknown;
  /** State after the change (null for deletes). */
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditRecord {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
}
