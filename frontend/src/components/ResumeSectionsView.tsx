import { LayoutList } from 'lucide-react';
import type { ResumeOutline } from '../store/useStore';

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
