import type { SerializedMoney } from '@/lib/money';

export const CATALOG_CURRENCY = 'BDT';

/** Who is making a change, for the audit trail. Built by the action from the staff session. */
export interface Actor {
  /** users.id of the staff member. */
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Holds catalog.publish: may unpublish live collections and change what is live. */
  canPublish?: boolean;
}

/** What a mutation returns: the result plus the cache tags the caller must invalidate. */
export interface Mutation<T> {
  data: T;
  tags: string[];
}

export type { SerializedMoney };

export interface StoredImage {
  url: string;
  alt: string;
  provider: string;
  storageKey: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
}
