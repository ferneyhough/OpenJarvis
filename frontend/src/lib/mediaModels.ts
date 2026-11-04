import { toast } from 'sonner';
import { downloadMediaModel, fetchMediaModelStatus } from './api';
import { useAppStore } from './store';
import { useTtsStore } from './tts';

export type MediaKind = 'image' | 'video';

const SIZE_HINT: Record<MediaKind, string> = { image: '2 gigabytes', video: '3 gigabytes' };

function announce(kind: MediaKind, text: string): void {
  const voiceId = useAppStore.getState().settings.voiceId;
  void useTtsStore.getState().speak(`media-model-${kind}`, text, voiceId);
}

/**
 * Download the local model for `kind` (if missing) and tell the user out loud
 * when the download starts and finishes. Resolves true once the model is ready.
 */
export async function ensureLocalMediaModel(kind: MediaKind): Promise<boolean> {
  const status = (await fetchMediaModelStatus())[kind];
  if (status.ready) return true;

  announce(
    kind,
    `Downloading the local ${kind} generation model now. It is about ${SIZE_HINT[kind]} and I will tell you when it is ready.`,
  );
  toast.info(`Downloading local ${kind} model (~${SIZE_HINT[kind]})…`);
  await downloadMediaModel(kind);

  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = (await fetchMediaModelStatus())[kind];
    if (s.status === 'error') {
      announce(kind, `The ${kind} model download failed.`);
      toast.error(`${kind} model download failed: ${s.error}`);
      return false;
    }
    if (s.ready) {
      announce(kind, `The ${kind} generation model is ready.`);
      toast.success(`Local ${kind} model ready`);
      return true;
    }
  }
}
