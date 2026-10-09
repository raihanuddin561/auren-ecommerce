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

export interface AuditLogListItem {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogFilterParams {
  entityType?: string;
  action?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogListResult {
  items: AuditLogListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  availableEntityTypes: string[];
  availableActions: string[];
}
