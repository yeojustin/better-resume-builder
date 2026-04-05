import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { SessionGeminiKeyPanel } from './components/SessionGeminiKeyPanel';
import { GeminiKeyGateModal } from './components/GeminiKeyGateModal';
import { hideSessionGeminiUi } from './buildFlags';
import { AlertTriangle, FileText, Moon, Sun, X } from 'lucide-react';

export default function App() {
  const { errorMessage, clearError, theme, toggleTheme } = useStore();

  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(clearError, 6000);
      return () => clearTimeout(t);
    }
  }, [errorMessage, clearError]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-zinc-100 text-zinc-900 selection:bg-black/10 dark:bg-zinc-950 dark:text-zinc-100 dark:selection:bg-white/10">
      {/* Top bar — same height as sidebar/workspace toolbars (h-12) */}
      <header className="print-hide flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 sm:gap-2.5 sm:px-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          aria-hidden
        >
          <FileText size={16} strokeWidth={2} />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Better Resume Builder
        </span>
        {!hideSessionGeminiUi ? <SessionGeminiKeyPanel /> : null}
        <button
          type="button"
          onClick={() => toggleTheme()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1">
          <Workspace />
        </main>
      </div>

      {/* Toast notification */}
      <GeminiKeyGateModal />

      {errorMessage && (
        <div className="no-print fixed bottom-5 left-1/2 z-[9999] w-[min(100%-2rem,26rem)] -translate-x-1/2">
          <div className="flex items-start gap-3 rounded-lg bg-[#111] px-4 py-3 shadow-xl ring-1 ring-black/10">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
            <p className="flex-1 text-[12px] leading-relaxed text-white/90">{errorMessage}</p>
            <button
              type="button"
              onClick={clearError}
              className="shrink-0 text-white/40 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
