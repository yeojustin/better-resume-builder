import { useEffect, useId, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';
import { hideSessionGeminiUi } from '../buildFlags';

/**
 * Blocks the app until the user adds a Gemini API key for this tab (session storage).
 * Skipped when the session-key UI is hidden (production / server-key-only builds).
 */
export function GeminiKeyGateModal() {
  const hasSessionGeminiKey = useStore((s) => s.hasSessionGeminiKey);
  const setSessionGeminiApiKey = useStore((s) => s.setSessionGeminiApiKey);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (hideSessionGeminiUi || hasSessionGeminiKey) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [hasSessionGeminiKey]);

  useEffect(() => {
    if (hideSessionGeminiUi || hasSessionGeminiKey) return;
    inputRef.current?.focus();
  }, [hasSessionGeminiKey]);

  if (hideSessionGeminiUi || hasSessionGeminiKey) return null;

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setSessionGeminiApiKey(t);
    setDraft('');
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-[2px] dark:bg-black/80"
      aria-hidden={false}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
            aria-hidden
          >
            <KeyRound size={20} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Add your Gemini API key
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              This app needs a Google AI (Gemini) key to parse resumes and run analysis. Your key stays in this tab’s{' '}
              <strong className="font-medium text-zinc-800 dark:text-zinc-200">session storage</strong> only — not on our
              servers or in localStorage. Close the tab to clear it.
            </p>
          </div>
        </div>

        <label htmlFor="gemini-gate-key" className="mt-4 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          API key
        </label>
        <input
          ref={inputRef}
          id="gemini-gate-key"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Paste your Gemini API key…"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 font-mono text-[13px] text-zinc-900 outline-none ring-zinc-400/30 focus:border-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30"
        />

        <button
          type="button"
          disabled={!draft.trim()}
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Continue
        </button>

        <p className="mt-3 text-center text-[10px] text-zinc-500 dark:text-zinc-500">
          Get a key at{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-700 underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Google AI Studio
          </a>
        </p>
      </div>
    </div>
  );
}
