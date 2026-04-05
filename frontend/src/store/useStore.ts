import { create } from 'zustand';
import axios, { type InternalAxiosRequestConfig } from 'axios';

const rawApiBase = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL =
  typeof rawApiBase === 'string' && rawApiBase.trim() !== ''
    ? rawApiBase.trim().replace(/\/$/, '')
    : 'http://localhost:8000';

/** Tab session only — never localStorage. Value is sent as `X-Gemini-Api-Key` on Gemini calls. */
export const SESSION_GEMINI_STORAGE_KEY = 'brb_session_gemini_key';

export function readSessionGeminiKey(): string | null {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  try {
    const k = sessionStorage.getItem(SESSION_GEMINI_STORAGE_KEY)?.trim();
    return k || null;
  } catch {
    return null;
  }
}

/** Mutate config headers in place — never replace the whole object (that drops Content-Type for JSON/FormData). */
function applySessionGeminiHeader(config: InternalAxiosRequestConfig) {
  const k = readSessionGeminiKey();
  const h = config.headers;
  if (!h) return;
  if (k) {
    if (typeof (h as { set?: (a: string, b: string) => void }).set === 'function') {
      (h as { set: (a: string, b: string) => void }).set('X-Gemini-Api-Key', k);
    } else {
      (h as Record<string, string>)['X-Gemini-Api-Key'] = k;
    }
  } else if (typeof (h as { delete?: (a: string) => void }).delete === 'function') {
    (h as { delete: (a: string) => void }).delete('X-Gemini-Api-Key');
  } else {
    delete (h as Record<string, string>)['X-Gemini-Api-Key'];
  }
}

axios.interceptors.request.use((config) => {
  applySessionGeminiHeader(config);
  return config;
});

export type InFlight = null | 'cv' | 'jd' | 'jd_text' | 'analyze';

export interface ResumeOutline {
  sections: {
    index: number;
    sectionTitle: string;
    itemCount: number;
    bulletCount: number;
  }[];
  personalInfoPresent: Record<string, boolean>;
}

export interface LexicalMetrics {
  lexical_similarity_percent: number;
  tfidf_cosine_similarity: number | null;
  unigram_jaccard_percent: number;
  matched_terms: string[];
  missing_terms: string[];
  resume_token_count: number;
  jd_token_count: number;
  method_notes: string;
}

/** LLM-extracted JD vs resume keywords, then deterministic set overlap (server). */
export interface MlMetrics {
  ml_score_percent: number;
  matched_keywords: string[];
  missing_keywords: string[];
  jd_keyword_count: number;
  resume_keyword_count: number;
  jaccard_percent: number;
  keyword_recall_percent: number;
  method_notes: string;
}

