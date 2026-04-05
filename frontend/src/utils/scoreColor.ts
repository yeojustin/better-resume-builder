/** Traffic-light styling for 0–100 scores (green / amber / red). */
export function scoreTextClass(n: number): string {
  if (n >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (n >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function scoreBarBgClass(n: number): string {
  if (n >= 70) return 'bg-emerald-500';
  if (n >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}
