'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTheme } from 'next-themes';
import { GAME_VERSION, ITEMS, COSMETICS, DESTINATIONS, TAPES } from '@/lib/game-data';
import { useEditor, docChanges, type SaveDoc } from '@/lib/store';
import { ROOT, cwdLabel, dirName, outcome, pathOf, runCommand, suggest, type Candidate, type Cwd, type Line } from './commands';
import { Intro } from './intro';
import { useSudo } from './sudo';
import { Fetch } from './fetch';
import { KeyButton, TermScreen, type ScreenView } from './screen';
import type { JsonObject } from '@/lib/save';

interface Entry {
  id: string;
  input: string | null;
  lines: Line[];
  /** How many lines have been printed so far (output streams in). */
  shown: number;
  /** Milliseconds between batches; boot text prints slower. */
  pace?: number;
  /** Where the prompt was when the command ran, e.g. ~/save_1. */
  where?: string;
  /** Run under sudo: its prompt is drawn root-style (#, in red). */
  root?: boolean;
}

const HISTORY_KEY = 'fairysave:term-history';
const BATCH_DELAY = 28;


const entry = (input: string | null, lines: Line[], pace?: number): Entry => ({ id: crypto.randomUUID(), input, lines, shown: 0, pace });

/** The start screen: the guided intro (credits, tool info, saves), then the prompt. */
function boot(): Entry {
  return entry(null, [{ kind: 'intro' }], 90);
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TerminalShell({ onOpenPicker }: { onOpenPicker: () => Promise<void> }) {
  const { setTheme } = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  // Where the prompt is. Always starts at home (~); every open save is a directory there.
  const [cwd, setCwd] = useState<Cwd>(ROOT);
  const historyIndex = useRef<number | null>(null);
  // While Tab is cycling: the candidates and which one is in the prompt. Typing ends the cycle.
  const tabState = useRef<{ options: string[]; index: number; last: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // A full-screen view (edit/show/diff), like nano: the scrollback is hidden until it closes.
  // `before` is the save as it was on opening, so closing can say what changed.
  const [screen, setScreen] = useState<{ view: ScreenView; entryId: string; title: string; before: JsonObject } | null>(null);

  const printing = entries.some((e) => e.shown < e.lines.length);
  const sudo = useSudo((state) => state.on);
  // The start screen types itself out; the prompt waits until it's done (or skipped).
  const [introTyping, setIntroTyping] = useState(true);
  const busy = running || printing || introTyping;
  // Esc at an empty prompt: the status bar asks before leaving the CRT view.
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'));
    } catch {
      /* ignore */
    }
    setEntries([boot()]);
  }, []);

  // Stream the newest unfinished entry a batch of lines at a time.
  useEffect(() => {
    const pending = entries.find((e) => e.shown < e.lines.length);
    if (!pending) return;
    if (prefersReducedMotion()) {
      setEntries((current) => current.map((e) => ({ ...e, shown: e.lines.length })));
      return;
    }
    // Long output prints in ~20 batches, short output a line at a time.
    const batch = Math.max(1, Math.ceil(pending.lines.length / 20));
    const timer = window.setTimeout(() => {
      setEntries((current) =>
        current.map((e) => (e.id === pending.id ? { ...e, shown: Math.min(e.lines.length, e.shown + batch) } : e)),
      );
    }, pending.shown === 0 ? 60 : (pending.pace ?? BATCH_DELAY));
    return () => window.clearTimeout(timer);
  }, [entries]);

  const finishPrinting = () => setEntries((current) => current.map((e) => ({ ...e, shown: e.lines.length })));

  // Announce every file that arrives by drag-and-drop or the picker.
  const docs = useEditor((state) => state.docs);
  const seenDocs = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seenDocs.current === null) {
      seenDocs.current = new Set(docs.map((d) => d.id));
      return;
    }
    const fresh = docs.filter((d) => !seenDocs.current!.has(d.id));
    docs.forEach((d) => seenDocs.current!.add(d.id));
    if (fresh.length === 0) return;
    const lines: Line[] = fresh.flatMap((d): Line[] => [
      { kind: 'text', text: `${d.kind === 'settings' ? 'reading' : 'decrypting'} ${d.fileName} ... ok`, tone: 'dim' },
      { kind: 'text', text: `loaded ${d.fileName.replace(/^fairy engine /i, '')} (${d.kind === 'player' ? 'profile' : d.kind}).`, tone: 'fg' },
    ]);
    lines.push({ kind: 'text', text: `${fresh.length === 1 ? 'a new directory is' : `${fresh.length} new directories are`} in ~: ${fresh.map((d) => `${dirName(d)}/`).join('  ')}`, tone: 'fg' });
    lines.push({
      kind: 'links',
      prefix: 'go in with',
      links: [...fresh.map((d) => ({ label: `cd ${dirName(d)}`, command: `cd ${pathOf(d)}` })), { label: 'ls', command: 'ls' }],
    });
    setEntries((list) => [...list, entry(null, lines, 120)]);
  }, [docs]);

  // Closing the save you're in sends you home.
  useEffect(() => {
    setCwd((current) => (current.docId && !docs.some((d) => d.id === current.docId) ? ROOT : current));
  }, [docs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const focus = () => inputRef.current?.focus({ preventScroll: true });

  const screenRef = useRef(screen);
  screenRef.current = screen;
  const closeScreen = useCallback(() => {
    const open = screenRef.current;
    if (!open) return;
    screenRef.current = null;
    setScreen(null);
    // A one-off `sudo edit …` ends with its view.
    if (useSudo.getState().once) useSudo.getState().set(false);
    // The save menu logs as it goes; there's no "what changed" summary for it.
    if (open.view.kind === 'save') return;
    const target = useEditor.getState().docs.find((d) => d.id === open.view.docId);
    const summary = outcome(open.title, open.before, target?.data ?? open.before, target?.kind, target?.fileName.replace(/^fairy engine /i, ''), docChanges(target ?? null) > 0);
    setEntries((list) => list.map((e) => (e.id === open.entryId ? { ...e, lines: [...e.lines, ...summary] } : e)));
  }, []);

  // Ctrl+S at the prompt: the same choice `save` makes. Full-screen views don't save.
  const executeRef = useRef<(command: string) => void>(() => {});
  // Where the prompt is, for Ctrl+S (which runs outside React's render).
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;
  const cwdDirRef = useRef('');
  cwdDirRef.current = docs.find((d) => d.id === cwd.docId) ? dirName(docs.find((d) => d.id === cwd.docId)!) : '';
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      // Still swallowed in a full-screen view, so the browser's own save dialog doesn't open.
      if (screenRef.current) return;
      executeRef.current(cwdRef.current.docId ? `save ~/${cwdDirRef.current}` : 'save');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Back at the prompt after closing a full-screen view.
  useEffect(() => {
    if (!screen) window.requestAnimationFrame(() => focus());
  }, [screen]);
  useEffect(() => {
    // Don't steal focus from a form that just opened with `edit`.
    if (!busy && !document.activeElement?.closest('.term-form')) focus();
  }, [busy]);

  const execute = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed || running) return;
      finishPrinting();
      setValue('');
      historyIndex.current = null;
      setHistory((current) => {
        const next = [...current.filter((item) => item !== trimmed), trimmed].slice(-100);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      setRunning(true);
      let cleared = false;
      const where = cwdLabel(cwd);
      const rootAtRun = useSudo.getState().on;
      try {
        const result = await runCommand(trimmed, {
          openPicker: onOpenPicker,
          setTheme,
          clear: () => {
            cleared = true;
          },
          cwd,
        });
        if (result.cwd) setCwd(result.cwd);
        // Forms, the diff and the save menu open full screen instead of printing inline.
        const opens = (line: Line) => line.kind === 'form' || line.kind === 'diff' || line.kind === 'save-menu';
        const opener = [...result.lines].reverse().find(opens);
        const printed = result.lines.filter((line) => !opens(line));
        const item = { ...entry(trimmed, printed), where, root: rootAtRun };
        setEntries((current) => (cleared ? [] : [...current, item]));
        if (opener?.kind === 'save-menu') {
          setScreen({ view: { kind: 'save', docId: opener.docId }, entryId: item.id, title: 'save', before: {} });
        } else if (opener && (opener.kind === 'form' || opener.kind === 'diff')) {
          const target = useEditor.getState().docs.find((d) => d.id === opener.docId);
          if (target) {
            setScreen({
              view: opener.kind === 'form' ? { kind: 'form', docId: opener.docId, section: opener.section, autofocus: opener.autofocus } : { kind: 'diff', docId: opener.docId },
              entryId: item.id,
              title: opener.kind === 'form' ? opener.section : 'diff',
              before: target.data,
            });
          }
        }
      } catch (error) {
        setEntries((current) => [
          ...current,
          { ...entry(trimmed, [{ kind: 'error', text: error instanceof Error ? error.message : String(error) }]), where },
        ]);
      } finally {
        setRunning(false);
      }
    },
    [running, onOpenPicker, setTheme, cwd],
  );

  const suggestion = useMemo(() => {
    if (busy) return null;
    return suggest(value, cwd);
    // docs: suggestions depend on what's open and changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cwd, docs, busy]);

  // Set while Tab is stepping through options and nothing has been typed since.
  const cycling = tabState.current && tabState.current.last === value ? tabState.current : null;

  executeRef.current = (command: string) => void execute(command);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Tab') tabState.current = null;

    if (confirmExit) {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      // A second Esc leaves; any other key stays (and does nothing else).
      event.preventDefault();
      setConfirmExit(false);
      if (event.key === 'Escape') setTheme('dark');
      return;
    }
    // (Not the Esc that skipped the start screen: the intro already used that one.)
    if (event.key === 'Escape' && value === '' && !busy && !event.defaultPrevented) {
      event.preventDefault();
      setConfirmExit(true);
      return;
    }

    // While output is printing, Enter or Ctrl+C skips to the end.
    if (printing && (event.key === 'Enter' || (event.key === 'c' && event.ctrlKey))) {
      event.preventDefault();
      finishPrinting();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void execute(value);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (history.length === 0) return;
      event.preventDefault();
      const current = historyIndex.current ?? history.length;
      const next = Math.max(0, Math.min(history.length, current + (event.key === 'ArrowUp' ? -1 : 1)));
      historyIndex.current = next;
      setValue(history[next] ?? '');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      // Tab again, without typing in between, steps through the options.
      if (tabState.current && tabState.current.last === value) {
        const state = tabState.current;
        state.index = (state.index + (event.shiftKey ? -1 : 1) + state.options.length) % state.options.length;
        state.last = state.options[state.index];
        setValue(state.last);
        return;
      }
      tabState.current = null;
      const candidates = suggestion?.candidates ?? [];
      if (candidates.length === 0) return;
      // A finished completion gets a space after it, unless it's a folder you can keep tabbing into.
      const filled = (c: Candidate) => (c.from === 'completion' && !c.value.endsWith('/') ? `${c.value} ` : c.value);
      if (candidates.length === 1) {
        setValue(filled(candidates[0]));
        return;
      }
      // Several: fill in the first, list them all once, and let each Tab move to the next.
      const shown = candidates.slice(0, 40).map((c) => c.label);
      const more = candidates.length - shown.length;
      setEntries((list) => [
        ...list,
        { ...entry(value, [{ kind: 'text', text: `${shown.join('   ')}${more > 0 ? `   +${more} more` : ''}`, tone: 'dim' }]), shown: 1, where: cwdLabel(cwd) },
      ]);
      const options = candidates.map((c) => c.value);
      tabState.current = { options, index: 0, last: options[0] };
      setValue(options[0]);
    } else if (event.key === 'ArrowRight' && suggestion?.candidates.length && event.currentTarget.selectionStart === value.length) {
      // → at the end of the line accepts the suggestion, like fish.
      event.preventDefault();
      setValue(suggestion.candidates[0].value);
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      setEntries([]);
    } else if (event.key === 'c' && event.ctrlKey && !window.getSelection()?.toString()) {
      event.preventDefault();
      setEntries((current) => [...current, entry(`${value}^C`, [])]);
      setValue('');
    }
  }

  const log = (text: string) =>
    setEntries((list) => list.map((e) => (e.id === screen?.entryId ? { ...e, lines: [...e.lines, { kind: 'text', text, tone: 'fg' }] } : e)));

  return (
    <>
    {screen ? <TermScreen view={screen.view} onExit={closeScreen} onLog={log} /> : null}
    {/* The scrollback stays mounted under a full-screen view (just hidden), so nothing in it replays. */}
    <div
      className="term flex h-full min-h-0 flex-col"
      style={screen ? { display: 'none' } : undefined}
      onMouseUp={(event) => {
        if ((event.target as HTMLElement).closest('a, button, input, .term-form') || window.getSelection()?.toString()) return;
        focus();
      }}
      // The scrolling area is the centred column (so its scrollbar sits at the column's edge);
      // the wheel over the empty margins either side still scrolls it.
      onWheel={(event) => {
        const scroller = scrollRef.current;
        if (scroller && !scroller.contains(event.target as Node)) scroller.scrollTop += event.deltaY;
      }}
    >
      <div ref={scrollRef} className="term-scroll min-h-0 w-full flex-1 overflow-y-auto">
        <div className="term-inner">
          {entries.map((item) => (
            <section key={item.id} className="term-entry">
              {item.input !== null ? (
                <p className="term-prompt term-prompt--history">
                  {item.where ? <span className={item.root ? 'term-cwd term-cwd--root' : 'term-cwd'}>{item.where}</span> : null}
                  {item.root ? <span className="term-root">#</span> : <span className="term-mint">→</span>}
                  <span className="term-bold">{item.input}</span>
                </p>
              ) : null}
              <Output lines={item.lines.slice(0, item.shown)} onRun={execute} onIntroTyped={(typed) => {
                  setIntroTyping(false);
                  if (typed) setValue((current) => current + typed);
                }} />
            </section>
          ))}

          <form
            // While the intro types, the prompt line is already there saying how to skip; it then just becomes the prompt.
            className={busy && !introTyping ? 'term-prompt term-prompt--busy' : introTyping ? 'term-prompt term-prompt--waiting' : 'term-prompt'}
            onSubmit={(event) => {
              event.preventDefault();
              void execute(value);
            }}
          >
            <span className={sudo ? 'term-cwd term-cwd--root' : 'term-cwd'}>{cwdLabel(cwd)}</span>
            {/* Under sudo the prompt goes root-style, like a shell: # in red. */}
            <label htmlFor="term-input" className={sudo ? 'term-root' : 'term-mint'} title={sudo ? 'sudo: limits lifted (sudo off to restore)' : undefined}>
              {sudo ? '#' : '→'}
            </label>
            <span className="term-input-wrap">
            {cycling ? (
              // Mid-cycle, Tab moves to the next option, so say where we are instead of suggesting more.
              <span className="term-ghost" aria-hidden>
                <span className="term-ghost-typed">{value}</span>
                <span className="term-ghost-key">
                  tab · {cycling.index + 1}/{cycling.options.length}
                </span>
              </span>
            ) : suggestion ? (
              <span className="term-ghost" aria-hidden>
                <span className="term-ghost-typed">{value}</span>
                <span className="term-ghost-rest">{suggestion.ghost}</span>
                {suggestion.candidates.length ? (
                  <span className="term-ghost-key">{suggestion.candidates.length > 1 ? `tab · ${suggestion.candidates.length}` : 'tab'}</span>
                ) : null}
              </span>
            ) : null}
            <input
              id="term-input"
              ref={inputRef}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                historyIndex.current = null;
              }}
              onKeyDown={onKeyDown}
              placeholder={introTyping ? 'press any key to skip' : busy || suggestion ? '' : 'type a command, or help'}
              readOnly={introTyping}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="term-input"
              aria-label="Command"
              aria-busy={busy}
              onBlur={() => setConfirmExit(false)}
            />
            </span>
          </form>

        </div>
      </div>
      {confirmExit ? (
        <div className="term-statusbar term-statusbar--confirm">
          <div className="term-statusbar-inner">
            <KeyButton keys="esc" label="exit crt" onClick={() => setTheme('dark')} />
            <KeyButton keys="any key" label="stay" onClick={() => setConfirmExit(false)} />
          </div>
        </div>
      ) : (
        <StatusBar docs={docs} here={docs.find((d) => d.id === cwd.docId) ?? null} busy={busy} onRun={(command) => void execute(command)} onExitCrt={() => setTheme('dark')} />
      )}
    </div>
    </>
  );
}

