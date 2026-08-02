const status = document.getElementById('status');
const message = document.getElementById('message');
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
document.getElementById('stop').onclick = () => chrome.storage.local.remove('observedGroupTitles', () => render([]));
