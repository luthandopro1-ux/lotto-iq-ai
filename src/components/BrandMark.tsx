/**
 * LottoIQ AI brand mark — corporate identity per the brand sheet
 * (Navy #0B1B33, Teal #00D1B2, Blue #3B82F6, Purple #8B5CF6).
 *
 * Rendered as inline SVG (not a raster image) so it stays crisp at any
 * size and needs no network request. The raster favicon/app icons in
 * /public are generated from the same design (src/assets/brand/lotto-iq-mark.svg)
 * — keep the two in sync if the mark changes.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Lotto IQ AI"
    >
      <defs>
        <linearGradient id="lottoIqMarkGradient" x1="10%" y1="0%" x2="95%" y2="100%">
          <stop offset="0%" stopColor="#00D1B2" />
          <stop offset="55%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="44" fill="#0B1B33" />
      <rect x="52" y="58" width="24" height="84" rx="12" fill="#00D1B2" />
      <circle
        cx="132"
        cy="100"
        r="42.5"
        fill="none"
        stroke="url(#lottoIqMarkGradient)"
        strokeWidth="25"
      />
      <path d="M 152 128 Q 168 140 160 158 Q 152 152 148 138 Z" fill="url(#lottoIqMarkGradient)" />
    </svg>
  );
}
