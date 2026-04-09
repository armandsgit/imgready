import { NextRequest, NextResponse } from 'next/server';

const MAINTENANCE_COOKIE = 'imgready_maintenance_bypass';
const MAINTENANCE_QUERY = 'access';
const MAINTENANCE_PAGE_PATH = '/maintenance';

function isMaintenanceEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.MAINTENANCE_MODE ?? '').trim().toLowerCase()
  );
}

function getBypassToken() {
  return (process.env.MAINTENANCE_BYPASS_TOKEN ?? '').trim();
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/icons') ||
    /\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|map|txt|xml|woff2?)$/i.test(pathname)
  );
}

function buildBypassCookieValue() {
  return getBypassToken();
}

export function middleware(request: NextRequest) {
  if (!isMaintenanceEnabled()) {
    return NextResponse.next();
  }

  const { nextUrl } = request;
  const { pathname, searchParams } = nextUrl;
  const bypassToken = getBypassToken();
  const hasBypassCookie =
    Boolean(bypassToken) && request.cookies.get(MAINTENANCE_COOKIE)?.value === buildBypassCookieValue();

  if (searchParams.get(MAINTENANCE_QUERY) === bypassToken && bypassToken) {
    const redirectUrl = nextUrl.clone();
    redirectUrl.searchParams.delete(MAINTENANCE_QUERY);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(MAINTENANCE_COOKIE, buildBypassCookieValue(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  if (pathname === MAINTENANCE_PAGE_PATH) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-imgready-maintenance-page', '1');
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (isStaticAsset(pathname) || hasBypassCookie) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Maintenance mode is active. Please try again shortly.' }, { status: 503 });
  }

  return NextResponse.redirect(new URL(MAINTENANCE_PAGE_PATH, request.url));
}

export const config = {
  matcher: ['/((?!_vercel).*)'],
};
