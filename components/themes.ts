import { Moon, Sun, Tv } from 'lucide-react';

export const THEMES = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'crt', label: 'CRT', icon: Tv },
] as const;

export function themeInfo(id: string | undefined) {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
