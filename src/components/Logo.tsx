// cifra logomark — a stylised "c" cut into a square, in the brand
// pink (#E8264C = --color-brand-500, defined in globals.css as the
// "primary — the cifra pink"). The gradient stays within brand-400 →
// brand-500 → brand-600 so the visual centre is the primary brand
// colour; no orange cast at any size.
// Wordmark uses Inter, all lowercase, slightly tight tracking.

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
      {/* Rounded square with a brand-anchored gradient.
          brand-400 (lighter) → brand-500 (primary) → brand-600 (deeper). */}
      <defs>
        <linearGradient id="cifra-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%"  stopColor="#F14E72" />
          <stop offset="50%" stopColor="#E8264C" />
          <stop offset="100%" stopColor="#C61640" />
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
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={22} />
      {/* Wordmark: same 3-stop brand-anchored gradient as the mark,
          clipped to the text glyphs so the brand-500 primary sits at
          the visual centre. CSS gradient (no raster) = crisp at any DPR. */}
      <span
        className="font-semibold tracking-tight text-[16px] bg-clip-text text-transparent"
        style={{
          letterSpacing: '-0.02em',
          backgroundImage: 'linear-gradient(90deg, #F14E72 0%, #E8264C 50%, #C61640 100%)',
        }}
      >
        cifra
      </span>
    </span>
  );
}
