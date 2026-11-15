'use client';

import type { ComponentType } from 'react';
import {
  BarChart3,
  Braces,
  Coins,
  Disc3,
  Gamepad2,
  Map,
  Monitor,
  MonitorSmartphone,
  MousePointer2,
  Package,
  Palette,
  PanelsTopLeft,
  Shirt,
  TrainFront,
  UserRound,
  Volume2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { JsonObject, JsonValue, SaveKind } from '@/lib/save';
import { ProfileSection } from './player/profile';
import { CosmeticsSection } from './player/cosmetics';
import { TapesSection } from './player/tapes';
import { DataDeckSection } from './player/datadeck';
import { EconomySection, RunSection, StatsSection } from './world/run';
import { DestinationsSection } from './world/destinations';
import { TrainItemsSection } from './world/train-items';
import { OtherFieldsSection } from './other-fields';
import { settingsSection } from './settings';

export interface SectionProps {
  data: JsonObject;
  kind: SaveKind;
  set: (key: string, value: JsonValue | undefined) => void;
}

export interface SectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType<SectionProps>;
}

const other: SectionDef = { id: 'other', label: 'Other fields', icon: Braces, component: OtherFieldsSection };

export const SECTIONS: Record<SaveKind, SectionDef[]> = {
  player: [
    { id: 'profile', label: 'Profile', icon: UserRound, component: ProfileSection },
    { id: 'cosmetics', label: 'Cosmetics', icon: Shirt, component: CosmeticsSection },
    { id: 'tapes', label: 'Tapes', icon: Disc3, component: TapesSection },
    { id: 'datadeck', label: 'Data deck', icon: MonitorSmartphone, component: DataDeckSection },
    other,
  ],
  world: [
    { id: 'run', label: 'Run', icon: TrainFront, component: RunSection },
    { id: 'economy', label: 'Economy', icon: Coins, component: EconomySection },
    { id: 'destinations', label: 'Destinations', icon: Map, component: DestinationsSection },
    { id: 'items', label: 'Train items', icon: Package, component: TrainItemsSection },
    { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsSection },
    other,
  ],
  json: [],
  settings: [
    { id: 'character', label: 'Character', icon: Palette, component: settingsSection('character') },
    { id: 'audio', label: 'Audio', icon: Volume2, component: settingsSection('audio') },
    { id: 'controls', label: 'Controls', icon: MousePointer2, component: settingsSection('controls') },
    { id: 'display', label: 'Display', icon: Monitor, component: settingsSection('display') },
    { id: 'interface', label: 'Interface', icon: PanelsTopLeft, component: settingsSection('interface') },
    { id: 'gameplay', label: 'Gameplay', icon: Gamepad2, component: settingsSection('gameplay') },
    other,
  ],
};

export function sectionsFor(kind: SaveKind) {
  return SECTIONS[kind];
}

export function resolveSection(kind: SaveKind, id: string | null) {
  const list = SECTIONS[kind];
  return list.find((section) => section.id === id) ?? list[0] ?? null;
}
