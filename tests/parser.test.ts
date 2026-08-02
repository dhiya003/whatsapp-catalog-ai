import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/messages.json' assert { type: 'json' };
import { dedupeItems, extractCatalogDraft, inferTitle, productCodeFor, stableMessageId } from '../src/core/parser.js';
import { catalogItemSchema } from '../src/core/types.js';

describe('catalog parsing fixtures', () => {
  it('extracts rich apparel metadata from catalog-like text', () => {
    const item = extractCatalogDraft(fixtures[0]);
    expect(item?.title).toBe('Handmade blue kurti');
    expect(item?.price).toBe('₹1,250');
    expect(item?.currency).toBe('INR');
    expect(item?.category).toBe('kurti');
    expect(item?.fabric).toBe('cotton');
    expect(item?.color).toBe('blue');
    expect(item?.sizes).toEqual(['S', 'L']);
    expect(item?.productCode).toMatch(/^TEST-SELLERS-[A-F0-9]{8}$/);
    expect(item?.bulletPoints.length).toBeGreaterThan(0);
    expect(item?.faq[0].question).toBe('What is the product?');
    expect(catalogItemSchema.parse(item)).toEqual(item);
  });
  it('uses stable explicit and computed ids', () => {
    expect(stableMessageId(fixtures[0])).toBe('m1');
    expect(stableMessageId({ sourceGroupId: 'g', sourceGroupTitle: 'G', text: 'A' })).toBe(stableMessageId({ sourceGroupId: 'g', sourceGroupTitle: 'G', text: 'A' }));
  });
  it('creates deterministic product codes from group title plus stable suffix', () => {
    expect(productCodeFor('Premium Saree Sellers', 'message-1')).toBe(productCodeFor('Premium Saree Sellers', 'message-1'));
    expect(productCodeFor('Premium Saree Sellers', 'message-1')).not.toBe(productCodeFor('Premium Saree Sellers', 'message-2'));
  });
  it('deduplicates by group and message id', () => {
    const items = fixtures.map((f) => extractCatalogDraft(f)).filter(Boolean) as any[];
    expect(dedupeItems([], items)).toHaveLength(2);
  });
  it('infers non-price title lines conservatively', () => {
    expect(inferTitle('Rs. 50\nFresh mango pickle')).toBe('Fresh mango pickle');
  });
  it('extracts a title when product and price share one line', () => {
    expect(inferTitle('Royal blue soft silk saree for wedding Rs 1899')).toBe('Royal blue soft silk saree for wedding');
  });
  it('creates a low-confidence image-only review draft without AI', () => {
    const item = extractCatalogDraft({ sourceGroupId: 'g', sourceGroupTitle: 'Image Group', imageDataUrl: 'data:image/png;base64,aaa', timestamp: '2026-01-02T00:00:00.000Z' });
    expect(item?.title).toBe('Image item awaiting review');
    expect(item?.sourceTimestamp).toBe('2026-01-02T00:00:00.000Z');
    expect(item?.confidence).toBeLessThan(0.5);
    expect(item?.aiProvider).toBe('rules');
  });
});
