import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_RETURN_STATUSES,
  cancelledCopy,
  confirmedCopy,
  copyForStatus,
  deliveredCopy,
  refundCopy,
  returnCopy,
  shippedCopy,
  updatedCopy,
  type MessageContext,
} from '../templates';

const context: MessageContext = {
  firstName: 'Ayaan',
  orderNumber: 'AUR-100001',
  trackUrl: 'https://auren.example/track/abc',
  total: '৳2,580',
  courierName: 'Sundarban',
  trackingNumber: 'SB-1001',
  eta: '1 to 2 days',
};

describe('order message copy (13.2, 13.3)', () => {
  it('only four statuses message the customer, and the rest stay quiet', () => {
    for (const status of ['confirmed', 'shipped', 'delivered', 'cancelled']) {
      expect(copyForStatus(status, context), status).not.toBeNull();
    }
    for (const status of [
      'placed',
      'under_verification',
      'on_hold',
      'processing',
      'delivery_failed',
      'returned_to_origin',
    ]) {
      expect(copyForStatus(status, context), status).toBeNull();
    }
  });

  it('SMS texts are short, branded, and name the order', () => {
    for (const copy of [confirmedCopy(context), shippedCopy(context), cancelledCopy(context)]) {
      expect(copy.sms).toMatch(/^AUREN: /);
      expect(copy.sms!.length).toBeLessThanOrEqual(220);
      expect(copy.sms).toContain('AUR-100001');
    }
    // Delivered and refunds are email only.
    expect(deliveredCopy(context).sms).toBeNull();
    expect(refundCopy(context).sms).toBeNull();
  });

  it('shipped carries the courier, the tracking number and the amount to pay', () => {
    const copy = shippedCopy(context);
    expect(copy.email.facts).toEqual([
      { label: 'Courier', value: 'Sundarban' },
      { label: 'Tracking number', value: 'SB-1001' },
      { label: 'Total to pay on delivery', value: '৳2,580' },
    ]);
    expect(copy.email.paragraphs.join(' ')).toContain('1 to 2 days');
    expect(copy.sms).toContain('SB-1001');
  });

  it('an update shows both totals and sends an SMS only when the total changed', () => {
    const changed = updatedCopy({ ...context, total: '৳5,080', previousTotal: '৳2,580' });
    expect(changed.email.paragraphs.join(' ')).toContain('৳5,080');
    expect(changed.email.paragraphs.join(' ')).toContain('৳2,580');
    expect(changed.sms).toContain('৳5,080');
    const same = updatedCopy({ ...context, total: '৳2,580', previousTotal: '৳2,580' });
    expect(same.sms).toBeNull();
  });

  it('a cancelled order never reveals an internal reason, and sets no false promise about money', () => {
    const copy = cancelledCopy(context);
    const text = JSON.stringify(copy).toLowerCase();
    for (const word of ['fake', 'fraud', 'flag', 'suspect', 'risk', 'blocked']) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toContain('refunded automatically');
  });

  it('a refund names the amount and how it was sent; store credit says so', () => {
    const bkash = refundCopy({ ...context, refundAmount: '৳500', refundMethod: 'bKash' });
    expect(bkash.email.facts).toEqual([
      { label: 'Refund', value: '৳500' },
      { label: 'Method', value: 'bKash' },
    ]);
    const credit = refundCopy({ ...context, refundAmount: '৳500', refundMethod: 'Store credit' });
    expect(credit.email.paragraphs.join(' ')).toContain('store credit');
  });

  it('return updates cover the customer-facing statuses and skip the internal ones', () => {
    for (const status of CUSTOMER_RETURN_STATUSES) {
      const copy = returnCopy({ ...context, returnNumber: 'RET-0001', returnStatus: status });
      expect(copy, status).not.toBeNull();
      expect(copy!.email.subject).toContain('RET-0001');
    }
    for (const status of ['inspected', 'in_transit']) {
      expect(returnCopy({ ...context, returnNumber: 'RET-0001', returnStatus: status })).toBeNull();
    }
  });

  it('confirmed tells the customer what happens next without hype', () => {
    const copy = confirmedCopy(context);
    expect(copy.email.subject).toBe('Your order AUR-100001 is confirmed');
    expect(copy.email.paragraphs.join(' ')).toContain('on its way');
  });
});
