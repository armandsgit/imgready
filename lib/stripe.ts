import crypto from 'crypto';
import { PLAN_CONFIG } from '@/lib/plans';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const BILLING_PLAN_IDS = ['starter', 'pro'] as const;
const CREDIT_PACKAGE_VALUES = [100, 500, 1000] as const;

export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];
export type CreditPackage = (typeof CREDIT_PACKAGE_VALUES)[number];

const BILLING_PLAN_ORDER: Record<BillingPlanId, number> = {
  starter: 1,
  pro: 2,
};

interface StripeCustomer {
  id: string;
}

interface StripeCheckoutSession {
  id: string;
  url: string | null;
  customer: string | null;
  subscription: string | null;
  mode?: string | null;
  client_reference_id?: string | null;
  metadata?: {
    plan?: string | null;
    userId?: string | null;
    purchaseType?: string | null;
    credits?: string | null;
  } | null;
  payment_status?: string | null;
  status?: string | null;
}

interface StripeBillingPortalSession {
  id: string;
  url: string;
}

interface StripeSubscription {
  id: string;
  status?: string | null;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean | null;
  created?: number | null;
  schedule?: string | { id?: string | null } | null;
  start_date?: number | null;
  customer?: string | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      current_period_start?: number | null;
      current_period_end?: number | null;
      price?: {
        id?: string | null;
      } | null;
    }>;
  } | null;
}

interface StripeSubscriptionItem {
  id: string;
  price?: {
    id?: string | null;
  } | null;
}

interface StripeSubscriptionList {
  data?: StripeSubscription[];
}

type CheckoutSessionWithExpandedSubscription = StripeCheckoutSession & {
  subscription?: StripeSubscription | string | null;
};

interface StripeEvent<T = Record<string, unknown>> {
  type: string;
  data: {
    object: T;
  };
}

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY.');
  }

  return secretKey;
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('Stripe webhook is not configured. Missing STRIPE_WEBHOOK_SECRET.');
  }

  return secret;
}

export function isBillingPlanId(value: string): value is BillingPlanId {
  return BILLING_PLAN_IDS.includes(value as BillingPlanId);
}

export function isCreditPackage(value: number): value is CreditPackage {
  return CREDIT_PACKAGE_VALUES.includes(value as CreditPackage);
}

export function getBillingCredits(plan: BillingPlanId | 'free') {
  if (plan === 'free') {
    return PLAN_CONFIG.free.credits;
  }

  return PLAN_CONFIG[plan].credits;
}

export function isBillingUpgrade(currentPlan: BillingPlanId, nextPlan: BillingPlanId) {
  return BILLING_PLAN_ORDER[nextPlan] > BILLING_PLAN_ORDER[currentPlan];
}

export function getStripePriceId(plan: BillingPlanId) {
  const envKey = plan === 'starter' ? 'STRIPE_STARTER_PRICE_ID' : 'STRIPE_PRO_PRICE_ID';
  const priceId = process.env[envKey];

  if (!priceId) {
    throw new Error(`Stripe price is not configured for ${plan}. Missing ${envKey}.`);
  }

  return priceId;
}

export function getPlanFromStripePriceId(priceId: string | null | undefined): BillingPlanId | null {
  if (!priceId) {
    return null;
  }

  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) {
    return 'starter';
  }

  if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    return 'pro';
  }

  return null;
}

export function getCreditPackagePriceId(creditPackage: CreditPackage) {
  const envKey = `STRIPE_CREDITS_${creditPackage}_PRICE_ID`;
  const priceId = process.env[envKey];

  if (!priceId) {
    throw new Error(`Stripe price is not configured for ${creditPackage} credits. Missing ${envKey}.`);
  }

  return priceId;
}

