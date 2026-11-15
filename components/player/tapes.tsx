'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageHeader, Pill, Section } from '@/components/kit';
import { TAPE_GROUPS, TAPES, findTape, type TapeDef } from '@/lib/game-data';
import { assetPath } from '@/lib/asset-path';
import { asStringArray } from '@/lib/save';
import { cn } from '@/lib/utils';
import type { SectionProps } from '@/components/sections';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TapesSection({ data, set }: SectionProps) {
  const tapes = asStringArray(data.tapes);
  const logs = asStringArray(data.logs);
  const [playing, setPlaying] = useState<TapeDef | null>(null);

  /** The save may spell a title slightly differently from the catalogue (e.g. a trailing period). */
  const savedTitle = (tape: TapeDef, list: string[]) => list.find((title) => findTape(title) === tape);
  const unknownTapes = tapes.filter((title) => !findTape(title));

  function toggle(tape: TapeDef, on: boolean) {
    const stripped = (list: string[]) => list.filter((title) => findTape(title) !== tape);
    set('tapes', on ? [...stripped(tapes), tape.title] : stripped(tapes));
    // Story logs are also tracked in `logs` by the game.
    if (tape.type === 'LOG' && (on || logs.length)) {
      set('logs', on ? [...stripped(logs), tape.title] : stripped(logs));
    }
  }

  const collected = TAPES.filter((tape) => savedTitle(tape, tapes)).length;

  return (
    <>
      <PageHeader
        title="Tapes"
        description={`${collected} of ${TAPES.length} collected. Training tapes are granted automatically when the profile is created.`}
        actions={
          <>
            <Button variant="outline" onClick={() => set('tapes', [...TAPES.map((tape) => tape.title), ...unknownTapes])}>
              Collect all
            </Button>
            <Button variant="ghost" onClick={() => set('tapes', [])}>
              Clear
            </Button>
          </>
        }
      />

      {TAPE_GROUPS.map((group) => {
        const list = TAPES.filter((tape) => tape.type === group.type);
        if (list.length === 0) return null;
        return (
          <Section key={group.type} title={group.label}>
            {list.map((tape) => {
              const owned = Boolean(savedTitle(tape, tapes));
              const isPlaying = playing?.title === tape.title;
              return (
                <div key={tape.title} className="flex items-center gap-3 px-4 py-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!tape.audio}
                    aria-label={isPlaying ? `Stop ${tape.title}` : `Play ${tape.title}`}
                    onClick={() => setPlaying(isPlaying ? null : tape)}
                    className={cn(isPlaying && 'bg-primary/10 text-primary hover:text-primary')}
                  >
                    {isPlaying ? <Pause /> : <Play />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-foreground">{tape.title}</p>
                    {tape.transcription && tape.transcription.length > 3 ? (
                      <p className="truncate text-[11px] text-muted-foreground">{tape.transcription.split('\n').find(Boolean)}</p>
                    ) : null}
                  </div>
                  {tape.story ? <Pill tone="accent">Story</Pill> : null}
                  <Switch checked={owned} onCheckedChange={(on) => toggle(tape, on)} aria-label={`Collected ${tape.title}`} />
                </div>
              );
            })}
          </Section>
        );
      })}

      {unknownTapes.length > 0 ? (
        <Section title="Not in catalogue" description="In this save, but not found in the extracted game data." flush>
          <div className="flex flex-wrap gap-1.5">
            {unknownTapes.map((title) => (
              <button key={title} type="button" onClick={() => set('tapes', tapes.filter((entry) => entry !== title))}>
                <Pill className="hover:border-destructive/40 hover:text-destructive">{title} ×</Pill>
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {playing ? <TapePlayer tape={playing} onClose={() => setPlaying(null)} /> : null}
    </>
  );
}

function TapePlayer({ tape, onClose }: { tape: TapeDef; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const typed = Math.min(tape.transcription.length, Math.floor(time / Math.max(tape.typeSpeed, 0.01)));

  useEffect(() => {
    setTime(0);
    setPaused(false);
    void audioRef.current?.play().catch(() => setPaused(true));
  }, [tape]);

  return (
    <div className="sticky bottom-4 z-10 mt-4 rounded-xl border bg-popover p-3 shadow-popover">
      <audio
        ref={audioRef}
        src={tape.audio ? assetPath(tape.audio) : undefined}
        loop={tape.loop}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => !tape.loop && onClose()}
      />
      <div className="flex items-center gap-3">
        <Button
          size="icon-sm"
          onClick={() => (paused ? void audioRef.current?.play() : audioRef.current?.pause())}
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {paused ? <Play /> : <Pause />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[12px] font-medium">{tape.title}</p>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
              {formatTime(time)} / {formatTime(duration)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(event) => {
              if (audioRef.current) audioRef.current.currentTime = Number(event.target.value);
            }}
            className="mt-1 h-1 w-full cursor-pointer accent-[var(--primary)]"
            aria-label="Seek"
          />
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close player">
          <X />
        </Button>
      </div>
      {tape.transcription.trim().length > 3 ? (
        <pre className="mt-3 max-h-48 overflow-y-auto rounded-md bg-surface p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {tape.transcription.slice(0, typed).trimEnd()}
          <span className="ml-px inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-primary/70" />
        </pre>
      ) : null}
    </div>
  );
}
