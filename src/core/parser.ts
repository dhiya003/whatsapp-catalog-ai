import { createHash } from 'node:crypto';
import type { CatalogItem, IncomingMessage } from './types.js';

const PRICE_RE = /(?:₹|rs\.?|inr|\$|usd)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s?(?:₹|rs\.?|inr|usd)/i;
const COLOR_WORDS = ['black','white','blue','red','green','yellow','pink','purple','maroon','brown','beige','cream','grey','gray','orange','gold','silver','navy','teal','olive','mustard','peach','ivory'];
const FABRICS = ['cotton','silk','linen','rayon','viscose','georgette','chiffon','denim','wool','polyester','satin','crepe','velvet','organza','khadi'];
const WEAVES = ['handloom','ikat','jacquard','chanderi','banarasi','kanjivaram','twill','plain weave','dobby','woven','knit'];
const SIZES = ['xxs','xs','s','m','l','xl','xxl','xxxl','free size','free-size'];
const OCCASIONS = ['wedding','party','festive','festival','office','casual','daily','ethnic','formal','summer','winter','vacation'];

export function stableMessageId(input: IncomingMessage): string {
  if (input.messageId) return input.messageId;
  return createHash('sha256')
    .update([input.sourceGroupId, input.author ?? '', input.timestamp ?? '', input.text ?? '', input.imageDataUrl?.slice(0, 512) ?? ''].join('|'))
    .digest('hex')
    .slice(0, 24);
}

