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
          { label: 'New arrivals', href: '/shop?sort=newest' },
        ],
      },
    ],
    tile: {
      eyebrow: 'The edit',
      title: 'Winter layers',
      href: '/collections/winter-layers',
      image: '/seed/sand.svg',
      imageAlt: 'Sand coloured shirt',
    },
  },
  { label: 'New', href: '/shop?sort=newest' },
  {
    label: 'Collections',
    href: '/collections',
    columns: [
      {
        heading: 'Collections',
        links: [
          { label: 'Winter layers', href: '/collections/winter-layers' },
          { label: 'The summer edit', href: '/collections/the-summer-edit' },
          { label: 'Tailoring for occasions', href: '/collections/tailoring-for-occasions' },
        ],
      },
    ],
    tile: {
      eyebrow: 'Lookbook',
      title: 'Tailoring for occasions',
      href: '/collections/tailoring-for-occasions',
      image: '/seed/charcoal.svg',
      imageAlt: 'Charcoal tailoring',
    },
  },
];

/** Shown in the announcement bar (at most three; the bar enforces it). */
export const ANNOUNCEMENTS: string[] = [
  'Complimentary delivery over ৳5,000',
  'Easy size exchange',
  'Cash on delivery across Bangladesh',
];

/**
 * Only pages that exist are linked: the lookbook, journal, policies and contact pages are added
 * here as they are built.
 */
export const FOOTER_COLUMNS: Array<{ heading: string; links: NavLink[] }> = [
  {
    heading: 'Shop',
    links: [
      { label: 'New arrivals', href: '/shop?sort=newest' },
      { label: 'Shirts', href: '/shop/shirts' },
      { label: 'Trousers', href: '/shop/trousers' },
      { label: 'Tailoring', href: '/shop/tailoring' },
      { label: 'Knitwear', href: '/shop/knitwear' },
      { label: 'All collections', href: '/collections' },
    ],
  },
  {
    heading: 'Client care',
    links: [
      { label: 'Track your order', href: '/track' },
      { label: 'Shipping & delivery', href: '/shipping' },
      { label: 'Returns & exchanges', href: '/returns' },
      { label: 'Size & fit guide', href: '/size-guide' },
      { label: 'Frequently asked questions', href: '/faq' },
      { label: 'Contact concierge', href: '/contact' },
    ],
  },
  {
    heading: 'The House',
    links: [
      { label: 'About AUREN', href: '/about' },
      { label: 'The atelier & craft', href: '/about#craftsmanship' },
      { label: 'Natural fiber standards', href: '/about#fabrics' },
      { label: 'Client concierge desk', href: '/contact' },
    ],
  },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Terms of service', href: '/terms' },
  { label: 'Size guide', href: '/size-guide' },
];

export const PAYMENT_MARKS = ['Cash on delivery', 'bKash', 'Nagad', 'Visa', 'Mastercard'] as const;

/** Social profiles appear in the footer only when the owner supplies the address. */
export const SOCIAL_LINKS: NavLink[] = [
  { label: 'Instagram', href: 'https://instagram.com/auren.menswear' },
  { label: 'Facebook', href: 'https://facebook.com/auren.menswear' },
  { label: 'WhatsApp', href: 'https://wa.me/8801700000000' },
];

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
