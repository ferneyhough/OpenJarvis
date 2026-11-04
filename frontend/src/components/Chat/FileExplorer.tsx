import { ChevronDown, ChevronRight, File as FileIcon, Folder, FolderOpen, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Attachment } from './ChatToolbar';

interface Node {
  name: string;
  path: string;
  children: Map<string, Node>;
  file?: Attachment;
}

function buildTree(items: Attachment[]): Node {
  const root: Node = { name: '', path: '', children: new Map() };
  for (const a of items) {
    const parts = (a.path || a.name).split('/').filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let next = cur.children.get(part);
      if (!next) {
        next = { name: part, path, children: new Map() };
        cur.children.set(part, next);
      }
      if (i === parts.length - 1) next.file = a;
      cur = next;
    });
  }
  return root;
}

function collectIds(n: Node, out: string[] = []): string[] {
  if (n.file) out.push(n.file.id);
  n.children.forEach((c) => collectIds(c, out));
  return out;
}

function sorted(n: Node): Node[] {
  return [...n.children.values()].sort((a, b) => {
    const ad = a.children.size > 0 && !a.file;
    const bd = b.children.size > 0 && !b.file;
    if (ad !== bd) return ad ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function Row({
  node,
  depth,
  selected,
  onSelect,
  onRemove,
}: {
  node: Node;
  depth: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onRemove: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = !node.file;
  const active = node.file && node.file.id === selected;
  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded px-1 py-0.5 cursor-pointer"
        style={{
          paddingLeft: 4 + depth * 14,
          background: active ? 'var(--color-accent-subtle)' : 'transparent',
          color: 'var(--color-text-secondary)',
        }}
        onClick={() => (isDir ? setOpen((v) => !v) : onSelect(node.file!.id))}
      >
        {isDir ? (
          <>
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {open ? <FolderOpen size={13} /> : <Folder size={13} />}
          </>
        ) : (
          <>
            <span style={{ width: 12 }} />
            <FileIcon size={13} />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        <button
          type="button"
          aria-label={`Remove ${node.name}`}
          className="opacity-0 group-hover:opacity-100 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(collectIds(node));
          }}
        >
          <X size={12} />
        </button>
      </div>
      {isDir &&
        open &&
        sorted(node).map((c) => (
          <Row key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} onRemove={onRemove} />
        ))}
    </div>
  );
}

export function FileExplorer({
  attachments,
  onRemove,
  onClear,
}: {
  attachments: Attachment[];
  onRemove: (ids: string[]) => void;
  onClear: () => void;
}) {
  const tree = useMemo(() => buildTree(attachments), [attachments]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = attachments.find((a) => a.id === selected);
  if (attachments.length === 0) return null;

  return (
    <div
      className="mt-2 rounded-xl text-xs overflow-hidden"
      style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
      aria-label="Attached files"
    >
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}
      >
        <span>
          Attached · {attachments.length} file{attachments.length === 1 ? '' : 's'}
        </span>
        <button type="button" className="cursor-pointer underline" onClick={onClear}>
          Clear all
        </button>
      </div>
      <div className="flex" style={{ maxHeight: 200 }}>
        <div className="overflow-auto py-1" style={{ width: current ? '40%' : '100%' }}>
          {sorted(tree).map((n) => (
            <Row key={n.path} node={n} depth={0} selected={selected} onSelect={setSelected} onRemove={onRemove} />
          ))}
        </div>
        {current && (
          <div
            className="flex-1 overflow-auto p-2"
            style={{ borderLeft: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <div className="mb-1 font-semibold truncate">{current.path || current.name}</div>
            {current.kind === 'image' ? (
              <img src={current.data} alt={current.name} className="max-h-36 rounded" />
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">
                {current.data.slice(0, 4000)}
                {current.data.length > 4000 ? '\n…' : ''}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
