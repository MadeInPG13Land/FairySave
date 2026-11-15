/**
 * The terminal's keyboard flows, rendered: things that broke by hand before
 * (Esc asking first, the skip key reaching the prompt, history surviving a
 * full-screen view).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditor, type SaveDoc } from '@/lib/store';
import { TermScreen } from './screen';
import { TerminalShell } from './terminal-shell';

const setTheme = vi.fn();
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'crt', setTheme }) }));

function doc(id: string, fileName: string, kind: SaveDoc['kind'], data: SaveDoc['data']): SaveDoc {
  return { id, fileName, kind, data, original: data, handle: null, access: 'none', view: 'guided', section: null, openedAt: 1 };
}

/** jsdom has neither; the intro reads one and the shell the other. `reduced` skips the typing animation. */
function stubBrowser(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollTo = () => {};
}

beforeEach(() => {
  setTheme.mockClear();
  window.localStorage.clear();
  useEditor.setState({ hydrated: true, activeId: 'w', docs: [doc('w', 'fairy engine save_1.fs', 'world', { maxPlayers: 4, gamemode: 0 })] });
});
afterEach(() => {
  // Testing Library only cleans up on its own when Vitest globals are on.
  cleanup();
  vi.useRealTimers();
});

describe('full-screen views', () => {
  const open = () => {
    const onExit = vi.fn();
    render(<TermScreen view={{ kind: 'form', docId: 'w', section: 'run', autofocus: true }} onExit={onExit} onLog={() => {}} />);
    return onExit;
  };

  it('Esc asks first; any other key stays; a second Esc leaves', () => {
    stubBrowser(true);
    const onExit = open();
    const field = document.activeElement!;
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /stay/ })).toBeInTheDocument();

    fireEvent.keyDown(field, { key: 'a' });
    expect(screen.queryByRole('button', { name: /stay/ })).not.toBeInTheDocument();

    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('clicking esc in the key bar leaves straight away', () => {
    stubBrowser(true);
    const onExit = open();
    fireEvent.click(screen.getByRole('button', { name: /^esc exit$/ }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('the prompt', () => {
  it('a letter typed to skip the start screen lands in the prompt', () => {
    stubBrowser(false);
    vi.useFakeTimers();
    render(<TerminalShell onOpenPicker={async () => {}} />);
    const input = document.getElementById('term-input') as HTMLInputElement;
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(input.readOnly).toBe(true);
    act(() => {
      fireEvent.keyDown(window, { key: 'l' });
    });
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe('l');
  });

  it('leaving a full-screen view keeps the scrollback as it was (no replayed start screen)', async () => {
    stubBrowser(true);
    render(<TerminalShell onOpenPicker={async () => {}} />);
    const intro = document.querySelector('.term-intro');
    expect(intro).not.toBeNull();
    const input = document.getElementById('term-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'edit ~/save_1/run' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    const form = document.querySelector('.term-screen');
    expect(form).not.toBeNull();
    fireEvent.keyDown(document.activeElement ?? form!, { key: 'Escape' });
    fireEvent.keyDown(document.activeElement ?? form!, { key: 'Escape' });
    expect(document.querySelector('.term-screen')).toBeNull();
    // The very same element: the start screen wasn't unmounted and typed out again.
    expect(document.querySelector('.term-intro')).toBe(intro);
  });

  it('Esc at an empty prompt asks before leaving the CRT view', () => {
    stubBrowser(true);
    render(<TerminalShell onOpenPicker={async () => {}} />);
    const input = document.getElementById('term-input')!;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /exit crt/ })).toBeInTheDocument();
    expect(setTheme).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'x' });
    expect(screen.queryByRole('button', { name: /exit crt/ })).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
