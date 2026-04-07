'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Coins,
  Gauge,
  Globe,
  MapPin,
  Package,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { EditorCard } from './editor-card';
import { FormField } from './form-field';
import { getActiveTab } from '@/lib/editor-tab';
import { assetPath } from '@/lib/asset-path';
import { useEditorStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GameMode,
  Poi,
  PrivacyMode,
  WorldEditorTab,
  WorldModifier,
  type TrainItem,
  type VectorData,
  type WorldData,
} from '@/lib/types';
import type { ReactNode } from 'react';

const gamemodeOptions = [
  { value: GameMode.Endless, label: 'Endless' },
  { value: GameMode.Exploration, label: 'Exploration' },
  { value: GameMode.Nightmare, label: 'Nightmare' },
  { value: GameMode.Escape, label: 'Escape' },
];

const privacyOptions = [
  { value: PrivacyMode.Public, label: 'Public' },
  { value: PrivacyMode.FriendsOnly, label: 'Friends Only' },
  { value: PrivacyMode.Private, label: 'Private' },
];

const LOOT_FIELDS = [
  { key: 'MetroLootSaturation', label: 'Metro' },
  { key: 'Lost MetroLootSaturation', label: 'Lost Metro' },
  { key: 'HotelLootSaturation', label: 'Hotel' },
  { key: 'HospitalLootSaturation', label: 'Hospital' },
  { key: 'TunnelsLootSaturation', label: 'Tunnels' },
  { key: 'BunkerLootSaturation', label: 'Bunker' },
  { key: 'PlantationLootSaturation', label: 'Plantation' },
  { key: 'WarehouseLootSaturation', label: 'Warehouse' },
  { key: 'MineshaftLootSaturation', label: 'Mineshaft' },
  { key: 'PentagonLootSaturation', label: 'Pentagon' },
  { key: 'CasinoLootSaturation', label: 'Casino' },
  { key: 'HighriseLootSaturation', label: 'Highrise' },
] as const;

const MODIFIER_FIELDS = [
  { label: 'Metro', baseKey: 'WorldModifier_Metro', effectiveKey: 'EffectiveWorldModifier_Metro' },
  { label: 'Lost Metro', baseKey: 'WorldModifier_Lost Metro', effectiveKey: 'EffectiveWorldModifier_Lost Metro' },
  { label: 'Hotel', baseKey: 'WorldModifier_Hotel', effectiveKey: 'EffectiveWorldModifier_Hotel' },
  { label: 'Hospital', baseKey: 'WorldModifier_Hospital', effectiveKey: 'EffectiveWorldModifier_Hospital' },
  { label: 'Tunnels', baseKey: 'WorldModifier_Tunnels', effectiveKey: 'EffectiveWorldModifier_Tunnels' },
  { label: 'Bunker', baseKey: 'WorldModifier_Bunker', effectiveKey: 'EffectiveWorldModifier_Bunker' },
  { label: 'Plantation', baseKey: 'WorldModifier_Plantation', effectiveKey: 'EffectiveWorldModifier_Plantation' },
  { label: 'Warehouse', baseKey: 'WorldModifier_Warehouse', effectiveKey: 'EffectiveWorldModifier_Warehouse' },
  { label: 'Mineshaft', baseKey: 'WorldModifier_Mineshaft', effectiveKey: 'EffectiveWorldModifier_Mineshaft' },
  { label: 'Pentagon', baseKey: 'WorldModifier_Pentagon', effectiveKey: 'EffectiveWorldModifier_Pentagon' },
  { label: 'Casino', baseKey: 'WorldModifier_Casino', effectiveKey: 'EffectiveWorldModifier_Casino' },
  { label: 'Highrise', baseKey: 'WorldModifier_Highrise', effectiveKey: 'EffectiveWorldModifier_Highrise' },
] as const;

const worldModifierOptions = [
  { value: WorldModifier.None, label: 'None' },
  { value: WorldModifier.Blackout, label: 'Blackout' },
  { value: WorldModifier.Emp, label: 'EMP' },
  { value: WorldModifier.Dread, label: 'Dread' },
  { value: WorldModifier.Paranoia, label: 'Paranoia' },
  { value: WorldModifier.Minefield, label: 'Minefield' },
  { value: WorldModifier.Spores, label: 'Spores' },
  { value: WorldModifier.Whiteout, label: 'Whiteout' },
  { value: WorldModifier.Sunken, label: 'Sunken' },
  { value: WorldModifier.Error, label: 'Error' },
  { value: WorldModifier.Displaced, label: 'Displaced' },
  { value: WorldModifier.Surplus, label: 'Surplus' },
  { value: WorldModifier.Vigor, label: 'Vigor' },
  { value: WorldModifier.Shadowstep, label: 'Shadowstep' },
  { value: WorldModifier.Unlocked, label: 'Unlocked' },
] as const;

const poiOptions = [
  { value: Poi.Metro, label: 'Metro' },
  { value: Poi.LostMetro, label: 'Lost Metro' },
  { value: Poi.Hotel, label: 'Hotel' },
  { value: Poi.Hospital, label: 'Hospital' },
  { value: Poi.Tunnels, label: 'Tunnels' },
  { value: Poi.Bunker, label: 'Bunker' },
  { value: Poi.Plantation, label: 'Plantation' },
  { value: Poi.Warehouse, label: 'Warehouse' },
  { value: Poi.Mineshaft, label: 'Mineshaft' },
  { value: Poi.Pentagon, label: 'Pentagon' },
  { value: Poi.Casino, label: 'Casino' },
  { value: Poi.Highrise, label: 'Highrise' },
] as const;

