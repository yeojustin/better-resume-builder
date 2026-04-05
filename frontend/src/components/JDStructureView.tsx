import { Briefcase } from 'lucide-react';

export function JDStructureView({ jdJson }: { jdJson: any | undefined }) {
  if (!jdJson || typeof jdJson !== 'object') {
    return (
      <p className="text-[11px] leading-relaxed text-[#9ca3af]">
        Paste a job description and click <span className="font-semibold text-[#6b7280]">Structure JD</span>, or upload
        a file, to see extracted sections and keywords.
      </p>
    );
  }

  const sections = Array.isArray(jdJson.sections) ? jdJson.sections : [];
  const must = Array.isArray(jdJson.mustHaveKeywords) ? jdJson.mustHaveKeywords : [];
  const nice = Array.isArray(jdJson.niceToHaveKeywords) ? jdJson.niceToHaveKeywords : [];

  return (
    <div className="space-y-3">
      {(jdJson.title || jdJson.company) && (
        <div className="rounded-lg border border-[#e4e6eb] bg-[#fafafa] px-3 py-2">
          <div className="flex items-start gap-2">
            <Briefcase size={14} className="mt-0.5 shrink-0 text-[#6b7280]" />
            <div>
              {jdJson.title && <p className="text-[12px] font-semibold text-[#111]">{jdJson.title}</p>}
              {jdJson.company && <p className="text-[11px] text-[#6b7280]">{jdJson.company}</p>}
              {jdJson.location && <p className="text-[10px] text-[#9ca3af]">{jdJson.location}</p>}
            </div>
          </div>
        </div>
      )}

      {jdJson.summary && (
        <p className="text-[11px] leading-relaxed text-[#374151]">{jdJson.summary}</p>
      )}

      {sections.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#c0c4cd]">JD sections</p>
          {sections.map((sec: any, i: number) => (
            <div key={i} className="rounded-lg border border-[#e4e6eb] bg-white px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{sec.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[#4b5563]">{sec.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-900">Must-have</p>
          <div className="flex flex-wrap gap-1">
            {must.length === 0 && <span className="text-[10px] text-amber-800/70">None listed</span>}
            {must.map((kw: string) => (
              <span
                key={kw}
                className="rounded bg-white px-1.5 py-0.5 text-[9px] font-medium text-amber-950 ring-1 ring-amber-200"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-700">Nice-to-have</p>
          <div className="flex flex-wrap gap-1">
            {nice.length === 0 && <span className="text-[10px] text-slate-600/70">None listed</span>}
            {nice.map((kw: string) => (
              <span
                key={kw}
                className="rounded bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-800 ring-1 ring-slate-200"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
