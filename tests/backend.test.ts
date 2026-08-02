import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractWithAiProvider } from '../src/backend/openaiVision.js';
import { buildServer } from '../src/backend/server.js';

describe('backend AI extraction and API validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.DATA_FILE;
  });

  it('falls back to rules without API keys and does not call fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const item = await extractWithAiProvider({ sourceGroupId: 'g', sourceGroupTitle: 'Group', messageId: 'm', text: 'Red silk saree\nRs. 2000' });
    expect(item?.aiProvider).toBe('rules');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('merges validated OpenAI JSON into the deterministic base', async () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: 'AI Kurti', category: 'kurti', confidence: 0.91, sizes: ['M'], faq: [{ question: 'Fabric?', answer: 'Cotton' }] }) } }] }), { status: 200 }));
    const item = await extractWithAiProvider({ sourceGroupId: 'g', sourceGroupTitle: 'Group', messageId: 'm', text: 'Blue cotton kurti\n₹900' });
    expect(item?.title).toBe('AI Kurti');
    expect(item?.productCode).toMatch(/^GROUP-/);
    expect(item?.aiProvider).toBe('openai');
    expect(item?.confidence).toBe(0.91);
  });

  it('uses Gemini endpoint when configured', async () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: 'Gemini Dress', category: 'dress', confidence: 0.88 }) }] } }] }), { status: 200 }));
    const item = await extractWithAiProvider({ sourceGroupId: 'g', sourceGroupTitle: 'Group', messageId: 'm', text: 'Party dress\n$40' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
    expect(item?.aiProvider).toBe('gemini');
    expect(item?.currency).toBe('USD');
  });

  it('accepts rich patch fields and rejects immutable patch fields', async () => {
    process.env.DATA_FILE = `${process.cwd()}/data/test-api-${Date.now()}.json`;
    const app = await buildServer();
    const post = await app.inject({ method: 'POST', url: '/api/messages', payload: { sourceGroupId: 'g', sourceGroupTitle: 'Group', messageId: 'm', text: 'Blue cotton kurti\n₹900' } });
    const id = post.json().item.id;
    const ok = await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { color: 'teal', sizes: ['M', 'L'], confidence: 0.72 } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().color).toBe('teal');
    const bad = await app.inject({ method: 'PATCH', url: `/api/items/${id}`, payload: { sourceGroupId: 'evil' } });
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
    await app.close();
  });

  it('regenerates an existing item while preserving its product code', async () => {
    process.env.DATA_FILE = `${process.cwd()}/data/test-enrich-${Date.now()}.json`;
    const app = await buildServer();
    const post = await app.inject({ method: 'POST', url: '/api/messages', payload: { sourceGroupId: 'g', sourceGroupTitle: 'Group', messageId: 'enrich-m', text: 'Blue cotton kurti\n₹900' } });
    const item = post.json().item;
    const enriched = await app.inject({ method: 'POST', url: `/api/items/${item.id}/enrich` });
    expect(enriched.statusCode).toBe(200);
    expect(enriched.json().productCode).toBe(item.productCode);
    await app.close();
  });
});
