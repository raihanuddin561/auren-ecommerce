import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | AUREN',
  description:
    'Our privacy policy detailing how AUREN protects and handles client personal information, phone verification, and payment data.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <article className="pt-8 pb-24 md:pt-14 md:pb-32">
      <div className="container-page">
        <header className="mx-auto max-w-3xl">
          <p className="type-eyebrow text-accent-text">Legal & Data Protection</p>
          <h1 className="mt-4 type-display-lg font-display text-fg">Privacy Policy</h1>
          <p className="mt-2 type-small font-mono text-fg-muted">Last updated: October 2026</p>
        </header>

        <div className="mx-auto mt-12 max-w-3xl space-y-10 type-body text-fg-muted">
          <section>
            <h2 className="type-h3 font-display text-fg">1. Commitment to Client Privacy</h2>
            <p className="mt-3">
              AUREN (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates with quiet
              discretion. We believe your personal data, shopping preferences, and sizing
              measurements deserve the highest standard of confidentiality. We do not sell, rent, or
              trade your personal data to third-party marketing brokers.
            </p>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">2. Information We Collect</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Contact & Delivery Details:</strong> Name, delivery address, phone number,
                and email address required to deliver and verify orders.
              </li>
              <li>
                <strong>Garment & Sizing Profiles:</strong> Sizing preferences, alterations notes,
                and purchased variants to facilitate personalized reordering and client care.
              </li>
              <li>
                <strong>Payment Information:</strong> We do not store raw credit card numbers. All
                digital transactions are tokenized and processed securely through accredited payment
                gateways (SSLCommerz) with bank-grade encryption.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">3. How Your Information Is Used</h2>
            <p className="mt-3">We collect and process personal data strictly for:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Fulfilling orders, processing payments, and arranging courier transit.</li>
              <li>
                Conducting telephone order verification to prevent fraudulent orders and confirm
                fit.
              </li>
              <li>Providing real-time SMS tracking updates on your consignment.</li>
              <li>Facilitating doorstep size exchanges and return settlements.</li>
              <li>Sending occasional house communications if you subscribed to our newsletter.</li>
            </ul>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">4. Disclosure to Third Parties</h2>
            <p className="mt-3">
              Your details are disclosed strictly to necessary service providers:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Courier Partners (Pathao, Steadfast):</strong> Delivery address, phone
                number, and consignment value for delivery and Cash on Delivery remittance.
              </li>
              <li>
                <strong>Payment Processors:</strong> Transaction tokens to complete bank
                settlements.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="type-h3 font-display text-fg">5. Data Retention & Deletion</h2>
            <p className="mt-3">
              You retain the right to request access to, correction of, or deletion of your personal
              account data at any time. To request a full data export or deletion, contact our
              client concierge at <strong>concierge@aurenbd.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
