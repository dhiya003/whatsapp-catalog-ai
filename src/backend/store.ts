import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CatalogItem } from '../core/types.js';
import { dedupeItems } from '../core/parser.js';

export class JsonCatalogStore {
  constructor(private readonly file: string) {}

  async list(): Promise<CatalogItem[]> {
    try {
      const raw = await readFile(this.file, 'utf8');
      return JSON.parse(raw) as CatalogItem[];
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async upsert(items: CatalogItem[]): Promise<CatalogItem[]> {
    const merged = dedupeItems(await this.list(), items);
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(merged, null, 2));
    return merged;
  }

  async update(id: string, patch: Partial<CatalogItem>): Promise<CatalogItem | null> {
    const items = await this.list();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...patch, id, updatedAt: new Date().toISOString() };
    await writeFile(this.file, JSON.stringify(items, null, 2));
    return items[index];
  }
}
