import type { Locale } from './types';

/**
 * Curated, quiet-luxury menswear vocabulary for Bangladesh.
 * Translates categories, colors, fabrics, sizes, badges, order statuses, and attributes.
 */
export const CATALOG_TERMS: Record<string, string> = {
  // Categories & Departments
  Shop: 'কেনাকাটা',
  Clothing: 'পোশাক',
  Shirts: 'শার্ট',
  Shirt: 'শার্ট',
  Trousers: 'ট্রাউজার',
  Trouser: 'ট্রাউজার',
  Tailoring: 'টেইলরিং',
  Panjabi: 'পাঞ্জাবি',
  Panjabis: 'পাঞ্জাবি',
  Kurta: 'কুর্তা',
  Knitwear: 'নিটওয়্যার',
  Sweater: 'সোয়েটার',
  Polos: 'পোলো',
  Polo: 'পোলো',
  Suits: 'স্যুট',
  Suit: 'স্যুট',
  Blazers: 'ব্লেজার',
  Blazer: 'ব্লেজার',
  Jackets: 'জ্যাকেট',
  Jacket: 'জ্যাকেট',
  Outerwear: 'আউটারওয়্যার',
  Coats: 'কোট',
  Coat: 'কোট',
  Accessories: 'এক্সেসরিজ',
  Belts: 'বেল্ট',
  Belt: 'বেল্ট',
  Wallets: 'ওয়ালেট',
  Wallet: 'ওয়ালেট',
  Scarves: 'স্কার্ফ',
  Scarf: 'স্কার্ফ',
  'Pocket Squares': 'পকেট স্কয়ার',
  'Pocket Square': 'পকেট স্কয়ার',
  Footwear: 'জুতো',
  Shoes: 'জুতো',
  Discover: 'আবিষ্কার করুন',
  'Shop all': 'সব পোশাক',
  'New arrivals': 'নতুন সংগ্রহ',
  Collections: 'কালেকশন',
  Lookbook: 'লুকবুক',
  Journal: 'জার্নাল',
  Atelier: 'অ্যাটেলিয়ার',

  // Curated Seasonal Collections
  'Winter layers': 'শীতের পোশাক',
  'Winter Layers': 'শীতের পোশাক',
  'The summer edit': 'সামার এডিট',
  'The Summer Edit': 'সামার এডিট',
  'Tailoring for occasions': 'বিশেষ অনুষ্ঠানের টেইলরিং',
  'Tailoring for Occasions': 'বিশেষ অনুষ্ঠানের টেইলরিং',
  'The edit': 'দি এডিট',
  'The Edit': 'দি এডিট',
  'All collections': 'সব কালেকশন',

  // Colors & Shades
  Ivory: 'আইভরি',
  Charcoal: 'চারকোল',
  Navy: 'নেভি ব্লু',
  'Midnight Blue': 'মিডনাইট ব্লু',
  Black: 'কালো',
  White: 'সাদা',
  'Off White': 'অফ-হোয়াইট',
  'Off-White': 'অফ-হোয়াইট',
  Olive: 'অলিভ',
  'Forest Green': 'ফরেস্ট গ্রিন',
  Burgundy: 'বার্গান্ডি',
  Camel: 'ক্যামেল',
  Sage: 'সেইজ',
  Ecru: 'এক্ৰু',
  Beige: 'বেইজ',
  Brown: 'বাদামি',
  Tan: 'ট্যান',
  Grey: 'ধূসর',
  Gray: 'ধূসর',
  Silver: 'রূপালি',
  Gold: 'সোনালি',
  Khaki: 'খাকি',
  Sand: 'স্যান্ড',
  'Sky Blue': 'আকাশি',
  Stone: 'স্টোন',
  Rust: 'রাস্ট',
  Terracotta: 'টেরাকোটা',
  Indigo: 'ইন্ডিগো',
  Maroon: 'মেরুন',
  Cream: 'ক্রিম',

  // Fabrics, Weaves & Noble Materials
  'Egyptian Cotton': 'মিশরীয় তুলা',
  'Irish Linen': 'আইরিশ লিনেন',
  'Merino Wool': 'মেরিনো উল',
  'Mulberry Silk': 'তুঁত রেশম',
  Cashmere: 'কাশ্মীরি উল',
  Cotton: 'কটন',
  Linen: 'লিনেন',
  Wool: 'পশম / উল',
  Silk: 'সিল্ক',
  Oxford: 'অক্সফোর্ড',
  Twill: 'টুইল',
  Poplin: 'পপলিন',
  Herringbone: 'হেরিংবোন',
  Jacquard: 'জ্যাকার্ড',
  Flannel: 'ফ্লানেল',
  Chambray: 'শামব্রে',
  Seersucker: 'সিয়ারসাকার',
  Sateen: 'সাটিন',
  Satin: 'সাটিন',
  Denim: 'ডেনিম',
  Suede: 'সুয়েড',
  Leather: 'চামড়া / লেদার',
  Pima: 'পিমা কটন',
  Giza: 'গিজা কটন',

  // Cuts, Fits & Silhouettes
  'Slim fit': 'স্লিম ফিট',
  'Slim Fit': 'স্লিম ফিট',
  Slim: 'স্লিম',
  'Regular fit': 'রেগুলার ফিট',
  'Regular Fit': 'রেগুলার ফিট',
  Regular: 'রেগুলার',
  'Relaxed fit': 'রিল্যাক্সড ফিট',
  'Relaxed Fit': 'রিল্যাক্সড ফিট',
  Relaxed: 'রিল্যাক্সড',
  'Tailored fit': 'টেইলরড ফিট',
  'Tailored Fit': 'টেইলরড ফিট',
  'Classic fit': 'ক্লাসিক ফিট',
  'Classic Fit': 'ক্লাসিক ফিট',

  // Sizes & Dimensions
  Small: 'ছোট (S)',
  Medium: 'মাঝারি (M)',
  Large: 'বড় (L)',
  'Extra Large': 'এক্সট্রা লার্জ (XL)',
  'Double Extra Large': 'ডাবল এক্সএল (XXL)',
  Chest: 'বুক / চেস্ট',
  Waist: 'কোমর / ওয়েস্ট',
  Inseam: 'ইনসিম',
  Length: 'দৈর্ঘ্য',
  Sleeve: 'হাতা / স্লিভ',
  Collar: 'কলার',
  Shoulder: 'কাঁধ / শোল্ডার',

  // Badges & Merchandising Tags
  New: 'নতুন',
  'New arrival': 'নতুন সংগ্রহ',
  'New Arrival': 'নতুন সংগ্রহ',
  'Best seller': 'সেরা বিক্রিত',
  'Best Seller': 'সেরা বিক্রিত',
  'Limited edition': 'সীমিত সংস্করণ',
  'Limited Edition': 'সীমিত সংস্করণ',
  'Limited Release': 'সীমিত সংস্করণ',
  Handcrafted: 'হস্তনির্মিত',
  'Made to order': 'অর্ডার অনুযায়ী তৈরি',
  'Made to Order': 'অর্ডার অনুযায়ী তৈরি',
  Exclusive: 'বিশেষ কালেকশন',
  Archival: 'আর্কাইভাল',
  Bespoke: 'বিস্পোক',
  Seasonal: 'মৌসুমি',
  Essential: 'এসেনশিয়াল',
  'Low stock': 'সীমিত স্টক',
  'Low Stock': 'সীমিত স্টক',
  'Sold out': 'স্টক শেষ',
  'Sold Out': 'স্টক শেষ',
  'In stock': 'মজুদ আছে',
  'In Stock': 'মজুদ আছে',

  // Order & Fulfillment Statuses
  pending: 'অপেক্ষমান',
  Pending: 'অপেক্ষমান',
  placed: 'অর্ডার গৃহীত',
  Placed: 'অর্ডার গৃহীত',
  under_verification: 'যাচাই প্রক্রিয়াধীন',
  'Under Verification': 'যাচাই প্রক্রিয়াধীন',
  confirmed: 'নিশ্চিতকৃত',
  Confirmed: 'নিশ্চিতকৃত',
  processing: 'প্রস্তুত হচ্ছে',
  Processing: 'প্রস্তুত হচ্ছে',
  shipped: 'শিপমেন্টে আছে',
  Shipped: 'শিপমেন্টে আছে',
  in_transit: 'ডেলিভারির পথে',
  'In Transit': 'ডেলিভারির পথে',
  out_for_delivery: 'ডেলিভারির পথে',
  'Out for Delivery': 'ডেলিভারির পথে',
  delivered: 'ডেলিভারি সম্পন্ন',
  Delivered: 'ডেলিভারি সম্পন্ন',
  cancelled: 'বাতিল',
  Cancelled: 'বাতিল',
  returned: 'ফেরত',
  Returned: 'ফেরত',
  refunded: 'মূল্য ফেরত দেওয়া হয়েছে',
  Refunded: 'মূল্য ফেরত দেওয়া হয়েছে',
  on_hold: 'স্থগিত',
  'On Hold': 'স্থগিত',
};

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/**
 * Converts Western digits (0-9) to Bengali digits (০-৯).
 */