/**
 * The bar along the bottom: clickable keys on the left; on the right, one
 * quiet line about unsaved work. Save only shows when the save you're in has
 * changes, and names it, so it's always clear what it writes.
 */
function StatusBar({ docs, here, busy, onRun, onExitCrt }: { docs: SaveDoc[]; here: SaveDoc | null; busy: boolean; onRun: (command: string) => void; onExitCrt: () => void }) {
  const run = (command: string) => () => {
    if (!busy) onRun(command);
  };
  const dirty = docs.filter((d) => docChanges(d) > 0);
  // "all saved" only when that's true: a downloaded copy may never reach the game's folder,
  // so after a download the bar just says nothing rather than claiming it's saved.
  const allWritten = docs.every((d) => docChanges(d) === 0 && d.savedAs !== 'download');
  const state = dirty.length === 1 ? `${dirName(dirty[0])} unsaved` : `${dirty.length} unsaved`;
  return (
    <div className="term-statusbar">
      <div className="term-statusbar-inner">
        <KeyButton keys="help" label="commands" onClick={run('help')} />
        <KeyButton keys="ls" label="list" onClick={run('ls')} />
        <KeyButton keys="ctrl+o" label="open" onClick={run('open')} />
        {docs.length ? <KeyButton keys="ctrl+s" label={here ? `save ${dirName(here)}` : 'save…'} onClick={run(here ? `save ${pathOf(here)}` : 'save')} /> : null}
        <KeyButton keys="crt" label="exit" onClick={onExitCrt} />
        {dirty.length ? (
          <button
            type="button"
            className="term-statusbar-state term-statusbar-state--dirty"
            onClick={run('save')}
            title={`${dirty.map(dirName).join(', ')}: unsaved changes. click to save.`}
          >
            <span className="term-statusbar-dot" aria-hidden>
              ●
            </span>{' '}
            {state}
          </button>
        ) : docs.length && allWritten ? (
          <span className="term-statusbar-state">all saved</span>
        ) : null}
      </div>
    </div>
  );
}

