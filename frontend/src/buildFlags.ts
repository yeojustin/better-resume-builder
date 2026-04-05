/** Production builds hide session key UI; API uses server-injected secrets only. */
export const hideSessionGeminiUi =
  import.meta.env.VITE_HIDE_SESSION_GEMINI_UI === 'true' ||
  import.meta.env.VITE_HIDE_SESSION_GEMINI_UI === '1';
