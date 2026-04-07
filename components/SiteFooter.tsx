import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/refund', label: 'Refunds' },
  { href: '/contact', label: 'Contact' },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.05] bg-[rgba(11,11,13,0.52)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-6 py-6 text-sm text-[color:var(--text-muted)] md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} ImgReady</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[color:var(--text-primary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
