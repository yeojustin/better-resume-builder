import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Download, LayoutList } from 'lucide-react';
import { ResumeAnnotatedPages } from './ResumeAnnotatedPages';
import { exportResumePreviewPages } from '../utils/exportPreviewPdf';

export function AnalysisPane() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const analysis = activeProject?.analysis;
  const suggestionEdits = useMemo(() => analysis?.llm.line_edits ?? [], [analysis]);
  const previewRootRef = useRef<HTMLDivElement>(null);
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
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Suggested changes</h2>
        </div>
      </div>
    );
  }

  const su = analysis.settings_used;

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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Suggested changes</h2>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <Download size={12} /> {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
        {su ? (
          <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            Run used: groundedness {su.groundedness_percent}%, creativity {su.creativity_percent}%, temperature {su.temperature.toFixed(2)}.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto bg-zinc-100 p-2 sm:p-3 dark:bg-zinc-900/40">
        <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
          <LayoutList size={12} /> Annotated pages with inline suggestions
        </div>
        <ResumeAnnotatedPages
          content={activeProject?.content}
          lineEdits={suggestionEdits}
          containerRef={previewRootRef}
        />
      </div>
    </div>
  );
}
