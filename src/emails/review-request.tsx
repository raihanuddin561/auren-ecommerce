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

const ink = '#0f0f0f';
const ivory = '#f6f2eb';
const stone = '#6b655c';
const line = '#e4ddd0';
const gold = '#A8875A';
const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface ReviewRequestEmailProps {
  firstName: string;
  orderNumber: string;
  productTitle: string;
  productSlug: string;
  reviewUrl: string;
  productImage?: string | null;
}

export function ReviewRequestEmail(props: ReviewRequestEmailProps) {
  const preview = `How is the fit and drape of your ${props.productTitle}?`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
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
            style={{
              margin: '0 0 16px',
              fontFamily: serif,
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.25,
            }}
          >
            How is your fitting, {props.firstName}?
          </Heading>

          <Text style={{ margin: '0 0 16px', fontFamily: sans, fontSize: 14, lineHeight: 1.6 }}>
            A few days have passed since your atelier commission ({props.orderNumber}) was delivered
            to your doorstep. We hope the drape, noble fibers, and tailored proportions match your
            high standards.
          </Text>

          <Text style={{ margin: '0 0 24px', fontFamily: sans, fontSize: 14, lineHeight: 1.6 }}>
            Our tailoring studio in Dhaka relies on discerning clients like you to refine our
            patterns, natural fiber sourcing, and sizing guides.
          </Text>

          <Section
            style={{
              padding: '20px',
              border: `1px solid ${line}`,
              backgroundColor: ivory,
              marginBottom: '28px',
            }}
          >
            <Text
              style={{
                margin: '0 0 8px',
                fontFamily: sans,
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: gold,
                fontWeight: 600,
              }}
            >
              Delivered Atelier Garment
            </Text>
            <Text
              style={{
                margin: '0 0 16px',
                fontFamily: serif,
                fontSize: 18,
                fontWeight: 600,
                color: ink,
              }}
            >
              {props.productTitle}
            </Text>

            <Button
              href={props.reviewUrl}
              style={{
                display: 'inline-block',
                backgroundColor: ink,
                color: '#ffffff',
                fontFamily: sans,
                fontSize: 13,
                fontWeight: 500,
                padding: '12px 24px',
                textDecoration: 'none',
              }}
            >
              Share Atelier Verdict
            </Button>
          </Section>

          <Text
            style={{
              margin: '0 0 16px',
              fontFamily: sans,
              fontSize: 13,
              color: stone,
              lineHeight: 1.5,
            }}
          >
            Did the garment run small or require a doorstep swap? Remember our Banani concierge desk
            remains at your disposal on WhatsApp for any bespoke adjustments.
          </Text>

          <Hr style={{ margin: '32px 0 24px', borderColor: line }} />

          <Text
            style={{ margin: '0', fontFamily: sans, fontSize: 12, color: stone, lineHeight: 1.5 }}
          >
            AUREN Atelier Ltd. · House 42, Road 11, Block D, Banani, Dhaka · support@auren.com.bd
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderReviewRequestEmail(
  props: ReviewRequestEmailProps,
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(ReviewRequestEmail(props)),
    render(ReviewRequestEmail(props), { plainText: true }),
  ]);
  return { html, text };
}
