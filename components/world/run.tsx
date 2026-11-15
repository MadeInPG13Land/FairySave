'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, GameIcon, NumberInput, NumberRow, PageHeader, Row, Section, SelectInput, SelectRow, ToggleRow } from '@/components/kit';
import {
  CYCLE_DIFFICULTIES,
  GAME_MODES,
  LOBBY_PRIVACY,
  SALE_ITEMS,
  destinationsFor,
  findItem,
} from '@/lib/game-data';
import { asArray, isObject, type JsonObject } from '@/lib/save';
import type { SectionProps } from '@/components/sections';

const INT_MAX = 2147483647;

export function RunSection({ data, set }: SectionProps) {
  const destinations = destinationsFor(data);
  return (
    <>
      <PageHeader title="Run" description="Game mode, cycle progress and lobby settings for this world." />

      <Section title="Mode">
        <SelectRow
          label="Game mode"
          value={Number(data.gamemode ?? 0)}
          options={GAME_MODES.map((mode) => ({ value: mode.value, label: mode.label }))}
          onChange={(value) => set('gamemode', value)}
        />
        <SelectRow
          label="Cycle difficulty"
          value={Number(data.cycleDifficulty ?? 0)}
          options={CYCLE_DIFFICULTIES.map((difficulty) => ({ value: difficulty.value, label: difficulty.label }))}
          onChange={(value) => set('cycleDifficulty', value)}
        />
        <NumberRow label="Cycles completed" value={data.cyclesCompleted} min={0} integer onChange={(value) => set('cyclesCompleted', value)} />
        <NumberRow
          label="Cycles toward next difficulty"
          value={data.cyclesCompletedForDifficultyIncrease}
          min={0}
          integer
          onChange={(value) => set('cyclesCompletedForDifficultyIncrease', value)}
        />
      </Section>

      <Section title="Time">
        <NumberRow label="Day" value={data.days} min={0} integer onChange={(value) => set('days', value)} />
        <NumberRow label="Days remaining in cycle" value={data.daysRemaining} min={0} integer onChange={(value) => set('daysRemaining', value)} />
        <ToggleRow
          label="Debt due"
          hint="The cycle is in its debt repayment phase."
          checked={data.timeToPayDebt}
          onChange={(value) => set('timeToPayDebt', value)}
        />
      </Section>

      <Section title="Travel">
        <SelectRow
          label="Current destination"
          value={String(data.lastPOI ?? '')}
          options={destinations.map((destination) => ({
            value: destination.name,
            label: destination.name,
            hint: destination.subtitle,
          }))}
          onChange={(value) => set('lastPOI', value)}
        />
        <ToggleRow
          label="Pentagon unlocked"
          hint="Set once the crew has reached the final destination."
          checked={data.hasBeenToFinalDestination}
          onChange={(value) => set('hasBeenToFinalDestination', value)}
        />
      </Section>

      <Section title="Lobby">
        <NumberRow label="Max players" value={data.maxPlayers} min={1} max={16} integer onChange={(value) => set('maxPlayers', value)} />
        <SelectRow
          label="Privacy"
          value={Number(data.privacy ?? 0)}
          options={LOBBY_PRIVACY.map((entry) => ({ value: entry.value, label: entry.label }))}
          onChange={(value) => set('privacy', value)}
        />
      </Section>
    </>
  );
}

