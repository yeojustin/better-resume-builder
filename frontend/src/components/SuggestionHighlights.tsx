import { Copy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LineEdit } from '../store/useStore';
import { mergedHighlightRanges } from '../utils/textHighlights';
import { useMediaQuery } from '../utils/useMediaQuery';

function buildBeforeMap(edits: LineEdit[]): Map<string, LineEdit> {
  const m = new Map<string, LineEdit>();
  for (const e of edits) {
    const b = (e.before ?? '').trim();
    if (b) m.set(b, e);
  }
  return m;
}

function MarkSuggestion({
  text,
  edit,
  useTap,
}: {
  text: string;
  edit: LineEdit;
  useTap: boolean;
}) {
  const [tapOpen, setTapOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bubblePlacement, setBubblePlacement] = useState<'top' | 'bottom'>('top');
  const [bubbleLeftPx, setBubbleLeftPx] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const after = (edit.after ?? '').trim();
  const note = (edit.note ?? (edit as { rationale?: string }).rationale ?? '').trim();

  const copySuggested = useCallback(async () => {
    if (!after) return;
    try {
      await navigator.clipboard.writeText(after);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }, [after]);

  const recalcBubblePosition = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tooltipRef.current;
    if (!wrap || !tip) return;
    const page = wrap.closest('[data-resume-page]') as HTMLElement | null;
    if (!page) return;

    const wrapRect = wrap.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    const pad = 8;
    const half = tipRect.width / 2;

    const centerInPage = wrapRect.left + wrapRect.width / 2 - pageRect.left;
    const clampedCenter = Math.min(pageRect.width - pad - half, Math.max(pad + half, centerInPage));
    const wrapLeftInPage = wrapRect.left - pageRect.left;
    setBubbleLeftPx(clampedCenter - wrapLeftInPage);

    const shouldFlipBottom = wrapRect.top - tipRect.height - pad < pageRect.top + pad;
    setBubblePlacement(shouldFlipBottom ? 'bottom' : 'top');
  }, []);

  useEffect(() => {
    if (!useTap || !tapOpen) return;
    const close = (ev: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(ev.target as Node)) setTapOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [useTap, tapOpen]);

  useEffect(() => {
    recalcBubblePosition();
    window.addEventListener('resize', recalcBubblePosition);
    window.addEventListener('scroll', recalcBubblePosition, true);
    return () => {
      window.removeEventListener('resize', recalcBubblePosition);
      window.removeEventListener('scroll', recalcBubblePosition, true);
    };
  }, [recalcBubblePosition]);

  return (
    <span ref={wrapRef} className="group/hl relative inline align-baseline">
      <mark
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          if (useTap) setTapOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (useTap && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setTapOpen((o) => !o);
          }
        }}
        onMouseEnter={() => recalcBubblePosition()}
        onFocus={() => recalcBubblePosition()}
        className="cursor-pointer rounded-sm bg-amber-200/90 px-0.5 text-inherit underline decoration-amber-600/50 decoration-dotted underline-offset-2 dark:bg-amber-900/50 dark:decoration-amber-400/40 md:cursor-default md:no-underline"
      >
        {text}
      </mark>
      {/* Desktop / fine pointer: hover tooltip above */}
      <span
        ref={tooltipRef}
        role="tooltip"
        className={`invisible absolute z-[200] w-[min(92vw,18rem)] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-2.5 text-left text-[11px] leading-snug opacity-0 shadow-lg ring-1 ring-black/5 transition-opacity duration-150 group-hover/hl:visible group-hover/hl:opacity-100 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-white/10 max-md:hidden ${
          bubblePlacement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}
        style={{ left: `${bubbleLeftPx}px` }}
        onMouseEnter={() => recalcBubblePosition()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Suggested</p>
          <button
            type="button"
            onClick={() => void copySuggested()}
            className="inline-flex items-center gap-1 rounded border border-zinc-200 px-1.5 py-0.5 text-[9px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Copy size={10} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-zinc-900 dark:text-zinc-100">{after || '—'}</p>
        {note ? <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">{note}</p> : null}
      </span>
      {/* Mobile / coarse pointer: tap panel below */}
      {useTap && tapOpen ? (
        <span
          role="dialog"
          aria-label="Suggested change"
          className="absolute left-0 top-full z-[200] mt-1 w-[min(92vw,20rem)] rounded-lg border border-zinc-200 bg-white p-2.5 text-left text-[11px] leading-snug shadow-lg dark:border-zinc-600 dark:bg-zinc-900 md:hidden"
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Suggested</p>
          <p className="mt-1 text-zinc-900 dark:text-zinc-100">{after || '—'}</p>
          {note ? <p className="mt-1.5 text-zinc-500 dark:text-zinc-400">{note}</p> : null}
          <button
            type="button"
            onClick={() => void copySuggested()}
            className="mt-2 inline-flex items-center gap-1 rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Copy size={10} /> {copied ? 'Copied' : 'Copy'}
          </button>
          <p className="mt-2 text-[9px] text-zinc-400 dark:text-zinc-500">Tap highlight again or outside to close</p>
        </span>
      ) : null}
    </span>
  );
}

export function SuggestionHighlights({
  text,
  lineEdits,
  className,
}: {
  text: string;
  lineEdits: LineEdit[];
  className?: string;
}) {
  const byBefore = useMemo(() => buildBeforeMap(lineEdits), [lineEdits]);
  const phrases = useMemo(() => [...byBefore.keys()], [byBefore]);
  const ranges = useMemo(() => mergedHighlightRanges(text, phrases), [text, phrases]);
  const coarsePointer = useMediaQuery('(hover: none), (pointer: coarse)');

  if (!ranges.length) {
    return <span className={className}>{text}</span>;
  }

  const parts: ReactNode[] = [];
  let c = 0;
  ranges.forEach(([a, b], i) => {
    if (a > c) {
      parts.push(<span key={`t${i}-${c}`}>{text.slice(c, a)}</span>);
    }
    const slice = text.slice(a, b);
    const edit = byBefore.get(slice);
    if (edit) {
      parts.push(<MarkSuggestion key={`m${i}`} text={slice} edit={edit} useTap={coarsePointer} />);
    } else {
      parts.push(
        <mark key={`m${i}`} className="rounded-sm bg-amber-200/90 px-0.5 dark:bg-amber-900/50">
          {slice}
        </mark>,
      );
    }
    c = b;
  });
  if (c < text.length) {
    parts.push(<span key="end">{text.slice(c)}</span>);
  }
  return <span className={className}>{parts}</span>;
}
