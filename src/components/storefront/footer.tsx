import { cacheLife } from 'next/cache';
import Link from 'next/link';
import { FOOTER_COLUMNS, LEGAL_LINKS, PAYMENT_MARKS, SOCIAL_LINKS } from '@/lib/site';
import { NewsletterForm } from './newsletter-form';
import { Wordmark } from './wordmark';

const linkClass =
  'inline-flex min-h-11 items-center type-small text-fg-muted underline-offset-4 transition-auren-fast hover:text-fg hover:underline';

/** Cached daily: reading the clock during a render must not make the whole footer dynamic. */
async function CopyrightYear() {
  'use cache';
  cacheLife('days');
  return <>{new Date().getFullYear()}</>;
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-page text-fg">
      <div className="container-page grid gap-12 py-16 md:py-20 lg:grid-cols-12">
        <section aria-labelledby="newsletter-heading" className="lg:col-span-5">
          <p className="type-eyebrow text-accent-text">Early access</p>
          <h2 id="newsletter-heading" className="mt-3 type-h2 text-fg">
            Receive early access to new collections
          </h2>
          <p className="mt-3 max-w-md type-body text-fg-muted">
            Occasional letters from the house. No noise, and you can leave at any time.
          </p>
          <div className="mt-6 max-w-md">
            <NewsletterForm />
          </div>
        </section>

        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:col-span-7 lg:col-start-6"
        >
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="type-eyebrow text-fg">{column.heading}</h2>
              <ul className="mt-4 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {SOCIAL_LINKS.length > 0 ? (
            <div>
              <h2 className="type-eyebrow text-fg">Follow</h2>
              <ul className="mt-4 flex flex-col">
                {SOCIAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      className={linkClass}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-6 py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <Wordmark asText />
            <p className="type-small text-fg-muted">Modern, refined menswear. Dhaka, Bangladesh.</p>
          </div>

          <ul aria-label="Payment methods" className="flex flex-wrap gap-2">
            {PAYMENT_MARKS.map((mark) => (
              <li
                key={mark}
                className="border border-line-strong px-2.5 py-1.5 type-eyebrow text-fg-muted"
              >
                {mark}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 lg:items-end">
            <p className="type-small text-fg-muted">Bangladesh · BDT (৳)</p>
            <ul className="flex gap-5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="container-page pb-24 type-small text-fg-muted md:pb-8">
          © <CopyrightYear /> AUREN. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