const ITEM_OPTIONS = [
  { value: 'lantern', label: 'Lantern', itemDataName: 'Lantern', itemName: 'lantern', saleItemName: 'lantern' },
  { value: 'walkie-talkie', label: 'Walkie-Talkie', itemDataName: 'WalkieTalkie', itemName: 'walkie-talkie', saleItemName: 'walkietalkie' },
  { value: 'stunlight', label: 'Stunlight', itemDataName: 'StunLight', itemName: 'stunlight', saleItemName: 'stunlight' },
  { value: 'flashlight', label: 'Flashlight', itemDataName: 'Flashlight', itemName: 'flashlight', saleItemName: 'flashlight' },
  { value: 'defib', label: 'Defib', itemDataName: 'Defib', itemName: 'defib', saleItemName: 'defib' },
  { value: 'adrenaline-shot', label: 'Adrenaline Shot', itemDataName: 'Adrenaline Shot', itemName: 'adrenaline', saleItemName: 'adrenaline' },
  { value: 'boltcutters', label: 'Boltcutters', itemDataName: 'Buoltcutters', itemName: 'boltcutters', saleItemName: 'boltcutters' },
  { value: 'medkit', label: 'Medkit', itemDataName: 'FirstAidKit', itemName: 'medkit', saleItemName: 'medkit' },
  { value: 'environment-marker', label: 'Environment Marker', itemDataName: 'SprayMark', itemName: 'environment marker', saleItemName: 'spraymark' },
  { value: 'firecrackers', label: 'Firecrackers', itemDataName: 'Firecrackers', itemName: 'firecrackers', saleItemName: 'firecrackers' },
  { value: 'glowstick', label: 'Glowstick', itemDataName: 'Glowstick', itemName: 'glowstick', saleItemName: 'glowstick' },
  { value: 'gasmask', label: 'Gasmask', itemDataName: 'Gasmask', itemName: 'gasmask', saleItemName: 'gasmask' },
  { value: 'pickaxe', label: 'Pickaxe', itemDataName: 'Pickaxe', itemName: 'pickaxe', saleItemName: 'pickaxe' },
  { value: 'soda', label: 'Soda Can', itemDataName: 'Noisemaker (soda can)', itemName: 'soda', saleItemName: 'soda' },
  { value: 'rebreather', label: 'Rebreather', itemDataName: 'Rebreather', itemName: 'rebreather', saleItemName: 'rebreather' },
  { value: 'dynamite', label: 'Dynamite', itemDataName: 'Dynamite', itemName: 'dynamite', saleItemName: 'dynamite' },
  { value: 'shotgun', label: 'Shotgun', itemDataName: 'Shotgun', itemName: 'shotgun', saleItemName: 'shotgun' },
  { value: 'sledgehammer', label: 'Sledgehammer', itemDataName: 'SledgeHammer', itemName: 'sledgehammer', saleItemName: 'sledgehammer' },
] as const;

const ITEM_ICON_MAP: Record<string, string> = {
  lantern: '/item-icons/lantern_sprite.png',
  stunlight: '/item-icons/stunlight.png',
  flashlight: '/item-icons/flashlight_sprite.png',
  defib: '/item-icons/defib.png',
  'adrenaline shot': '/item-icons/adreno.png',
  adrenaline: '/item-icons/adreno.png',
  boltcutters: '/item-icons/boltcutters_sprite.png',
  buoltcutters: '/item-icons/boltcutters_sprite.png',
  medkit: '/item-icons/medkit_sprite.png',
  firstaidkit: '/item-icons/medkit_sprite.png',
  'first aid kit': '/item-icons/medkit_sprite.png',
  spraymark: '/item-icons/spraymarker.png',
  'environment marker': '/item-icons/spraymarker.png',
  walkietalkie: '/item-icons/walkietalkie_sprite.png',
  'walkie-talkie': '/item-icons/walkietalkie_sprite.png',
  firecrackers: '/item-icons/firecrackers.png',
  glowstick: '/item-icons/glowstick.png',
  gasmask: '/item-icons/gasmask.png',
  pickaxe: '/item-icons/pickaxe.png',
  soda: '/item-icons/soda_sprite.png',
  'soda can': '/item-icons/soda_sprite.png',
  'noisemaker (soda can)': '/item-icons/soda_sprite.png',
  rebreather: '/item-icons/gasmask.png',
  dynamite: '/item-icons/dynamite.png',
  shotgun: '/item-icons/gun.png',
  sledgehammer: '/item-icons/sledgehammer.png',
};

