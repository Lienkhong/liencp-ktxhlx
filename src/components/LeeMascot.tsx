import React from 'react';

interface LeeMascotProps {
  size?: number | string;
  variant?: 'full' | 'avatar' | 'badge';
  className?: string;
  animated?: boolean;
}

export const LeeMascot: React.FC<LeeMascotProps> = ({
  size = 48,
  variant = 'badge',
  className = '',
  animated = false,
}) => {
  // If variant is 'badge' (Matching Image 2: Speech bubble badge with Lee & "AI" badge)
  if (variant === 'badge') {
    return (
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className={`inline-block select-none ${animated ? 'hover:scale-105 transition-transform' : ''} ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="lee-bubble-bg" x1="20" y1="10" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ecfeff" />
            <stop offset="100%" stopColor="#ccfbf1" />
          </linearGradient>
          <linearGradient id="lee-bubble-border" x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <linearGradient id="lee-heart-grad" x1="55" y1="2" x2="65" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="60%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          <linearGradient id="lee-hair-grad" x1="40" y1="30" x2="80" y2="55" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="lee-helmet-rim" x1="30" y1="20" x2="90" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="60%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="lee-suit-white" x1="45" y1="65" x2="75" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="lee-shield" x1="55" y1="72" x2="65" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="lee-ai-badge-bg" x1="75" y1="75" x2="105" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="60%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>

          {/* Filter for glow & depth */}
          <filter id="lee-shadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f766e" floodOpacity="0.25" />
          </filter>
          <filter id="lee-heart-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#e11d48" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Speech Bubble Base Frame */}
        <path
          d="M60 14 C33 14 14 31 14 55 C14 69 22 81 34 89 L32 104 C32 105 34 106 35 105 L48 95 C52 96 56 96 60 96 C87 96 106 79 106 55 C106 31 87 14 60 14 Z"
          fill="url(#lee-bubble-bg)"
          stroke="url(#lee-bubble-border)"
          strokeWidth="4"
          strokeLinejoin="round"
          filter="url(#lee-shadow)"
        />

        {/* Cape visible behind body */}
        <path
          d="M38 72 C33 76 30 84 32 90 C40 88 46 84 50 80 Z"
          fill="#06b6d4"
          opacity="0.9"
        />
        <path
          d="M82 72 C87 76 90 84 88 90 C80 88 74 84 70 80 Z"
          fill="#0891b2"
          opacity="0.9"
        />

        {/* Waving Hand (Left side of image / Character's right hand) */}
        <g className={animated ? 'animate-bounce' : ''}>
          {/* Arm */}
          <path
            d="M36 68 C30 63 26 55 31 51 C35 48 40 54 44 60 Z"
            fill="url(#lee-suit-white)"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />
          {/* Glove & Waving palm */}
          <ellipse cx="29" cy="51" rx="6" ry="5" fill="#22d3ee" transform="rotate(-20 29 51)" />
          {/* Fingers */}
          <circle cx="25" cy="48" r="2.2" fill="#22d3ee" />
          <circle cx="27" cy="45" r="2.2" fill="#22d3ee" />
          <circle cx="30" cy="45" r="2.2" fill="#22d3ee" />
          <circle cx="33" cy="47" r="2" fill="#22d3ee" />
        </g>

        {/* Astronaut Suit Upper Body */}
        <path
          d="M44 68 C44 64 52 63 60 63 C68 63 76 64 76 68 C78 78 76 92 60 92 C44 92 42 78 44 68 Z"
          fill="url(#lee-suit-white)"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Cyan Collar Trim */}
        <path
          d="M48 64 C53 66 67 66 72 64 C70 68 50 68 48 64 Z"
          fill="#0891b2"
        />

        {/* Chest Emblem: Shield with Heartbeat / ECG pulse */}
        <g transform="translate(60, 78)">
          {/* Shield shape */}
          <path
            d="M0 -7 C4 -7 7 -6 7 -3 C7 2 3 7 0 9 C-3 7 -7 2 -7 -3 C-7 -6 -4 -7 0 -7 Z"
            fill="url(#lee-shield)"
            stroke="#10b981"
            strokeWidth="0.8"
          />
          {/* ECG Line */}
          <path
            d="M-5 -2 L-2.5 -2 L-1 -5 L0.5 1 L1.8 -3 L3 -2 L5 -2"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Other Arm (Resting on side) */}
        <path
          d="M75 66 C80 70 82 77 78 81 C75 83 73 78 72 73 Z"
          fill="url(#lee-suit-white)"
        />
        <circle cx="78" cy="80" r="4.5" fill="#22d3ee" />

        {/* Helmet Outer Shell with Wing Fins */}
        {/* Left Wing Fin */}
        <path
          d="M33 46 C27 40 28 32 31 29 C34 33 34 38 38 41 Z"
          fill="#ffffff"
          stroke="#a5f3fc"
          strokeWidth="1.2"
        />
        <path
          d="M30 42 C26 38 27 34 29 32 C31 35 32 38 34 40 Z"
          fill="#cffafe"
        />

        {/* Right Wing Fin */}
        <path
          d="M87 46 C93 40 92 32 89 29 C86 33 86 38 82 41 Z"
          fill="#ffffff"
          stroke="#a5f3fc"
          strokeWidth="1.2"
        />
        <path
          d="M90 42 C94 38 93 34 91 32 C89 35 88 38 86 40 Z"
          fill="#cffafe"
        />

        {/* Helmet Rim & Visor Outer Frame */}
        <circle
          cx="60"
          cy="42"
          r="24"
          fill="#ffffff"
          stroke="url(#lee-helmet-rim)"
          strokeWidth="4"
          filter="url(#lee-shadow)"
        />

        {/* Cute Face (Inside Visor) */}
        <circle cx="60" cy="43" r="19" fill="#fff9f5" />

        {/* Blue Anime Hair Bangs */}
        <path
          d="M42 38 C45 32 50 28 60 28 C70 28 75 32 78 38 C75 38 72 35 68 37 C64 39 62 44 60 41 C57 44 54 39 50 37 C47 36 44 38 42 38 Z"
          fill="url(#lee-hair-grad)"
        />
        {/* Side Hair strands */}
        <path d="M42 38 C41 43 43 47 45 48 C44 44 43 41 44 38 Z" fill="#1d4ed8" />
        <path d="M78 38 C79 43 77 47 75 48 C76 44 77 41 76 38 Z" fill="#1d4ed8" />

        {/* Big Sparkling Anime Eyes */}
        {/* Left Eye */}
        <g>
          <ellipse cx="52" cy="43" rx="4.5" ry="6" fill="#1e293b" />
          <ellipse cx="52" cy="44" rx="4" ry="5.5" fill="#1d4ed8" />
          <circle cx="51" cy="41" r="2.2" fill="#ffffff" />
          <circle cx="53.5" cy="45.5" r="1.1" fill="#ffffff" />
        </g>

        {/* Right Eye */}
        <g>
          <ellipse cx="68" cy="43" rx="4.5" ry="6" fill="#1e293b" />
          <ellipse cx="68" cy="44" rx="4" ry="5.5" fill="#1d4ed8" />
          <circle cx="67" cy="41" r="2.2" fill="#ffffff" />
          <circle cx="69.5" cy="45.5" r="1.1" fill="#ffffff" />
        </g>

        {/* Blushing Cheeks */}
        <circle cx="47" cy="49" r="4" fill="#fb7185" opacity="0.65" />
        <circle cx="73" cy="49" r="4" fill="#fb7185" opacity="0.65" />

        {/* Cheerful Open Mouth */}
        <path
          d="M57 49 C57 54 63 54 63 49 Z"
          fill="#e11d48"
        />
        <path
          d="M58 51 C59 53 61 53 62 51 Z"
          fill="#fda4af"
        />

        {/* Floating 3D Red Heart on Top of Helmet */}
        <g filter="url(#lee-heart-glow)">
          <path
            d="M60 17 C59 15 54 9 51 13 C48 17 52 21 60 26 C68 21 72 17 69 13 C66 9 61 15 60 17 Z"
            fill="url(#lee-heart-grad)"
          />
          {/* Specular gloss arc on heart */}
          <path
            d="M53 13 C53 11 56 11 58 13"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>

        {/* Circular "AI" Badge on Bottom Right (Matching Image 2 exactly) */}
        <g filter="url(#lee-shadow)">
          <circle
            cx="88"
            cy="88"
            r="17"
            fill="#ffffff"
          />
          <circle
            cx="88"
            cy="88"
            r="15"
            fill="url(#lee-ai-badge-bg)"
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* Bold "AI" text */}
          <text
            x="88"
            y="94"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="14"
            letterSpacing="-0.5px"
          >
            AI
          </text>
        </g>
      </svg>
    );
  }

  // If variant is 'full' (Matching Image 1: Full standing figure with body, boots & waving pose)
  if (variant === 'full') {
    return (
      <svg
        viewBox="0 0 160 220"
        width={size}
        height={typeof size === 'number' ? (size * 220) / 160 : size}
        className={`inline-block select-none ${className}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="lee-full-heart" x1="75" y1="2" x2="85" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="50%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          <linearGradient id="lee-full-hair" x1="50" y1="35" x2="110" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="40%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="lee-full-helmet" x1="40" y1="30" x2="120" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#cffafe" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="lee-full-cape" x1="50" y1="90" x2="110" y2="170" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          <linearGradient id="lee-full-boots" x1="60" y1="180" x2="100" y2="210" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <filter id="lee-full-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0891b2" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Soft shadow on ground */}
        <ellipse cx="80" cy="212" rx="38" ry="6" fill="#0891b2" opacity="0.18" />

        {/* Cape flowing behind */}
        <path
          d="M58 100 C48 115 42 145 44 165 C58 160 70 152 75 145 Z"
          fill="url(#lee-full-cape)"
          opacity="0.9"
        />
        <path
          d="M102 100 C112 115 118 145 116 165 C102 160 90 152 85 145 Z"
          fill="url(#lee-full-cape)"
          opacity="0.9"
        />

        {/* Legs and Boots */}
        {/* Left Leg & Boot */}
        <path d="M66 142 L66 182 L76 182 L76 142 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <path
          d="M62 182 C62 180 77 180 77 182 L78 204 C78 207 72 208 63 208 C58 208 58 204 62 182 Z"
          fill="url(#lee-full-boots)"
          stroke="#0e7490"
          strokeWidth="1"
        />

        {/* Right Leg & Boot */}
        <path d="M84 142 L84 182 L94 182 L94 142 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <path
          d="M83 182 C83 180 98 180 98 182 L102 204 C102 207 97 208 88 208 C82 208 81 204 83 182 Z"
          fill="url(#lee-full-boots)"
          stroke="#0e7490"
          strokeWidth="1"
        />

        {/* Main Body Suit */}
        <path
          d="M58 96 C58 90 70 88 80 88 C90 88 102 90 102 96 C104 112 100 144 80 144 C60 144 56 112 58 96 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1.2"
          filter="url(#lee-full-shadow)"
        />

        {/* Cyan Belt Trim */}
        <path d="M60 134 C70 137 90 137 100 134 C100 138 60 138 60 134 Z" fill="#0891b2" />

        {/* Chest Emblem: Shield with Heartbeat */}
        <g transform="translate(80, 108)">
          <path
            d="M0 -9 C6 -9 10 -7 10 -3 C10 4 4 10 0 13 C-4 10 -10 4 -10 -3 C-10 -7 -6 -9 0 -9 Z"
            fill="#10b981"
            stroke="#059669"
            strokeWidth="1"
          />
          <path
            d="M-7 -2 L-3 -2 L-1.5 -6 L0.5 2 L2 -4 L3.5 -2 L7 -2"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Left Arm (Viewer's left / Waving high) */}
        <g className="animate-pulse">
          <path
            d="M58 96 C48 90 40 76 44 68 C49 65 56 75 62 86 Z"
            fill="#ffffff"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {/* Turquoise Glove */}
          <ellipse cx="40" cy="65" rx="8" ry="7" fill="#22d3ee" transform="rotate(-15 40 65)" />
          <circle cx="34" cy="60" r="3" fill="#22d3ee" />
          <circle cx="37" cy="56" r="3" fill="#22d3ee" />
          <circle cx="41" cy="56" r="3" fill="#22d3ee" />
          <circle cx="45" cy="58" r="2.8" fill="#22d3ee" />
        </g>

        {/* Right Arm (Resting on side) */}
        <path
          d="M102 96 C110 104 116 114 112 120 C108 122 104 114 100 106 Z"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        <circle cx="111" cy="120" r="6" fill="#22d3ee" />

        {/* Helmet Wing Fins */}
        <path
          d="M44 56 C36 48 37 38 41 34 C45 40 45 46 51 50 Z"
          fill="#ffffff"
          stroke="#a5f3fc"
          strokeWidth="1.5"
        />
        <path
          d="M116 56 C124 48 123 38 119 34 C115 40 115 46 109 50 Z"
          fill="#ffffff"
          stroke="#a5f3fc"
          strokeWidth="1.5"
        />

        {/* Helmet Outer Shell */}
        <circle
          cx="80"
          cy="52"
          r="34"
          fill="#ffffff"
          stroke="url(#lee-full-helmet)"
          strokeWidth="5"
          filter="url(#lee-full-shadow)"
        />

        {/* Face Inside Visor */}
        <circle cx="80" cy="53" r="26" fill="#fff9f5" />

        {/* Hair Bangs */}
        <path
          d="M55 46 C60 38 68 32 80 32 C92 32 100 38 105 46 C100 46 96 42 90 44 C85 47 82 53 80 50 C76 54 72 47 67 44 C62 43 58 46 55 46 Z"
          fill="url(#lee-full-hair)"
        />

        {/* Eyes */}
        <g>
          <ellipse cx="68" cy="53" rx="5.5" ry="7.5" fill="#1e293b" />
          <ellipse cx="68" cy="54" rx="4.8" ry="7" fill="#1d4ed8" />
          <circle cx="67" cy="50" r="2.8" fill="#ffffff" />
          <circle cx="70" cy="56" r="1.4" fill="#ffffff" />
        </g>
        <g>
          <ellipse cx="92" cy="53" rx="5.5" ry="7.5" fill="#1e293b" />
          <ellipse cx="92" cy="54" rx="4.8" ry="7" fill="#1d4ed8" />
          <circle cx="91" cy="50" r="2.8" fill="#ffffff" />
          <circle cx="94" cy="56" r="1.4" fill="#ffffff" />
        </g>

        {/* Cheeks */}
        <circle cx="62" cy="61" r="5" fill="#fb7185" opacity="0.65" />
        <circle cx="98" cy="61" r="5" fill="#fb7185" opacity="0.65" />

        {/* Open Mouth */}
        <path d="M76 60 C76 67 84 67 84 60 Z" fill="#e11d48" />
        <path d="M78 62 C79 65 81 65 82 62 Z" fill="#fda4af" />

        {/* Floating Red 3D Heart */}
        <g>
          <path
            d="M80 16 C78 13 72 6 68 11 C64 16 70 21 80 27 C90 21 96 16 92 11 C88 6 82 13 80 16 Z"
            fill="url(#lee-full-heart)"
          />
          <path
            d="M70 11 C70 9 74 9 77 11"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>
      </svg>
    );
  }

  // Default: 'avatar' compact mode for chat bubbles & small buttons
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="select-none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="lee-av-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ecfeff" />
            <stop offset="100%" stopColor="#ccfbf1" />
          </linearGradient>
          <linearGradient id="lee-av-heart" x1="45" y1="2" x2="55" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          <linearGradient id="lee-av-rim" x1="20" y1="10" x2="80" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>

        {/* Rounded badge base */}
        <circle cx="50" cy="50" r="48" fill="url(#lee-av-bg)" stroke="#14b8a6" strokeWidth="2.5" />

        {/* Body & Helmet */}
        <path d="M35 75 C35 70 42 68 50 68 C58 68 65 70 65 75 C66 84 64 94 50 94 C36 94 34 84 35 75 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        <path d="M47 78 L53 78" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

        {/* Waving Hand */}
        <circle cx="27" cy="58" r="5" fill="#22d3ee" />

        {/* Helmet */}
        <circle cx="50" cy="44" r="23" fill="#ffffff" stroke="url(#lee-av-rim)" strokeWidth="3.5" />
        <circle cx="50" cy="45" r="18" fill="#fff9f5" />

        {/* Hair */}
        <path d="M33 39 C36 33 42 29 50 29 C58 29 64 33 67 39 C64 39 61 36 57 38 C53 40 52 44 50 42 C48 44 45 40 42 38 C39 37 36 39 33 39 Z" fill="#2563eb" />

        {/* Eyes */}
        <ellipse cx="44" cy="45" rx="3.5" ry="4.8" fill="#1d4ed8" />
        <circle cx="43" cy="43" r="1.8" fill="#ffffff" />
        <ellipse cx="56" cy="45" rx="3.5" ry="4.8" fill="#1d4ed8" />
        <circle cx="55" cy="43" r="1.8" fill="#ffffff" />

        {/* Cheeks */}
        <circle cx="39" cy="50" r="3.2" fill="#fb7185" opacity="0.7" />
        <circle cx="61" cy="50" r="3.2" fill="#fb7185" opacity="0.7" />

        {/* Mouth */}
        <path d="M48 51 C48 54 52 54 52 51 Z" fill="#e11d48" />

        {/* Heart */}
        <path d="M50 18 C49 16 44 11 42 14 C40 17 43 20 50 24 C57 20 60 17 58 14 C56 11 51 16 50 18 Z" fill="url(#lee-av-heart)" />

        {/* AI Mini Badge */}
        <circle cx="78" cy="78" r="13" fill="#0d9488" stroke="#ffffff" strokeWidth="1.8" />
        <text x="78" y="83" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif" fontWeight="900" fontSize="10">
          AI
        </text>
      </svg>
    </div>
  );
};
