'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageHeader, Pill, Section } from '@/components/kit';
import { dataDeckSkinsFor } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import type { SectionProps } from '@/components/sections';

export function DataDeckSection({ data, set }: SectionProps) {
  const skins = dataDeckSkinsFor(data);
  const active = Number(data.dataDeckSkin ?? 0);
  const isUnlocked = (unlockKey: string | null) => unlockKey === null || Boolean(data[unlockKey]);
  const unlockedCount = skins.filter((skin) => isUnlocked(skin.unlockKey)).length;

  return (
    <>
      <PageHeader
        title="Data deck"
        description={`${unlockedCount} of ${skins.length} skins unlocked. Click a skin to equip it.`}
        actions={
          <Button
            variant="outline"
            onClick={() => skins.forEach((skin) => skin.unlockKey && set(skin.unlockKey, true))}
          >
            Unlock all
          </Button>
        }
      />
      <Section flush>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {skins.map((skin) => {
            const unlocked = isUnlocked(skin.unlockKey);
            const equipped = skin.value === active;
            return (
              <div
                key={skin.key}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors',
                  equipped && 'border-primary/50 ring-1 ring-primary/20',
                )}
              >
                <button
                  type="button"
                  disabled={skin.value >= 1000}
                  onClick={() => {
                    set('dataDeckSkin', skin.value);
                    if (skin.unlockKey && !unlocked) set(skin.unlockKey, true);
                  }}
                  className="flex items-center justify-between gap-2 text-left"
                >
                  <span className="text-[12px] font-medium">{skin.label}</span>
                  {equipped ? (
                    <Pill tone="accent">
                      <Check className="size-3" /> Equipped
                    </Pill>
                  ) : (
                    <span className="text-[11px] text-subtle-foreground">Equip</span>
                  )}
                </button>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{skin.unlockKey ? 'Unlocked' : 'Always available'}</span>
                  {skin.unlockKey ? (
                    <Switch
                      checked={unlocked}
                      onCheckedChange={(value) => set(skin.unlockKey!, value)}
                      aria-label={`${skin.label} unlocked`}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
