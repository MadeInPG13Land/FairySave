'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Pill } from '@/components/kit';
import { isObject, type JsonObject } from '@/lib/save';
import { useEditor, type SaveDoc } from '@/lib/store';

export function JsonEditor({ doc }: { doc: SaveDoc }) {
  const replaceData = useEditor((state) => state.replaceData);
  const [text, setText] = useState(() => JSON.stringify(doc.data, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastApplied = useRef<JsonObject>(doc.data);

  // Pick up changes made elsewhere (revert, reload, switching files).
  useEffect(() => {
    if (doc.data !== lastApplied.current) {
      lastApplied.current = doc.data;
      setText(JSON.stringify(doc.data, null, 2));
      setError(null);
    }
  }, [doc.data]);

  function onChange(next: string) {
    setText(next);
    try {
      const parsed = JSON.parse(next);
      if (!isObject(parsed)) throw new Error('The save must be a JSON object.');
      setError(null);
      lastApplied.current = parsed;
      replaceData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <PageHeader
        title="JSON"
        description="The decrypted save. Edits apply as soon as the JSON is valid."
        actions={
          <>
            {error ? (
              <Pill tone="negative">
                <AlertTriangle className="size-3" /> Invalid
              </Pill>
            ) : (
              <Pill tone="positive">
                <Check className="size-3" /> Valid
              </Pill>
            )}
            <Button
              variant="outline"
              disabled={Boolean(error)}
              onClick={() => setText(JSON.stringify(JSON.parse(text), null, 2))}
            >
              Format
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />} Copy
            </Button>
          </>
        }
      />
      {error ? <p className="mb-2 font-mono text-[11px] text-destructive">{error}</p> : null}
      <textarea
        value={text}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none rounded-lg border bg-card p-4 font-mono text-[11px] leading-relaxed text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
      />
      <p className="mt-2 text-[11px] text-subtle-foreground tabular-nums">
        {text.split('\n').length.toLocaleString()} lines · {text.length.toLocaleString()} characters
      </p>
    </div>
  );
}