const THEME_STORAGE_KEY = 'better-resume-builder:theme';
export type ThemeMode = 'light' | 'dark';

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function syncThemeClass(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const initialTheme = readStoredTheme();
syncThemeClass(initialTheme);

export interface LineEdit {
  section_title?: string;
  before: string;
  after: string;
  note?: string;
  /** Server-enriched: which entry (e.g. job) this line belongs to */
  item_index?: number | null;
  item_heading?: string;
  item_subheading?: string;
  item_date?: string;
  full_item_text?: string;
  /** Legacy responses */
  rationale?: string;
  path_hint?: string;
  context_label?: string;
  priority?: 'high' | 'medium' | 'low';
}

export type ProfessionalismTone = 'direct' | 'professional' | 'formal';

export interface AnalyzeSettings {
  /** 70–100: stricter = stay closer to exact resume wording / facts */
  groundednessPercent: number;
  /** 0–100: higher = more aggressive rewrites (still bounded by groundedness on the server) */
  creativityPercent: number;
  /** Model randomness (0–0.95) */
  temperature: number;
  professionalism: ProfessionalismTone;
}

export const DEFAULT_ANALYZE_SETTINGS: AnalyzeSettings = {
  groundednessPercent: 100,
  creativityPercent: 35,
  temperature: 0.22,
  professionalism: 'professional',
};

export interface SectionChangeRow {
  section_title: string;
  why: string;
  line_edits: LineEdit[];
}

export interface AnalysisSettingsUsed {
  groundedness_percent: number;
  creativity_percent: number;
  temperature: number;
  professionalism: string;
}

export interface SectionScoreRow {
  section_title: string;
  llm_percent: number;
  lexical_percent: number;
  combined_percent: number;
  comment: string;
}

export interface AnalysisResult {
  combined_score_percent: number;
  lexical_metrics: LexicalMetrics;
  ml_metrics?: MlMetrics;
  section_scorecard?: SectionScoreRow[];
  section_change_view?: SectionChangeRow[];
  settings_used?: AnalysisSettingsUsed;
  llm: {
    fit_score_llm: number;
    section_rankings: { section_title: string; relevance_score: number; comment: string }[];
    line_edits: LineEdit[];
    section_review?: { section_title: string; has_suggested_edits: boolean; why: string }[];
    jd_keywords?: string[];
    resume_keywords?: string[];
    overall_assessment?: string;
    risks_and_gaps?: string[];
  };
}

export interface ResumeProject {
  id: string;
  name: string;
  type: 'master' | 'targeted';
  content: any;
  jd?: string;
  jdJson?: any;
  resumeOutline?: ResumeOutline;
  /** Data URL of the uploaded PDF (same session); used for original-PDF panel */
  resumePdfDataUrl?: string;
  analyzeSettings?: AnalyzeSettings;
  analysis?: AnalysisResult;
  lastModified: Date;
}

interface AppState {
  activeProjectId: string | null;
  projects: ResumeProject[];
  isSidebarCollapsed: boolean;
  theme: ThemeMode;
  /** True when a key is stored in sessionStorage (full key is not kept in Zustand). */
  hasSessionGeminiKey: boolean;
  inFlight: InFlight;
  errorMessage: string | null;
  setActiveProjectId: (id: string | null) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  /** Saves key only in sessionStorage for this browser tab; clears when you remove it or close the tab. */
  setSessionGeminiApiKey: (key: string | null) => void;
  clearError: () => void;
  updateProjectContent: (id: string, content: string) => void;
  analyzeActiveProject: (jd: string) => Promise<void>;
  addProject: (project: Omit<ResumeProject, 'id' | 'lastModified'>) => void;
  removeProject: (id: string) => void;
  setProjectJD: (id: string, jd: string) => void;
  setProjectJdJson: (id: string, jdJson: any) => void;
  setProjectContent: (id: string, content: any) => void;
  setProjectResumeOutline: (id: string, outline: ResumeOutline) => void;
  setProjectAnalyzeSettings: (id: string, settings: AnalyzeSettings) => void;
  setProjectAnalysis: (id: string, analysis: AnalysisResult | undefined) => void;
  uploadCV: (file: File) => Promise<void>;
  uploadJD: (file: File) => Promise<void>;
  structureJDFromPaste: (text: string) => Promise<void>;
}

export const EMPTY_RESUME_JSON = {
  personalInfo: {
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio: '',
    summary: '',
  },
  sections: [] as any[],
};

export const EMPTY_RESUME_OUTLINE: ResumeOutline = {
  sections: [],
  personalInfoPresent: {
    name: false,
    email: false,
    phone: false,
    location: false,
    linkedin: false,
    portfolio: false,
    summary: false,
  },
};

const initialHasSessionGeminiKey =
  typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' && Boolean(readSessionGeminiKey());

export const useStore = create<AppState>((set, get) => ({
  activeProjectId: null,
  projects: [],
  isSidebarCollapsed: false,
  theme: initialTheme,
  hasSessionGeminiKey: initialHasSessionGeminiKey,
  inFlight: null,
  errorMessage: null,
  clearError: () => set({ errorMessage: null }),
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
    syncThemeClass(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    syncThemeClass(next);
    set({ theme: next });
  },
  setSessionGeminiApiKey: (key) => {
    const trimmed = key?.trim() || null;
    try {
      if (trimmed) sessionStorage.setItem(SESSION_GEMINI_STORAGE_KEY, trimmed);
      else sessionStorage.removeItem(SESSION_GEMINI_STORAGE_KEY);
    } catch {
      /* private mode / quota */
    }
    set({ hasSessionGeminiKey: Boolean(trimmed) });
  },
  updateProjectContent: (id, content) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, content, lastModified: new Date() } : p)),
    })),
  analyzeActiveProject: async (jd: string) => {
    const { activeProjectId, projects } = get();
    if (!activeProjectId) return;
    const project = projects.find((p) => p.id === activeProjectId);
    if (!project) return;

    set({ inFlight: 'analyze' });
    try {
      const s = project.analyzeSettings ?? DEFAULT_ANALYZE_SETTINGS;
      const response = await axios.post(`${API_BASE_URL}/analyze-resume`, {
        resume_json: project.content,
        job_description: jd,
        jd_json: project.jdJson ?? null,
        groundedness_percent: s.groundednessPercent,
        creativity_percent: s.creativityPercent,
        temperature: s.temperature,
        professionalism: s.professionalism,
      });
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === activeProjectId
            ? { ...p, analysis: response.data as AnalysisResult, jd, lastModified: new Date() }
            : p
        ),
        inFlight: null,
      }));
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      const status = error?.response?.status;
      let msg = `Analysis failed: ${detail}`;
      if (status === 429) msg = '⚠️ API rate limit reached. Please wait a moment and try again.';
      console.error('Analysis failed:', error);
      set({ inFlight: null, errorMessage: msg });
    }
  },
  addProject: (project) => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => ({
      projects: [...state.projects, { ...project, id, lastModified: new Date() }],
      activeProjectId: id,
    }));
  },
  setProjectJD: (id, jd) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, jd, lastModified: new Date() } : p)),
    })),
  setProjectJdJson: (id, jdJson) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, jdJson, lastModified: new Date() } : p)),
    })),
  setProjectContent: (id, content) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, content, lastModified: new Date() } : p)),
    })),
  setProjectResumeOutline: (id, resumeOutline) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, resumeOutline, lastModified: new Date() } : p)),
    })),
  setProjectAnalyzeSettings: (id, analyzeSettings) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, analyzeSettings, lastModified: new Date() } : p)),
    })),
  setProjectAnalysis: (id, analysis) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, analysis, lastModified: new Date() } : p)),
    })),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    })),
  uploadCV: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    set({ inFlight: 'cv' });
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let resumePdfDataUrl: string | undefined;
      if (isPdf) {
        try {
          resumePdfDataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(new Error('read failed'));
            r.readAsDataURL(file);
          });
        } catch {
          resumePdfDataUrl = undefined;
        }
      }

      const response = await axios.post(`${API_BASE_URL}/parse-resume`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { resume_json, resume_outline } = response.data;
      const newProj: Omit<ResumeProject, 'id' | 'lastModified'> = {
        name: file.name.replace(/\.(pdf|docx?)$/i, '') + '_Master',
        type: 'master',
        content: resume_json,
        resumeOutline: resume_outline,
        jd: '',
        resumePdfDataUrl,
      };

      const id = Math.random().toString(36).substr(2, 9);
      set((state) => ({
        projects: [...state.projects, { ...newProj, id, lastModified: new Date() }],
        activeProjectId: id,
        inFlight: null,
      }));
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      const status = error?.response?.status;
      let msg = `CV upload failed: ${detail}`;
      if (status === 429) msg = '⚠️ API rate limit reached. Please wait a moment and try again.';
      console.error('Upload failed:', error);
      set({ inFlight: null, errorMessage: msg });
    }
  },
  uploadJD: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    set({ inFlight: 'jd' });
    try {
      const response = await axios.post(`${API_BASE_URL}/parse-jd`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { jd_json, jd_text } = response.data;
      const { activeProjectId } = get();

      if (activeProjectId) {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === activeProjectId
              ? { ...p, jd: jd_text, jdJson: jd_json, lastModified: new Date() }
              : p
          ),
          inFlight: null,
        }));
      } else {
        set({ inFlight: null });
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      const status = error?.response?.status;
      let msg = `JD upload failed: ${detail}`;
      if (status === 429) msg = '⚠️ API rate limit reached. Please wait a moment and try again.';
      console.error('JD Upload failed:', error);
      set({ inFlight: null, errorMessage: msg });
    }
  },
  structureJDFromPaste: async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    set({ inFlight: 'jd_text' });
    try {
      const response = await axios.post(`${API_BASE_URL}/parse-jd-text`, { text: t });
      const { jd_json, jd_text } = response.data;
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === activeProjectId ? { ...p, jd: jd_text, jdJson: jd_json, lastModified: new Date() } : p
        ),
        inFlight: null,
      }));
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Unknown error';
      const status = error?.response?.status;
      let msg = `JD structuring failed: ${detail}`;
      if (status === 429) msg = '⚠️ API rate limit reached. Please wait a moment and try again.';
      console.error('JD structuring failed:', error);
      set({ inFlight: null, errorMessage: msg });
    }
  },
}));
