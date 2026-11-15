'use client';

/**
 * `diff` output: a live list of what changed in a save. Tab or arrows move
 * between changes; Enter, Space or u undoes the one under the cursor (a whole
 * field, or a single entry of a list). Undone changes move to an "undone"
 * block underneath, where the same keys redo them.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useEditor } from '@/lib/store';
import type { JsonValue } from '@/lib/save';
import { displaySetting } from '@/lib/settings';
import { diffDoc, type Change } from './diff-model';
import { navKeys } from './forms';

const SIGN: Record<Change['kind'], { tag: string; tone: string }> = {
  field: { tag: '~', tone: 'gold' },
  added: { tag: '+', tone: 'mint' },
  removed: { tag: '-', tone: 'red' },
  changed: { tag: '~', tone: 'gold' },
};

const ACT_KEYS = new Set(['Enter', ' ', 'u', 'r', 'Backspace', 'Delete']);

export function TermDiff({ docId, autofocus = false }: { docId: string; autofocus?: boolean }) {
  const doc = useEditor((state) => state.docs.find((d) => d.id === docId) ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Changes undone here, newest first, so they can be redone. Lives as long as this output does.
  const [undone, setUndone] = useState<Change[]>([]);
  // After an undo or redo, put the cursor back on the row that took that row's place.
  const refocus = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (autofocus) rootRef.current?.querySelector<HTMLElement>('[data-field]')?.focus({ preventScroll: true });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (refocus.current === null) return;
    const rows = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-field]') ?? [])];
    const next = rows[Math.min(refocus.current, rows.length - 1)];
    refocus.current = null;
    if (next) next.focus({ preventScroll: true });
    else document.getElementById('term-input')?.focus();
  });

  if (!doc) return <p className="term-faint">(save closed)</p>;
  const fields = diffDoc(doc.original, doc.data, doc.kind === 'settings' ? displaySetting : undefined);

  const apply = (change: Change, direction: 'undo' | 'redo') => {
    const state = useEditor.getState();
    if (state.activeId !== docId) state.activate(docId);
    const current = state.docs.find((d) => d.id === docId)?.data[change.key];
    state.setField(change.key, change[direction](current) as JsonValue | undefined);
  };
  const remember = (row: HTMLElement) => {
    const rows = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-field]') ?? [])];
    refocus.current = rows.indexOf(row);
  };
  const undo = (change: Change, row: HTMLElement) => {
    remember(row);
    apply(change, 'undo');
    // Undoing a whole field also covers its entries; drop any of those already listed.
    setUndone((list) => [change, ...list.filter((c) => c.id !== change.id && !(change.kind === 'field' && c.key === change.key))]);
  };
  const redo = (change: Change, row: HTMLElement) => {
    remember(row);
    apply(change, 'redo');
    setUndone((list) => list.filter((c) => c !== change));
  };
  const undoAll = () => {
    setUndone((list) => [...fields.map((field) => field.head), ...list.filter((c) => !fields.some((f) => f.key === c.key))]);
    const state = useEditor.getState();
    if (state.activeId !== docId) state.activate(docId);
    state.revert();
  };

  const row = (change: Change, nested: boolean, mode: 'undo' | 'redo') => {
    const sign = SIGN[change.kind];
    const act = (target: HTMLElement) => (mode === 'undo' ? undo(change, target) : redo(change, target));
    return (
      <button
        key={`${mode}:${change.id}`}
        type="button"
        data-field
        className={`term-diff-row${nested ? ' term-diff-row--nested' : ''}${mode === 'redo' ? ' term-diff-row--undone' : ''}`}
        aria-label={`${mode} ${change.label}`}
        onClick={(event) => act(event.currentTarget)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
          if (navKeys(event)) return;
          if (ACT_KEYS.has(event.key)) {
            event.preventDefault();
            act(event.currentTarget);
          }
        }}
      >
        <span className={`term-badge term-badge--${sign.tone}`}>{sign.tag}</span>
        {nested ? (
          // Entries sit in the value column, under the field's value, marked off by a left border.
          <>
            <span />
            <span className="term-diff-entry">
              <span className="term-diff-entry-label">{change.label}</span>
              {change.detail ? <span className="term-diff-entry-detail">{change.detail}</span> : null}
            </span>
          </>
        ) : (
          <>
            <span className="term-diff-label">{change.label}</span>
            <span className="term-diff-detail">{change.detail}</span>
          </>
        )}
        <span className="term-diff-undo">[{mode}]</span>
      </button>
    );
  };

  return (
    <div ref={rootRef} className="term-form term-diff">
      <div className="term-header term-header--actions">
        <span className="term-actions">
          {fields.length ? (
            <>
              <button
                type="button"
                className="term-action"
                onClick={() => {
                  const state = useEditor.getState();
                  if (state.activeId !== docId) state.activate(docId);
                  void state.save();
                }}
              >
                [ save ]
              </button>
              <button type="button" className="term-action" onClick={undoAll}>
                [ undo all ]
              </button>
            </>
          ) : null}
        </span>
      </div>
      {fields.length === 0 ? (
        <p className="term-faint">no changes.</p>
      ) : (
        fields.map((field) => (
          <div key={field.key} className="term-diff-field">
            {row(field.head, false, 'undo')}
            {field.entries.map((entry) => row(entry, true, 'undo'))}
          </div>
        ))
      )}
      {undone.length ? (
        <div className="term-diff-undone">
          <p className="term-faint">;; undone · enter to redo</p>
          {undone.map((change) => row(change, change.kind !== 'field', 'redo'))}
        </div>
      ) : null}
    </div>
  );
}
