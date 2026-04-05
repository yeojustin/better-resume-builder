/** Production builds hide session key UI; API uses server-injected secrets only. */
export const hideSessionGeminiUi =
  import.meta.env.VITE_HIDE_SESSION_GEMINI_UI === 'true' ||
  import.meta.env.VITE_HIDE_SESSION_GEMINI_UI === '1';

/**
 * Local dev only: do not block the UI on a session Gemini key (use server `.env` instead).
 * Set `GEMINI_SESSION_ONLY=false` and `GEMINI_API_KEY` / `GOOGLE_API_KEY` in backend or repo-root `.env`.
 */
export const skipGeminiKeyGate =
  import.meta.env.VITE_SKIP_GEMINI_KEY_GATE === 'true' ||
  import.meta.env.VITE_SKIP_GEMINI_KEY_GATE === '1';
