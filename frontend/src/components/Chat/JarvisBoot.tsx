// Iron-Man-style boot screen shown in the centre of the chat page while the
// conversation is empty. Pure CSS/SVG — no assets, honours reduced motion.

const C = '#22d3ee'; // JARVIS cyan

const TICKS = Array.from({ length: 60 }, (_, i) => i * 6);
const ORBIT_DOTS = [0, 120, 240];
const PARTICLES = [
  { x: 30, y: 60, r: 1.6, d: '0s' },
  { x: 165, y: 45, r: 1.2, d: '1.2s' },
  { x: 178, y: 140, r: 1.8, d: '2.1s' },
  { x: 22, y: 150, r: 1.3, d: '0.7s' },
  { x: 150, y: 178, r: 1.5, d: '1.6s' },
  { x: 55, y: 185, r: 1.1, d: '2.6s' },
];

function ArcReactor() {
  return (
    <svg viewBox="0 0 200 200" className="jarvis-reactor" aria-hidden="true">
      <defs>
        <radialGradient id="jr-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eafcff" />
          <stop offset="35%" stopColor={C} />
          <stop offset="100%" stopColor="#0e7490" />
        </radialGradient>
        <radialGradient id="jr-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C} stopOpacity="0.35" />
          <stop offset="100%" stopColor={C} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="jr-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={C} stopOpacity="0" />
          <stop offset="100%" stopColor={C} stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* ambient halo */}
      <circle cx="100" cy="100" r="96" fill="url(#jr-halo)" className="jr-halo-breathe" />

      {/* outer tick ring */}
      <g className="jr-spin-slower" style={{ transformOrigin: '100px 100px' }}>
        {TICKS.map((deg) => (
          <line
            key={deg}
            x1="100" y1="6" x2="100" y2={deg % 30 === 0 ? 14 : 10}
            stroke={C} strokeOpacity={deg % 30 === 0 ? 0.8 : 0.35}
            strokeWidth={deg % 30 === 0 ? 1.6 : 1}
            transform={`rotate(${deg} 100 100)`}
          />
        ))}
      </g>

      {/* outer dashed ring */}
      <circle cx="100" cy="100" r="88" fill="none" stroke={C} strokeOpacity="0.4"
        strokeWidth="1" strokeDasharray="4 10" className="jr-spin-slow" style={{ transformOrigin: '100px 100px' }} />

      {/* segmented tick ring */}
      <circle cx="100" cy="100" r="74" fill="none" stroke={C} strokeOpacity="0.55"
        strokeWidth="2" strokeDasharray="2 14" className="jr-spin-rev" style={{ transformOrigin: '100px 100px' }} />

      {/* orbit dots riding the mid ring */}
      <g className="jr-spin" style={{ transformOrigin: '100px 100px' }}>
        {ORBIT_DOTS.map((deg) => (
          <circle key={deg} cx="100" cy="30" r="2.4" fill={C}
            opacity="0.9" transform={`rotate(${deg} 100 100)`} />
        ))}
      </g>

      {/* mid arc ring */}
      <circle cx="100" cy="100" r="58" fill="none" stroke={C} strokeOpacity="0.65"
        strokeWidth="1.5" strokeDasharray="30 12" className="jr-spin" style={{ transformOrigin: '100px 100px' }} />

      {/* fast counter-rotating arc segment */}
      <circle cx="100" cy="100" r="66" fill="none" stroke="url(#jr-sweep)"
        strokeWidth="3" strokeDasharray="60 354" strokeLinecap="round"
        className="jr-spin-fast" style={{ transformOrigin: '100px 100px' }} />

      {/* inner ring */}
      <circle cx="100" cy="100" r="42" fill="none" stroke={C} strokeOpacity="0.8"
        strokeWidth="1" />
      <circle cx="100" cy="100" r="36" fill="none" stroke={C} strokeOpacity="0.3"
        strokeWidth="1" strokeDasharray="1 6" className="jr-spin-rev" style={{ transformOrigin: '100px 100px' }} />

      {/* core glow + core */}
      <circle cx="100" cy="100" r="34" fill="url(#jr-halo)" className="jr-core-glow" />
      <circle cx="100" cy="100" r="24" fill="url(#jr-core)" className="jr-pulse" />
      <circle cx="100" cy="100" r="9" fill="#ffffff" className="jr-pulse" />

      {/* spokes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line key={deg} x1="100" y1="14" x2="100" y2="28"
          stroke={C} strokeOpacity="0.7" strokeWidth="2"
          transform={`rotate(${deg} 100 100)`} />
      ))}

      {/* drifting particles */}
      {PARTICLES.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={C}
          className="jr-drift" style={{ animationDelay: p.d }} />
      ))}
    </svg>
  );
}

export function JarvisBoot() {
  return (
    <div className="flex flex-col items-center justify-center py-16 select-none" aria-label="Jarvis ready">
      <style>{`
        .jr-spin { animation: jr-rot 14s linear infinite; }
        .jr-spin-fast { animation: jr-rot 5s linear infinite; }
        .jr-spin-slow { animation: jr-rot 40s linear infinite; }
        .jr-spin-slower { animation: jr-rot 90s linear infinite; }
        .jr-spin-rev { animation: jr-rot-rev 22s linear infinite; }
        .jr-pulse { animation: jr-pulse 2.2s ease-in-out infinite; }
        .jr-halo-breathe { animation: jr-breathe 4s ease-in-out infinite; transform-origin: 100px 100px; }
        .jr-core-glow { animation: jr-breathe 2.2s ease-in-out infinite; transform-origin: 100px 100px; }
        .jr-drift { animation: jr-drift 5s ease-in-out infinite; opacity: 0; }
        @keyframes jr-rot { to { transform: rotate(360deg); } }
        @keyframes jr-rot-rev { to { transform: rotate(-360deg); } }
        @keyframes jr-pulse { 0%,100% { opacity: .7; } 50% { opacity: 1; } }
        @keyframes jr-breathe { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        @keyframes jr-drift {
          0% { opacity: 0; transform: translateY(6px); }
          30% { opacity: .9; }
          70% { opacity: .5; }
          100% { opacity: 0; transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jr-spin, .jr-spin-fast, .jr-spin-slow, .jr-spin-slower, .jr-spin-rev,
          .jr-pulse, .jr-halo-breathe, .jr-core-glow, .jr-drift { animation: none; }
          .jr-drift { opacity: .6; }
        }
      `}</style>
      <ArcReactor />
      <h1
        className="mt-5 text-2xl font-semibold tracking-[0.35em]"
        style={{ color: C, textShadow: `0 0 18px ${C}66` }}
      >
        J.A.R.V.I.S.
      </h1>
      <p className="mt-1 text-xs tracking-widest uppercase" style={{ color: 'var(--color-text-tertiary)' }}>
        Just A Rather Very Intelligent System
      </p>
      <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Systems nominal — awaiting your command.
      </p>
      <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34d399' }} />
        Online
        <span className="mx-2" style={{ color: 'var(--color-border)' }}>|</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
        All systems go
      </div>
    </div>
  );
}
