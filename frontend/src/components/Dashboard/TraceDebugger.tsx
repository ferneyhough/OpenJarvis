import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  GitBranch,
  Clock,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  Search,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface TraceStepData {
  model?: string;
  tokens?: number;
  tool?: string;
  input?: string;
  output?: string;
  [key: string]: unknown;
}

interface TraceStep {
  step_type: string;
  duration_ms: number;
  data: TraceStepData;
}

interface TraceSummary {
  id: string;
  query: string;
  steps: TraceStep[];
  created_at: string | null;
  duration_ms?: number;
  [key: string]: unknown;
}

const STEP_COLORS: Record<string, string> = {
  route: 'var(--color-accent)',
  retrieve: 'var(--color-success)',
  generate: 'var(--color-warning)',
  tool_call: 'var(--color-accent-purple)',
  respond: 'var(--color-accent-purple)',
};

const POLL_MS = 5000;

function apiBase(): string {
  return import.meta.env.VITE_API_URL || '';
}

function StepBadge({ type }: { type: string }) {
  const color = STEP_COLORS[type] || 'var(--color-text-tertiary)';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {type}
    </span>
  );
}

function traceTotalMs(trace: TraceSummary): number {
  if (typeof trace.duration_ms === 'number' && trace.duration_ms > 0) {
    return trace.duration_ms;
  }
  return (trace.steps || []).reduce((sum, s) => sum + (s.duration_ms || 0), 0);
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString();
}

