import { NextResponse } from 'next/server';
import { getBrandingSettings } from '@/lib/branding';

export async function GET() {
  const branding = await getBrandingSettings();
  return NextResponse.json(branding);
}
