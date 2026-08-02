let observedGroupTitles = [];
let autoScanEnabled = false;
let autoScanSeconds = 15;
let autoScanIndex = 0;
let autoScanBusy = false;
let groupCheckpoints = {};
const seen = new Set();
const inFlight = new Set();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (value) => new Promise((resolve) => chrome.storage.local.set(value, resolve));

function currentChatTitle() {
  const header = document.querySelector('#main header') || document.querySelector('header');
  const candidates = [...(header?.querySelectorAll('span[title], [data-testid="conversation-info-header-chat-title"], span[dir="auto"]') || [])];
  return candidates.map((node) => node.getAttribute('title') || node.textContent?.trim() || '').find((value) => value && value !== 'Profile details') || '';
}
function groupId(title) { return `wa-title:${title.toLowerCase().replace(/\s+/g, '-')}`; }
function messageNodes(limit) {
  let nodes = [...document.querySelectorAll('#main [data-id]')];
  if (!nodes.length) nodes = [...document.querySelectorAll('#main div.message-in, #main div.message-out')];
  return limit ? nodes.slice(-limit) : nodes;
}
function textOf(node) { return node.querySelector('[selectable-text], span[dir="auto"]')?.textContent?.trim() || node.textContent?.trim() || ''; }
function imageOf(node) { return node.querySelector('img[src^="blob:"], img[src^="data:image"]')?.src; }
function metadataOf(node) { return node.getAttribute('data-pre-plain-text') || node.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || ''; }
function timestampOf(node) { return CatalogHistory.parseWhatsAppTimestamp(metadataOf(node), new Date()); }
function safeId(node, title, text, timestamp) { return node.getAttribute('data-id') || `${title}:${timestamp}:${text.slice(0, 100)}:${node.querySelector('img')?.src?.slice(0, 40) || ''}`; }

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
    return Boolean(result?.ok);
  } catch (error) {
    if (!String(error).includes('Extension context invalidated')) console.warn('Catalog AI local backend unavailable', error);
    return false;
  }
}
async function scanNodes(title, nodes) {
  let captured = 0;
  let oldestTimestamp = null;
  for (const node of nodes) {
    const timestamp = timestampOf(node);
    if (!oldestTimestamp || new Date(timestamp) < new Date(oldestTimestamp)) oldestTimestamp = timestamp;
    const text = textOf(node);
    const imageUrl = imageOf(node);
    const messageId = safeId(node, title, text, timestamp);
    if (seen.has(messageId) || inFlight.has(messageId) || (!text && !imageUrl)) continue;
    inFlight.add(messageId);
    const imageDataUrl = await toDataUrl(imageUrl);
    const ok = await postMessage({ sourceGroupId: groupId(title), sourceGroupTitle: title, messageId, text, imageDataUrl, timestamp });
    inFlight.delete(messageId);
    if (ok) { seen.add(messageId); captured += 1; }
  }
  return { captured, oldestTimestamp };
}
async function scanVisible() {
  if (!observedGroupTitles.length || autoScanBusy) return;
  const title = currentChatTitle();
  if (!observedGroupTitles.includes(title)) return;
  await scanNodes(title, messageNodes(40));
}

