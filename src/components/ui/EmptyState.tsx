import type { ReactNode } from 'react';

// ════════════════════════════════════════════════════════════════════════
// EmptyState — shared "nothing here yet" block.
//
// Stint 12 upgrade: supports either a classic icon OR a small SVG
// illustration via the `illustration` prop. The illustrations ship
// inline as React components (no external asset pipeline) so they
// render crisp + theme-coloured via currentColor.
//
// Design goal: distinguish "product" from "prototype" per ROADMAP P1.8
// without bringing in a design-system dependency. Each illustration is
// hand-drawn in ≤30 lines of SVG and scaled to 96×96.
// ════════════════════════════════════════════════════════════════════════

export function EmptyState({
  icon, illustration, title, description, action, secondaryAction,
}: {
  icon?: ReactNode;
  /** Preferred over `icon`. Either a built-in illustration key or a custom node. */
  illustration?: IllustrationKind | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional secondary action (e.g. a link to docs / a dismiss). */
  secondaryAction?: ReactNode;
}) {
  const ill = typeof illustration === 'string'
    ? <Illustration kind={illustration as IllustrationKind} />
    : illustration;

  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {ill ? (
        <div className="mb-5 text-brand-500/70">{ill}</div>
      ) : icon && (
        <div className="w-12 h-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-ink-muted mt-1.5 max-w-md leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

// ─────────────────── Illustrations ───────────────────
// Stroke-only, colour-through-currentColor. Each 96×96.

export type IllustrationKind =
  | 'empty_inbox'
  | 'empty_clients'
  | 'empty_declarations'
  | 'empty_deadlines'
  | 'empty_search'
  | 'empty_documents'
  | 'empty_approved';

export function Illustration({ kind }: { kind: IllustrationKind }) {
  switch (kind) {
    case 'empty_inbox': return <InboxIll />;
    case 'empty_clients': return <ClientsIll />;
    case 'empty_declarations': return <DeclarationsIll />;
    case 'empty_deadlines': return <DeadlinesIll />;
    case 'empty_search': return <SearchIll />;
    case 'empty_documents': return <DocumentsIll />;
    case 'empty_approved': return <ApprovedIll />;
    default: return null;
  }
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="96" height="96" viewBox="0 0 96 96"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function InboxIll() {
  return (
    <Wrap>
      <path d="M14 46 L24 22 h48 l10 24" />
      <path d="M14 46 v24 a4 4 0 0 0 4 4 h60 a4 4 0 0 0 4 -4 v-24" />
      <path d="M14 46 h18 l4 8 h24 l4 -8 h18" />
      <path d="M42 32 h12 M38 40 h20" strokeOpacity="0.5" />
    </Wrap>
  );
}

function ClientsIll() {
  return (
    <Wrap>
      <rect x="14" y="28" width="26" height="44" rx="2" />
      <rect x="46" y="20" width="36" height="52" rx="2" />
      <path d="M22 36 h10 M22 44 h10 M22 52 h10 M22 60 h10" strokeOpacity="0.6" />
      <path d="M54 30 h20 M54 38 h20 M54 46 h20 M54 54 h20 M54 62 h20" strokeOpacity="0.6" />
      <circle cx="64" cy="14" r="4" />
    </Wrap>
  );
}

function DeclarationsIll() {
  return (
    <Wrap>
      <path d="M22 14 h36 l16 16 v48 a4 4 0 0 1 -4 4 h-48 a4 4 0 0 1 -4 -4 v-60 a4 4 0 0 1 4 -4 z" />
      <path d="M58 14 v12 a4 4 0 0 0 4 4 h12" />
      <path d="M30 44 h36 M30 52 h36 M30 60 h24" strokeOpacity="0.6" />
      <circle cx="72" cy="72" r="12" strokeOpacity="0.8" />
      <path d="M66 72 l4 4 l8 -8" strokeOpacity="0.8" />
    </Wrap>
  );
}

function DeadlinesIll() {
  return (
    <Wrap>
      <rect x="14" y="20" width="68" height="56" rx="3" />
      <path d="M14 32 h68" />
      <path d="M26 14 v12 M70 14 v12" />
      <path d="M28 44 h8 v8 h-8 z" strokeOpacity="0.7" />
      <path d="M44 44 h8 v8 h-8 z" strokeOpacity="0.7" />
      <path d="M60 44 h8 v8 h-8 z" fill="currentColor" fillOpacity="0.15" />
      <path d="M28 60 h8 v8 h-8 z" strokeOpacity="0.7" />
      <path d="M44 60 h8 v8 h-8 z" strokeOpacity="0.7" />
    </Wrap>
  );
}

function SearchIll() {
  return (
    <Wrap>
      <circle cx="42" cy="42" r="20" />
      <path d="M58 58 l20 20" />
      <path d="M32 42 h20 M42 32 v20" strokeOpacity="0.4" />
    </Wrap>
  );
}

function DocumentsIll() {
  return (
    <Wrap>
      <path d="M20 22 h34 l12 12 v44 a2 2 0 0 1 -2 2 h-44 a2 2 0 0 1 -2 -2 v-54 a2 2 0 0 1 2 -2 z" />
      <path d="M54 22 v10 a2 2 0 0 0 2 2 h10" />
      <path d="M30 10 h34 l12 12 v44" strokeOpacity="0.4" />
      <path d="M28 46 h30 M28 54 h30 M28 62 h18" strokeOpacity="0.6" />
    </Wrap>
  );
}

function ApprovedIll() {
  return (
    <Wrap>
      <circle cx="48" cy="48" r="30" />
      <path d="M34 48 l10 10 l20 -22" />
    </Wrap>
  );
}
