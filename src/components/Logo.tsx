// cifra logomark — stint 65.A brand refresh.
//
// Pre-refresh: full-pink gradient mark + pink wordmark, Factorial-style.
// Post-refresh: navy mark + navy wordmark with a single coral-red
// accent dot at the bottom-right of the mark — the Big4 / boutique-law
// pattern (55legal: navy "55LEGAL" with the red triangle inside the
// "A"; same DNA: dominant navy, sparing red accent).
//
// The accent red is the same hex the brand was built on (`#E8264C` =
// --color-accent-500). It survives intact, just demoted from "the
// product's main colour" to "the product's accent". Visually it now
// reads as deliberate emphasis, not as ambient warmth.

export function LogoMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Navy gradient background — brand-700 → brand-500 → brand-600.
          Subtle so it reads as a single dark navy block at small sizes. */}
      <defs>
        <linearGradient id="cifra-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#1A2548" />
          <stop offset="50%" stopColor="#1F2D55" />
          <stop offset="100%" stopColor="#141C39" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="url(#cifra-grad)" />
      {/* c-shape cut-out (white, representing the 'c' of cifra) */}
      <path
        d="M16 8.5a5.5 5.5 0 1 0 0 7"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stint 65.A — accent dot. Bottom-right corner. Same role
          55legal gives the red triangle in the "A": the punctum that
          says "this isn't a generic navy logo". Tiny on purpose —
          the brand reads as navy first, accent second. */}
      <circle cx="19" cy="19" r="2" fill="#E8264C" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={22} />
      {/* Wordmark in navy. Single solid colour (no gradient) — at the
          small sizes the wordmark renders, gradients add visual noise
          without legibility benefit. The accent dot in the mark
          carries the colour story. */}
      <span
        className="font-semibold tracking-tight text-base text-brand-700"
        style={{ letterSpacing: '-0.02em' }}
      >
        cifra
      </span>
    </span>
  );
}
