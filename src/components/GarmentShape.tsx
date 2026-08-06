import type { ClosetCategory } from "../types";

interface GarmentShapeProps {
  category: ClosetCategory;
  color: string;
  className?: string;
}

function shade(hex: string, amount: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const [r, g, b] = [1, 2, 3].map((i) => clamp(parseInt(m[i], 16) + amount));
  return `rgb(${r} ${g} ${b})`;
}

/**
 * Stylised cut-out silhouettes standing in for real product photos.
 * Phase 2 replaces these with the uploaded (background-removed) item images.
 */
export default function GarmentShape({ category, color, className = "" }: GarmentShapeProps) {
  const stroke = shade(color, -40);
  const common = { fill: color, stroke, strokeWidth: 1.5, strokeLinejoin: "round" as const };

  return (
    <svg viewBox="0 0 100 100" className={className} role="presentation" aria-hidden="true">
      {category === "top" && (
        <path d="M31 13 L43 7 Q50 15 57 7 L69 13 L76 31 L66 35 L66 79 Q50 84 34 79 L34 35 L24 31 Z" {...common} />
      )}

      {category === "dress" && (
        <path d="M33 11 L44 6 Q50 13 56 6 L67 11 L73 29 L64 32 L76 88 Q50 95 24 88 L36 32 L27 29 Z" {...common} />
      )}

      {category === "outerwear" && (
        <>
          <path d="M28 13 L42 7 L50 22 L58 7 L72 13 L80 35 L70 39 L70 86 L30 86 L30 39 L20 35 Z" {...common} />
          <path d="M42 7 L50 22 L58 7" fill="none" stroke={stroke} strokeWidth="1.5" />
          <line x1="50" y1="22" x2="50" y2="86" stroke={stroke} strokeWidth="1.5" />
        </>
      )}

      {category === "bottom" && (
        <path d="M31 9 L69 9 L71 31 L67 93 L55 93 L50 45 L45 93 L33 93 L29 31 Z" {...common} />
      )}

      {category === "shoes" && (
        <>
          {/* side-on pump: toe at the left, stiletto heel at the right */}
          <path d="M13 57 C13 42 25 39 34 39 L62 39 C72 39 78 47 78 57 L34 62 C20 63 13 62 13 57 Z" {...common} />
          <path d="M69 57 L78 56 L80 80 L73 80 Z" {...common} />
        </>
      )}

      {category === "bag" && (
        <>
          <path d="M35 42 Q35 18 50 18 Q65 18 65 42" fill="none" stroke={stroke} strokeWidth="3" />
          <path d="M23 42 L77 42 L72 84 Q50 88 28 84 Z" {...common} />
        </>
      )}

      {category === "jewelry" && (
        <>
          <path d="M25 22 Q50 80 75 22" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <circle cx="50" cy="72" r="8" fill={color} stroke={stroke} strokeWidth="1.5" />
        </>
      )}

      {category === "sunglasses" && (
        <>
          <rect x="14" y="38" width="32" height="24" rx="10" {...common} />
          <rect x="54" y="38" width="32" height="24" rx="10" {...common} />
          <path d="M46 45 Q50 41 54 45" fill="none" stroke={stroke} strokeWidth="3" />
        </>
      )}

      {category === "watch" && (
        <>
          <rect x="41" y="12" width="18" height="28" rx="4" fill={shade(color, -25)} stroke={stroke} strokeWidth="1.5" />
          <rect x="41" y="60" width="18" height="28" rx="4" fill={shade(color, -25)} stroke={stroke} strokeWidth="1.5" />
          <circle cx="50" cy="50" r="19" {...common} />
          <circle cx="50" cy="50" r="12" fill="none" stroke={stroke} strokeWidth="1" />
        </>
      )}

      {category === "accessory" && (
        <>
          <rect x="10" y="43" width="80" height="15" rx="4" {...common} />
          <rect x="39" y="38" width="22" height="25" rx="4" fill="none" stroke={stroke} strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
