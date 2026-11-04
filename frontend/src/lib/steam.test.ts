import { describe, expect, it } from 'vitest';
import { formatSteamContext, type SteamLibrary } from './steam';

const library: SteamLibrary = {
  supported: true,
  installed: true,
  apiConfigured: true,
  games: [
    { appId: 10, name: 'Counter-Strike', playtimeHours: 120.04, installed: true },
    { appId: 20, name: 'Portal', playtimeHours: 9.56, installed: false },
  ],
  nowPlaying: { appId: 30, name: 'Half-Life' },
  apiError: null,
};

describe('Steam context', () => {
  it('includes current game and a bounded playtime-sorted library', () => {
    const context = formatSteamContext(library);
    expect(context).toContain('"nowPlaying":{"appId":30,"name":"Half-Life"}');
    expect(context).toContain('"playtimeHours":120');
    expect(context).toContain('"name":"Portal"');
  });

  it('limits model context to 20 games', () => {
    const context = formatSteamContext({
      ...library,
      games: Array.from({ length: 25 }, (_, index) => ({
        appId: index,
        name: `Game ${index}`,
        playtimeHours: index,
        installed: false,
      })),
    });
    expect(context).not.toBeNull();
    expect(JSON.parse(context!.split('\n')[1]).games).toHaveLength(20);
    expect(JSON.parse(context!.split('\n')[1]).games[0].name).toBe('Game 24');
  });

  it('returns no context when the profile and local library are empty', () => {
    expect(formatSteamContext({ ...library, games: [], nowPlaying: null })).toBeNull();
  });
});
