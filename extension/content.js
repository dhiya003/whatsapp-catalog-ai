const LOCAL_ENDPOINT = 'http://127.0.0.1:3737/api/messages';
let observedGroupTitle = null;
let seen = new Set();

function currentChatTitle() {
  return document.querySelector('header [title]')?.getAttribute('title') || document.querySelector('header span[dir="auto"]')?.textContent?.trim() || '';
}
function groupId(title) { return `wa-title:${title.toLowerCase().replace(/\s+/g, '-')}`; }
function messageNodes() { return [...document.querySelectorAll('[data-id], div.message-in, div.message-out')].slice(-30); }
function textOf(node) { return node.querySelector('[selectable-text], span[dir="auto"]')?.textContent?.trim() || node.textContent?.trim() || ''; }
function imageOf(node) { return node.querySelector('img[src^="blob:"], img[src^="data:image"]')?.src; }
function safeId(node, title, text) { return node.getAttribute('data-id') || `${title}:${text.slice(0, 80)}:${node.querySelector('img')?.src?.slice(0, 40) || ''}`; }
async function postMessage(payload) {
  try { await fetch(LOCAL_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); }
  catch (err) { console.warn('Catalog AI local backend unavailable', err); }
}
function scan() {
  if (!observedGroupTitle) return;
  const title = currentChatTitle();
  if (title !== observedGroupTitle) return;
  for (const node of messageNodes()) {
    const text = textOf(node);
    const imageDataUrl = imageOf(node)?.startsWith('data:image') ? imageOf(node) : undefined;
    const messageId = safeId(node, title, text);
    if (seen.has(messageId) || (!text && !imageDataUrl)) continue;
    seen.add(messageId);
    postMessage({ sourceGroupId: groupId(title), sourceGroupTitle: title, messageId, text, imageDataUrl, timestamp: new Date().toISOString() });
  }
}
chrome.storage.local.get(['observedGroupTitle'], (v) => { observedGroupTitle = v.observedGroupTitle || null; });
chrome.storage.onChanged.addListener((changes) => { if (changes.observedGroupTitle) { observedGroupTitle = changes.observedGroupTitle.newValue; seen = new Set(); } });
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
setInterval(scan, 5000);
