'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Check, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEditorStore } from '@/lib/store';
import { getActiveTab } from '@/lib/editor-tab';

export function JsonEditor() {
  const { tabs, activeTabId, setRawJson, setLastAction } = useEditorStore();
  const activeTab = getActiveTab(tabs, activeTabId);
  const [localJson, setLocalJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!activeTab) {
      setLocalJson('');
      return;
    }

    if (activeTab.worldData) {
      setLocalJson(JSON.stringify(activeTab.worldData, null, 2));
    } else if (activeTab.playerData) {
      setLocalJson(JSON.stringify(activeTab.playerData, null, 2));
    } else if (activeTab.rawJson) {
      setLocalJson(activeTab.rawJson);
    } else {
      setLocalJson('');
    }
  }, [activeTab]);

  const handleJsonChange = (value: string) => {
    setLocalJson(value);
    setError(null);
    
    try {
      JSON.parse(value);
      setRawJson(value);
    } catch (e) {
      if (value.trim()) {
        setError('Invalid JSON syntax');
      }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(localJson);
    setCopied(true);
    setLastAction('Copied JSON to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(localJson);
      setLocalJson(JSON.stringify(parsed, null, 2));
      setError(null);
      setLastAction('Formatted JSON');
    } catch {
      setError('Cannot format invalid JSON');
    }
  };

  const isEmpty = !localJson.trim();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Raw JSON Editor</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Advanced</span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleFormat}
            disabled={isEmpty || !!error}
          >
            Format
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopy}
            disabled={isEmpty}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 relative">
        {isEmpty ? (
          <div className="h-full flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20">
            <div className="text-center">
              <Code className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No data loaded</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Upload a save file or paste JSON here
              </p>
            </div>
          </div>
        ) : (
          <Textarea
            value={localJson}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="h-full w-full font-mono text-sm bg-input border-border resize-none focus-visible:ring-primary"
            placeholder="Paste or edit JSON here..."
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {localJson.split('\n').length} lines • {localJson.length.toLocaleString()} characters
        </span>
        <span>
          Edit JSON directly or use the guided editor tabs
        </span>
      </div>
    </div>
  );
}
