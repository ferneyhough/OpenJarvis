import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markAnalyticsChoiceSeen } from './analytics-invitation';

const seenKey = 'openjarvis-analytics-choice-seen';
let stored: Map<string, string>;

beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

const invitation = (sharingModalSeen: boolean) => ({
  ready: false,
  sharingModalSeen,
  markSharingModalSeen: vi.fn(),
});

describe('analytics invitation on launch', () => {
  it('does not mark the choice seen while setup is incomplete', () => {
    const request = invitation(false);
    markAnalyticsChoiceSeen(request);
    expect(request.markSharingModalSeen).not.toHaveBeenCalled();
    expect(stored.has(seenKey)).toBe(false);
  });

  it('suppresses the giveaway and analytics dialog for a new user', () => {
    const request = invitation(false);
    markAnalyticsChoiceSeen(request);
    markAnalyticsChoiceSeen({ ...request, ready: true });
    expect(request.markSharingModalSeen).toHaveBeenCalledOnce();
    expect(stored.get(seenKey)).toBe('true');
  });

  it('does not show the dialog or change the seen state for existing users', () => {
    const request = invitation(true);
    markAnalyticsChoiceSeen({ ...request, ready: true });
    expect(request.markSharingModalSeen).not.toHaveBeenCalled();
    expect(stored.get(seenKey)).toBe('true');
  });
});
