import type { ReactNode } from 'react';

/** Non-overlapping merged ranges for all needle occurrences (longer phrases win when nested). */
export function mergedHighlightRanges(text: string, needles: string[]): [number, number][] {
  const ranges: [number, number][] = [];
  const sorted = [...new Set(needles.filter((n) => typeof n === 'string' && n.trim().length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  for (const p of sorted) {
    let i = 0;
    while (i < text.length) {
      const j = text.indexOf(p, i);
      if (j < 0) break;
      ranges.push([j, j + p.length]);
      i = j + p.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    if (!merged.length || merged[merged.length - 1][1] < r[0]) {
      merged.push([r[0], r[1]]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
    }
  }
  return merged;
}

export function TextWithHighlights({
  text,
  phrases,
  className,
}: {
  text: string;
  phrases: string[];
  className?: string;
}) {
  const ranges = mergedHighlightRanges(text, phrases);
  if (!ranges.length) {
    return <span className={className}>{text}</span>;
  }
  const parts: ReactNode[] = [];
  let c = 0;
  ranges.forEach(([a, b], i) => {
    if (a > c) {
      parts.push(<span key={`t${i}-${c}`}>{text.slice(c, a)}</span>);
    }
    parts.push(
      <mark key={`m${i}`} className="rounded-sm bg-amber-200/90 px-0.5 text-inherit">
        {text.slice(a, b)}
      </mark>,
    );
    c = b;
  });
  if (c < text.length) {
    parts.push(<span key="end">{text.slice(c)}</span>);
  }
  return <span className={className}>{parts}</span>;
}
