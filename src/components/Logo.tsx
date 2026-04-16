// cifra logomark — a stylised "c" cut into a square, in the brand coral.
// The wordmark uses Inter, all lowercase, slightly tight tracking.

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
      {/* Rounded square with a coral-to-warm-red gradient */}
      <defs>
        <linearGradient id="cifra-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F14E72" />
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
      <span className="font-semibold tracking-tight text-[16px]" style={{ letterSpacing: '-0.02em' }}>
        cifra
      </span>
    </span>
  );
}
