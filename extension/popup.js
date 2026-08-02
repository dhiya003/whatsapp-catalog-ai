const status = document.getElementById('status');
function render(titles) { status.textContent = titles.length ? `Monitoring:\n${titles.map((x) => `• ${x}`).join('\n')}` : 'Not monitoring'; }
function currentTitle() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.querySelector('header [title]')?.getAttribute('title') || document.querySelector('header span[dir="auto"]')?.textContent?.trim() || '' });
    return result;
  });
}
chrome.storage.local.get(['observedGroupTitles'], (v) => render(v.observedGroupTitles || []));
document.getElementById('select').onclick = async () => {
  const title = await currentTitle();
  if (!title) return;
  chrome.storage.local.get(['observedGroupTitles'], (v) => {
    const titles = [...new Set([...(v.observedGroupTitles || []), title])];
    chrome.storage.local.set({ observedGroupTitles: titles }, () => render(titles));
  });
};
document.getElementById('remove').onclick = async () => {
  const title = await currentTitle();
  chrome.storage.local.get(['observedGroupTitles'], (v) => {
    const titles = (v.observedGroupTitles || []).filter((x) => x !== title);
    chrome.storage.local.set({ observedGroupTitles: titles }, () => render(titles));
  });
};
document.getElementById('stop').onclick = () => chrome.storage.local.remove('observedGroupTitles', () => render([]));
