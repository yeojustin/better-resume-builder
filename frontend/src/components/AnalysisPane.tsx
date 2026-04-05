import { useMemo, useRef, useState } from 'react';
import { useStore, type LineEdit, type AnalysisResult } from '../store/useStore';
import { Copy, Download, FileText, LayoutList } from 'lucide-react';
import { ResumeAnnotatedPages } from './ResumeAnnotatedPages';
import { OriginalResumePdf } from './OriginalResumePdf';
import { exportResumePreviewPages } from '../utils/exportPreviewPdf';

function editNote(e: LineEdit): string {
  const n = (e.note ?? (e as { rationale?: string }).rationale ?? '').trim();
  return n;
}

function legacyGroupedSections(analysis: AnalysisResult) {
  const edits = analysis.llm.line_edits ?? [];
  const order: string[] = [];
  const map = new Map<string, LineEdit[]>();
  for (const e of edits) {
    const sec = (e.section_title && String(e.section_title).trim()) || 'Resume';
    if (!map.has(sec)) {
      map.set(sec, []);
      order.push(sec);
    }
    map.get(sec)!.push(e);
  }
  return { order, map };
}

interface ItemGroup {
  sortKey: number;
  label: string;
  sub: string;
  date: string;
  fullText: string;
  edits: LineEdit[];
}

function groupLineEditsByItem(edits: LineEdit[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const e of edits) {
    const idx = typeof e.item_index === 'number' ? e.item_index : 999;
    const h = (e.item_heading || 'This section').trim() || 'This section';
    const key = `${idx}::${h}`;
    if (!map.has(key)) {
      map.set(key, {
        sortKey: idx,
        label: h,
        sub: (e.item_subheading || '').trim(),
        date: (e.item_date || '').trim(),
        fullText: (e.full_item_text || '').trim(),
        edits: [],
      });
    }
    const g = map.get(key)!;
    g.edits.push(e);
    const ft = (e.full_item_text || '').trim();
    if (ft.length > g.fullText.length) {
      g.fullText = ft;
      g.sub = (e.item_subheading || '').trim() || g.sub;
      g.date = (e.item_date || '').trim() || g.date;
    }
  }
  return [...map.values()].sort((a, b) => a.sortKey - b.sortKey);
}

