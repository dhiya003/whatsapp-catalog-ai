import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

async function helpers() {
  const context: any = { Date };
  context.globalThis = context;
  vm.runInNewContext(await readFile('extension/history.js', 'utf8'), context);
  return context.CatalogHistory;
}

describe('WhatsApp history recovery helpers', () => {
  it('parses WhatsApp source timestamps in 24-hour and 12-hour forms', async () => {
    const history = await helpers();
    expect(history.parseWhatsAppTimestamp('[09:15, 01/08/2026] Seller:')).toContain('2026-08-01');
    const evening = new Date(history.parseWhatsAppTimestamp('[9:15 PM, 01/08/26] Seller:'));
    expect(evening.getHours()).toBe(21);
    expect(evening.getMinutes()).toBe(15);
  });

  it('starts a new installation at the beginning of the current local day', async () => {
    const history = await helpers();
    expect(history.initialCheckpoint(new Date(2026, 7, 2, 15, 45))).toBe(new Date(2026, 7, 2, 0, 0).toISOString());
  });

  it('continues scrolling until rendered history reaches the checkpoint', async () => {
    const history = await helpers();
    expect(history.shouldContinueBackfill('2026-08-02T10:00:00Z', '2026-08-01T10:00:00Z')).toBe(true);
    expect(history.shouldContinueBackfill('2026-08-01T09:59:00Z', '2026-08-01T10:00:00Z')).toBe(false);
  });
});
