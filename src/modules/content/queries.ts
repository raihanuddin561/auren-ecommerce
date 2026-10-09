import 'server-only';
import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import type { PageFilterInput } from './schemas';
import * as service from './service';
import type { PageDetail, PageListItem } from './types';

// =============================================================================================
// Admin Queries (Guarded by content.manage)
// =============================================================================================

export async function getPagesForAdmin(
  params: PageFilterInput = { limit: 50 },
): Promise<{ items: PageListItem[]; totalCount: number }> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  return service.listPages(params);
}

export async function getPageDetailForAdmin(id: string): Promise<PageDetail | null> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');

  return service.getPageById(id);
}

// =============================================================================================
// Storefront Public & Preview Queries
// =============================================================================================

export async function getPublishedPageBySlug(slug: string): Promise<PageDetail | null> {
  return service.getPageBySlug(slug, false);
}

export async function getDraftPageBySlug(slug: string): Promise<PageDetail | null> {
  return service.getPageBySlug(slug, true);
}
