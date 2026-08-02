const status = document.getElementById('status');
function render(titles) { status.textContent = titles.length ? `Monitoring:\n${titles.map((x) => `• ${x}`).join('\n')}` : 'Not monitoring'; }
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
    chrome.storage.local.set({ observedGroupTitles: titles }, () => render(titles));
  });
}
chrome.storage.local.get(['observedGroupTitles'], (v) => render(v.observedGroupTitles || []));
document.getElementById('select').onclick = async () => {
  const title = await currentTitle();
  if (!title) return status.textContent = 'Could not detect this chat. Enter its exact title below.';
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
    chrome.storage.local.set({ observedGroupTitles: titles }, () => render(titles));
  });
};
document.getElementById('stop').onclick = () => chrome.storage.local.remove('observedGroupTitles', () => render([]));
