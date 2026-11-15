'use client';

/**
 * The full-screen save menu: one line per open save. ↑/↓ choose, Enter saves
 * (any time, changes or not), d downloads a copy. Each result is also logged
 * under the `save` command.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { docChanges, useEditor, type SaveDoc, type SaveResult } from '@/lib/store';
import { dirName, downloadedNote } from './commands';
import { navKeys } from './forms';

type Outcome = SaveResult | 'saving' | 'failed';

/** Saves grouped under a plain heading each, in this order. */
const GROUPS: { kind: SaveDoc['kind']; title: string }[] = [
  { kind: 'player', title: 'profile' },
  { kind: 'world', title: 'world' },
  { kind: 'settings', title: 'settings' },
  { kind: 'json', title: 'other' },
];

const OUTCOME: Record<Outcome, string> = {
  saving: 'saving…',
  file: 'saved',
  download: 'downloaded',
  failed: 'failed',
};

export function SaveMenu({ preselect, onLog }: { preselect: string | null; onLog: (text: string) => void }) {
  const docs = useEditor((state) => state.docs);
  const rootRef = useRef<HTMLDivElement>(null);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  // Start on the save you're in, else the first one with changes, else the first.
  useLayoutEffect(() => {
    const start = docs.find((d) => d.id === preselect) ?? docs.find((d) => docChanges(d) > 0) ?? docs[0];
    rootRef.current?.querySelector<HTMLElement>(`[data-doc="${start?.id}"]`)?.focus({ preventScroll: true });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (doc: SaveDoc, download: boolean) => {
    setOutcomes((current) => ({ ...current, [doc.id]: 'saving' }));
    const state = useEditor.getState();
    state.activate(doc.id);
    const how = await state.save({ download });
    setOutcomes((current) => ({ ...current, [doc.id]: how ?? 'failed' }));
    onLog(
      how === 'file'
        ? `wrote ${doc.fileName}.`
        : how === 'download'
          ? downloadedNote(doc)
          : `could not save ${doc.fileName}.`,
    );
  };

  if (docs.length === 0) return <p className="term-faint">no saves open.</p>;

  return (
    <div ref={rootRef} className="term-form term-save-menu">
      {GROUPS.map((group) => {
        const list = docs.filter((doc) => doc.kind === group.kind);
        if (list.length === 0) return null;
        return [
          <p key={group.kind} className="term-save-group">
            {group.title}
          </p>,
          ...list.map((doc) => {
            const unsaved = docChanges(doc);
            // What the last save did, until you change it again; otherwise any unsaved changes.
            const outcome = outcomes[doc.id];
            const done = outcome === 'file' || outcome === 'download';
            const status = outcome && !(done && unsaved) ? OUTCOME[outcome] : unsaved ? `${unsaved} unsaved` : '';
            return (
              <button
                key={doc.id}
                type="button"
                data-field
                data-doc={doc.id}
                className="term-save-row"
                onClick={() => void run(doc, false)}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  if (navKeys(event)) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void run(doc, false);
                  } else if (event.key.toLowerCase() === 'd') {
                    event.preventDefault();
                    void run(doc, true);
                  }
                }}
              >
                <span>{dirName(doc)}/</span>
                <span className={status.endsWith('unsaved') ? 'term-save-status term-gold' : 'term-save-status'}>{status}</span>
              </button>
            );
          }),
        ];
      })}
    </div>
  );
}
