# WhatsApp Catalog AI MVP

A local-first MVP for monitoring a user-selected WhatsApp Web group, extracting catalog-like posts, reviewing items, and exporting CSV or Excel-compatible data.

## What is included

- Manifest V3 Chrome extension in `extension/`.
- Conservative DOM-only monitoring of an explicit list of selected chat titles.
- Local Node TypeScript backend using durable JSON storage.
- Server-side OpenAI Vision extraction when `OPENAI_API_KEY` is set. Tests do not call OpenAI.
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

## Safety and risk disclosures

- This extension does not request cookies, credentials, or broad browser history.
- It only reads DOM content visible in the active WhatsApp Web page and only posts matching selected-chat messages to `http://127.0.0.1:3737`.
- It is brittle because WhatsApp Web DOM selectors can change.
- WhatsApp Web lazily renders history, so the MVP automatically captures new messages and currently visible history, not every old message without opening and scrolling a group.
- Image posts are supported. Video file/frame extraction is a planned follow-up; accompanying video captions are captured today.
- Ensure you have consent and a lawful basis before processing group messages or images.
- OpenAI Vision sends image/message content externally only when a server-side `OPENAI_API_KEY` is configured and an image item is submitted.
- Tests use local fixtures only and do not interact with WhatsApp Web or external APIs.

## Development

```bash
npm test
npm run build
npm run dev
```

Data is stored in `DATA_FILE`, defaulting to `./data/catalog.json`.
