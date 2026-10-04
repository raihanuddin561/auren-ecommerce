/**
 * Development catalog: 6 categories, 40 menswear products with colour x size variants, images and
 * stock for one warehouse. Pure data and row builders; prisma/seed.ts writes them.
 * Prices are in BDT and flow through lib/money (no floats).
 */
import type { Prisma } from '../src/generated/prisma/client';
import { fromDecimalString, percent } from '../src/lib/money';

export const CURRENCY = 'BDT';

export interface ColorDef {
  value: string;
  label: string;
  hex: string;
}

export const COLORS = {
  white: { value: 'white', label: 'White', hex: '#F8F8F6' },
  ivory: { value: 'ivory', label: 'Ivory', hex: '#F2EDE4' },
  sky: { value: 'sky-blue', label: 'Sky Blue', hex: '#9DB7D5' },
  navy: { value: 'navy', label: 'Navy', hex: '#1F2A44' },
  charcoal: { value: 'charcoal', label: 'Charcoal', hex: '#36373A' },
  black: { value: 'black', label: 'Black', hex: '#111111' },
  olive: { value: 'olive', label: 'Olive', hex: '#5B6040' },
  sand: { value: 'sand', label: 'Sand', hex: '#C9B79C' },
  stone: { value: 'stone', label: 'Stone', hex: '#B9B2A5' },
  burgundy: { value: 'burgundy', label: 'Burgundy', hex: '#5A1F24' },
  camel: { value: 'camel', label: 'Camel', hex: '#B07C4F' },
  forest: { value: 'forest', label: 'Forest', hex: '#2F4A3A' },
  grey: { value: 'grey-melange', label: 'Grey Melange', hex: '#8A8D91' },
  tan: { value: 'tan', label: 'Tan', hex: '#A67B5B' },
  brown: { value: 'brown', label: 'Brown', hex: '#5C4033' },
} as const satisfies Record<string, ColorDef>;

type SizeKind = 'top' | 'waist' | 'belt' | 'one';
export const SIZES: Record<SizeKind, string[]> = {
  top: ['S', 'M', 'L', 'XL', 'XXL'],
  waist: ['30', '32', '34', '36', '38'],
  belt: ['32', '34', '36', '38'],
  one: ['One Size'],
};

export interface ProductDef {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  type: string;
  fit: 'slim' | 'regular' | 'relaxed' | null;
  material: string;
  care: string;
  /** Selling price in whole BDT. */
  price: string;
  /** Pre-markdown price for items on sale. */
  was?: string;
  /** Landed cost as a share of price, in basis points. */
  costBps: number;
  colors: ColorDef[];
  sizes: SizeKind;
  weightG: number;
  occasion: string;
  season: string;
  pattern: string;
  featured?: number;
}

const c = COLORS;

export const CATEGORIES = [
  {
    slug: 'shirts',
    name: 'Shirts',
    blurb: 'Oxford, poplin and linen shirts cut for the Dhaka climate.',
  },
  {
    slug: 'trousers',
    name: 'Trousers',
    blurb: 'Tailored chinos, pleated wool and relaxed cotton trousers.',
  },
  {
    slug: 'blazers-jackets',
    name: 'Blazers & Jackets',
    blurb: 'Unstructured blazers and everyday outerwear.',
  },
  {
    slug: 'knitwear',
    name: 'Knitwear',
    blurb: 'Fine-gauge merino and cotton knits for cool evenings.',
  },
  {
    slug: 'polos-tees',
    name: 'Polos & T-Shirts',
    blurb: 'Heavyweight cotton essentials, made to last.',
  },
  {
    slug: 'accessories',
    name: 'Accessories',
    blurb: 'Leather belts, wallets and finishing touches.',
  },
] as const;

