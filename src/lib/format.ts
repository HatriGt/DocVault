export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDate(iso: string | number | null | undefined) {
  if (iso == null) return '—';
  const d = typeof iso === 'number' ? new Date(iso) : new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeTime(ts: number | null) {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const d = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  const y = new Date(today.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return `${formatDate(ts)}, ${time}`;
}

export function daysUntil(iso: string | null) {
  if (!iso) return null;
  const end = new Date(`${iso}T00:00:00`).getTime();
  const start = new Date(new Date().toDateString()).getTime();
  return Math.round((end - start) / 86400000);
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function maskNumber(n?: string) {
  if (!n) return '';
  if (n.length <= 4) return n;
  return `•••• ${n.slice(-4)}`;
}
