import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Brand type sizes (`text-small`) share the `text-` prefix with colours; tell the merger. */
const merge = extendTailwindMerge<'type-role' | 'tracking-brand'>({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['display-xl', 'display-lg', 'h1', 'h2', 'h3', 'body', 'small', 'admin', 'eyebrow'],
        },
      ],
      'type-role': [
        {
          type: [
            'display-xl',
            'display-lg',
            'h1',
            'h2',
            'h3',
            'body',
            'small',
            'admin',
            'eyebrow',
            'wordmark',
            'price',
          ],
        },
      ],
      'tracking-brand': [{ tracking: ['wordmark', 'eyebrow', 'button'] }],
    },
    conflictingClassGroups: { 'tracking-brand': ['tracking'] },
  },
});

/** Merge conditional class names and resolve conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
