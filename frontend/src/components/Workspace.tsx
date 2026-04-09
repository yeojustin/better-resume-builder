import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStore, DEFAULT_ANALYZE_SETTINGS } from '../store/useStore';
import { FileCode, Activity, Loader2 } from 'lucide-react';
import { AnalysisPane } from './AnalysisPane';
import { JDStructureView } from './JDStructureView';
import { MatchSummary } from './MatchSummary';
import { useMediaQuery } from '../utils/useMediaQuery';

const WORKSPACE_SPLIT_KEY = 'better-resume-builder:workspace-left-pct';
const DEFAULT_LEFT_PCT = 30;
const MIN_LEFT_PCT = 18;
const MAX_LEFT_PCT = 72;

function readStoredLeftPct(): number {
  try {
    const raw = localStorage.getItem(WORKSPACE_SPLIT_KEY);
    if (raw == null) return DEFAULT_LEFT_PCT;
    const n = Number(raw);
    if (Number.isNaN(n)) return DEFAULT_LEFT_PCT;
    return Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, n));
  } catch {
    return DEFAULT_LEFT_PCT;
  }
}

export const Workspace = () => {
  const {
    activeProjectId,
    projects,
    setProjectContent,
    setProjectJD,
    analyzeActiveProject,
    structureJDFromPaste,
    setProjectAnalyzeSettings,
    inFlight,
    theme,
  } = useStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const az = activeProject?.analyzeSettings ?? DEFAULT_ANALYZE_SETTINGS;
  const jdBuffer = activeProject?.jd || '';
  const [leftPanePercent, setLeftPanePercent] = useState(readStoredLeftPct);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_SPLIT_KEY, String(leftPanePercent));
    } catch {
      /* ignore */
    }
  }, [leftPanePercent]);

  const onSplitMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isLg) return;
      e.preventDefault();
      dragRef.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [isLg],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isLg || !dragRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setLeftPanePercent(Math.min(MAX_LEFT_PCT, Math.max(MIN_LEFT_PCT, pct)));
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isLg]);

  const handleJDChange = (val: string) => {
    if (activeProjectId) setProjectJD(activeProjectId, val);
  };

  const busy = inFlight !== null;
  const busyLabel =
    inFlight === 'analyze'
      ? 'Analyzing…'
      : inFlight === 'cv' || inFlight === 'jd' || inFlight === 'jd_text'
        ? 'Working…'
        : '';

  if (!activeProject) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-zinc-100 p-4 sm:p-8 dark:bg-zinc-950">
        <div className="max-w-xs text-center">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No resume selected</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Upload a PDF or Word resume from the sidebar.</p>
        </div>
      </div>
    );
  }

  const resumePersonName =
    typeof activeProject.content?.personalInfo?.name === 'string'
      ? activeProject.content.personalInfo.name.trim()
      : undefined;

  const leftPaneStyle = isLg
    ? {
        flexBasis: `${leftPanePercent}%`,
        flexGrow: 0,
        flexShrink: 0,
        maxWidth: `${MAX_LEFT_PCT}%`,
        minWidth: `${MIN_LEFT_PCT}%`,
      }
    : { flexBasis: 'auto', width: '100%', maxWidth: '100%', minWidth: 0 };

  return (
    <div
      ref={splitContainerRef}
      className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden lg:flex-row lg:overflow-hidden"
    >
      <div
        className="flex max-h-[min(60vh,520px)] min-h-0 min-w-0 shrink-0 flex-col border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:max-h-none lg:border-r"
        style={leftPaneStyle}
      >
        <div className="flex h-11 shrink-0 items-center justify-end gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => analyzeActiveProject(jdBuffer)}
            disabled={busy || !jdBuffer.trim()}
            className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {inFlight === 'analyze' ? <Loader2 size={12} className="inline animate-spin" /> : <Activity size={12} className="inline" />}{' '}
            Analyze
          </button>
        </div>
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
          Add a job description, tune analysis options, then press Analyze.
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <details open className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <summary className="cursor-pointer list-none px-4 py-2 text-xs font-medium text-zinc-700 marker:hidden dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
              Analysis options
            </summary>
            <div className="space-y-3 border-t border-zinc-200 px-4 pb-3 pt-2 dark:border-zinc-800">
              <label className="block">
                <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>Groundedness (resume lock)</span>
                  <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{az.groundednessPercent}%</span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={100}
                  step={1}
                  value={az.groundednessPercent}
                  disabled={busy}
                  onChange={(e) =>
                    activeProjectId &&
                    setProjectAnalyzeSettings(activeProjectId, {
                      ...az,
                      groundednessPercent: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full accent-zinc-900 dark:accent-zinc-100"
                />
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">
                  100% = suggestions must quote your resume exactly and avoid new facts. Lower = more paraphrase (server still blocks major fabrications).
                </p>
              </label>
              <label className="block">
                <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>Creativity</span>
                  <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{az.creativityPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={az.creativityPercent}
                  disabled={busy}
                  onChange={(e) =>
                    activeProjectId &&
                    setProjectAnalyzeSettings(activeProjectId, {
                      ...az,
                      creativityPercent: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full accent-zinc-900 dark:accent-zinc-100"
                />
              </label>
              <label className="block">
                <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>Temperature (model)</span>
                  <span className="tabular-nums text-zinc-900 dark:text-zinc-100">{az.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.05}
                  value={az.temperature}
                  disabled={busy}
                  onChange={(e) =>
                    activeProjectId &&
                    setProjectAnalyzeSettings(activeProjectId, {
                      ...az,
                      temperature: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full accent-zinc-900 dark:accent-zinc-100"
                />
              </label>
            </div>
          </details>

          <details open className="border-b border-zinc-200 dark:border-zinc-800">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-zinc-900 marker:hidden dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
              Job description
            </summary>
            <div className="space-y-2 px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy || !jdBuffer.trim()}
                  onClick={() => structureJDFromPaste(jdBuffer)}
                  className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  Clean up text
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900">
                  <FileCode size={11} />
                  Upload file
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files?.[0]) useStore.getState().uploadJD(e.target.files[0]);
                    }}
                  />
                </label>
              </div>
              <textarea
                className="min-h-[6rem] w-full resize-y rounded border border-zinc-200 bg-white p-2.5 text-xs leading-relaxed text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                placeholder="Paste the job posting…"
                value={jdBuffer}
                onChange={(e) => handleJDChange(e.target.value)}
              />
              <details className="text-xs">
                <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400">Parsed details</summary>
                <div className="mt-2">
                  <JDStructureView jdJson={activeProject.jdJson} />
                </div>
              </details>
            </div>
          </details>

          {activeProject.analysis && (
            <MatchSummary analysis={activeProject.analysis} omitSectionTitle={resumePersonName} />
          )}

          <details className="border-t border-zinc-200 dark:border-zinc-800">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-zinc-500 marker:hidden dark:text-zinc-400 [&::-webkit-details-marker]:hidden">
              Raw resume data (JSON)
            </summary>
            <div className="px-4 pb-3">
              <div className="h-48 min-h-[12rem] overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
                  value={
                    typeof activeProject.content === 'object'
                      ? JSON.stringify(activeProject.content, null, 2)
                      : String(activeProject.content ?? '')
                  }
                  onChange={(val) => {
                    if (val) {
                      try {
                        const parsed = JSON.parse(val);
                        setProjectContent(activeProject.id, parsed);
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'off',
                  }}
                />
              </div>
            </div>
          </details>

          {busy && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-zinc-950/70">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{busyLabel}</p>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="Resize panes"
        title="Drag to resize · double-click for 30 / 70"
        onMouseDown={onSplitMouseDown}
        onDoubleClick={() => setLeftPanePercent(DEFAULT_LEFT_PCT)}
        className="group relative z-10 hidden h-1.5 w-full shrink-0 cursor-row-resize border-y border-transparent bg-zinc-200 transition-colors hover:border-zinc-300 hover:bg-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-100 lg:flex lg:h-auto lg:w-1.5 lg:cursor-col-resize lg:border-x lg:border-y-0"
      >
        <span className="pointer-events-none absolute inset-y-0 -left-1 -right-1 hidden lg:block" />
      </button>

      <div className="min-h-0 min-w-0 flex-1 lg:min-h-0" style={{ flexBasis: 0 }}>
        <AnalysisPane />
      </div>
    </div>
  );
};
