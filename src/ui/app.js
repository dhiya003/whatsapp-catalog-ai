const state = {
  items: [],
  filtered: [],
  selectedId: null,
  loading: true,
  error: '',
  filters: { query: '', status: 'all', category: 'all', view: 'cards' }
};

const els = {
  grid: document.querySelector('#catalogGrid'),
  tableWrap: document.querySelector('#catalogTableWrap'),
  table: document.querySelector('#catalogTable'),
  stateMessage: document.querySelector('#stateMessage'),
  search: document.querySelector('#searchInput'),
  status: document.querySelector('#statusFilter'),
  category: document.querySelector('#categoryFilter'),
  view: document.querySelector('#viewMode'),
  drawer: document.querySelector('#editDrawer'),
  backdrop: document.querySelector('#drawerBackdrop'),
  form: document.querySelector('#editForm'),
  closeDrawer: document.querySelector('#closeDrawer'),
  drawerImage: document.querySelector('#drawerImage'),
  drawerMeta: document.querySelector('#drawerMeta'),
  drawerTitle: document.querySelector('#drawerTitle'),
  heroCount: document.querySelector('#heroCount'),
  heroSubcopy: document.querySelector('#heroSubcopy'),
  metrics: {
    total: document.querySelector('#metricTotal'),
    pending: document.querySelector('#metricPending'),
    approved: document.querySelector('#metricApproved'),
    confidence: document.querySelector('#metricConfidence')
  }
};

const editableFields = ['title', 'price', 'description', 'status'];
const richFields = ['productCode', 'category', 'fabric', 'weave', 'feel', 'color', 'sizes', 'occasion', 'aiProvider', 'longDescription', 'bulletPoints', 'seoTitle', 'metaTitle', 'metaDescription', 'keywords', 'imageAltText', 'geoSummary'];

