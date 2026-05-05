// AppShell — server-component gate that renders the operator chrome
// (sidebar + topbar) for authenticated routes, or bare content for the
// /login page. Reads the `x-cifra-no-shell` header set by middleware.

import { headers } from 'next/headers';
import { AppShellInner } from './AppShellInner';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const h = await headers();
  if (h.get('x-cifra-no-shell') === '1') {
    return <>{children}</>;
  }
  return <AppShellInner>{children}</AppShellInner>;
}
