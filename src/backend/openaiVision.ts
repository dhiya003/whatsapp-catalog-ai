import type { CatalogItem, IncomingMessage } from '../core/types.js';
import { extractCatalogDraft } from '../core/parser.js';

export async function extractWithOpenAIVision(input: IncomingMessage): Promise<CatalogItem | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !input.imageDataUrl) return extractCatalogDraft(input);
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Extract a product title, price, and short description from this catalog image/message. Return strict JSON.' },
        { type: 'image_url', image_url: { url: input.imageDataUrl } }
      ] }],
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) throw new Error(`OpenAI vision failed: ${response.status}`);
  const data: any = await response.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  const base = extractCatalogDraft({ ...input, text: [parsed.title, parsed.price, parsed.description].filter(Boolean).join('\n') });
  return base ? { ...base, extractedBy: 'openai-vision', title: parsed.title || base.title, price: parsed.price || base.price, description: parsed.description || base.description } : null;
}
