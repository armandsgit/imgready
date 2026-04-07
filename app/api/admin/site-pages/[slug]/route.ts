import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getDefaultSitePage, isSitePageSlug } from '@/lib/sitePages';

interface UpdateSitePageBody {
  title?: string;
  content?: string;
  resetToDefault?: boolean;
}

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSitePageSlug(params.slug)) {
    return NextResponse.json({ error: 'Unknown page.' }, { status: 404 });
  }

  const body = (await request.json()) as UpdateSitePageBody;
  if (body.resetToDefault) {
    const defaultPage = getDefaultSitePage(params.slug);

    const page = await prisma.sitePage.update({
      where: { slug: params.slug },
      data: {
        title: defaultPage.title,
        content: defaultPage.content,
        lastUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ page });
  }

  const title = body.title?.trim() ?? '';
  const content = body.content?.trim() ?? '';

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 });
  }

  const page = await prisma.sitePage.update({
    where: { slug: params.slug },
    data: {
      title,
      content,
      lastUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ page });
}
