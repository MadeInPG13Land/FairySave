'use client';

import { Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, NumberInput, PageHeader, Row, Section, TextInput } from '@/components/kit';
import { Switch } from '@/components/ui/switch';
import { unknownKeys } from '@/lib/save';
import { useEditor } from '@/lib/store';
import type { SectionProps } from '@/components/sections';

/**
 * Anything in the save the guided editor has no dedicated control for.
 * New fields from game updates land here automatically.
 */
export function OtherFieldsSection({ data, set, kind }: SectionProps) {
  const setView = useEditor((state) => state.setView);
  const keys = unknownKeys(kind, data);

  return (
    <>
      <PageHeader
        title="Other fields"
        description="Fields in this save that don't have a dedicated editor yet. New fields added by game updates show up here."
      />
      {keys.length === 0 ? (
        <EmptyState icon={<Braces className="size-5" />} title="Nothing extra">
          Every field in this save is covered by the other sections.
        </EmptyState>
      ) : (
        <Section>
          {keys.map((key) => {
            const value = data[key];
            const label = <span className="font-mono text-[11px]">{key}</span>;
            if (typeof value === 'boolean') {
              return (
                <Row key={key} label={label}>
                  <Switch checked={value} onCheckedChange={(next) => set(key, next)} />
                </Row>
              );
            }
            if (typeof value === 'number') {
              return (
                <Row key={key} label={label}>
                  <NumberInput value={value} onChange={(next) => set(key, next)} />
                </Row>
              );
            }
            if (typeof value === 'string') {
              return (
                <Row key={key} label={label}>
                  <TextInput value={value} onChange={(next) => set(key, next)} />
                </Row>
              );
            }
            const summary = Array.isArray(value)
              ? `${value.length} item${value.length === 1 ? '' : 's'}`
              : value === null
                ? 'null'
                : `${Object.keys(value ?? {}).length} fields`;
            return (
              <Row key={key} label={label} hint={summary}>
                <code className="max-w-full truncate rounded bg-surface px-2 py-1 font-mono text-[10px] text-muted-foreground sm:max-w-xs">
                  {JSON.stringify(value)}
                </code>
                <Button variant="ghost" size="sm" onClick={() => setView('json')}>
                  Edit JSON
                </Button>
              </Row>
            );
          })}
        </Section>
      )}
    </>
  );
}
