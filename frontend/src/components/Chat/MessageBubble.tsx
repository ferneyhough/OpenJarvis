import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { Copy, Check, Pencil, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { AudioPlayer } from './AudioPlayer';
import { ToolCallCard } from './ToolCallCard';
import { ResearchTimeline } from './ResearchTimeline';
import { rehypeCitations } from '../../lib/rehype-citations';
import { XRayFooter } from './XRayFooter';
import { SpeakMessageButton } from './SpeakMessageButton';
import type { ChatMessage } from '../../types';
import { stripThinkTags } from '../../lib/message-text';

interface Props {
  message: ChatMessage;
  isLive?: boolean;
}

function getTextContent(node: any): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getTextContent).join('');
  }
  if (node?.props?.children) {
    return getTextContent(node.props.children);
  }
  return '';
}

function CodeBlockPre({ children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className = codeElement?.props?.className || '';
  const match = /language-([\w-]+)/.exec(className);
  const lang = match ? match[1] : '';
  const code = getTextContent(codeElement?.props?.children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="code-block-wrapper relative my-3"
      style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
    >
      <div
        className="flex items-center justify-between px-4 py-1.5 text-xs"
        style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
      >
        <span className="font-mono">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre {...props} style={{ margin: 0, borderRadius: 0 }}>
        {children}
      </pre>
    </div>
  );
}

function CopyMessageButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      style={{ color: 'var(--color-text-tertiary)' }}
      title="Copy message"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function MediaList({ media }: { media?: ChatMessage['media'] }) {
  if (!media?.length) return null;
  return (
    <div className="flex flex-col gap-2 my-2">
      {media.map((m, i) =>
        m.kind === 'image' ? (
          <img key={i} src={m.url} alt={m.name ?? 'image'} className="max-w-full rounded-lg" style={{ maxHeight: 420 }} />
        ) : m.kind === 'video' ? (
          <video key={i} src={m.url} controls loop className="max-w-full rounded-lg" style={{ maxHeight: 420 }} />
        ) : (
          <audio key={i} src={m.url} controls />
        ),
      )}
      {media.map((m, i) =>
        m.kind !== 'image' || m.url.startsWith('http') ? (
          <a key={`d${i}`} href={m.url} download className="text-xs underline" style={{ color: 'var(--color-accent)' }}>
            Download {m.kind}
          </a>
        ) : null,
      )}
    </div>
  );
}

function ActionButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      style={{ color: 'var(--color-text-tertiary)' }}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function resend(messageId: string, content: string) {
  const st = useAppStore.getState();
  if (st.streamState.isStreaming || !st.activeId) return;
  st.truncateFrom(st.activeId, messageId);
  window.dispatchEvent(new CustomEvent('jarvis:resend', { detail: { content } }));
}

export function MessageBubble({ message, isLive = false }: Props) {
  const isUser = message.role === 'user';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const retry = () => {
    const msgs = useAppStore.getState().messages;
    const i = msgs.findIndex((m) => m.id === message.id);
    const prev = i > 0 ? msgs[i - 1] : undefined;
    if (prev?.role === 'user') resend(prev.id, prev.content);
  };
  const cleanContent = useMemo(() => stripThinkTags(message.content), [message.content]);

  // Build a ref→source lookup once per render. Memoized so the rehype plugin
  // identity stays stable until the source list actually changes.
  const sourcesMap = useMemo(() => {
    const m = new Map<number, NonNullable<ChatMessage['researchSources']>[number]>();
    for (const s of message.researchSources ?? []) {
      if (typeof s.ref === 'number') m.set(s.ref, s);
    }
    return m;
  }, [message.researchSources]);

  const rehypePlugins = useMemo(() => {
    const base: any[] = [[rehypeHighlight, { detect: true }], rehypeKatex];
    if (sourcesMap.size > 0) base.push([rehypeCitations, { sources: sourcesMap }]);
    return base;
  }, [sourcesMap]);

  if (isUser) {
    return (
      <div className="group flex flex-col items-end mb-4">
        <div
          className="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed"
          style={{
            background: 'var(--color-user-bubble)',
            color: 'var(--color-user-bubble-text)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded p-2 text-sm"
                style={{ background: 'var(--color-input-bg)', color: 'var(--color-text)' }}
              />
              <div className="flex justify-end gap-2 text-xs">
                <button onClick={() => setEditing(false)}>Cancel</button>
                <button
                  onClick={() => {
                    setEditing(false);
                    if (draft.trim()) resend(message.id, draft.trim());
                  }}
                  className="font-semibold"
                >
                  Save &amp; resend
                </button>
              </div>
            </div>
          ) : (
            message.content
          )}
          <MediaList media={message.media} />
        </div>
        {!editing && (
          <div className="flex items-center gap-1 mt-1">
            <ActionButton title="Edit message" onClick={() => { setDraft(message.content); setEditing(true); }}>
              <Pencil size={14} />
            </ActionButton>
            <ActionButton title="Resend" onClick={() => resend(message.id, message.content)}>
              <RotateCcw size={14} />
            </ActionButton>
            <CopyMessageButton content={message.content} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group mb-6">
      {/* Deep Research timeline (steps + status) */}
      {(message.isResearch || (message.researchTraces && message.researchTraces.length > 0)) && (
        <ResearchTimeline
          traces={message.researchTraces ?? []}
          isLive={isLive}
          hasContent={cleanContent.length > 0}
        />
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {message.toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Audio player (e.g. morning digest) */}
      {message.audio?.url && <AudioPlayer src={message.audio.url} />}

      {/* Assistant message */}
      {cleanContent && (
        <div className="prose max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={rehypePlugins}
            components={{
              pre: CodeBlockPre,
            }}
          >
            {cleanContent}
          </ReactMarkdown>
        </div>
      )}

      <MediaList media={message.media} />

      {/* Footer: copy + read aloud + x-ray */}
      <div className="flex items-center gap-2 mt-1.5">
        <CopyMessageButton content={cleanContent} />
        {!isLive && (
          <ActionButton title="Regenerate response" onClick={retry}>
            <RotateCcw size={14} />
          </ActionButton>
        )}
        {!isUser && !isLive && (
          <SpeakMessageButton messageId={message.id} content={cleanContent} />
        )}
      </div>
      <XRayFooter
        usage={message.usage}
        telemetry={message.telemetry}
        isResearch={message.isResearch}
      />
    </div>
  );
}
