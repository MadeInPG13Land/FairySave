'use client';

import { Button } from '@/components/ui/button';
import { ModifierDot, NumberInput, PageHeader, Pill, Section, SelectInput } from '@/components/kit';
import { WORLD_MODIFIERS, destinationKeys, destinationsFor, findModifier } from '@/lib/game-data';
import type { SectionProps } from '@/components/sections';

const BLOCK_ALL = 1;

const modifierOptions = WORLD_MODIFIERS.map((modifier) => ({
  value: modifier.value,
  label: modifier.label,
  hint: modifier.lootMultiplier ? `×${modifier.lootMultiplier}` : undefined,
  icon: <ModifierDot modifier={modifier} />,
}));

export function DestinationsSection({ data, set }: SectionProps) {
  const destinations = destinationsFor(data);
  const current = String(data.lastPOI ?? '');

  function setAll(kind: 'loot' | 'modifiers') {
    for (const destination of destinations) {
      const keys = destinationKeys(destination.name);
      if (kind === 'loot') set(keys.loot, 100);
      else {
        set(keys.modifier, 0);
        set(keys.effective, 0);
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Destinations"
        description="Loot left at each stop and the modifier rolled for it. “Shown” is what the travel screen displays; “Actual” is what applies on arrival."
        actions={
          <>
            <Button variant="outline" onClick={() => setAll('loot')}>
              Refill loot
            </Button>
            <Button variant="ghost" onClick={() => setAll('modifiers')}>
              Clear modifiers
            </Button>
          </>
        }
      />

      <Section flush>
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_96px_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b bg-surface px-4 py-2 text-[10px] font-medium text-muted-foreground md:grid">
            <span>Destination</span>
            <span className="text-right">Loot</span>
            <span>Shown modifier</span>
            <span>Actual modifier</span>
          </div>
          <div className="divide-y">
            {destinations.map((destination) => {
              const keys = destinationKeys(destination.name);
              const blocked = (destination.modifierAllowance & BLOCK_ALL) === BLOCK_ALL;
              const shown = findModifier(data[keys.modifier]);
              const actual = findModifier(data[keys.effective]);
              const hasKeys = keys.loot in data || keys.modifier in data;
              return (
                <div
                  key={destination.name}
                  className="grid grid-cols-1 items-center gap-2 px-4 py-2.5 md:grid-cols-[minmax(0,1.4fr)_96px_minmax(0,1fr)_minmax(0,1fr)] md:gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-foreground">{destination.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {destination.subtitle || '—'}
                        {destination.travelFee ? ` · $${destination.travelFee.toLocaleString()}` : ''}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 gap-1 md:ml-0">
                      {current === destination.name ? <Pill tone="accent">Current</Pill> : null}
                      {destination.discovered ? <Pill tone="warning">New</Pill> : null}
                      {!hasKeys ? <Pill>Not in save</Pill> : null}
                    </div>
                  </div>
                  <NumberInput
                    value={data[keys.loot] ?? 100}
                    min={0}
                    max={100}
                    integer
                    suffix="%"
                    className="md:w-full"
                    onChange={(value) => set(keys.loot, value)}
                  />
                  {blocked ? (
                    <p className="text-[11px] text-muted-foreground md:col-span-2">Modifiers never roll here.</p>
                  ) : (
                    <>
                      <SelectInput
                        value={shown?.value ?? Number(data[keys.modifier] ?? 0)}
                        options={modifierOptions}
                        className="sm:w-full"
                        onChange={(value) => set(keys.modifier, value)}
                      />
                      <SelectInput
                        value={actual?.value ?? Number(data[keys.effective] ?? 0)}
                        options={modifierOptions}
                        className="sm:w-full"
                        onChange={(value) => set(keys.effective, value)}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </>
  );
}
