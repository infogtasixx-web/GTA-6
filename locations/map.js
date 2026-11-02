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
  const clearProgressButton = document.getElementById('clear-progress');
  const storageNote = document.getElementById('storage-note');
  const zoomLabel = document.getElementById('zoom-level');
  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const resetView = document.getElementById('reset-view');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  const hideAllButton = document.getElementById('hide-all');
  const hideFoundToggle = document.getElementById('hide-found');
  const filterToggle = document.getElementById('filter-toggle');
  const filterClose = document.getElementById('filter-close');
  const filterScrim = document.getElementById('filter-scrim');
  const placeList = document.getElementById('location-place-list');
  const storageKey = 'gta-sixx-location-states-v1';
  const categoryGroups = [
    { id: 'setting', label: 'Setting', items: [
      { id: 'state', label: 'State', code: 'ST' },
      { id: 'named-destinations', label: 'Named destinations', code: 'ND' }
    ] },
    { id: 'shops', label: 'Shops', items: [
      { id: 'ammu-nation', label: 'Ammu-Nation', code: 'AN' },
      { id: 'banks', label: 'Banks', code: 'BK' },
      { id: 'clothing', label: 'Clothing stores', code: 'CL' },
      { id: 'convenience-stores', label: 'Convenience stores', code: 'CS' },
      { id: 'food-drink', label: 'Food & drink', code: 'FD' },
      { id: 'gas-stations', label: 'Gas stations', code: 'GS' },
      { id: 'barbers', label: 'Haircuts & barbers', code: 'HB' },
      { id: 'jewelry', label: 'Jewelry stores', code: 'JW' },
      { id: 'phone-stores', label: 'Phone stores', code: 'PH' },
      { id: 'tattoo-shops', label: 'Tattoo shops', code: 'TT' },
      { id: 'vehicle-dealers', label: 'Vehicle dealers', code: 'VD' },
      { id: 'vehicle-mods', label: 'Vehicle mod shops', code: 'VM' }
    ] },
    { id: 'properties', label: 'Properties', items: [
      { id: 'garages', label: 'Garages', code: 'GR' },
      { id: 'marinas', label: 'Marinas', code: 'MR' },
      { id: 'safehouses', label: 'Safehouses', code: 'SH' }
    ] },
    { id: 'activities', label: 'Activities', items: [
      { id: 'gang-compounds', label: 'Gang compounds', code: 'GC' },
      { id: 'golf', label: 'Golf', code: 'GF' },
      { id: 'verified-activities', label: 'Other verified activities', code: 'AC' }
    ] },
    { id: 'local-places', label: 'Local places', items: [
      { id: 'bars', label: 'Bars', code: 'BR' },
      { id: 'cities-towns', label: 'Cities & towns', code: 'CT' },
      { id: 'fire-stations', label: 'Fire stations', code: 'FS' },
      { id: 'landmarks', label: 'Landmarks', code: 'LM' },
      { id: 'nightclubs', label: 'Nightclubs', code: 'NC' },
      { id: 'police-stations', label: 'Police stations', code: 'PS' },
      { id: 'public-transport', label: 'Public transport', code: 'PT' },
      { id: 'other-places', label: 'Other verified places', code: 'OP' }
    ] }
  ];
  const categories = categoryGroups.flatMap(group => group.items);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let mapSize = { width: 1400, height: 800 };
  const minZoom = 1;
  const maxZoom = 3;
  const pointers = new Map();
  let selectedId = null;
  let activeCategories = new Set(categories.map(category => category.id));
  let hideFound = false;
  let persistentStorage = true;
  let memoryState = { saved: [], visited: [] };
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let pinch = null;
  let suppressClick = false;
  let activeLayoutKey = '';

  // This is an editorial diagram layout only. These values are not in-world coordinates.
  let diagramPositions = {
    leonida: [700, 400],
    'vice-city': [265, 235],
    'leonida-keys': [490, 150],
    'port-gellhorn': [1085, 205],
    ambrosia: [1130, 485],
    grassrivers: [445, 650],
    'mount-kalaga': [900, 650]
  };
  const wideLayout = {
    size: { width: 1400, height: 800 },
    center: [700, 400],
    positions: diagramPositions
  };
  const compactLayout = {
    size: { width: 800, height: 1000 },
    center: [400, 500],
    positions: {
      leonida: [400, 500],
      'vice-city': [195, 220],
      'leonida-keys': [605, 220],
      'port-gellhorn': [195, 405],
      ambrosia: [605, 405],
      grassrivers: [195, 790],
      'mount-kalaga': [605, 790]
    }
  };

  function applyResponsiveLayout() {
    const compact = viewport.clientWidth / Math.max(viewport.clientHeight, 1) < 1.2;
    const layoutKey = compact ? 'compact' : 'wide';
    if (activeLayoutKey && activeLayoutKey !== layoutKey) {
      zoom = 1;
      panX = 0;
      panY = 0;
    }
    activeLayoutKey = layoutKey;
    const layout = compact ? compactLayout : wideLayout;
    mapSize = layout.size;
    diagramPositions = layout.positions;
    return layout.center;
  }

  function safeState(value) {
    return {
      saved: [...new Set(Array.isArray(value?.saved) ? value.saved.filter(id => entries.some(item => item.id === id)) : [])],
      visited: [...new Set(Array.isArray(value?.visited) ? value.visited.filter(id => entries.some(item => item.id === id)) : [])]
    };
  }

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

  function selectedEntry() {
    return entries.find(entry => entry.id === selectedId) || null;
  }

  function updatePlaceUrl(id) {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('place', id);
      url.searchParams.set('zoom', zoom.toFixed(2));
    } else {
      url.searchParams.delete('place');
      url.searchParams.delete('zoom');
    }
    window.history.replaceState({}, '', url);
  }

  function visibleEntries() {
    const query = search.value.trim().toLocaleLowerCase();
    const state = readState();
    return entries.filter(entry => {
      const categoryMatch = activeCategories.has(entry.categoryId);
      const queryMatch = !query || `${entry.name} ${entry.typeLabel} ${entry.description}`.toLocaleLowerCase().includes(query);
      const foundMatch = !hideFound || !state.visited.includes(entry.id);
      return categoryMatch && queryMatch && foundMatch;
    });
  }

  function renderCategories() {
    const state = readState();
    const previousOpen = new Set([...filters.querySelectorAll('.lx-category-group[open]')].map(group => group.dataset.group));
    filters.replaceChildren(...categoryGroups.map(group => {
      const disclosure = document.createElement('details');
      disclosure.className = 'lx-category-group';
      disclosure.dataset.group = group.id;
      disclosure.open = previousOpen.size ? previousOpen.has(group.id) : group.id === 'setting' || group.id === 'local-places';
      const heading = document.createElement('summary');
      heading.className = 'lx-category-heading';
      const groupTotal = group.items.reduce((sum, category) => sum + entries.filter(entry => entry.categoryId === category.id).length, 0);
      const groupFound = group.items.reduce((sum, category) => sum + entries.filter(entry => entry.categoryId === category.id && state.visited.includes(entry.id)).length, 0);
      const groupName = document.createElement('span');
      groupName.textContent = group.label;
      const groupCount = document.createElement('span');
      groupCount.className = 'lx-group-count';
      groupCount.textContent = `${groupFound}/${groupTotal}`;
      heading.append(groupName, groupCount);
      const list = document.createElement('div');
      list.className = 'lx-category-items';
      group.items.forEach(category => {
        const matching = entries.filter(entry => entry.categoryId === category.id);
        const found = matching.filter(entry => state.visited.includes(entry.id)).length;
        const label = document.createElement('label');
        label.className = 'lx-filter-option';
        const name = document.createElement('span');
        name.className = 'lx-filter-name';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'location-category';
        input.value = category.id;
        input.checked = activeCategories.has(category.id);
        input.setAttribute('aria-label', `${category.label}: ${matching.length} listed, ${found} found`);
        input.addEventListener('change', () => {
          if (input.checked) activeCategories.add(category.id);
          else activeCategories.delete(category.id);
          render();
          if (window.matchMedia('(max-width: 700px)').matches) closeFilters();
        });
        const icon = document.createElement('span');
        icon.className = 'lx-filter-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = category.code;
        const text = document.createElement('span');
        text.textContent = category.label;
        name.append(input, icon, text);
        const count = document.createElement('span');
        count.className = 'lx-filter-count';
        count.textContent = `${found}/${matching.length}`;
        label.append(name, count);
        list.append(label);
      });
      disclosure.append(heading, list);
      return disclosure;
    }));
  }

  function svgElement(name, attrs = {}, text = '') {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text) element.textContent = text;
    return element;
  }

  function addNode(svgLayer, entry) {
    const [x, y] = diagramPositions[entry.id] || [700, 400];
    const node = svgElement('g', {
      class: 'lx-diagram-node',
      transform: `translate(${x} ${y})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${entry.name}. ${entry.typeLabel}. Officially named. Diagram position only.`,
      'aria-pressed': String(entry.id === selectedId),
      'data-map-node': entry.id
    });
    const rect = svgElement('rect', { x: -135, y: -43, width: 270, height: 86, rx: 14, class: 'lx-node-surface' });
    const index = svgElement('circle', { cx: -103, cy: 0, r: 17, class: 'lx-node-index' });
    const indexText = svgElement('text', { x: -103, y: 4, class: 'lx-node-number', 'text-anchor': 'middle' }, String(entries.indexOf(entry) + 1).padStart(2, '0'));
    const type = svgElement('text', { x: -73, y: -10, class: 'lx-node-type' }, entry.typeLabel.toUpperCase());
    const nameSize = entry.name.length > 22 ? 14 : entry.name.length > 15 ? 16 : 19;
    const name = svgElement('text', { x: -73, y: 17, class: 'lx-node-name', 'font-size': nameSize }, entry.name);
    const marker = svgElement('circle', { cx: 112, cy: -23, r: 5, class: 'lx-node-status' });
    node.append(rect, index, indexText, type, name, marker);
    const select = () => selectLocation(entry.id);
    node.addEventListener('click', select);
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
    svgLayer.append(node);
  }

  function makeDiagram(visible) {
    const center = applyResponsiveLayout();
    const svg = svgElement('svg', {
      id: 'setting-diagram',
      class: 'lx-diagram',
      viewBox: `0 0 ${mapSize.width} ${mapSize.height}`,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'group',
      'aria-labelledby': 'diagram-title diagram-description'
    });
    svg.append(
      svgElement('title', { id: 'diagram-title' }, 'GTA VI setting relationship index'),
      svgElement('desc', { id: 'diagram-description' }, 'A zoomable vector diagram with Leonida at the center and six officially named settings around it. The node positions are diagram layout only and do not show geography.')
    );

    const defs = svgElement('defs');
    const glow = svgElement('radialGradient', { id: 'diagram-glow' });
    glow.append(svgElement('stop', { offset: '0%', 'stop-color': '#ff4f94', 'stop-opacity': '.16' }), svgElement('stop', { offset: '100%', 'stop-color': '#ff4f94', 'stop-opacity': '0' }));
    const grid = svgElement('pattern', { id: 'diagram-grid', width: 44, height: 44, patternUnits: 'userSpaceOnUse' });
    grid.append(svgElement('path', { d: 'M44 0H0V44', fill: 'none', stroke: '#a2dde0', 'stroke-opacity': '.09', 'stroke-width': 1 }));
    defs.append(glow, grid);
    svg.append(defs);

    const layer = svgElement('g', { id: 'diagram-layer' });
    layer.append(svgElement('rect', { width: mapSize.width, height: mapSize.height, fill: '#091417' }));
    layer.append(svgElement('rect', { width: mapSize.width, height: mapSize.height, fill: 'url(#diagram-grid)' }));
    layer.append(svgElement('ellipse', { cx: center[0], cy: center[1], rx: mapSize.width * .35, ry: mapSize.height * .34, fill: 'url(#diagram-glow)' }));
    [130, 198, 275].forEach((radius, index) => layer.append(svgElement('circle', {
      cx: center[0], cy: center[1], r: radius, class: 'lx-diagram-ring', 'stroke-dasharray': index ? '2 11' : 'none'
    })));

    const lineGroup = svgElement('g', { class: 'lx-diagram-links', 'aria-hidden': 'true' });
    visible.filter(entry => entry.id !== 'leonida').forEach(entry => {
      const [x, y] = diagramPositions[entry.id];
      lineGroup.append(svgElement('path', { d: `M${center[0]} ${center[1]} Q${(center[0] + x) / 2} ${(center[1] + y) / 2 - 18} ${x} ${y}`, class: 'lx-diagram-link' }));
    });
    layer.append(lineGroup);

    const eyebrow = svgElement('text', { x: 54, y: 58, class: 'lx-diagram-overline' }, 'OFFICIAL PLACE NAMES / RELATIONSHIP INDEX');
    const note = svgElement('text', { x: 54, y: 82, class: 'lx-diagram-caption' }, 'Node arrangement is editorial only · no verified coordinates shown');
    layer.append(eyebrow, note);

    if (visible.length) {
      const diagramEntries = visible.some(entry => entry.id === 'leonida') ? visible : [...visible, entries.find(entry => entry.id === 'leonida')].filter(Boolean);
      diagramEntries.forEach(entry => addNode(layer, entry));
    }
    else {
      layer.append(svgElement('text', { x: center[0], y: center[1] - 10, class: 'lx-diagram-empty', 'text-anchor': 'middle' }, 'No matching place names'));
      layer.append(svgElement('text', { x: center[0], y: center[1] + 22, class: 'lx-diagram-caption', 'text-anchor': 'middle' }, 'Clear a filter or search for another name.'));
    }
    svg.append(layer);
    return svg;
  }

  function updateView() {
    const layer = board.querySelector('#diagram-layer');
    if (layer) layer.setAttribute('transform', `translate(${panX} ${panY}) scale(${zoom})`);
    zoomLabel.value = `${Math.round(zoom * 100)}%`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoom <= minZoom + 0.001;
    zoomIn.disabled = zoom >= maxZoom - 0.001;
  }

  function clampPan() {
    panX = Math.max(mapSize.width * (1 - zoom), Math.min(0, panX));
    panY = Math.max(mapSize.height * (1 - zoom), Math.min(0, panY));
  }

  function screenPoint(clientX, clientY) {
    const svg = board.querySelector('#setting-diagram');
    if (!svg) return { x: mapSize.width / 2, y: mapSize.height / 2 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: mapSize.width / 2, y: mapSize.height / 2 };
  }

  function setZoom(next, clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const anchor = Number.isFinite(clientX) ? screenPoint(clientX, clientY) : screenPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, next));
    const worldX = (anchor.x - panX) / zoom;
    const worldY = (anchor.y - panY) / zoom;
    panX = anchor.x - worldX * nextZoom;
    panY = anchor.y - worldY * nextZoom;
    zoom = nextZoom;
    clampPan();
    updateView();
    if (selectedId) updatePlaceUrl(selectedId);
  }

  function fitView() {
    zoom = 1;
    panX = 0;
    panY = 0;
    updateView();
  }

  function updateDetail() {
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
    source.textContent = `${entry.source}. This confirms the name, not a geographic position.`;
    sourceLink.href = entry.sourceUrl;
    sourceLink.hidden = !entry.sourceUrl;
    saveButton.textContent = stateFor(entry.id, 'saved') ? 'Remove saved' : 'Save place';
    visitButton.textContent = stateFor(entry.id, 'visited') ? 'Remove found mark' : 'Mark found';
    shareButton.textContent = 'Copy place link';
  }

  function render() {
    const visible = visibleEntries();
    const state = readState();
    resultCount.textContent = `${visible.length} of ${entries.length} source-checked names · ${state.visited.length} found · ${state.saved.length} saved`;
    board.replaceChildren(makeDiagram(visible));
    const visibleIds = new Set(visible.map(entry => entry.id));
    placeList.querySelectorAll('[data-id]').forEach(card => { card.hidden = !visibleIds.has(card.dataset.id); });
    emptyState.hidden = visible.length !== 0;
    emptyState.textContent = 'No source-checked places match this search and category selection. Turn categories back on or clear your search.';
    clearSearch.hidden = search.value.length === 0;
    if (selectedId && !visibleIds.has(selectedId)) {
      selectedId = null;
      updatePlaceUrl(null);
      updateDetail();
    }
    placeList.querySelectorAll('[data-select-place]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.selectPlace === selectedId));
    });
    updateView();
  }

  function focusLocation(id, targetZoom = 1.65) {
    const [x, y] = diagramPositions[id] || [mapSize.width / 2, mapSize.height / 2];
    const rect = viewport.getBoundingClientRect();
    const center = screenPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    zoom = Math.max(minZoom, Math.min(maxZoom, Number(targetZoom) || 1.65));
    panX = center.x - x * zoom;
    panY = center.y - y * zoom;
    clampPan();
    updateView();
  }

  function selectLocation(id) {
    if (!entries.some(entry => entry.id === id)) return;
    selectedId = id;
    render();
    focusLocation(id);
    updatePlaceUrl(id);
    updateDetail();
    if (window.matchMedia('(max-width: 700px)').matches) {
      document.getElementById('location-detail').scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest'
      });
    }
  }

  function updateState(key, id) {
    const current = readState();
    const values = current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id];
    const saved = writeState({ ...current, [key]: values });
    renderCategories();
    render();
    updateDetail();
    const action = key === 'saved' ? (values.includes(id) ? 'Place saved.' : 'Place removed from saved.') : (values.includes(id) ? 'Place marked found.' : 'Found mark removed.');
    storageNote.textContent = `${action}${saved ? '' : ' This change is temporary in this tab.'}`;
  }

  function filterOpen() {
    return window.matchMedia('(max-width: 700px)').matches ? explorer.classList.contains('filters-open') : !explorer.classList.contains('filters-collapsed');
  }

  function updateFilterControls() {
    const open = filterOpen();
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
    filterToggle.setAttribute('aria-expanded', String(open));
    filterToggle.textContent = open ? 'Hide filters' : 'Filters';
    filterScrim.hidden = !(open && window.matchMedia('(max-width: 700px)').matches);
  }

  function closeFilters(returnFocus = true) {
    explorer.classList.remove('filters-open', 'filters-collapsed');
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
    if (event.key === 'Escape' && window.matchMedia('(max-width: 700px)').matches) {
      closeFilters();
      return;
    }
    if (event.key !== 'Tab' || !window.matchMedia('(max-width: 700px)').matches || !explorer.classList.contains('filters-open')) return;
    const focusable = [...document.getElementById('location-filters').querySelectorAll('button:not([disabled]), input:not([disabled]), summary, a[href]')].filter(element => element.getClientRects().length);
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
  hideAllButton.addEventListener('click', () => {
    activeCategories.clear();
    renderCategories();
    render();
  });
  hideFoundToggle.addEventListener('change', () => {
    hideFound = hideFoundToggle.checked;
    render();
  });
  clearFilters.addEventListener('click', () => {
    search.value = '';
    activeCategories = new Set(categories.map(category => category.id));
    hideFound = false;
    hideFoundToggle.checked = false;
    selectedId = null;
    updatePlaceUrl(null);
    renderCategories();
    render();
    updateDetail();
    search.focus();
  });
  placeList.addEventListener('click', event => {
    const button = event.target.closest('[data-select-place]');
    if (button) selectLocation(button.dataset.selectPlace);
  });
  saveButton.addEventListener('click', () => { if (selectedId) updateState('saved', selectedId); });
  visitButton.addEventListener('click', () => { if (selectedId) updateState('visited', selectedId); });
  clearProgressButton.addEventListener('click', () => {
    const current = readState();
    if (!current.saved.length && !current.visited.length) {
      storageNote.textContent = 'There is no saved or found progress to clear.';
      return;
    }
    if (!window.confirm('Clear every saved place and found mark stored in this browser? This cannot be undone.')) return;
    const saved = writeState({ saved: [], visited: [] });
    renderCategories();
    render();
    updateDetail();
    storageNote.textContent = saved ? 'Saved places and found marks were cleared from this browser.' : 'Progress was cleared for this tab only because browser storage is unavailable.';
  });
  shareButton.addEventListener('click', async () => {
    const entry = selectedEntry();
    if (!entry) return;
    const url = new URL(window.location.href);
    url.searchParams.set('place', entry.id);
    url.searchParams.set('zoom', zoom.toFixed(2));
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
    if (selectedId) focusLocation(selectedId, Number(new URL(window.location.href).searchParams.get('zoom')) || 1.65);
    updateDetail();
  });
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    if (resizeFrame) return;
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      const selectedZoom = zoom;
      render();
      if (selectedId) {
        focusLocation(selectedId, selectedZoom);
        updatePlaceUrl(selectedId);
      }
    });
  }, { passive: true });

  zoomIn.addEventListener('click', () => setZoom(zoom * 1.25));
  zoomOut.addEventListener('click', () => setZoom(zoom / 1.25));
  resetView.addEventListener('click', () => { fitView(); if (selectedId) updatePlaceUrl(selectedId); });

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
  document.addEventListener('fullscreenchange', () => { syncFullscreenButton(); updateView(); });

  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
  }, { passive: false });

  viewport.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      drag = null;
      const [first, second] = [...pointers.values()];
      const firstPoint = screenPoint(first.x, first.y);
      const secondPoint = screenPoint(second.x, second.y);
      const center = { x: (firstPoint.x + secondPoint.x) / 2, y: (firstPoint.y + secondPoint.y) / 2 };
      pinch = {
        distance: Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y),
        zoom, panX, panY,
        center,
        world: { x: (center.x - panX) / zoom, y: (center.y - panY) / zoom }
      };
      viewport.classList.add('is-dragging');
      return;
    }
    const node = event.target.closest('[data-map-node]');
    if (pointers.size === 1 && !node && (event.pointerType === 'touch' || event.button === 0)) {
      const point = screenPoint(event.clientX, event.clientY);
      drag = { id: event.pointerId, point, panX, panY, moved: false };
      viewport.classList.add('is-dragging');
    }
  });

  window.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size >= 2) {
      const [first, second] = [...pointers.values()];
      const firstPoint = screenPoint(first.x, first.y);
      const secondPoint = screenPoint(second.x, second.y);
      const center = { x: (firstPoint.x + secondPoint.x) / 2, y: (firstPoint.y + secondPoint.y) / 2 };
      const distance = Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
      zoom = Math.max(minZoom, Math.min(maxZoom, pinch.zoom * distance / Math.max(pinch.distance, 1)));
      panX = center.x - pinch.world.x * zoom;
      panY = center.y - pinch.world.y * zoom;
      clampPan();
      updateView();
    } else if (drag && drag.id === event.pointerId) {
      const point = screenPoint(event.clientX, event.clientY);
      const dx = point.x - drag.point.x;
      const dy = point.y - drag.point.y;
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
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
    if (!pointers.size && selectedId) updatePlaceUrl(selectedId);
  }
  window.addEventListener('pointerup', endPointer);
  window.addEventListener('pointercancel', endPointer);
  viewport.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
  }, true);

  viewport.addEventListener('keydown', event => {
    const step = 36 / zoom;
    if (event.key === 'Home') {
      event.preventDefault();
      fitView();
      if (selectedId) updatePlaceUrl(selectedId);
      return;
    }
    if (event.key === 'ArrowLeft') panX += step;
    else if (event.key === 'ArrowRight') panX -= step;
    else if (event.key === 'ArrowUp') panY += step;
    else if (event.key === 'ArrowDown') panY -= step;
    else if (event.key === '+' || event.key === '=') { setZoom(zoom * 1.2); return; }
    else if (event.key === '-' || event.key === '_') { setZoom(zoom / 1.2); return; }
    else return;
    event.preventDefault();
    clampPan();
    updateView();
    if (selectedId) updatePlaceUrl(selectedId);
  });

  if (!entries.length) {
    resultCount.textContent = 'The interactive place index could not be loaded.';
    emptyState.hidden = false;
    emptyState.textContent = 'The place data failed to load. The readable place list remains available below; reload the page to retry the diagram.';
    board.replaceChildren(makeDiagram([]));
    return;
  }

  const initialUrl = new URL(window.location.href);
  const requested = initialUrl.searchParams.get('place');
  selectedId = entries.some(entry => entry.id === requested) ? requested : null;
  renderCategories();
  render();
  if (selectedId) {
    focusLocation(selectedId, Number(initialUrl.searchParams.get('zoom')) || 1.65);
    updatePlaceUrl(selectedId);
  }
  updateDetail();
  updateFilterControls();
  syncFullscreenButton();
})();
