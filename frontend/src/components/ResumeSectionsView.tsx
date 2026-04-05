import { LayoutList, User } from 'lucide-react';
import type { ResumeOutline } from '../store/useStore';

const PI_LABELS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'location', label: 'Location' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'summary', label: 'Summary' },
];

export function ResumeSectionsView({ outline }: { outline: ResumeOutline | undefined }) {
  if (!outline) {
    return (
      <p className="text-[11px] leading-relaxed text-[#9ca3af]">
        Upload a CV to see detected sections from the parsed JSON.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#c0c4cd]">
          <User size={11} />
          Contact & summary
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PI_LABELS.map(({ key, label }) => (
            <span
              key={key}
              className={
                outline.personalInfoPresent[key]
                  ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-800 ring-1 ring-emerald-200'
                  : 'rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[9px] font-medium text-[#9ca3af] ring-1 ring-[#e5e7eb]'
              }
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#c0c4cd]">
          <LayoutList size={11} />
          Sections ({outline.sections.length})
        </div>
        {outline.sections.length === 0 ? (
          <p className="text-[11px] text-[#9ca3af]">No sections in JSON yet.</p>
        ) : (
          <ul className="space-y-2">
            {outline.sections.map((s) => (
              <li
                key={s.index}
                className="rounded-lg border border-[#e4e6eb] bg-[#fafafa] px-3 py-2.5"
              >
                <p className="text-[12px] font-semibold text-[#111]">{s.sectionTitle || 'Untitled section'}</p>
                <p className="mt-0.5 text-[10px] text-[#6b7280]">
                  {s.itemCount} entries · {s.bulletCount} bullets
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
