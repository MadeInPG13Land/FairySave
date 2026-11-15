'use client';

import { SlidersHorizontal } from 'lucide-react';
import { EmptyState, NumberRow, PageHeader, Section, SelectRow, TextRow, ToggleRow } from '@/components/kit';
import { SETTING_GROUPS, settingsIn, type SettingDef, type SettingGroup } from '@/lib/settings';
import type { SectionProps } from '@/components/sections';

/** One group of the game's settings (from a .reg export), as a page. */
export function settingsSection(group: SettingGroup) {
  const meta = SETTING_GROUPS.find((g) => g.id === group)!;
  function SettingsSection({ data, set }: SectionProps) {
    const list = settingsIn(group, data);
    return (
      <>
        <PageHeader title={meta.label} description="Saving downloads a .reg file. Close the game, then double-click it to apply." />
        {list.length === 0 ? (
          <EmptyState icon={<SlidersHorizontal className="size-5" />} title="Not in this export">
            The game only stores a setting once you change it in game.
          </EmptyState>
        ) : (
          <Section>
            {list.map((setting) => (
              <SettingRow key={setting.key} setting={setting} value={data[setting.key]} set={(value) => set(setting.key, value)} />
            ))}
          </Section>
        )}
      </>
    );
  }
  SettingsSection.displayName = `SettingsSection(${group})`;
  return SettingsSection;
}

const capitalise = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);

function SettingRow({ setting, value, set }: { setting: SettingDef; value: unknown; set: (value: number | string) => void }) {
  const label = capitalise(setting.label);
  switch (setting.kind) {
    case 'bool':
      return <ToggleRow label={label} checked={Number(value) !== 0} onChange={(on) => set(on ? 1 : 0)} />;
    case 'enum':
      return <SelectRow label={label} value={Number(value)} options={setting.options} onChange={(next) => set(Number(next))} />;
    case 'percent': {
      // Stored 0..1; shown as a percentage, rounded. Retyping the shown number keeps the exact stored one.
      const shown = Math.round(Number(value) * 1000) / 10;
      return (
        <NumberRow
          label={label}
          value={shown}
          min={0}
          max={setting.max * 100}
          suffix="%"
          onChange={(percent) => {
            if (percent !== shown) set(percent / 100);
          }}
        />
      );
    }
    case 'number':
      return (
        <NumberRow
          label={label}
          value={value}
          min={setting.min}
          max={setting.max}
          integer={setting.int}
          step={setting.int ? 1 : (setting.max - setting.min) / 100}
          onChange={set}
        />
      );
    case 'text':
      return <TextRow label={label} value={String(value ?? '')} onChange={set} />;
  }
}