const care = {
  cotton: 'Machine wash cold with like colours. Warm iron. Do not tumble dry.',
  linen: 'Hand wash cold or gentle machine cycle. Dry in shade. Iron while damp.',
  wool: 'Dry clean recommended. Steam to refresh. Store folded.',
  knit: 'Hand wash cold with wool detergent. Dry flat. Do not wring.',
  leather: 'Wipe with a soft dry cloth. Condition twice a year. Keep away from water.',
} as const;

export const PRODUCTS: ProductDef[] = [
  // Shirts (8)
  {
    slug: 'oxford-button-down-shirt',
    title: 'Oxford Button-Down Shirt',
    subtitle: 'Brushed cotton oxford, soft collar roll',
    category: 'shirts',
    type: 'shirt',
    fit: 'regular',
    material: '100% long-staple cotton oxford',
    care: care.cotton,
    price: '3290',
    costBps: 4200,
    colors: [c.white, c.sky, c.navy],
    sizes: 'top',
    weightG: 280,
    occasion: 'smart casual',
    season: 'all year',
    pattern: 'solid',
    featured: 1,
  },
  {
    slug: 'poplin-dress-shirt',
    title: 'Poplin Dress Shirt',
    subtitle: 'Crisp two-ply poplin with a semi-spread collar',
    category: 'shirts',
    type: 'shirt',
    fit: 'slim',
    material: '100% two-ply cotton poplin',
    care: care.cotton,
    price: '3690',
    costBps: 4300,
    colors: [c.white, c.sky],
    sizes: 'top',
    weightG: 240,
    occasion: 'formal',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'linen-camp-collar-shirt',
    title: 'Linen Camp Collar Shirt',
    subtitle: 'Relaxed short sleeve in washed Belgian linen',
    category: 'shirts',
    type: 'shirt',
    fit: 'relaxed',
    material: '100% washed linen',
    care: care.linen,
    price: '3490',
    costBps: 4400,
    colors: [c.sand, c.white, c.olive],
    sizes: 'top',
    weightG: 200,
    occasion: 'weekend',
    season: 'summer',
    pattern: 'solid',
    featured: 3,
  },
  {
    slug: 'chambray-work-shirt',
    title: 'Chambray Work Shirt',
    subtitle: 'Lightweight indigo chambray, twin chest pockets',
    category: 'shirts',
    type: 'shirt',
    fit: 'regular',
    material: '100% cotton chambray',
    care: care.cotton,
    price: '2990',
    costBps: 4200,
    colors: [c.navy, c.sky],
    sizes: 'top',
    weightG: 250,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'flannel-overshirt',
    title: 'Flannel Overshirt',
    subtitle: 'Double-brushed flannel in a heritage check',
    category: 'shirts',
    type: 'overshirt',
    fit: 'relaxed',
    material: '100% brushed cotton flannel',
    care: care.cotton,
    price: '4290',
    was: '4990',
    costBps: 4500,
    colors: [c.burgundy, c.forest],
    sizes: 'top',
    weightG: 420,
    occasion: 'casual',
    season: 'winter',
    pattern: 'check',
  },
  {
    slug: 'mandarin-collar-shirt',
    title: 'Mandarin Collar Shirt',
    subtitle: 'Collarless cotton-linen blend with a clean placket',
    category: 'shirts',
    type: 'shirt',
    fit: 'regular',
    material: '55% cotton, 45% linen',
    care: care.linen,
    price: '3190',
    costBps: 4300,
    colors: [c.ivory, c.charcoal],
    sizes: 'top',
    weightG: 220,
    occasion: 'smart casual',
    season: 'summer',
    pattern: 'solid',
  },
  {
    slug: 'pinstripe-business-shirt',
    title: 'Pinstripe Business Shirt',
    subtitle: 'Fine navy pinstripe on white, button cuff',
    category: 'shirts',
    type: 'shirt',
    fit: 'slim',
    material: '100% cotton twill',
    care: care.cotton,
    price: '3890',
    costBps: 4300,
    colors: [c.white],
    sizes: 'top',
    weightG: 255,
    occasion: 'formal',
    season: 'all year',
    pattern: 'stripe',
  },
  {
    slug: 'seersucker-summer-shirt',
    title: 'Seersucker Summer Shirt',
    subtitle: 'Naturally textured, never clings in the heat',
    category: 'shirts',
    type: 'shirt',
    fit: 'regular',
    material: '100% cotton seersucker',
    care: care.cotton,
    price: '2790',
    was: '3290',
    costBps: 4400,
    colors: [c.sky, c.sand],
    sizes: 'top',
    weightG: 190,
    occasion: 'weekend',
    season: 'summer',
    pattern: 'stripe',
  },

  // Trousers (7)
  {
    slug: 'tailored-chino-trouser',
    title: 'Tailored Chino Trouser',
    subtitle: 'Garment-dyed stretch twill, tapered leg',
    category: 'trousers',
    type: 'trouser',
    fit: 'slim',
    material: '97% cotton, 3% elastane twill',
    care: care.cotton,
    price: '3490',
    costBps: 4400,
    colors: [c.sand, c.navy, c.olive],
    sizes: 'waist',
    weightG: 460,
    occasion: 'smart casual',
    season: 'all year',
    pattern: 'solid',
    featured: 2,
  },
  {
    slug: 'pleated-wool-trouser',
    title: 'Pleated Wool Trouser',
    subtitle: 'Single-pleat tropical wool, high rise',
    category: 'trousers',
    type: 'trouser',
    fit: 'regular',
    material: '100% tropical wool',
    care: care.wool,
    price: '5890',
    costBps: 4600,
    colors: [c.charcoal, c.navy],
    sizes: 'waist',
    weightG: 520,
    occasion: 'formal',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'relaxed-linen-trouser',
    title: 'Relaxed Linen Trouser',
    subtitle: 'Drawcord waist, wide leg, washed linen',
    category: 'trousers',
    type: 'trouser',
    fit: 'relaxed',
    material: '100% washed linen',
    care: care.linen,
    price: '3790',
    costBps: 4400,
    colors: [c.stone, c.white],
    sizes: 'waist',
    weightG: 380,
    occasion: 'weekend',
    season: 'summer',
    pattern: 'solid',
  },
  {
    slug: 'selvedge-straight-jean',
    title: 'Selvedge Straight Jean',
    subtitle: '13oz raw denim, straight through the leg',
    category: 'trousers',
    type: 'jean',
    fit: 'regular',
    material: '100% cotton selvedge denim',
    care: 'Wash rarely, cold, inside out. Dry in shade.',
    price: '4890',
    costBps: 4500,
    colors: [c.navy, c.black],
    sizes: 'waist',
    weightG: 780,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'cotton-drill-cargo',
    title: 'Cotton Drill Cargo',
    subtitle: 'Utility pockets, tapered cuff, garment washed',
    category: 'trousers',
    type: 'trouser',
    fit: 'relaxed',
    material: '100% cotton drill',
    care: care.cotton,
    price: '3590',
    costBps: 4300,
    colors: [c.olive, c.stone],
    sizes: 'waist',
    weightG: 560,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'travel-stretch-trouser',
    title: 'Travel Stretch Trouser',
    subtitle: 'Wrinkle-shy four-way stretch, hidden zip pocket',
    category: 'trousers',
    type: 'trouser',
    fit: 'slim',
    material: '88% polyamide, 12% elastane',
    care: care.cotton,
    price: '4190',
    costBps: 4500,
    colors: [c.black, c.charcoal],
    sizes: 'waist',
    weightG: 400,
    occasion: 'travel',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'corduroy-five-pocket',
    title: 'Corduroy Five-Pocket Trouser',
    subtitle: '14-wale corduroy in a washed finish',
    category: 'trousers',
    type: 'trouser',
    fit: 'regular',
    material: '100% cotton corduroy',
    care: care.cotton,
    price: '4390',
    was: '4990',
    costBps: 4400,
    colors: [c.camel, c.forest],
    sizes: 'waist',
    weightG: 640,
    occasion: 'casual',
    season: 'winter',
    pattern: 'solid',
  },

  // Blazers and jackets (6)
  {
    slug: 'unstructured-linen-blazer',
    title: 'Unstructured Linen Blazer',
    subtitle: 'Half-lined, patch pockets, soft shoulder',
    category: 'blazers-jackets',
    type: 'blazer',
    fit: 'regular',
    material: '100% linen, cupro lining',
    care: care.wool,
    price: '10990',
    costBps: 4600,
    colors: [c.sand, c.navy],
    sizes: 'top',
    weightG: 620,
    occasion: 'smart casual',
    season: 'summer',
    pattern: 'solid',
    featured: 4,
  },
  {
    slug: 'wool-two-button-blazer',
    title: 'Wool Two-Button Blazer',
    subtitle: 'Hopsack wool, half-canvas construction',
    category: 'blazers-jackets',
    type: 'blazer',
    fit: 'slim',
    material: '100% wool hopsack',
    care: care.wool,
    price: '14990',
    costBps: 4800,
    colors: [c.navy, c.charcoal],
    sizes: 'top',
    weightG: 880,
    occasion: 'formal',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'waxed-cotton-field-jacket',
    title: 'Waxed Cotton Field Jacket',
    subtitle: 'Four pockets, corduroy collar, rain ready',
    category: 'blazers-jackets',
    type: 'jacket',
    fit: 'regular',
    material: '100% waxed cotton',
    care: 'Wipe clean. Re-wax annually. Do not machine wash.',
    price: '12490',
    costBps: 4700,
    colors: [c.olive, c.brown],
    sizes: 'top',
    weightG: 1100,
    occasion: 'outdoor',
    season: 'monsoon',
    pattern: 'solid',
  },
  {
    slug: 'suede-trucker-jacket',
    title: 'Suede Trucker Jacket',
    subtitle: 'Soft goat suede, snap buttons',
    category: 'blazers-jackets',
    type: 'jacket',
    fit: 'regular',
    material: 'Goat suede, cotton lining',
    care: care.leather,
    price: '16990',
    costBps: 5000,
    colors: [c.tan, c.brown],
    sizes: 'top',
    weightG: 950,
    occasion: 'casual',
    season: 'winter',
    pattern: 'solid',
  },
  {
    slug: 'quilted-gilet',
    title: 'Quilted Gilet',
    subtitle: 'Lightweight insulation, stand collar',
    category: 'blazers-jackets',
    type: 'gilet',
    fit: 'regular',
    material: 'Recycled polyester shell and fill',
    care: care.cotton,
    price: '5990',
    was: '6990',
    costBps: 4600,
    colors: [c.navy, c.olive],
    sizes: 'top',
    weightG: 520,
    occasion: 'casual',
    season: 'winter',
    pattern: 'solid',
  },
  {
    slug: 'cotton-harrington-jacket',
    title: 'Cotton Harrington Jacket',
    subtitle: 'Tartan-lined classic in water-repellent cotton',
    category: 'blazers-jackets',
    type: 'jacket',
    fit: 'regular',
    material: 'Cotton-nylon blend, cotton lining',
    care: care.cotton,
    price: '8990',
    costBps: 4600,
    colors: [c.sand, c.black],
    sizes: 'top',
    weightG: 700,
    occasion: 'casual',
    season: 'monsoon',
    pattern: 'solid',
  },

  // Knitwear (6)
  {
    slug: 'merino-crewneck-sweater',
    title: 'Merino Crewneck Sweater',
    subtitle: 'Fine 12-gauge extrafine merino',
    category: 'knitwear',
    type: 'sweater',
    fit: 'regular',
    material: '100% extrafine merino wool',
    care: care.knit,
    price: '5490',
    costBps: 4800,
    colors: [c.navy, c.charcoal, c.burgundy],
    sizes: 'top',
    weightG: 380,
    occasion: 'smart casual',
    season: 'winter',
    pattern: 'solid',
    featured: 5,
  },
  {
    slug: 'cotton-cashmere-cardigan',
    title: 'Cotton Cashmere Cardigan',
    subtitle: 'Shawl collar, horn-effect buttons',
    category: 'knitwear',
    type: 'cardigan',
    fit: 'regular',
    material: '80% cotton, 20% cashmere',
    care: care.knit,
    price: '6990',
    costBps: 5000,
    colors: [c.stone, c.forest],
    sizes: 'top',
    weightG: 450,
    occasion: 'smart casual',
    season: 'winter',
    pattern: 'solid',
  },
  {
    slug: 'cotton-polo-knit',
    title: 'Cotton Knit Polo',
    subtitle: 'Open-knit short sleeve polo for warm evenings',
    category: 'knitwear',
    type: 'polo',
    fit: 'slim',
    material: '100% Egyptian cotton',
    care: care.knit,
    price: '3990',
    costBps: 4500,
    colors: [c.ivory, c.navy],
    sizes: 'top',
    weightG: 260,
    occasion: 'smart casual',
    season: 'summer',
    pattern: 'solid',
  },
  {
    slug: 'ribbed-turtleneck',
    title: 'Ribbed Turtleneck',
    subtitle: 'Slim rib, folds neatly at the neck',
    category: 'knitwear',
    type: 'sweater',
    fit: 'slim',
    material: '100% merino wool',
    care: care.knit,
    price: '5190',
    costBps: 4800,
    colors: [c.black, c.camel],
    sizes: 'top',
    weightG: 360,
    occasion: 'smart casual',
    season: 'winter',
    pattern: 'rib',
  },
  {
    slug: 'half-zip-pullover',
    title: 'Half-Zip Pullover',
    subtitle: 'Brushed cotton blend, ribbed cuffs',
    category: 'knitwear',
    type: 'sweater',
    fit: 'regular',
    material: '70% cotton, 30% wool',
    care: care.knit,
    price: '4690',
    was: '5490',
    costBps: 4600,
    colors: [c.grey, c.navy],
    sizes: 'top',
    weightG: 480,
    occasion: 'casual',
    season: 'winter',
    pattern: 'solid',
  },
  {
    slug: 'linen-knit-tee',
    title: 'Linen Knit Tee',
    subtitle: 'Breathable linen-cotton jersey knit',
    category: 'knitwear',
    type: 'tee',
    fit: 'regular',
    material: '60% linen, 40% cotton',
    care: care.linen,
    price: '2990',
    costBps: 4400,
    colors: [c.sand, c.white],
    sizes: 'top',
    weightG: 210,
    occasion: 'weekend',
    season: 'summer',
    pattern: 'solid',
  },

  // Polos and tees (7)
  {
    slug: 'heavyweight-cotton-tee',
    title: 'Heavyweight Cotton Tee',
    subtitle: '240gsm combed cotton, boxy through the body',
    category: 'polos-tees',
    type: 'tee',
    fit: 'relaxed',
    material: '100% combed cotton, 240gsm',
    care: care.cotton,
    price: '1690',
    costBps: 4000,
    colors: [c.white, c.black, c.stone],
    sizes: 'top',
    weightG: 240,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
    featured: 6,
  },
  {
    slug: 'pique-polo-shirt',
    title: 'Piqué Polo Shirt',
    subtitle: 'Classic piqué with a self-fabric collar',
    category: 'polos-tees',
    type: 'polo',
    fit: 'regular',
    material: '100% combed cotton piqué',
    care: care.cotton,
    price: '2290',
    costBps: 4200,
    colors: [c.navy, c.white, c.forest],
    sizes: 'top',
    weightG: 250,
    occasion: 'smart casual',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'slub-henley',
    title: 'Slub Henley',
    subtitle: 'Three-button placket, textured slub cotton',
    category: 'polos-tees',
    type: 'henley',
    fit: 'regular',
    material: '100% slub cotton',
    care: care.cotton,
    price: '1990',
    costBps: 4100,
    colors: [c.grey, c.olive],
    sizes: 'top',
    weightG: 230,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'pocket-crew-tee',
    title: 'Pocket Crew Tee',
    subtitle: 'Everyday crew with a single chest pocket',
    category: 'polos-tees',
    type: 'tee',
    fit: 'regular',
    material: '100% cotton jersey',
    care: care.cotton,
    price: '1290',
    was: '1590',
    costBps: 4000,
    colors: [c.white, c.navy, c.grey],
    sizes: 'top',
    weightG: 200,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'long-sleeve-ringer-tee',
    title: 'Long Sleeve Ringer Tee',
    subtitle: 'Contrast ribbed collar and cuffs',
    category: 'polos-tees',
    type: 'tee',
    fit: 'regular',
    material: '100% cotton jersey',
    care: care.cotton,
    price: '1890',
    costBps: 4100,
    colors: [c.ivory, c.navy],
    sizes: 'top',
    weightG: 250,
    occasion: 'casual',
    season: 'winter',
    pattern: 'solid',
  },
  {
    slug: 'performance-polo',
    title: 'Performance Polo',
    subtitle: 'Moisture-wicking knit for humid days',
    category: 'polos-tees',
    type: 'polo',
    fit: 'slim',
    material: '92% recycled polyester, 8% elastane',
    care: care.cotton,
    price: '2590',
    costBps: 4300,
    colors: [c.black, c.sky],
    sizes: 'top',
    weightG: 190,
    occasion: 'active',
    season: 'summer',
    pattern: 'solid',
  },
  {
    slug: 'garment-dyed-pocket-polo',
    title: 'Garment-Dyed Pocket Polo',
    subtitle: 'Sun-faded look from a slow dye process',
    category: 'polos-tees',
    type: 'polo',
    fit: 'relaxed',
    material: '100% cotton jersey',
    care: care.cotton,
    price: '2490',
    costBps: 4200,
    colors: [c.camel, c.burgundy],
    sizes: 'top',
    weightG: 260,
    occasion: 'casual',
    season: 'all year',
    pattern: 'solid',
  },

  // Accessories (6)
  {
    slug: 'full-grain-leather-belt',
    title: 'Full-Grain Leather Belt',
    subtitle: 'Vegetable-tanned leather, solid brass buckle',
    category: 'accessories',
    type: 'belt',
    fit: null,
    material: 'Full-grain leather, solid brass',
    care: care.leather,
    price: '2490',
    costBps: 4500,
    colors: [c.brown, c.black],
    sizes: 'belt',
    weightG: 140,
    occasion: 'everyday',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'slim-leather-cardholder',
    title: 'Slim Leather Cardholder',
    subtitle: 'Four card slots, one note pocket',
    category: 'accessories',
    type: 'wallet',
    fit: null,
    material: 'Full-grain leather',
    care: care.leather,
    price: '1490',
    costBps: 4400,
    colors: [c.black, c.tan],
    sizes: 'one',
    weightG: 40,
    occasion: 'everyday',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'bifold-leather-wallet',
    title: 'Bifold Leather Wallet',
    subtitle: 'Six cards, coin pocket, hand-stitched',
    category: 'accessories',
    type: 'wallet',
    fit: null,
    material: 'Full-grain leather',
    care: care.leather,
    price: '2990',
    costBps: 4500,
    colors: [c.brown, c.black],
    sizes: 'one',
    weightG: 90,
    occasion: 'everyday',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'silk-knit-tie',
    title: 'Silk Knit Tie',
    subtitle: 'Square-end knitted silk, 6cm',
    category: 'accessories',
    type: 'tie',
    fit: null,
    material: '100% silk',
    care: 'Dry clean only.',
    price: '1790',
    costBps: 4300,
    colors: [c.navy, c.charcoal, c.burgundy],
    sizes: 'one',
    weightG: 50,
    occasion: 'formal',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'cotton-pocket-square',
    title: 'Linen Pocket Square',
    subtitle: 'Hand-rolled edges, soft linen',
    category: 'accessories',
    type: 'pocket-square',
    fit: null,
    material: '100% linen',
    care: care.linen,
    price: '990',
    costBps: 4000,
    colors: [c.white, c.sky, c.sand],
    sizes: 'one',
    weightG: 20,
    occasion: 'formal',
    season: 'all year',
    pattern: 'solid',
  },
  {
    slug: 'canvas-weekender-bag',
    title: 'Canvas Weekender Bag',
    subtitle: 'Waxed canvas with leather handles, 38 litre',
    category: 'accessories',
    type: 'bag',
    fit: null,
    material: 'Waxed canvas, leather trim',
    care: 'Spot clean. Re-wax yearly.',
    price: '8490',
    costBps: 4800,
    colors: [c.olive, c.charcoal],
    sizes: 'one',
    weightG: 1100,
    occasion: 'travel',
    season: 'all year',
    pattern: 'solid',
  },
];

