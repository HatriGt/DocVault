/** Normalises user input like "#Travel, visa  #UAE" into ['travel','visa','uae']. */
export function normalizeTags(input: string[] | string): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[\s,]+/);
  const out = parts
    .map((t) => t.trim().replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((t) => t.length > 0 && t.length <= 32);
  return [...new Set(out)].slice(0, 20);
}
