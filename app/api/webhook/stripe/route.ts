import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getRenewedCreditTotal, isSameBillingCycle } from '@/lib/creditBalances';
import { prisma } from '@/lib/prisma';
import { awardReferralReward } from '@/lib/referrals';
import {
  getPlanFromStripePriceId,
  getStripeSubscription,
  getStripeSubscriptionCancellationUnix,
  isStripeSubscriptionCancellationScheduled,
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

interface StripeWebhookEvent {
  id?: string | null;
  type: string;
  data: {
    object: unknown;
  };
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
  cancel_at?: number | null;
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

async function markProcessedStripeId(id: string, kind: string) {
  try {
    await prisma.processedStripeSession.create({
      data: {
        sessionId: id,
        kind,
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }

    throw error;
  }
}

async function syncSubscriptionToUser(subscription: StripeSubscriptionObject) {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const plan = getPlanFromStripePriceId(priceId);
  const periodStart =
    subscription.items?.data?.[0]?.current_period_start ??
    subscription.current_period_start ??
    subscription.start_date ??
    null;
  const cancellationScheduled = isStripeSubscriptionCancellationScheduled(subscription);
  const cancellationUnix = getStripeSubscriptionCancellationUnix(subscription);
  const periodEnd =
    (cancellationScheduled ? cancellationUnix : null) ??
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
      credits: true,
      createdAt: true,
      scheduledPlan: true,
      planChangeAt: true,
      planStartedAt: true,
      planExpiresAt: true,
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
  const sameBillingCycle = user.plan === plan && isSameBillingCycle(user.planStartedAt, periodStartDate);
  const shouldResetCredits = shouldApplyStripePlanImmediately && !sameBillingCycle;
  const renewedCredits = shouldResetCredits
    ? await getRenewedCreditTotal({
        user,
        nextPlan: plan,
      })
    : user.credits;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(shouldApplyStripePlanImmediately
        ? {
            plan,
            credits: renewedCredits,
            scheduledPlan: null,
            planChangeAt: null,
          }
        : {}),
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: cancellationScheduled ? 'cancelling' : subscription.status ?? 'active',
      cancelAtPeriodEnd: cancellationScheduled,
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
    select: {
      id: true,
      plan: true,
      credits: true,
      createdAt: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  });

  if (!user) {
    return;
  }

  const renewedCredits = await getRenewedCreditTotal({
    user,
    nextPlan: 'free',
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'free',
      credits: renewedCredits,
      scheduledPlan: null,
      planChangeAt: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'expired',
      cancelAtPeriodEnd: false,
      planStartedAt: new Date(),
      planExpiresAt: null,
    },
  });
}

async function markPaymentFailed(where: { stripeCustomerId?: string; stripeSubscriptionId?: string }) {
  if (!where.stripeCustomerId && !where.stripeSubscriptionId) {
    return;
  }

  const user = await prisma.user.findFirst({
    where,
    select: {
      id: true,
    },
  });

  if (!user) {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'past_due',
    },
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = verifyStripeWebhookSignature(
      rawBody,
      request.headers.get('stripe-signature')
    ) as StripeWebhookEvent;

    if (event.id) {
      const shouldProcessEvent = await markProcessedStripeId(event.id, `event:${event.type}`);

      if (!shouldProcessEvent) {
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

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

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as StripeInvoiceObject;
        console.log(`[referral] stripe event ${event.type}`, {
          invoiceId: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
        });

        if (invoice.id) {
          const shouldProcessInvoice = await markProcessedStripeId(invoice.id, 'invoice_paid');

          if (!shouldProcessInvoice) {
            break;
          }
        }

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
          await markPaymentFailed({
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
