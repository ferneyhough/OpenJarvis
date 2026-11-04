import { toast } from 'sonner';
import type { MusicAction } from './music-commands';
import { useMusicStore } from './music';

/** Execute a parsed spoken/typed music command against the shared player. */
export function runMusicAction(action: MusicAction): void {
  const m = useMusicStore.getState();
  switch (action.type) {
    case 'play':
      m.openPlayer();
      m.play();
      break;
    case 'pause':
      m.pause();
      break;
    case 'stop':
      m.stop();
      break;
    case 'next':
      m.next();
      break;
    case 'previous':
      m.previous();
      break;
    case 'shuffle':
      m.setShuffle(action.on);
      toast.info(`Shuffle ${useMusicStore.getState().shuffle ? 'on' : 'off'}`);
      break;
    case 'repeat':
      m.setRepeat(action.mode);
      toast.info(`Repeat: ${useMusicStore.getState().repeat}`);
      break;
    case 'volume': {
      const level = action.level ?? m.volume + (action.delta ?? 0);
      m.setVolume(level);
      toast.info(`Volume ${Math.round(useMusicStore.getState().volume * 100)}%`);
      break;
    }
    case 'open-player':
      m.openPlayer();
      break;
    case 'close-player':
      m.closePlayer();
      break;
    case 'playlist':
      m.openPlayer();
      if (!m.playPlaylistByName(action.name)) toast.error(`No playlist named “${action.name}”.`);
      break;
    default:
      break;
  }
}
