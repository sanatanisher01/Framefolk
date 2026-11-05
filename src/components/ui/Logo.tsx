import { cn } from "@/utils/cn";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "mark" | "wordmark";
  /** Override accent color (defaults to #FF765E) */
  accentColor?: string;
}

const sizes = {
  sm: { mark: 24, text: 14, gap: 6 },
  md: { mark: 32, text: 18, gap: 8 },
  lg: { mark: 40, text: 22, gap: 10 },
  xl: { mark: 56, text: 30, gap: 14 },
};

/**
 * FRAMEFOLK Logo
 *
 * The mark is a stylised camera aperture / film-frame corner bracket symbol.
 * Four L-shaped corner brackets form a frame, with a small accent-coloured
 * circle at the centre representing the lens / focal point.
 */
export function Logo({
  className,
  size = "md",
  variant = "full",
  accentColor = "#FF765E",
}: LogoProps) {
  const { mark, text, gap } = sizes[size];

  return (
    <div
      className={cn("flex items-center select-none", className)}
      style={{ gap }}
      aria-label="FRAMEFOLK"
      role="img"
    >
      {variant !== "wordmark" && (
        <LogoMark size={mark} accentColor={accentColor} />
      )}
      {variant !== "mark" && (
        <span
          className="font-display font-bold tracking-tight text-text-primary leading-none"
          style={{ fontSize: text }}
        >
          FRAME
          <span style={{ color: accentColor }}>FOLK</span>
        </span>
      )}
    </div>
  );
}

interface LogoMarkProps {
  size?: number;
  accentColor?: string;
  className?: string;
}

/**
 * The FRAMEFOLK logo mark — a frame symbol with an accent focal point.
 * Standalone icon for favicons, PWA icons, avatars etc.
 */
export function LogoMark({
  size = 32,
  accentColor = "#FF765E",
  className,
}: LogoMarkProps) {
  const s = size;
  const stroke = Math.max(1.5, s * 0.06);
  const corner = s * 0.28; // corner bracket length
  const inset = s * 0.12; // distance from edge
  const cx = s / 2;
  const cy = s / 2;
  const dotR = s * 0.09;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Top-left corner bracket */}
      <path
        d={`M ${inset + corner} ${inset} L ${inset} ${inset} L ${inset} ${inset + corner}`}
        stroke="#F4F0E8"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top-right corner bracket */}
      <path
        d={`M ${s - inset - corner} ${inset} L ${s - inset} ${inset} L ${s - inset} ${inset + corner}`}
        stroke="#F4F0E8"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-left corner bracket */}
      <path
        d={`M ${inset} ${s - inset - corner} L ${inset} ${s - inset} L ${inset + corner} ${s - inset}`}
        stroke="#F4F0E8"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom-right corner bracket */}
      <path
        d={`M ${s - inset - corner} ${s - inset} L ${s - inset} ${s - inset} L ${s - inset} ${s - inset - corner}`}
        stroke="#F4F0E8"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Centre accent dot — the focal/lens point */}
      <circle cx={cx} cy={cy} r={dotR * 1.6} fill={accentColor} opacity={0.15} />
      <circle cx={cx} cy={cy} r={dotR} fill={accentColor} />
    </svg>
  );
}

/** Icon-only version suitable for browser favicon (rendered on dark bg) */
export function LogoIcon({ size = 32 }: { size?: number }) {
  return <LogoMark size={size} />;
}
