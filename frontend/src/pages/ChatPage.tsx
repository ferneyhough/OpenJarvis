import { ChatArea } from '../components/Chat/ChatArea';
import { SystemPanel } from '../components/Chat/SystemPanel';
import { useAppStore } from '../lib/store';

export function ChatPage() {
  const systemPanelOpen = useAppStore((s) => s.systemPanelOpen);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-0 flex-1">
        {systemPanelOpen && <SystemPanel />}
        <div className="flex-1 min-w-0">
          <ChatArea />
        </div>
      </div>
    </div>
  );
}
