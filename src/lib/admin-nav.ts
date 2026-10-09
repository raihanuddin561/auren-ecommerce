import {
  BarChart3,
  ClipboardCheck,
  FileText,
  FolderTree,
  History,
  Layers,
  LayoutDashboard,
  Megaphone,
  MessageSquareQuote,
  Package,
  Palette,
  PackageSearch,
  Receipt,
  RotateCcw,
  Ruler,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  UserCog,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from './permissions';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from staff who lack it. Items without one are open to every active staff member. */
  permission?: Permission;
  /** False until the screen exists: shown as "Soon" and not linked. */
  ready: boolean;
  /** Extra words the command palette matches on. */
  keywords?: string[];
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, ready: true }],
  },
  {
    label: 'Sales',
    items: [
      {
        label: 'Verification queue',
        href: '/admin/orders/verification',
        icon: ClipboardCheck,
        permission: 'orders.verify',
        ready: true,
        keywords: ['confirm', 'orders', 'verify', 'call'],
      },
      {
        label: 'Orders',
        href: '/admin/orders',
        icon: ShoppingCart,
        permission: 'orders.read',
        ready: true,
      },
      {
        label: 'Returns',
        href: '/admin/returns',
        icon: RotateCcw,
        permission: 'returns.manage',
        ready: true,
        keywords: ['exchange'],
      },
      {
        label: 'Approvals',
        href: '/admin/approvals',
        icon: ShieldCheck,
        permission: 'approvals.decide',
        ready: true,
        keywords: ['refund', 'second person', 'maker checker'],
      },
      {
        label: 'Shipping',
        href: '/admin/shipping',
        icon: Truck,
        permission: 'shipping.manage',
        ready: true,
        keywords: ['courier', 'delivery', 'parcel', 'packaging'],
      },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      {
        label: 'Products',
        href: '/admin/products',
        icon: Package,
        permission: 'catalog.read',
        ready: true,
        keywords: ['sku', 'variants', 'catalogue', 'items'],
      },
      {
        label: 'Categories',
        href: '/admin/categories',
        icon: FolderTree,
        permission: 'catalog.read',
        ready: true,
        keywords: ['tree', 'shirts', 'trousers'],
      },
      {
        label: 'Collections',
        href: '/admin/collections',
        icon: Layers,
        permission: 'catalog.read',
        ready: true,
        keywords: ['curated', 'rules', 'merchandising'],
      },
      {
        label: 'Size charts',
        href: '/admin/size-charts',
        icon: Ruler,
        permission: 'catalog.read',
        ready: true,
        keywords: ['measurements', 'sizing', 'fit guide'],
      },
      {
        label: 'Inventory',
        href: '/admin/inventory',
        icon: PackageSearch,
        permission: 'inventory.read',
        ready: true,
        keywords: ['stock'],
      },
      {
        label: 'Purchasing',
        href: '/admin/purchasing',
        icon: Receipt,
        permission: 'purchasing.manage',
        ready: true,
        keywords: ['purchase orders', 'po', 'goods receipt'],
      },
      {
        label: 'Suppliers',
        href: '/admin/suppliers',
        icon: Truck,
        permission: 'purchasing.manage',
        ready: true,
        keywords: ['vendor', 'factory'],
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        label: 'Customers',
        href: '/admin/customers',
        icon: Users,
        permission: 'customers.read',
        ready: true,
        keywords: ['users', 'clients', 'addresses', 'ltv', 'profiles'],
      },
      {
        label: 'Promotions',
        href: '/admin/promotions',
        icon: Tag,
        permission: 'promotions.manage',
        ready: true,
        keywords: ['discount', 'coupon'],
      },
      {
        label: 'Reviews',
        href: '/admin/reviews',
        icon: MessageSquareQuote,
        permission: 'reviews.moderate',
        ready: false,
      },
      {
        label: 'Content',
        href: '/admin/content',
        icon: FileText,
        permission: 'content.manage',
        ready: false,
        keywords: ['pages', 'journal'],
      },
      {
        label: 'Marketing',
        href: '/admin/marketing',
        icon: Megaphone,
        permission: 'promotions.manage',
        ready: false,
        keywords: ['email', 'sms'],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Finance',
        href: '/admin/finance',
        icon: Wallet,
        permission: 'finance.read',
        ready: false,
        keywords: ['profit', 'expenses'],
      },
      {
        label: 'Analytics',
        href: '/admin/analytics',
        icon: BarChart3,
        permission: 'analytics.read',
        ready: false,
        keywords: ['reports'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
        permission: 'settings.manage',
        ready: true,
        keywords: [
          'shipping',
          'delivery',
          'cash on delivery',
          'zones',
          'carousel',
          'hero',
          'banner',
          'slides',
        ],
      },
      {
        label: 'Staff',
        href: '/admin/settings/staff',
        icon: UserCog,
        permission: 'staff.manage',
        ready: true,
        keywords: ['roles', 'team', 'permissions', 'users'],
      },
      {
        label: 'Audit log',
        href: '/admin/audit',
        icon: History,
        permission: 'audit.read',
        ready: false,
      },
      {
        label: 'Style guide',
        href: '/admin/style-guide',
        icon: Palette,
        ready: true,
        keywords: ['components', 'design system'],
      },
    ],
  },
];

/** Groups and items the given staff member may see. Empty groups are dropped. */
export function visibleAdminNav(permissions: readonly string[]): AdminNavGroup[] {
  const held = new Set(permissions);
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || held.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** Exact match for the dashboard, prefix match for everything else. */
export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}
