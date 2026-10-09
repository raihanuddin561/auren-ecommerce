import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

import { JsonLd } from '@/components/seo/json-ld';
import { faqPageJsonLd } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions (FAQ) | AUREN',
  description:
    'Answers to common inquiries regarding our orders, measurements, delivery timelines, payment options, and doorstep exchange process.',
  alternates: { canonical: '/faq' },
};

const FAQ_ITEMS = [
  {
    category: 'Ordering & Verification',
    questions: [
      {
        q: 'Why does your team call to verify every order?',
        a: 'We believe true luxury begins with precision. Our atelier team calls you personally after checkout to verify your shoulder, chest, and waist measurements, ensure your delivery address is accurate, and answer any styling inquiries before your garments are steamed and dispatched.',
      },
      {
        q: 'Can I modify my size or add items during phone verification?',
        a: 'Yes, absolutely. If you want to switch sizes, change a trouser hem length, or add a matching pocket square or shirt, our verification specialist will update your order directly on the phone with live pricing and stock adjustments.',
      },
      {
        q: 'Do you take orders via WhatsApp, Facebook, or phone?',
        a: 'Yes. You may place orders through our website, or directly with our client concierge over WhatsApp or telephone. Our team logs manual orders into the same secure queue with identical tracking and delivery protocols.',
      },
    ],
  },
  {
    category: 'Sizing & Measurements',
    questions: [
      {
        q: 'How do AUREN garment sizes compare to international sizing?',
        a: 'AUREN pieces are cut with modern tailored proportions designed for comfort in the tropics. They fit true to size. If you normally wear a European 40 or US Medium, our Medium will fit seamlessly. Check our detailed Size Guide or consult our concierge for personalized guidance.',
      },
      {
        q: 'What if an ordered piece does not fit me as expected?',
        a: 'We offer an effortless 7-day doorstep size exchange across all 64 districts in Bangladesh. Our courier delivers the replacement size to your doorstep while retrieving the original item. There is zero stress.',
      },
      {
        q: 'Do you offer custom tailoring or alterations?',
        a: 'For trousers, we provide complimentary hem length adjustments upon request during phone verification. For bespoke and made-to-measure suiting, contact our concierge to schedule a private studio consultation in Dhaka.',
      },
    ],
  },
  {
    category: 'Delivery & Shipping',
    questions: [
      {
        q: 'What are the delivery timelines and charges?',
        a: 'Within Dhaka Metropolitan: 24 to 48 hours for ৳80. Outside Dhaka (all 63 districts): 48 to 72 hours for ৳150. All orders over ৳5,000 enjoy complimentary insured delivery across Bangladesh.',
      },
      {
        q: 'Which courier services do you use?',
        a: 'We partner with Pathao Express, Steadfast Couriers, and dedicated private express couriers to guarantee safe, tracked, and insured delivery of every garment.',
      },
      {
        q: 'Can I track my consignment in real time?',
        a: 'Yes. You will receive an automated SMS with your tracking link as soon as your parcel is dispatched. You can also view live delivery milestones directly at our online Track portal using your secret tracking link.',
      },
    ],
  },
  {
    category: 'Payments & Security',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept Cash on Delivery (COD) nationwide, bKash, Nagad, Rocket, as well as Visa, Mastercard, and American Express. All digital payments are processed through bank-grade encrypted SSLCommerz gateways.',
      },
      {
        q: 'Is Cash on Delivery available outside Dhaka?',
        a: 'Yes. Cash on Delivery is available across all 64 districts in Bangladesh. You may inspect the package exterior at your doorstep before payment.',
      },
      {
        q: 'How do refunds work if I return an item?',
        a: 'You can choose between instant AUREN store credit (valid indefinitely across all drops) or a refund to your original payment method (bKash/Nagad within 3-5 days; Credit Card within 7-10 business days).',
      },
    ],
  },
];

export default function FaqPage() {
  const faqQuestions = FAQ_ITEMS.flatMap((cat) =>
    cat.questions.map((item) => ({
      question: item.q,
      answer: item.a,
    })),
  );

  return (
    <>
      <JsonLd data={faqPageJsonLd(faqQuestions)} />
      <article className="pt-8 pb-24 md:pt-14 md:pb-32">
        <div className="container-page">
          <header className="mx-auto max-w-3xl text-center">
            <p className="type-eyebrow text-accent-text">Client Guidance</p>
            <h1 className="mt-4 type-display-lg font-display text-fg">
              Frequently Asked Questions
            </h1>
            <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
              Everything you need to know about our tailoring, phone verification, doorstep
              delivery, and hassle-free exchanges.
            </p>
          </header>

          <div className="mx-auto mt-14 max-w-3xl space-y-12">
            {FAQ_ITEMS.map((section) => (
              <section key={section.category} className="border-t border-line pt-8">
                <h2 className="type-eyebrow font-medium text-accent-text">{section.category}</h2>
                <Accordion type="multiple" className="mt-4">
                  {section.questions.map((item, idx) => (
                    <AccordionItem key={idx} value={`${section.category}-${idx}`}>
                      <AccordionTrigger className="type-h3 font-medium text-fg">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="type-body leading-relaxed text-fg-muted">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
          </div>

          {/* Need More Assistance Banner */}
          <section className="mx-auto mt-16 max-w-3xl rounded-xs border border-line bg-raised/40 p-8 text-center md:p-12">
            <h2 className="type-h2 font-display text-fg">Still have an unanswered question?</h2>
            <p className="mx-auto mt-2 max-w-md type-body text-fg-muted">
              Our dedicated client concierge is available daily to assist with styling, sizing, and
              custom delivery requests.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/contact">Message Concierge on WhatsApp</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/size-guide">View Size & Fit Guide</Link>
              </Button>
            </div>
          </section>
        </div>
      </article>
    </>
  );
}
