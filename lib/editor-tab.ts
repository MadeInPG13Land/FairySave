import { FileAccessStatus, FileStatus, type EditorTab } from '@/lib/types';

export function getActiveTab(tabs: EditorTab[], activeTabId: string) {
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
}

export function tabHasData(tab: EditorTab | undefined) {
  return Boolean(tab?.playerData || tab?.worldData || tab?.rawJson.trim());
}

export function canTabDirectSave(tab: EditorTab | undefined) {
  return Boolean(
    tab?.fileHandle &&
      (tab.fileAccessStatus === FileAccessStatus.Granted ||
        tab.fileAccessStatus === FileAccessStatus.Prompt),
  );
}

export function canTabRefresh(tab: EditorTab | undefined) {
  return Boolean(
    tab?.fileHandle &&
      (tab.fileAccessStatus === FileAccessStatus.Granted ||
        tab.fileAccessStatus === FileAccessStatus.Unsupported),
  );
}

export function tabNeedsPermissionPrompt(tab: EditorTab | undefined) {
  return Boolean(
    tab?.fileHandle &&
      (tab.fileAccessStatus === FileAccessStatus.Prompt ||
        tab.fileAccessStatus === FileAccessStatus.Denied),
  );
}

export function getFileStatusBadgeLabel(status: FileStatus | undefined) {
  switch (status) {
    case FileStatus.Ready:
      return 'Saved';
    case FileStatus.Modified:
      return 'Modified';
    case FileStatus.Error:
      return 'Error';
    default:
      return null;
  }
}
