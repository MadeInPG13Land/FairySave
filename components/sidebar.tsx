'use client';

import { useEffect, useState } from 'react';
import { Braces, Check, Download, RefreshCw, RotateCcw, Save, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { THEMES, themeInfo } from './themes';
import { CATALOGUE_DATE, GAME_VERSION } from '@/lib/game-data';
import { assetPath } from '@/lib/asset-path';
import { docChanges, useActiveDoc, useEditor } from '@/lib/store';
import { cn } from '@/lib/utils';
import { resolveSection, sectionsFor } from './sections';

export { displayName } from './tabs';

/** The app's title, top left, outside the page: logo, name and search. */
export function AppTitle({ onOpenCommand }: { onOpenCommand: () => void }) {
  return (
    <div className="flex w-52 shrink-0 items-center gap-2 self-center pr-2 pl-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={assetPath('/fairysavetool-logo.png')} alt="" className="size-5 rounded" />
      <span className="text-[12px] font-semibold text-foreground">FairySave</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onOpenCommand} aria-label="Search">
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Search · Ctrl K</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** App-wide bits for the right of the title row: game data version and theme. */
export function AppMeta() {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 self-center pl-3">
      <span className="text-[10px] text-subtle-foreground" title={`Catalogue extracted ${CATALOGUE_DATE}`}>
        Game data v{GAME_VERSION ?? '?'}
      </span>
      <ThemeToggle />
    </div>
  );
}

/**
 * The open tab's sections, as a column inside the page: they belong to that
 * save, so they live in its page rather than beside it.
 */
export function SectionNav() {
  const doc = useActiveDoc();
  const setSection = useEditor((state) => state.setSection);
  const setView = useEditor((state) => state.setView);
  const save = useEditor((state) => state.save);
  const revert = useEditor((state) => state.revert);
  const reload = useEditor((state) => state.reload);
  if (!doc) return null;
  const sections = sectionsFor(doc.kind);
  const changes = docChanges(doc);
  // Settings never write in place: they always come out as a .reg to double-click.
  const inPlace = Boolean(doc.handle) && doc.kind !== 'settings';
  const current = resolveSection(doc.kind, doc.section);
  const json = doc.view === 'json' || sections.length === 0;

  return (
    <nav className="app-section-nav flex w-52 shrink-0 flex-col overflow-y-auto px-2 py-3" aria-label="Sections">
      {/* The save's own actions first, styled like the sections. */}
      <div className="mb-4">
        <p className="mb-1 px-2 text-[10px] font-medium text-subtle-foreground">File</p>
        <ul className="space-y-px">
          <NavItem
            icon={inPlace ? Save : Download}
            label={inPlace ? 'Save' : 'Export'}
            hint={
              inPlace
                ? 'write back to the file · Ctrl S'
                : doc.kind === 'settings'
                  ? 'download a .reg to double-click · Ctrl S'
                  : 'download the edited save · Ctrl S'
            }
            emphasis={changes > 0}
            onClick={() => void save()}
          />
          {changes > 0 ? (
            <NavItem icon={RotateCcw} label="Revert" count={changes} hint={`undo ${changes} unsaved ${changes === 1 ? 'change' : 'changes'}`} onClick={revert} />
          ) : null}
          {inPlace ? <NavItem icon={Download} label="Download a copy" onClick={() => void save({ download: true })} /> : null}
          {inPlace ? <NavItem icon={RefreshCw} label="Reload from disk" onClick={() => void reload()} /> : null}
        </ul>
      </div>
      <p className="mb-1 px-2 text-[10px] font-medium text-subtle-foreground">
        {doc.kind === 'player' ? 'Profile' : doc.kind === 'world' ? 'World' : doc.kind === 'settings' ? 'Settings' : 'Data'}
      </p>
      <ul className="space-y-px">
        {sections.map((section) => (
          <NavItem
            key={section.id}
            icon={section.icon}
            label={section.label}
            active={!json && current?.id === section.id}
            onClick={() => setSection(section.id)}
          />
        ))}
        <NavItem icon={Braces} label="JSON" active={json} onClick={() => setView('json')} />
      </ul>

    </nav>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  emphasis = false,
  count,
  hint,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  /** Draws the eye without looking selected (e.g. Save when there are changes). */
  emphasis?: boolean;
  count?: number;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        title={hint}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[12px] transition-colors',
          active
            ? 'bg-accent font-medium text-foreground'
            : emphasis
              ? 'font-medium text-foreground hover:bg-accent/70'
              : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
        )}
      >
        <Icon className={cn('size-4 shrink-0', active || emphasis ? 'text-foreground' : 'text-subtle-foreground')} />
        <span className="truncate">{label}</span>
        {count ? <span className="ml-auto rounded bg-warning/15 px-1.5 text-[10px] font-medium text-warning">{count}</span> : null}
      </button>
    </li>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The saved theme is only known in the browser; render the default until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = themeInfo(mounted ? theme : undefined);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Theme: ${current.label}`}>
          <current.icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {THEMES.map((option) => (
          <DropdownMenuItem key={option.id} onSelect={() => setTheme(option.id)}>
            <option.icon /> {option.label}
            {option.id === current.id ? <Check className="ml-auto" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