const ITEM_LABEL_MAP: Record<string, string> = {
  lantern: 'Lantern',
  walkietalkie: 'Walkie-Talkie',
  'walkie-talkie': 'Walkie-Talkie',
  stunlight: 'Stunlight',
  flashlight: 'Flashlight',
  defib: 'Defib',
  defibrillator: 'Defibrillator',
  'adrenaline shot': 'Adrenaline Shot',
  adrenaline: 'Adrenaline Shot',
  boltcutters: 'Boltcutters',
  buoltcutters: 'Boltcutters',
  medkit: 'Medkit',
  firstaidkit: 'First Aid Kit',
  'first aid kit': 'First Aid Kit',
  spraymark: 'Environment Marker',
  'environment marker': 'Environment Marker',
  firecrackers: 'Firecrackers',
  glowstick: 'Glowstick',
  gasmask: 'Gasmask',
  pickaxe: 'Pickaxe',
  soda: 'Soda Can',
  'soda can': 'Soda Can',
  'noisemaker (soda can)': 'Soda Can',
  rebreather: 'Rebreather',
  dynamite: 'Dynamite',
  shotgun: 'Shotgun',
  sledgehammer: 'Sledgehammer',
};

const ITEM_DESCRIPTION_MAP: Record<string, string> = {
  lantern: 'Provides silent illumination and warmth in cold environments.\n\nNo refueling required.\nMetal',
  'walkie-talkie': 'Enables long-distance communication.\n\nDisrupted by EMPs\nHold to use',
  walkietalkie: 'Enables long-distance communication.\n\nDisrupted by EMPs\nHold to use',
  flashlight: 'Lights the path far ahead. Remains active when holstered for hands-free use.\n\nWaterproof\nDisrupted by EMPs\nMetal',
  medkit: 'Provides first aid for yourself or a fellow workforce member.\n\nHold to use\nSingle-use',
  adrenaline: 'Revives you when downed. Grants temporary infinite stamina and Infection suppression.\n\nSingle-use',
  'adrenaline shot': 'Revives you when downed. Grants temporary infinite stamina and Infection suppression.\n\nSingle-use',
  boltcutters: 'Can be used to quietly unlock doors, disarm tripwires and mines, or cut the Ceilingman\'s tongue.\n\nHold to use\n8 Uses\nMetal',
  buoltcutters: 'Can be used to quietly unlock doors, disarm tripwires and mines, or cut the Ceilingman\'s tongue.\n\nHold to use\n8 Uses\nMetal',
  sledgehammer: 'Instantly breaches doors. Can eliminate Packrat and Shambler threats.\n\n15 Uses\nMetal',
  stunlight: 'Unleashes a blinding flash that stuns entities. Disperses The Shepherd temporarily.\n\nHold to charge\n5 Charges\nMetal',
  firecrackers: 'Ignites with a short fuse and detonates loudly. Attracts entities to the explosion point.\n\nSingle-use',
  glowstick: 'Provides a soft, continuous glow that lasts indefinitely.',
  spraymark: 'Mark walls with colored indicators to organize exploration.\n\nDisrupted by EMPs\n32 Spray Charges\nMetal',
  'environment marker': 'Mark walls with colored indicators to organize exploration.\n\nDisrupted by EMPs\n32 Spray Charges\nMetal',
  gasmask: 'Filters toxic spores and contaminated air for safe breathing.\n\nAlways Equipped\nMetal',
  pickaxe: "Griller's favorite item.",
  rebreather: 'Allows safe breathing underwater.\n\nDoes not filter spores.\nAlways Equipped\nMetal',
  soda: 'Can be thrown to create noise and attract entities.\n\nCan be picked back up\nMetal',
  'soda can': 'Can be thrown to create noise and attract entities.\n\nCan be picked back up\nMetal',
  'noisemaker (soda can)': 'Can be thrown to create noise and attract entities.\n\nCan be picked back up\nMetal',
  dynamite: 'Unstable, short-fuse explosive. Rapid movement risks detonation. Lethal to anything caught in the blast.',
  defib: 'Restores a fallen teammate to operational status.\n\nSingle-use\nDisrupted by EMPs\nMetal',
  defibrillator: 'Restores a fallen teammate to operational status.\n\nSingle-use\nDisrupted by EMPs\nMetal',
  shotgun: "yes. it's real.\nif you can afford it.",
};

function getItemIcon(savedItemData: TrainItem['savedItemData']) {
  const candidates = [
    String(savedItemData.itemDataName ?? ''),
    String(savedItemData.itemName ?? ''),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (ITEM_ICON_MAP[candidate]) {
      return ITEM_ICON_MAP[candidate];
    }
  }

  return null;
}

function prettifyItemLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getItemDisplayLabel(savedItemData: TrainItem['savedItemData'], fallback: string) {
  const candidates = [
    String(savedItemData.itemDataName ?? ''),
    String(savedItemData.itemName ?? ''),
  ].map((value) => value.trim());

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    if (ITEM_LABEL_MAP[normalized]) {
      return ITEM_LABEL_MAP[normalized];
    }

    if (candidate) {
      return prettifyItemLabel(candidate);
    }
  }

  return fallback;
}

function getItemDescription(savedItemData: TrainItem['savedItemData']) {
  const candidates = [
    String(savedItemData.itemName ?? ''),
    String(savedItemData.itemDataName ?? ''),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (ITEM_DESCRIPTION_MAP[candidate]) {
      return ITEM_DESCRIPTION_MAP[candidate];
    }
  }

  return 'No in-game description found for this item.';
}

function getWorldModifierLabel(value: number) {
  return worldModifierOptions.find((option) => option.value === value)?.label ?? `Unknown (${value})`;
}

enum ModifierTone {
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative',
}

