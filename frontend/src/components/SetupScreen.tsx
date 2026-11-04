import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, Cpu, Server, Database } from 'lucide-react';
import {
  getSetupStatus,
  fetchModels,
  fetchRecommendedModel,
  resetInferenceSource,
  type SetupStatus,
} from '../lib/api';
import { useAppStore } from '../lib/store';
import { getOptionalPrograms } from '../lib/optional-programs';
import { isEmbedOnlyModel } from '../lib/model-capabilities';
import { InferenceRecoveryButton, InferenceSourceSetup } from './InferenceSourceSetup';
import { DataSourcesSection } from '../pages/DataSourcesPage';
import { AppIntegrationsSettings } from '../pages/SettingsPage';

const STEPS = [
  { key: 'ollama_ready', label: 'Inference Engine', icon: Cpu, detail: 'Starting Ollama...' },
  { key: 'model_ready', label: 'AI Model', icon: Database, detail: 'Loading model...' },
  { key: 'server_ready', label: 'API Server', icon: Server, detail: 'Starting server...' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

function StepRow({
  icon: Icon,
  label,
  done,
  active,
  detail,
}: {
  icon: typeof Cpu;
  label: string;
  done: boolean;
  active: boolean;
  detail: string;
}) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-xl transition-all"
      style={{
        background: done
          ? 'var(--color-accent-subtle)'
          : active
            ? 'var(--color-surface)'
            : 'transparent',
        border: active ? '1px solid var(--color-border)' : '1px solid transparent',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: done ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
          color: done ? 'white' : 'var(--color-text-tertiary)',
        }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {label}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)', maxWidth: '280px' }}>
          {done ? 'Ready' : active ? detail : 'Waiting...'}
        </div>
      </div>
      <div className="shrink-0">
        {done ? (
          <CheckCircle2 size={18} style={{ color: 'var(--color-accent)' }} />
        ) : active ? (
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
        ) : (
          <div
            className="w-4 h-4 rounded-full"
            style={{ border: '2px solid var(--color-border)' }}
          />
        )}
      </div>
    </div>
  );
}

type FirstRunTab = 'accounts' | 'programs' | 'web-apps';

