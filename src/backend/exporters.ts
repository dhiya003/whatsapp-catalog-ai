import type { CatalogItem } from '../core/types.js';

export const richExportColumns: Array<keyof CatalogItem> = [
  'id','productCode','sourceGroupTitle','sourceTimestamp','title','category','fabric','weave','feel','color','sizes','occasion','price','currency','careInstructions','seoTitle','shortDescription','longDescription','bulletPoints','keywords','metaTitle','metaDescription','imageAltText','geoSummary','faq','confidence','aiProvider','status','createdAt','updatedAt'
];

export function toCsv(items: CatalogItem[]): string {
  return [richExportColumns.join(','), ...items.map((item) => richExportColumns.map((c) => csv(formatCell(item[c]))).join(','))].join('\n');
}

export function toExcelHtml(items: CatalogItem[]): string {
  const rows = [richExportColumns, ...items.map((item) => richExportColumns.map((c) => formatCell(item[c])) as any[])];
  return `<table>${rows.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('')}</table>`;
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === 'object')) return value.map((entry) => Object.values(entry as Record<string, unknown>).join(': ')).join(' | ');
    return value.join(' | ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csv(v: string): string { return /[",\n]/.test(v) ? `"${v.replaceAll('"','""')}"` : v; }
function escapeHtml(v: string): string { return v.replace(/[&<>]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]!)); }
