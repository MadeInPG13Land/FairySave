'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EditorCardProps {
  title: string;
  icon?: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function EditorCard({ title, icon, description, actions, children, className }: EditorCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-lg overflow-hidden",
      className
    )}>
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          {icon && <span className="mt-0.5 text-primary">{icon}</span>}
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
