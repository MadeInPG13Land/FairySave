'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronDown, FileText, Minimize2, Pause, Play, Volume2 } from 'lucide-react';
import { EditorCard } from './editor-card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface TapeOption {
  value: string;
  label: string;
  audioSrc?: string;
  transcription?: string;
  typeSpeed?: number;
}

const TAPE_OPTIONS: TapeOption[] = [
  {
    value: 'kissin in the vader',
    label: 'kissin in the vader',
    audioSrc: '/audio/tapes/kissin in the vader.ogg',
    transcription: '*elevator music playing*',
    typeSpeed: 0.057,
  },
  {
    value: 'Influence',
    label: 'Influence',
    audioSrc: '/audio/tapes/Influence.ogg',
    transcription: '*groovy music playing*',
    typeSpeed: 0.057,
  },
  {
    value: 'america the beautiful',
    label: 'america the beautiful',
    audioSrc: '/audio/tapes/America_The_Beautiful.ogg',
    transcription: '*patriotic music playing*',
    typeSpeed: 0.057,
  },
  {
    value: 'the champions of 12 a.m',
    label: 'the champions of 12 a.m',
    audioSrc: '/audio/tapes/The Champions of 12 A.M.ogg',
    transcription: "It's time to clock in.\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n  -Composed by Uncle Larry",
    typeSpeed: 0.09,
  },
  {
    value: 'hollow song',
    label: 'hollow song',
    audioSrc: '/audio/tapes/last song remix.wav',
    transcription: 'can you remember their faces?\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n    - Alex H.',
    typeSpeed: 0.14,
  },
];

const LOG_OPTIONS: TapeOption[] = [
  {
    value: 'PLANTATION ENTRY',
    label: 'PLANTATION ENTRY',
    audioSrc: '/audio/tapes/PLANTATION ENTRY TAPE.ogg',
    transcription:
      "Data-deck log, October 15th, 1990. Richards here with the Louisiana Workforce. Command's got us checking out this old plantation manor - says it's of special interest, wants a full report on anything we find inside. Just made entry through the front doors... you can hear that wind howling outside. At least we're out of that bitter cold now. Grand staircase ahead of us, doorways leading everywhere. Wilson and Martinez are taking point, checking these ground floor rooms. Not sure what Command expects us to find but- hold on... Johnson, you see something moving down that hall?\n\n[Sharp metallic snap, followed by an agonized scream]\n\nOH SHIT WILSON! HE'S CAUGHT IN SOMETHING, SOME KIND OF METAL TRAP! HIS LEG-\n\n[Single echoing gunshot]\n\nWHAT THE FUCK WAS THAT!?\n\n[Second echoing gunshot, followed by a cry of pain]\n\nRUN! THIS WAY!\n\n[Unintelligible]",
    typeSpeed: 0.059,
  },
  {
    value: 'HIGHRISE ENTRY',
    label: 'HIGHRISE ENTRY',
    audioSrc: '/audio/tapes/datadeckloghighrisev2.wav',
    transcription: '...',
    typeSpeed: 0.059,
  },
];

interface TapesSectionProps {
  tapes: string[];
  logs: string[];
  onTapesChange: (nextValues: string[]) => void;
  onLogsChange: (nextValues: string[]) => void;
}

function isSelectedLog(value: string, tapes: string[] = [], logs: string[] = []) {
  if (value === 'HIGHRISE ENTRY') {
    return tapes.includes(value) || logs.includes(value);
  }

  return logs.includes(value);
}

function isSelectedTape(value: string, tapes: string[] = [], logs: string[] = []) {
  return tapes.includes(value) || logs.includes(value);
}

