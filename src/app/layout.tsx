import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SearchBar from '@/components/SearchBar';
import { Logo } from '@/components/Logo';
import Link from 'next/link';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'cifra — Luxembourg VAT',
  description: 'Preparation and filing of Luxembourg VAT returns. Built for tax professionals.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full bg-canvas text-ink antialiased">
        <TopNav />
        <main className="max-w-[1400px] mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-divider">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="shrink-0 focus-visible:outline-none">
          <Logo />
        </Link>
        <NavLinks />
        <div className="shrink-0"><SearchBar /></div>
      </div>
    </nav>
  );
}

function NavLinks() {
  const links: Array<[string, string]> = [
    ['/', 'Overview'],
    ['/entities', 'Entities'],
    ['/declarations', 'Declarations'],
    ['/deadlines', 'Deadlines'],
    ['/aed-letters', 'AED'],
    ['/registrations', 'Registrations'],
    ['/legal-overrides', 'Overrides'],
    ['/metrics', 'Metrics'],
    ['/audit', 'Audit'],
    ['/settings', 'Settings'],
  ];
  return (
    <div className="hidden md:flex items-center gap-0.5 text-[12.5px]">
      {links.map(([href, label]) => (
        <a
          key={href}
          href={href}
          className="px-2.5 h-8 flex items-center rounded-md text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors duration-150"
        >
          {label}
        </a>
      ))}
    </div>
  );
}
