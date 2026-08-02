# WhatsApp Catalog AI MVP

A local-first MVP for monitoring a user-selected WhatsApp Web group, extracting catalog-like posts, reviewing items, and exporting CSV or Excel-compatible data.

## What is included

- Manifest V3 Chrome extension in `extension/`.
- Conservative DOM-only monitoring of an explicit list of selected chat titles.
- Local Node TypeScript backend using durable JSON storage.
- Rich apparel catalog data model with deterministic product codes, apparel attributes, SEO metadata, bullets, FAQ, geo/source summary, confidence, and provider attribution.
- Server-side structured AI extraction with `AI_PROVIDER=openai|gemini` when the matching API key is set. Tests mock provider responses and never call external APIs.
- Review web UI with approve/reject/edit fields.
- CSV and Excel-compatible HTML export endpoints.
- Fixture-based parser and deduplication tests.

## Setup

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Open <http://127.0.0.1:3737> for review. Load `extension/` as an unpacked extension in Chrome, open WhatsApp Web yourself, then visit each group and click **Add current chat** in the extension popup. The extension captures new or currently rendered text and images while a selected chat is open. Keep WhatsApp Web open for continuous monitoring.

Enable **Cycle through selected groups** to let the extension visibly open each selected chat in sequence. Keep WhatsApp Web in a dedicated visible window because Chrome throttles or pauses DOM automation in hidden tabs and the cycling changes the active conversation.

The extension stores an independent successful-scan checkpoint for every selected group. If scanning is interrupted, the next cycle scrolls backward to that checkpoint, processes missed messages first, returns to the latest messages, and only then advances the checkpoint. A newly added group starts from the beginning of the current local day rather than importing its entire lifetime by default.

## Safety and risk disclosures

- This extension does not request cookies, credentials, or broad browser history.
- It only reads DOM content visible in the active WhatsApp Web page and only posts matching selected-chat messages to `http://127.0.0.1:3737`.
- It is brittle because WhatsApp Web DOM selectors can change.
- WhatsApp Web lazily renders history, so the MVP automatically captures new messages and currently visible history, not every old message without opening and scrolling a group.
- Image posts are supported. Video file/frame extraction is a planned follow-up; accompanying video captions are captured today.
- AI extraction sends image/message content externally only when `AI_PROVIDER` is configured with a matching server-side API key: `OPENAI_API_KEY` for OpenAI or `GEMINI_API_KEY` for Gemini. Without a key, the backend uses deterministic local rule fallback.
- Tests use local fixtures and mocked provider responses only. They do not interact with WhatsApp Web, OpenAI, Gemini, or other external APIs.

## Development

```bash
npm test
npm run build
npm run dev
```

Data is stored in `DATA_FILE`, defaulting to `./data/catalog.json`.

### Backend catalog data

The backend stores one rich `CatalogItem` per source message. Each item includes source identifiers and timestamp, a deterministic `productCode` generated from the WhatsApp group title plus a stable hash suffix, apparel fields (`category`, `fabric`, `weave`, `feel`, `color`, `sizes`, `occasion`), commercial fields (`price`, `currency`, care instructions), SEO/content fields (`seoTitle`, short and long descriptions, bullets, keywords, meta title/description, image alt text, FAQ), provenance (`geoSummary`, `confidence`, `aiProvider`), review status, and timestamps.

`POST /api/messages` first builds a deterministic local rule draft. For image or AI-enabled inputs, the selected provider may enrich the draft, but provider JSON is schema-validated before merging. Invalid or unavailable provider output falls back to rules. `PATCH /api/items/:id` accepts editable rich catalog fields and rejects immutable source fields such as `id`, `sourceGroupId`, and `sourceMessageId`.

### Backend AI configuration

```bash
AI_PROVIDER=openai # or gemini
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

If `AI_PROVIDER=gemini`, set `GEMINI_API_KEY`. Otherwise OpenAI is used when `OPENAI_API_KEY` is present. `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, and `GEMINI_MODEL` can override defaults. Tests mock `fetch` and never make external provider calls.

### Backend export

`GET /api/export.csv` and `GET /api/export.xls` include the rich catalog columns, including product code, apparel attributes, SEO fields, FAQ, confidence, provider, status, and timestamps. Array fields are flattened with ` | ` for spreadsheet readability.
