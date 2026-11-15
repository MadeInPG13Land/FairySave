'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assetPath } from '@/lib/asset-path';
import type { WorldModifier } from '@/lib/game-data';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

/** A page's header: its title and description, and any actions of its own. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-[12px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Render children without the bordered card (for custom grids). */
  flush?: boolean;
}) {
  return (
    <section className={cn('mb-8', className)}>
      {title || actions ? (
        <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[12px] font-medium text-foreground">{title}</h2> : null}
            {description ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      {flush ? children : <div className="divide-y divide-border rounded-lg border bg-card">{children}</div>}
    </section>
  );
}

export function Row({
  label,
  hint,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-6', className)}>
      <div className="min-w-0 sm:w-[42%] sm:shrink-0">
        <label htmlFor={htmlFor} className="block text-[12px] text-foreground">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-start gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-subtle-foreground">{icon}</div> : null}
      <p className="text-[12px] font-medium text-foreground">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-[11px] text-muted-foreground">{children}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
  id,
  integer,
}: {
  value: unknown;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  id?: string;
  integer?: boolean;
}) {
  const numeric = Number(value ?? 0);
  const [text, setText] = useState(String(Number.isFinite(numeric) ? numeric : 0));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(Number.isFinite(numeric) ? numeric : 0));
  }, [numeric, focused]);

  function commit(next: string) {
    setText(next);
    if (next.trim() === '' || next === '-') return;
    let parsed = Number(next);
    if (!Number.isFinite(parsed)) return;
    if (integer) parsed = Math.trunc(parsed);
    if (min !== undefined) parsed = Math.max(min, parsed);
    if (max !== undefined) parsed = Math.min(max, parsed);
    onChange(parsed);
  }

  return (
    <div className={cn('relative w-full sm:w-44', className)}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(String(numeric));
        }}
        onChange={(event) => commit(event.target.value)}
        className={cn('text-right font-mono tabular-nums', suffix && 'pr-7')}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-subtle-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  id,
}: {
  value: unknown;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <Input
      id={id}
      value={String(value ?? '')}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn('w-full sm:w-64', className)}
    />
  );
}

export interface Option<T extends string | number = string | number> {
  value: T;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

export function SelectInput<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className,
  id,
}: {
  value: T | null | undefined;
  options: Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const current = value === null || value === undefined ? undefined : String(value);
  const known = options.some((option) => String(option.value) === current);
  const allOptions: Option<T>[] =
    current !== undefined && current !== '' && !known
      ? [...options, { value: value as T, label: `${current} (unknown)` }]
      : options;

  return (
    <Select
      value={current}
      onValueChange={(next) => {
        const match = allOptions.find((option) => String(option.value) === next);
        if (match) onChange(match.value);
      }}
    >
      <SelectTrigger id={id} className={cn('w-full sm:w-64', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {allOptions.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)} hint={option.hint}>
            {option.icon}
            <span className="truncate">{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* Row shorthands --------------------------------------------------------- */

export function NumberRow({
  label,
  hint,
  ...props
}: { label: ReactNode; hint?: ReactNode } & Parameters<typeof NumberInput>[0]) {
  const id = useId();
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <NumberInput id={id} {...props} />
    </Row>
  );
}

export function TextRow({ label, hint, ...props }: { label: ReactNode; hint?: ReactNode } & Parameters<typeof TextInput>[0]) {
  const id = useId();
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <TextInput id={id} {...props} />
    </Row>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: unknown;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <Switch id={id} checked={Boolean(checked)} onCheckedChange={onChange} />
    </Row>
  );
}

export function SelectRow<T extends string | number>({
  label,
  hint,
  ...props
}: { label: ReactNode; hint?: ReactNode } & Parameters<typeof SelectInput<T>>[0]) {
  const id = useId();
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <SelectInput id={id} {...props} />
    </Row>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                       */
/* -------------------------------------------------------------------------- */

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';
  className?: string;
}) {
  const tones = {
    neutral: 'border-border bg-muted text-muted-foreground',
    positive: 'border-positive/25 bg-positive/10 text-positive',
    negative: 'border-destructive/25 bg-destructive/10 text-destructive',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    accent: 'border-primary/25 bg-primary/10 text-primary',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ModifierDot({ modifier }: { modifier: WorldModifier | undefined }) {
  const tone = modifier?.tone ?? 'neutral';
  return (
    <span
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        modifier?.value === 0 && 'bg-subtle-foreground/50',
        modifier?.value !== 0 && tone === 'neutral' && 'bg-warning',
        tone === 'positive' && 'bg-positive',
        tone === 'negative' && 'bg-destructive',
      )}
    />
  );
}

export function GameIcon({
  src,
  alt,
  size = 28,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
}) {
  // Item sprites are white silhouettes; flip them on light backgrounds.
  const silhouette = Boolean(src?.startsWith('/game/items/'));
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-surface', className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetPath(src)} alt={alt} className={cn('size-full object-contain p-0.5', silhouette && 'invert dark:invert-0')} loading="lazy" draggable={false} />
      ) : (
        <span className="text-[9px] font-medium text-subtle-foreground">?</span>
      )}
    </span>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border bg-surface px-1 font-sans text-[9px] font-medium text-muted-foreground', className)}>
      {children}
    </kbd>
  );
}
