import { lazy, Suspense } from 'react';

// Full-window head-only render — no chat chrome, just the model.
const IronGiantFace = lazy(() =>
  import('../components/IronGiantFace').then((m) => ({ default: m.IronGiantFace })),
);

export function HeadPage() {
  return (
    <div
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: '#04070b' }}
    >
      <Suspense fallback={null}>
        <IronGiantFace />
      </Suspense>
      <div className="pointer-events-none absolute bottom-3 right-4 text-[10px]" style={{ color: '#3a4a55' }}>
        Iron Giant · bolshooylenny · CC-BY-4.0 — drag to rotate, scroll to zoom
      </div>
    </div>
  );
}