function esc(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function asText(value, fallback = 'Not specified') {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function shortText(value, length = 132) {
  const text = asText(value, 'No description yet.');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function confidenceValue(item) {
  const raw = Number(item.confidence);
  if (!Number.isFinite(raw)) return null;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function statusOf(item) {
  return ['pending', 'approved', 'rejected'].includes(item.status) ? item.status : 'pending';
}

function itemDescription(item) {
  return item.shortDescription || item.description || item.longDescription || '';
}

function searchableText(item) {
  return [
    item.title, item.productCode, item.sourceGroupTitle, item.category, item.fabric, item.weave,
    item.feel, item.color, item.sizes, item.occasion, item.price, item.status, item.keywords,
    item.shortDescription, item.longDescription, item.metaDescription, item.geoSummary
  ].map(value => asText(value, '')).join(' ').toLowerCase();
}

function updateStateMessage(message = '', type = 'info') {
  els.stateMessage.textContent = message;
  els.stateMessage.dataset.type = type;
  els.stateMessage.classList.toggle('active', Boolean(message));
}

function renderMetrics() {
  const total = state.items.length;
  const pending = state.items.filter(item => statusOf(item) === 'pending').length;
  const approved = state.items.filter(item => statusOf(item) === 'approved').length;
  const confidenceScores = state.items.map(confidenceValue).filter(value => value !== null);
  const avgConfidence = confidenceScores.length ? `${Math.round(confidenceScores.reduce((sum, value) => sum + value, 0) / confidenceScores.length)}%` : '–';

  els.metrics.total.textContent = total;
  els.metrics.pending.textContent = pending;
  els.metrics.approved.textContent = approved;
  els.metrics.confidence.textContent = avgConfidence;
  els.heroCount.textContent = total ? `${total} apparel ${total === 1 ? 'item' : 'items'} in review` : 'No catalog items yet';
  els.heroSubcopy.textContent = total ? `${approved} approved · ${pending} pending · ${state.items.length - approved - pending} rejected` : 'Capture items to begin reviewing';
}

function renderCategoryOptions() {
  const categories = [...new Set(state.items.map(item => asText(item.category, '')).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const current = state.filters.category;
  els.category.innerHTML = '<option value="all">All categories</option>' + categories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
  els.category.value = categories.includes(current) ? current : 'all';
  state.filters.category = els.category.value;
}

function applyFilters() {
  const query = state.filters.query.trim().toLowerCase();
  state.filtered = state.items.filter(item => {
    const matchesQuery = !query || searchableText(item).includes(query);
    const matchesStatus = state.filters.status === 'all' || statusOf(item) === state.filters.status;
    const matchesCategory = state.filters.category === 'all' || asText(item.category, '') === state.filters.category;
    return matchesQuery && matchesStatus && matchesCategory;
  });
}

function imageMarkup(item, className = '') {
  const alt = esc(item.imageAltText || item.title || 'Apparel product image');
  if (!item.imageDataUrl) return `<div class="product-media ${className}"><span>No image</span></div>`;
  return `<div class="product-media ${className}"><img src="${esc(item.imageDataUrl)}" alt="${alt}" loading="lazy"></div>`;
}

function statusBadge(item) {
  const status = statusOf(item);
  return `<span class="status-badge status-${status}">${esc(status)}</span>`;
}

function chips(item) {
  return [item.category, item.fabric, item.color, item.sizes, item.occasion]
    .map(value => asText(value, ''))
    .filter(Boolean)
    .slice(0, 5)
    .map(value => `<span class="chip">${esc(value)}</span>`)
    .join('');
}

function renderCard(item) {
  const confidence = confidenceValue(item);
  return `<article class="product-card" data-id="${esc(item.id)}">
    <div class="product-media">${item.imageDataUrl ? `<img src="${esc(item.imageDataUrl)}" alt="${esc(item.imageAltText || item.title || 'Apparel product image')}" loading="lazy">` : '<span>No image</span>'}${statusBadge(item)}</div>
    <div class="card-body">
      <div>
        <p class="eyebrow">${esc(item.productCode || item.sourceGroupTitle || 'Draft item')}</p>
        <h2 class="card-title">${esc(item.title || 'Untitled apparel item')}</h2>
        <p class="card-subtitle">${esc(shortText(itemDescription(item)))}</p>
      </div>
      <div class="chips">${chips(item)}</div>
      <div class="price-row"><span class="price">${esc(asText(item.price, 'Price pending'))}</span><span class="confidence">${confidence === null ? 'AI confidence n/a' : `${confidence}% confidence`}</span></div>
      <div class="row-actions">
        <button class="button ghost" type="button" data-open="${esc(item.id)}">Details</button>
        <button class="button success" type="button" data-status="approved" data-id="${esc(item.id)}">Approve</button>
        <button class="button danger" type="button" data-status="rejected" data-id="${esc(item.id)}">Reject</button>
      </div>
    </div>
  </article>`;
}

function renderTableRow(item) {
  const confidence = confidenceValue(item);
  return `<tr data-id="${esc(item.id)}">
    <td><strong>${esc(item.title || 'Untitled apparel item')}</strong><small>${esc(item.productCode || item.sourceGroupTitle || 'Draft item')}</small></td>
    <td>${esc(asText(item.category))}</td>
    <td>${esc(asText(item.fabric))}<small>${esc(asText(item.weave, ''))}</small></td>
    <td>${esc(asText(item.price, 'Pending'))}</td>
    <td>${statusBadge(item)}</td>
    <td>${confidence === null ? 'n/a' : `${confidence}%`}</td>
    <td><div class="row-actions"><button class="button ghost" type="button" data-open="${esc(item.id)}">Edit</button><button class="button success" type="button" data-status="approved" data-id="${esc(item.id)}">Approve</button></div></td>
  </tr>`;
}

function renderCatalog() {
  renderMetrics();
  applyFilters();
  const isTable = state.filters.view === 'table';
  els.grid.classList.toggle('hidden', isTable);
  els.tableWrap.classList.toggle('hidden', !isTable);

  if (state.loading) {
    updateStateMessage('Loading catalog items...', 'loading');
    els.grid.innerHTML = '';
    els.table.innerHTML = '';
    return;
  }

  if (state.error) {
    updateStateMessage(state.error, 'error');
    els.grid.innerHTML = '';
    els.table.innerHTML = '';
    return;
  }

  if (!state.items.length) {
    updateStateMessage('No items yet. Captured apparel drafts will appear here with image previews, AI metadata, and approval controls.', 'empty');
  } else if (!state.filtered.length) {
    updateStateMessage('No products match the current search and filters. Try clearing a filter or changing the query.', 'empty');
  } else {
    updateStateMessage('', 'info');
  }

  els.grid.innerHTML = state.filtered.map(renderCard).join('');
  els.table.innerHTML = state.filtered.map(renderTableRow).join('');
}

async function load() {
  state.loading = true;
  state.error = '';
  renderCatalog();
  try {
    const response = await fetch('/api/items');
    if (!response.ok) throw new Error(`Catalog API returned ${response.status}`);
    const data = await response.json();
    state.items = Array.isArray(data) ? data : [];
    renderCategoryOptions();
  } catch (error) {
    state.error = `Unable to load catalog items. ${error.message}`;
  } finally {
    state.loading = false;
    renderCatalog();
  }
}

function selectedItem() {
  return state.items.find(item => String(item.id) === String(state.selectedId));
}

function fillForm(item) {
  els.drawerTitle.textContent = item.title || 'Edit item';
  els.drawerImage.innerHTML = item.imageDataUrl
    ? `<img src="${esc(item.imageDataUrl)}" alt="${esc(item.imageAltText || item.title || 'Apparel product image')}">`
    : '<span>No product image available</span>';

  editableFields.forEach(field => {
    const input = els.form.elements[field];
    if (!input) return;
    input.value = field === 'description' ? itemDescription(item) : asText(field === 'status' ? statusOf(item) : item[field], '');
  });

  richFields.forEach(field => {
    const input = els.form.elements[field];
    if (input) input.value = asText(item[field], '');
  });

  els.drawerMeta.innerHTML = [
    ['Source group', item.sourceGroupTitle],
    ['Source timestamp', item.sourceTimestamp || item.timestamp],
    ['Product code', item.productCode],
    ['Confidence', confidenceValue(item) === null ? '' : `${confidenceValue(item)}%`]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<span><strong>${esc(label)}:</strong> ${esc(asText(value, ''))}</span>`).join('');
}

function openDrawer(id) {
  state.selectedId = id;
  const item = selectedItem();
  if (!item) return;
  fillForm(item);
  els.drawer.hidden = false;
  els.backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => els.form.elements.title?.focus());
}

function closeDrawer() {
  state.selectedId = null;
  els.drawer.hidden = true;
  els.backdrop.hidden = true;
  document.body.style.overflow = '';
}

async function patchItem(id, patch) {
  const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error(`Save failed with ${response.status}`);
  const updated = await response.json();
  state.items = state.items.map(item => String(item.id) === String(id) ? { ...item, ...updated } : item);
  renderCategoryOptions();
  renderCatalog();
  return updated;
}

async function updateStatus(id, status) {
  updateStateMessage(`Saving ${status} status...`, 'loading');
  try {
    await patchItem(id, { status });
    updateStateMessage(`Item ${status}.`, 'success');
    setTimeout(() => updateStateMessage('', 'info'), 1800);
    if (String(state.selectedId) === String(id)) fillForm(selectedItem());
  } catch (error) {
    updateStateMessage(error.message, 'error');
  }
}

els.search.addEventListener('input', event => {
  state.filters.query = event.target.value;
  renderCatalog();
});
els.status.addEventListener('change', event => {
  state.filters.status = event.target.value;
  renderCatalog();
});
els.category.addEventListener('change', event => {
  state.filters.category = event.target.value;
  renderCatalog();
});
els.view.addEventListener('change', event => {
  state.filters.view = event.target.value;
  renderCatalog();
});

document.addEventListener('click', event => {
  const openButton = event.target.closest('[data-open]');
  const statusButton = event.target.closest('[data-status]');
  if (openButton) openDrawer(openButton.dataset.open);
  if (statusButton) updateStatus(statusButton.dataset.id, statusButton.dataset.status);
});

els.form.addEventListener('submit', async event => {
  event.preventDefault();
  const item = selectedItem();
  if (!item) return;
  const patch = Object.fromEntries(editableFields.map(field => [field, els.form.elements[field]?.value ?? '']));
  updateStateMessage('Saving product edits...', 'loading');
  try {
    await patchItem(item.id, patch);
    closeDrawer();
    updateStateMessage('Product edits saved.', 'success');
    setTimeout(() => updateStateMessage('', 'info'), 1800);
  } catch (error) {
    updateStateMessage(error.message, 'error');
  }
});

els.form.addEventListener('click', event => {
  const action = event.target.dataset.action;
  const item = selectedItem();
  if (!action || !item) return;
  updateStatus(item.id, action === 'approve' ? 'approved' : 'rejected');
});

els.closeDrawer.addEventListener('click', closeDrawer);
els.backdrop.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.drawer.hidden) closeDrawer();
});

load();
