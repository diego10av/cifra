'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// Only allow same-app navigation targets — prevents `?next=https://evil.com`
// open-redirect. The middleware already forwards only pathnames; defence-in-
// depth at the consumer is cheap. Default destination is `/` (the home
// dashboard).
function safeNextUrl(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const next = safeNextUrl(searchParams?.get('next') ?? null);
      // Hard navigation, not router.replace(): the AppShell server component
      // is rendered inside the shared root layout and reads `x-cifra-no-shell`
      // from the request headers. On a client-side replace() Next.js reuses
      // the existing root layout, so the post-login page renders without the
      // sidebar/topbar until a manual reload kicks middleware again. A full
      // page navigation makes middleware re-evaluate and AppShell mount with
      // the operator chrome. Loading state stays on through the transition.
      window.location.href = next;
      return;
    }
    setLoading(false);
    setError('Invalid credentials');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(closest-side, rgba(232,38,76,0.30), transparent 70%)',
        }}
      />
      <div className="relative bg-surface border border-border rounded-xl shadow-lg p-8 w-full max-w-[380px] animate-fadeInScale">
        <div className="mb-6">
          <Logo />
        </div>
        <h1 className="text-lg font-semibold text-ink tracking-tight">Sign in</h1>
        <p className="text-sm text-ink-muted mt-1 mb-6">
          Luxembourg tax &amp; compliance, in one workspace.
          <br />
          <span className="text-ink-faint">AI reads, humans review.</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-sm text-danger-700 bg-danger-50 border border-[#F4B9B7] rounded-md px-3 py-2 animate-fadeIn">
              {error}
            </div>
          )}
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            autoFocus
          />
          <Button type="submit" variant="primary" loading={loading} className="w-full justify-center h-9">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
