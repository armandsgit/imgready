import { POST as keepPlanPost } from '@/app/api/stripe/keep-plan/route';

export const runtime = 'nodejs';

export async function POST() {
  return keepPlanPost();
}
