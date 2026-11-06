import { ChatArea } from '../components/Chat/ChatArea';

export function ChatPage() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="flex-1 min-w-0">
          <ChatArea />
        </div>
      </div>
    </div>
  );
}
