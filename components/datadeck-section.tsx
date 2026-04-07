'use client';

import { Check, ChevronDown, Cpu } from 'lucide-react';
import { EditorCard } from './editor-card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DatadeckSkin } from '@/lib/types';

const DATADECK_VARIANTS = [
  { value: DatadeckSkin.Default, label: 'Default', unlockKey: null },
  { value: DatadeckSkin.Retro, label: 'Retro', unlockKey: 'dataDeckSkin_retro_unlocked' },
  { value: DatadeckSkin.Lost, label: 'Lost', unlockKey: 'dataDeckSkin_lost_unlocked' },
  { value: DatadeckSkin.Ecd, label: 'ECD', unlockKey: 'dataDeckSkin_ecd_unlocked' },
  { value: DatadeckSkin.Bling, label: 'Bling', unlockKey: 'dataDeckSkin_bling_unlocked' },
  { value: DatadeckSkin.Medical, label: 'Medical', unlockKey: 'dataDeckSkin_medical_unlocked' },
  { value: DatadeckSkin.Spore, label: 'Spore', unlockKey: 'dataDeckSkin_spore_unlocked' },
  { value: DatadeckSkin.Flesh, label: 'Flesh', unlockKey: 'dataDeckSkin_flesh_unlocked' },
  { value: DatadeckSkin.Casino, label: 'Casino', unlockKey: 'dataDeckSkin_casino_unlocked' },
  { value: DatadeckSkin.Fairyland, label: 'Fairyland', unlockKey: 'dataDeckSkin_fairyland_unlocked' },
  { value: DatadeckSkin.Corpdeck, label: 'Corpdeck', unlockKey: 'dataDeckSkin_corpdeck_unlocked' },
  { value: DatadeckSkin.Entitydeck, label: 'Entitydeck', unlockKey: 'dataDeckSkin_entitydeck_unlocked' },
] as const;

type DatadeckUnlockKey = Exclude<(typeof DATADECK_VARIANTS)[number]['unlockKey'], null>;

interface DatadeckSectionProps {
  activeDeck: DatadeckSkin;
  unlocks: Record<DatadeckUnlockKey, boolean>;
  onActiveDeckChange: (value: DatadeckSkin) => void;
  onToggleUnlock: (key: DatadeckUnlockKey, value: boolean) => void;
}

function isUnlocked(
  unlocks: Record<DatadeckUnlockKey, boolean>,
  unlockKey: DatadeckUnlockKey | null,
) {
  return unlockKey === null ? true : Boolean(unlocks[unlockKey]);
}

export function DatadeckSection({
  activeDeck,
  unlocks,
  onActiveDeckChange,
  onToggleUnlock,
}: DatadeckSectionProps) {
  const activeVariant =
    DATADECK_VARIANTS.find((variant) => variant.value === activeDeck) ?? DATADECK_VARIANTS[0];
  const unlockedVariants = DATADECK_VARIANTS.filter((variant) =>
    isUnlocked(unlocks, variant.unlockKey),
  );
  const unlockedCount = unlockedVariants.length;

  return (
    <EditorCard
      title="Datadeck"
      description="Select the active deck skin and manage unlocked variants."
      icon={<Cpu className="h-4 w-4" />}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-white/10 bg-black/20 px-3 shadow-none hover:bg-black/30"
            >
              Edit
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {unlockedCount} / {DATADECK_VARIANTS.length}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Unlocked Variants</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {DATADECK_VARIANTS.filter((variant) => variant.unlockKey !== null).map((variant) => {
              const enabled = isUnlocked(unlocks, variant.unlockKey);

              return (
                <DropdownMenuItem
                  key={`unlock-${variant.value}`}
                  onSelect={(event) => {
                    event.preventDefault();
                    onToggleUnlock(variant.unlockKey, !enabled);
                  }}
                  className={cn(
                    'cursor-pointer justify-between',
                    enabled ? 'text-emerald-400 focus:text-emerald-300' : 'text-red-400 focus:text-red-300',
                  )}
                >
                  <span>{variant.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                    {enabled ? 'On' : 'Off'}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="mb-4">
        <div>
          <p className="text-sm font-medium text-foreground">Active</p>
          <p className="mt-1 text-sm text-muted-foreground">Choose which deck skin is currently equipped.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DATADECK_VARIANTS.map((variant) => {
          const unlocked = isUnlocked(unlocks, variant.unlockKey);
          const selected = activeVariant.value === variant.value;

          return (
            <button
              key={variant.value}
              type="button"
              onClick={() => {
                if (unlocked) {
                  onActiveDeckChange(variant.value);
                }
              }}
              disabled={!unlocked}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all',
                selected
                  ? 'border-primary/28 bg-primary/14 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : unlocked
                    ? 'border-white/10 bg-[#14181f] text-foreground hover:border-white/14 hover:bg-[#171c24]'
                    : 'border-white/8 bg-black/10 text-muted-foreground/55',
                !unlocked ? 'cursor-not-allowed opacity-70' : '',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-sm border',
                  selected
                    ? 'border-primary/25 bg-primary/12 text-primary'
                    : unlocked
                      ? 'border-white/10 bg-black/15 text-muted-foreground'
                      : 'border-white/8 bg-black/10 text-muted-foreground/70',
                )}
              >
                {selected ? <Check className="h-3 w-3" /> : null}
              </span>
              {variant.label}
            </button>
          );
        })}
      </div>

    </EditorCard>
  );
}
