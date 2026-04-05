import { PanelLeft, FileText, FileSearch, Trash2, Copy, UploadCloud, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useStore, API_BASE_URL } from '../store/useStore';
import axios from 'axios';
import { cn } from '../utils/cn';

export const Sidebar = () => {
  const {
    isSidebarCollapsed,
    toggleSidebar,
    projects,
    activeProjectId,
    setActiveProjectId,
    addProject,
    removeProject,
    uploadCV,
  } = useStore();
  const [isUploading, setIsUploading] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get(API_BASE_URL);
        setIsBackendOnline(true);
      } catch {
        setIsBackendOnline(false);
      }
    };
    checkBackend();
    const intervalId = setInterval(checkBackend, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadCV(file);
    } catch (e) {
      console.error('Upload failed in Sidebar:', e);
    } finally {
      setIsUploading(false);
    }
  };

  if (isSidebarCollapsed) {
    return (
      <aside className="no-print print-hide flex h-full w-12 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-12 w-full items-center justify-center border-b border-zinc-200 text-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:text-zinc-100"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="no-print print-hide flex h-full w-full max-w-full shrink-0 flex-col border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:h-full md:w-64 md:max-w-none md:border-b-0 md:border-r">

      {/* Header — flush with app header (h-12) */}
      <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">Projects</p>
        <button
          type="button"
          onClick={toggleSidebar}
          className="text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          aria-label="Collapse sidebar"
        >
          <PanelLeft size={15} />
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">All resumes</p>
        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-zinc-400 dark:text-zinc-500">
          {isBackendOnline === true ? (
            <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /><span>API online</span></>
          ) : (
            <><span className="h-1.5 w-1.5 rounded-full bg-red-400" /><span>API offline</span></>
          )}
        </span>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-3">
        <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 py-2.5 text-[10px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800">
          {isUploading ? (
            <Loader2 size={13} className="animate-spin text-emerald-500" />
          ) : (
            <UploadCloud size={13} />
          )}
          Upload resume (PDF or Word)
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Uploading status */}
      {isUploading && (
        <p className="px-4 pb-2 text-center text-[9px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Extracting resume data…
        </p>
      )}

      {/* Project list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {projects.length === 0 && !isUploading && (
          <p className="pt-6 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
            No resumes yet.
          </p>
        )}
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveProjectId(p.id)}
            className={cn(
              'group flex w-full flex-col gap-1.5 rounded px-3 py-2.5 text-left transition-colors',
              activeProjectId === p.id
                ? 'bg-zinc-100 dark:bg-zinc-800/80'
                : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {p.type === 'master' ? (
                  <FileText size={14} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
                ) : (
                  <FileSearch size={14} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
                )}
                <span className="truncate text-[12px] font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
              </div>
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {p.type === 'master' ? 'Master' : 'Target'}
              </span>
            </div>
            <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addProject({ ...p, name: `${p.name} (copy)`, type: 'targeted' });
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                title="Duplicate"
              >
                <Copy size={11} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProject(p.id);
                }}
                className="rounded p-1 text-zinc-400 hover:bg-red-950/50 hover:text-red-400"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
};
