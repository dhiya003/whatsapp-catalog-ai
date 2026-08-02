import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { resolve } from 'node:path';
import { z } from 'zod';
import { JsonCatalogStore } from './store.js';
import { extractCatalogDraft } from '../core/parser.js';
import { extractWithAiProvider } from './openaiVision.js';
import { toCsv, toExcelHtml } from './exporters.js';
import { richCatalogPatchSchema } from '../core/types.js';

const incomingSchema = z.object({
  sourceGroupId: z.string().min(1), sourceGroupTitle: z.string().min(1), messageId: z.string().optional(),
  author: z.string().optional(), timestamp: z.string().optional(), text: z.string().optional(), imageDataUrl: z.string().optional()
});

export async function buildServer() {
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'validation failed', issues: error.issues });
    return reply.send(error);
  });
  const store = new JsonCatalogStore(process.env.DATA_FILE || './data/catalog.json');
  await app.register(staticPlugin, { root: resolve('dist/ui'), prefix: '/' });
  app.get('/api/items', async () => store.list());
  app.post('/api/messages', async (request, reply) => {
    const input = incomingSchema.parse(request.body);
    const item = await extractWithAiProvider(input);
    if (!item) return reply.code(202).send({ accepted: false });
    await store.upsert([item]);
    return { accepted: true, item };
  });
  app.patch('/api/items/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const patch = richCatalogPatchSchema.parse(request.body);
    const item = await store.update(id, patch);
    return item ?? reply.code(404).send({ error: 'not found' });
  });
  app.post('/api/items/:id/enrich', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const existing = (await store.list()).find((item) => item.id === id);
    if (!existing) return reply.code(404).send({ error: 'not found' });
    const enriched = await extractWithAiProvider({
      sourceGroupId: existing.sourceGroupId,
      sourceGroupTitle: existing.sourceGroupTitle,
      messageId: existing.sourceMessageId,
      timestamp: existing.sourceTimestamp,
      text: existing.description || existing.longDescription || existing.title,
      imageDataUrl: existing.imageDataUrl
    });
    if (!enriched) return reply.code(422).send({ error: 'could not enrich item' });
    const { id: _id, sourceMessageId: _messageId, sourceGroupId: _groupId, sourceGroupTitle: _groupTitle, createdAt: _createdAt, ...patch } = enriched;
    const updated = await store.update(id, { ...patch, productCode: existing.productCode, status: existing.status });
    return updated;
  });
  app.get('/api/export.csv', async (_req, reply) => reply.header('content-type', 'text/csv').send(toCsv(await store.list())));
  app.get('/api/export.xls', async (_req, reply) => reply.header('content-type', 'application/vnd.ms-excel').send(toExcelHtml(await store.list())));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3737) });
}