function getWorldModifierTone(value: number) {
  if (
    [
      WorldModifier.Surplus,
      WorldModifier.Vigor,
      WorldModifier.Shadowstep,
      WorldModifier.Unlocked,
    ].includes(value as WorldModifier)
  ) {
    return ModifierTone.Positive;
  }

  if (
    [WorldModifier.None, WorldModifier.Error, WorldModifier.Displaced].includes(
      value as WorldModifier,
    )
  ) {
    return ModifierTone.Neutral;
  }

  return ModifierTone.Negative;
}

function getWorldModifierLootMultiplier(value: number) {
  const multiplierMap: Partial<Record<WorldModifier, number>> = {
    [WorldModifier.Blackout]: 1.4,
    [WorldModifier.Emp]: 1.3,
    [WorldModifier.Dread]: 1.1,
    [WorldModifier.Paranoia]: 1.2,
    [WorldModifier.Minefield]: 1.5,
    [WorldModifier.Spores]: 1.6,
    [WorldModifier.Whiteout]: 1.3,
    [WorldModifier.Sunken]: 1.5,
  };

  return multiplierMap[value as WorldModifier] ?? null;
}

function getModifierBadgeClass(value: number) {
  if (value === 0) {
    return 'border-white/10 bg-white/[0.04] text-muted-foreground';
  }

  const tone = getWorldModifierTone(value);

  if (tone === ModifierTone.Positive) {
    return 'border-primary/25 bg-primary/12 text-primary';
  }

  if (tone === ModifierTone.Negative) {
    return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
  }

  return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
}

function getModifierDotClass(value: number) {
  if (value === 0) {
    return 'bg-zinc-400';
  }

  const tone = getWorldModifierTone(value);

  if (tone === ModifierTone.Positive) {
    return 'bg-primary';
  }

  if (tone === ModifierTone.Negative) {
    return 'bg-rose-400';
  }

  return 'bg-amber-400';
}

function renderModifierOptionLabel(value: number) {
  const multiplier = getWorldModifierLootMultiplier(value);

  return (
    <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
      <span className={['h-2 w-2 rounded-full', getModifierDotClass(value)].join(' ')} />
      <span className="truncate">{getWorldModifierLabel(value)}</span>
      {multiplier ? (
        <span className="shrink-0 text-xs text-muted-foreground">x{multiplier.toFixed(1)}</span>
      ) : null}
    </span>
  );
}

