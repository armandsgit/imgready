'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';

const COOKIE_CONSENT_KEY = 'cookieConsent';
const DEFAULT_PREFERENCES = {
  essential: true,
  analytics: false,
};

type CookieConsentPreferences = typeof DEFAULT_PREFERENCES;

function parseConsent(value: string | null): CookieConsentPreferences | null {
  if (!value) {
    return null;
  }

  if (value === 'accepted') {
    return { essential: true, analytics: true };
  }

  if (value === 'rejected') {
    return { essential: true, analytics: false };
  }

  try {
    const parsed = JSON.parse(value) as Partial<CookieConsentPreferences>;
    return {
      essential: true,
      analytics: parsed.analytics === true,
    };
  } catch {
    return null;
  }
}

function serializeConsent(preferences: CookieConsentPreferences) {
  return JSON.stringify(preferences);
}

function ConsentModal({
  initialPreferences,
  onClose,
  onSave,
}: {
  initialPreferences: CookieConsentPreferences;
  onClose: () => void;
  onSave: (preferences: CookieConsentPreferences) => void;
}) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(initialPreferences.analytics);

  return (
    <div className="pointer-events-none fixed inset-0 z-[75] flex items-end justify-center p-3 sm:justify-end sm:p-4">
      <div className="pointer-events-auto w-full max-w-[520px] rounded-[22px] border border-[color:var(--border-color)] bg-[rgba(32,32,36,0.96)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.46)] backdrop-blur-xl animate-[modal-enter_180ms_ease-out] sm:rounded-[24px] sm:p-5">
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Cookies</h2>
            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
              We use cookies to improve your experience and analyze traffic. You can manage your preferences anytime.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">Essential cookies</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
                    Required for the app to function, including login and security.
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  aria-pressed="true"
                  className="inline-flex h-7 w-12 cursor-not-allowed items-center rounded-full bg-[rgba(124,58,237,0.22)] p-1 opacity-90"
                >
                  <span className="h-5 w-5 rounded-full bg-white shadow-sm translate-x-5" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">Analytics cookies</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text-secondary)]">
                    Used for Google Analytics to understand how people use the app.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalyticsEnabled((current) => !current)}
                  aria-pressed={analyticsEnabled}
                  className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition ${
                    analyticsEnabled ? 'bg-[rgba(124,58,237,0.28)]' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition ${
                      analyticsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() =>
                onSave({
                  essential: true,
                  analytics: analyticsEnabled,
                })
              }
              className="theme-accent-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
            >
              Save preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CookieBanner() {
  const [preferences, setPreferences] = useState<CookieConsentPreferences | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

  useEffect(() => {
    const storedValue = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    const parsed = parseConsent(storedValue);

    if (parsed) {
      setPreferences(parsed);
      return;
    }

    setBannerVisible(true);
  }, []);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    window.localStorage.setItem(COOKIE_CONSENT_KEY, serializeConsent(preferences));
  }, [preferences]);

  const shouldLoadAnalytics = useMemo(
    () => Boolean(gaMeasurementId && preferences?.analytics),
    [gaMeasurementId, preferences?.analytics]
  );

  function handleAcceptAll() {
    setPreferences({ essential: true, analytics: true });
    setBannerVisible(false);
    setModalVisible(false);
  }

  function handleRejectAll() {
    setPreferences({ essential: true, analytics: false });
    setBannerVisible(false);
    setModalVisible(false);
  }

  function handleSavePreferences(nextPreferences: CookieConsentPreferences) {
    setPreferences(nextPreferences);
    setBannerVisible(false);
    setModalVisible(false);
  }

  return (
    <>
      {shouldLoadAnalytics ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}');
            `}
          </Script>
        </>
      ) : null}

      {bannerVisible ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-[600px] sm:px-4 sm:pb-0">
          <div className="pointer-events-auto ml-auto w-full rounded-[24px] border border-[color:var(--border-color)] bg-[rgba(32,32,36,0.94)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl animate-[modal-enter_180ms_ease-out] sm:p-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Cookies</h2>
                <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                  We use cookies to improve your experience and analyze traffic. You can manage your preferences
                  anytime.{' '}
                  <Link
                    href="/cookies"
                    className="text-[color:var(--accent-hover)] underline-offset-4 transition hover:underline"
                  >
                    Learn more in our Cookie Policy.
                  </Link>
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={handleRejectAll}
                  className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setModalVisible(true)}
                  className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
                >
                  Customize
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="theme-accent-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
                >
                  Accept all
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalVisible ? (
        <ConsentModal
          initialPreferences={preferences ?? DEFAULT_PREFERENCES}
          onClose={() => setModalVisible(false)}
          onSave={handleSavePreferences}
        />
      ) : null}
    </>
  );
}