export function TapesSection({ tapes, logs, onTapesChange, onLogsChange }: TapesSectionProps) {
  const [activeTape, setActiveTape] = useState<string | null>(null);
  const [dockTape, setDockTape] = useState<string | null>(null);
  const [typedLength, setTypedLength] = useState(0);
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  const [volume, setVolume] = useState(78);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const safeTapes = tapes ?? [];
  const safeLogs = logs ?? [];

  const selectedTapes = TAPE_OPTIONS.filter((option) => safeTapes.includes(option.value));
  const selectedLogs = LOG_OPTIONS.filter((option) => isSelectedLog(option.value, safeTapes, safeLogs));
  const totalCollected = selectedTapes.length + selectedLogs.length;
  const totalAvailable = TAPE_OPTIONS.length + LOG_OPTIONS.length;
  const transcriptOption =
    [...TAPE_OPTIONS, ...LOG_OPTIONS].find((option) => option.value === dockTape) ?? null;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) {
      setCurrentTime(0);
      setDuration(0);
    }
  }, [activeTape]);

  useEffect(() => {
    if (!transcriptOption?.transcription) {
      setTypedLength(0);
      return;
    }

    setTypedLength(0);

    const delay = Math.max(15, Math.round((transcriptOption.typeSpeed ?? 0.06) * 1000));
    const text = transcriptOption.transcription;
    let index = 0;

    const timer = window.setInterval(() => {
      index += 1;
      setTypedLength(index);

      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, delay);

    return () => window.clearInterval(timer);
  }, [transcriptOption]);

  function stopActiveIfNeeded(value: string) {
    if (activeTape === value && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setActiveTape(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }

    if (dockTape === value) {
      setDockTape(null);
      setIsDockMinimized(false);
    }
  }

  function toggleTape(value: string) {
    const existsInTapes = safeTapes.includes(value);
    const existsInLogs = safeLogs.includes(value);

    if (existsInTapes || existsInLogs) {
      onTapesChange(safeTapes.filter((entry) => entry !== value));
      if (existsInLogs) {
        onLogsChange(safeLogs.filter((entry) => entry !== value));
      }
      stopActiveIfNeeded(value);
      return;
    }

    onTapesChange([...safeTapes, value]);
  }

  function toggleLog(value: string) {
    const storeInTapes = value === 'HIGHRISE ENTRY';
    const existsInTarget = storeInTapes ? safeTapes.includes(value) : safeLogs.includes(value);

    if (existsInTarget) {
      if (storeInTapes) {
        onTapesChange(safeTapes.filter((entry) => entry !== value));
      } else {
        onLogsChange(safeLogs.filter((entry) => entry !== value));
      }
      stopActiveIfNeeded(value);
      return;
    }

    if (storeInTapes) {
      onTapesChange([...safeTapes, value]);
      if (safeLogs.includes(value)) {
        onLogsChange(safeLogs.filter((entry) => entry !== value));
      }
      return;
    }

    onLogsChange([...safeLogs, value]);
  }

  async function togglePlayback(option: TapeOption) {
    if (!option.audioSrc) {
      return;
    }

    if (activeTape === option.value && audioRef.current) {
      if (audioRef.current.paused) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(option.audioSrc);
    audio.volume = volume / 100;
    audioRef.current = audio;
    setActiveTape(option.value);
    setDockTape(option.value);
    setIsDockMinimized(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    audio.addEventListener('loadedmetadata', () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audio.addEventListener(
      'ended',
      () => {
        audioRef.current = null;
        setActiveTape(null);
        setIsPlaying(false);
        setCurrentTime(0);
      },
      { once: true },
    );

    try {
      await audio.play();
    } catch {
      audioRef.current = null;
      setActiveTape(null);
      setDockTape(null);
      setIsPlaying(false);
    }
  }

  function handleSeek(values: number[]) {
    const nextTime = values[0] ?? 0;
    setCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  }

  function formatTime(seconds: number) {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  }

  return (
    <>
      <EditorCard
        title="Tapes"
        description="Collected tapes and logs from this save."
        icon={<AudioLines className="h-4 w-4" />}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-white/10 bg-black/20 px-3 shadow-none hover:bg-black/30"
              >
                Edit
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {totalCollected} / {totalAvailable}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Tapes</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {TAPE_OPTIONS.map((option) => {
                const enabled = isSelectedTape(option.value, safeTapes, safeLogs);

                return (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={(event) => {
                      event.preventDefault();
                      toggleTape(option.value);
                    }}
                    className={cn(
                      'cursor-pointer justify-between',
                      enabled ? 'text-emerald-400 focus:text-emerald-300' : 'text-red-400 focus:text-red-300',
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                      {enabled ? 'On' : 'Off'}
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Logs</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LOG_OPTIONS.map((option) => {
                const enabled = isSelectedLog(option.value, safeTapes, safeLogs);

                return (
                  <DropdownMenuItem
                    key={option.value}
                    onSelect={(event) => {
                      event.preventDefault();
                      toggleLog(option.value);
                    }}
                    className={cn(
                      'cursor-pointer justify-between',
                      enabled ? 'text-emerald-400 focus:text-emerald-300' : 'text-red-400 focus:text-red-300',
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                      {enabled ? 'On' : 'Off'}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-3">
            <div className="mb-3 flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Tapes</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {selectedTapes.length}
              </span>
            </div>

            {selectedTapes.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {selectedTapes.map((option) => {
                  const optionIsPlaying = activeTape === option.value && isPlaying;

                  return (
                    <div
                      key={option.value}
                      className="flex items-center gap-3 rounded-lg border border-white/8 bg-black/12 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => void togglePlayback(option)}
                        disabled={!option.audioSrc}
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
                          option.audioSrc
                            ? optionIsPlaying
                              ? 'border-primary/25 bg-primary/12 text-primary hover:bg-primary/18'
                              : 'border-white/10 bg-black/20 text-foreground hover:border-white/16 hover:bg-white/[0.05]'
                            : 'cursor-not-allowed border-white/8 bg-black/10 text-muted-foreground/60',
                        )}
                      >
                        {optionIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{option.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {option.audioSrc ? (optionIsPlaying ? 'Now playing' : 'Preview available') : 'Audio preview unavailable'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/8 bg-black/10 px-3 py-4 text-xs text-muted-foreground">
                No tapes collected.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-3">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Logs</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {selectedLogs.length}
              </span>
            </div>

            {selectedLogs.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {selectedLogs.map((option) => {
                  const optionIsPlaying = activeTape === option.value && isPlaying;

                  return (
                    <div
                      key={option.value}
                      className="flex items-center gap-3 rounded-lg border border-white/8 bg-black/12 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => void togglePlayback(option)}
                        disabled={!option.audioSrc}
                        className={cn(
                          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
                          option.audioSrc
                            ? optionIsPlaying
                              ? 'border-primary/25 bg-primary/12 text-primary hover:bg-primary/18'
                              : 'border-white/10 bg-black/20 text-foreground hover:border-white/16 hover:bg-white/[0.05]'
                            : 'cursor-not-allowed border-white/8 bg-black/10 text-muted-foreground/60',
                        )}
                      >
                        {optionIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{option.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {option.audioSrc ? (optionIsPlaying ? 'Now playing' : 'Preview available') : 'Log entry'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/8 bg-black/10 px-3 py-4 text-xs text-muted-foreground">
                No logs collected.
              </div>
            )}
          </div>
        </div>
      </EditorCard>

      {transcriptOption ? (
        <div className="fixed bottom-5 right-5 z-40">
          {isDockMinimized ? (
            <button
              type="button"
              onClick={() => setIsDockMinimized(false)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#111216]/94 text-primary shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:border-primary/30 hover:bg-[#17191f]"
              aria-label="Open media dock"
            >
              <AudioLines className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-[360px] rounded-lg border border-white/10 bg-[#111216]/94 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Now Playing
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{transcriptOption.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDockMinimized(true)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition hover:border-white/15 hover:bg-white/[0.05] hover:text-foreground"
                  aria-label="Minimize media dock"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void togglePlayback(transcriptOption)}
                    disabled={!transcriptOption.audioSrc}
                    className={cn(
                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all',
                      transcriptOption.audioSrc
                        ? activeTape === transcriptOption.value && isPlaying
                          ? 'border-primary/25 bg-primary/12 text-primary hover:bg-primary/18'
                          : 'border-white/10 bg-black/20 text-foreground hover:border-white/16 hover:bg-white/[0.05]'
                        : 'cursor-not-allowed border-white/8 bg-black/10 text-muted-foreground/60',
                    )}
                  >
                    {activeTape === transcriptOption.value && isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Transcript
                    </p>
                  </div>
                </div>

                <div className="h-40 overflow-y-auto rounded-md border border-white/8 bg-black/20 px-3 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {transcriptOption.transcription
                      ? transcriptOption.transcription.slice(0, typedLength)
                      : 'No transcript available.'}
                  </p>
                </div>

                <div className="space-y-2 rounded-md border border-white/8 bg-black/15 px-3 py-3">
                  <div className="flex items-center justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <Slider
                    value={[Math.min(currentTime, duration || currentTime)]}
                    min={0}
                    max={Math.max(duration, 0.1)}
                    step={0.1}
                    onValueChange={handleSeek}
                    disabled={!duration}
                    className="flex-1"
                  />
                </div>

                <div className="flex items-center gap-3 rounded-md border border-white/8 bg-black/15 px-3 py-2.5">
                  <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Slider
                    value={[volume]}
                    max={100}
                    step={1}
                    onValueChange={(values) => setVolume(values[0] ?? 0)}
                    className="flex-1"
                  />
                  <span className="w-8 text-right text-xs font-medium tabular-nums text-muted-foreground">
                    {volume}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
