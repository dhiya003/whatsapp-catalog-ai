const status = document.getElementById('status');
const message = document.getElementById('message');
const scanStatus = document.getElementById('scanStatus');
function save(titles) { chrome.storage.local.set({ observedGroupTitles: titles }, () => render(titles)); }
function render(titles) {
  status.replaceChildren();
  message.textContent = titles.length ? `Monitoring ${titles.length} chats:` : 'Not monitoring';
  for (const title of titles) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-start;margin:5px 0';
    const label = document.createElement('span');
    label.textContent = title;
    label.style.flex = '1';
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.title = `Remove ${title}`;
    remove.onclick = () => save(titles.filter((entry) => entry !== title));
    row.append(label, remove);
    status.append(row);
  }
}
function currentTitle() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const header = document.querySelector('#main header') || document.querySelector('header');
      const candidates = [...(header?.querySelectorAll('span[title], [data-testid="conversation-info-header-chat-title"], span[dir="auto"]') || [])];
      return candidates.map((node) => node.getAttribute('title') || node.textContent?.trim() || '').find(Boolean) || '';
    } });
    return result;
  });
}
function addTitle(title) {
  const clean = title?.trim();
  if (!clean) return;
  chrome.storage.local.get(['observedGroupTitles'], (v) => {
    const titles = [...new Set([...(v.observedGroupTitles || []), clean])];
    save(titles);
  });
}
chrome.storage.local.get(['observedGroupTitles'], (v) => render(v.observedGroupTitles || []));
chrome.storage.local.get(['autoScanEnabled', 'autoScanSeconds'], (v) => {
  document.getElementById('autoScan').checked = Boolean(v.autoScanEnabled);
  document.getElementById('seconds').value = Math.max(10, Number(v.autoScanSeconds) || 15);
});
function renderScanStatus(statuses) {
  scanStatus.replaceChildren();
  const recent = Object.values(statuses || {}).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 12);
  if (!recent.length) scanStatus.textContent = 'No groups scanned yet.';
  for (const entry of recent) {
    const row = document.createElement('div');
    row.style.cssText = 'font-size:12px;margin:5px 0';
    row.textContent = `${entry.title}: ${entry.state}${entry.captured ? `, ${entry.captured} captured` : ''}`;
    scanStatus.append(row);
  }
}
chrome.storage.local.get(['groupScanStatus'], (v) => renderScanStatus(v.groupScanStatus));
chrome.storage.onChanged.addListener((changes) => {
  if (changes.groupScanStatus) renderScanStatus(changes.groupScanStatus.newValue);
});
document.getElementById('autoScan').onchange = (event) => chrome.storage.local.set({ autoScanEnabled: event.target.checked });
document.getElementById('seconds').onchange = (event) => chrome.storage.local.set({ autoScanSeconds: Math.max(10, Number(event.target.value) || 15) });
document.getElementById('select').onclick = async () => {
  const title = await currentTitle();
  if (!title) return message.textContent = 'Could not detect this chat. Enter its exact title below.';
  addTitle(title);
};
document.getElementById('addManual').onclick = () => {
  addTitle(document.getElementById('manual').value);
  document.getElementById('manual').value = '';
};
document.getElementById('remove').onclick = async () => {
  const title = await currentTitle();
  chrome.storage.local.get(['observedGroupTitles'], (v) => {
    const titles = (v.observedGroupTitles || []).filter((x) => x !== title);
    save(titles);
  });
};
document.getElementById('stop').onclick = () => chrome.storage.local.set({ observedGroupTitles: [], autoScanEnabled: false }, () => {
  document.getElementById('autoScan').checked = false;
  render([]);
});
