'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: ReactNode }) {
  // CRT (the terminal) is the default for the vibe; the intro says clearly how to switch to the regular editor.
  return (
    <ThemeProvider attribute="class" defaultTheme="crt" themes={['dark', 'light', 'crt']} disableTransitionOnChange>
      <TooltipProvider delayDuration={400}>
        {children}
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
