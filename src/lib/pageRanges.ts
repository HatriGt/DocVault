/** Parses "1-3, 5, 8-9" into sorted unique 0-based page indices within [1, count]. */
export function parsePageRanges(input: string, count: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= count) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}
