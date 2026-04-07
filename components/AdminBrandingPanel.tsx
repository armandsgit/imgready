'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, ImageIcon, Loader2, Settings2, Upload, X } from 'lucide-react';
import type { BrandingSettings } from '@/lib/appConfig';

interface AdminBrandingPanelProps {
  initialBranding: BrandingSettings;
}

export default function AdminBrandingPanel({ initialBranding }: AdminBrandingPanelProps) {
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState(initialBranding.logo);
  const [logoAlt, setLogoAlt] = useState(initialBranding.logoAlt);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState(initialBranding.heroImage);
  const [heroImageAlt, setHeroImageAlt] = useState(initialBranding.heroImageAlt);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewLogo, setPreviewLogo] = useState(logo || initialBranding.logo);
  const [previewHeroImage, setPreviewHeroImage] = useState(heroImage || initialBranding.heroImage);

  useEffect(() => {
    if (!logoFile) {
      setPreviewLogo(logo || initialBranding.logo);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewLogo(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [initialBranding.logo, logo, logoFile]);

  useEffect(() => {
    if (!heroImageFile) {
      setPreviewHeroImage(heroImage || initialBranding.heroImage);
      return;
    }

    const objectUrl = URL.createObjectURL(heroImageFile);
    setPreviewHeroImage(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [heroImage, heroImageFile, initialBranding.heroImage]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setLogoFile(file);
    if (file) {
      setLogo('');
    }
  }

  function handleHeroFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setHeroImageFile(file);
    if (file) {
      setHeroImage('');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('logo', logo);
      formData.append('logoAlt', logoAlt);
      formData.append('heroImage', heroImage);
      formData.append('heroImageAlt', heroImageAlt);

      if (logoFile) {
        formData.append('logoFile', logoFile);
      }

      if (heroImageFile) {
        formData.append('heroImageFile', heroImageFile);
      }

      const response = await fetch('/api/admin/branding', {
        method: 'PATCH',
        body: formData,
      });

      const payload = (await response.json()) as { error?: string; branding?: BrandingSettings };

      if (!response.ok || !payload.branding) {
        throw new Error(payload.error || 'Could not save branding settings.');
      }

      setLogo(payload.branding.logo);
      setLogoAlt(payload.branding.logoAlt);
      setHeroImage(payload.branding.heroImage);
      setHeroImageAlt(payload.branding.heroImageAlt);
      setLogoFile(null);
      setHeroImageFile(null);
      setFeedback('Brand assets updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save branding settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]"
        aria-label="Open branding settings"
        title="Brand settings"
      >
        <Settings2 className="h-4 w-4 text-[color:var(--accent-primary)]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 py-10 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <section
            className="panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto rounded-[32px] p-5 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Branding</p>
                <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">Brand assets</h2>
                <p className="text-sm text-[color:var(--text-secondary)]">Change navbar logo and hero image directly from admin.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
                  aria-label="Close branding settings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[color:var(--surface-contrast)] p-3 text-[color:var(--accent-primary)]">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">Upload logo</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">Navbar logo image</p>
                    </div>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-primary)] hover:bg-white/[0.04]">
                    <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                    {logoFile ? `Selected: ${logoFile.name}` : 'Choose logo file'}
                  </label>
                </div>

                <div className="rounded-2xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[color:var(--surface-contrast)] p-3 text-[color:var(--accent-primary)]">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">Upload hero image</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">Small decorative image on homepage</p>
                    </div>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-4 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-primary)] hover:bg-white/[0.04]">
                    <input type="file" accept="image/*" onChange={handleHeroFileChange} className="hidden" />
                    {heroImageFile ? `Selected: ${heroImageFile.name}` : 'Choose hero image'}
                  </label>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">Logo alt text</span>
                  <input
                    type="text"
                    value={logoAlt}
                    onChange={(event) => setLogoAlt(event.target.value)}
                    className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
                    placeholder="cutbg.ai"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">Hero image alt text</span>
                  <input
                    type="text"
                    value={heroImageAlt}
                    onChange={(event) => setHeroImageAlt(event.target.value)}
                    className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
                    placeholder="Product sample"
                  />
                </label>
              </div>

              <details className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
                <summary className="cursor-pointer text-sm font-medium text-[color:var(--text-primary)]">Advanced paths</summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Logo path (optional)</span>
                    <input
                      type="text"
                      value={logo}
                      onChange={(event) => setLogo(event.target.value)}
                      className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
                      placeholder="/img/logomain.png"
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Hero image path (optional)</span>
                    <input
                      type="text"
                      value={heroImage}
                      onChange={(event) => setHeroImage(event.target.value)}
                      className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
                      placeholder="/img/pic.jpg"
                    />
                  </label>
                </div>
              </details>

              <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Preview</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-[168px_92px] sm:items-start">
                  <div className="h-10 w-[168px] overflow-hidden rounded-lg border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-3 py-2">
                    <img src={previewLogo} alt={logoAlt || initialBranding.logoAlt} className="h-full w-full object-contain object-left" />
                  </div>
                  <div className="w-[92px] overflow-hidden rounded-[18px] border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] p-1.5">
                    <img src={previewHeroImage} alt={heroImageAlt || initialBranding.heroImageAlt} className="aspect-[4/5] w-full rounded-[14px] object-cover" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
                  {logoFile || heroImageFile ? 'Uploading selected files.' : 'Both images can also be set by path if needed.'}
                </p>
              </div>

              {feedback && (
                <div className="rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success-text)]">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {feedback}
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error-text)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="theme-accent-button inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save assets
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