function FirstRunSetup({ onFinish }: { onFinish: () => void }) {
  const [activeTab, setActiveTab] = useState<FirstRunTab>('accounts');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installStates, setInstallStates] = useState<
    Record<string, { status: 'installed' | 'error'; message: string }>
  >({});
  const enabledApps = useAppStore((state) => state.settings.hubEnabledApps);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const programs = getOptionalPrograms(showAdvanced);
  const supportsWindowsProgramInstalls = /windows/i.test(
    `${navigator.userAgent} ${navigator.platform}`,
  );

  const installProgram = async (programId: string, hubId: string) => {
    setInstallingId(programId);
    setInstallStates((current) => {
      const next = { ...current };
      delete next[programId];
      return next;
    });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('install_optional_program', { programId });
      const selected = new Set(useAppStore.getState().settings.hubEnabledApps);
      selected.add(hubId);
      updateSettings({ hubEnabledApps: [...selected] });
      setInstallStates((current) => ({
        ...current,
        [programId]: { status: 'installed', message: 'Installed and added to the Hub.' },
      }));
    } catch (error) {
      setInstallStates((current) => ({
        ...current,
        [programId]: {
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        },
      }));
    } finally {
      setInstallingId(null);
    }
  };

  const setHubVisibility = (hubId: string, visible: boolean) => {
    const selected = new Set(useAppStore.getState().settings.hubEnabledApps);
    if (visible) selected.add(hubId);
    else selected.delete(hubId);
    updateSettings({ hubEnabledApps: [...selected] });
  };

  const tabs: Array<{ id: FirstRunTab; label: string }> = [
    { id: 'accounts', label: 'Connect accounts' },
    ...(supportsWindowsProgramInstalls
      ? [{ id: 'programs' as const, label: 'Install programs' }]
      : []),
    { id: 'web-apps', label: 'Web app links' },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-y-auto px-6 py-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="flex w-full max-w-5xl flex-col"
        style={{ height: 'calc(100vh - 48px)', maxHeight: 860, minHeight: 480 }}
      >
        <header className="mb-5">
          <div
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
          >
            <Cpu size={24} />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Set up OpenJarvis
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Connect only the accounts you choose, and install optional programs where available.
            You can skip anything and change these choices later.
          </p>
        </header>

        <div
          className="mb-4 flex shrink-0 gap-1 border-b"
          style={{ borderColor: 'var(--color-border)' }}
          role="tablist"
          aria-label="First-run setup"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-3 text-sm transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.id
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-xl border p-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {activeTab === 'accounts' && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                Supported account connections
              </h2>
              <p className="mb-5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Choose a source and complete its provider sign-in or credential flow here. OpenJarvis
                only accesses data through the connector you explicitly connect.
              </p>
              <DataSourcesSection />
            </>
          )}

          {activeTab === 'programs' && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                Optional Windows programs
              </h2>
              <p className="mb-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Each install is a separate action through the WinGet community source. Clicking
                Install accepts that package’s source and package agreements; review the vendor
                license first. Windows may show installer or approval prompts.
              </p>
              <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <input
                  type="checkbox"
                  aria-label="Enable Developer Mode for setup"
                  checked={showAdvanced}
                  onChange={(event) => setShowAdvanced(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block font-medium">Developer Mode for this setup only</span>
                  <span className="mt-1 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Reveals additional curated installers. Developer Mode will be off when the main
                    app opens.
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {programs.map((program) => {
                  const installState = installStates[program.id];
                  const isInstalling = installingId === program.id;
                  return (
                    <div
                      key={program.id}
                      className="rounded-lg border p-4"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                            {program.name}
                          </h3>
                          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {program.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={installingId !== null}
                          onClick={() => void installProgram(program.id, program.hubId)}
                          className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
                          style={{
                            background: 'var(--color-accent)',
                            color: 'var(--color-on-accent)',
                            opacity: installingId !== null && !isInstalling ? 0.55 : 1,
                          }}
                        >
                          {isInstalling ? 'Installing…' : installState?.status === 'installed' ? 'Installed' : 'Install'}
                        </button>
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Show ${program.name} in Hub`}
                          checked={enabledApps.includes(program.hubId)}
                          onChange={(event) => setHubVisibility(program.hubId, event.target.checked)}
                          className="h-4 w-4 accent-[var(--color-accent)]"
                        />
                        Show in Hub
                      </label>
                      {installState && (
                        <p
                          role={installState.status === 'error' ? 'alert' : 'status'}
                          className="mt-2 break-words text-xs"
                          style={{
                            color: installState.status === 'error'
                              ? 'var(--color-error)'
                              : 'var(--color-success)',
                          }}
                        >
                          {installState.message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'web-apps' && (
            <>
              <h2 className="mb-2 text-base font-semibold" style={{ color: 'var(--color-text)' }}>
                Web services and launch links
              </h2>
              <p className="mb-5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                These links open the provider’s website. Signing in there does not connect private
                account data to OpenJarvis; use the supported account connectors in the first tab
                for that.
              </p>
              <AppIntegrationsSettings />
            </>
          )}
        </div>

        <footer className="mt-4 flex shrink-0 items-center justify-between gap-4">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Developer Mode starts off in the main app.
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onFinish}
              className="rounded-lg px-4 py-2.5 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={onFinish}
              className="rounded-lg px-5 py-2.5 text-sm font-medium"
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              Finish setup
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function SetupScreen({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [setupInitiated, setSetupInitiated] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [firstRunSetupPending, setFirstRunSetupPending] = useState(
    () => localStorage.getItem('oj-desktop-setup-completed') !== '1'
      && localStorage.getItem('oj-setup-completed') !== '1',
  );
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const handedOffRef = useRef(false);

  const handoffToApp = useCallback(async () => {
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    // Pre-select a model BEFORE handing off so the chat is usable on
    // first send. Without this, the main app's post-mount fetch can
    // lose a race to a fast first message and Ollama 400s.
    try {
      const [models, rec] = await Promise.all([
        fetchModels().catch(() => []),
        fetchRecommendedModel().catch(() => ({ model: '', reason: '' })),
      ]);
      const store = useAppStore.getState();
      const hadSelection = !!store.selectedModel;
      store.setModels(models);
      store.setModelsLoading(false);
      const chatModels = models.filter((m) => !isEmbedOnlyModel(m.id));
      const recommended = rec.model && chatModels.some((m) => m.id === rec.model)
        ? rec.model
        : chatModels[0]?.id || '';
      if (recommended && !hadSelection) {
        store.setSelectedModel(recommended);
      }
    } catch {
      // Non-fatal: store.setModels auto-selects on later fetch, and
      // the InputArea guards the empty-model case with a toast.
    }
    setTimeout(() => onReady(), 600);
  }, [onReady]);

  const poll = useCallback(async () => {
    const s = await getSetupStatus();
    if (s) setStatus(s);
    setStatusChecked(true);
    if (s?.phase === 'ready' && !handedOffRef.current) {
      if (firstRunSetupPending) {
        setShowFirstRunSetup(true);
        return;
      }
      await handoffToApp();
    }
  }, [firstRunSetupPending, handoffToApp]);

  const finishFirstRunSetup = useCallback(() => {
    localStorage.setItem('oj-desktop-setup-completed', '1');
    setFirstRunSetupPending(false);
    setShowFirstRunSetup(false);
    void handoffToApp();
  }, [handoffToApp]);

  const changeInferenceSource = useCallback(async () => {
    setRecovering(true);
    setRecoveryError('');
    try {
      await resetInferenceSource();
      handedOffRef.current = false;
      setSetupInitiated(false);
      setStatus(null);
      await poll();
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : String(error));
    } finally {
      setRecovering(false);
    }
  }, [poll]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 800);
    return () => clearInterval(interval);
  }, [poll]);

  if (statusChecked && status?.requires_source && !setupInitiated) {
    return (
      <InferenceSourceSetup
        onStarted={() => {
          setSetupInitiated(true);
          void poll();
        }}
      />
    );
  }

  if (showFirstRunSetup && status?.phase === 'ready') {
    return <FirstRunSetup onFinish={finishFirstRunSetup} />;
  }

  const activeStep: StepKey | null =
    status && !status.ollama_ready
      ? 'ollama_ready'
      : status && !status.model_ready
        ? 'model_ready'
        : status && !status.server_ready
          ? 'server_ready'
          : null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}
          >
            <Cpu size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
            OpenJarvis
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {!statusChecked
              ? 'Checking your saved setup...'
              : status?.source === 'custom'
                ? 'Connecting to your AI server...'
                : 'Setting up your local AI...'}
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-2 mb-8">
          {(status?.source === 'custom'
            ? [
                { key: 'ollama_ready' as const, label: 'Inference Engine', icon: Cpu, detail: 'Connecting to your server...' },
                { key: 'model_ready' as const, label: 'Endpoint', icon: Database, detail: 'Checking endpoint...' },
                { key: 'server_ready' as const, label: 'API Server', icon: Server, detail: 'Starting server...' },
              ]
            : STEPS
          ).map((step) => (
            <StepRow
              key={step.key}
              icon={step.icon}
              label={step.label}
              done={status?.[step.key] ?? false}
              active={activeStep === step.key}
              detail={
                activeStep === step.key && status?.detail
                  ? status.detail
                  : step.detail
              }
            />
          ))}
        </div>

        {/* Error */}
        {status?.error && (
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
            style={{
              background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
              color: 'var(--color-error)',
            }}
          >
            <XCircle size={16} className="shrink-0 mt-0.5" />
            <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{status.error}</span>
          </div>
        )}

        {recoveryError && (
          <div
            role="alert"
            className="mt-3 px-4 py-3 rounded-xl text-sm"
            style={{ color: 'var(--color-error)' }}
          >
            {recoveryError}
          </div>
        )}

        {statusChecked && status && !status.requires_source && status.phase !== 'ready' && (
          <InferenceRecoveryButton
            recovering={recovering}
            onChange={() => void changeInferenceSource()}
          />
        )}

        {/* Progress bar */}
        {!status?.error && (
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--color-bg-tertiary)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: 'var(--color-accent)',
                width: `${
                  ((status?.ollama_ready ? 1 : 0) +
                    (status?.model_ready ? 1 : 0) +
                    (status?.server_ready ? 1 : 0)) *
                  33.33
                }%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