export function productCodeFor(sourceGroupTitle: string, sourceMessageId: string): string {
  const prefix = sourceGroupTitle
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .filter(Boolean)
    .join('-')
    .slice(0, 24)
    .replace(/-$/g, '') || 'CATALOG';
  const suffix = createHash('sha256').update(`${sourceGroupTitle}:${sourceMessageId}`).digest('hex').slice(0, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

export function extractCatalogDraft(input: IncomingMessage): CatalogItem | null {
  const text = (input.text ?? '').trim();
  if (!text && !input.imageDataUrl) return null;
  const title = inferTitle(text);
  if (!title && !input.imageDataUrl) return null;
  const now = new Date().toISOString();
  const sourceMessageId = stableMessageId(input);
  const price = text.match(PRICE_RE)?.[0]?.trim();
  const currency = inferCurrency(price);
  const category = inferCategory(text || title);
  const fabric = findFirst(text, FABRICS);
  const weave = findFirst(text, WEAVES);
  const color = findFirst(text, COLOR_WORDS);
  const sizes = inferSizes(text);
  const occasion = findFirst(text, OCCASIONS);
  const displayTitle = title || 'Image item awaiting review';
  const facts = [color, fabric, weave, category].filter(Boolean).join(' ');
  const shortDescription = text ? firstSentence(text, 180) : `${displayTitle} awaiting catalog review.`;
  const longDescription = text || `${displayTitle} from ${input.sourceGroupTitle}. Add details after reviewing the source image.`;
  const keywords = unique([displayTitle, category, fabric, weave, color, occasion, input.sourceGroupTitle].filter(Boolean).flatMap((v) => String(v).toLowerCase().split(/[^a-z0-9₹$]+/)).filter((v) => v.length > 2).slice(0, 12));
  const bulletPoints = unique([
    facts ? `${capitalize(facts)} styling` : undefined,
    price ? `Listed price ${price}` : undefined,
    sizes.length ? `Available sizes: ${sizes.join(', ')}` : undefined,
    occasion ? `Suitable for ${occasion}` : undefined,
    fabric ? `${capitalize(fabric)} fabric` : undefined
  ].filter(Boolean) as string[]).slice(0, 5);
  const careInstructions = inferCareInstructions(fabric);
  const geoSummary = `Sourced from WhatsApp group ${input.sourceGroupTitle}${input.timestamp ? ` on ${input.timestamp}` : ''}.`;

  return {
    id: createHash('sha256').update(`${input.sourceGroupId}:${sourceMessageId}`).digest('hex').slice(0, 16),
    sourceMessageId,
    sourceGroupId: input.sourceGroupId,
    sourceGroupTitle: input.sourceGroupTitle,
    sourceTimestamp: input.timestamp,
    productCode: productCodeFor(input.sourceGroupTitle, sourceMessageId),
    title: displayTitle,
    category,
    fabric,
    weave,
    feel: inferFeel(text, fabric),
    color,
    sizes,
    occasion,
    price,
    currency,
    careInstructions,
    seoTitle: `${displayTitle}${color ? ` in ${color}` : ''}`.slice(0, 70),
    shortDescription,
    longDescription,
    description: text || undefined,
    bulletPoints,
    keywords,
    metaTitle: `${displayTitle} | ${input.sourceGroupTitle}`.slice(0, 70),
    metaDescription: shortDescription.slice(0, 160),
    imageAltText: `${displayTitle}${color ? ` ${color}` : ''}${category ? ` ${category}` : ''}`.trim(),
    geoSummary,
    faq: [
      { question: 'What is the product?', answer: displayTitle },
      ...(price ? [{ question: 'What is the listed price?', answer: price }] : [])
    ],
    confidence: text ? 0.62 : 0.35,
    aiProvider: 'rules',
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

function inferCurrency(price?: string): string | undefined {
  if (!price) return undefined;
  return /₹|rs\.?|inr/i.test(price) ? 'INR' : /\$|usd/i.test(price) ? 'USD' : undefined;
}

function inferCategory(text: string): string | undefined {
  const lower = text.toLowerCase();
  const categories: Record<string, string[]> = {
    kurti: ['kurti', 'kurta'], saree: ['saree', 'sari'], dress: ['dress', 'gown'], shirt: ['shirt'], top: ['top', 'blouse'], pants: ['pants', 'trouser', 'jeans', 'legging'], dupatta: ['dupatta', 'shawl'], lehenga: ['lehenga']
  };
  for (const [category, words] of Object.entries(categories)) if (words.some((word) => lower.includes(word))) return category;
  return lower.match(/apparel|clothing|wear/) ? 'apparel' : undefined;
}

function findFirst(text: string, words: string[]): string | undefined {
  const lower = text.toLowerCase();
  return words.find((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(lower));
}

function inferSizes(text: string): string[] {
  const lower = text.toLowerCase();
  return unique(SIZES.filter((size) => new RegExp(`\\b${escapeRegExp(size)}\\b`, 'i').test(lower)).map((size) => size.toUpperCase().replace('-', ' ')));
}

function inferCareInstructions(fabric?: string): string[] {
  if (!fabric) return ['Follow seller care instructions', 'Wash dark colors separately'];
  if (['silk', 'chiffon', 'georgette', 'organza', 'velvet'].includes(fabric)) return ['Dry clean recommended', 'Store in a cool dry place'];
  if (['cotton', 'linen', 'denim', 'khadi'].includes(fabric)) return ['Gentle machine wash', 'Wash dark colors separately'];
  return ['Gentle wash recommended', 'Do not bleach'];
}

function inferFeel(text: string, fabric?: string): string | undefined {
  const explicit = findFirst(text, ['soft', 'breathable', 'lightweight', 'flowy', 'crisp', 'smooth', 'structured', 'cozy']);
  if (explicit) return explicit;
  if (fabric === 'cotton' || fabric === 'linen') return 'breathable';
  if (fabric === 'silk' || fabric === 'satin') return 'smooth';
  if (fabric === 'georgette' || fabric === 'chiffon') return 'flowy';
  return undefined;
}

function firstSentence(text: string, limit: number): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return (compact.match(/^(.+?[.!?])\s/)?.[1] ?? compact).slice(0, limit);
}

function unique<T>(values: T[]): T[] { return [...new Set(values.filter(Boolean))]; }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
