'use client';

import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameIcon, PageHeader, Pill, Row, Section, SelectInput } from '@/components/kit';
import { COSMETICS, PATCHES, PINS, type CosmeticDef } from '@/lib/game-data';
import { asStringArray } from '@/lib/save';
import { cn } from '@/lib/utils';
import type { SectionProps } from '@/components/sections';

const SLOTS = [
  { key: 'pin1', label: 'Pin 1', pool: PINS },
  { key: 'pin2', label: 'Pin 2', pool: PINS },
  { key: 'patch1', label: 'Patch 1', pool: PATCHES },
  { key: 'patch2', label: 'Patch 2', pool: PATCHES },
] as const;

const NONE = '__none__';

export function CosmeticsSection({ data, set }: SectionProps) {
  const unlocked = asStringArray(data.unlockedCosmetics);
  const unlockedSet = new Set(unlocked);
  const [query, setQuery] = useState('');
  const unknown = unlocked.filter((id) => !COSMETICS.some((cosmetic) => cosmetic.id === id));

  const filter = (list: CosmeticDef[]) => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.bundle?.includes(q)) : list;
  };

  const writeUnlocked = (next: string[]) => set('unlockedCosmetics', next);

  function toggle(id: string) {
    writeUnlocked(unlockedSet.has(id) ? unlocked.filter((entry) => entry !== id) : [...unlocked, id]);
  }

  function equip(slot: string, id: string) {
    if (id === NONE) {
      set(slot, undefined);
      return;
    }
    set(slot, id);
    if (!unlockedSet.has(id)) writeUnlocked([...unlocked, id]);
  }

  const counts = {
    pins: PINS.filter((c) => unlockedSet.has(c.id)).length,
    patches: PATCHES.filter((c) => unlockedSet.has(c.id)).length,
  };

  return (
    <>
      <PageHeader
        title="Cosmetics"
        description={`${unlocked.length} of ${COSMETICS.length} unlocked. Equipping a locked cosmetic unlocks it.`}
        actions={
          <>
            <Button variant="outline" onClick={() => writeUnlocked(COSMETICS.map((c) => c.id).concat(unknown))}>
              Unlock all
            </Button>
            <Button variant="ghost" onClick={() => writeUnlocked([])}>
              Lock all
            </Button>
          </>
        }
      />

      <Section title="Equipped">
        {SLOTS.map((slot) => {
          const current = typeof data[slot.key] === 'string' ? String(data[slot.key]) : NONE;
          return (
            <Row key={slot.key} label={slot.label}>
              <SelectInput
                value={current}
                onChange={(value) => equip(slot.key, String(value))}
                options={[
                  { value: NONE, label: 'None' },
                  ...slot.pool.map((cosmetic) => ({
                    value: cosmetic.id,
                    label: cosmetic.label,
                    hint: unlockedSet.has(cosmetic.id) ? undefined : 'Locked',
                    icon: <GameIcon src={cosmetic.icon} alt="" size={20} className="border-0 bg-transparent" />,
                  })),
                ]}
              />
            </Row>
          );
        })}
      </Section>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter cosmetics" className="pl-8" />
        </div>
      </div>

      <CosmeticGrid
        title="Pins"
        count={`${counts.pins}/${PINS.length}`}
        items={filter(PINS)}
        unlocked={unlockedSet}
        onToggle={toggle}
      />
      <CosmeticGrid
        title="Patches"
        count={`${counts.patches}/${PATCHES.length}`}
        items={filter(PATCHES)}
        unlocked={unlockedSet}
        onToggle={toggle}
      />

      {unknown.length > 0 ? (
        <Section title="Not in catalogue" description="Unlocked in this save, but not found in the extracted game data." flush>
          <div className="flex flex-wrap gap-1.5">
            {unknown.map((id) => (
              <button key={id} type="button" onClick={() => toggle(id)} className="group">
                <Pill className="group-hover:border-destructive/40 group-hover:text-destructive">{id} ×</Pill>
              </button>
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function CosmeticGrid({
  title,
  count,
  items,
  unlocked,
  onToggle,
}: {
  title: string;
  count: string;
  items: CosmeticDef[];
  unlocked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <Section title={title} actions={<span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>} flush>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No matches.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
          {items.map((cosmetic) => {
            const isUnlocked = unlocked.has(cosmetic.id);
            return (
              <button
                key={cosmetic.id}
                type="button"
                onClick={() => onToggle(cosmetic.id)}
                aria-pressed={isUnlocked}
                title={cosmetic.bundle ? `${cosmetic.id} · bundle "${cosmetic.bundle}"` : cosmetic.id}
                className={cn(
                  'group relative flex flex-col items-center gap-2 rounded-lg border bg-card px-2 pt-3 pb-2 text-center transition-colors',
                  'hover:border-border-strong hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
                  isUnlocked ? 'border-primary/40 bg-primary/[0.04]' : 'opacity-60 hover:opacity-100',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full border transition-colors',
                    isUnlocked ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong bg-card',
                  )}
                >
                  {isUnlocked ? <Check className="size-2.5" strokeWidth={3} /> : null}
                </span>
                <GameIcon src={cosmetic.icon} alt={cosmetic.label} size={56} className={cn('border-0 bg-transparent', !isUnlocked && 'grayscale')} />
                <span className="w-full truncate text-[11px] text-foreground">{cosmetic.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </Section>
  );
}
