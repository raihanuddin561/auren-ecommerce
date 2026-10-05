import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';

/**
 * "We have your order": sent right after an order is placed. Tone: a concierge, not a receipt.
 * It says plainly that a person will confirm the order before it is prepared. Ivory page, white
 * 600 px column, serif headline, ink button with square corners, 4:5 pictures, no web fonts
 * needed to read it.
 */

export interface OrderEmailLine {
  title: string;
  variantLabel: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  /** Absolute address, or null. */
  imageUrl: string | null;
}

export interface OrderReceivedEmailProps {
  firstName: string;
  orderNumber: string;
  lines: OrderEmailLine[];
  subtotal: string;
  shipping: string;
  total: string;
  addressLines: string[];
  paymentLabel: string;
  /** The private link to the order page (it asks for the phone or email on the order). */
  trackUrl: string;
}

const ink = '#0f0f0f';
const ivory = '#f6f2eb';
const stone = '#6b655c';
const line = '#e4ddd0';
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function OrderReceivedEmail(props: OrderReceivedEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {`Order ${props.orderNumber}: our team will personally confirm it shortly.`}
      </Preview>
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
            {`Thank you, ${props.firstName}`}
          </Heading>
          <Text style={{ margin: '0 0 8px', fontFamily: sans, fontSize: 15, lineHeight: '24px' }}>
            {`We have your order ${props.orderNumber}. Our team will personally confirm it with you shortly, usually within 2 hours, before we prepare it.`}
          </Text>
          <Text style={{ margin: '0 0 28px', fontFamily: sans, fontSize: 13, color: stone }}>
            Placed, then verified, shipped and delivered: you will hear from us at each step.
          </Text>

          <Hr style={{ borderColor: line, margin: '0 0 24px' }} />

          {props.lines.map((item, index) => (
            <Row key={`${item.title}-${index}`} style={{ marginBottom: 16 }}>
              <Column style={{ width: 72, verticalAlign: 'top' }}>
                {item.imageUrl ? (
                  <Img
                    src={item.imageUrl}
                    alt={item.title}
                    width={64}
                    height={80}
                    style={{ objectFit: 'cover', display: 'block' }}
                  />
                ) : null}
              </Column>
              <Column style={{ verticalAlign: 'top' }}>
                <Text style={{ margin: 0, fontFamily: sans, fontSize: 14, lineHeight: '20px' }}>
                  {item.title}
                </Text>
                <Text style={{ margin: 0, fontFamily: sans, fontSize: 13, color: stone }}>
                  {`${item.variantLabel} · Qty ${item.quantity}`}
                </Text>
              </Column>
              <Column style={{ width: 110, textAlign: 'right', verticalAlign: 'top' }}>
                <Text style={{ margin: 0, fontFamily: sans, fontSize: 14 }}>{item.lineTotal}</Text>
              </Column>
            </Row>
          ))}

          <Hr style={{ borderColor: line, margin: '8px 0 16px' }} />

          {[
            ['Subtotal', props.subtotal],
            ['Delivery', props.shipping],
          ].map(([label, value]) => (
            <Row key={label}>
              <Column>
                <Text style={{ margin: '0 0 6px', fontFamily: sans, fontSize: 14, color: stone }}>
                  {label}
                </Text>
              </Column>
              <Column style={{ textAlign: 'right' }}>
                <Text style={{ margin: '0 0 6px', fontFamily: sans, fontSize: 14 }}>{value}</Text>
              </Column>
            </Row>
          ))}
          <Row>
            <Column>
              <Text style={{ margin: '8px 0 24px', fontFamily: sans, fontSize: 15 }}>Total</Text>
            </Column>
            <Column style={{ textAlign: 'right' }}>
              <Text style={{ margin: '8px 0 24px', fontFamily: sans, fontSize: 15 }}>
                {props.total}
              </Text>
            </Column>
          </Row>

          <Section style={{ marginBottom: 24 }}>
            <Text
              style={{ margin: '0 0 4px', fontFamily: sans, fontSize: 12, letterSpacing: '0.18em' }}
            >
              DELIVERY TO
            </Text>
            {props.addressLines.map((addressLine, index) => (
              <Text
                key={`${addressLine}-${index}`}
                style={{ margin: 0, fontFamily: sans, fontSize: 14, lineHeight: '22px' }}
              >
                {addressLine}
              </Text>
            ))}
            <Text style={{ margin: '12px 0 0', fontFamily: sans, fontSize: 14 }}>
              {`Payment: ${props.paymentLabel}`}
            </Text>
          </Section>

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
            View your order
          </Button>
          <Text style={{ margin: '24px 0 0', fontFamily: sans, fontSize: 12, color: stone }}>
            For your privacy the page asks for the phone number or email address on the order.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export interface RenderedOrderEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderOrderReceivedEmail(
  props: OrderReceivedEmailProps,
): Promise<RenderedOrderEmail> {
  const element = <OrderReceivedEmail {...props} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: `We have your order ${props.orderNumber}`, html, text };
}
