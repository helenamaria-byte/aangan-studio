/**
 * A living-room elevation drawn in fine line: plant, armchair, arched window, side table, sofa and framed art.
 * Pure decoration (aria-hidden). Soft brass strokes with a few material tints, so it sits quietly on the page.
 */
export function RoomVignette() {
  const brass = "#B08D4B";
  const wood = "#8B6B47";
  return (
    <svg viewBox="0 0 760 150" className="block h-auto w-full" role="presentation" aria-hidden preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFDF4" />
          <stop offset="1" stopColor="#FBEBC4" />
        </linearGradient>
        <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE9A8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* floor, skirting and rug */}
      <rect x="230" y="139" width="330" height="5" rx="2.5" fill="#E9DFCB" />
      <line x1="0" y1="138" x2="760" y2="138" stroke={wood} strokeOpacity="0.55" strokeWidth="1.2" />
      <line x1="0" y1="131" x2="760" y2="131" stroke={brass} strokeOpacity="0.35" strokeWidth="1" />

      {/* plant, left */}
      <path d="M44 138l5-24h26l5 24z" fill="#C98B6B" stroke={wood} strokeOpacity="0.5" strokeWidth="1" />
      <g fill="#9DB39D" stroke="#6F8A6F" strokeOpacity="0.6" strokeWidth="0.8">
        <ellipse cx="62" cy="86" rx="7" ry="22" transform="rotate(-8 62 86)" />
        <ellipse cx="48" cy="96" rx="6" ry="19" transform="rotate(-38 48 96)" />
        <ellipse cx="77" cy="96" rx="6" ry="19" transform="rotate(36 77 96)" />
        <ellipse cx="55" cy="74" rx="5" ry="15" transform="rotate(-22 55 74)" />
        <ellipse cx="70" cy="74" rx="5" ry="15" transform="rotate(20 70 74)" />
      </g>

      {/* pendant over the armchair */}
      <line x1="165" y1="0" x2="165" y2="34" stroke={brass} strokeWidth="1.2" />
      <circle cx="165" cy="48" r="30" fill="url(#lampGlow)" />
      <path d="M149 46a16 16 0 0 1 32 0z" fill="#E8C673" stroke={brass} strokeWidth="1" />

      {/* armchair */}
      <g stroke={wood} strokeOpacity="0.7" strokeWidth="1.1">
        <rect x="128" y="84" width="76" height="34" rx="12" fill="#D8C7AA" />
        <rect x="122" y="100" width="18" height="26" rx="8" fill="#CDBA9A" />
        <rect x="192" y="100" width="18" height="26" rx="8" fill="#CDBA9A" />
        <rect x="136" y="108" width="60" height="18" rx="6" fill="#E2D3B8" />
        <line x1="134" y1="126" x2="130" y2="138" />
        <line x1="198" y1="126" x2="202" y2="138" />
      </g>

      {/* arched window with curtains */}
      <path d="M262 131V64a38 38 0 0 1 76 0v67z" fill="url(#glass)" stroke={brass} strokeWidth="1.6" />
      <line x1="300" y1="26" x2="300" y2="131" stroke={brass} strokeOpacity="0.7" strokeWidth="1.2" />
      <line x1="262" y1="84" x2="338" y2="84" stroke={brass} strokeOpacity="0.7" strokeWidth="1.2" />
      <path d="M252 20v111h13V28z" fill="#E4D8C3" stroke={brass} strokeOpacity="0.5" strokeWidth="0.9" />
      <path d="M348 20v111h-13V28z" fill="#E4D8C3" stroke={brass} strokeOpacity="0.5" strokeWidth="0.9" />
      <line x1="248" y1="20" x2="352" y2="20" stroke={brass} strokeWidth="1.4" />

      {/* side table and vase */}
      <ellipse cx="392" cy="106" rx="17" ry="3.5" fill="#E2D3B8" stroke={wood} strokeOpacity="0.7" strokeWidth="1" />
      <line x1="392" y1="109" x2="392" y2="138" stroke={wood} strokeOpacity="0.7" strokeWidth="1.4" />
      <line x1="382" y1="138" x2="402" y2="138" stroke={wood} strokeOpacity="0.7" strokeWidth="1.4" />
      <path d="M386 104c-3-12 1-18 6-18s9 6 6 18z" fill="#C98B6B" stroke={wood} strokeOpacity="0.5" strokeWidth="0.9" />
      <path d="M392 86c-2-14 4-26 12-34M392 86c1-12-2-22-9-30" fill="none" stroke="#6F8A6F" strokeWidth="1.2" />
      <circle cx="404" cy="52" r="2.6" fill="#E8C673" />
      <circle cx="383" cy="56" r="2.2" fill="#E8C673" />

      {/* sofa */}
      <g stroke={wood} strokeOpacity="0.7" strokeWidth="1.1">
        <rect x="444" y="84" width="214" height="30" rx="12" fill="#D9CBB3" />
        <rect x="436" y="96" width="24" height="30" rx="10" fill="#CDBA9A" />
        <rect x="642" y="96" width="24" height="30" rx="10" fill="#CDBA9A" />
        <rect x="458" y="106" width="184" height="20" rx="7" fill="#E4D6BC" />
        <line x1="550" y1="106" x2="550" y2="126" />
        <line x1="452" y1="126" x2="448" y2="138" />
        <line x1="650" y1="126" x2="654" y2="138" />
      </g>
      <rect x="466" y="90" width="30" height="24" rx="8" fill="#A9BBA9" stroke="#6F8A6F" strokeOpacity="0.6" strokeWidth="0.9" transform="rotate(-6 481 102)" />
      <rect x="604" y="92" width="28" height="22" rx="8" fill="#D9A58A" stroke={wood} strokeOpacity="0.5" strokeWidth="0.9" transform="rotate(7 618 103)" />

      {/* framed art over the sofa */}
      <rect x="500" y="24" width="106" height="46" fill="#FFFDF6" stroke={brass} strokeWidth="1.6" />
      <rect x="506" y="30" width="94" height="34" fill="none" stroke={brass} strokeOpacity="0.4" strokeWidth="0.8" />
      <circle cx="534" cy="47" r="10" fill="#C98B6B" fillOpacity="0.85" />
      <path d="M552 64c10-22 24-26 44-20" fill="none" stroke="#6F8A6F" strokeWidth="1.6" />
      <path d="M552 58c12-12 22-14 42-10" fill="none" stroke={brass} strokeWidth="1" />

      {/* small plant, right */}
      <path d="M698 138l3-14h20l3 14z" fill="#E4D6BC" stroke={wood} strokeOpacity="0.5" strokeWidth="1" />
      <g fill="#9DB39D" stroke="#6F8A6F" strokeOpacity="0.6" strokeWidth="0.8">
        <ellipse cx="711" cy="106" rx="5" ry="16" transform="rotate(-10 711 106)" />
        <ellipse cx="701" cy="112" rx="4" ry="13" transform="rotate(-40 701 112)" />
        <ellipse cx="722" cy="112" rx="4" ry="13" transform="rotate(38 722 112)" />
      </g>
    </svg>
  );
}
