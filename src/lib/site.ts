/**
 * Static storefront chrome content: navigation, announcement messages, footer columns.
 * This is the default until the CMS (announcements, nav) takes over; the shell components only
 * depend on these shapes, so swapping the source later does not touch them.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface MegaMenuTile {
  eyebrow: string;
  title: string;
  href: string;
  image: string;
  imageAlt: string;
}

export interface NavItem extends NavLink {
  /** Columns of links shown in the mega menu. Items without columns are plain links. */
  columns?: Array<{ heading: string; links: NavLink[] }>;
  tile?: MegaMenuTile;
}

export const PRIMARY_NAV: NavItem[] = [
  {
    label: 'Shop',
    href: '/shop',
    columns: [
      {
        heading: 'Clothing',
        links: [
          { label: 'Shirts', href: '/shop/shirts' },
          { label: 'Trousers', href: '/shop/trousers' },
          { label: 'Tailoring', href: '/shop/tailoring' },
          { label: 'Knitwear', href: '/shop/knitwear' },
          { label: 'Polos', href: '/shop/polos' },
        ],
      },
      {
        heading: 'Accessories',
        links: [
          { label: 'Belts', href: '/shop/accessories' },
          { label: 'Scarves', href: '/shop/accessories' },
          { label: 'Wallets', href: '/shop/accessories' },
        ],
      },
      {
        heading: 'Discover',
        links: [
          { label: 'Shop all', href: '/shop' },
          { label: 'Bestsellers', href: '/collections/bestsellers' },
          { label: 'Size guide', href: '/size-guide' },
        ],
      },
    ],
    tile: {
      eyebrow: 'The edit',
      title: 'Essentials in Egyptian cotton',
      href: '/collections/essentials',
      image: '/seed/sand.svg',
      imageAlt: 'Sand coloured shirt',
    },
  },
  { label: 'New', href: '/new' },
  {
    label: 'Collections',
    href: '/collections',
    columns: [
      {
        heading: 'Collections',
        links: [
          { label: 'Essentials', href: '/collections/essentials' },
          { label: 'Tailoring', href: '/collections/tailoring' },
          { label: 'Eid edit', href: '/collections/eid-edit' },
          { label: 'Winter layers', href: '/collections/winter-layers' },
        ],
      },
      {
        heading: 'By occasion',
        links: [
          { label: 'Work', href: '/collections/work' },
          { label: 'Weekend', href: '/collections/weekend' },
          { label: 'Wedding guest', href: '/collections/wedding-guest' },
        ],
      },
    ],
    tile: {
      eyebrow: 'Lookbook',
      title: 'Quiet tailoring, worn in',
      href: '/lookbook',
      image: '/seed/charcoal.svg',
      imageAlt: 'Charcoal tailoring',
    },
  },
  { label: 'Lookbook', href: '/lookbook' },
  { label: 'Journal', href: '/journal' },
];

/** Shown in the announcement bar (at most three; the bar enforces it). */
export const ANNOUNCEMENTS: string[] = [
  'Complimentary delivery over ৳5,000',
  'Easy size exchange',
  'Cash on delivery across Bangladesh',
];

export const FOOTER_COLUMNS: Array<{ heading: string; links: NavLink[] }> = [
  {
    heading: 'Shop',
    links: [
      { label: 'New arrivals', href: '/new' },
      { label: 'Shirts', href: '/shop/shirts' },
      { label: 'Trousers', href: '/shop/trousers' },
      { label: 'Tailoring', href: '/shop/tailoring' },
      { label: 'Knitwear', href: '/shop/knitwear' },
    ],
  },
  {
    heading: 'Client care',
    links: [
      { label: 'Shipping', href: '/shipping' },
      { label: 'Returns and exchange', href: '/returns' },
      { label: 'Size guide', href: '/size-guide' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'The house',
    links: [
      { label: 'Our story', href: '/about' },
      { label: 'Journal', href: '/journal' },
      { label: 'Lookbook', href: '/lookbook' },
    ],
  },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export const PAYMENT_MARKS = ['Cash on delivery', 'bKash', 'Nagad', 'Visa', 'Mastercard'] as const;

/** Social profiles appear in the footer only when the owner supplies the address. */
export const SOCIAL_LINKS: NavLink[] = [];

/** WhatsApp number in international format without "+" (digits only), or undefined. */
export function conciergeHref(whatsappNumber: string | undefined): string {
  const digits = (whatsappNumber ?? '').replace(/\D/g, '');
  return digits.length >= 8
    ? `https://wa.me/${digits}?text=${encodeURIComponent('Hello AUREN, I would like some help.')}`
    : '/contact';
}

/** Pages where the floating concierge button is hidden (distraction-free checkout). */
export function hidesConcierge(pathname: string): boolean {
  return pathname === '/checkout' || pathname.startsWith('/checkout/');
}

/** Pages whose first section is a full-bleed hero, so the header starts transparent. */
export function hasHeroHeader(pathname: string): boolean {
  return pathname === '/';
}
