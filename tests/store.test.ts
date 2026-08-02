import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCatalogStore } from '../src/backend/store.js';
import { extractCatalogDraft } from '../src/core/parser.js';

describe('JsonCatalogStore', () => {
  it('serializes concurrent writes and always leaves valid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'catalog-store-'));
    const file = join(dir, 'catalog.json');
    const store = new JsonCatalogStore(file);
    const items = Array.from({ length: 30 }, (_, index) => extractCatalogDraft({
      sourceGroupId: 'group', sourceGroupTitle: 'Group', messageId: `m-${index}`,
      text: `Kurti ${index}\n₹${500 + index}`
    })!);

    await Promise.all(items.map((item) => store.upsert([item])));

    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveLength(30);
    expect(await store.list()).toHaveLength(30);
  });
});
