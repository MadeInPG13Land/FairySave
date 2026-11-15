'use client';

/**
 * Icons in the terminal: Lucide (the same set as the regular editor), drawn at the
 * text's size and sat on its baseline so they line up with the words around them.
 * Unicode symbols like ✕ fall back to another font and sit off the line.
 */
import type { LucideIcon } from 'lucide-react';

export function TermIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="term-icon" strokeWidth={1.75} aria-hidden />;
}
