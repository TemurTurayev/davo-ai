/**
 * TB Control logo — minimal SVG mark
 * Style: stylized droplet/lung formed by two arcs (inhale + exhale) + a central pulse dot
 */

interface TBControlLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  variant?: "default" | "white" | "ink";
}

export function TBControlLogo({
  size = 32,
  className,
  showWordmark = false,
  variant = "default",
}: TBControlLogoProps) {
  const teal = variant === "white" ? "#ffffff" : "#0EA5A4";
  const pulse = variant === "white" ? "#F59E5B" : "#F59E5B";
  const ink = variant === "white" ? "#ffffff" : variant === "ink" ? "#0F172A" : "#0F172A";

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="TB Control"
        role="img"
      >
        {/* outer droplet — formed by two arcs (inhale + exhale) */}
        <path
          d="M16 4 C 22 11, 26 16, 26 21 a 10 10 0 1 1 -20 0 C 6 16, 10 11, 16 4 Z"
          fill={teal}
        />
        {/* inner pulse — small offset accent */}
        <circle cx="16" cy="20" r="2.6" fill={pulse} />
      </svg>
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-manrope), system-ui, sans-serif",
            fontWeight: 800,
            fontSize: size * 0.7,
            color: ink,
            letterSpacing: "-0.02em",
          }}
        >
          TB Control
        </span>
      )}
    </span>
  );
}