async function stripeRequest<T>(path: string, body: URLSearchParams) {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    let message = 'Stripe request failed.';

    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch {
      // Keep generic Stripe error if the response body cannot be parsed.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function stripeGet<T>(path: string, query?: URLSearchParams) {
  const target = query?.size ? `${STRIPE_API_BASE}${path}?${query.toString()}` : `${STRIPE_API_BASE}${path}`;
  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = 'Stripe request failed.';

    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message ?? message;
    } catch {
      // Keep generic Stripe error if the response body cannot be parsed.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function createStripeCustomer(email: string, userId: string) {
  const body = new URLSearchParams();
  body.set('email', email);
  body.set('metadata[userId]', userId);

  return stripeRequest<StripeCustomer>('/customers', body);
}

export async function createCheckoutSession(params: {
  customerId: string;
  userId: string;
  plan: BillingPlanId;
  origin: string;
}) {
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('customer', params.customerId);
  body.set('success_url', `${params.origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set('cancel_url', `${params.origin}/#pricing`);
  body.set('client_reference_id', params.userId);
  body.set('line_items[0][price]', getStripePriceId(params.plan));
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[userId]', params.userId);
  body.set('metadata[plan]', params.plan);
  body.set('subscription_data[metadata][userId]', params.userId);
  body.set('subscription_data[metadata][plan]', params.plan);

  return stripeRequest<StripeCheckoutSession>('/checkout/sessions', body);
}

export async function createCreditsCheckoutSession(params: {
  customerId: string;
  userId: string;
  creditPackage: CreditPackage;
  origin: string;
}) {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('customer', params.customerId);
  body.set('success_url', `${params.origin}/account?credits=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set('cancel_url', `${params.origin}/account`);
  body.set('client_reference_id', params.userId);
  body.set('line_items[0][price]', getCreditPackagePriceId(params.creditPackage));
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[userId]', params.userId);
  body.set('metadata[purchaseType]', 'credit_topup');
  body.set('metadata[credits]', `${params.creditPackage}`);

  return stripeRequest<StripeCheckoutSession>('/checkout/sessions', body);
}

export async function createBillingPortalSession(params: {
  customerId: string;
  origin: string;
}) {
  const body = new URLSearchParams();
  body.set('customer', params.customerId);
  body.set('return_url', `${params.origin}/account?subscription=billing-return`);

  return stripeRequest<StripeBillingPortalSession>('/billing_portal/sessions', body);
}

export async function getCheckoutSession(sessionId: string) {
  const query = new URLSearchParams();
  query.append('expand[]', 'subscription');

  return stripeGet<CheckoutSessionWithExpandedSubscription>(
    `/checkout/sessions/${sessionId}`,
    query
  );
}

export async function getStripeSubscription(subscriptionId: string) {
  const query = new URLSearchParams();
  query.append('expand[]', 'schedule');

  return stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`, query);
}

export async function getStripeSubscriptionsForCustomer(customerId: string) {
  const query = new URLSearchParams();
  query.set('customer', customerId);
  query.set('status', 'all');
  query.set('limit', '100');
  query.append('expand[]', 'data.schedule');

  return stripeGet<StripeSubscriptionList>('/subscriptions', query);
}

export async function updateStripeSubscriptionPlan(params: {
  subscriptionId: string;
  priceId: string;
  prorationBehavior?: 'always_invoice' | 'none';
  paymentBehavior?: 'allow_incomplete' | 'default_incomplete' | 'error_if_incomplete' | 'pending_if_incomplete';
}) {
  const currentSubscription = await getStripeSubscription(params.subscriptionId);
  const currentItem = currentSubscription.items?.data?.[0] as StripeSubscriptionItem | undefined;

  if (!currentItem?.id) {
    throw new Error('Could not find the current Stripe subscription item.');
  }

  const body = new URLSearchParams();
  body.set('items[0][id]', currentItem.id);
  body.set('items[0][price]', params.priceId);
  body.set('cancel_at_period_end', 'false');
  body.set('proration_behavior', params.prorationBehavior ?? 'always_invoice');
  if (params.paymentBehavior) {
    body.set('payment_behavior', params.paymentBehavior);
  }

  return stripeRequest<StripeSubscription>(`/subscriptions/${params.subscriptionId}`, body);
}

export async function setStripeSubscriptionCancelAtPeriodEnd(params: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
}) {
  const body = new URLSearchParams();
  body.set('cancel_at_period_end', params.cancelAtPeriodEnd ? 'true' : 'false');

  return stripeRequest<StripeSubscription>(`/subscriptions/${params.subscriptionId}`, body);
}

export async function resumeStripeSubscription(subscriptionId: string) {
  return setStripeSubscriptionCancelAtPeriodEnd({
    subscriptionId,
    cancelAtPeriodEnd: false,
  });
}

export async function cancelStripeSubscriptionSchedule(scheduleId: string) {
  return stripeRequest<{ id: string }>(`/subscription_schedules/${scheduleId}/cancel`, new URLSearchParams());
}

export function getStripeSubscriptionScheduleId(subscription: StripeSubscription) {
  if (!subscription.schedule) {
    return null;
  }

  return typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id ?? null;
}

export function getStripeSubscriptionCancellationUnix(subscription: {
  cancel_at?: number | null;
}) {
  return typeof subscription.cancel_at === 'number' && subscription.cancel_at > 0 ? subscription.cancel_at : null;
}

export function isStripeSubscriptionCancellationScheduled(subscription: {
  cancel_at?: number | null;
  cancel_at_period_end?: boolean | null;
  status?: string | null;
}) {
  const cancelAt = getStripeSubscriptionCancellationUnix(subscription);
  const hasFutureCancelAt = cancelAt ? cancelAt * 1000 > Date.now() : false;

  return Boolean(
    subscription.cancel_at_period_end ||
      (hasFutureCancelAt && subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired')
  );
}

function hasExpandedSubscription(
  subscription: unknown
): subscription is StripeSubscription {
  return Boolean(subscription && typeof subscription !== 'string');
}

export function resolvePlanFromCheckoutSession(session: CheckoutSessionWithExpandedSubscription) {
  const metadataPlan = session.metadata?.plan;

  if (metadataPlan && isBillingPlanId(metadataPlan)) {
    return metadataPlan;
  }

  if (hasExpandedSubscription(session.subscription)) {
    const subscriptionPriceId = session.subscription.items?.data?.[0]?.price?.id ?? null;
    return getPlanFromStripePriceId(subscriptionPriceId);
  }

  return null;
}

export function resolveSubscriptionFromCheckoutSession(session: CheckoutSessionWithExpandedSubscription) {
  if (!session.subscription) {
    return null;
  }

  return typeof session.subscription === 'string' ? { id: session.subscription } : session.subscription;
}

export function resolveSubscriptionPriceId(
  subscription: ReturnType<typeof resolveSubscriptionFromCheckoutSession>
) {
  if (!subscription || !('items' in subscription)) {
    return null;
  }

  const expandedSubscription = subscription as StripeSubscription;
  return expandedSubscription.items?.data?.[0]?.price?.id ?? null;
}

export function resolveSubscriptionPeriodEnd(
  subscription: ReturnType<typeof resolveSubscriptionFromCheckoutSession>
) {
  if (!subscription || !('current_period_end' in subscription)) {
    if (!subscription || !('items' in subscription)) {
      return null;
    }
  }

  const expandedSubscription = subscription as StripeSubscription;
  return expandedSubscription.items?.data?.[0]?.current_period_end ?? expandedSubscription.current_period_end ?? null;
}

export function resolveSubscriptionPeriodStart(
  subscription: ReturnType<typeof resolveSubscriptionFromCheckoutSession>
) {
  if (!subscription) {
    return null;
  }

  const expandedSubscription = subscription as StripeSubscription;
  return (
    expandedSubscription.items?.data?.[0]?.current_period_start ??
    expandedSubscription.current_period_start ??
    expandedSubscription.start_date ??
    null
  );
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) {
    throw new Error('Missing Stripe signature.');
  }

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe signature header.');
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', getWebhookSecret()).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const isValid = signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  });

  if (!isValid) {
    throw new Error('Invalid Stripe signature.');
  }

  return JSON.parse(rawBody) as StripeEvent;
}
