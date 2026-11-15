'use client';

import { NumberRow, PageHeader, Section, SelectRow, TextRow, ToggleRow } from '@/components/kit';
import { GENDERS } from '@/lib/game-data';
import type { SectionProps } from '@/components/sections';

const INT_MAX = 2147483647;

const FLAGS = [
  { key: 'hasDoorStunnedBefore', label: 'Has stunned a door', hint: 'Skips the first door-stun hint.' },
  { key: 'hasBeenWoundedBefore', label: 'Has been wounded' },
  { key: 'hasBeenInfectedBefore', label: 'Has been infected' },
  { key: 'seenTravelFeeTip', label: 'Seen travel fee tip' },
  { key: 'seenDeckSkinTip', label: 'Seen data-deck skin tip' },
];

export function ProfileSection({ data, set }: SectionProps) {
  return (
    <>
      <PageHeader title="Profile" description="Character identity, rank progression and tutorial flags." />

      <Section title="Identity">
        <TextRow label="Character name" value={data.characterName} onChange={(value) => set('characterName', value)} />
        <TextRow label="Age" value={data.age} onChange={(value) => set('age', value)} />
        <SelectRow
          label="Body type"
          value={Number(data.gender ?? 0)}
          options={GENDERS.map((gender) => ({ value: gender.value, label: gender.label }))}
          onChange={(value) => set('gender', value)}
        />
        <ToggleRow
          label="Registered"
          hint="Whether the character creation screen has been completed."
          checked={data.registered}
          onChange={(value) => set('registered', value)}
        />
        <ToggleRow
          label="Character initialized"
          checked={data.characterInitialized}
          onChange={(value) => set('characterInitialized', value)}
        />
      </Section>

      <Section title="Progression">
        <NumberRow label="Rank level" value={data.rankLevel} min={1} max={INT_MAX} integer onChange={(value) => set('rankLevel', value)} />
        <NumberRow label="Rank XP" value={data.rankExp} min={0} step={10} onChange={(value) => set('rankExp', value)} />
        <NumberRow label="XP needed for next rank" value={data.xpNeeded} min={0} step={10} onChange={(value) => set('xpNeeded', value)} />
        <NumberRow label="Prestige" value={data.prestige} min={0} max={INT_MAX} integer onChange={(value) => set('prestige', value)} />
        <NumberRow
          label="Snake high score"
          hint="Data-deck minigame."
          value={data.snakeHighScore}
          min={0}
          max={INT_MAX}
          integer
          onChange={(value) => set('snakeHighScore', value)}
        />
      </Section>

      <Section title="Flags">
        {FLAGS.map((flag) => (
          <ToggleRow
            key={flag.key}
            label={flag.label}
            hint={flag.hint}
            checked={data[flag.key]}
            onChange={(value) => set(flag.key, value)}
          />
        ))}
      </Section>
    </>
  );
}
