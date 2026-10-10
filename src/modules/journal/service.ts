import { revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import { audit } from '@/modules/audit/service';
import * as repo from './repository';
import type {
  ArticleListItem,
  ArticleDetailItem,
  ArticleFilterParams,
  CreateArticleInput,
  UpdateArticleInput,
  RssFeedItem,
} from './types';

export interface AuditActor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

function calculateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export async function listArticles(
  filter?: ArticleFilterParams,
): Promise<{ items: ArticleListItem[]; totalCount: number }> {
  return repo.listArticles(filter);
}

export async function getArticleBySlug(
  slug: string,
  onlyPublished = true,
): Promise<ArticleDetailItem | null> {
  return repo.getArticleBySlug(slug, onlyPublished);
}

export async function getArticleById(id: string): Promise<ArticleDetailItem | null> {
  return repo.getArticleById(id);
}

export async function createArticle(
  input: CreateArticleInput,
  actor: AuditActor,
): Promise<{ id: string; slug: string }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.article.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new DomainError('CONFLICT', `An article with slug "${input.slug}" already exists`);
    }

    const readTimeMinutes = input.readTimeMinutes ?? calculateReadingTime(input.content);
    const created = await repo.createArticle({ ...input, readTimeMinutes });

    await audit(tx, {
      actorId: actor.userId,
      action: 'article.create',
      entity: 'article',
      entityId: created.id,
      after: {
        title: input.title,
        slug: input.slug,
        category: input.category,
        status: input.status,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag('articles', 'max');
      revalidateTag('rss-feed', 'max');
    } catch {
      // In test context
    }

    return created;
  });
}

export async function updateArticle(input: UpdateArticleInput, actor: AuditActor): Promise<void> {
  return db.$transaction(async (tx) => {
    const current = await tx.article.findUnique({ where: { id: input.id } });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Article not found');
    }

    if (input.slug && input.slug !== current.slug) {
      const existing = await tx.article.findUnique({ where: { slug: input.slug } });
      if (existing && existing.id !== input.id) {
        throw new DomainError('CONFLICT', `An article with slug "${input.slug}" already exists`);
      }
    }

    const readTimeMinutes =
      input.content && !input.readTimeMinutes
        ? calculateReadingTime(input.content)
        : input.readTimeMinutes;

    const updated = await repo.updateArticle(input.id, { ...input, readTimeMinutes });

    await audit(tx, {
      actorId: actor.userId,
      action: 'article.update',
      entity: 'article',
      entityId: updated.id,
      before: { title: current.title, slug: current.slug, status: current.status },
      after: { title: updated.title, slug: updated.slug, status: updated.status },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag('articles', 'max');
      revalidateTag(`article:${current.slug}`, 'max');
      if (updated.slug !== current.slug) {
        revalidateTag(`article:${updated.slug}`, 'max');
      }
      revalidateTag('rss-feed', 'max');
    } catch {
      // In test context
    }
  });
}

export async function deleteArticle(id: string, actor: AuditActor): Promise<void> {
  return db.$transaction(async (tx) => {
    const current = await tx.article.findUnique({ where: { id } });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Article not found');
    }

    await repo.deleteArticle(id);

    await audit(tx, {
      actorId: actor.userId,
      action: 'article.delete',
      entity: 'article',
      entityId: id,
      before: { title: current.title, slug: current.slug },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    try {
      revalidateTag('articles', 'max');
      revalidateTag(`article:${current.slug}`, 'max');
      revalidateTag('rss-feed', 'max');
    } catch {
      // In test context
    }
  });
}

export async function getDistinctCategoriesAndTags() {
  return repo.getDistinctCategoriesAndTags();
}

export async function generateRssFeedXml(baseUrl: string): Promise<string> {
  const items = await repo.getPublishedArticlesForRss(30);

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const buildDate = new Date().toUTCString();

  const xmlItems = items
    .map(
      (item: RssFeedItem) => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${cleanBaseUrl}/journal/${item.slug}</link>
      <guid isPermaLink="true">${cleanBaseUrl}/journal/${item.slug}</guid>
      <description><![CDATA[${item.excerpt}]]></description>
      <pubDate>${item.publishedAt.toUTCString()}</pubDate>
      <author><![CDATA[${item.authorName}]]></author>
      <category><![CDATA[${item.category}]]></category>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AUREN Journal — Atelier &amp; Sartorial Notes</title>
    <link>${cleanBaseUrl}/journal</link>
    <description>Essays on craftsmanship, noble fibers, architectural tailoring, and contemporary Dhaka menswear.</description>
    <language>en-US</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${cleanBaseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${xmlItems}
  </channel>
</rss>`;
}
