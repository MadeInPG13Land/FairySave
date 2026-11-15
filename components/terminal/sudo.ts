/**
 * `sudo`: lifts the editor's own min/max limits on number fields, for fun
 * (max players past 16, negative values…). Bare `sudo` lasts until `sudo off`,
 * `exit` or a reload; `sudo <command>` only lasts for that command. The save format's own limit stays: whole-number fields are
 * 32-bit, and anything past that would corrupt the file.
 */
import { create } from 'zustand';

export const INT32_MIN = -2147483648;
export const INT32_MAX = 2147483647;

export const useSudo = create<{
  on: boolean;
  /** On only for one `sudo <command>`: the full-screen view it opened turns it back off on exit. */
  once: boolean;
  set: (on: boolean, once?: boolean) => void;
}>((set) => ({
  on: false,
  once: false,
  set: (on, once = false) => set({ on, once: on && once }),
}));

/** The value a number field should take: within its limits normally, within int32 under sudo. */
export function clampNumber(value: number, limits: { min?: number; max?: number; int?: boolean }, sudo: boolean): number {
  let next = limits.int ? Math.trunc(value) : value;
  if (sudo) {
    if (limits.int) next = Math.min(INT32_MAX, Math.max(INT32_MIN, next));
    return next;
  }
  if (limits.min !== undefined) next = Math.max(limits.min, next);
  if (limits.max !== undefined) next = Math.min(limits.max, next);
  return next;
}