// ---------------------------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------------------------

const skuPart = (text: string) =>
  text
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .toUpperCase();

const abbreviate = (slug: string) =>
  slug
    .split('-')
    .filter((w) => !['the', 'and', 'with'].includes(w))
    .map((w) => w.slice(0, 3).toUpperCase())
    .slice(0, 3)
    .join('');

/** Stable pseudo-random stock so reruns and tests agree: mostly healthy, some low, a few sold out. */
export function stockFor(productIndex: number, variantIndex: number): number {
  const n = productIndex * 31 + variantIndex * 17;
  if (n % 19 === 0) return 0;
  if (n % 7 === 0) return 1 + (n % 4);
  return 8 + (n % 33);
}

export interface SeedRows {
  location: { id: string; name: string };
  categories: Prisma.CategoryCreateManyInput[];
  products: Prisma.ProductCreateManyInput[];
  options: Prisma.ProductOptionCreateManyInput[];
  optionValues: Prisma.ProductOptionValueCreateManyInput[];
  variants: Prisma.ProductVariantCreateManyInput[];
  variantOptionValues: Prisma.VariantOptionValueCreateManyInput[];
  media: Prisma.ProductMediaCreateManyInput[];
  /**
   * What the seeded purchase orders bring in. Stock is never written directly (only the inventory
   * service changes levels): prisma/seed-purchasing.ts receives these through purchase orders.
   */
  stockPlan: StockPlanLine[];
}

