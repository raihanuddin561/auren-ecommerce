/** The messages that follow an order (the email layout is in src/emails/order-updates.tsx). */
export type OrderUpdateTemplate =
  | 'order_confirmed'
  | 'order_updated'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'refund_processed'
  | 'return_update';

/**
 * The words of every order message, in one pure place so email and SMS never disagree and the copy
 * can be unit tested. Tone: a concierge. No internal reasons or staff names ever appear here: a
 * cancelled order says it was cancelled, not that it was flagged as fake.
 */

export interface MessageContext {
  firstName: string;
  orderNumber: string;
  trackUrl: string;
  /** Formatted money, for example "৳2,750". */
  total?: string;
  previousTotal?: string;
  courierName?: string | null;
  trackingNumber?: string | null;
  eta?: string | null;
  refundAmount?: string;
  refundMethod?: string;
  returnNumber?: string;
  returnStatus?: string;
}

export interface EmailCopy {
  subject: string;
  headline: string;
  preview: string;
  paragraphs: string[];
  facts: Array<{ label: string; value: string }>;
  buttonLabel: string;
}

export interface MessageCopy {
  template: OrderUpdateTemplate;
  email: EmailCopy;
  /** Short text for SMS, or null when this message is not sent by SMS. */
  sms: string | null;
}

const facts = (entries: Array<[string, string | null | undefined]>) =>
  entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => ({ label, value }));

export function confirmedCopy(c: MessageContext): MessageCopy {
  return {
    template: 'order_confirmed',
    email: {
      subject: `Your order ${c.orderNumber} is confirmed`,
      headline: `Confirmed, ${c.firstName}`,
      preview: `Order ${c.orderNumber} is confirmed and being prepared.`,
      paragraphs: [
        `Thank you for speaking with us. Your order ${c.orderNumber} is confirmed and our team is preparing it.`,
        'We will email and message you again the moment it is on its way.',
      ],
      facts: facts([['Total to pay on delivery', c.total]]),
      buttonLabel: 'View your order',
    },
    sms: `AUREN: Hi ${c.firstName}, your order ${c.orderNumber} is confirmed and being prepared. Track it: ${c.trackUrl}`,
  };
}

export function updatedCopy(c: MessageContext): MessageCopy {
  const changed = Boolean(c.previousTotal && c.total && c.previousTotal !== c.total);
  return {
    template: 'order_updated',
    email: {
      subject: `Your order ${c.orderNumber} was updated`,
      headline: 'Your order was updated',
      preview: changed
        ? `Order ${c.orderNumber}: the total is now ${c.total}.`
        : `Order ${c.orderNumber} was updated as we agreed.`,
      paragraphs: [
        `As we agreed on our call, we updated your order ${c.orderNumber}.`,
        changed
          ? `The new total is ${c.total} (it was ${c.previousTotal}). Please check it before we confirm.`
          : 'Nothing changes in what you pay.',
      ],
      facts: facts([
        ['New total', changed ? c.total : null],
        ['Previous total', changed ? c.previousTotal : null],
      ]),
      buttonLabel: 'Review your order',
    },
    sms: changed
      ? `AUREN: Your order ${c.orderNumber} was updated. New total ${c.total} (was ${c.previousTotal}). Details: ${c.trackUrl}`
      : null,
  };
}

export function shippedCopy(c: MessageContext): MessageCopy {
  return {
    template: 'order_shipped',
    email: {
      subject: `Your order ${c.orderNumber} is on its way`,
      headline: 'On its way to you',
      preview: `Order ${c.orderNumber} has been handed to the courier.`,
      paragraphs: [
        `Your order ${c.orderNumber} has left us and is with the courier.`,
        c.eta ? `Expected delivery: ${c.eta}.` : 'We will let you know when it is delivered.',
        'Please keep your phone close: the rider will call you.',
      ],
      facts: facts([
        ['Courier', c.courierName],
        ['Tracking number', c.trackingNumber],
        ['Total to pay on delivery', c.total],
      ]),
      buttonLabel: 'Track your order',
    },
    sms: `AUREN: Your order ${c.orderNumber} is on its way${c.courierName ? ` with ${c.courierName}` : ''}${c.trackingNumber ? ` (tracking ${c.trackingNumber})` : ''}. Pay ${c.total ?? 'the total'} on delivery.`,
  };
}

