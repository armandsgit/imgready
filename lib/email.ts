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
    <div style="margin:0;background:#f4f4f5;padding:32px 16px;font-family:Arial,sans-serif;color:#18181b;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="margin-bottom:16px;text-align:center;">
          <span style="display:inline-block;border-radius:999px;background:#111014;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;">
            ImgReady
          </span>
        </div>
        <div style="overflow:hidden;border:1px solid #e4e4e7;border-radius:28px;background:#ffffff;box-shadow:0 18px 60px rgba(17,16,20,0.08);">
          <div style="background:linear-gradient(135deg,#111014 0%,#1f1236 45%,#d946ef 100%);padding:36px 36px 88px;color:#ffffff;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.72);">
              Email verification
            </p>
            <h1 style="margin:0;font-size:34px;line-height:1.15;font-weight:700;">
              Confirm your email and activate your account
            </h1>
            <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:rgba(255,255,255,0.82);max-width:460px;">
              You're one click away from using ImgReady to create cleaner, listing-ready product images.
            </p>
          </div>
          <div style="margin:-52px 24px 24px;border:1px solid #ececf2;border-radius:24px;background:#ffffff;padding:28px;">
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#3f3f46;">
              Click the button below to verify your email address. This helps keep your account secure and unlocks the full signup flow.
            </p>
            <a
              href="${verificationUrl}"
              style="display:inline-block;border-radius:14px;background:linear-gradient(135deg,#7c3aed 0%,#ec4899 100%);padding:15px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;box-shadow:0 12px 28px rgba(124,58,237,0.28);"
            >
              Verify email
            </a>
            <div style="margin-top:24px;border-top:1px solid #f0f0f4;padding-top:20px;">
              <p style="margin:0;font-size:13px;line-height:1.7;color:#71717a;">
                This verification link expires on <strong style="color:#18181b;">${expiresAt.toUTCString()}</strong>.
              </p>
            </div>
          </div>
          <div style="padding:0 24px 24px;">
            <div style="border-radius:20px;background:#fafafa;padding:18px 20px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">
                Manual fallback
              </p>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#52525b;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#7c3aed;word-break:break-all;">
                ${verificationUrl}
              </p>
            </div>
          </div>
          <div style="padding:0 24px 28px;text-align:center;">
            <p style="margin:0;font-size:12px;line-height:1.7;color:#a1a1aa;">
              ImgReady
              <span style="display:inline-block;margin:0 6px;color:#d4d4d8;">•</span>
              Listing-ready product images in seconds
            </p>
          </div>
        </div>
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
        subject: 'Verify your email for ImgReady',
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