function renderModifierBadgeContent(value: number) {
  const multiplier = getWorldModifierLootMultiplier(value);

  return (
    <span className="inline-flex h-5 items-center gap-2 whitespace-nowrap">
      <span className="whitespace-nowrap">{getWorldModifierLabel(value)}</span>
      {multiplier ? (
        <span className="inline-flex h-4 items-center rounded-full bg-black/20 px-1.5 text-[10px] font-semibold text-current/80 whitespace-nowrap">
          x{multiplier.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

function getItemSummaryLine(savedItemData: TrainItem['savedItemData']) {
  const description = getItemDescription(savedItemData);
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? 'No in-game description found for this item.';
}

function getItemOptionValue(savedItemData: TrainItem['savedItemData']) {
  const candidates = [
    String(savedItemData.itemDataName ?? ''),
    String(savedItemData.itemName ?? ''),
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const option of ITEM_OPTIONS) {
    if (
      candidates.includes(option.itemDataName.toLowerCase()) ||
      candidates.includes(option.itemName.toLowerCase())
    ) {
      return option.value;
    }
  }

  return '__custom__';
}

function createEmptyVector(): VectorData {
  return deriveVectorData({ x: 0, y: 0, z: 0 });
}

function deriveVectorData(partial: Partial<VectorData>): VectorData {
  const x = Number(partial.x ?? 0);
  const y = Number(partial.y ?? 0);
  const z = Number(partial.z ?? 0);
  const sqrMagnitude = x * x + y * y + z * z;
  const magnitude = Math.sqrt(sqrMagnitude);
  const normalized =
    magnitude > 0
      ? {
          x: x / magnitude,
          y: y / magnitude,
          z: z / magnitude,
          magnitude: 1,
          sqrMagnitude: 1,
        }
      : {
          x: 0,
          y: 0,
          z: 0,
          magnitude: 0,
          sqrMagnitude: 0,
        };

  return {
    ...partial,
    x,
    y,
    z,
    normalized,
    magnitude,
    sqrMagnitude,
  };
}

function createEmptyTrainItem(): TrainItem {
  return {
    savedItemData: {
      itemDataName: '',
      itemName: '',
      rarityId: 0,
      itemLevel: 0,
      requiredLevel: 0,
      value: 0,
      position: createEmptyVector(),
      rotation: createEmptyVector(),
    },
  };
}

function VectorNumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <div className="flex min-w-0 items-stretch">
        <div className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-black/20 px-3 text-sm font-semibold text-muted-foreground">
          {label}
        </div>
        <Input
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          min={min}
          max={max}
          step={step}
          className="rounded-l-none bg-input border-border text-sm font-mono focus-visible:border-primary/30 focus-visible:ring-primary/20 focus-visible:ring-[3px]"
        />
      </div>
    </div>
  );
}

function VectorEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: VectorData;
  onChange: (value: VectorData) => void;
}) {
  const current = deriveVectorData(value ?? createEmptyVector());

  function updateField<K extends keyof VectorData>(field: K, nextValue: VectorData[K]) {
    onChange(
      deriveVectorData({
        ...current,
        [field]: nextValue,
      }),
    );
  }

  return (
    <div className="rounded-lg border border-white/8 bg-black/10 p-3">
      <div className="mb-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <VectorNumberRow label="X" value={Number(current.x ?? 0)} onChange={(next) => updateField('x', next)} />
        <VectorNumberRow label="Y" value={Number(current.y ?? 0)} onChange={(next) => updateField('y', next)} />
        <VectorNumberRow label="Z" value={Number(current.z ?? 0)} onChange={(next) => updateField('z', next)} />
      </div>
    </div>
  );
}

function WorldSubsection({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        {actions ? <div className="shrink-0 self-center">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function WorldEditor() {
  const { tabs, activeTabId, updateWorldField } = useEditorStore();
  const worldData = getActiveTab(tabs, activeTabId)?.worldData ?? null;
  const [activeView, setActiveView] = useState<WorldEditorTab>(WorldEditorTab.Overview);
  const [selectedTrainItemIndex, setSelectedTrainItemIndex] = useState(0);
  const [openDestination, setOpenDestination] = useState('');
  const previousLastPoiRef = useRef('');

  if (!worldData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Globe className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">No world data loaded</p>
          <p className="mt-1 text-sm text-muted-foreground/60">Upload a save file to get started</p>
        </div>
      </div>
    );
  }

  const safeSaleItems = Array.isArray(worldData.saleItems) ? worldData.saleItems : [];
  const safeTrainItems = Array.isArray(worldData.trainItems) ? worldData.trainItems : [];
  function setField<K extends keyof WorldData>(field: K, value: WorldData[K]) {
    updateWorldField(field, value);
  }

  function updateSaleItem(index: number, field: 'itemName' | 'salePercent', value: string | number) {
    const nextSaleItems = [...safeSaleItems];
    const currentItem = nextSaleItems[index] ?? { itemName: '', salePercent: 0 };
    nextSaleItems[index] = {
      ...currentItem,
      [field]: value,
    };
    setField('saleItems', nextSaleItems);
  }

  function removeSaleItem(index: number) {
    setField(
      'saleItems',
      safeSaleItems.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function addSaleItem() {
    setField('saleItems', [...safeSaleItems, { itemName: '', salePercent: 0 }]);
  }

  function updateTrainItem(index: number, nextItem: TrainItem) {
    const nextItems = [...safeTrainItems];
    nextItems[index] = nextItem;
    setField('trainItems', nextItems);
  }

  function updateSavedItemData(index: number, updates: Partial<TrainItem['savedItemData']>) {
    const currentItem = safeTrainItems[index] ?? createEmptyTrainItem();
    updateTrainItem(index, {
      ...currentItem,
      savedItemData: {
        ...createEmptyTrainItem().savedItemData,
        ...currentItem.savedItemData,
        ...updates,
      },
    });
  }

  function removeTrainItem(index: number) {
    setField(
      'trainItems',
      safeTrainItems.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function addTrainItem() {
    const nextItems = [...safeTrainItems, createEmptyTrainItem()];
    setField('trainItems', nextItems);
    setActiveView(WorldEditorTab.Items);
    setSelectedTrainItemIndex(nextItems.length - 1);
  }

  useEffect(() => {
    if (safeTrainItems.length === 0) {
      if (selectedTrainItemIndex !== 0) {
        setSelectedTrainItemIndex(0);
      }
      return;
    }

    if (selectedTrainItemIndex > safeTrainItems.length - 1) {
      setSelectedTrainItemIndex(safeTrainItems.length - 1);
    }
  }, [safeTrainItems.length, selectedTrainItemIndex]);

  useEffect(() => {
    const lastPoi = String(worldData.lastPOI ?? '');
    if (!previousLastPoiRef.current && lastPoi) {
      setOpenDestination(lastPoi);
      previousLastPoiRef.current = lastPoi;
    } else if (lastPoi !== previousLastPoiRef.current) {
      previousLastPoiRef.current = lastPoi;
    }
  }, [worldData.lastPOI]);

  const selectedTrainItem =
    safeTrainItems[selectedTrainItemIndex] ?? (safeTrainItems.length > 0 ? safeTrainItems[0] : null);
  const selectedSavedItemData =
    selectedTrainItem?.savedItemData ?? createEmptyTrainItem().savedItemData;
  const selectedItemDescription = getItemSummaryLine(selectedSavedItemData);
  const selectedItemOptionValue = getItemOptionValue(selectedSavedItemData);
  const currentDestinationField =
    MODIFIER_FIELDS.find((field) => field.label === worldData.lastPOI) ?? MODIFIER_FIELDS[0];
  const currentDestinationLootField =
    LOOT_FIELDS.find((field) => field.label === currentDestinationField.label) ?? LOOT_FIELDS[0];
  const currentDestinationLootValue = Number(worldData[currentDestinationLootField.key] ?? 0);
  const currentDestinationVisualModifier = Number(worldData[currentDestinationField.baseKey] ?? 0);
  const currentDestinationEffectiveModifier = Number(worldData[currentDestinationField.effectiveKey] ?? 0);
  const currentDestinationOptions = poiOptions.map((option) => {
    const destinationField =
      MODIFIER_FIELDS.find((field) => field.label === option.label) ?? MODIFIER_FIELDS[0];
    const destinationLootField =
      LOOT_FIELDS.find((field) => field.label === destinationField.label) ?? LOOT_FIELDS[0];
    const destinationLootValue = Number(worldData[destinationLootField.key] ?? 0);
    const destinationVisualModifier = Number(worldData[destinationField.baseKey] ?? 0);
    const destinationEffectiveModifier = Number(worldData[destinationField.effectiveKey] ?? 0);

    return {
      value: option.value,
      label: (
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{option.label}</span>
          <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-white/8 bg-white/[0.04] px-2 text-[10px] font-medium text-foreground whitespace-nowrap">
            {destinationLootValue}%
          </span>
          <span
            className={[
              'inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium whitespace-nowrap',
              getModifierBadgeClass(destinationVisualModifier),
            ].join(' ')}
          >
            <span className="mr-1.5">Visual:</span>
            {renderModifierBadgeContent(destinationVisualModifier)}
          </span>
          {destinationEffectiveModifier !== WorldModifier.None ? (
            <span
              className={[
                'inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium whitespace-nowrap',
                getModifierBadgeClass(destinationEffectiveModifier),
              ].join(' ')}
            >
              <span className="mr-1.5">Effective:</span>
              {renderModifierBadgeContent(destinationEffectiveModifier)}
            </span>
          ) : null}
        </span>
      ),
    };
  });

  return (
    <Tabs value={activeView} onValueChange={(value) => setActiveView(value as WorldEditorTab)} className="space-y-5">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-white/8 bg-[#14151a] p-1.5">
        <TabsTrigger className="h-9 flex-none px-3" value={WorldEditorTab.Overview}>
          Overview
        </TabsTrigger>
        <TabsTrigger className="h-9 flex-none px-3" value={WorldEditorTab.Destinations}>
          Destinations
        </TabsTrigger>
        <TabsTrigger className="h-9 flex-none px-3" value={WorldEditorTab.Items}>
          Items
        </TabsTrigger>
      </TabsList>

      <TabsContent value={WorldEditorTab.Overview} className="space-y-6">
        <EditorCard
          title="Overview"
          description="Core run setup and party settings."
          icon={<Globe className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <WorldSubsection
              title="Run"
              icon={<Globe className="h-4 w-4" />}
            >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  type="select"
                  label="Gamemode"
                  value={worldData.gamemode}
                  onChange={(value) => setField('gamemode', Number(value) as GameMode)}
                  options={gamemodeOptions}
                />
                <FormField
                  type="number"
                  label="Cycles Completed"
                  value={Number(worldData.cyclesCompleted ?? 0)}
                  onChange={(value) => setField('cyclesCompleted', value)}
                  min={0}
                />
                <FormField
                  type="number"
                  label="Days Elapsed"
                  value={Number(worldData.days ?? 0)}
                  onChange={(value) => setField('days', value)}
                  min={0}
                />
                <FormField
                  type="number"
                  label="Days Remaining"
                  value={Number(worldData.daysRemaining ?? 0)}
                  onChange={(value) => setField('daysRemaining', value)}
                  min={0}
                />
                <FormField
                  type="toggle"
                  label="Time to Pay Debt"
                  description="Marks this run as being in the debt repayment phase."
                  value={Boolean(worldData.timeToPayDebt)}
                  onChange={(value) => setField('timeToPayDebt', value)}
                  className="md:col-span-2 rounded-lg border border-white/8 bg-black/12 px-3 py-2"
                />
              </div>
            </WorldSubsection>

            <WorldSubsection title="Session" icon={<MapPin className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  type="number"
                  label="Max Players"
                  value={Number(worldData.maxPlayers ?? 0)}
                  onChange={(value) => setField('maxPlayers', value)}
                  min={1}
                />
                <FormField
                  type="select"
                  label="Privacy"
                  value={worldData.privacy}
                  onChange={(value) => setField('privacy', Number(value) as PrivacyMode)}
                  options={privacyOptions}
                />
              </div>
            </WorldSubsection>
          </div>
        </EditorCard>

        <EditorCard
          title="Economy"
          description="Current balance, debt values, and run economy tuning."
          icon={<Coins className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <WorldSubsection title="Balance" icon={<Coins className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField type="number" label="Credits" value={Number(worldData.credits ?? 0)} onChange={(value) => setField('credits', value)} min={0} step={100} />
                <FormField type="number" label="Debt" value={Number(worldData.debt ?? 0)} onChange={(value) => setField('debt', value)} min={0} step={100} />
                <FormField type="number" label="Debt Paid" value={Number(worldData.debtPayed ?? 0)} onChange={(value) => setField('debtPayed', value)} min={0} step={100} />
                <FormField type="number" label="Scrap Bin" value={Number(worldData.scrapBin ?? 0)} onChange={(value) => setField('scrapBin', value)} min={0} />
              </div>
            </WorldSubsection>

            <WorldSubsection title="Tuning" icon={<Gauge className="h-4 w-4" />}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField type="number" label="Base Debt for Scaling" value={Number(worldData.baseDebtForScaling ?? 0)} onChange={(value) => setField('baseDebtForScaling', value)} min={0} />
                <FormField type="number" label="Debt Before Changed" value={Number(worldData.debtBeforeChanged ?? 0)} onChange={(value) => setField('debtBeforeChanged', value)} min={0} />
                <FormField type="number" label="Selling Percentage" value={Number(worldData.sellingForPercentage ?? 0)} onChange={(value) => setField('sellingForPercentage', value)} min={0} max={100} suffix="%" />
              </div>
            </WorldSubsection>
          </div>
        </EditorCard>

        <EditorCard
          title="Sale Items"
          description="Configure temporary discounts for specific items."
          icon={<Coins className="h-4 w-4" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-white/10 bg-black/20 hover:border-emerald-500 hover:bg-emerald-500 hover:text-black"
              onClick={addSaleItem}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          }
        >
          {safeSaleItems.length > 0 ? (
            <div className="space-y-3">
              {safeSaleItems.map((item, index) => (
                <div key={`${item.itemName}-${index}`} className="rounded-lg border border-white/8 bg-black/15 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
                      <FormField
                        type="select"
                        label="Item"
                        value={String(item.itemName ?? '')}
                        onChange={(value) => updateSaleItem(index, 'itemName', value)}
                                  options={ITEM_OPTIONS.map((option) => ({
                                    value: option.saleItemName,
                                    label: option.label,
                                  }))}
                        showIndicator={false}
                        itemTone="neutral"
                        spacedItems={true}
                      />
                    <FormField type="number" label="Sale" value={Number(item.salePercent ?? 0)} onChange={(value) => updateSaleItem(index, 'salePercent', value)} min={0} max={100} suffix="%" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 self-end text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeSaleItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/8 bg-black/10 px-3 py-6 text-sm text-muted-foreground">
              No items are currently on sale.
            </div>
          )}
        </EditorCard>

        <EditorCard title="Difficulty" description="Cycle scaling and debt pressure settings." icon={<Gauge className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField type="number" label="Cycle Difficulty" value={Number(worldData.cycleDifficulty ?? 0)} onChange={(value) => setField('cycleDifficulty', value)} min={0} />
            <FormField type="number" label="Cycles for Difficulty Increase" value={Number(worldData.cyclesCompletedForDifficultyIncrease ?? 0)} onChange={(value) => setField('cyclesCompletedForDifficultyIncrease', value)} min={0} />
          </div>
        </EditorCard>

        <EditorCard title="Stats" description="Persistent run totals and economic performance." icon={<BarChart3 className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField type="number" label="Total Deaths" value={Number(worldData.totalDeaths ?? 0)} onChange={(value) => setField('totalDeaths', value)} min={0} />
            <FormField type="number" label="Total Downs" value={Number(worldData.totalDowns ?? 0)} onChange={(value) => setField('totalDowns', value)} min={0} />
            <FormField type="number" label="Total Credits Earned" value={Number(worldData.totalCreditsEarned ?? 0)} onChange={(value) => setField('totalCreditsEarned', value)} min={0} step={100} />
            <FormField type="number" label="Total Credits Spent" value={Number(worldData.totalCreditsSpent ?? 0)} onChange={(value) => setField('totalCreditsSpent', value)} min={0} step={100} />
          </div>
        </EditorCard>
      </TabsContent>

      <TabsContent value={WorldEditorTab.Destinations} className="space-y-6">
        <EditorCard
          title="Last POI"
          description="Set the current destination and pentagon unlock state for this save."
          icon={<MapPin className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-4">
            <FormField
              type="select"
              label="Current Destination"
              value={String(worldData.lastPOI ?? '')}
              onChange={(value) => setField('lastPOI', value as Poi)}
              options={currentDestinationOptions}
              className="md:max-w-[500px]"
              showIndicator={false}
              itemTone="neutral"
              spacedItems={true}
            />
          </div>
        </EditorCard>

        <Accordion
          type="single"
          collapsible
          value={openDestination}
          onValueChange={setOpenDestination}
          className="space-y-4"
        >
          {MODIFIER_FIELDS.map((field) => {
            const lootField = LOOT_FIELDS.find((loot) => loot.label === field.label);
            const lootValue = lootField ? Number(worldData[lootField.key] ?? 0) : 0;
            const baseValue = Number(worldData[field.baseKey] ?? 0);
            const effectiveValue = Number(worldData[field.effectiveKey] ?? 0);

            return (
              <AccordionItem
                key={field.label}
                value={field.label}
                className="overflow-hidden rounded-xl border border-white/8 bg-[#111217]"
              >
                <AccordionTrigger className="items-center px-5 py-4 hover:no-underline">
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="shrink-0 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-3 pr-2">
                        <div className="shrink-0 text-sm font-medium text-foreground">{field.label}</div>
                        <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-white/8 bg-white/[0.04] px-2.5 text-[11px] font-medium text-foreground whitespace-nowrap">
                          {lootValue}%
                        </span>
                        {effectiveValue !== WorldModifier.None ? (
                          <span
                            className={[
                              'inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap',
                              getModifierBadgeClass(effectiveValue),
                            ].join(' ')}
                          >
                            <span className="mr-2">Effective:</span>
                            {renderModifierBadgeContent(effectiveValue)}
                          </span>
                        ) : null}
                        {field.label === 'Pentagon' ? (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {worldData.hasBeenToFinalDestination ? 'Unlocked' : 'Locked'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t border-white/8 px-5 pb-5 pt-4">
                  <div className="grid grid-cols-1 gap-4">
                    {lootField ? (
                      <div className="w-full md:max-w-[500px]">
                        <FormField
                          type="number"
                          label="Loot Saturation"
                          value={lootValue}
                          onChange={(value) => setField(lootField.key, value)}
                          min={0}
                          max={100}
                          suffix="%"
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-4">
                    <div className="w-full md:max-w-[500px]">
                      <FormField
                        type="select"
                        label="Visual Modifier"
                        description="The modifier shown on the destination before the trip begins."
                        value={baseValue}
                        onChange={(value) => setField(field.baseKey, Number(value))}
                        showIndicator={false}
                        itemTone="neutral"
                        spacedItems={true}
                        options={worldModifierOptions.map((option) => ({
                          value: option.value,
                          label: renderModifierOptionLabel(option.value),
                        }))}
                      />
                    </div>

                    <div className="w-full md:max-w-[500px]">
                      <FormField
                        type="select"
                        label="Effective Modifier"
                        description="The resolved modifier the game actually applies when this destination is travelled to."
                        value={effectiveValue}
                        onChange={(value) => setField(field.effectiveKey, Number(value))}
                        showIndicator={false}
                        itemTone="neutral"
                        spacedItems={true}
                        options={worldModifierOptions.map((option) => ({
                          value: option.value,
                          label: renderModifierOptionLabel(option.value),
                        }))}
                      />
                    </div>
                  </div>
                  {field.label === 'Pentagon' ? (
                    <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                      <FormField
                        type="toggle"
                        label="Unlock Penta"
                        value={Boolean(worldData.hasBeenToFinalDestination)}
                        onChange={(value) => setField('hasBeenToFinalDestination', value)}
                      />
                    </div>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </TabsContent>

      <TabsContent value={WorldEditorTab.Items} className="space-y-6">
        <EditorCard
          title="Train Items"
          description="Browse saved train items on the left and edit one selected item at a time."
          icon={<Package className="h-4 w-4" />}
          actions={
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-white/10 bg-black/20 hover:border-emerald-500 hover:bg-emerald-500 hover:text-black"
              onClick={addTrainItem}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          }
        >
          {safeTrainItems.length > 0 && selectedTrainItem ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
              <div className="rounded-lg border border-white/8 bg-black/10 p-3 xl:h-[820px] xl:min-h-[820px] xl:max-h-[820px] xl:overflow-hidden">
                <div className="mb-3">
                  <p className="text-sm font-medium text-foreground">Saved Items</p>
                  <p className="mt-1 text-xs text-muted-foreground">Select an item to edit its nested payload.</p>
                </div>
                <div className="space-y-2 xl:h-[calc(100%-3.5rem)] xl:overflow-y-auto xl:pr-1">
                  {safeTrainItems.map((item, index) => {
                    const savedItemData = item?.savedItemData ?? createEmptyTrainItem().savedItemData;
                    const displayName = getItemDisplayLabel(savedItemData, `Train Item ${index + 1}`);
                    const isActive = index === selectedTrainItemIndex;
                    const iconSrc = getItemIcon(savedItemData);

                    return (
                      <button
                        key={`${displayName}-${index}`}
                        type="button"
                        onClick={() => setSelectedTrainItemIndex(index)}
                        className={[
                          'w-full rounded-lg border px-3 py-3 text-left transition-all',
                          isActive
                            ? 'border-primary/25 bg-primary/10'
                            : 'border-white/8 bg-black/15 hover:border-white/12 hover:bg-black/20',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/8 bg-black/20">
                            {iconSrc ? (
                              <img
                                src={assetPath(iconSrc)}
                                alt={displayName}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                ?
                              </span>
                            )}
                          </div>
                          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-white/8 bg-black/10 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-foreground">
                      {getItemDisplayLabel(selectedSavedItemData, `Train Item ${selectedTrainItemIndex + 1}`)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedItemDescription}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeTrainItem(selectedTrainItemIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FormField
                    type="select"
                    label="Item"
                    description="Choose the saved item type for this entry."
                    value={selectedItemOptionValue}
                    onChange={(value) => {
                      const nextItem = ITEM_OPTIONS.find((option) => option.value === value);
                      if (!nextItem) {
                        return;
                      }

                      updateSavedItemData(selectedTrainItemIndex, {
                        itemDataName: nextItem.itemDataName,
                        itemName: nextItem.itemName,
                      });
                    }}
                    options={ITEM_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    showIndicator={false}
                  />
                </div>

                <div className="mt-4 space-y-4">
                  <VectorEditor label="Position" value={selectedSavedItemData.position ?? createEmptyVector()} onChange={(value) => updateSavedItemData(selectedTrainItemIndex, { position: value })} />
                  <VectorEditor label="Rotation" value={selectedSavedItemData.rotation ?? createEmptyVector()} onChange={(value) => updateSavedItemData(selectedTrainItemIndex, { rotation: value })} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/8 bg-black/10 px-4 py-6 text-sm text-muted-foreground">
              No train items stored in this save yet.
            </div>
          )}
        </EditorCard>
      </TabsContent>

    </Tabs>
  );
}
