(() => {
  'use strict';

  const entries = Array.isArray(window.GTA_LOCATION_DATA) ? window.GTA_LOCATION_DATA : [];
  const explorer = document.getElementById('locations-explorer');
  const board = document.getElementById('location-board');
  const viewport = document.getElementById('location-viewport');
  const filters = document.getElementById('category-filters');
  const search = document.getElementById('location-search');
  const clearSearch = document.getElementById('clear-search');
  const clearFilters = document.getElementById('clear-filters');
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const selectedName = document.getElementById('detail-name');
  const description = document.getElementById('detail-description');
  const evidenceStatus = document.getElementById('detail-status');
  const source = document.getElementById('detail-source');
  const sourceLink = document.getElementById('detail-source-link');
  const saveButton = document.getElementById('save-place');
  const visitButton = document.getElementById('visit-place');
  const shareButton = document.getElementById('share-place');
  const storageNote = document.getElementById('storage-note');
  const zoomLabel = document.getElementById('zoom-level');
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const resetView = document.getElementById('reset-view');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  const filterToggle = document.getElementById('filter-toggle');
  const filterClose = document.getElementById('filter-close');
  const filterScrim = document.getElementById('filter-scrim');
  const storageKey = 'gta-sixx-location-states-v1';
  const categories = [
    { id: 'all', label: 'All named places' },
    { id: 'state', label: 'State' },
    { id: 'city', label: 'City' },
    { id: 'destination', label: 'Destinations' }
  ];
  const minZoom = 0.5;
  const maxZoom = 3;
  const pointers = new Map();
  let activeCategory = 'all';
  let selectedId = null;
  let persistentStorage = true;
  let memoryState = { saved: [], visited: [] };
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let pinch = null;
  let suppressClick = false;
  let initialFitPending = true;

  const safeState = value => ({
    saved: [...new Set(Array.isArray(value?.saved) ? value.saved.filter(id => entries.some(item => item.id === id)) : [])],
    visited: [...new Set(Array.isArray(value?.visited) ? value.visited.filter(id => entries.some(item => item.id === id)) : [])]
  });

  function readState() {
    if (!persistentStorage) return memoryState;
    try {
      const raw = window.localStorage.getItem(storageKey);
      memoryState = safeState(raw ? JSON.parse(raw) : {});
      return memoryState;
    } catch {
      persistentStorage = false;
      storageNote.textContent = 'Browser storage is unavailable. Changes will last only while this page stays open.';
      return memoryState;
    }
  }

  function writeState(next) {
    memoryState = safeState(next);
    if (!persistentStorage) return false;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(memoryState));
      return true;
    } catch {
      persistentStorage = false;
      storageNote.textContent = 'Browser storage is unavailable. Changes will last only while this page stays open.';
      return false;
    }
  }

  function stateFor(id, key) {
    return readState()[key].includes(id);
  }

  function updateState(key, id) {
    const current = readState();
    const values = current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id];
    const saved = writeState({ ...current, [key]: values });
    render();
    renderDetail();
    const action = key === 'saved' ? (values.includes(id) ? 'Place saved.' : 'Place removed from saved.') : (values.includes(id) ? 'Marked as visited.' : 'Visit mark removed.');
    storageNote.textContent = `${action}${saved ? '' : ' This change is temporary in this tab.'}`;
  }

  function selectedEntry() {
    return entries.find(entry => entry.id === selectedId) || null;
  }

  function visibleEntries() {
    const query = search.value.trim().toLocaleLowerCase();
    return entries.filter(entry => {
      const categoryMatch = activeCategory === 'all' || entry.type === activeCategory;
      const queryMatch = !query || `${entry.name} ${entry.typeLabel} ${entry.description}`.toLocaleLowerCase().includes(query);
      return categoryMatch && queryMatch;
    });
  }

  function updatePlaceUrl(id) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('place', id);
    else url.searchParams.delete('place');
    window.history.replaceState({}, '', url);
  }

  function renderCategories() {
    const available = new Map(categories.map(item => [item.id, item.id === 'all' ? entries.length : entries.filter(entry => entry.type === item.id).length]));
    filters.replaceChildren(...categories.map(category => {
      const label = document.createElement('label');
      label.className = 'lx-filter-option';
      const name = document.createElement('span');
      name.className = 'lx-filter-name';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'location-category';
      input.value = category.id;
      input.checked = category.id === activeCategory;
      input.setAttribute('aria-label', category.label);
      input.addEventListener('change', () => {
        activeCategory = category.id;
        render();
        if (window.matchMedia('(max-width: 700px)').matches) closeFilters();
      });
      name.append(input, document.createTextNode(category.label));
      const count = document.createElement('span');
      count.className = 'lx-filter-count';
      count.textContent = String(available.get(category.id));
      label.append(name, count);
      return label;
    }));
  }

  function makePlaceCard(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lx-place-card';
    button.dataset.id = entry.id;
    button.setAttribute('aria-pressed', String(entry.id === selectedId));
    const symbol = document.createElement('span');
    symbol.className = 'lx-card-symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = '•';
    const copy = document.createElement('span');
    copy.className = 'lx-card-copy';
    const name = document.createElement('span');
    name.className = 'lx-card-name';
    name.textContent = entry.name;
    const type = document.createElement('span');
    type.className = 'lx-card-type';
    type.textContent = entry.typeLabel;
    const evidence = document.createElement('span');
    evidence.className = 'lx-card-evidence';
    evidence.textContent = 'OFFICIALLY NAMED · POSITION UNVERIFIED';
    copy.append(name, type, evidence);
    const state = document.createElement('span');
    state.className = 'lx-card-state';
    const stateParts = [];
    if (stateFor(entry.id, 'saved')) stateParts.push('Saved');
    if (stateFor(entry.id, 'visited')) stateParts.push('Visited');
    state.textContent = stateParts.join(' · ');
    button.append(symbol, copy, state);
    button.addEventListener('click', () => selectLocation(entry.id));
    return button;
  }

  function renderBoard(visible) {
    const intro = document.createElement('div');
    intro.className = 'lx-board-intro';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'lx-board-eyebrow';
    eyebrow.textContent = 'Official setting · name relationships only';
    const note = document.createElement('p');
    note.className = 'lx-board-note';
    note.textContent = 'Groups reflect how the setting is named. Connectors imply no route, order, distance or location.';
    intro.append(eyebrow, note);

    const group = (kind, title, subtitle, places, className) => {
      const section = document.createElement('section');
      section.className = `lx-atlas-branch ${className}`;
      section.setAttribute('aria-label', `${title}: ${places.length} places`);
      const head = document.createElement('div');
      head.className = 'lx-branch-head';
      const copy = document.createElement('div');
      const label = document.createElement('p');
      label.className = 'lx-branch-kicker';
      label.textContent = kind;
      const heading = document.createElement('h3');
      heading.textContent = title;
      copy.append(label, heading);
      const count = document.createElement('span');
      count.className = 'lx-branch-count';
      count.textContent = String(places.length).padStart(2, '0');
      head.append(copy, count);
      const note = document.createElement('p');
      note.className = 'lx-branch-subtitle';
      note.textContent = subtitle;
      const cards = document.createElement('div');
      cards.className = 'lx-branch-places';
      cards.append(...places.map(makePlaceCard));
      section.append(head, note, cards);
      return section;
    };

    const state = visible.filter(entry => entry.type === 'state');
    const city = visible.filter(entry => entry.type === 'city');
    const destinations = visible.filter(entry => entry.type === 'destination');
    const root = group('WIDER SETTING', 'Leonida', 'The officially named state setting.', state, 'lx-atlas-root');
    const cityGroup = group('NAMED CITY', 'Vice City', 'Shown as part of the Leonida setting.', city, 'lx-atlas-city');
    const destinationsGroup = group('NAMED DESTINATIONS', 'Across the setting', 'Names recorded in official GTA VI material.', destinations, 'lx-atlas-destinations');
    const branches = document.createElement('div');
    branches.className = 'lx-atlas-branches';
    branches.append(cityGroup, destinationsGroup);
    board.replaceChildren(intro, root, branches);
  }

  function renderDetail() {
    const entry = selectedEntry();
    const enabled = Boolean(entry);
    saveButton.disabled = !enabled;
    visitButton.disabled = !enabled;
    shareButton.disabled = !enabled;
    if (!entry) {
      selectedName.textContent = 'Choose a place';
      description.textContent = 'Select a place to read what official material confirms—and what remains unverified.';
      evidenceStatus.textContent = 'Official name';
      source.textContent = 'Select a place to see its evidence source.';
      sourceLink.hidden = true;
      saveButton.textContent = 'Save place';
      visitButton.textContent = 'Mark visited';
      shareButton.textContent = 'Copy place link';
      return;
    }
    selectedName.textContent = entry.name;
    description.textContent = entry.description;
    evidenceStatus.textContent = entry.status;
    source.textContent = `${entry.source}. The source confirms the name; it does not establish a map position.`;
    sourceLink.href = entry.sourceUrl;
    sourceLink.hidden = !entry.sourceUrl;
    saveButton.textContent = stateFor(entry.id, 'saved') ? 'Remove saved' : 'Save place';
    visitButton.textContent = stateFor(entry.id, 'visited') ? 'Remove visit mark' : 'Mark visited';
    shareButton.textContent = 'Copy place link';
  }

  function updateView() {
    board.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomLabel.value = `${Math.round(zoom * 100)}%`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= minZoom + 0.001;
    zoomIn.disabled = zoom >= maxZoom - 0.001;
  }

  function clampPan() {
    const view = viewport.getBoundingClientRect();
    const width = board.offsetWidth * zoom;
    const height = board.offsetHeight * zoom;
    const minX = Math.min(0, view.width - width);
    const minY = Math.min(0, view.height - height);
    panX = Math.max(minX, Math.min(Math.max(0, view.width - width), panX));
    panY = Math.max(minY, Math.min(Math.max(0, view.height - height), panY));
  }

  function setZoom(next, anchorX, anchorY) {
    const rect = viewport.getBoundingClientRect();
    const x = Number.isFinite(anchorX) ? anchorX - rect.left : rect.width / 2;
    const y = Number.isFinite(anchorY) ? anchorY - rect.top : rect.height / 2;
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, next));
    const contentX = (x - panX) / zoom;
    const contentY = (y - panY) / zoom;
    panX = x - contentX * nextZoom;
    panY = y - contentY * nextZoom;
    zoom = nextZoom;
    clampPan();
    updateView();
  }

  function fitView() {
    const view = viewport.getBoundingClientRect();
    const width = Math.max(board.offsetWidth, 1);
    const height = Math.max(board.offsetHeight, 1);
    zoom = Math.max(minZoom, Math.min(1, view.width / width, view.height / height));
    panX = Math.max(0, (view.width - width * zoom) / 2);
    panY = Math.max(0, (view.height - height * zoom) / 2);
    clampPan();
    updateView();
  }

  function render() {
    const visible = visibleEntries();
    const state = readState();
    resultCount.textContent = `${visible.length} of ${entries.length} places · ${state.saved.length} saved · ${state.visited.length} visited`;
    renderBoard(visible);
    emptyState.hidden = visible.length !== 0;
    clearSearch.hidden = search.value.length === 0;
    if (selectedId && !visible.some(entry => entry.id === selectedId)) {
      selectedId = null;
      updatePlaceUrl(null);
      renderDetail();
    }
    if (selectedId) {
      const selectedButton = board.querySelector(`[data-id="${CSS.escape(selectedId)}"]`);
      if (selectedButton) selectedButton.setAttribute('aria-pressed', 'true');
    }
    requestAnimationFrame(() => {
      if (initialFitPending) {
        initialFitPending = false;
        fitView();
      } else {
        clampPan();
        updateView();
      }
    });
  }

  function selectLocation(id) {
    selectedId = id;
    updatePlaceUrl(id);
    render();
    renderDetail();
    if (window.matchMedia('(max-width: 700px)').matches) {
      document.getElementById('location-detail').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  function filterOpen() {
    return window.matchMedia('(max-width: 700px)').matches ? explorer.classList.contains('filters-open') : !explorer.classList.contains('filters-collapsed');
  }

  function setMobileDrawerSemantics(open) {
    const panel = document.getElementById('location-filters');
    if (open && window.matchMedia('(max-width: 700px)').matches) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'filter-drawer-title');
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      panel.removeAttribute('aria-labelledby');
    }
  }

  function updateFilterControls() {
    const open = filterOpen();
    setMobileDrawerSemantics(open);
    filterToggle.setAttribute('aria-expanded', String(open));
    filterToggle.textContent = open ? 'Hide filters' : 'Filters';
    filterScrim.hidden = !(open && window.matchMedia('(max-width: 700px)').matches);
  }

  function closeFilters(returnFocus = true) {
    explorer.classList.remove('filters-open');
    explorer.classList.remove('filters-collapsed');
    updateFilterControls();
    if (returnFocus) filterToggle.focus();
  }

  filterToggle.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 700px)').matches) {
      explorer.classList.toggle('filters-open');
      updateFilterControls();
      if (explorer.classList.contains('filters-open')) search.focus();
    } else {
      explorer.classList.toggle('filters-collapsed');
      updateFilterControls();
    }
  });
  filterClose.addEventListener('click', () => closeFilters());
  filterScrim.addEventListener('click', () => closeFilters());
  document.getElementById('location-filters').addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !window.matchMedia('(max-width: 700px)').matches || !explorer.classList.contains('filters-open')) return;
    const focusable = [...document.getElementById('location-filters').querySelectorAll('button:not([disabled]), input:not([disabled])')].filter(element => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !document.getElementById('location-filters').contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  window.matchMedia('(max-width: 700px)').addEventListener('change', () => {
    explorer.classList.remove('filters-open', 'filters-collapsed');
    updateFilterControls();
  });

  search.addEventListener('input', render);
  clearSearch.addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  clearFilters.addEventListener('click', () => {
    search.value = '';
    activeCategory = 'all';
    selectedId = null;
    updatePlaceUrl(null);
    renderCategories();
    render();
    search.focus();
  });
  saveButton.addEventListener('click', () => { if (selectedId) updateState('saved', selectedId); });
  visitButton.addEventListener('click', () => { if (selectedId) updateState('visited', selectedId); });
  shareButton.addEventListener('click', async () => {
    const entry = selectedEntry();
    if (!entry) return;
    const url = new URL(window.location.href);
    url.searchParams.set('place', entry.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      storageNote.textContent = `Share link copied for ${entry.name}.`;
    } catch {
      const shareInput = document.getElementById('share-url');
      shareInput.hidden = false;
      shareInput.value = url.toString();
      shareInput.focus();
      shareInput.select();
      storageNote.textContent = 'Clipboard access is unavailable. The share link is selected above so you can copy it.';
    }
  });
  window.addEventListener('popstate', () => {
    const requested = new URL(window.location.href).searchParams.get('place');
    selectedId = entries.some(entry => entry.id === requested) ? requested : null;
    render();
    renderDetail();
  });

  zoomIn.addEventListener('click', () => setZoom(zoom * 1.25));
  zoomOut.addEventListener('click', () => setZoom(zoom / 1.25));
  resetView.addEventListener('click', fitView);
  function syncFullscreenButton() {
    const active = document.fullscreenElement === document.querySelector('.lx-viewer');
    fullscreenToggle.textContent = active ? '⤢' : '⛶';
    fullscreenToggle.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreenToggle.title = active ? 'Exit fullscreen' : 'Fullscreen';
    fullscreenToggle.setAttribute('aria-pressed', String(active));
  }
  fullscreenToggle.addEventListener('click', async () => {
    const viewer = document.querySelector('.lx-viewer');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (viewer.requestFullscreen) await viewer.requestFullscreen();
      else storageNote.textContent = 'Fullscreen is unavailable in this browser.';
    } catch {
      storageNote.textContent = 'Fullscreen could not be opened. Try the browser’s full-screen control.';
    }
  });
  document.addEventListener('fullscreenchange', () => { syncFullscreenButton(); requestAnimationFrame(() => { clampPan(); updateView(); }); });
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
  }, { passive: false });

  viewport.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, target: event.target });
    if (pointers.size === 2) {
      drag = null;
      viewport.classList.add('is-dragging');
      const [first, second] = [...pointers.values()];
      const rect = viewport.getBoundingClientRect();
      pinch = {
        distance: Math.hypot(first.x - second.x, first.y - second.y),
        zoom,
        panX,
        panY,
        centerX: ((first.x + second.x) / 2) - rect.left,
        centerY: ((first.y + second.y) / 2) - rect.top
      };
      return;
    }
    const interactive = event.target.closest('button,input,a');
    if (pointers.size === 1 && !interactive && (event.pointerType === 'touch' || event.button === 0)) {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY, moved: false };
      viewport.classList.add('is-dragging');
    }
  });

  window.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { ...pointers.get(event.pointerId), x: event.clientX, y: event.clientY });
    if (pinch && pointers.size >= 2) {
      const [first, second] = [...pointers.values()];
      const rect = viewport.getBoundingClientRect();
      const centerX = (first.x + second.x) / 2 - rect.left;
      const centerY = (first.y + second.y) / 2 - rect.top;
      const ratio = Math.hypot(first.x - second.x, first.y - second.y) / Math.max(pinch.distance, 1);
      const nextZoom = Math.max(minZoom, Math.min(maxZoom, pinch.zoom * ratio));
      const worldX = (pinch.centerX - pinch.panX) / pinch.zoom;
      const worldY = (pinch.centerY - pinch.panY) / pinch.zoom;
      zoom = nextZoom;
      panX = centerX - worldX * zoom;
      panY = centerY - worldY * zoom;
      clampPan();
      updateView();
    } else if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 4;
      panX = drag.panX + dx;
      panY = drag.panY + dy;
      clampPan();
      updateView();
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pinch) {
      pinch = null;
      drag = null;
    } else if (drag && drag.id === event.pointerId) {
      if (drag.moved) {
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 0);
      }
      drag = null;
    }
    if (!pointers.size) viewport.classList.remove('is-dragging');
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
  }, true);

  viewport.addEventListener('keydown', event => {
    const step = 36;
    if (event.key === 'ArrowLeft') panX += step;
    else if (event.key === 'ArrowRight') panX -= step;
    else if (event.key === 'ArrowUp') panY += step;
    else if (event.key === 'ArrowDown') panY -= step;
    else if (event.key === '+' || event.key === '=') setZoom(zoom * 1.2);
    else if (event.key === '-' || event.key === '_') setZoom(zoom / 1.2);
    else if (event.key === 'Home') fitView();
    else return;
    event.preventDefault();
    clampPan();
    updateView();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && explorer.classList.contains('filters-open')) closeFilters();
  });

  if (!entries.length) {
    resultCount.textContent = 'Place data could not be loaded.';
    emptyState.hidden = false;
    emptyState.textContent = 'The place list is unavailable. Reload the page to try again.';
    return;
  }
  const requested = new URL(window.location.href).searchParams.get('place');
  selectedId = entries.some(entry => entry.id === requested) ? requested : null;
  renderCategories();
  render();
  renderDetail();
  updateFilterControls();
  syncFullscreenButton();
  window.addEventListener('resize', () => { clampPan(); updateView(); }, { passive: true });
})();
