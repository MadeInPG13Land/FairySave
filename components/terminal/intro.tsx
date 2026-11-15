'use client';

/**
 * The start screen's guided intro, drawn like a CLI installer:
 *
 *   ┌  fairysave
 *   ◇  Game Credits ──────────────╮
 *   │   logo   Forsaken Frontiers │
 *   ├─────────────────────────────╯
 *   └  type help …
 *
 * The rail, markers and box edges are CSS borders on one element tree (not
 * stacked box-drawing characters), so every line meets exactly.
 *
 * On first show it types itself out, section by section, pausing between
 * sections so there's time to read. Any key or click skips to the end.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GAME_VERSION } from '@/lib/game-data';
import { SAVE_FOLDER } from '@/lib/file-access';
import { docChanges, useEditor } from '@/lib/store';
import { creditsLine, dirName, pathOf, type Line } from './commands';
import { Fetch } from './fetch';

const FOLDER_TAIL = `…${SAVE_FOLDER.slice(SAVE_FOLDER.indexOf('\\LocalLow'))}`;

/** Typing speed and the pause after each section, in ms. */
const PER_CHAR = 9;
const PER_ART_ROW = 30;
const SECTION_PAUSE = 900;

/** `onTyped` gets the character typed to skip, if any, so it can go into the prompt. */
export function Intro({ onRun, onTyped }: { onRun: (command: string) => void; onTyped?: (typed?: string) => void }) {
  const docs = useEditor((state) => state.docs);
  const rootRef = useRef<HTMLDivElement>(null);
  const [typing, setTyping] = useState(true);
  const doneRef = useRef(onTyped);
  doneRef.current = onTyped;

  // Build the timeline from the DOM: each section's text types in order, then a pause.
  // A timer loop (not CSS animations) applies it, so it can't stall and simply catches up.
  // Nothing takes space until its turn, so the page grows line by line, like a terminal.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyping(false);
      doneRef.current?.();
      return;
    }
    const items: TimelineItem[] = [];
    let t = 0;
    const sections = [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('data-section'));
    sections.forEach((section, index) => {
      items.push({ el: section, kind: 'section', start: t, duration: 0, steps: 1 });
      for (const el of section.querySelectorAll<HTMLElement>('[data-type], [data-type-art]')) {
        const art = el.hasAttribute('data-type-art');
        // Art draws by row; text by character; things with no text (the colour swatches) one child at a time.
        const text = (el.textContent ?? '').trim();
        const steps = art ? (el.textContent ?? '').split('\n').length : Math.max(1, text.length || el.children.length);
        const duration = steps * (art ? PER_ART_ROW : PER_CHAR);
        items.push({ el, kind: art ? 'art' : 'text', start: t, duration, steps });
        t += duration;
      }
      if (index < sections.length - 1) t += SECTION_PAUSE;
    });
    const total = t;

    // While typing, the rail runs down to the newest section so a box's ├ joins straight away.
    root.classList.add('term-intro--typing');
    const began = performance.now();
    const tick = () => {
      const now = performance.now() - began;
      items.forEach((item) => paint(item, now));
      followBottom(root);
      if (now >= total) finish();
    };
    tick(); // first frame before paint, so nothing flashes in early
    const timer = window.setInterval(tick, 16);
    stopRef.current = () => {
      window.clearInterval(timer);
      items.forEach((item) => clear(item));
      root.classList.remove('term-intro--typing');
    };
    return () => stopRef.current?.();
    // Only on first show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRef = useRef<(() => void) | null>(null);
  const finish = (typed?: string) => {
    stopRef.current?.();
    stopRef.current = null;
    setTyping(false);
    doneRef.current?.(typed);
    // Everything (and the prompt) is in now; keep the newest line in view.
    const root = rootRef.current;
    if (root) window.requestAnimationFrame(() => followBottom(root));
  };

  // Any key or click skips the rest. A typed character also goes into the prompt.
  useEffect(() => {
    if (!typing) return;
    const skip = (event: Event) => {
      if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey || event.altKey)) return;
      event.preventDefault();
      const typed = event instanceof KeyboardEvent && event.key.length === 1 && event.key !== ' ' ? event.key : undefined;
      finish(typed);
    };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    return () => {
      window.removeEventListener('keydown', skip, true);
      window.removeEventListener('pointerdown', skip, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  const link = (label: ReactNode, command: string) => (
    <button type="button" className="term-link term-bold" onClick={() => onRun(command)}>
      {label}
    </button>
  );

  return (
    <>
      <div ref={rootRef} className="term-intro">
        <div className="term-intro-start" data-section>
          <span className="term-intro-pill" data-type>
            fairysave
          </span>
        </div>

        <Step title="not affiliated with or endorsed by made in fairyland" />

        <Step title="not a terminal person?">
          <span className="term-intro-lines">
            <span data-type>this is the retro view. the regular editor does everything this does.</span>
            <span data-type>
              {link('→ switch to the regular editor', 'theme dark')}
            </span>
          </span>
        </Step>

        <Box title="Game Credits">
          <Fetch line={creditsLine() as Extract<Line, { kind: 'fetch' }>} typed />
        </Box>

        <Box title="Tool Info">
          <div className="term-intro-table term-intro-pairs">
            <span className="term-dim" data-type>
              what
            </span>
            <span data-type>a save editor for your profile and world saves</span>
            <span className="term-dim" data-type>
              game version
            </span>
            <span className="term-bold" data-type>
              {GAME_VERSION ?? 'unknown'}
            </span>
            <span className="term-dim" data-type>
              privacy
            </span>
            <span className="term-intro-lines">
              <span data-type>nothing leaves this machine.</span>
              <span data-type>saves are edited in the browser and only written when you save.</span>
            </span>
          </div>
        </Box>

        {docs.length ? (
          <Box title={`${docs.length} save${docs.length === 1 ? '' : 's'} open`}>
            <div className="term-intro-table" style={{ gridTemplateColumns: 'auto auto auto' }}>
              {docs.map((doc) => {
                const unsaved = docChanges(doc);
                return [
                  <span key={`${doc.id}:n`} data-type>
                    {link(`${dirName(doc)}/`, `cd ${pathOf(doc)}`)}
                  </span>,
                  <span key={`${doc.id}:k`} className="term-dim" data-type>
                    {doc.kind === 'player' ? 'profile' : doc.kind}
                  </span>,
                  <span key={`${doc.id}:s`} className={unsaved ? 'term-gold' : 'term-dim'} data-type>
                    {unsaved ? `${unsaved} unsaved` : doc.savedAs === 'download' ? 'downloaded, not written' : 'saved'}
                  </span>,
                ];
              })}
            </div>
          </Box>
        ) : (
          <Step title="no save loaded">
            <span className="term-intro-lines">
              <span data-type>drop .fs files anywhere, or {link('open', 'open')} one.</span>
              <span className="term-faint" data-type>
                your saves live in {FOLDER_TAIL}
              </span>
            </span>
          </Step>
        )}

        <div className="term-intro-end" data-section>
          <span className="term-dim" data-type>
            type {link('help', 'help')} to see what you can do, or press tab
          </span>
        </div>
      </div>
    </>
  );
}

function Step({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="term-intro-step" data-section>
      <span className="term-intro-mark" aria-hidden>
        ◇
      </span>
      <p className="term-bold">
        <span data-type>{title}</span>
      </p>
      {children ? <div className="term-dim">{children}</div> : null}
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="term-intro-box" data-section>
      <span className="term-intro-mark" aria-hidden>
        ◇
      </span>
      <p className="term-intro-box-title term-bold">
        <span data-type>{title}</span>
      </p>
      <div className="term-intro-box-body">{children}</div>
    </div>
  );
}

/** Keep the terminal scrolled to its newest line while the intro prints. */
function followBottom(from: HTMLElement) {
  const scroller = from.closest<HTMLElement>('.term-scroll');
  if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

interface TimelineItem {
  el: HTMLElement;
  kind: 'section' | 'text' | 'art';
  /** ms from the start. */
  start: number;
  duration: number;
  steps: number;
}

const FADE = { text: 420, art: 600, section: 320 } as const;

/** Set one piece of the intro to how it looks `now` ms in. */
function paint(item: TimelineItem, now: number) {
  const { el, kind, start, duration, steps } = item;
  const style = el.style;
  if (now < start) {
    // Not its turn: takes no space.
    style.display = kind === 'section' ? 'none' : '';
    if (kind !== 'section') {
      style.maxHeight = '0';
      style.overflow = 'hidden';
      style.opacity = '0';
    }
    return;
  }
  style.display = '';
  style.opacity = String(Math.min(1, (now - start) / FADE[kind]));
  if (kind === 'section') return;
  // Whole steps only: a character (or a row of the logo) at a time.
  const done = duration ? Math.min(steps, Math.floor(((now - start) / duration) * steps) + 1) : steps;
  if (kind === 'art') {
    style.overflow = 'hidden';
    style.maxHeight = `${done * 1.02}em`;
  } else {
    style.maxHeight = '';
    style.overflow = '';
    style.clipPath = done >= steps ? '' : `inset(0 ${(1 - done / steps) * 100}% 0 0)`;
  }
}

/** Back to normal once the intro has finished or been skipped. */
function clear({ el }: TimelineItem) {
  for (const prop of ['display', 'opacity', 'maxHeight', 'overflow', 'clipPath'] as const) el.style[prop] = '';
}
