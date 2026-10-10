import { assertPermission } from '@/lib/permissions';
import { requireStaff } from '@/lib/staff';
import * as service from './service';
import type { ArticleListItem, ArticleDetailItem, ArticleFilterParams } from './types';

// =============================================================================================
// Storefront Queries (Public)
// =============================================================================================

export async function getStorefrontArticlesQuery(
  filter?: ArticleFilterParams,
): Promise<{ items: ArticleListItem[]; totalCount: number }> {
  return service.listArticles({ ...filter, status: 'published' });
}

export async function getStorefrontArticleDetailQuery(
  slug: string,
): Promise<ArticleDetailItem | null> {
  return service.getArticleBySlug(slug, true);
}

export async function getStorefrontCategoriesAndTagsQuery(): Promise<{
  categories: string[];
  tags: string[];
}> {
  return service.getDistinctCategoriesAndTags();
}

export async function getJournalRssXmlQuery(siteUrl: string): Promise<string> {
  return service.generateRssFeedXml(siteUrl);
}

// =============================================================================================
// Admin Queries (Guarded by requireStaff and content.manage)
// =============================================================================================

export async function getAdminArticlesQuery(
  filter?: ArticleFilterParams,
): Promise<{ items: ArticleListItem[]; totalCount: number }> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');
  return service.listArticles(filter);
}

export async function getAdminArticleDetailQuery(id: string): Promise<ArticleDetailItem | null> {
  const staff = await requireStaff();
  assertPermission(staff, 'content.manage');
  return service.getArticleById(id);
}
