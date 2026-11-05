import { lazy, Suspense } from 'react';
import { ChatArea } from '../components/Chat/ChatArea';
import { SystemPanel } from '../components/Chat/SystemPanel';
import { useAppStore } from '../lib/store';

// three.js + the glTF model are heavy — lazy-load the face scene.
const IronGiantFace = lazy(() =>
  import('../components/IronGiantFace').then((m) => ({ default: m.IronGiantFace })),
);

export function ChatPage() {
  const systemPanelOpen = useAppStore((s) => s.systemPanelOpen);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        {systemPanelOpen && <SystemPanel />}
        <div className="flex-1 min-w-0">
          <ChatArea />
        </div>
        <Suspense fallback={null}>
          <IronGiantFace />
        </Suspense>
      </div>
    </div>
  );
}