export interface StockPlanLine {
  variantId: string;
  /** Deterministic, so the plan can be matched to variants already in a database. */
  sku: string;
  productIndex: number;
  /** Units to buy and receive; 0 means the variant starts sold out. */
  quantity: number;
  /** What the supplier charges per unit (before landed costs), in minor units. */
  supplierUnitCostMinor: bigint;
}

export function buildCatalogSeed(newId: () => string, now: Date = new Date()): SeedRows {
  const rows: SeedRows = {
    location: { id: newId(), name: 'Dhaka Warehouse' },
    categories: [],
    products: [],
    options: [],
    optionValues: [],
    variants: [],
    variantOptionValues: [],
    media: [],
    stockPlan: [],
  };

  const categoryIds = new Map<string, string>();
  CATEGORIES.forEach((category, position) => {
    const id = newId();
    categoryIds.set(category.slug, id);
    rows.categories.push({
      id,
      parentId: null,
      slug: category.slug,
      name: category.name,
      description: category.blurb,
      position,
      path: category.slug,
      seoTitle: `${category.name} for Men | AUREN`,
      seoDescription: category.blurb,
      isActive: true,
    });
  });

  PRODUCTS.forEach((def, productIndex) => {
    const productId = newId();
    const price = fromDecimalString(def.price, CURRENCY);
    const compareAt = def.was ? fromDecimalString(def.was, CURRENCY) : null;
    const cost = percent(price, def.costBps);

    rows.products.push({
      id: productId,
      slug: def.slug,
      title: def.title,
      subtitle: def.subtitle,
      description:
        `${def.title} in ${def.material.toLowerCase()}. ${def.subtitle}.\n\n` +
        `Cut in a ${def.fit ?? 'considered'} shape for ${def.occasion} wear, finished with care in Bangladesh.`,
      status: 'active',
      categoryId: categoryIds.get(def.category),
      productType: def.type,
      material: def.material,
      careInstructions: def.care,
      fit: def.fit,
      origin: 'Bangladesh',
      tags: [def.category, def.type, def.season, def.occasion],
      attributes: {
        fabric: def.material,
        occasion: def.occasion,
        season: def.season,
        pattern: def.pattern,
      },
      seoTitle: `${def.title} | AUREN`,
      seoDescription: `${def.subtitle}. ${def.title} by AUREN, premium menswear made in Bangladesh.`,
      publishedAt: now,
      featuredRank: def.featured ?? null,
    });

    const colorOptionId = newId();
    const sizeOptionId = newId();
    rows.options.push(
      { id: colorOptionId, productId, name: 'Color', position: 0 },
      { id: sizeOptionId, productId, name: 'Size', position: 1 },
    );

    const colorValueIds = new Map<string, string>();
    def.colors.forEach((color, position) => {
      const id = newId();
      colorValueIds.set(color.value, id);
      rows.optionValues.push({
        id,
        optionId: colorOptionId,
        value: color.value,
        label: color.label,
        swatchHex: color.hex,
        position,
      });
      (['front', 'detail'] as const).forEach((view, viewIndex) => {
        rows.media.push({
          id: newId(),
          productId,
          optionValueId: id,
          type: 'image',
          url: `/seed/${color.value}.svg`,
          alt: `${def.title} in ${color.label}, ${view} view`,
          width: 800,
          height: 1000,
          dominantColor: color.hex,
          position: position * 2 + viewIndex,
        });
      });
    });

    const sizeValueIds = new Map<string, string>();
    SIZES[def.sizes].forEach((size, position) => {
      const id = newId();
      sizeValueIds.set(size, id);
      rows.optionValues.push({ id, optionId: sizeOptionId, value: size, label: size, position });
    });

    let variantIndex = 0;
    def.colors.forEach((color) => {
      SIZES[def.sizes].forEach((size) => {
        const variantId = newId();
        rows.variants.push({
          id: variantId,
          productId,
          sku: `AUR-${abbreviate(def.slug)}-${skuPart(color.value)}-${skuPart(size)}`,
          priceMinor: price.minor,
          compareAtMinor: compareAt?.minor ?? null,
          currency: CURRENCY,
          weightG: def.weightG,
          status: 'active',
          position: variantIndex,
          isDefault: variantIndex === 0,
        });
        rows.variantOptionValues.push(
          { variantId, optionValueId: colorValueIds.get(color.value)! },
          { variantId, optionValueId: sizeValueIds.get(size)! },
        );
        rows.stockPlan.push({
          variantId,
          sku: rows.variants[rows.variants.length - 1]!.sku,
          productIndex,
          quantity: stockFor(productIndex, variantIndex),
          // The supplier charges 92% of the planned landed cost; freight and duty make up the rest.
          supplierUnitCostMinor: percent(cost, 9200).minor,
        });
        variantIndex += 1;
      });
    });
  });

  return rows;
}
