'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { assetPath } from '@/lib/asset-path';
import { cn } from '@/lib/utils';

interface CosmeticOption {
  value: string;
  label: string;
  imageSrc?: string;
}

const NONE_OPTION: CosmeticOption = {
  value: 'none',
  label: 'None',
};

export const PIN_OPTIONS: CosmeticOption[] = [
  NONE_OPTION,
  { value: 'laborer_pin', label: 'Laborer Pin', imageSrc: '/cosmetics/rank1_labourer.png' },
  { value: 'worker_pin', label: 'Worker Pin', imageSrc: '/cosmetics/rank2_worker.png' },
  { value: 'pool_pin', label: 'Pool Pin', imageSrc: '/cosmetics/pool_yippee.png' },
  { value: 'contributor_pin', label: 'Contributor Pin', imageSrc: '/cosmetics/rank3_contributor.png' },
  { value: 'bread_pin', label: 'Bread Pin', imageSrc: '/cosmetics/bread pin.png' },
  { value: 'threedave_pin', label: 'ThreeDave Pin', imageSrc: '/cosmetics/threedave_logo_ROFL_COLOUR.png' },
  { value: 'floflo_pin', label: 'Floflo Pin', imageSrc: '/cosmetics/NicoHeart.png' },
  { value: 'mice_pin', label: 'Mice Pin', imageSrc: '/cosmetics/micepinfast.png' },
  { value: 'bigweave_pin', label: 'Bigweave Pin', imageSrc: '/cosmetics/bigweave_pin.png' },
  { value: 'tato_pin', label: 'Tato Pin', imageSrc: '/cosmetics/tato_pin.png' },
  { value: 'coordinator_pin', label: 'Coordinator Pin', imageSrc: '/cosmetics/rank4_coordinator.png' },
  { value: 'value_pin', label: 'Value Pin', imageSrc: '/cosmetics/credits_earned_100k.png' },
  { value: 'shop_pin', label: 'Shop Pin', imageSrc: '/cosmetics/credits_spent_100k.png' },
  { value: 'abandoned_pin', label: 'Abandoned Pin', imageSrc: '/cosmetics/abandoned_1.png' },
  { value: 'debt_pin', label: 'Debt Pin', imageSrc: '/cosmetics/debtpaid_5mil.png' },
  { value: 'death_pin', label: 'Death Pin', imageSrc: '/cosmetics/death_1.png' },
  { value: 'downed_pin', label: 'Downed Pin', imageSrc: '/cosmetics/downed_1.png' },
  { value: 'hooked_pin', label: 'Hooked Pin', imageSrc: '/cosmetics/hooked_1.png' },
  { value: 'clock', label: 'Clock Pin', imageSrc: '/cosmetics/clock_pin.png' },
  { value: 'clock_pin', label: 'Clock Pin', imageSrc: '/cosmetics/clock_pin.png' },
  { value: 'loyalist_pin', label: 'Loyalist Pin', imageSrc: '/cosmetics/rank5_loyalist.png' },
  { value: 'worshipper_pin', label: 'Worshipper Pin', imageSrc: '/cosmetics/rank6_worshipper.png' },
  { value: 'overseer_pin', label: 'Overseer Pin', imageSrc: '/cosmetics/rank7_overseer.png' },
  { value: 'thwael', label: 'Thwael Pin', imageSrc: '/cosmetics/thwaelpin.png' },
  { value: 'vorz', label: 'Vorz Pin', imageSrc: '/cosmetics/vorzspin.png' },
  { value: 'jmdog', label: 'Jmdog Pin', imageSrc: '/cosmetics/Jmdog.png' },
  { value: 'conchaeater', label: 'Conchaeater Pin', imageSrc: '/cosmetics/conchaeater.png' },
  { value: 'griller_pin', label: 'Griller Pin', imageSrc: '/cosmetics/griller_pinFF.png' },
  { value: 'larry_pin', label: 'Larry Pin', imageSrc: '/cosmetics/UncleLarry_Pin.png' },
  { value: 'spiderbutcher_pin', label: 'Spiderbutcher Pin', imageSrc: '/cosmetics/kisskiss.png' },
  { value: 'made in fairyland', label: 'Fairyland Pin', imageSrc: '/cosmetics/fairyland_pin.png' },
];

