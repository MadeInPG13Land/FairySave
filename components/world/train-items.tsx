'use client';

import { useEffect, useState } from 'react';
import { Copy, Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState, GameIcon, NumberInput, PageHeader, Pill, Row, Section, SelectInput, ToggleRow } from '@/components/kit';
import { ITEMS, findItem, prettify } from '@/lib/game-data';
import { TRAIN_ITEM_STATE, asArray, createTrainItem, isObject, readVector, vector, type JsonObject } from '@/lib/save';
import { cn } from '@/lib/utils';
import type { SectionProps } from '@/components/sections';

function itemData(entry: JsonObject): JsonObject {
  return isObject(entry.savedItemData) ? entry.savedItemData : {};
}

function itemLabel(entry: JsonObject) {
  const data = itemData(entry);
  return findItem(data)?.label ?? prettify(String(data.itemDataName || data.itemName || 'Unknown item'));
}

export function TrainItemsSection({ data, set }: SectionProps) {
  const items = asArray(data.trainItems).filter(isObject);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(items.length - 1, 0));
  const entry = items[index];

  useEffect(() => {
    if (selected > items.length - 1 && items.length > 0) setSelected(items.length - 1);
  }, [items.length, selected]);

  const write = (next: JsonObject[]) => set('trainItems', next);
  const update = (patch: JsonObject) => write(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const updateData = (patch: JsonObject) => update({ savedItemData: { ...itemData(entry), ...patch } });

  function add(def: (typeof ITEMS)[number]) {
    write([...items, createTrainItem(def, items)]);
    setSelected(items.length);
  }

  const counts = new Map<string, number>();
  for (const item of items) counts.set(itemLabel(item), (counts.get(itemLabel(item)) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Train items"
        description={`${items.length} item${items.length === 1 ? '' : 's'} stored on the train.`}
        actions={<AddItemMenu onAdd={add} />}
      />

      {items.length === 0 || !entry ? (
        <EmptyState icon={<Package className="size-5" />} title="The train is empty">
          Add an item to place it inside the train car.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-lg border bg-card lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
            <ul className="p-1">
              {items.map((item, i) => {
                const def = findItem(itemData(item));
                const durability = item.hasDurability ? Number(item.durability) : null;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                        i === index ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                      )}
                    >
                      <GameIcon src={def?.icon} alt="" size={24} />
                      <span className="min-w-0 flex-1 truncate text-[12px]">{itemLabel(item)}</span>
                      {durability !== null ? (
                        <span className="font-mono text-[10px] text-subtle-foreground tabular-nums">{durability}</span>
                      ) : null}
                      {item.inReclamationUnit ? <span className="size-1.5 rounded-full bg-warning" title="In reclamation unit" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <ItemDetail
            key={index}
            entry={entry}
            onUpdate={update}
            onUpdateData={updateData}
            onDuplicate={() => {
              write([...items.slice(0, index + 1), structuredClone(entry), ...items.slice(index + 1)]);
              setSelected(index + 1);
            }}
            onRemove={() => write(items.filter((_, i) => i !== index))}
          />
        </div>
      )}
    </>
  );
}

function AddItemMenu({ onAdd }: { onAdd: (def: (typeof ITEMS)[number]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus /> Add item
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-60 overflow-y-auto">
        {ITEMS.map((def) => (
          <DropdownMenuItem key={def.itemDataName} onSelect={() => onAdd(def)}>
            <GameIcon src={def.icon} alt="" size={20} className="border-0 bg-transparent" />
            <span className="flex-1 truncate">{def.label}</span>
            {def.shop ? <span className="text-[11px] text-subtle-foreground">${def.shop.cost.toLocaleString()}</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ItemDetail({
  entry,
  onUpdate,
  onUpdateData,
  onDuplicate,
  onRemove,
}: {
  entry: JsonObject;
  onUpdate: (patch: JsonObject) => void;
  onUpdateData: (patch: JsonObject) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const data = itemData(entry);
  const def = findItem(data);
  const knownValue = def?.itemDataName ?? `__raw__${String(data.itemDataName ?? '')}`;
  const options = ITEMS.map((item) => ({
    value: item.itemDataName,
    label: item.label,
    icon: <GameIcon src={item.icon} alt="" size={20} className="border-0 bg-transparent" />,
  }));
  if (!def) options.push({ value: knownValue, label: `${String(data.itemDataName || 'Unknown')} (unknown)`, icon: <GameIcon src={null} alt="" size={20} /> });

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-start gap-3 rounded-lg border bg-card p-4">
        <GameIcon src={def?.icon} alt="" size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-medium">{itemLabel(entry)}</h2>
            {def?.shop ? <Pill>${def.shop.cost.toLocaleString()}</Pill> : null}
            {def?.alwaysEquipped ? <Pill>Always equipped</Pill> : null}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {def?.description || 'No in-game description.'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Duplicate item" onClick={onDuplicate}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Remove item" onClick={onRemove} className="hover:text-destructive">
            <Trash2 />
          </Button>
        </div>
      </div>

      <Section title="Item">
        <Row label="Type" hint={<span className="font-mono">{String(data.itemDataName ?? '')}</span>}>
          <SelectInput
            value={knownValue}
            options={options}
            onChange={(value) => {
              const next = ITEMS.find((item) => item.itemDataName === value);
              if (next) onUpdateData({ itemDataName: next.itemDataName, itemName: next.itemName });
            }}
          />
        </Row>
        <ToggleRow
          label="In reclamation unit"
          hint="Stored in the reclamation unit instead of on the train floor."
          checked={entry.inReclamationUnit}
          onChange={(value) => onUpdate({ inReclamationUnit: value })}
        />
      </Section>

      <Section title="State" description="When a value is off, the game uses the item's default.">
        {TRAIN_ITEM_STATE.map((field) => (
          <Row key={field.key} label={field.label}>
            <NumberInput
              value={entry[field.key]}
              min={0}
              step={field.step}
              className={cn(!entry[field.flag] && 'opacity-50')}
              onChange={(value) => onUpdate({ [field.key]: value, [field.flag]: true })}
            />
            <Switch
              checked={Boolean(entry[field.flag])}
              onCheckedChange={(value) => onUpdate({ [field.flag]: value })}
              aria-label={`Override ${field.label}`}
            />
          </Row>
        ))}
      </Section>

      <Section title="Placement">
        <VectorRow label="Position" value={data.position} onChange={(value) => onUpdateData({ position: value })} />
        <VectorRow label="Rotation" value={data.rotation} onChange={(value) => onUpdateData({ rotation: value })} />
      </Section>
    </div>
  );
}

function VectorRow({ label, value, onChange }: { label: string; value: unknown; onChange: (value: JsonObject) => void }) {
  const v = readVector(value);
  const axis = (key: 'x' | 'y' | 'z') => (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-subtle-foreground uppercase">
        {key}
      </span>
      <NumberInput
        value={v[key]}
        step={0.1}
        className="sm:w-28 [&_input]:pl-6"
        onChange={(next) => {
          const updated = { ...v, [key]: next };
          onChange(vector(updated.x, updated.y, updated.z));
        }}
      />
    </div>
  );
  return (
    <Row label={label}>
      {axis('x')}
      {axis('y')}
      {axis('z')}
    </Row>
  );
}
