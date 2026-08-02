const ENDPOINT = 'http://127.0.0.1:3737/api/messages';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'catalog-message') return false;
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message.payload)
  })
    .then(async (response) => sendResponse({ ok: response.ok, status: response.status, body: await response.text() }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});
