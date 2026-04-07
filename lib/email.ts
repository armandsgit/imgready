interface SendVerificationEmailParams {
  email: string;
  verificationUrl: string;
  expiresAt: Date;
}

interface SendVerificationEmailResult {
  previewUrl?: string;
  deliveryMode: 'provider' | 'development-preview';
}

function verificationEmailHtml(verificationUrl: string, expiresAt: Date) {
  return `
    <div style="font-family:Arial,sans-serif;background:#020617;color:#e5e7eb;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#0b1220;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;">
        <p style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#94a3b8;margin:0 0 12px;">AI•TOOLS</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;">Verify your email</h1>
        <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:0 0 24px;">
          Confirm your email address to finish activating your account and start removing image backgrounds.
        </p>
        <a href="${verificationUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:600;">
          Verify email
        </a>
        <p style="font-size:13px;line-height:1.7;color:#94a3b8;margin:24px 0 0;">
          This verification link expires on ${expiresAt.toUTCString()}.
        </p>
        <p style="font-size:13px;line-height:1.7;color:#94a3b8;margin:12px 0 0;">
          If the button does not work, copy and paste this URL into your browser:<br />
          <span style="word-break:break-all;">${verificationUrl}</span>
        </p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail({
  email,
  verificationUrl,
  expiresAt,
}: SendVerificationEmailParams): Promise<SendVerificationEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (resendApiKey && from) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Verify your email for AI•TOOLS',
        html: verificationEmailHtml(verificationUrl, expiresAt),
      }),
    });

    if (!response.ok) {
      let providerError = 'Could not send verification email. Please try again.';

      try {
        const payload = (await response.json()) as {
          message?: string;
          error?: { message?: string };
        };

        providerError = payload.error?.message ?? payload.message ?? providerError;
      } catch {
        // Ignore JSON parsing failures and keep the generic provider error.
      }

      throw new Error(providerError);
    }

    return {
      deliveryMode: 'provider',
    };
  }

  if (!isDevelopment) {
    throw new Error('Email delivery is not configured. Please set RESEND_API_KEY and RESEND_FROM_EMAIL.');
  }

  console.info(`[verification email] ${email}: ${verificationUrl}`);
  return {
    previewUrl: verificationUrl,
    deliveryMode: 'development-preview',
  };
}
