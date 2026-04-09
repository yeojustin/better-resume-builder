import { useMemo, type ReactNode } from 'react';
import type { LineEdit } from '../store/useStore';
import { SuggestionHighlights } from './SuggestionHighlights';

const US_LETTER_PX = { w: 612, h: 792 };
const PADDING = 40;
const CONTENT_MAX_H = US_LETTER_PX.h - PADDING * 2;

type Seg = { key: string; est: number; node: ReactNode };

function estLines(text: string, cpl = 66) {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / cpl));
}

function estBulletH(text: string) {
  return estLines(text, 64) * 15 + 6;
}

function buildSegments(content: unknown, lineEdits: LineEdit[]): Seg[] {
  const segs: Seg[] = [];
  const c = content as { personalInfo?: Record<string, unknown>; sections?: unknown[] } | null;

  const sections = Array.isArray(c?.sections) ? c.sections : [];
  sections.forEach((sec: unknown, si: number) => {
    const s = sec as { sectionTitle?: string; items?: unknown[] };
    const st = typeof s?.sectionTitle === 'string' ? s.sectionTitle.trim() : 'Section';
    segs.push({
      key: `sec-${si}`,
      est: 32,
      node: (
        <h2 className="mt-2 border-b border-[#e5e7eb] pb-1 text-sm font-bold uppercase tracking-wide text-[#111]">
          {st}
        </h2>
      ),
    });
    const items = Array.isArray(s?.items) ? s.items : [];
    items.forEach((it: unknown, ii: number) => {
      const item = it as {
        heading?: string;
        subheading?: string;
        date?: string;
        location?: string;
        bullets?: unknown[];
      };
      const heading = typeof item?.heading === 'string' ? item.heading.trim() : '';
      const sub = typeof item?.subheading === 'string' ? item.subheading.trim() : '';
      const date = typeof item?.date === 'string' ? item.date.trim() : '';
      const loc = typeof item?.location === 'string' ? item.location.trim() : '';
      const meta = [sub, date, loc].filter(Boolean).join(' · ');
      const headBlock = [heading, meta].filter(Boolean).join('\n');
      segs.push({
        key: `item-${si}-${ii}-h`,
        est: headBlock ? estLines(headBlock, 52) * 14 + 16 : 8,
        node: (
          <div className="mt-2">
            {heading ? (
              <p className="text-[12px] font-semibold text-[#111]">
                <SuggestionHighlights text={heading} lineEdits={lineEdits} />
              </p>
            ) : null}
            {meta ? (
              <p className="text-[10px] text-[#6b7280]">
                <SuggestionHighlights text={meta} lineEdits={lineEdits} />
              </p>
            ) : null}
          </div>
        ),
      });
      const bullets = Array.isArray(item?.bullets) ? item.bullets : [];
      bullets.forEach((b: unknown, bi: number) => {
        const t = typeof b === 'string' ? b.trim() : '';
        if (!t) return;
        segs.push({
          key: `item-${si}-${ii}-b-${bi}`,
          est: estBulletH(t) + 4,
          node: (
            <p className="pl-3 text-[11px] leading-relaxed text-[#111]">
              <span className="-ml-3 mr-1 text-[#9ca3af]">•</span>
              <SuggestionHighlights text={t} lineEdits={lineEdits} />
            </p>
          ),
        });
      });
    });
  });

  return segs;
}

function packPages(segs: Seg[], maxH: number): Seg[][] {
  const pages: Seg[][] = [];
  let cur: Seg[] = [];
  let acc = 0;
  for (const s of segs) {
    if (acc + s.est > maxH && cur.length > 0) {
      pages.push(cur);
      cur = [];
      acc = 0;
    }
    if (s.est > maxH) {
      if (cur.length) {
        pages.push(cur);
        cur = [];
        acc = 0;
      }
      pages.push([s]);
      continue;
    }
    cur.push(s);
    acc += s.est;
  }
  if (cur.length) pages.push(cur);
  if (!pages.length) {
    pages.push([
      {
        key: 'empty',
        est: 40,
        node: <p className="text-xs text-[#9ca3af]">No structured resume content to preview.</p>,
      },
    ]);
  }
  return pages;
}

export function ResumeAnnotatedPages({
  content,
  lineEdits,
}: {
  content: unknown;
  lineEdits: LineEdit[];
}) {
  const segs = useMemo(() => buildSegments(content, lineEdits), [content, lineEdits]);
  const pages = useMemo(() => packPages(segs, CONTENT_MAX_H), [segs]);

  return (
    <div className="space-y-4">
      {pages.map((pageSegs, pi) => (
        <div
          key={pi}
          data-resume-page
          className="mx-auto box-border max-w-full bg-white shadow-md ring-1 ring-zinc-200 dark:ring-zinc-600"
          style={{ width: US_LETTER_PX.w, minHeight: US_LETTER_PX.h, padding: PADDING }}
        >
          <p className="mb-3 text-center text-[9px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Preview page {pi + 1}
            {pages.length > 1 ? ` of ${pages.length}` : ''} · US Letter
          </p>
          <div className="space-y-1">
            {pageSegs.map((s) => (
              <div key={s.key}>{s.node}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
