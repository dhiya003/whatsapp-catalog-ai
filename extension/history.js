(function (root) {
  function parseWhatsAppTimestamp(value, fallback = new Date()) {
    if (!value) return fallback.toISOString();
    const match = String(value).match(/\[(\d{1,2}):(\d{2})(?:\s*([AP]M))?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]/i);
    if (!match) return fallback.toISOString();
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    let year = Number(match[6]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, Number(match[5]) - 1, Number(match[4]), hour, minute);
    return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
  }

  function initialCheckpoint(now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  function shouldContinueBackfill(oldestTimestamp, checkpoint) {
    if (!oldestTimestamp) return true;
    return new Date(oldestTimestamp).getTime() > new Date(checkpoint).getTime();
  }

  root.CatalogHistory = { parseWhatsAppTimestamp, initialCheckpoint, shouldContinueBackfill };
})(globalThis);
