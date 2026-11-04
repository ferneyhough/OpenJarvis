import { describe, expect, it } from 'vitest';

import { getOptionalPrograms, optionalPrograms } from './optional-programs';

describe('optional program catalog', () => {
  it('keeps advanced program entries behind the setup-only developer toggle', () => {
    const standardPrograms = getOptionalPrograms(false);

    expect(standardPrograms.length).toBeGreaterThan(0);
    expect(standardPrograms.every((program) => !program.advanced)).toBe(true);
    expect(getOptionalPrograms(true)).toEqual(optionalPrograms);
  });

  it('uses unique ids and hub settings ids', () => {
    expect(new Set(optionalPrograms.map((program) => program.id)).size).toBe(
      optionalPrograms.length,
    );
    expect(new Set(optionalPrograms.map((program) => program.hubId)).size).toBe(
      optionalPrograms.length,
    );
  });
});