export function toBengaliDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)] ?? d);
}

/**
 * Translates a single category or collection label.
 */
export function translateCategory(name: string | null | undefined, locale: Locale): string {
  if (!name) return '';
  if (locale !== 'bn') return name;
  return CATALOG_TERMS[name] || CATALOG_TERMS[name.trim()] || name;
}

/**
 * Translates a color name.
 */
export function translateColor(color: string | null | undefined, locale: Locale): string {
  if (!color) return '';
  if (locale !== 'bn') return color;
  return CATALOG_TERMS[color] || CATALOG_TERMS[color.trim()] || color;
}

/**
 * Translates a size name or option value.
 */
export function translateSize(size: string | null | undefined, locale: Locale): string {
  if (!size) return '';
  if (locale !== 'bn') return size;
  return CATALOG_TERMS[size] || CATALOG_TERMS[size.trim()] || size;
}

/**
 * Translates a badge label.
 */
export function translateBadge(badge: string | null | undefined, locale: Locale): string {
  if (!badge) return '';
  if (locale !== 'bn') return badge;
  return CATALOG_TERMS[badge] || CATALOG_TERMS[badge.trim()] || badge;
}

/**
 * Translates order or checkout statuses.
 */
export function translateOrderStatus(status: string | null | undefined, locale: Locale): string {
  if (!status) return '';
  if (locale !== 'bn') return status;
  return CATALOG_TERMS[status] || CATALOG_TERMS[status.trim()] || status;
}

