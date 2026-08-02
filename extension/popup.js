const status = document.getElementById('status');
chrome.storage.local.get(['observedGroupTitle'], (v) => status.textContent = v.observedGroupTitle ? `Monitoring: ${v.observedGroupTitle}` : 'Not monitoring');
document.getElementById('select').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.querySelector('header [title]')?.getAttribute('title') || document.querySelector('header span[dir="auto"]')?.textContent?.trim() || '' });
  if (result) chrome.storage.local.set({ observedGroupTitle: result }, () => status.textContent = `Monitoring: ${result}`);
};
document.getElementById('stop').onclick = () => chrome.storage.local.remove('observedGroupTitle', () => status.textContent = 'Not monitoring');