function findScrollableMessagePanel() {
  const message = messageNodes(1)[0];
  let node = message?.parentElement;
  while (node && node !== document.body) {
    if (node.scrollHeight > node.clientHeight + 100) return node;
    node = node.parentElement;
  }
  return document.querySelector('#main [data-testid="conversation-panel-messages"]');
}
async function setScanStatus(title, status) {
  const stored = await storageGet(['groupScanStatus']);
  await storageSet({ groupScanStatus: { ...(stored.groupScanStatus || {}), [groupId(title)]: { title, updatedAt: new Date().toISOString(), ...status } } });
}
async function backfillAndScan(title) {
  const id = groupId(title);
  const hadCheckpoint = Boolean(groupCheckpoints[id]);
  const checkpoint = groupCheckpoints[id] || CatalogHistory.initialCheckpoint(new Date());
  const panel = findScrollableMessagePanel();
  let reachedCheckpoint = false;
  let captured = 0;
  let attempts = 0;
  await setScanStatus(title, { state: 'backfilling', checkpoint, captured });

  while (attempts < 80) {
    const result = await scanNodes(title, messageNodes());
    captured += result.captured;
    if (!CatalogHistory.shouldContinueBackfill(result.oldestTimestamp, checkpoint)) {
      reachedCheckpoint = true;
      break;
    }
    if (!panel) break;
    const previousHeight = panel.scrollHeight;
    panel.scrollTop = 0;
    await delay(900);
    attempts += 1;
    if (panel.scrollHeight === previousHeight && panel.scrollTop === 0 && attempts > 2) break;
  }

  if (panel) {
    panel.scrollTop = panel.scrollHeight;
    await delay(1000);
  }
  const current = await scanNodes(title, messageNodes());
  captured += current.captured;
  if (reachedCheckpoint || !hadCheckpoint) {
    groupCheckpoints[id] = new Date().toISOString();
    await storageSet({ groupCheckpoints });
  }
  await setScanStatus(title, {
    state: reachedCheckpoint || !hadCheckpoint ? 'complete' : 'partial',
    checkpoint: groupCheckpoints[id] || checkpoint,
    captured,
    scrollAttempts: attempts
  });
  return reachedCheckpoint;
}

function findChatTitle(title) {
  const nodes = [...document.querySelectorAll('#pane-side span[title], #side span[title]')];
  return nodes.find((node) => node.getAttribute('title') === title);
}
function searchBox() {
  return document.querySelector('#side div[contenteditable="true"][role="textbox"]') || document.querySelector('#side div[contenteditable="true"]');
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
  (target.closest('[role="listitem"], [data-testid="cell-frame-container"], [tabindex="-1"]') || target).click();
  await delay(1800);
  return currentChatTitle() === title;
}
async function autoScanNext() {
  if (!autoScanEnabled || autoScanBusy || !observedGroupTitles.length) return;
  autoScanBusy = true;
  const title = observedGroupTitles[autoScanIndex % observedGroupTitles.length];
  autoScanIndex = (autoScanIndex + 1) % observedGroupTitles.length;
  try {
    await setScanStatus(title, { state: 'opening' });
    if (await openChat(title)) await backfillAndScan(title);
    else await setScanStatus(title, { state: 'not-found', error: 'Chat title was not found in WhatsApp Web' });
  } catch (error) {
    await setScanStatus(title, { state: 'error', error: String(error) });
  } finally {
    autoScanBusy = false;
  }
}

chrome.storage.local.get(['observedGroupTitles', 'autoScanEnabled', 'autoScanSeconds', 'groupCheckpoints'], (value) => {
  observedGroupTitles = value.observedGroupTitles || [];
  autoScanEnabled = Boolean(value.autoScanEnabled);
  autoScanSeconds = Math.max(10, Number(value.autoScanSeconds) || 15);
  groupCheckpoints = value.groupCheckpoints || {};
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.observedGroupTitles) { observedGroupTitles = changes.observedGroupTitles.newValue || []; autoScanIndex = 0; }
  if (changes.autoScanEnabled) autoScanEnabled = Boolean(changes.autoScanEnabled.newValue);
  if (changes.autoScanSeconds) autoScanSeconds = Math.max(10, Number(changes.autoScanSeconds.newValue) || 15);
  if (changes.groupCheckpoints) groupCheckpoints = changes.groupCheckpoints.newValue || {};
});
new MutationObserver(scanVisible).observe(document.body, { childList: true, subtree: true });
setInterval(scanVisible, 5000);
let lastAutoScanAt = 0;
setInterval(() => {
  const now = Date.now();
  if (autoScanEnabled && now - lastAutoScanAt >= autoScanSeconds * 1000) {
    lastAutoScanAt = now;
    autoScanNext();
  }
}, 1000);
