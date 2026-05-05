// cifra logo — wordmark + mark, coherent across the app.
//
// Wordmark: "cifra" in navy + an accent-red dot raised to the centre
// of the x-height (NOT sitting on the baseline like a typographic
// period). Diego: "el punto debería estar más al medio del wordmark".
//
// LogoMark: rounded square in navy with a stylised "c·" inside (white
// c + accent-red dot). Replaces the previous separate-circle layout
// so the mark visibly mirrors the wordmark.

export function LogoMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cifra-mark-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#1F2D55" />
          <stop offset="100%" stopColor="#141C39" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="7" fill="url(#cifra-mark-grad)" />
      {/* "c" glyph — open arc, white, centered */}
      <path
        d="M21 11.2a6.5 6.5 0 1 0 0 9.6"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* accent dot — paired with the c, sits roughly at x-height middle
          (mirrors the wordmark dot position) */}
      <circle cx="23.6" cy="16" r="1.9" fill="#E8264C" />
    </svg>
  );
}

export function Logo({ className = '', showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {showMark && <LogoMark size={22} />}
      <span
        className="font-semibold tracking-tight text-base text-brand-700 leading-none"
        style={{ letterSpacing: '-0.02em' }}
      >
        cifra
        {/* Dot centered vertically with the wordmark cap-height (middle
            of the x-band, not riding the baseline like a period). Uses
            verticalAlign: middle which the browser computes against the
            parent's font metrics. */}
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full bg-accent-500 ml-1"
          style={{ verticalAlign: 'middle' }}
        />
      </span>
    </span>
  );
}

// Wordmark-only variant (no mark) — used in places where the mark
// would be visually redundant.
export function LogoWordmark({ className = '' }: { className?: string }) {
  return <Logo className={className} showMark={false} />;
}
