import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/messages.json' assert { type: 'json' };
import { dedupeItems, extractCatalogDraft, inferTitle, stableMessageId } from '../src/core/parser.js';

describe('catalog parsing fixtures', () => {
  it('extracts title and price from catalog-like text', () => {
    const item = extractCatalogDraft(fixtures[0]);
    expect(item?.title).toBe('Handmade blue kurti');
    expect(item?.price).toBe('₹1,250');
  });
  it('uses stable explicit and computed ids', () => {
    expect(stableMessageId(fixtures[0])).toBe('m1');
    expect(stableMessageId({ sourceGroupId: 'g', sourceGroupTitle: 'G', text: 'A' })).toBe(stableMessageId({ sourceGroupId: 'g', sourceGroupTitle: 'G', text: 'A' }));
  });
  it('deduplicates by group and message id', () => {
    const items = fixtures.map((f) => extractCatalogDraft(f)).filter(Boolean) as any[];
    expect(dedupeItems([], items)).toHaveLength(2);
  });
  it('infers non-price title lines conservatively', () => {
    expect(inferTitle('Rs. 50\nFresh mango pickle')).toBe('Fresh mango pickle');
  });
});
