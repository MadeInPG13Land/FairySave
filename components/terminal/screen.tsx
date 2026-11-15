'use client';

/**
 * A full-screen view, like nano or vi: `edit`, `show` and `diff` open here
 * instead of printing a form into the scrollback. Esc asks first and a second
 * Esc exits back to the prompt (the shell then prints what changed); Ctrl+X
 * and clicking the esc key exit straight away. Saving happens back at the
 * prompt, not in here.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useEditor } from '@/lib/store';
import { pathOf } from './commands';
import { TermDiff } from './diff';
import { TermForm } from './forms';
import { SaveMenu } from './save-menu';
import { useSudo } from './sudo';

export type ScreenView =
  | { kind: 'form'; docId: string; section: string; autofocus: boolean }
  | { kind: 'diff'; docId: string }
  | { kind: 'save'; docId: string | null };

export function TermScreen({ view, onExit, onLog }: { view: ScreenView; onExit: () => void; onLog: (text: string) => void }) {
  const doc = useEditor((state) => state.docs.find((d) => d.id === view.docId) ?? null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sudo = useSudo((state) => state.on);
  // The field the cursor was last on, so the key bar's buttons act on it.
  const lastField = useRef<HTMLElement | null>(null);
  // Esc was pressed once: the key bar asks before leaving.
  const [confirming, setConfirming] = useState(false);

  // Edits in here go to this save.
  useEffect(() => {
    if (view.kind !== 'save' && view.docId && useEditor.getState().activeId !== view.docId) useEditor.getState().activate(view.docId);
  }, [view.kind, view.docId]);

  // The save was closed underneath us.
  useEffect(() => {
    if (view.kind !== 'save' && !doc) onExit();
  }, [view.kind, doc, onExit]);
  if (view.kind !== 'save' && !doc) return null;

  const where = view.kind === 'save' ? 'save' : view.kind === 'form' ? pathOf(doc!, view.section) : `${pathOf(doc!)} (diff)`;

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    const stop = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (event.key === 'Escape') {
      stop();
      if (confirming) onExit();
      else setConfirming(true);
      return;
    }
    // While asking, any other key means stay (and does nothing else).
    if (confirming) {
      stop();
      setConfirming(false);
      return;
    }
    if (event.ctrlKey && ['x', 'q'].includes(event.key.toLowerCase())) {
      stop();
      onExit();
    }
  };

  const fields = () => [...(bodyRef.current?.querySelectorAll<HTMLElement>('[data-field]') ?? [])];
  const current = () => (lastField.current?.isConnected ? lastField.current : fields()[0]) ?? null;
  /** Press a key on the current field, as if typed there. */
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const field = current();
    if (!field) return;
    field.focus();
    field.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  };
  const move = () => {
    const list = fields();
    const at = list.indexOf(current()!);
    list[(at + 1) % list.length]?.focus();
  };

  return (
    <div
      className="term term-screen"
      onKeyDownCapture={onKeyDownCapture}
      onFocusCapture={(event) => {
        if ((event.target as HTMLElement).hasAttribute('data-field')) lastField.current = event.target as HTMLElement;
      }}
    >
      {/* Same centred column as the terminal, so nothing jumps in width when it opens. */}
      <div className="term-screen-frame">
      <div className="term-screen-bar">
        <span className="term-bold">FAIRYSAVE</span>
        <span className="term-screen-path">{where}</span>
        {sudo ? <span className="term-screen-sudo">sudo</span> : null}
      </div>
      <div ref={bodyRef} className="term-screen-body">
        {view.kind === 'form' ? (
          <TermForm docId={view.docId} section={view.section} autofocus />
        ) : view.kind === 'diff' ? (
          <TermDiff docId={view.docId} autofocus />
        ) : (
          <SaveMenu preselect={view.docId} onLog={onLog} />
        )}
      </div>
      {confirming ? (
        <div className="term-screen-keys term-screen-keys--confirm">
          <KeyButton keys="esc" label="exit" onClick={onExit} />
          <KeyButton keys="any key" label="stay" onClick={() => setConfirming(false)} />
        </div>
      ) : (
      <div className="term-screen-keys">
        <KeyButton keys="esc" label="exit" onClick={onExit} />
        {view.kind === 'save' ? (
          <>
            <KeyButton keys="↑ ↓" label="choose" onClick={move} />
            <KeyButton keys="enter" label="save" onClick={() => press('Enter')} />
            <KeyButton keys="d" label="download a copy" onClick={() => press('d')} />
          </>
        ) : (
          <>
            <KeyButton keys="tab" label="next field" onClick={move} />
          </>
        )}
        {view.kind === 'save' ? null : view.kind === 'form' ? (
          <>
            <KeyButton keys="← →" label="change" onClick={() => press('ArrowRight')} />
            <KeyButton keys="space" label="toggle" onClick={() => press(' ')} />
            <KeyButton keys="ctrl+z" label="undo" onClick={() => press('z', { ctrlKey: true })} />
          </>
        ) : (
          <KeyButton keys="enter" label="undo / redo" onClick={() => press('Enter')} />
        )}
      </div>
      )}
      </div>
    </div>
  );
}

/** A key-bar entry you can also click. Clicking doesn't take focus, so the field stays selected. */
export function KeyButton({ keys, label, onClick }: { keys: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="term-key-button" onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      <kbd>{keys}</kbd> {label}
    </button>
  );
}
