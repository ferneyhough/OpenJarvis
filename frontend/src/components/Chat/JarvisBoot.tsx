// Iron-Man-style boot screen shown in the centre of the chat page while the
// conversation is empty. Pure CSS/SVG — no assets, honours reduced motion.

const C = '#22d3ee'; // JARVIS cyan

function ArcReactor() {
  return (
    <svg viewBox="0 0 200 200" className="jarvis-reactor" aria-hidden="true">
      <defs>
        <radialGradient id="jr-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#eafcff" />
          <stop offset="35%" stopColor={C} />
          <stop offset="100%" stopColor="#0e7490" />
        </radialGradient>
      </defs>
      {/* outer dashed ring */}
      <circle cx="100" cy="100" r="92" fill="none" stroke={C} strokeOpacity="0.35"
        strokeWidth="1" strokeDasharray="4 10" className="jr-spin-slow" style={{ transformOrigin: '100px 100px' }} />
      {/* segmented tick ring */}
      <circle cx="100" cy="100" r="78" fill="none" stroke={C} strokeOpacity="0.5"
        strokeWidth="2" strokeDasharray="2 14" className="jr-spin-rev" style={{ transformOrigin: '100px 100px' }} />
      {/* mid ring */}
      <circle cx="100" cy="100" r="60" fill="none" stroke={C} strokeOpacity="0.6"
        strokeWidth="1.5" strokeDasharray="30 12" className="jr-spin" style={{ transformOrigin: '100px 100px' }} />
      {/* inner ring */}
      <circle cx="100" cy="100" r="44" fill="none" stroke={C} strokeOpacity="0.8"
        strokeWidth="1" />
      {/* core */}
      <circle cx="100" cy="100" r="26" fill="url(#jr-core)" opacity="0.9" className="jr-pulse" />
      <circle cx="100" cy="100" r="10" fill="#ffffff" opacity="0.9" />
      {/* spokes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line key={deg} x1="100" y1="16" x2="100" y2="30"
          stroke={C} strokeOpacity="0.7" strokeWidth="2"
          transform={`rotate(${deg} 100 100)`} />
      ))}
    </svg>
  );
}

export function JarvisBoot() {
  return (
    <div className="flex flex-col items-center justify-center py-16 select-none" aria-label="Jarvis ready">
      <style>{`
        .jr-spin { animation: jr-rot 14s linear infinite; }
        .jr-spin-slow { animation: jr-rot 40s linear infinite; }
        .jr-spin-rev { animation: jr-rot-rev 22s linear infinite; }
        .jr-pulse { animation: jr-pulse 2.6s ease-in-out infinite; }
        @keyframes jr-rot { to { transform: rotate(360deg); } }
        @keyframes jr-rot-rev { to { transform: rotate(-360deg); } }
        @keyframes jr-pulse { 0%,100% { opacity: .75; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .jr-spin, .jr-spin-slow, .jr-spin-rev, .jr-pulse { animation: none; }
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
