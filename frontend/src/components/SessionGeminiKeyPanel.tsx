import { useEffect, useRef, useState } from 'react';
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';

export function SessionGeminiKeyPanel() {
  const hasSessionGeminiKey = useStore((s) => s.hasSessionGeminiKey);
  const setSessionGeminiApiKey = useStore((s) => s.setSessionGeminiApiKey);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[11px] font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70 sm:gap-1.5 sm:px-2.5"
        aria-expanded={open}
        aria-controls="session-gemini-panel"
      >
        <KeyRound size={14} className="shrink-0" />
        <span className="hidden max-w-[9rem] truncate sm:inline">
          {hasSessionGeminiKey ? 'Your API key (session)' : 'Add Gemini key'}
        </span>
        {open ? <ChevronUp size={14} className="shrink-0 opacity-60" /> : <ChevronDown size={14} className="shrink-0 opacity-60" />}
      </button>

      {open ? (
        <div
          id="session-gemini-panel"
          className="absolute right-0 top-full z-[300] mt-1.5 w-[min(calc(100vw-1.5rem),20rem)] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:w-[22rem]"
        >
          <div className="rounded-lg border border-amber-300/80 bg-amber-50 p-2.5 text-[10px] leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
            <p className="font-semibold">Session only — not saved elsewhere</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
              Stored in this tab’s <strong>session storage</strong> only (cleared when you close the tab). It is{' '}
              <strong>not</strong> written to localStorage, our servers, or a database. Each Gemini request sends it to{' '}
              <strong>your</strong> local API, which forwards it to Google for that call only — same as using the server’s
              <code className="mx-0.5 rounded bg-amber-200/60 px-0.5 dark:bg-amber-900/60">.env</code> key, but under your
              quota.
            </p>
          </div>

          <label className="mt-3 block text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Google AI (Gemini) API key</label>
          <input
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={hasSessionGeminiKey ? 'Paste new key to replace…' : 'Paste key…'}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 font-mono text-[11px] text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
          />

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => {
                setSessionGeminiApiKey(draft.trim());
                setDraft('');
              }}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Use for this session
            </button>
            <button
              type="button"
              disabled={!hasSessionGeminiKey}
              onClick={() => {
                setSessionGeminiApiKey(null);
                setDraft('');
              }}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
            >
              Remove from session
            </button>
          </div>

          {hasSessionGeminiKey ? (
            <p className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-400">A key is active for this tab.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