export function deliveredCopy(c: MessageContext): MessageCopy {
  return {
    template: 'order_delivered',
    email: {
      subject: `Your order ${c.orderNumber} was delivered`,
      headline: 'Delivered. We hope you love it.',
      preview: `Order ${c.orderNumber} has arrived.`,
      paragraphs: [
        `Your order ${c.orderNumber} has been delivered. Thank you for choosing AUREN.`,
        'If something is not right, you can ask for a return or an exchange from your order page within 7 days.',
      ],
      facts: [],
      buttonLabel: 'View your order',
    },
    sms: null,
  };
}

export function cancelledCopy(c: MessageContext): MessageCopy {
  return {
    template: 'order_cancelled',
    email: {
      subject: `Your order ${c.orderNumber} was cancelled`,
      headline: 'Your order was cancelled',
      preview: `Order ${c.orderNumber} was cancelled.`,
      paragraphs: [
        `Your order ${c.orderNumber} has been cancelled. Nothing more is needed from you.`,
        'If you paid, any refund is arranged by our team and you will hear from us. If this was not what you expected, please message our concierge.',
      ],
      facts: [],
      buttonLabel: 'View your order',
    },
    sms: `AUREN: Your order ${c.orderNumber} was cancelled. Questions? Message our concierge.`,
  };
}

export function refundCopy(c: MessageContext): MessageCopy {
  return {
    template: 'refund_processed',
    email: {
      subject: `A refund for order ${c.orderNumber}`,
      headline: 'Your refund is on its way',
      preview: `We refunded ${c.refundAmount ?? 'your order'}.`,
      paragraphs: [
        `We have refunded ${c.refundAmount ?? 'your order'} for order ${c.orderNumber}.`,
        c.refundMethod === 'Store credit'
          ? 'It was added to your AUREN store credit.'
          : 'It is sent the way we agreed with you. Mobile banking refunds usually arrive within a day.',
      ],
      facts: facts([
        ['Refund', c.refundAmount],
        ['Method', c.refundMethod],
      ]),
      buttonLabel: 'View your order',
    },
    sms: null,
  };
}

const RETURN_WORDS: Record<string, { headline: string; body: string } | undefined> = {
  requested: {
    headline: 'We have your return request',
    body: 'Our team will review it and get back to you shortly.',
  },
  approved: {
    headline: 'Your return is approved',
    body: 'Please send the items back with their tags and packaging. We will confirm when they arrive.',
  },
  rejected: {
    headline: 'About your return request',
    body: 'We are unable to take this return. Please message our concierge and we will help.',
  },
  received: {
    headline: 'We have your return',
    body: 'Our team is inspecting the items and will settle it shortly.',
  },
  refunded: {
    headline: 'Your return is settled',
    body: 'Your refund has been arranged. You will receive a separate note with the details.',
  },
  exchanged: {
    headline: 'Your exchange is on its way',
    body: 'Your replacement is being prepared. You will receive tracking details when it ships.',
  },
  closed: {
    headline: 'Your return is closed',
    body: 'We have finished with this request. Please message our concierge if you have questions.',
  },
};

/** Statuses of a return that tell the customer something. Others (inspected, in transit) stay internal. */
export const CUSTOMER_RETURN_STATUSES = Object.keys(RETURN_WORDS);

export function returnCopy(c: MessageContext): MessageCopy | null {
  const words = c.returnStatus ? RETURN_WORDS[c.returnStatus] : undefined;
  if (!words) return null;
  return {
    template: 'return_update',
    email: {
      subject: `${words.headline} (${c.returnNumber ?? c.orderNumber})`,
      headline: words.headline,
      preview: `${c.returnNumber ?? 'Return'} for order ${c.orderNumber}`,
      paragraphs: [
        `Return ${c.returnNumber ?? ''} for order ${c.orderNumber}.`.replace('  ', ' '),
        words.body,
      ],
      facts: [],
      buttonLabel: 'View your order',
    },
    sms: null,
  };
}

/** Which message follows an order moving to a status, if any. */
export function copyForStatus(to: string, c: MessageContext): MessageCopy | null {
  switch (to) {
    case 'confirmed':
      return confirmedCopy(c);
    case 'shipped':
      return shippedCopy(c);
    case 'delivered':
      return deliveredCopy(c);
    case 'cancelled':
      return cancelledCopy(c);
    default:
      return null;
  }
}
