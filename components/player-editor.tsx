'use client';

import { 
  User, 
  TrendingUp, 
  Pin, 
  Package, 
  Flag 
} from 'lucide-react';
import { EditorCard } from './editor-card';
import { FormField } from './form-field';
import { CosmeticsSection } from './cosmetics-section';
import { PinPatchSelector } from './pin-patch-selector';
import { DatadeckSection } from './datadeck-section';
import { TapesSection } from './tapes-section';
import { getActiveTab } from '@/lib/editor-tab';
import { useEditorStore } from '@/lib/store';
import { DatadeckSkin, Gender } from '@/lib/types';

const genderOptions = [
  { value: Gender.NotSet, label: 'Not Set' },
  { value: Gender.Male, label: 'Male' },
  { value: Gender.Female, label: 'Female' },
  { value: Gender.Other, label: 'Other' },
];

export function PlayerEditor() {
  const { tabs, activeTabId, updatePlayerField } = useEditorStore();
  const playerData = getActiveTab(tabs, activeTabId)?.playerData ?? null;

  if (!playerData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No player data loaded</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Upload a save file to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identity Section */}
      <EditorCard title="Identity" icon={<User className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            type="text"
            label="Character Name"
            value={playerData.characterName}
            onChange={(v) => updatePlayerField('characterName', v)}
          />
          <FormField
            type="text"
            label="Age"
            value={playerData.age}
            onChange={(v) => updatePlayerField('age', v)}
          />
          <FormField
            type="select"
            label="Gender"
            value={playerData.gender}
            onChange={(v) => updatePlayerField('gender', Number(v) as Gender)}
            options={genderOptions}
          />
        </div>
      </EditorCard>

      {/* Progression Section */}
      <EditorCard title="Progression" icon={<TrendingUp className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            type="number"
            label="Rank Level"
            value={playerData.rankLevel}
            onChange={(v) => updatePlayerField('rankLevel', v)}
            min={1}
            max={999999}
          />
          <FormField
            type="number"
            label="Prestige"
            value={playerData.prestige}
            onChange={(v) => updatePlayerField('prestige', v)}
            min={0}
            max={999}
          />
          <FormField
            type="number"
            label="Rank XP"
            value={playerData.rankExp}
            onChange={(v) => updatePlayerField('rankExp', v)}
            min={0}
            step={100}
          />
          <FormField
            type="number"
            label="XP Needed"
            value={playerData.xpNeeded}
            onChange={(v) => updatePlayerField('xpNeeded', v)}
            min={0}
            step={100}
          />
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <FormField
            type="number"
            label="Snake High Score"
            description="Best score in the minigame"
            value={playerData.snakeHighScore}
            onChange={(v) => updatePlayerField('snakeHighScore', v)}
            min={0}
            className="max-w-xl"
          />
        </div>
      </EditorCard>

      {/* Datadeck */}
      <DatadeckSection
        activeDeck={playerData.dataDeckSkin}
        unlocks={{
          dataDeckSkin_retro_unlocked: playerData.dataDeckSkin_retro_unlocked,
          dataDeckSkin_casino_unlocked: Boolean(playerData.dataDeckSkin_casino_unlocked),
          dataDeckSkin_bling_unlocked: Boolean(playerData.dataDeckSkin_bling_unlocked),
          dataDeckSkin_spore_unlocked: Boolean(playerData.dataDeckSkin_spore_unlocked),
          dataDeckSkin_flesh_unlocked: Boolean(playerData.dataDeckSkin_flesh_unlocked),
          dataDeckSkin_lost_unlocked: Boolean(playerData.dataDeckSkin_lost_unlocked),
          dataDeckSkin_ecd_unlocked: Boolean(playerData.dataDeckSkin_ecd_unlocked),
          dataDeckSkin_medical_unlocked: Boolean(playerData.dataDeckSkin_medical_unlocked),
          dataDeckSkin_fairyland_unlocked: Boolean(playerData.dataDeckSkin_fairyland_unlocked),
          dataDeckSkin_corpdeck_unlocked: Boolean(playerData.dataDeckSkin_corpdeck_unlocked),
          dataDeckSkin_entitydeck_unlocked: Boolean(playerData.dataDeckSkin_entitydeck_unlocked),
        }}
        onActiveDeckChange={(value) => updatePlayerField('dataDeckSkin', value as DatadeckSkin)}
        onToggleUnlock={(key, value) => updatePlayerField(key, value)}
      />

      {/* Equipped Pins & Patches */}
      <EditorCard title="Equipped Pins & Patches" icon={<Pin className="h-4 w-4" />}>
        <PinPatchSelector
          pin1={playerData.pin1}
          pin2={playerData.pin2}
          patch1={playerData.patch1}
          patch2={playerData.patch2}
          onPin1Change={(v) => updatePlayerField('pin1', v)}
          onPin2Change={(v) => updatePlayerField('pin2', v)}
          onPatch1Change={(v) => updatePlayerField('patch1', v)}
          onPatch2Change={(v) => updatePlayerField('patch2', v)}
        />
      </EditorCard>

      <CosmeticsSection
        unlockedCosmetics={playerData.unlockedCosmetics}
        onChange={(nextValues) => updatePlayerField('unlockedCosmetics', nextValues)}
      />

      {/* Collectibles */}
      <TapesSection
        tapes={playerData.tapes}
        logs={playerData.logs}
        onTapesChange={(nextValues) => updatePlayerField('tapes', nextValues)}
        onLogsChange={(nextValues) => updatePlayerField('logs', nextValues)}
      />

      {/* Flags */}
      <EditorCard title="Flags" icon={<Flag className="h-4 w-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-6">
          <FormField
            type="toggle"
            label="Registered"
            value={playerData.registered}
            onChange={(v) => updatePlayerField('registered', v)}
          />
          <FormField
            type="toggle"
            label="Character Initialized"
            value={playerData.characterInitialized}
            onChange={(v) => updatePlayerField('characterInitialized', v)}
          />
          <FormField
            type="toggle"
            label="Has Stunned Door Before"
            value={playerData.hasDoorStunnedBefore}
            onChange={(v) => updatePlayerField('hasDoorStunnedBefore', v)}
          />
          <FormField
            type="toggle"
            label="Has Been Wounded Before"
            value={playerData.hasBeenWoundedBefore}
            onChange={(v) => updatePlayerField('hasBeenWoundedBefore', v)}
          />
          <FormField
            type="toggle"
            label="Has Been Infected Before"
            value={playerData.hasBeenInfectedBefore}
            onChange={(v) => updatePlayerField('hasBeenInfectedBefore', v)}
          />
          <FormField
            type="toggle"
            label="Seen Travel Fee Tip"
            value={playerData.seenTravelFeeTip}
            onChange={(v) => updatePlayerField('seenTravelFeeTip', v)}
          />
          <FormField
            type="toggle"
            label="Seen Deck Skin Tip"
            value={playerData.seenDeckSkinTip}
            onChange={(v) => updatePlayerField('seenDeckSkinTip', v)}
          />
        </div>
      </EditorCard>
    </div>
  );
}