export const PATCH_OPTIONS: CosmeticOption[] = [
  NONE_OPTION,
  { value: 'usa', label: 'USA Patch', imageSrc: '/cosmetics/americanflagpatch_sprite.png' },
  { value: 'bread_patch', label: 'Bread Patch', imageSrc: '/cosmetics/breadpatch.png' },
  { value: 'progress_patch', label: 'Progress Patch', imageSrc: '/cosmetics/progress.png' },
  { value: 'rainbow_patch', label: 'Rainbow Patch', imageSrc: '/cosmetics/rainbowpride.png' },
  { value: 'trans_patch', label: 'Trans Patch', imageSrc: '/cosmetics/tflag.png' },
  { value: 'bisexual_patch', label: 'Bisexual Patch', imageSrc: '/cosmetics/bisexual.png' },
  { value: 'nonbinary_patch', label: 'Nonbinary Patch', imageSrc: '/cosmetics/nonbinary.png' },
  { value: 'pan_patch', label: 'Pan Patch', imageSrc: '/cosmetics/panflag.png' },
  { value: 'lesbian', label: 'Lesbian Patch', imageSrc: '/cosmetics/lesbianflag.png' },
  { value: 'mlm', label: 'MLM Patch', imageSrc: '/cosmetics/gayprideflag.png' },
  { value: 'ace_patch', label: 'Ace Patch', imageSrc: '/cosmetics/aceflag.png' },
  { value: 'pirate_patch', label: 'Pirate Patch', imageSrc: '/cosmetics/pirate.png' },
  { value: 'anthran', label: 'Anthran Patch', imageSrc: '/cosmetics/anthran_patch.png' },
  { value: 'blank', label: 'Blank Patch', imageSrc: '/cosmetics/blanksheetpatch.png' },
  { value: 'floflo_patch', label: 'Floflo Patch', imageSrc: '/cosmetics/nicopatch.png' },
  { value: 'mice_patch', label: 'Mice Patch', imageSrc: '/cosmetics/MicePatchFast.png' },
  { value: 'bigweave_patch', label: 'Bigweave Patch', imageSrc: '/cosmetics/bigweavepatch.png' },
  { value: 'tato_patch', label: 'Tato Patch', imageSrc: '/cosmetics/tato_patch.png' },
  { value: 'ECD', label: 'ECD Patch', imageSrc: '/cosmetics/ECDPATCH.png' },
  { value: 'threedave_patch', label: 'ThreeDave Patch', imageSrc: '/cosmetics/threedavepatch.png' },
  { value: 'griller_patch', label: 'Griller Patch', imageSrc: '/cosmetics/griller_patchFF.png' },
  { value: 'larry_patch', label: 'Larry Patch', imageSrc: '/cosmetics/UncleLarry_Patch.png' },
  { value: 'made in fairyland patch', label: 'Fairyland Patch', imageSrc: '/cosmetics/madeinfairylandpatch_black2.png' },
  { value: 'false world', label: 'Mori Shion Patch', imageSrc: '/cosmetics/mori shion patch.png' },
];

type SlotKind = 'pin' | 'patch';

interface SlotRowProps {
  kind: SlotKind;
  slotNumber: number;
  value: string;
  onChange: (value: string) => void;
}

function CosmeticThumb({ option, kind }: { option: CosmeticOption; kind: SlotKind }) {
  if (!option.imageSrc) {
    return (
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md border text-[10px] font-semibold uppercase tracking-[0.18em]',
          kind === 'pin'
            ? 'border-primary/15 bg-primary/10 text-primary'
            : 'border-accent/15 bg-accent/10 text-accent',
        )}
      >
        None
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border bg-black/10',
        kind === 'pin' ? 'border-primary/15' : 'border-accent/15',
      )}
    >
      <img
        src={assetPath(option.imageSrc)}
        alt={option.label}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function SlotRow({ kind, slotNumber, value, onChange }: SlotRowProps) {
  const options = kind === 'pin' ? PIN_OPTIONS : PATCH_OPTIONS;
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 transition-colors hover:border-border/80">
      <CosmeticThumb option={selected} kind={kind} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {kind === 'pin' ? 'Pin' : 'Patch'} {slotNumber}
        </span>

        <Select value={value || 'none'} onValueChange={onChange}>
          <SelectTrigger
            size="sm"
            className="h-8 w-full border-0 bg-transparent px-0 text-left text-sm font-medium text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{selected.label}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-80 bg-popover border-border">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.imageSrc ? (
                    <img
                      src={assetPath(opt.imageSrc)}
                      alt={opt.label}
                      className="h-6 w-6 rounded-sm border border-white/8 bg-black/10 object-contain"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-white/8 bg-black/10 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      None
                    </span>
                  )}
                  <span>{opt.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface PinPatchSelectorProps {
  pin1: string;
  pin2: string;
  patch1: string;
  patch2: string;
  onPin1Change: (v: string) => void;
  onPin2Change: (v: string) => void;
  onPatch1Change: (v: string) => void;
  onPatch2Change: (v: string) => void;
}

export function PinPatchSelector({
  pin1, pin2, patch1, patch2,
  onPin1Change, onPin2Change, onPatch1Change, onPatch2Change,
}: PinPatchSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <SlotRow kind="patch" slotNumber={1} value={patch1} onChange={onPatch1Change} />
      <SlotRow kind="patch" slotNumber={2} value={patch2} onChange={onPatch2Change} />
      <SlotRow kind="pin" slotNumber={1} value={pin1} onChange={onPin1Change} />
      <SlotRow kind="pin" slotNumber={2} value={pin2} onChange={onPin2Change} />
    </div>
  );
}
