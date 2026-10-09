import { DomainError } from '@/lib/errors';
import type { BookingRequest, BookingResult, CourierProvider } from './types';

/**
 * The manual courier: staff hand the parcel to any courier or rider, type its name and tracking
 * number (and what it costs), and update the status themselves. It works without any account, so
 * fulfilment never waits for an API key.
 */
export const manualCourier: CourierProvider = {
  id: 'manual',
  label: 'Manual (any courier)',
  mode: 'manual',
  isConfigured: () => true,
  async book(request: BookingRequest): Promise<BookingResult> {
    const manual = request.manual;
    if (!manual?.courierName.trim() || !manual.trackingNumber.trim()) {
      throw new DomainError('VALIDATION', 'Enter the courier name and the tracking number.', {
        fieldErrors: {
          courierName: ['Enter the courier name.'],
          trackingNumber: ['Enter the tracking number.'],
        },
      });
    }
    return {
      consignmentId: null,
      trackingNumber: manual.trackingNumber.trim(),
      costMinor: manual.costMinor,
      labelUrl: null,
      status: 'booked',
    };
  },
};
