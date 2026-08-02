import type { CatalogItem } from '../core/types.js';

const cols = ['id','sourceGroupTitle','title','price','description','status','createdAt'];
export function toCsv(items: CatalogItem[]): string {
  return [cols.join(','), ...items.map((item) => cols.map((c) => csv((item as any)[c] ?? '')).join(','))].join('\n');
}
export function toExcelHtml(items: CatalogItem[]): string {
  return `<table>${[cols, ...items.map((i) => cols.map((c) => String((i as any)[c] ?? '')))].map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</table>`;
}
function csv(v: string): string { return /[",\n]/.test(v) ? `"${v.replaceAll('"','""')}"` : v; }
function escapeHtml(v: string): string { return v.replace(/[&<>]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]!)); }
