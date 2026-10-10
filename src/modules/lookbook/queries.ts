import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import * as service from './service';
import type {
  LookbookListItem,
  LookbookDetailItem,
  LookbookFilterParams,
  ProductSummaryForHotspot,
} from './types';

// =============================================================================================
// Storefront Queries (Public)
// =============================================================================================

export async function getStorefrontLookbooksQuery(): Promise<LookbookListItem[]> {
  return service.listLookbooks({ status: 'published' });
}

export async function getStorefrontLookbookDetailQuery(
  slug: string,
): Promise<LookbookDetailItem | null> {
  return service.getLookbookBySlug(slug, true);
}

// =============================================================================================
// Admin Queries (Guarded by requireStaff and content.manage)
// =============================================================================================

export async function getAdminLookbooksQuery(
  filter?: LookbookFilterParams,
): Promise<LookbookListItem[]> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');
  return service.listLookbooks(filter);
}

export async function getAdminLookbookDetailQuery(id: string): Promise<LookbookDetailItem | null> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');
  return service.getLookbookById(id);
}

export async function searchProductsForHotspotsQuery(
  query: string,
): Promise<ProductSummaryForHotspot[]> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');
  return service.searchProductsForHotspots(query);
}