/**
 * Translates a garment or catalog detail label and value.
 */
export function translateDetailLabel(label: string, locale: Locale): string {
  if (locale !== 'bn') return label;
  const map: Record<string, string> = {
    Fabric: 'ফ্যাব্রিক',
    Material: 'উপাদান',
    Care: 'যত্ন',
    Fit: 'ফিট',
    Origin: 'উৎপাদন',
    Pattern: 'প্যাটার্ন',
    Occasion: 'উপলক্ষ',
    Season: 'মৌসুম',
  };
  return map[label] || label;
}

/**
 * Translates detail values (such as "Slim", "Egyptian Cotton", "Dry clean only").
 */
export function translateDetailValue(val: string, locale: Locale): string {
  if (locale !== 'bn') return val;
  if (CATALOG_TERMS[val]) return CATALOG_TERMS[val];
  return translateCatalogPhrase(val);
}

/**
 * Smart phrase translator for product titles and descriptions.
 * Matches recognized luxury fashion keywords (fabrics, cuts, garments, colors)
 * and composes an authentic, natural Bengali representation.
 */
export function translateCatalogPhrase(text: string): string {
  if (!text) return text;

  // Direct match
  if (CATALOG_TERMS[text]) return CATALOG_TERMS[text];

  // Token replacement pass
  // Sort keys by length descending to match multi-word phrases first (e.g. "Egyptian Cotton" before "Cotton")
  const phrases = [
    ['Egyptian Cotton', 'মিশরীয় কটন'],
    ['Irish Linen', 'আইরিশ লিনেন'],
    ['Merino Wool', 'মেরিনো উল'],
    ['Mulberry Silk', 'তুঁত সিল্ক'],
    ['Royal Oxford', 'রয়েল অক্সফোর্ড'],
    ['Winter Layers', 'শীতের পোশাক'],
    ['The Summer Edit', 'সামার এডিট'],
    ['Tailoring for Occasions', 'অনুষ্ঠানের টেইলরিং'],
    ['Slim Fit', 'স্লিম ফিট'],
    ['Regular Fit', 'রেগুলার ফিট'],
    ['Relaxed Fit', 'রিল্যাক্সড ফিট'],
    ['Tailored Fit', 'টেইলরড ফিট'],
    ['Button Down', 'বাটন ডাউন'],
    ['Spread Collar', 'স্প্রেড কলার'],
    ['Band Collar', 'ব্যান্ড কলার'],
    ['Mandarin Collar', 'ম্যান্ডারিন কলার'],
    ['Short Sleeve', 'হাফ হাতা'],
    ['Long Sleeve', 'ফুল হাতা'],
    ['Double Cuff', 'ডাবল কাফ'],
    ['French Cuff', 'ফ্রেঞ্চ কাফ'],
    ['Cashmere', 'কাশ্মীরি উল'],
    ['Flannel', 'ফ্লানেল'],
    ['Poplin', 'পপলিন'],
    ['Oxford', 'অক্সফোর্ড'],
    ['Linen', 'লিনেন'],
    ['Cotton', 'কটন'],
    ['Wool', 'উল'],
    ['Silk', 'সিল্ক'],
    ['Shirt', 'শার্ট'],
    ['Shirts', 'শার্ট'],
    ['Trouser', 'ট্রাউজার'],
    ['Trousers', 'ট্রাউজার'],
    ['Suit', 'স্যুট'],
    ['Suits', 'স্যুট'],
    ['Blazer', 'ব্লেজার'],
    ['Blazers', 'ব্লেজার'],
    ['Jacket', 'জ্যাকেট'],
    ['Jackets', 'জ্যাকেট'],
    ['Panjabi', 'পাঞ্জাবি'],
    ['Polo', 'পোলো'],
    ['Polos', 'পোলো'],
    ['Ivory', 'আইভরি'],
    ['Charcoal', 'চারকোল'],
    ['Navy', 'নেভি'],
    ['Black', 'কালো'],
    ['White', 'সাদা'],
    ['Olive', 'অলিভ'],
    ['Burgundy', 'বার্গান্ডি'],
    ['Camel', 'ক্যামেল'],
    ['Sage', 'সেইজ'],
    ['Ecru', 'এক্ৰু'],
    ['Beige', 'বেইজ'],
    ['Brown', 'বাদামি'],
    ['Grey', 'ধূসর'],
    ['Gray', 'ধূসর'],
    ['Khaki', 'খাকি'],
    ['Sand', 'স্যান্ড'],
  ] as const;

  let result = text;
  for (const [en, bn] of phrases) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    result = result.replace(regex, bn);
  }

  return result;
}

/**
 * Translates a product title:
 * 1. Honors explicit Bangla title if stored in attributes (Hybrid DB override)
 * 2. Otherwise applies the smart luxury menswear phrase mapper.
 */
export function translateProductTitle(
  title: string | null | undefined,
  locale: Locale,
  explicitBn?: string | null,
): string {
  if (!title) return '';
  if (locale !== 'bn') return title;

  // 1. Explicit DB override
  if (explicitBn && explicitBn.trim()) {
    return explicitBn.trim();
  }

  // 2. Direct glossary match
  if (CATALOG_TERMS[title]) {
    return CATALOG_TERMS[title];
  }

  // 3. Smart phrase mapper
  return translateCatalogPhrase(title);
}
