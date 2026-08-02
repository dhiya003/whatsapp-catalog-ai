import { describe, expect, it } from 'vitest';
import { toCsv, toExcelHtml } from '../src/backend/exporters.js';
import { extractCatalogDraft } from '../src/core/parser.js';

describe('rich catalog exporters', () => {
  const item = extractCatalogDraft({
    sourceGroupId: 'g',
    sourceGroupTitle: 'Seller Group',
    messageId: 'm1',
    text: 'Blue cotton kurti\n₹1,250\nSoft handloom, sizes S M L',
    timestamp: '2026-01-02T00:00:00.000Z'
  })!;

  it('exports rich CSV columns and array fields', () => {
    const csv = toCsv([item]);
    expect(csv.split('\n')[0]).toContain('productCode,sourceGroupTitle,sourceTimestamp,title,category,fabric');
    expect(csv).toContain(item.productCode);
    expect(csv).toContain('S | M | L');
    expect(csv).toContain('What is the product?: Blue cotton kurti');
  });

  it('exports Excel-compatible HTML with escaped rich content', () => {
    const html = toExcelHtml([{ ...item, title: '<Blue & cotton kurti>' }]);
    expect(html).toContain('<table>');
    expect(html).toContain('&lt;Blue &amp; cotton kurti&gt;');
    expect(html).toContain('imageAltText');
  });
});
