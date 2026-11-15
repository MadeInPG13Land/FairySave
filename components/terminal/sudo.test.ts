import { afterEach, describe, expect, it } from 'vitest';
import { INT32_MAX, INT32_MIN, clampNumber, useSudo } from './sudo';

afterEach(() => useSudo.getState().set(false));

describe('number limits', () => {
  const maxPlayers = { min: 1, max: 16, int: true };

  it('keep values in range normally', () => {
    expect(clampNumber(99, maxPlayers, false)).toBe(16);
    expect(clampNumber(-3, maxPlayers, false)).toBe(1);
    expect(clampNumber(4.7, maxPlayers, false)).toBe(4);
  });

  it('are lifted under sudo, but never past what the save format holds', () => {
    expect(clampNumber(99, maxPlayers, true)).toBe(99);
    expect(clampNumber(-3, maxPlayers, true)).toBe(-3);
    expect(clampNumber(1e12, maxPlayers, true)).toBe(INT32_MAX);
    expect(clampNumber(-1e12, maxPlayers, true)).toBe(INT32_MIN);
    // Decimal fields have no int32 cap.
    expect(clampNumber(1e12, { min: 0, max: 100 }, true)).toBe(1e12);
  });
});
