export const UNLIMITED_CREDITS = -1;

export const PLAN_CONFIG = {
  free: {
    id: 'free',
    name: 'Free',
    price: '€0',
    monthlyPriceLabel: '€0 / month',
    credits: 10,
    description: 'For testing the platform with a shared credit wallet across all tools.',
    features: ['10 credits', 'Access to all tools', 'Max 3 images per upload'],
    cta: 'Start free',
    recommended: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: '€9',
    monthlyPriceLabel: '€9 / month',
    credits: 200,
    description: 'For sellers who need more monthly credits and higher upload limits.',
    features: ['200 credits per month', 'Access to all tools', 'Max 20 images per upload'],
    cta: 'Upgrade to Starter',
    recommended: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: '€19',
    monthlyPriceLabel: '€19 / month',
    credits: 1000,
    description: 'For teams that need higher monthly volume and faster processing.',
    features: ['1000 credits per month', 'Access to all tools', 'Max 50 images per upload', 'Faster processing'],
    cta: 'Upgrade to Pro',
    recommended: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: '€39',
    monthlyPriceLabel: '€39 / month',
    credits: UNLIMITED_CREDITS,
    description: 'For operations that need priority throughput and API-based workflows.',
    features: ['Custom monthly volume', 'Priority processing', 'API access'],
    cta: 'Scale with Business',
    recommended: false,
  },
} as const;

export type PlanId = keyof typeof PLAN_CONFIG;

export function isPlanId(value: string): value is PlanId {
  return value in PLAN_CONFIG;
}

function normalizePlan(value: string): string {
  return value.trim().toLowerCase();
}

export function getPlanCredits(plan: PlanId) {
  return PLAN_CONFIG[plan].credits;
}

export function getPlanName(plan: string) {
  const normalizedPlan = normalizePlan(plan);
  return isPlanId(normalizedPlan) ? PLAN_CONFIG[normalizedPlan].name : 'Free';
}

export function formatCredits(credits: number) {
  if (credits === UNLIMITED_CREDITS) {
    return '∞';
  }

  return Number.isInteger(credits) ? `${credits}` : credits.toFixed(1);
}

export function hasUnlimitedCredits(credits: number) {
  return credits === UNLIMITED_CREDITS;
}

export function getPlanUploadLimit(plan: string) {
  const normalizedPlan = normalizePlan(plan);

  if (normalizedPlan === 'starter') {
    return 20;
  }

  if (normalizedPlan === 'pro' || normalizedPlan === 'business') {
    return 50;
  }

  return 3;
}
