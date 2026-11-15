'use client';

/**
 * neofetch-style block: ASCII art beside a title, an underline, key/value rows
 * and colour swatches. `typed` marks the parts for the start screen's typing
 * animation (the art draws in by row, each line types out).
 */
import type { Line } from './commands';

export function Fetch({ line, className = '', typed = false }: { line: Extract<Line, { kind: 'fetch' }>; className?: string; typed?: boolean }) {
  const type = typed ? { 'data-type': '' } : {};
  return (
    <div className={`term-fetch ${className}`}>
      <pre className="term-fetch-art" aria-label="made in fairyland logo" {...(typed ? { 'data-type-art': '' } : {})}>
        {line.art}
      </pre>
      <div className="term-fetch-info">
        <p className="term-fetch-title" {...type}>
          {line.title}
        </p>
        <p className="term-faint" aria-hidden {...type}>
          {'-'.repeat(line.title.length)}
        </p>
        {line.rows.map((row) => (
          <p key={row.key} {...type}>
            <span className="term-fetch-key">{row.key}</span>
            <span className="term-faint">: </span>
            {row.href ? (
              <a className="term-link" href={row.href} target="_blank" rel="noopener noreferrer">
                {row.value}
              </a>
            ) : (
              <span>{row.value}</span>
            )}
          </p>
        ))}
        <p className="term-fetch-swatches" aria-hidden {...type}>
          {['fetch-0', 'red', 'mint', 'gold', 'cyan', 'magenta', 'violet', 'fg'].map((tone) => (
            <span key={tone} className={`term-swatch term-swatch--${tone}`} />
          ))}
        </p>
      </div>
    </div>
  );
}
