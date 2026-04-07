import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getBrandingSettings, saveBrandingSettings } from '@/lib/branding';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
      }

      const ext = path.extname(file.name) || '.png';
      const baseName = sanitizeFileName(path.basename(file.name, ext)) || 'logo';
      const fileName = `${baseName}-${Date.now()}${ext.toLowerCase()}`;
      const outputDir = path.join(process.cwd(), 'public', 'img', 'branding');
      const outputPath = path.join(outputDir, fileName);

      await mkdir(outputDir, { recursive: true });
      await writeFile(outputPath, Buffer.from(await file.arrayBuffer()));

      logo = `/img/branding/${fileName}`;
    }

    if (heroFile instanceof File && heroFile.size > 0) {
      if (!heroFile.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Only image files are allowed.' }, { status: 400 });
      }

      const ext = path.extname(heroFile.name) || '.png';
      const baseName = sanitizeFileName(path.basename(heroFile.name, ext)) || 'hero-image';
      const fileName = `${baseName}-${Date.now()}${ext.toLowerCase()}`;
      const outputDir = path.join(process.cwd(), 'public', 'img', 'branding');
      const outputPath = path.join(outputDir, fileName);

      await mkdir(outputDir, { recursive: true });
      await writeFile(outputPath, Buffer.from(await heroFile.arrayBuffer()));

      heroImage = `/img/branding/${fileName}`;
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
}
