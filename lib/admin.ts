const DEFAULT_ADMIN_EMAILS = ['armands.visam@gmail.com'];

export function getAdminEmails() {
  const configured = process.env.ADMIN_EMAILS
    ?.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function isProtectedAdmin(email: string | null | undefined) {
  return isAdminEmail(email);
}
