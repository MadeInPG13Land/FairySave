'use client';

import type { ReactNode } from 'react';
import { ChevronDown, PinIcon, Shield } from 'lucide-react';
import { EditorCard } from './editor-card';
import { PATCH_OPTIONS, PIN_OPTIONS } from './pin-patch-selector';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { assetPath } from '@/lib/asset-path';
import { cn } from '@/lib/utils';

interface CosmeticsSectionProps {
  unlockedCosmetics: string[];
  onChange: (nextValues: string[]) => void;
}

interface CosmeticDisplayItem {
  value: string;
  label: string;
  imageSrc?: string;
}

const pinMap = new Map(
  PIN_OPTIONS.filter((option) => option.value !== 'none').map((option) => [option.value, option]),
);

const patchMap = new Map(
  PATCH_OPTIONS.filter((option) => option.value !== 'none').map((option) => [option.value, option]),
);

function cosmeticLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectDisplayItems(source: string[], optionMap: Map<string, CosmeticDisplayItem>) {
  const items: CosmeticDisplayItem[] = [];
  const seen = new Set<string>();

  for (const value of source) {
    if (seen.has(value) || !optionMap.has(value)) {
      continue;
    }

    seen.add(value);
    const option = optionMap.get(value)!;
    items.push({
      value,
      label: option.label ?? cosmeticLabel(value),
      imageSrc: option.imageSrc,
    });
  }

  return items;
}

function CosmeticGroup({
  title,
  icon,
  allItems,
  items,
  emptyLabel,
  onToggle,
}: {
  title: string;
  icon: ReactNode;
  allItems: CosmeticDisplayItem[];
  items: CosmeticDisplayItem[];
  emptyLabel: string;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-white/10 bg-black/20 px-3 shadow-none hover:bg-black/30"
            >
              Edit
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {items.length} / {allItems.length}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allItems.map((item) => {
              const enabled = items.some((current) => current.value === item.value);

              return (
                <DropdownMenuItem
                  key={item.value}
                  onSelect={(event) => {
                    event.preventDefault();
                    onToggle(item.value);
                  }}
                  className={cn(
                    'cursor-pointer justify-between',
                    enabled ? 'text-emerald-400 focus:text-emerald-300' : 'text-red-400 focus:text-red-300',
                  )}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                    {enabled ? 'On' : 'Off'}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.value}
              className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/12 px-2.5 py-2"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/8 bg-black/15">
                {item.imageSrc ? (
                  <img
                    src={assetPath(item.imageSrc)}
                    alt={item.label}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    ?
                  </span>
                )}
              </div>
              <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/8 bg-black/10 px-3 py-4 text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export function CosmeticsSection({ unlockedCosmetics, onChange }: CosmeticsSectionProps) {
  const safeUnlockedCosmetics = unlockedCosmetics ?? [];
  const pins = collectDisplayItems(safeUnlockedCosmetics, pinMap);
  const patches = collectDisplayItems(safeUnlockedCosmetics, patchMap);
  const allPins = Array.from(pinMap.values());
  const allPatches = Array.from(patchMap.values());

  function toggleValue(value: string) {
    if (safeUnlockedCosmetics.includes(value)) {
      onChange(safeUnlockedCosmetics.filter((entry) => entry !== value));
      return;
    }

    onChange([...safeUnlockedCosmetics, value]);
  }

  return (
    <EditorCard
      title="Cosmetics"
      description="Unlocked wearable cosmetics from this save."
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CosmeticGroup
          title="Pins"
          icon={<PinIcon className="h-4 w-4" />}
          allItems={allPins}
          items={pins}
          emptyLabel="No unlocked pins found."
          onToggle={toggleValue}
        />
        <CosmeticGroup
          title="Patches"
          icon={<Shield className="h-4 w-4" />}
          allItems={allPatches}
          items={patches}
          emptyLabel="No unlocked patches found."
          onToggle={toggleValue}
        />
      </div>
    </EditorCard>
  );
}
