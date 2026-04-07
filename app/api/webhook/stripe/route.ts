import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { awardReferralReward } from '@/lib/referrals';
import {
  getBillingCredits,
  getPlanFromStripePriceId,
  getStripeSubscription,
  isBillingPlanId,
  isBillingUpgrade,
  isCreditPackage,
  verifyStripeWebhookSignature,
} from '@/lib/stripe';

export const runtime = 'nodejs';

interface StripeCheckoutSessionObject {
  id?: string | null;
  mode?: string | null;
  customer?: string | null;
  subscription?: string | null;
  client_reference_id?: string | null;
  payment_status?: string | null;
  metadata?: {
    userId?: string | null;
    purchaseType?: string | null;
    credits?: string | null;
  } | null;
}

interface StripeInvoiceLine {
  price?: {
    id?: string | null;
  } | null;
  period?: {
    end?: number | null;
  } | null;
}

interface StripeInvoiceObject {
  id?: string | null;
  customer?: string | null;
  subscription?: string | null;
  amount_paid?: number | null;
  lines?: {
    data?: StripeInvoiceLine[];
  } | null;
}

interface StripeSubscriptionObject {
  customer?: string | null;
  id?: string | null;
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  start_date?: number | null;
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

async function syncSubscriptionToUser(subscription: StripeSubscriptionObject) {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const plan = getPlanFromStripePriceId(priceId);
  const periodStart =
    subscription.items?.data?.[0]?.current_period_start ??
    subscription.current_period_start ??
    subscription.start_date ??
    null;
  const periodEnd =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end ??
    null;

  if (!subscription.customer || !subscription.id || !plan) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: subscription.customer },
    select: {
      id: true,
      plan: true,
      scheduledPlan: true,
      planChangeAt: true,
    },
  });

  if (!user) {
    return;
  }

  const periodStartDate = periodStart ? new Date(periodStart * 1000) : null;
  const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;
  const scheduledPlanReached = Boolean(
    user.scheduledPlan &&
      user.planChangeAt &&
      periodStartDate &&
      periodStartDate.getTime() >= user.planChangeAt.getTime()
  );
  const isImmediateUpgrade =
    user.plan === 'free' ||
    (isBillingPlanId(user.plan) && isBillingPlanId(plan) && isBillingUpgrade(user.plan, plan));
  const shouldApplyStripePlanImmediately =
    !user.scheduledPlan ||
    !user.planChangeAt ||
    user.scheduledPlan !== plan ||
    isImmediateUpgrade ||
    scheduledPlanReached;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(shouldApplyStripePlanImmediately
        ? {
            plan,
            credits: getBillingCredits(plan),
            scheduledPlan: null,
            planChangeAt: null,
          }
        : {}),
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.cancel_at_period_end ? 'cancelling' : subscription.status ?? 'active',
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      planStartedAt: periodStartDate,
      planExpiresAt: periodEndDate,
    },
  });
}

async function downgradeUser(where: { stripeCustomerId?: string; stripeSubscriptionId?: string }) {
  if (!where.stripeCustomerId && !where.stripeSubscriptionId) {
    return;
  }

  const user = await prisma.user.findFirst({
    where,
    select: { id: true, credits: true },
  });

  if (!user) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'free',
      credits: Math.min(user.credits, getBillingCredits('free')),
      scheduledPlan: null,
      planChangeAt: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'expired',
      cancelAtPeriodEnd: false,
      planStartedAt: null,
      planExpiresAt: null,
    },
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'));

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSessionObject;
        const userId = session.client_reference_id;
        console.log('[referral] stripe event checkout.session.completed', {
          sessionId: session.id,
          mode: session.mode,
          userId,
          purchaseType: session.metadata?.purchaseType ?? null,
        });

        if (session.mode === 'payment' && session.metadata?.purchaseType === 'credit_topup') {
          const creditPackage = Number(session.metadata.credits);
          const purchaseUserId = session.metadata.userId ?? userId;

          if (
            purchaseUserId &&
            session.id &&
            (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') &&
            isCreditPackage(creditPackage)
          ) {
            try {
              await prisma.$transaction([
                prisma.processedStripeSession.create({
                  data: {
                    sessionId: session.id,
                    kind: 'credit_topup',
                  },
                }),
                prisma.user.update({
                  where: { id: purchaseUserId },
                  data: {
                    credits: {
                      increment: creditPackage,
                    },
                    ...(session.customer ? { stripeCustomerId: session.customer } : {}),
                  },
                }),
                prisma.creditTopUp.create({
                  data: {
                    userId: purchaseUserId,
                    sessionId: session.id,
                    credits: creditPackage,
                  },
                }),
              ]);
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
              ) {
                break;
              }

              throw error;
            }

            if (session.id && purchaseUserId) {
              try {
                await awardReferralReward({
                  referredUserId: purchaseUserId,
                  sourceType: 'checkout_session',
                  sourceId: session.id,
                });
              } catch (error) {
                if (
                  !(
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === 'P2002'
                  )
                ) {
                  throw error;
                }
              }
            }
          }

          break;
        }

        if (userId && session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              stripeCustomerId: session.customer,
              ...(session.subscription ? { stripeSubscriptionId: session.subscription } : {}),
            },
          });
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as StripeInvoiceObject;
        console.log('[referral] stripe event invoice.paid', {
          invoiceId: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
        });

        if (invoice.customer && invoice.subscription) {
          const subscription = await getStripeSubscription(invoice.subscription);
          await syncSubscriptionToUser(subscription);
        }

        if (invoice.id && invoice.customer) {
          const payingUser = await prisma.user.findFirst({
            where: {
              stripeCustomerId: invoice.customer,
            },
            select: {
              id: true,
            },
          });

          if (payingUser) {
            try {
              await awardReferralReward({
                referredUserId: payingUser.id,
                sourceType: 'invoice',
                sourceId: invoice.id,
              });
            } catch (error) {
              if (
                !(
                  error instanceof Prisma.PrismaClientKnownRequestError &&
                  error.code === 'P2002'
                )
              ) {
                throw error;
              }
            }
          }
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as StripeSubscriptionObject;

        if (
          subscription.customer &&
          subscription.id &&
          subscription.current_period_start &&
          subscription.current_period_end
        ) {
          await syncSubscriptionToUser(subscription);
        } else if (subscription.id) {
          const freshSubscription = await getStripeSubscription(subscription.id);
          await syncSubscriptionToUser(freshSubscription);
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as StripeSubscriptionObject;

        await downgradeUser({
          stripeSubscriptionId: subscription.id ?? undefined,
          stripeCustomerId: subscription.customer ?? undefined,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as StripeInvoiceObject;

        if (invoice.subscription || invoice.customer) {
          await downgradeUser({
            stripeSubscriptionId: invoice.subscription ?? undefined,
            stripeCustomerId: invoice.customer ?? undefined,
          });
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
