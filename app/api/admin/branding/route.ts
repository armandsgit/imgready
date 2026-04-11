import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getBrandingSettings, saveBrandingSettings } from '@/lib/branding';

const MAX_BRANDING_FILE_SIZE = 4 * 1024 * 1024;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

async function fileToDataUrl(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }

  if (file.size > MAX_BRANDING_FILE_SIZE) {
    throw new Error('Branding images must be 4MB or smaller.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return unauthorized();
  }

  const branding = await getBrandingSettings();
  return NextResponse.json({ branding });
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return unauthorized();
    }

    const contentType = request.headers.get('content-type') || '';
    let logo = '';
    let logoAlt = '';
    let heroImage = '';
    let heroImageAlt = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('logoFile');
      const heroFile = formData.get('heroImageFile');
      logoAlt = String(formData.get('logoAlt') || '').trim();
      heroImageAlt = String(formData.get('heroImageAlt') || '').trim();
      logo = String(formData.get('logo') || '').trim();
      heroImage = String(formData.get('heroImage') || '').trim();

      if (file instanceof File && file.size > 0) {
        logo = await fileToDataUrl(file);
      }

      if (heroFile instanceof File && heroFile.size > 0) {
        heroImage = await fileToDataUrl(heroFile);
      }
    } else {
      const body = (await request.json()) as Partial<{ logo: string; logoAlt: string; heroImage: string; heroImageAlt: string }>;
      logo = body.logo?.trim() || '';
      logoAlt = body.logoAlt?.trim() || '';
      heroImage = body.heroImage?.trim() || '';
      heroImageAlt = body.heroImageAlt?.trim() || '';
    }

    if (!logo) {
      return NextResponse.json({ error: 'Logo file or path is required.' }, { status: 400 });
    }

    if (!heroImage) {
      return NextResponse.json({ error: 'Hero image file or path is required.' }, { status: 400 });
    }

    const branding = await saveBrandingSettings({
      logo,
      logoAlt,
      heroImage,
      heroImageAlt,
    });

    return NextResponse.json({ branding });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save branding settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
