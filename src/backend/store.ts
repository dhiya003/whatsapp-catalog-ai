import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CatalogItem } from '../core/types.js';
import { dedupeItems, upgradeLegacyItem } from '../core/parser.js';

export class JsonCatalogStore {
  private operation: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async list(): Promise<CatalogItem[]> {
    await this.operation;
    return this.readUnsafe();
  }

  private async readUnsafe(): Promise<CatalogItem[]> {
    try {
      const raw = await readFile(this.file, 'utf8');
      return (JSON.parse(raw) as Array<Partial<CatalogItem> & Record<string, any>>).map(upgradeLegacyItem);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }
  }

  async upsert(items: CatalogItem[]): Promise<CatalogItem[]> {
    return this.serialize(async () => {
      const merged = dedupeItems(await this.readUnsafe(), items);
      await this.writeUnsafe(merged);
      return merged;
    });
  }

  async update(id: string, patch: Partial<CatalogItem>): Promise<CatalogItem | null> {
    return this.serialize(async () => {
      const items = await this.readUnsafe();
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return null;
      items[index] = { ...items[index], ...patch, id, updatedAt: new Date().toISOString() };
      await this.writeUnsafe(items);
      return items[index];
    });
  }

  private async writeUnsafe(items: CatalogItem[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(items, null, 2));
    await rename(temporary, this.file);
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work, work);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}