export function EconomySection({ data, set }: SectionProps) {
  const saleItems = asArray(data.saleItems).filter(isObject);
  const unusedSaleItems = SALE_ITEMS.filter(
    (item) => !saleItems.some((entry) => findItem(String(entry.itemName)) === item),
  );

  function updateSale(index: number, patch: JsonObject) {
    set(
      'saleItems',
      saleItems.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  }

  return (
    <>
      <PageHeader title="Economy" description="Credits, debt and the trader's current sales." />

      <Section title="Balance">
        <NumberRow label="Credits" value={data.credits} min={0} max={INT_MAX} step={100} integer onChange={(value) => set('credits', value)} />
        <NumberRow label="Scrap bin value" value={data.scrapBin} min={0} max={INT_MAX} integer onChange={(value) => set('scrapBin', value)} />
        <NumberRow
          label="Scrap sell rate"
          hint="Percentage of value paid when selling scrap."
          value={data.sellingForPercentage}
          min={0}
          max={100}
          suffix="%"
          onChange={(value) => set('sellingForPercentage', value)}
        />
      </Section>

      <Section title="Debt">
        <NumberRow label="Debt" value={data.debt} min={0} max={INT_MAX} step={100} integer onChange={(value) => set('debt', value)} />
        <NumberRow label="Paid this cycle" value={data.debtPayed} min={0} max={INT_MAX} step={100} integer onChange={(value) => set('debtPayed', value)} />
        <NumberRow
          label="Debt before last change"
          value={data.debtBeforeChanged}
          min={0}
          max={INT_MAX}
          integer
          onChange={(value) => set('debtBeforeChanged', value)}
        />
        <NumberRow
          label="Base debt for scaling"
          hint="Next cycle's debt is derived from this."
          value={data.baseDebtForScaling}
          min={0}
          max={INT_MAX}
          integer
          onChange={(value) => set('baseDebtForScaling', value)}
        />
      </Section>

      <Section
        title="Trader sales"
        description="Discounts shown at the trader for the current day."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={unusedSaleItems.length === 0}
            onClick={() =>
              set('saleItems', [...saleItems, { itemName: unusedSaleItems[0].shop!.name, salePercent: 20 }])
            }
          >
            <Plus /> Add sale
          </Button>
        }
        flush={saleItems.length === 0}
      >
        {saleItems.length === 0 ? (
          <EmptyState title="No items on sale" />
        ) : (
          saleItems.map((entry, index) => {
            const item = findItem(String(entry.itemName));
            return (
              <Row
                key={index}
                label={
                  <span className="flex items-center gap-2">
                    <GameIcon src={item?.icon} alt="" size={24} />
                    <span>{item?.label ?? String(entry.itemName)}</span>
                    {item?.shop ? <span className="text-[11px] text-muted-foreground">${item.shop.cost}</span> : null}
                  </span>
                }
              >
                <SelectInput
                  value={String(entry.itemName ?? '')}
                  className="sm:w-48"
                  options={SALE_ITEMS.map((option) => ({ value: option.shop!.name, label: option.label }))}
                  onChange={(value) => updateSale(index, { itemName: value })}
                />
                <NumberInput
                  value={entry.salePercent}
                  min={0}
                  max={100}
                  integer
                  suffix="%"
                  className="sm:w-24"
                  onChange={(value) => updateSale(index, { salePercent: value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove sale"
                  onClick={() => set('saleItems', saleItems.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </Button>
              </Row>
            );
          })
        )}
      </Section>
    </>
  );
}

export function StatsSection({ data, set }: SectionProps) {
  return (
    <>
      <PageHeader title="Stats" description="Lifetime totals shown on the end-of-run screen." />
      <Section>
        <NumberRow label="Deaths" value={data.totalDeaths} min={0} integer onChange={(value) => set('totalDeaths', value)} />
        <NumberRow label="Downs" value={data.totalDowns} min={0} integer onChange={(value) => set('totalDowns', value)} />
        <NumberRow
          label="Credits earned"
          value={data.totalCreditsEarned}
          min={0}
          max={INT_MAX}
          step={100}
          integer
          onChange={(value) => set('totalCreditsEarned', value)}
        />
        <NumberRow
          label="Credits spent"
          value={data.totalCreditsSpent}
          min={0}
          max={INT_MAX}
          step={100}
          integer
          onChange={(value) => set('totalCreditsSpent', value)}
        />
      </Section>
    </>
  );
}
