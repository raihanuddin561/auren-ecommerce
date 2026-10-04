import { CreditCard, Repeat, Truck } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Icon } from '@/components/ui/icon';
import type { PdpData } from '@/modules/catalog/pdp';

/** Eyebrow, serif title and subtitle. The page's only h1. */
export function ProductHeading({ product }: { product: PdpData }) {
  return (
    <header className="flex flex-col gap-3">
      {product.eyebrow ? <p className="type-eyebrow text-fg-muted">{product.eyebrow}</p> : null}
      <h1 className="type-h1 text-fg">{product.title}</h1>
      {product.subtitle ? <p className="type-body text-fg-muted">{product.subtitle}</p> : null}
    </header>
  );
}

const TRUST = [
  { icon: Repeat, text: 'Easy size exchange' },
  { icon: CreditCard, text: 'Secure payment' },
  { icon: Truck, text: 'Cash on delivery available' },
] as const;

export function TrustRow() {
  return (
    <ul className="grid gap-3 border-y border-line py-5 sm:grid-cols-3">
      {TRUST.map(({ icon, text }) => (
        <li key={text} className="flex items-center gap-3 type-small text-fg-muted">
          <Icon icon={icon} size={18} className="text-fg" />
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Details and fit, fabric and care, delivery and returns. Plain text only, never HTML. */
export function ProductAccordions({ product }: { product: PdpData }) {
  return (
    <Accordion type="single" collapsible defaultValue="details" className="border-t border-line">
      <AccordionItem value="details">
        <AccordionTrigger>Details and fit</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 type-body text-fg-muted">
            {product.description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {product.details.length > 0 ? (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 type-small">
                {product.details.map((detail) => (
                  <div key={detail.label} className="contents">
                    <dt className="text-fg">{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="care">
        <AccordionTrigger>Fabric and care</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 type-body text-fg-muted">
            {product.fabric ? <p>Crafted in {product.fabric.toLowerCase()}.</p> : null}
            <p>{product.care ?? 'Follow the care label sewn into the garment.'}</p>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="delivery">
        <AccordionTrigger>Delivery and returns</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 type-body text-fg-muted">
            <p>
              Every order is confirmed by our team before it ships, usually within a couple of
              hours. We will call you to check the size and the address.
            </p>
            <p>
              If the size is not right, exchange it for another. Pieces must be unworn with the tags
              attached.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
