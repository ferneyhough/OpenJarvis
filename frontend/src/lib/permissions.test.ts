import { describe, expect, it, vi } from 'vitest';
import { resolvePermissions, type Capabilities } from './permissions';

const all: Capabilities = {
  allowShell: true,
  allowWeb: true,
  personalSourcesEnabled: true,
  steamContextEnabled: true,
};
const none = { allowShell: false, allowWeb: false, personalSourcesEnabled: false, steamContextEnabled: false };

describe('resolvePermissions', () => {
  it('allow keeps the ticked permissions without asking', () => {
    const ask = vi.fn();
    expect(resolvePermissions('allow', all, ask)).toEqual(all);
    expect(ask).not.toHaveBeenCalled();
  });

  it('sandbox strips everything without asking', () => {
    const ask = vi.fn();
    expect(resolvePermissions('sandbox', all, ask)).toEqual(none);
    expect(ask).not.toHaveBeenCalled();
  });

  it('manual asks and honours the answer', () => {
    expect(resolvePermissions('manual', all, () => true)).toEqual(all);
    expect(resolvePermissions('manual', all, () => false)).toEqual(none);
  });

  it('manual does not ask when nothing is ticked', () => {
    const ask = vi.fn();
    expect(resolvePermissions('manual', none, ask)).toEqual(none);
    expect(ask).not.toHaveBeenCalled();
  });
});
