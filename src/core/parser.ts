import { createHash } from 'node:crypto';
import type { CatalogItem, IncomingMessage } from './types.js';

const PRICE_RE = /(?:₹|rs\.?|inr|\$|usd)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:₹|rs\.?|inr|usd)/i;

export function stableMessageId(input: IncomingMessage): string {
  if (input.messageId) return input.messageId;
  return createHash('sha256')
    .update([input.sourceGroupId, input.author ?? '', input.timestamp ?? '', input.text ?? '', input.imageDataUrl?.slice(0, 512) ?? ''].join('|'))
    .digest('hex')
    .slice(0, 24);
}

export function extractCatalogDraft(input: IncomingMessage): CatalogItem | null {
  const text = (input.text ?? '').trim();
  if (!text && !input.imageDataUrl) return null;
  const price = text.match(PRICE_RE)?.[0]?.trim();
  const title = inferTitle(text);
  if (!title && !input.imageDataUrl) return null;
  const now = new Date().toISOString();
  const sourceMessageId = stableMessageId(input);
  return {
    id: createHash('sha256').update(`${input.sourceGroupId}:${sourceMessageId}`).digest('hex').slice(0, 16),
    sourceMessageId,
    sourceGroupId: input.sourceGroupId,
    sourceGroupTitle: input.sourceGroupTitle,
    title: title || 'Image item awaiting review',
    price,
    description: text || undefined,
    imageDataUrl: input.imageDataUrl,
    status: 'pending',
    extractedBy: 'rules',
    createdAt: now,
    updatedAt: now
  };
}

export function inferTitle(text: string): string {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !PRICE_RE.test(l));
  if (!line) return '';
  return line.replace(/^[*\-•\s]+|[*\s]+$/g, '').slice(0, 120);
}

export function dedupeItems(existing: CatalogItem[], incoming: CatalogItem[]): CatalogItem[] {
  const byKey = new Map<string, CatalogItem>();
  for (const item of [...existing, ...incoming]) {
    const key = `${item.sourceGroupId}:${item.sourceMessageId}`;
    const prev = byKey.get(key);
    byKey.set(key, prev ? { ...prev, ...item, id: prev.id, createdAt: prev.createdAt, updatedAt: new Date().toISOString() } : item);
  }
  return [...byKey.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
