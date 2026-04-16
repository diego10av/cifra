'use client';

// Top bar sitting above the main content column. Holds global search,
// a notifications bell (placeholder for now), and responsive hamburger
// on mobile (sidebar is hidden below md). Height 56px.

import { useState } from 'react';
import { MenuIcon, BellIcon, XIcon } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import { Sidebar, type SidebarBadges } from './Sidebar';

export function TopBar({ badges }: { badges: SidebarBadges }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-surface/85 backdrop-blur-xl border-b border-divider">
        <div className="h-full px-4 md:px-6 flex items-center gap-3 md:gap-4">
          <button
            className="md:hidden w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-surface-alt text-ink-soft"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <SearchBar />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <NotificationsButton />
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-[232px] h-full animate-slideInRight">
            <Sidebar badges={badges} />
            <button
              className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-surface-alt text-ink-soft"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationsButton() {
  // Placeholder — hooked up in Phase 3 once AED + validator inboxes are consolidated.
  return (
    <button
      className="relative w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-surface-alt text-ink-soft"
      aria-label="Notifications"
    >
      <BellIcon size={16} strokeWidth={1.8} />
    </button>
  );
}
