import type { Page } from '@playwright/test';
import { db } from '@/lib/db';
import { ensureReferenceData } from '@/modules/shipping/service';
import { TEST_PASSWORD } from '../factories';
import {
  deliveredOrder,
  makeSellableVariant,
  placeTestOrder,
} from '../integration/commerce-helpers';
import { expect, test } from './fixtures';

/**
 * Two short stories against a real database. First, a team member cancels an order on the phone
 * with the customer: the stock comes back and nobody is charged. Second, a delivered order is
 * returned: the customer asks from their order page, the team approves, receives and inspects it,
 * the goods go back on the shelf, and the refund is recorded after a fresh password.
 */
test.describe.configure({ timeout: 300_000 });

const address = () =>
  `198.19.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
test.use({ extraHTTPHeaders: { 'x-forwarded-for': address() } });

const settle = async (page: Page) =>
  expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 20_000 });

test.beforeAll(async () => {
  await db.$transaction((tx) => ensureReferenceData(tx), { timeout: 60_000 });
});

test('a cancelled order gives its stock back and charges nobody', async ({
  staffPage,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Covered on desktop');
  const variant = await makeSellableVariant({ stock: 5, priceMinor: 250000n });
  const { orderId } = await placeTestOrder({ variant, quantity: 2 });
  const level = () =>
    db.inventoryLevel.findFirstOrThrow({ where: { variantId: variant.variantId } });
  expect((await level()).onHand).toBe(3);

  const verifier = await staffPage({ role: 'order_verifier' });
  await verifier.goto(`/admin/orders/verification?order=${orderId}`);
  await verifier.getByRole('button', { name: 'Cancel order' }).first().click();
  const dialog = verifier.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: /^Cancel order AUR-/ })).toBeVisible();
  await dialog.getByLabel(/^Reason/).selectOption('customer_cancelled');
  await dialog.getByLabel(/^Note/).fill('The customer changed their mind on the phone');
  await dialog.getByRole('button', { name: 'Cancel order' }).click();
  await expect(verifier.getByText(/^Order AUR-\d+ cancelled/)).toBeVisible();
  await settle(verifier);

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  expect(order).toMatchObject({ status: 'cancelled', cancelReason: 'customer_cancelled' });
  expect(order.cancelledBy).not.toBeNull();
  expect((await level()).onHand).toBe(5);
  // Cash on delivery: nothing was paid, so there is nothing to refund.
  expect(await db.refund.count({ where: { orderId } })).toBe(0);
  expect(order.paidMinor).toBe(0n);

  // The order page keeps the story.
  await verifier.goto(`/admin/orders/${orderId}`);
  await expect(verifier.getByText('Cancelled').first()).toBeVisible();
});

test('a return is requested by the customer, inspected, restocked and refunded', async ({
  page,
  staffPage,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Covered on desktop');
  const delivered = await deliveredOrder({ quantity: 2, stock: 8, priceMinor: 200000n });
  const stockNow = async () =>
    (
      await db.inventoryLevel.findFirstOrThrow({
        where: { variantId: delivered.variant.variantId },
      })
    ).onHand;
  expect(await stockNow()).toBe(6);
  const order = await db.order.findUniqueOrThrow({ where: { id: delivered.orderId } });

  // --- The customer opens the order with the phone number and asks for a return ------------------
  const { deriveTrackingToken } = await import('@/modules/orders/tracking');
  const trackUrl = `/track/${deriveTrackingToken(order.id)}`;
  await page.goto(trackUrl);
  await page.getByLabel(/Phone number or email used for the order/).fill(order.phone);
  await page.getByRole('button', { name: 'View my order' }).click();
  await expect(
    page.getByRole('heading', { name: 'Need to return or exchange something?' }),
  ).toBeVisible();
  const form = page.getByRole('region', { name: 'Need to return or exchange something?' });
  await form.getByRole('checkbox').first().click();
  await form.getByLabel(/How many/).fill('1');
  await form.getByLabel('Why').selectOption('too_small');
  await form.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(/^We have your request/)).toBeVisible();
  const request = await db.returnRequest.findFirstOrThrow({ where: { orderId: order.id } });
  expect(request).toMatchObject({ status: 'requested', type: 'return' });
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
    'return_requested',
  );

  // --- The team works through it ---------------------------------------------------------------
  const owner = await staffPage({ role: 'owner' });
  await owner.goto(`/admin/orders/${order.id}`);
  const section = owner.getByRole('region', { name: 'Returns and exchanges' });
  await expect(section.getByText(request.returnNumber)).toBeVisible();
  await section.getByRole('button', { name: 'Approve' }).click();
  await expect(owner.getByText(`${request.returnNumber} approved`)).toBeVisible();
  await settle(owner);
  await section.getByRole('button', { name: 'Mark received' }).click();
  await owner
    .getByRole('dialog')
    .getByLabel(/Return shipping cost/)
    .fill('80');
  await owner.getByRole('dialog').getByRole('button', { name: 'Mark received' }).click();
  await expect(owner.getByText('Return received.')).toBeVisible();
  await settle(owner);
  await section.getByRole('button', { name: 'Inspect the items' }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Save inspection' }).click();
  await expect(owner.getByText('Inspection saved. Stock is updated.')).toBeVisible();
  await settle(owner);
  // The unit that came back is on the shelf again.
  expect(await stockNow()).toBe(7);

  // Settle as a refund: needs the password (fresh confirmation), then it is recorded.
  await section.getByRole('button', { name: 'Settle the return' }).click();
  const dialog = owner.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Settle return' }).click();
  await expect(dialog.getByText(/Confirm your password/).first()).toBeVisible();
  await dialog.getByLabel('Your password').fill(TEST_PASSWORD);
  await dialog.getByRole('button', { name: 'Settle return' }).click();
  await expect(owner.getByText('Return settled')).toBeVisible();
  await settle(owner);

  const refund = await db.refund.findFirstOrThrow({ where: { orderId: order.id } });
  expect(refund).toMatchObject({
    status: 'succeeded',
    amountMinor: 200000n,
    returnRequestId: request.id,
  });
  const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  // One of two units came back: the order stands, partly refunded.
  expect(after).toMatchObject({
    status: 'delivered',
    refundedMinor: 200000n,
    paymentStatus: 'partially_refunded',
  });
  const returnCost = await db.orderCostLine.findFirstOrThrow({
    where: { orderId: order.id, type: 'return_shipping' },
  });
  expect(returnCost.amountMinor).toBe(8000n);
});
