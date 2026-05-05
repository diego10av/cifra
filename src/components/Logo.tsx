// cifra logo — option A confirmed by Diego (2026-05-05).
//
// Wordmark: "cifra" in navy + a single accent-red dot signature.
// The dot is the same coral-red hex (#E8264C / --color-accent-500) the
// brand was built on; demoted from primary to accent in stint 65.A,
// now elevated to "the punctum that ends the wordmark cleanly" —
// the equivalent of Linear's chevron-mark or Stripe's gradient stripe:
// a small consistent element that says "this is cifra, not any other
// navy SaaS".

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
      <defs>
        <linearGradient id="cifra-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#1A2548" />
          <stop offset="50%" stopColor="#1F2D55" />
          <stop offset="100%" stopColor="#141C39" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5" fill="url(#cifra-grad)" />
      {/* c glyph */}
      <path
        d="M16 8.5a5.5 5.5 0 1 0 0 7"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* accent dot — signature element */}
      <circle cx="19" cy="19" r="2" fill="#E8264C" />
    </svg>
  );
}

export function Logo({ className = '', showMark = true }: { className?: string; showMark?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      {showMark && (
        <span className="self-center">
          <LogoMark size={22} />
        </span>
      )}
      <span
        className="font-semibold tracking-tight text-base text-brand-700"
        style={{ letterSpacing: '-0.02em' }}
      >
        cifra<span className="text-accent-500">·</span>
      </span>
    </span>
  );
}

// Wordmark-only variant (no mark) — used in places where the mark
// would be visually redundant (e.g. landing page top nav with extra
// chrome, or compact contexts).
export function LogoWordmark({ className = '' }: { className?: string }) {
  return <Logo className={className} showMark={false} />;
}
