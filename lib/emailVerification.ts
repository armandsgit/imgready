import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

export function hashVerificationToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueVerificationToken(userId: string, email: string, baseUrl: string) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const verificationUrl = `${baseUrl}/verify-email?token=${rawToken}`;
  return sendVerificationEmail({
    email,
    verificationUrl,
    expiresAt,
  });
}