export function AnalysisPane() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const analysis = activeProject?.analysis;
  const sectionRows = analysis?.section_change_view;

  const legacy = useMemo(() => (analysis ? legacyGroupedSections(analysis) : null), [analysis]);
  const suggestionEdits = useMemo(() => analysis?.llm.line_edits ?? [], [analysis]);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const [docTab, setDocTab] = useState<'annotated' | 'original'>('annotated');
  const [exporting, setExporting] = useState(false);

  if (!activeProjectId) {
    return (
      <div className="flex h-full items-center justify-center border-l border-zinc-200 bg-white p-4 sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">Select a resume first.</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex h-full flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 sm:px-5 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What to change</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Add a job description, tune analysis options, then press Analyze.
          </p>
        </div>
      </div>
    );
  }

  const su = analysis.settings_used;
  const hasPdf = Boolean(activeProject?.resumePdfDataUrl);

  const handleExport = async () => {
    const root = previewRootRef.current;
    if (!root) return;
    setExporting(true);
    try {
      await exportResumePreviewPages(
        root,
        `${(activeProject?.name || 'resume').replace(/[^\w.-]+/g, '_')}-annotated-preview.pdf`,
      );
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="shrink-0 border-b border-zinc-200 px-4 py-3 sm:px-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What to change</h2>
        {su ? (
          <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            Run used: groundedness {su.groundedness_percent}%, creativity {su.creativity_percent}%, temperature {su.temperature.toFixed(2)},
            tone <span className="text-zinc-900 dark:text-zinc-100">{su.professionalism}</span>.
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[min(40vh,320px)] w-full min-w-0 shrink-0 flex-col border-b border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 lg:min-h-0 lg:max-w-[min(100%,520px)] lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-200/80 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setDocTab('annotated')}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium ${
                docTab === 'annotated'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <LayoutList size={12} /> Annotated pages
            </button>
            <button
              type="button"
              onClick={() => setDocTab('original')}
              disabled={!hasPdf}
              title={!hasPdf ? 'Upload a PDF resume to enable this tab' : undefined}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                docTab === 'original'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <FileText size={12} /> Original PDF
            </button>
            {docTab === 'annotated' ? (
              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleExport()}
                className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <Download size={12} /> {exporting ? 'Exporting…' : 'Export PDF'}
              </button>
            ) : null}
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-3">
            {docTab === 'annotated' ? (
              <ResumeAnnotatedPages
                content={activeProject?.content}
                lineEdits={suggestionEdits}
                containerRef={previewRootRef}
              />
            ) : hasPdf && activeProject?.resumePdfDataUrl ? (
              <OriginalResumePdf dataUrl={activeProject.resumePdfDataUrl} />
            ) : (
              <p className="px-2 text-xs text-zinc-500 dark:text-zinc-400">
                Original PDF is only available when you upload a PDF file (not Word).
              </p>
            )}
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {sectionRows && sectionRows.length > 0 ? (
            <div className="space-y-8">
              {sectionRows.map((row) => {
                const n = row.line_edits?.length ?? 0;
                const groups = n > 0 ? groupLineEditsByItem(row.line_edits) : [];
                return (
                  <section key={row.section_title} className="border-b border-zinc-200 pb-6 last:border-0 dark:border-zinc-800">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">{row.section_title}</h3>
                      <span
                        className={
                          n === 0
                            ? 'rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                            : 'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        }
                      >
                        {n === 0 ? 'No line edits' : `${n} suggestion${n === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{row.why}</p>
                    {n > 0 ? (
                      <div className="mt-4 space-y-6">
                        {groups.map((g) => (
                          <div
                            key={`${row.section_title}-${g.sortKey}-${g.label}`}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                          >
                            <div className="border-b border-zinc-200 pb-2 dark:border-zinc-700">
                              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{g.label}</p>
                              {(g.sub || g.date) && (
                                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {[g.sub, g.date].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                            {g.fullText ? (
                              <details className="mt-2 group">
                                <summary className="cursor-pointer text-[10px] font-medium text-zinc-500 group-open:mb-2 dark:text-zinc-400">
                                  Full entry text (from your resume)
                                </summary>
                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-2.5 text-[10px] leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                                  {g.fullText}
                                </pre>
                              </details>
                            ) : null}
                            <ul className="mt-3 space-y-4">
                              {g.edits.map((e, i) => {
                                const note = editNote(e);
                                return (
                                  <li
                                    key={`${g.label}-${i}`}
                                    className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-950"
                                  >
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                      Current (in resume)
                                    </p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 line-through dark:text-zinc-500">
                                      {e.before}
                                    </p>
                                    <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                                      Suggested
                                    </p>
                                    <p className="mt-1 text-sm leading-snug text-zinc-900 dark:text-zinc-100">{e.after}</p>
                                    {note ? <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{note}</p> : null}
                                    <button
                                      type="button"
                                      onClick={() => void navigator.clipboard.writeText(e.after)}
                                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-100"
                                    >
                                      <Copy size={12} /> Copy new line
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : legacy && legacy.order.length > 0 ? (
            <div className="space-y-6">
              {legacy.order.map((sectionTitle) => (
                <section key={sectionTitle}>
                  <h3 className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{sectionTitle}</h3>
                  <ul className="mt-2 space-y-4">
                    {legacy.map.get(sectionTitle)!.map((e, i) => {
                      const note = editNote(e);
                      return (
                        <li key={`${sectionTitle}-${i}`} className="border-b border-zinc-200 pb-4 last:border-0 dark:border-zinc-800">
                          <p className="text-xs text-zinc-400 line-through dark:text-zinc-500">{e.before}</p>
                          <p className="mt-1.5 text-sm text-zinc-900 dark:text-zinc-100">{e.after}</p>
                          {note ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{note}</p> : null}
                          <button
                            type="button"
                            onClick={() => void navigator.clipboard.writeText(e.after)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-600"
                          >
                            <Copy size={12} /> Copy new line
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No line changes suggested across the resume. Section-level notes appear when you re-run analyze with the latest server.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