function TraceCard({
  trace,
  isActive,
  onClick,
}: {
  trace: TraceSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const totalMs = traceTotalMs(trace);
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg transition-colors cursor-pointer"
      style={{
        background: isActive ? 'var(--color-bg-tertiary)' : 'transparent',
        border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--color-bg-secondary)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="text-sm truncate mb-1" style={{ color: 'var(--color-text)' }}>
        {trace.query || 'Untitled query'}
      </div>
      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        <span>{(trace.steps || []).length} steps</span>
        <span>&middot;</span>
        <span>{totalMs.toFixed(0)}ms</span>
        <span>&middot;</span>
        <span>{fmtTime(trace.created_at)}</span>
      </div>
    </button>
  );
}

function StepDetail({ step, index, maxMs }: { step: TraceStep; index: number; maxMs: number }) {
  const [expanded, setExpanded] = useState(false);
  const dataEntries = Object.entries(step.data || {}).filter(([, v]) => v != null);
  const widthPct = maxMs > 0 ? Math.max(2, (step.duration_ms / maxMs) * 100) : 0;
  const color = STEP_COLORS[step.step_type] || 'var(--color-text-tertiary)';

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors cursor-pointer"
        style={{ background: 'var(--color-bg-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
          {index + 1}
        </span>
        <StepBadge type={step.step_type} />
        {/* relative duration bar */}
        <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
          <span className="block h-full rounded-full" style={{ width: `${widthPct}%`, background: color }} />
        </span>
        <span className="text-xs font-mono flex items-center gap-1 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
          <Clock size={10} />
          {(step.duration_ms || 0).toFixed(0)}ms
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs" style={{ borderTop: '1px solid var(--color-border)' }}>
          {dataEntries.length === 0 ? (
            <div style={{ color: 'var(--color-text-tertiary)' }}>No step data recorded.</div>
          ) : (
            dataEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 py-1">
                <span className="font-mono shrink-0" style={{ color: 'var(--color-text-tertiary)', minWidth: '80px' }}>
                  {key}
                </span>
                <span className="break-all" style={{ color: 'var(--color-text-secondary)' }}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function TraceDebugger() {
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [queryFilter, setQueryFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTraces = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/v1/traces?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTraces(Array.isArray(data.traces) ? data.traces : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cannot load traces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTraces();
  }, [fetchTraces]);

  useEffect(() => {
    if (autoRefresh) {
      pollRef.current = setInterval(() => void fetchTraces(true), POLL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    if (pollRef.current) clearInterval(pollRef.current);
    return undefined;
  }, [autoRefresh, fetchTraces]);

  const filtered = useMemo(() => {
    const q = queryFilter.trim().toLowerCase();
    if (!q) return traces;
    return traces.filter((t) => (t.query || '').toLowerCase().includes(q));
  }, [traces, queryFilter]);

  const selected = traces.find((t) => t.id === selectedId) ?? null;
  const maxStepMs = useMemo(
    () => Math.max(0, ...(selected?.steps || []).map((s) => s.duration_ms || 0)),
    [selected],
  );

  const stats = useMemo(() => {
    if (traces.length === 0) return null;
    const durations = traces.map(traceTotalMs).filter((d) => d > 0);
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const slowest = traces.reduce((a, b) => (traceTotalMs(b) > traceTotalMs(a) ? b : a));
    return { count: traces.length, avg, slowest };
  }, [traces]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(selected ?? traces, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selected ? `trace-${selected.id}.json` : 'traces.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected ?? traces, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Clipboard unavailable.');
    }
  };

  return (
    <div className="hud-panel p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h3 className="hud-label flex items-center gap-2">
          <GitBranch size={12} style={{ color: 'var(--color-accent)' }} />
          Trace Debugger
        </h3>
        <span className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            value={queryFilter}
            onChange={(e) => setQueryFilter(e.target.value)}
            placeholder="Filter queries…"
            className="pl-7 pr-2 py-1 rounded-md text-xs w-44"
            style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
        <button
          type="button"
          onClick={() => setAutoRefresh((v) => !v)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
          style={{
            background: autoRefresh ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'var(--color-bg-secondary)',
            color: autoRefresh ? 'var(--color-success)' : 'var(--color-text-secondary)',
            border: `1px solid ${autoRefresh ? 'var(--color-success)' : 'var(--color-border)'}`,
          }}
          title={autoRefresh ? `Auto-refreshing every ${POLL_MS / 1000}s` : 'Enable auto-refresh'}
        >
          <RefreshCw size={11} className={autoRefresh ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
          Live
        </button>
        <button
          type="button"
          onClick={() => void fetchTraces()}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          title="Refresh now"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Refresh
        </button>
        <button
          type="button"
          onClick={() => void copyJson()}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          title="Copy JSON to clipboard"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={exportJson}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          title="Download JSON"
        >
          <Download size={11} />
          Export
        </button>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-xs"
          style={{ background: 'color-mix(in srgb, var(--color-danger, #ef4444) 10%, transparent)', color: 'var(--color-danger, #ef4444)' }}
        >
          <AlertTriangle size={13} />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => void fetchTraces()}
            className="px-2 py-0.5 rounded text-[11px] font-medium"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Retry
          </button>
        </div>
      )}

      {stats && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          <span>{stats.count} trace{stats.count === 1 ? '' : 's'}</span>
          <span>avg {stats.avg.toFixed(0)}ms</span>
          <span>
            slowest: {(stats.slowest.query || 'untitled').slice(0, 40)} ({traceTotalMs(stats.slowest).toFixed(0)}ms)
          </span>
        </div>
      )}

      {loading && traces.length === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-tertiary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          {traces.length === 0
            ? 'No traces yet. Start making queries to see them here.'
            : 'No traces match the filter.'}
        </div>
      ) : (
        <div className="flex gap-4 h-[32rem]">
          {/* Trace list */}
          <div
            className="w-72 shrink-0 overflow-y-auto flex flex-col gap-1 pr-2"
            style={{ borderRight: '1px solid var(--color-border)' }}
          >
            {filtered.map((trace) => (
              <TraceCard
                key={trace.id}
                trace={trace}
                isActive={trace.id === selectedId}
                onClick={() => setSelectedId(trace.id)}
              />
            ))}
          </div>

          {/* Trace detail */}
          <div className="flex-1 overflow-y-auto min-w-0">
            {selected ? (
              <div className="flex flex-col gap-2">
                <div className="text-sm font-medium break-words" style={{ color: 'var(--color-text)' }}>
                  {selected.query || 'Untitled query'}
                </div>
                <div className="text-[11px] font-mono mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  id {selected.id} · {fmtTime(selected.created_at)} · {traceTotalMs(selected).toFixed(0)}ms total ·{' '}
                  {(selected.steps || []).length} steps
                </div>
                {(selected.steps || []).map((step, i) => (
                  <StepDetail key={i} step={step} index={i} maxMs={maxStepMs} />
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Select a trace to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
