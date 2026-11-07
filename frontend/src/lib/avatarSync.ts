// Avatar pop-up sync for the desktop (pywebview) host.
//
// Two jobs:
//  1. Speech sync — while TTS is speaking, broadcast the live voice level on
//     a same-origin BroadcastChannel. The small pop-up window
//     (/avatar-popup.html) listens and animates its jaw/eyes from it, so the
//     pop-up talks in sync with the main window.
//  2. Cover detection — when this window loses focus (another app in front)
//     or is hidden/minimised, ask the desktop host to show the pop-up at the
//     top of the screen, notification-style; when focus returns, hide it.
//     In a plain browser there is no pywebview host, so this is a no-op.

import { getTtsLevel, useTtsStore } from './tts';

type PopupHostApi = {
  show_avatar_popup?: () => Promise<unknown> | unknown;
  hide_avatar_popup?: () => Promise<unknown> | unknown;
};

function popupHostApi(): PopupHostApi | null {
  const w = window as unknown as { pywebview?: { api?: PopupHostApi } };
  return w.pywebview?.api ?? null;
}

let started = false;

export function initAvatarSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  // ---- 1. speech sync -----------------------------------------------------
  const channel =
    'BroadcastChannel' in window
      ? new BroadcastChannel('jarvis-avatar')
      : null;

  const post = (speaking: boolean) => {
    try {
      channel?.postMessage({
        type: 'avatar-tts',
        speaking,
        level: speaking ? getTtsLevel() : 0,
      });
    } catch {
      /* channel closed */
    }
  };

  let timer: number | null = null;
  const syncTimer = () => {
    const speaking = useTtsStore.getState().state === 'speaking';
    if (speaking && timer === null) {
      post(true);
      timer = window.setInterval(() => post(true), 50);
    } else if (!speaking && timer !== null) {
      window.clearInterval(timer);
      timer = null;
      post(false);
    }
  };
  useTtsStore.subscribe(syncTimer);
  syncTimer();

  // ---- 2. cover detection ---------------------------------------------------
  const callHost = (show: boolean) => {
    const api = popupHostApi();
    if (!api) return;
    try {
      void (show ? api.show_avatar_popup?.() : api.hide_avatar_popup?.());
    } catch {
      /* host unavailable */
    }
  };

  let showDelay: number | null = null;
  const cancelPendingShow = () => {
    if (showDelay !== null) {
      window.clearTimeout(showDelay);
      showDelay = null;
    }
  };
  // Debounced: a quick alt-tab through the window shouldn't flash the pop-up.
  const scheduleShow = () => {
    if (showDelay !== null) return;
    showDelay = window.setTimeout(() => {
      showDelay = null;
      callHost(true);
    }, 600);
  };
  const hideNow = () => {
    cancelPendingShow();
    callHost(false);
  };

  window.addEventListener('blur', scheduleShow);
  window.addEventListener('focus', hideNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelPendingShow();
      callHost(true); // minimised/hidden: no debounce needed
    } else {
      hideNow();
    }
  });
}
