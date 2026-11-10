/**
 * Offline renderers for Office/text formats → self-contained HTML, shown in a
 * WebView with JavaScript and network access disabled.
 */
import mammoth from 'mammoth/mammoth.browser';
import * as XLSX from 'xlsx';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function page(body: string, dark: boolean, extraCss = '') {
  const fg = dark ? '#F4F2FF' : '#14112B';
  const bg = dark ? '#0E0D17' : '#FFFFFF';
  const muted = dark ? '#2A2838' : '#EAE4D8';
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
  html,body{margin:0;background:${bg};color:${fg};font:16px/1.6 -apple-system,Roboto,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
  .doc{padding:28px 22px 80px;max-width:820px;margin:0 auto;word-wrap:break-word}
  h1,h2,h3{line-height:1.25} img{max-width:100%;height:auto} a{color:#8A6A3F}
  table{border-collapse:collapse;max-width:100%} td,th{border:1px solid ${muted};padding:6px 10px;vertical-align:top}
  pre{white-space:pre-wrap;word-break:break-word;font:13px/1.55 ui-monospace,Menlo,monospace;margin:0;padding:20px}
  ${extraCss}
</style></head><body>${body}</body></html>`;
}

export async function wordToHtml(bytes: Uint8Array, dark: boolean) {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const r = await mammoth.convertToHtml({ arrayBuffer: ab as ArrayBuffer });
  return page(`<div class="doc">${r.value || '<p><em>This document is empty.</em></p>'}</div>`, dark);
}

export interface SheetBook {
  names: string[];
  html: (index: number, dark: boolean) => string;
}

export function readSheets(bytes: Uint8Array, ext: string): SheetBook {
  const wb = ext === 'csv' ? XLSX.read(new TextDecoder().decode(bytes), { type: 'string' }) : XLSX.read(bytes, { type: 'array' });
  return {
    names: wb.SheetNames,
    html: (i, dark) => {
      const ws = wb.Sheets[wb.SheetNames[i]];
      const table = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' });
      const head = dark ? '#1A1828' : '#F5F2EC';
      return page(
        `<div style="overflow:auto">${table}</div>`,
        dark,
        `table{font-size:14px;white-space:nowrap} tr:first-child td{position:sticky;top:0;background:${head};font-weight:700}
         td{min-width:64px}`,
      );
    },
  };
}

export function textToHtml(bytes: Uint8Array, dark: boolean) {
  const max = 2 * 1024 * 1024;
  let text = new TextDecoder().decode(bytes.subarray(0, max));
  if (bytes.length > max) text += '\n\n… (truncated, file is larger than 2 MB)';
  try {
    if (/^\s*[[{]/.test(text)) text = JSON.stringify(JSON.parse(text), null, 2);
  } catch {}
  return page(`<pre>${esc(text)}</pre>`, dark);
}