function Output({ lines, onRun, onIntroTyped }: { lines: Line[]; onRun: (command: string) => void; onIntroTyped?: (typed?: string) => void }) {
  return (
    <div className="term-output">
      {lines.map((line, index) => {
        const cls = 'term-line term-reveal';
        switch (line.kind) {
          case 'blank':
            return <div key={index} className="term-blank" />;
          case 'diff':
          case 'form':
            // Opened full screen by the shell; never printed inline.
            return null;
          case 'intro':
            return (
              // No line wipe here: the intro types itself out.
              <div key={index} className="term-line">
                <Intro onRun={onRun} onTyped={onIntroTyped} />
              </div>
            );
          case 'changes':
            return <Changes key={index} line={line} onRun={onRun} className={cls} />;
          case 'text':
            return (
              <pre key={index} className={`${cls} term-text term-${line.tone ?? 'fg'}`}>
                {line.text}
              </pre>
            );
          case 'error':
            return (
              <p key={index} className={`${cls} term-error`}>
                <span className="term-badge term-badge--red">ERR</span> {line.text}
              </p>
            );
          case 'header':
            return (
              <div key={index} className={`${cls} term-header`}>
                <span className="term-faint">;;</span> <span className="term-bold">{line.title}</span>{' '}
                <span className="term-dim">{line.meta}</span>
                {line.actions ? (
                  <span className="term-actions">
                    {line.actions.map((action) => (
                      <button key={action.command} type="button" className="term-action" onClick={() => onRun(action.command)}>
                        [ {action.label} ]
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          case 'links':
            return (
              <p key={index} className={`${cls} term-dim`}>
                {line.prefix ? `${line.prefix} ` : null}
                {line.links.map((link, i) => (
                  <Fragment key={link.command}>
                    {i > 0 ? <span className="term-faint"> · </span> : null}
                    <button type="button" className="term-link term-bold" onClick={() => onRun(link.command)}>
                      {link.label}
                    </button>
                  </Fragment>
                ))}
              </p>
            );
          case 'fetch':
            return <Fetch key={index} line={line} className={cls} />;
          case 'record':
            return (
              <div key={index} className={`${cls} term-record`}>
                <span className={`term-badge term-badge--${line.tone}`}>{line.tag}</span>
                {line.command ? (
                  <button type="button" className="term-key term-link" onClick={() => onRun(line.command!)} title={line.command}>
                    {line.key}
                  </button>
                ) : (
                  <span className="term-key">{line.key}</span>
                )}
                <span className={line.nested ? 'term-value term-value--nested' : 'term-value'}>{line.value}</span>
                {line.note ? <span className="term-note">{line.note}</span> : <span />}
              </div>
            );
        }
      })}
    </div>
  );
}

/** The summary printed when a full-screen view closes: what changed, old value faint, new value bright. */
function Changes({ line, onRun, className }: { line: Extract<Line, { kind: 'changes' }>; onRun: (command: string) => void; className: string }) {
  const count = line.fields.length;
  return (
    <div className={`${className} term-changes`}>
      <p className="term-changes-head">
        <span className={line.unsaved ? 'term-changes-dot' : 'term-changes-dot term-changes-dot--saved'} aria-hidden>
          ●
        </span>
        <span className="term-bold">{line.title}</span>
        <span className="term-dim">
          {line.file ? `${line.file} · ` : ''}
          {count} change{count === 1 ? '' : 's'}
          {line.unsaved ? ' · not saved yet' : ' · saved'}
        </span>
        {line.unsaved ? (
          <span className="term-changes-actions">
            <button type="button" className="term-link" onClick={() => onRun('diff')}>
              diff
            </button>
            <span className="term-faint"> · </span>
            <button type="button" className="term-link" onClick={() => onRun('save')}>
              save
            </button>
          </span>
        ) : null}
      </p>
      {line.fields.map((field) => (
        <div key={field.label} className="term-changes-field">
          <p className="term-changes-row">
            <span className="term-changes-label">{field.label}</span>
            {field.to !== undefined ? (
              <span>
                <span className="term-changes-from">{field.from}</span>
                <span className="term-changes-arrow"> → </span>
                <span className="term-changes-to">{field.to}</span>
              </span>
            ) : (
              <span className="term-dim">{field.summary}</span>
            )}
          </p>
          {field.entries.length ? (
            <div className="term-changes-entries">
              {field.entries.map((entry, i) => (
                <p key={i}>
                  <span className={`term-changes-sign term-changes-sign--${entry.sign === '+' ? 'add' : entry.sign === '-' ? 'remove' : 'change'}`}>
                    {entry.sign === '-' ? '−' : entry.sign}
                  </span>
                  <span className="term-changes-to">{entry.label}</span>
                  {entry.detail ? <span className="term-dim"> {entry.detail}</span> : null}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
