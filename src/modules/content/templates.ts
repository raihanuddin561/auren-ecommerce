import type { BlockType, PageStatus } from './types';

export interface LandingPageTemplateSection {
  blockType: BlockType;
  name: string;
  props: Record<string, unknown>;
}

export interface LandingPageTemplate {
  id: string;
  title: string;
  description: string;
  category: 'campaign' | 'heritage' | 'vip' | 'blank';
  badge: string;
  icon: string;
  defaultStatus: PageStatus;
  sections: LandingPageTemplateSection[];
}

export const LANDING_PAGE_TEMPLATES: LandingPageTemplate[] = [
  {
    id: 'seasonal_capsule',
    title: 'Seasonal Capsule Drop',
    description:
      'Immersive launch page for seasonal collections and limited-run drops featuring hero visuals, category discovery, craftsman story, and VIP waitlist.',
    category: 'campaign',
    badge: 'Popular for Drops',
    icon: 'Sparkles',
    defaultStatus: 'draft',
    sections: [
      {
        blockType: 'hero_banner',
        name: 'Drop Hero Banner',
        props: {
          headline: 'AUTUMN / WINTER 2026 CAPSULE',
          subtitle:
            'A limited release conceived for the discerning modern gentleman. Noble fibers, architectural lines, and master hand-cutting.',
          ctaLabel: 'Explore The Capsule',
          ctaUrl: '/collections/winter-capsule',
          secondaryCtaLabel: 'Book Atelier Fitting',
          secondaryCtaUrl: '/pages/atelier',
          mediaUrl:
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=2000&q=85',
          theme: 'ink',
          overlayOpacity: 45,
        },
      },
      {
        blockType: 'editorial_quote',
        name: 'Artisan Philosophy',
        props: {
          quote:
            'True luxury does not clamor for attention. It speaks in the subtle drape of fine wool and the quiet precision of pick-stitching.',
          author: 'Auren Master Tailor',
          title: 'Banani Atelier, Dhaka',
        },
      },
      {
        blockType: 'category_grid',
        name: 'Capsule Categories',
        props: {
          headline: 'Curated Wardrobe Pillars',
          subtitle: 'Select silhouettes engineered for effortless elegance and timeless composure.',
          columns: 3,
          items: [
            {
              title: 'Master Tailored Suiting',
              subtitle: 'Double-breasted and single-breasted cuts',
              href: '/categories/suiting',
              imageUrl:
                'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
            },
            {
              title: 'Artisanal Panjabi',
              subtitle: 'Noble cotton with handcrafted plackets',
              href: '/categories/panjabi',
              imageUrl:
                'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
            },
            {
              title: 'Fine Shirting',
              subtitle: 'Egyptian Giza cotton in refined weaves',
              href: '/categories/shirting',
              imageUrl:
                'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
            },
          ],
        },
      },
      {
        blockType: 'split_banner',
        name: 'Craftsmanship Story',
        props: {
          eyebrow: 'Artisanal Heritage',
          headline: 'Constructed by Hand in Dhaka',
          description:
            'Every piece in this seasonal drop is cut individually, basted, and assembled by seasoned tailors in our Banani workshop with over 40 hours of dedicated handwork.',
          ctaLabel: 'Read The Journal',
          ctaUrl: '/journal',
          mediaUrl:
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
          mediaPosition: 'left',
        },
      },
      {
        blockType: 'lookbook_strip',
        name: 'Capsule Lookbook Strip',
        props: {
          headline: 'The Editorial Lookbook',
          subtitle: 'Frames from our Autumn / Winter studio shoot.',
          image1Url:
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80',
          image2Url:
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80',
          ctaLabel: 'View Full Lookbook',
          ctaUrl: '/lookbooks',
        },
      },
      {
        blockType: 'brand_perks',
        name: 'The Auren Commitments',
        props: {
          headline: 'The Auren Standard',
          subtitle: 'Guarantees of exceptional fabric, tailoring, and white-glove client care.',
          items: [
            {
              icon: 'Sparkles',
              title: 'Noble Fibers',
              description:
                'Pure Egyptian Giza cotton, Tasmanian wool, and Italian silk blends sourced with provenance.',
            },
            {
              icon: 'Scissors',
              title: 'Master Tailored',
              description:
                'Hand-basted canvas chests and reinforced pick-stitching for a bespoke drape.',
            },
            {
              icon: 'Truck',
              title: 'White-Glove Delivery',
              description:
                'Carefully packed in signature rigid garment boxes and delivered across Dhaka.',
            },
          ],
        },
      },
      {
        blockType: 'newsletter_strip',
        name: 'Private Access Strip',
        props: {
          headline: 'Join The Private Atelier Circle',
          subtitle:
            'Subscribers receive 48-hour priority access to seasonal capsule drops and private atelier invitations.',
          buttonLabel: 'Request Private Access',
          disclaimer: 'Strictly confidential. No spam.',
        },
      },
    ],
  },
  {
    id: 'craftsmanship_heritage',
    title: 'Heritage & Atelier Craft',
    description:
      'Editorial brand story landing page highlighting tailoring mastery, workshop heritage, noble textile sourcing, and craftsman FAQs.',
    category: 'heritage',
    badge: 'Editorial Story',
    icon: 'Scissors',
    defaultStatus: 'draft',
    sections: [
      {
        blockType: 'hero_banner',
        name: 'Heritage Hero',
        props: {
          headline: 'THE ART OF SLOW ELEGANCE',
          subtitle:
            'Inside the Auren workshop: noble natural fibers, master hand-cutting, and time-honored artisanal tailoring.',
          ctaLabel: 'Explore Atelier Philosophy',
          ctaUrl: '#philosophy',
          mediaUrl:
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=2000&q=85',
          theme: 'ink',
          overlayOpacity: 40,
        },
      },
      {
        blockType: 'brand_perks',
        name: 'Pillars of Craft',
        props: {
          headline: 'Three Pillars of Permanence',
          subtitle: 'The foundational tenets guiding every piece that leaves our workshop.',
          items: [
            {
              icon: 'Sparkles',
              title: 'Sourced With Intention',
              description:
                'Natural horn buttons, cupro linings, and extra-long staple cotton with verified origins.',
            },
            {
              icon: 'Scissors',
              title: 'Hand-Molded Canvassing',
              description:
                'Floating horsehair canvas that molds to the wearer’s contours over decades of wear.',
            },
            {
              icon: 'ShieldCheck',
              title: 'Lifetime Alterations',
              description:
                'Complimentary minor alterations for all bespoke and atelier suiting orders.',
            },
          ],
        },
      },
      {
        blockType: 'split_banner',
        name: 'Workshop Spotlight',
        props: {
          eyebrow: 'Banani Workshop',
          headline: 'Where Heritage Meets Contemporary Form',
          description:
            'We reject the haste of modern fast fashion. In our atelier, every pattern is drafted to individual measurements, cut with surgical precision, and hand-finished with pick-stitching along the lapels.',
          ctaLabel: 'Schedule A Studio Visit',
          ctaUrl: '/contact',
          mediaUrl:
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80',
          mediaPosition: 'right',
        },
      },
      {
        blockType: 'rich_text',
        name: 'Philosophy Essay',
        props: {
          headline: 'A Philosophy of Permanence',
          subtitle: 'Notes from our founding tailor on modern masculine refinement.',
          content:
            'In an age of ephemeral garments, we believe true sophistication lies in restraint and longevity. When you slip into an Auren jacket, you feel the structural integrity of floating canvas and the breathable comfort of pure unblended wool.\n\nOur artisans are second and third-generation master tailors based in Dhaka, bringing centuries of Bengali textile heritage into sharp, modern silhouettes designed for international standards.',
          alignment: 'center',
        },
      },
      {
        blockType: 'faq_accordion',
        name: 'Craft & Bespoke FAQs',
        props: {
          headline: 'Artisanal Questions Answered',
          subtitle: 'Details regarding bespoke commissions, materials, and turnaround time.',
          items: [
            {
              question: 'How long does a bespoke tailoring commission take?',
              answer:
                'A bespoke two-piece suit typically requires 10 to 14 working days, inclusive of an initial fitting session at our Banani studio or your residence.',
            },
            {
              question: 'Can I select specific fabrics and internal canvassing?',
              answer:
                'Yes. We maintain a curated library of over 120 cloth bunches from prestigious mills including Loro Piana, Zegna, and Dormeuil, as well as heritage domestic weaves.',
            },
            {
              question: 'Do you offer doorstep fitting sessions across Dhaka?',
              answer:
                'Yes. Our senior tailor can visit your home or office in Gulshan, Banani, Baridhara, Dhanmondi, and Uttara by private appointment.',
            },
          ],
        },
      },
      {
        blockType: 'newsletter_strip',
        name: 'Newsletter Invitation',
        props: {
          headline: 'The Atelier Dispatch',
          subtitle:
            'Occasional essays on menswear history, textile appreciation, and styling perspectives.',
          buttonLabel: 'Subscribe to Dispatch',
          disclaimer: 'Curated monthly reading. Never promotional spam.',
        },
      },
    ],
  },
  {
    id: 'vip_concierge',
    title: 'Private VIP Concierge',
    description:
      'High-touch VIP service landing page for private styling, doorstep measurements, wedding party consultations, and corporate executive services.',
    category: 'vip',
    badge: 'Private Clients',
    icon: 'ShieldCheck',
    defaultStatus: 'draft',
    sections: [
      {
        blockType: 'hero_banner',
        name: 'Concierge Hero',
        props: {
          headline: 'PRIVATE CLIENT CONCIERGE',
          subtitle:
            'Experience the pinnacle of sartorial convenience. Doorstep fitting sessions, personal clothier consultations, and white-glove delivery.',
          ctaLabel: 'Request Private Consultation',
          ctaUrl: '/contact',
          secondaryCtaLabel: 'Explore Services',
          secondaryCtaUrl: '#services',
          mediaUrl:
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=2000&q=85',
          theme: 'ivory',
          overlayOpacity: 15,
        },
      },
      {
        blockType: 'brand_perks',
        name: 'VIP Privileges',
        props: {
          headline: 'The Concierge Experience',
          subtitle: 'Tailored specifically for discerning patrons and high-profile executives.',
          items: [
            {
              icon: 'Clock',
              title: 'Doorstep Measuring',
              description:
                'A master clothier visits your residence with fabric books and digital 24-point measurement charts.',
            },
            {
              icon: 'Award',
              title: 'Bespoke Wardrobe Archiving',
              description:
                'Your measurements and pattern variations are preserved securely in our atelier vault for seamless reorders.',
            },
            {
              icon: 'Truck',
              title: 'Express Atelier Turnaround',
              description:
                'Priority workshop queue with rush fitting options available for time-sensitive diplomatic and wedding events.',
            },
          ],
        },
      },
      {
        blockType: 'split_banner',
        name: 'Doorstep Suite',
        props: {
          eyebrow: 'In-Residence Service',
          headline: 'Bespoke Fittings in the Privacy of Your Home',
          description:
            'Eliminate showroom visits. Our concierge brings curated fabric swathes, style lookbooks, and trial basted garments directly to your study or suite.',
          ctaLabel: 'Book An Appointment',
          ctaUrl: '/contact',
          mediaUrl:
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80',
          mediaPosition: 'left',
        },
      },
      {
        blockType: 'faq_accordion',
        name: 'Concierge Protocol FAQ',
        props: {
          headline: 'Concierge Details & Coverage',
          subtitle: 'Frequently asked questions regarding private consultations in Dhaka.',
          items: [
            {
              question: 'Which zones are covered for doorstep fitting?',
              answer:
                'We currently offer complimentary in-residence visits in Gulshan, Banani, Baridhara, Bashundhara, Dhanmondi, and Uttara.',
            },
            {
              question: 'Is there a consultation fee for private clothier visits?',
              answer:
                'Consultations are complimentary with any suiting or bespoke wardrobe commission.',
            },
            {
              question: 'How do I arrange styling for a groom and wedding party?',
              answer:
                'Our VIP Concierge coordinates complete groomsmen ensembles, coordinating fabrics, silhouettes, and delivery schedules to ensure perfection on the day.',
            },
          ],
        },
      },
      {
        blockType: 'newsletter_strip',
        name: 'Private Access',
        props: {
          headline: 'Join The Private Client Registry',
          subtitle:
            'Receive confidential notifications regarding trunk shows, rare Italian cloth arrivals, and private concierge openings.',
          buttonLabel: 'Register As Private Patron',
        },
      },
    ],
  },
  {
    id: 'blank',
    title: 'Minimal Blank Canvas',
    description:
      'A pristine starting point with a clean Hero Banner block. Add and customize sections to build a completely custom landing page.',
    category: 'blank',
    badge: 'Custom Builder',
    icon: 'Layers',
    defaultStatus: 'draft',
    sections: [
      {
        blockType: 'hero_banner',
        name: 'Welcome Banner',
        props: {
          headline: 'AUREN ATELIER',
          subtitle:
            'Compose your bespoke luxury experience using section blocks in the editor studio.',
          ctaLabel: 'Explore The Atelier',
          ctaUrl: '/shop',
          theme: 'ink',
          overlayOpacity: 35,
        },
      },
    ],
  },
];

export function getTemplateById(id: string): LandingPageTemplate | undefined {
  return LANDING_PAGE_TEMPLATES.find((t) => t.id === id);
}
