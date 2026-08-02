import { catalogItemSchema, type CatalogItem, type IncomingMessage } from '../core/types.js';
import { extractCatalogDraft } from '../core/parser.js';

const richJsonPrompt = `You are an expert Indian apparel merchandiser, marketplace catalog specialist, and SEO/GEO copywriter. Extract a rich product record from the WhatsApp message and optional image. Return only JSON with these optional fields: title, category, fabric, weave, feel, color, sizes, occasion, price, currency, careInstructions, seoTitle, shortDescription, longDescription, bulletPoints, keywords, metaTitle, metaDescription, imageAltText, geoSummary, faq, confidence.

Write natural, conversion-focused copy suitable for Meesho, Amazon, Flipkart, Google, and AI answer engines. seoTitle and metaTitle should lead with the primary product phrase. metaDescription should be concise. longDescription should clearly describe material, weave, feel, styling, and occasion only when supported. geoSummary means Generative Engine Optimization: provide a direct, factual answer-style product summary using explicit entities and attributes. faq must be an array of useful {question, answer} pairs. confidence must be 0..1. Do not invent unavailable price, sizes, composition, certifications, brand, stock, or care claims. Mark uncertain visual inferences with lower confidence.`;

type AiProvider = 'openai' | 'gemini';

export async function extractWithAiProvider(input: IncomingMessage): Promise<CatalogItem | null> {
  const provider = normalizeProvider(process.env.AI_PROVIDER);
  try {
    if (provider === 'gemini') return await extractWithGemini(input);
    return await extractWithOpenAI(input);
  } catch (error) {
    console.warn(`${provider} enrichment failed; using local intelligent fallback`, error);
    return extractCatalogDraft(input);
  }
}

export async function extractWithOpenAIVision(input: IncomingMessage): Promise<CatalogItem | null> {
  return extractWithAiProvider(input);
}

async function extractWithOpenAI(input: IncomingMessage): Promise<CatalogItem | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || (!input.imageDataUrl && !input.text)) return extractCatalogDraft(input);
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const content: any[] = [{ type: 'text', text: `${richJsonPrompt}\nMessage text:\n${input.text ?? ''}` }];
  if (input.imageDataUrl) content.push({ type: 'image_url', image_url: { url: input.imageDataUrl } });
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], response_format: { type: 'json_object' } })
  });
  if (!response.ok) throw new Error(`OpenAI extraction failed: ${response.status}`);
  const data: any = await response.json();
  return mergeAiJson(input, parseJsonObject(data.choices?.[0]?.message?.content), 'openai');
}

async function extractWithGemini(input: IncomingMessage): Promise<CatalogItem | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || (!input.imageDataUrl && !input.text)) return extractCatalogDraft(input);
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const parts: any[] = [{ text: `${richJsonPrompt}\nMessage text:\n${input.text ?? ''}` }];
  const image = imagePart(input.imageDataUrl);
  if (image) parts.push(image);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json' } })
  });
  if (!response.ok) throw new Error(`Gemini extraction failed: ${response.status}`);
  const data: any = await response.json();
  return mergeAiJson(input, parseJsonObject(data.candidates?.[0]?.content?.parts?.[0]?.text), 'gemini');
}

function mergeAiJson(input: IncomingMessage, raw: unknown, provider: AiProvider): CatalogItem | null {
  const base = extractCatalogDraft(input);
  if (!base) return null;
  const parsed = aiJsonSchema.safeParse(normalizeAiJson(raw));
  if (!parsed.success) return { ...base, aiProvider: 'rules', extractedBy: 'rules', confidence: Math.min(base.confidence, 0.4) };
  const candidate = {
    ...base,
    ...dropUndefined(parsed.data),
    id: base.id,
    sourceMessageId: base.sourceMessageId,
    sourceGroupId: base.sourceGroupId,
    sourceGroupTitle: base.sourceGroupTitle,
    sourceTimestamp: base.sourceTimestamp,
    productCode: base.productCode,
    imageDataUrl: base.imageDataUrl,
    status: base.status,
    aiProvider: provider,
    extractedBy: provider,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    confidence: parsed.data.confidence ?? Math.max(base.confidence, 0.78)
  };
  return catalogItemSchema.parse(candidate);
}

function normalizeAiJson(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const allowed = new Set(Object.keys(aiJsonSchema.shape));
  const normalized: Record<string, unknown> = {};
  const arrayFields = new Set(['sizes', 'careInstructions', 'bulletPoints', 'keywords']);
  const stringFields = new Set(['title', 'category', 'fabric', 'weave', 'feel', 'color', 'occasion', 'price', 'currency', 'seoTitle', 'shortDescription', 'longDescription', 'metaTitle', 'metaDescription', 'imageAltText', 'geoSummary']);
  for (const [key, value] of Object.entries(source)) {
    if (!allowed.has(key) || value === null || value === undefined) continue;
    if (arrayFields.has(key)) {
      normalized[key] = Array.isArray(value) ? value.map(String).filter(Boolean) : String(value).split(/[\n,;]+/).map((entry) => entry.trim()).filter(Boolean);
    } else if (stringFields.has(key)) {
      normalized[key] = Array.isArray(value) ? value.map(String).join(', ') : String(value);
    } else if (key === 'confidence') {
      const confidence = Number(value);
      if (Number.isFinite(confidence)) normalized[key] = Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence));
    } else if (key === 'faq') {
      const entries = Array.isArray(value) ? value : [value];
      normalized[key] = entries.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const question = String((entry as any).question ?? '').trim();
        const answer = String((entry as any).answer ?? '').trim();
        return question && answer ? [{ question, answer }] : [];
      });
    }
  }
  return normalized;
}

const aiJsonSchema = catalogItemSchema.pick({
  title: true,
  category: true,
  fabric: true,
  weave: true,
  feel: true,
  color: true,
  sizes: true,
  occasion: true,
  price: true,
  currency: true,
  careInstructions: true,
  seoTitle: true,
  shortDescription: true,
  longDescription: true,
  bulletPoints: true,
  keywords: true,
  metaTitle: true,
  metaDescription: true,
  imageAltText: true,
  geoSummary: true,
  faq: true,
  confidence: true
}).partial().strict();

function normalizeProvider(value?: string): AiProvider {
  return value?.toLowerCase() === 'gemini' ? 'gemini' : 'openai';
}

function parseJsonObject(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? {};
  try { return JSON.parse(value); } catch { return {}; }
}

function dropUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function imagePart(dataUrl?: string): any | undefined {
  const match = dataUrl?.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return undefined;
  return { inlineData: { mimeType: match[1], data: match[2] } };
}
