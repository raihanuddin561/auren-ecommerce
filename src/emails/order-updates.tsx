import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';
import type { OrderUpdateTemplate } from '@/modules/notifications/templates';

/**
 * The short messages that follow an order: confirmed, changed during verification, shipped,
 * delivered, cancelled, refunded, and the steps of a return. One quiet layout, the same ivory page,
 * serif headline and square ink button as "We have your order"; a plain-text version of each is
 * rendered from the same elements, so the words are identical in both.
 */

const ink = '#0f0f0f';
const ivory = '#f6f2eb';
const stone = '#6b655c';
const line = '#e4ddd0';
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface OrderUpdateEmailProps {
  template: OrderUpdateTemplate;
  firstName: string;
  orderNumber: string;
  /** The private link to the order page (it asks for the phone or email on the order). */
  trackUrl: string;
  /** Headline and paragraphs are decided by the caller's copy (see notifications/templates.ts). */
  headline: string;
  preview: string;
  paragraphs: string[];
  /** Key facts shown as a small list (tracking number, new total, refund amount). */
  facts: Array<{ label: string; value: string }>;
  buttonLabel: string;
}

function OrderUpdateEmail(props: OrderUpdateEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ margin: 0, padding: '32px 12px', backgroundColor: ivory, color: ink }}>
        <Container
          style={{ maxWidth: 600, margin: '0 auto', backgroundColor: '#ffffff', padding: 40 }}
        >
          <Text
            style={{ margin: '0 0 32px', fontFamily: serif, fontSize: 14, letterSpacing: '0.4em' }}
          >
            AUREN
          </Text>
          <Heading
            as="h1"
            style={{ margin: '0 0 12px', fontFamily: serif, fontSize: 28, fontWeight: 400 }}
          >
            {props.headline}
          </Heading>
          {props.paragraphs.map((paragraph, index) => (
            <Text
              key={`${index}-${paragraph.slice(0, 12)}`}
              style={{ margin: '0 0 12px', fontFamily: sans, fontSize: 15, lineHeight: '24px' }}
            >
              {paragraph}
            </Text>
          ))}

          {props.facts.length > 0 ? (
            <Section style={{ margin: '20px 0 28px' }}>
              <Hr style={{ borderColor: line, margin: '0 0 16px' }} />
              {props.facts.map((fact) => (
                <Text
                  key={fact.label}
                  style={{ margin: '0 0 6px', fontFamily: sans, fontSize: 14, lineHeight: '22px' }}
                >
                  <span style={{ color: stone }}>{`${fact.label}: `}</span>
                  {fact.value}
                </Text>
              ))}
              <Hr style={{ borderColor: line, margin: '16px 0 0' }} />
            </Section>
          ) : null}

          <Button
            href={props.trackUrl}
            style={{
              backgroundColor: ink,
              color: '#ffffff',
              padding: '14px 28px',
              fontFamily: sans,
              fontSize: 13,
              letterSpacing: '0.08em',
              textDecoration: 'none',
            }}
          >
            {props.buttonLabel}
          </Button>
          <Text style={{ margin: '24px 0 0', fontFamily: sans, fontSize: 12, color: stone }}>
            {`Order ${props.orderNumber}. For your privacy the page asks for the phone number or email address on the order.`}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export interface RenderedUpdateEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderOrderUpdateEmail(
  props: OrderUpdateEmailProps,
  subject: string,
): Promise<RenderedUpdateEmail> {
  const element = <OrderUpdateEmail {...props} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject, html, text };
}
