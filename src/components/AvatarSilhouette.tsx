import type { ClosetItem } from "../types";

interface AvatarSilhouetteProps {
  items: ClosetItem[];
  className?: string;
}

const SKIN = "#e0ae8b";
const SKIN_DARK = "#cf9b78";
const HAIR = "#3a2a23";

/**
 * Placeholder croquis for the real Nano Banana ("gemini-3.1-flash-image")
 * try-on render. Phase 2 swaps this for the generated photo returned by the
 * backend's avatar endpoint (garment refs + user body refs -> photo).
 *
 * Drawn back-to-front: legs, shoes, bottom, arms, top, outerwear, head, extras.
 */
export default function AvatarSilhouette({ items, className = "" }: AvatarSilhouetteProps) {
  const dress = items.find((i) => i.category === "dress");
  const outer = items.find((i) => i.category === "outerwear");
  const top = items.find((i) => i.category === "top");
  const bottom = items.find((i) => i.category === "bottom");
  const shoes = items.find((i) => i.category === "shoes");
  const bag = items.find((i) => i.category === "bag");
  const shades = items.find((i) => i.category === "sunglasses");

  const topColor = dress?.color ?? top?.color ?? outer?.color ?? "#d6d3d1";
  const bottomColor = bottom?.color ?? "#e7e5e4";
  const shoeColor = shoes?.color ?? "#3f3f46";

  // Keeps ivory/white pieces legible against the light card background.
  const edge = { stroke: "rgb(0 0 0 / 0.14)", strokeWidth: 1 };

  return (
    <svg viewBox="0 0 160 400" className={className} role="img" aria-label="Avatar wearing the outfit">
      {/* legs */}
      <path d="M66 214 L62 344 L75 344 L80 250 L85 344 L98 344 L94 214 Z" fill={SKIN} />

      {/* shoes */}
      <path d="M60 340 h16 v10 q-9 3 -18 0 q-1 -7 2 -10 Z" fill={shoeColor} />
      <path d="M84 340 h16 q3 3 2 10 q-9 3 -18 0 Z" fill={shoeColor} />

      {/* bottom garment (skipped when a dress covers it) */}
      {!dress && <path d="M57 158 L103 158 L100 232 L60 232 Z" fill={bottomColor} {...edge} />}

      {/* arms */}
      <path d="M58 100 L48 186 L58 188 L68 108 Z" fill={SKIN_DARK} />
      <path d="M102 100 L112 186 L102 188 L92 108 Z" fill={SKIN_DARK} />

      {/* main garment */}
      {dress ? (
        <path d="M56 100 Q80 92 104 100 L112 196 Q80 208 48 196 Z" fill={topColor} {...edge} />
      ) : (
        <path d="M56 100 Q80 92 104 100 L106 166 Q80 176 54 166 Z" fill={topColor} {...edge} />
      )}

      {/* open jacket layered over the look */}
      {outer && !dress && (
        <>
          <path d="M56 100 L48 178 L62 181 L67 104 Z" fill={outer.color} {...edge} />
          <path d="M104 100 L112 178 L98 181 L93 104 Z" fill={outer.color} {...edge} />
        </>
      )}

      {/* neck + head */}
      <rect x="74" y="76" width="12" height="26" fill={SKIN_DARK} />
      <ellipse cx="80" cy="62" rx="17" ry="21" fill={SKIN} />

      {/* hair: cap over the skull, strands down both sides */}
      <path d="M62 62 Q61 38 80 38 Q99 38 98 62 Q95 47 80 45 Q65 47 62 62 Z" fill={HAIR} />
      <path d="M62 56 Q56 96 61 124 L71 121 Q65 92 68 58 Z" fill={HAIR} />
      <path d="M98 56 Q104 96 99 124 L89 121 Q95 92 92 58 Z" fill={HAIR} />

      {shades && <rect x="68" y="57" width="24" height="7" rx="3" fill={shades.color} />}

      {/* handbag hanging from the right hand */}
      {bag && (
        <>
          <path d="M110 178 q0 -11 9 -11 q9 0 9 11" fill="none" stroke={bag.color} strokeWidth="2.5" />
          <rect x="107" y="178" width="24" height="26" rx="3" fill={bag.color} />
        </>
      )}
    </svg>
  );
}
