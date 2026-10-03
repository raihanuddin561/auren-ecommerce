import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { ProductRowView } from './types';
import { ProductStatusBadge } from './status-badge';

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });

const head = 'border-b border-line px-4 py-3 text-left type-eyebrow text-fg-muted';
const cell = 'px-4 py-3 align-middle';

/**
 * The product list. Server rendered: the title is a real link (keyboard and screen reader users
 * land on it), and secondary columns drop away on small screens.
 */
export function ProductTable({ rows }: { rows: ProductRowView[] }) {
  return (
    <div className="overflow-x-auto border border-line bg-raised">
      <table className="w-full border-collapse type-admin">
        <caption className="sr-only">Products</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(head, 'w-16')}>
              <span className="sr-only">Image</span>
            </th>
            <th scope="col" className={head}>
              Product
            </th>
            <th scope="col" className={head}>
              Status
            </th>
            <th scope="col" className={cn(head, 'hidden md:table-cell')}>
              Category
            </th>
            <th scope="col" className={cn(head, 'hidden text-right md:table-cell')}>
              Variants
            </th>
            <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
              Price
            </th>
            <th scope="col" className={cn(head, 'hidden lg:table-cell')}>
              Updated
            </th>
            <th scope="col" className={cn(head, 'hidden sm:table-cell')}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = `/admin/products/${row.id}`;
            return (
              <tr
                key={row.id}
                className="border-b border-line transition-auren-fast last:border-b-0 hover:bg-sunken/60"
              >
                <td className={cn(cell, 'w-16')}>
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- already optimised at upload
                    <img
                      src={row.imageUrl}
                      alt={row.imageAlt ?? ''}
                      width={40}
                      height={50}
                      loading="lazy"
                      className="aspect-[4/5] w-10 border border-line object-cover"
                    />
                  ) : (
                    <span
                      role="img"
                      aria-label="No image"
                      className="flex aspect-[4/5] w-10 items-center justify-center border border-line bg-sunken text-fg-muted"
                    >
                      <Icon icon={ImageOff} size={16} />
                    </span>
                  )}
                </td>
                <td className={cn(cell, 'min-w-48')}>
                  <Link
                    href={href}
                    className="font-medium text-fg underline-offset-4 hover:underline focus-visible:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="type-small text-fg-muted">/products/{row.slug}</p>
                </td>
                <td className={cell}>
                  <ProductStatusBadge status={row.status} />
                </td>
                <td className={cn(cell, 'hidden md:table-cell')}>
                  {row.categoryName ?? <span className="text-fg-muted">None</span>}
                </td>
                <td className={cn(cell, 'hidden text-right tabular-nums md:table-cell')}>
                  {row.variantCount}
                </td>
                <td className={cn(cell, 'hidden whitespace-nowrap tabular-nums lg:table-cell')}>
                  {row.priceRange ?? <span className="text-fg-muted">No price</span>}
                </td>
                <td className={cn(cell, 'hidden whitespace-nowrap lg:table-cell')}>
                  {dateFormat.format(row.updatedAt)}
                </td>
                <td className={cn(cell, 'hidden text-right sm:table-cell')}>
                  <Link
                    href={href}
                    aria-label={`Edit ${row.title}`}
                    className="inline-flex min-h-11 items-center px-2 text-fg underline decoration-gold underline-offset-4 hover:decoration-2"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
