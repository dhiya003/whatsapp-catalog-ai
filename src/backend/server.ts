import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { resolve } from 'node:path';
import { z } from 'zod';
import { JsonCatalogStore } from './store.js';
import { extractCatalogDraft } from '../core/parser.js';
import { extractWithOpenAIVision } from './openaiVision.js';
import { toCsv, toExcelHtml } from './exporters.js';

const incomingSchema = z.object({
  sourceGroupId: z.string().min(1), sourceGroupTitle: z.string().min(1), messageId: z.string().optional(),
  author: z.string().optional(), timestamp: z.string().optional(), text: z.string().optional(), imageDataUrl: z.string().optional()
});

export async function buildServer() {
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });
  const store = new JsonCatalogStore(process.env.DATA_FILE || './data/catalog.json');
  await app.register(staticPlugin, { root: resolve('dist/ui'), prefix: '/' });
  app.get('/api/items', async () => store.list());
  app.post('/api/messages', async (request, reply) => {
    const input = incomingSchema.parse(request.body);
    const item = input.imageDataUrl ? await extractWithOpenAIVision(input) : extractCatalogDraft(input);
    if (!item) return reply.code(202).send({ accepted: false });
    await store.upsert([item]);
    return { accepted: true, item };
  });
  app.patch('/api/items/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const patch = z.object({ title: z.string().optional(), price: z.string().optional(), description: z.string().optional(), status: z.enum(['pending','approved','rejected']).optional() }).parse(request.body);
    const item = await store.update(id, patch);
    return item ?? reply.code(404).send({ error: 'not found' });
  });
  app.get('/api/export.csv', async (_req, reply) => reply.header('content-type', 'text/csv').send(toCsv(await store.list())));
  app.get('/api/export.xls', async (_req, reply) => reply.header('content-type', 'application/vnd.ms-excel').send(toExcelHtml(await store.list())));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3737) });
}
