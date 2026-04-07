'use client';

import { FileHero } from '@/components/file-hero';
import { EmptyTabState } from '@/components/empty-tab-state';
import { PlayerEditor } from '@/components/player-editor';
import { WorldEditor } from '@/components/world-editor';
import { JsonEditor } from '@/components/json-editor';
import { getActiveTab } from '@/lib/editor-tab';
import { useEditorStore } from '@/lib/store';
import { TabKind } from '@/lib/types';

export default function FairySaveToolPage() {
  const { tabs, activeTabId } = useEditorStore();
  const activeTab = getActiveTab(tabs, activeTabId);

  const renderEditor = () => {
    if (!activeTab) {
      return null;
    }

    if (activeTab.kind === TabKind.Empty) {
      return null;
    }

    if (activeTab.jsonMode) {
      return <JsonEditor />;
    }

    switch (activeTab.kind) {
      case TabKind.Player:
        return <PlayerEditor />;
      case TabKind.World:
        return <WorldEditor />;
      case TabKind.Json:
        return <JsonEditor />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.10),_transparent_28%),linear-gradient(180deg,#111114_0%,#0d0d10_100%)]">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[#17171b]">
        <FileHero />
        <main className="min-h-0 flex-1 overflow-hidden bg-[#151519]">
          <div className="h-full w-full overflow-y-auto px-5 pb-8 pt-4 md:px-7 md:pb-10 md:pt-5">
            <div className="mx-auto w-full max-w-[1180px]">
              {activeTab?.kind === TabKind.Empty ? <EmptyTabState /> : renderEditor()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
