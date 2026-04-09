import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../store/useStore';
import { scoreBarBgClass, scoreTextClass } from '../utils/scoreColor';

export function MatchSummary({
  analysis,
  omitSectionTitle,
}: {
  analysis: AnalysisResult;
  omitSectionTitle?: string;
}) {
  const [copiedMissing, setCopiedMissing] = useState<string | null>(null);
  const lm = analysis.lexical_metrics;
  const ml = analysis.ml_metrics;
  const llmFit = analysis.llm.fit_score_llm;
  const combined = analysis.combined_score_percent;

  const mlScore = ml?.ml_score_percent ?? lm.lexical_similarity_percent;
  const matchedKw = ml?.matched_keywords?.length ? ml.matched_keywords : lm.matched_terms;
  const missingKw = ml?.missing_keywords?.length ? ml.missing_keywords : lm.missing_terms;

  const rows = useMemo(() => {
    const omitNorm = (omitSectionTitle ?? '').trim().toLowerCase();
    const sc = analysis.section_scorecard;
    let list =
      sc?.length != null && sc.length > 0
        ? sc.map((r) => ({
            title: r.section_title,
            combined: r.combined_percent,
            lex: r.lexical_percent,
            llm: r.llm_percent,
            comment: r.comment,
          }))
        : (analysis.llm.section_rankings || []).map((r) => ({
            title: r.section_title,
            combined: Math.round(0.5 * mlScore + 0.5 * r.relevance_score),
            lex: mlScore,
            llm: r.relevance_score,
            comment: r.comment,
          }));

    if (omitNorm) {
      list = list.filter((r) => r.title.trim().toLowerCase() !== omitNorm);
    }
    return list;
  }, [analysis, mlScore, omitSectionTitle]);

  const copyKeyword = async (kw: string) => {
    try {
      await navigator.clipboard.writeText(kw);
      setCopiedMissing(kw);
      window.setTimeout(() => setCopiedMissing((v) => (v === kw ? null : v)), 1200);
    } catch {
      /* ignore clipboard failures */
    }
  };

  return (
    <div className="border-b border-zinc-200 bg-white px-3 py-3 sm:px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">How you match</p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Combined</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${scoreTextClass(combined)}`}>{combined}%</p>
          <p className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">50% ML keywords + 50% LLM fit</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">ML score</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${scoreTextClass(mlScore)}`}>{mlScore}%</p>
          <p className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
            LLM extracts JD + resume keywords, then lexical overlap
            {ml ? ` · Jaccard ${ml.jaccard_percent}% · JD recall ${ml.keyword_recall_percent}%` : ''}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">LLM score</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${scoreTextClass(llmFit)}`}>{llmFit}%</p>
          <p className="mt-1 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">Holistic fit from the model</p>
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/50">
        <summary className="cursor-pointer text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          Raw TF–IDF / token stats (reference)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <div>
            <p className="text-zinc-500 dark:text-zinc-400">TF–IDF headline</p>
            <p className="font-medium tabular-nums">{lm.lexical_similarity_percent}%</p>
          </div>
          <div>
            <p className="text-zinc-500 dark:text-zinc-400">Unigram Jaccard</p>
            <p className="font-medium tabular-nums">{lm.unigram_jaccard_percent}%</p>
          </div>
          <div className="col-span-2 text-[10px] text-zinc-500 dark:text-zinc-500">{lm.method_notes}</div>
        </div>
      </details>

      <p className="mt-4 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">By section</p>
      <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-500">Lex = section text vs JD (TF–IDF overlap). LLM = section relevance.</p>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li
            key={r.title}
            className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 text-xs font-medium text-zinc-900 dark:text-zinc-100">{r.title}</span>
              <span className={`text-xs font-semibold tabular-nums ${scoreTextClass(r.combined)}`}>{r.combined}%</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              <span>
                Lex <span className={`tabular-nums font-medium ${scoreTextClass(r.lex)}`}>{r.lex}%</span>
              </span>
              <span>
                LLM <span className={`tabular-nums font-medium ${scoreTextClass(r.llm)}`}>{r.llm}%</span>
              </span>
              <span>
                Combined{' '}
                <span className={`tabular-nums font-medium ${scoreTextClass(r.combined)}`}>{r.combined}%</span>
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className={`h-full ${scoreBarBgClass(r.combined)}`} style={{ width: `${r.combined}%` }} />
            </div>
            {r.comment ? (
              <p className="mt-1.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300">{r.comment}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Keywords (ML lists when available)</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {matchedKw.slice(0, 24).map((kw) => (
          <span
            key={kw}
            className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          >
            {kw}
          </span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {missingKw.slice(0, 24).map((kw) => (
          <button
            key={kw}
            type="button"
            title="Click to copy keyword"
            onClick={() => void copyKeyword(kw)}
            className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-900 transition-colors hover:bg-red-200 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900/70"
          >
            {copiedMissing === kw ? `${kw}  Copied` : kw}
          </button>
        ))}
      </div>
    </div>
  );
}
