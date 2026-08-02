let observedGroupTitles = [];
let autoScanEnabled = false;
let autoScanSeconds = 15;
let autoScanIndex = 0;
let autoScanBusy = false;
let seen = new Set();

function currentChatTitle() {
  const header = document.querySelector('#main header') || document.querySelector('header');
  const candidates = [...(header?.querySelectorAll('span[title], [data-testid="conversation-info-header-chat-title"], span[dir="auto"]') || [])];
  return candidates.map((node) => node.getAttribute('title') || node.textContent?.trim() || '').find(Boolean) || '';
}
function groupId(title) { return `wa-title:${title.toLowerCase().replace(/\s+/g, '-')}`; }
function messageNodes() { return [...document.querySelectorAll('[data-id], div.message-in, div.message-out')].slice(-30); }
function textOf(node) { return node.querySelector('[selectable-text], span[dir="auto"]')?.textContent?.trim() || node.textContent?.trim() || ''; }
function imageOf(node) { return node.querySelector('img[src^="blob:"], img[src^="data:image"]')?.src; }
function safeId(node, title, text) { return node.getAttribute('data-id') || `${title}:${text.slice(0, 80)}:${node.querySelector('img')?.src?.slice(0, 40) || ''}`; }
async function toDataUrl(url) {
  if (!url) return undefined;
  if (url.startsWith('data:image')) return url;
  if (!url.startsWith('blob:')) return undefined;
  try {
    const blob = await fetch(url).then((response) => response.blob());
    if (!blob.type.startsWith('image/')) return undefined;
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Catalog AI could not read image', error);
    return undefined;
  }
}
async function postMessage(payload) {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'catalog-message', payload });
    if (!result?.ok) console.warn('Catalog AI local backend unavailable', result);
  } catch (err) { console.warn('Catalog AI local backend unavailable', err); }
}
async function scan() {
  if (!observedGroupTitles.length) return;
  const title = currentChatTitle();
  if (!observedGroupTitles.includes(title)) return;
  for (const node of messageNodes()) {
    const text = textOf(node);
    const messageId = safeId(node, title, text);
    const imageUrl = imageOf(node);
    if (seen.has(messageId) || (!text && !imageUrl)) continue;
    seen.add(messageId);
    const imageDataUrl = await toDataUrl(imageUrl);
    postMessage({ sourceGroupId: groupId(title), sourceGroupTitle: title, messageId, text, imageDataUrl, timestamp: new Date().toISOString() });
  }
}
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function findChatTitle(title) {
  const nodes = [...document.querySelectorAll('#pane-side span[title], #side span[title]')];
  return nodes.find((node) => node.getAttribute('title') === title);
}
function searchBox() {
  return document.querySelector('#side div[contenteditable="true"][role="textbox"]') ||
    document.querySelector('#side div[contenteditable="true"]');
}
function replaceEditableText(element, text) {
  element.focus();
  document.execCommand('selectAll', false);
  document.execCommand('insertText', false, text);
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}
async function openChat(title) {
  let target = findChatTitle(title);
  if (!target) {
    const search = searchBox();
    if (!search) return false;
    replaceEditableText(search, title);
    await delay(1200);
    target = findChatTitle(title);
  }
  if (!target) return false;
  (target.closest('[role="listitem"], [data-testid="cell-frame-container"]') || target).click();
  await delay(1800);
  return currentChatTitle() === title;
}
async function autoScanNext() {
  if (!autoScanEnabled || autoScanBusy || !observedGroupTitles.length || document.visibilityState !== 'visible') return;
  autoScanBusy = true;
  try {
    const title = observedGroupTitles[autoScanIndex % observedGroupTitles.length];
    autoScanIndex = (autoScanIndex + 1) % observedGroupTitles.length;
    if (await openChat(title)) await scan();
  } finally {
    autoScanBusy = false;
  }
}
chrome.storage.local.get(['observedGroupTitles', 'autoScanEnabled', 'autoScanSeconds'], (v) => {
  observedGroupTitles = v.observedGroupTitles || [];
  autoScanEnabled = Boolean(v.autoScanEnabled);
  autoScanSeconds = Math.max(10, Number(v.autoScanSeconds) || 15);
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.observedGroupTitles) { observedGroupTitles = changes.observedGroupTitles.newValue || []; seen = new Set(); autoScanIndex = 0; }
  if (changes.autoScanEnabled) autoScanEnabled = Boolean(changes.autoScanEnabled.newValue);
  if (changes.autoScanSeconds) autoScanSeconds = Math.max(10, Number(changes.autoScanSeconds.newValue) || 15);
});
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
setInterval(scan, 5000);
let lastAutoScanAt = 0;
setInterval(() => {
  const now = Date.now();
  if (autoScanEnabled && now - lastAutoScanAt >= autoScanSeconds * 1000) {
    lastAutoScanAt = now;
    autoScanNext();
  }
}, 1000);
