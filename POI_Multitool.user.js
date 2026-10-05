// ==UserScript==
// @name         LSS POI-Multitool
// @namespace    https://www.leitstellenspiel.de/
// @version      3.6.3
// @description  POIs einzeln oder als konfigurierbares POI-Paket vormerken, speichern und verwalten.
// @author       NilsPe
// @match        https://www.leitstellenspiel.de/pois*
// @match        https://www.leitstellenspiel.de/mission_positions*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'lss-poi-multitool-settings-v4';
  const QUEUE_KEY = 'lss-poi-multitool-queue-v3';
  const DEFAULT_SETTINGS = {
    mode: 'package',
    selectedPois: [],
    delay: 200,
    keepQueue: true
  };
  const COLORS = [
    '#2ecc71', '#e74c3c', '#f39c12', '#3498db', '#f1c40f', '#9b59b6',
    '#00bcd4', '#e84393', '#8d6e63', '#ff69b4', '#95a5a6', '#1abc9c'
  ];

  let settings = loadJson(STORAGE_KEY, DEFAULT_SETTINGS);
  let queue = settings.keepQueue ? loadJson(QUEUE_KEY, []) : [];
  let typeCatalog = {};
  let previewMarkers = [];
  let busy = false;
  let initializedForm = null;
  let observerTimer = null;
  let multiPoiLayer = null;
  let mapFilterRun = 0;

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object'
        ? (Array.isArray(fallback) ? value : { ...fallback, ...value })
        : (Array.isArray(fallback) ? [...fallback] : { ...fallback });
    } catch {
      return Array.isArray(fallback) ? [...fallback] : { ...fallback };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function saveQueue() {
    if (settings.keepQueue) {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } else {
      localStorage.removeItem(QUEUE_KEY);
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
  }

  function getForm() {
    return document.querySelector(
      '#new_mission_position, form[action*="/mission_positions"]'
    );
  }

  function isManagementView() {
    return document.querySelector('#nav_poi_manage')
      ?.getAttribute('aria-expanded') === 'true';
  }

  function getFields(form = getForm()) {
    if (!form) return {};
    return {
      type: form.querySelector(
        '#mission_position_poi_type, [name="mission_position[poi_type]"]'
      ),
      lat: form.querySelector(
        '#mission_position_latitude, [name="mission_position[latitude]"]'
      ),
      lon: form.querySelector(
        '#mission_position_longitude, [name="mission_position[longitude]"]'
      ),
      save: form.querySelector(
        'input[name="commit"], button[name="commit"], input[type="submit"], button[type="submit"]'
      )
    };
  }

  function readTypes(select) {
    if (!select) return;
    const found = {};
    for (const option of select.options) {
      if (option.value) found[String(option.value)] = option.textContent.trim();
    }
    if (Object.keys(found).length) typeCatalog = found;
  }

  function typeName(id) {
    return typeCatalog[String(id)] || `POI ${id}`;
  }

  function colorFor(id) {
    const ids = Object.keys(typeCatalog).sort((a, b) => Number(a) - Number(b));
    const index = Math.max(0, ids.indexOf(String(id)));
    return COLORS[index % COLORS.length];
  }

  function selectedTypes(fields) {
    if (settings.mode === 'single') return settings.selectedPois.slice(0, 1);
    return settings.selectedPois.filter(id => typeCatalog[id]);
  }

  function isPoiMarker(layer) {
    if (!layer || typeof layer.getLatLng !== 'function') return false;
    const icon = layer.options?.icon?.options || {};
    const text = [
      icon.html,
      icon.className,
      layer.options?.title,
      layer.getTooltip?.()?.getContent?.(),
      layer._icon?.textContent
    ].filter(Boolean).join(' ').toLowerCase();
    const plainText = text.replace(/<[^>]*>/g, '').trim();
    return text.includes('mission-position') ||
      text.includes('mission_position') ||
      plainText === 'p';
  }

  function collectPoiMarkersFromLayer(layer, result) {
    if (!layer || layer === multiPoiLayer) return;
    if (isPoiMarker(layer)) {
      result.push(layer);
      return;
    }
    if (typeof layer.getLayers === 'function') {
      for (const child of layer.getLayers()) {
        collectPoiMarkersFromLayer(child, result);
      }
    }
  }

  function collectVisiblePoiMarkers(map) {
    const markers = [];
    map.eachLayer(layer => collectPoiMarkersFromLayer(layer, markers));
    return markers;
  }

  function markerKey(marker) {
    const point = marker.getLatLng();
    const id = marker.options?.id ||
      marker.options?.missionPositionId ||
      marker.options?.mission_position_id || '';
    return `${id}|${point.lat.toFixed(7)}|${point.lng.toFixed(7)}`;
  }

  function clearMultiPoiLayer() {
    const map = findLeafletMap();
    if (multiPoiLayer && map?.hasLayer(multiPoiLayer)) {
      map.removeLayer(multiPoiLayer);
    }
    multiPoiLayer = null;
  }

  function waitForPoiMarkers(map, previousSignature, timeout = 1800) {
    return new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        const markers = collectVisiblePoiMarkers(map);
        const signature = markers.map(markerKey).sort().join(';');
        if ((markers.length && signature !== previousSignature) ||
            Date.now() - started >= timeout) {
          resolve(markers);
          return;
        }
        setTimeout(check, 100);
      };
      setTimeout(check, 100);
    });
  }

  async function syncNativePoiSelection() {
    const select = getFields().type;
    const map = findLeafletMap();
    const run = ++mapFilterRun;
    clearMultiPoiLayer();
    if (!select || !map || !settings.selectedPois.length) return;

    if (settings.mode === 'single') {
      select.multiple = false;
      select.value = settings.selectedPois[0];
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    select.multiple = false;
    const collected = new Map();
    let previousSignature = '';

    for (const poiId of settings.selectedPois) {
      if (run !== mapFilterRun) return;
      select.value = poiId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const markers = await waitForPoiMarkers(map, previousSignature);
      previousSignature = markers.map(markerKey).sort().join(';');
      for (const marker of markers) {
        collected.set(markerKey(marker), marker);
      }
    }

    if (run !== mapFilterRun) return;
    const LayerGroup = window.L?.markerClusterGroup || window.L?.layerGroup;
    if (!LayerGroup) return;
    multiPoiLayer = LayerGroup();
    for (const marker of collected.values()) multiPoiLayer.addLayer(marker);
    multiPoiLayer.addTo(map);
  }

  function findLeafletMap() {
    const candidates = [
      window.map,
      window.map_pois,
      window.map_pois_service?.map,
      window.map_pois_service?.leafletMap
    ];
    return candidates.find(candidate =>
      candidate && typeof candidate.addLayer === 'function'
    );
  }

  function addPreview(lat, lon, type) {
    const map = findLeafletMap();
    if (!map || !window.L?.circleMarker) return;
    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      color: '#111',
      weight: 1,
      fillColor: colorFor(type),
      fillOpacity: 0.9
    }).bindTooltip(typeName(type)).addTo(map);
    previewMarkers.push(marker);
  }

  function clearPreviews() {
    const map = findLeafletMap();
    for (const marker of previewMarkers) {
      try {
        if (map?.hasLayer(marker)) map.removeLayer(marker);
      } catch {
        // Die Warteschlange bleibt auch erhalten, wenn die Karte neu aufgebaut wurde.
      }
    }
    previewMarkers = [];
  }

  function restorePreviews() {
    clearPreviews();
    for (const poi of queue) {
      addPreview(Number(poi.latitude), Number(poi.longitude), poi.poi_type);
    }
  }

  function setStatus(message, kind = '') {
    const box = document.getElementById('lss-poi-status');
    if (!box) return;
    box.className = `lss-poi-status ${kind}`;
    box.innerHTML = message || queueSummary();
  }

  function queueSummary() {
    const locations = new Set(queue.map(poi => `${poi.latitude}|${poi.longitude}`)).size;
    return `<strong>Vorgemerkt:</strong> ${queue.length} POIs an ${locations} Standort${locations === 1 ? '' : 'en'}`;
  }

  function renderQueue() {
    saveQueue();
    setStatus('');
    const list = document.getElementById('lss-poi-queue');
    if (!list) return;
    const counts = {};
    for (const poi of queue) counts[poi.poi_type] = (counts[poi.poi_type] || 0) + 1;
    list.innerHTML = Object.entries(counts)
      .sort((a, b) => typeName(a[0]).localeCompare(typeName(b[0]), 'de'))
      .map(([id, count]) =>
        `<span class="lss-poi-chip"><i style="background:${colorFor(id)}"></i>${escapeHtml(typeName(id))}: ${count}</span>`
      ).join('');
  }

  function escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value);
    return node.innerHTML;
  }

  function queueCurrentPosition() {
    if (busy) return;
    const fields = getFields();
    const lat = Number(fields.lat?.value);
    const lon = Number(fields.lon?.value);
    const types = selectedTypes(fields);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      alert('Die Koordinaten des Kartenmarkers wurden nicht gefunden.');
      return;
    }
    if (!types.length) {
      alert('Es ist kein POI ausgewählt. Öffne die Einstellungen und wähle mindestens einen POI.');
      return;
    }
    for (const type of types) {
      queue.push({
        poi_type: String(type),
        latitude: String(lat),
        longitude: String(lon)
      });
      addPreview(lat, lon, type);
    }
    renderQueue();
  }

  function resetQueue() {
    if (busy || !queue.length) return;
    if (!confirm(`${queue.length} vorgemerkte POIs verwerfen?`)) return;
    queue = [];
    clearPreviews();
    renderQueue();
  }

  async function requestSave(poi) {
    const body = new URLSearchParams();
    body.set('utf8', '✓');
    body.set('mission_position[poi_type]', poi.poi_type);
    body.set('mission_position[latitude]', poi.latitude);
    body.set('mission_position[longitude]', poi.longitude);
    body.set('commit', 'Speichern');
    return fetch('/mission_positions', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': csrfToken(),
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body.toString()
    });
  }

  async function saveQueued() {
    if (busy) return;
    if (!queue.length) {
      alert('Es sind noch keine POIs vorgemerkt.');
      return;
    }
    busy = true;
    updateButtons();
    let success = 0;
    const failed = [];
    const items = [...queue];
    for (let index = 0; index < items.length; index++) {
      try {
        const response = await requestSave(items[index]);
        if (response.ok) success++;
        else failed.push(items[index]);
      } catch {
        failed.push(items[index]);
      }
      setStatus(
        `<strong>Speichere:</strong> ${index + 1}/${items.length} &nbsp; Erfolgreich: ${success} &nbsp; Fehler: ${failed.length}`,
        failed.length ? 'warning' : ''
      );
      if (index < items.length - 1) await sleep(settings.delay);
    }
    queue = failed;
    clearPreviews();
    restorePreviews();
    renderQueue();
    busy = false;
    updateButtons();
    if (failed.length) {
      alert(`${success} POIs gespeichert, ${failed.length} fehlgeschlagen. Die fehlgeschlagenen Einträge bleiben vorgemerkt.`);
    } else {
      alert(`${success} POIs wurden erfolgreich gespeichert.`);
      location.reload();
    }
  }

  function updateButtons() {
    document.querySelectorAll(
      '#lss-poi-tools button, #lss-poi-manage-tools button'
    ).forEach(button => {
      button.disabled = busy;
    });
  }

  function collectExistingPoiIds() {
    const ids = new Set();
    const selectors = [
      'a[href*="/mission_positions/"]',
      'form[action*="/mission_positions/"]',
      '[data-mission-position-id]',
      '[data-poi-id]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(element => {
      const source = element.getAttribute('href') ||
        element.getAttribute('action') ||
        element.dataset.missionPositionId ||
        element.dataset.poiId || '';
      const match = String(source).match(/(?:mission_positions\/)?(\d+)(?:\D*$|$)/);
      if (match) ids.add(match[1]);
    });
    for (const script of document.scripts) {
      const text = script.textContent || '';
      const regex = /leafletMissionPositionMarkerAdd\(\{[\s\S]*?"id"\s*:\s*(\d+)[\s\S]*?\}\)/g;
      let match;
      while ((match = regex.exec(text))) ids.add(match[1]);
    }
    return [...ids];
  }

  function getFilteredPoiCount() {
    const paneText = document.querySelector('#poi_manage')?.textContent || '';
    const match = paneText.match(/Du hast\s+(\d+)\s+POIs?\s+gefiltert/i);
    return match ? Number(match[1]) : 0;
  }

  function getNativeDeleteButtons() {
    const pane = document.querySelector('#poi_manage');
    if (!pane) return [];
    return [...pane.querySelectorAll(
      '#virtual_container button[data-v-item-action="remove"]'
    )].filter(button => !button.disabled);
  }

  function setDeleteStatus(message, kind = '') {
    const box = document.getElementById('lss-poi-delete-status');
    if (!box) return;
    box.className = `lss-poi-status ${kind}`;
    box.innerHTML = message;
    box.hidden = false;
  }

  function virtualRowState(button) {
    const row = button.closest('.virtual-item');
    return {
      row,
      index: row?.dataset.index || '',
      text: row?.textContent?.trim() || ''
    };
  }

  function clickDeleteInPageContext(button) {
    const token = `lss-poi-delete-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    button.dataset.lssPoiDeleteToken = token;

    const script = document.createElement('script');
    script.textContent = `(() => {
      const button = document.querySelector(
        '[data-lss-poi-delete-token="${token}"]'
      );
      if (!button) return;

      const nativeConfirm = window.confirm;
      window.confirm = () => true;
      try {
        button.click();
      } finally {
        setTimeout(() => {
          window.confirm = nativeConfirm;
          button.removeAttribute('data-lss-poi-delete-token');
        }, 1500);
      }
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function waitForNativeDelete(previousCount, button, previousState, timeout = 10000) {
    return new Promise(resolve => {
      const started = Date.now();
      const check = () => {
        const currentCount = getFilteredPoiCount();
        const currentRow = button.closest('.virtual-item');
        const rowChanged = !previousState.row?.isConnected ||
          !button.isConnected ||
          currentRow !== previousState.row ||
          currentRow?.dataset.index !== previousState.index ||
          currentRow?.textContent?.trim() !== previousState.text;

        if ((previousCount && currentCount < previousCount) ||
            rowChanged ||
            Date.now() - started >= timeout) {
          resolve({
            count: currentCount,
            deleted: rowChanged ||
              (previousCount > 0 && currentCount < previousCount)
          });
          return;
        }
        setTimeout(check, 100);
      };
      setTimeout(check, 100);
    });
  }

  async function deletePoisThroughList(total) {
    let success = 0;
    let failed = 0;

    while (success + failed < total) {
      const buttons = getNativeDeleteButtons();
      const button = buttons.find(candidate => candidate.getClientRects().length) ||
        buttons[0];
      if (!button) {
        failed = total - success;
        break;
      }

      const previousCount = getFilteredPoiCount();
      const previousState = virtualRowState(button);
      button.scrollIntoView({ block: 'nearest' });
      clickDeleteInPageContext(button);
      const result = await waitForNativeDelete(
        previousCount,
        button,
        previousState
      );
      const deleted = result.deleted;

      if (deleted) success++;
      else failed++;

      setDeleteStatus(
        `<strong>Lösche:</strong> ${success + failed}/${total} &nbsp; Erfolgreich: ${success} &nbsp; Fehler: ${failed}`,
        failed ? 'warning' : ''
      );

      if (!deleted) break;
      await sleep(settings.delay);
    }

    return { success, failed };
  }

  async function deleteLoadedPois() {
    if (busy) return;
    const ids = collectExistingPoiIds();
    const filteredCount = getFilteredPoiCount();
    const total = ids.length || filteredCount;
    if (!total) {
      alert('Keine POIs in der aktuellen Verwaltungsliste gefunden.');
      return;
    }
    if (!confirm(
      `${total} POIs aus der aktuell gefilterten Liste unwiderruflich löschen?`
    )) return;

    busy = true;
    updateButtons();
    setDeleteStatus(
      `<strong>Lösche:</strong> 0/${total} &nbsp; Erfolgreich: 0 &nbsp; Fehler: 0`
    );
    let success = 0;
    let failed = 0;

    if (!ids.length) {
      const result = await deletePoisThroughList(total);
      success = result.success;
      failed = result.failed;
      busy = false;
      updateButtons();
      alert(`${success} POIs gelöscht, ${failed} fehlgeschlagen.`);
      if (success) location.reload();
      return;
    }

    for (let index = 0; index < ids.length; index++) {
      try {
        const response = await fetch(`/mission_positions/${ids[index]}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'text/javascript, application/javascript, */*; q=0.01'
          }
        });
        if (response.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
      setDeleteStatus(
        `<strong>Lösche:</strong> ${index + 1}/${ids.length} &nbsp; Erfolgreich: ${success} &nbsp; Fehler: ${failed}`,
        failed ? 'warning' : ''
      );
      if (index < ids.length - 1) await sleep(settings.delay);
    }
    busy = false;
    updateButtons();
    alert(`${success} POIs gelöscht, ${failed} fehlgeschlagen.`);
    location.reload();
  }

  function renderTypeSettings() {
    const area = document.getElementById('lss-poi-type-settings');
    if (!area) return;
    area.innerHTML = Object.entries(typeCatalog)
      .sort((a, b) => a[1].localeCompare(b[1], 'de'))
      .map(([id, name]) => `
        <label>
          <input type="checkbox" value="${escapeHtml(id)}" ${settings.selectedPois.includes(id) ? 'checked' : ''}>
          <i style="background:${colorFor(id)}"></i>
          ${escapeHtml(name)}
        </label>
      `).join('');
  }

  function enforceSinglePoiSelection(preferredInput = null) {
    const dialog = document.getElementById('lss-poi-settings');
    if (!dialog || dialog.querySelector('[name="mode"]').value !== 'single') return;

    const checked = [...dialog.querySelectorAll('#lss-poi-type-settings input:checked')];
    const keep = preferredInput?.checked ? preferredInput : checked.at(-1);
    for (const input of checked) {
      if (input !== keep) input.checked = false;
    }
  }

  function openSettings() {
    const dialog = document.getElementById('lss-poi-settings');
    renderTypeSettings();
    dialog.querySelector('[name="mode"]').value = settings.mode;
    dialog.querySelector('[name="delay"]').value = settings.delay;
    dialog.querySelector('[name="keepQueue"]').checked = settings.keepQueue;
    enforceSinglePoiSelection();
    dialog.hidden = false;
  }

  function closeSettings(save) {
    const dialog = document.getElementById('lss-poi-settings');
    if (save) {
      settings.mode = dialog.querySelector('[name="mode"]').value;
      settings.delay = Math.max(50, Number(dialog.querySelector('[name="delay"]').value) || 200);
      settings.keepQueue = dialog.querySelector('[name="keepQueue"]').checked;
      settings.selectedPois = [...dialog.querySelectorAll('#lss-poi-type-settings input:checked')]
        .map(input => input.value);
      saveSettings();
      saveQueue();
      applyFormSettings();
      syncNativePoiSelection();
      updateModeLabel();
    }
    dialog.hidden = true;
  }

  function applyFormSettings() {
    const fields = getFields();
    const save = fields.save;
    if (save) save.style.display = 'none';

    if (fields.type) {
      const typeRow = fields.type.closest('.form-group, .input-group') ||
        fields.type.parentElement;
      if (typeRow) typeRow.style.display = 'none';
    }
  }

  function updateModeLabel() {
    const label = document.getElementById('lss-poi-mode');
    if (!label) return;
    label.textContent = settings.mode === 'single'
      ? 'Modus: ausgewählter POI'
      : `Modus: POI-Paket (${settings.selectedPois.length})`;
  }

  function injectStyles() {
    if (document.getElementById('lss-poi-styles')) return;
    const style = document.createElement('style');
    style.id = 'lss-poi-styles';
    style.textContent = `
      #lss-poi-tools { margin-top:10px; padding-top:10px; border-top:1px solid #777; color:#fff; }
      #mission_position_poi_type,
      label[for="mission_position_poi_type"] { display:none !important; }
      #lss-poi-tools .lss-poi-actions { display:flex; flex-wrap:wrap; gap:6px; }
      #lss-poi-tools button { margin:0; }
      #lss-poi-mode { display:block; margin:8px 0 4px; opacity:.85; }
      .lss-poi-status { margin-top:8px; padding:7px; background:rgba(0,0,0,.25); border-radius:3px; }
      .lss-poi-status.warning { background:#8a6515; }
      #lss-poi-queue { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
      .lss-poi-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 6px; background:#333; border-radius:3px; }
      .lss-poi-chip i, #lss-poi-type-settings i { width:11px; height:11px; border:1px solid #111; display:inline-block; }
      #lss-poi-settings[hidden] { display:none; }
      #lss-poi-settings { position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; }
      #lss-poi-manage-tools { margin:0 0 10px; }
      #lss-poi-manage-tools .lss-poi-actions { display:flex; flex-wrap:wrap; gap:6px; }
      #lss-poi-delete-status { margin-top:8px; }
      .lss-poi-dialog { width:min(1280px,96vw); max-height:94vh; overflow:auto; padding:18px; color:#eee; background:#444; border:1px solid #888; border-radius:5px; box-shadow:0 10px 35px #000; }
      .lss-poi-dialog h3 { margin-top:0; }
      .lss-poi-dialog-row { display:grid; grid-template-columns:190px 1fr; gap:10px; align-items:center; margin:8px 0; }
      #lss-poi-type-settings { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; margin:10px 0 14px; }
      #lss-poi-type-settings label { display:flex; align-items:center; gap:7px; padding:4px; background:#383838; }
      .lss-poi-dialog-actions { display:flex; justify-content:flex-end; gap:8px; }
      @media (max-width:1050px) {
        #lss-poi-type-settings { grid-template-columns:repeat(3,minmax(0,1fr)); }
      }
      @media (max-width:760px) {
        #lss-poi-type-settings { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width:520px) {
        .lss-poi-dialog-row { grid-template-columns:1fr; }
        #lss-poi-type-settings { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function createSettingsDialog() {
    if (document.getElementById('lss-poi-settings')) return;
    const dialog = document.createElement('div');
    dialog.id = 'lss-poi-settings';
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="lss-poi-dialog" role="dialog" aria-modal="true" aria-label="POI-Multitool Einstellungen">
        <h3>POI-Multitool Einstellungen</h3>
        <div class="lss-poi-dialog-row">
          <label for="lss-poi-setting-mode">Setzmodus</label>
          <select id="lss-poi-setting-mode" name="mode">
            <option value="package">Alle ausgewählten POIs je Standort</option>
            <option value="single">Aktuell ausgewählten POI vormerken</option>
          </select>
        </div>
        <div class="lss-poi-dialog-row">
          <label for="lss-poi-setting-delay">Pause pro Anfrage (ms)</label>
          <input id="lss-poi-setting-delay" name="delay" type="number" min="50" step="50">
        </div>
        <div class="lss-poi-dialog-row"><span>Warteschlange</span><label><input name="keepQueue" type="checkbox"> Vorgemerkte POIs nach einem Seiten-Reload behalten</label></div>
        <h4>POI-Auswahl</h4>
        <div id="lss-poi-type-settings"></div>
        <div class="lss-poi-dialog-actions">
          <button type="button" class="btn btn-default" data-action="cancel">Abbrechen</button>
          <button type="button" class="btn btn-success" data-action="save">Einstellungen speichern</button>
        </div>
      </div>
    `;
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-action="cancel"]')) closeSettings(false);
      if (event.target.closest('[data-action="save"]')) closeSettings(true);
    });
    dialog.addEventListener('change', event => {
      if (event.target.matches('[name="mode"]')) enforceSinglePoiSelection();
      if (event.target.matches('#lss-poi-type-settings input')) {
        enforceSinglePoiSelection(event.target);
      }
    });
    document.body.appendChild(dialog);
  }

  function createManagementTools() {
    if (document.getElementById('lss-poi-manage-tools')) return;
    const pane = document.querySelector('#poi_manage');
    if (!pane) return;

    const tools = document.createElement('div');
    tools.id = 'lss-poi-manage-tools';
    tools.title = 'Geladene POIs verwalten';
    tools.innerHTML = `
      <div class="lss-poi-actions">
        <button type="button" class="btn btn-danger" data-action="delete">Geladene POIs löschen</button>
      </div>
      <div id="lss-poi-delete-status" class="lss-poi-status" hidden></div>
    `;
    tools.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'delete') deleteLoadedPois();
    });

    const anchor = pane.querySelector('.panel-body') || pane;
    anchor.insertBefore(tools, anchor.firstChild);
  }

  function createTools(form, fields) {
    if (document.getElementById('lss-poi-tools')) return;
    const tools = document.createElement('div');
    tools.id = 'lss-poi-tools';
    tools.innerHTML = `
      <div class="lss-poi-actions">
        <button type="button" class="btn btn-info" data-action="queue">POI vormerken (V)</button>
        <button type="button" class="btn btn-success" data-action="save">Alle speichern (S)</button>
        <button type="button" class="btn btn-warning" data-action="reset">Zurücksetzen (R)</button>
        <button type="button" class="btn btn-default" data-action="settings">Einstellungen</button>
      </div>
      <small id="lss-poi-mode"></small>
      <div id="lss-poi-status" class="lss-poi-status"></div>
      <div id="lss-poi-queue"></div>
    `;
    tools.addEventListener('click', event => {
      const action = event.target.closest('button')?.dataset.action;
      if (action === 'queue') queueCurrentPosition();
      if (action === 'save') saveQueued();
      if (action === 'reset') resetQueue();
      if (action === 'settings') openSettings();
    });
    const anchor = fields.save?.parentElement || form;
    anchor.appendChild(tools);
    applyFormSettings();
    updateModeLabel();
    renderQueue();
    restorePreviews();
  }

  function initialize() {
    injectStyles();
    createSettingsDialog();
    createManagementTools();
    const form = getForm();
    if (!form) return;
    const fields = getFields(form);
    if (!fields.type || !fields.lat || !fields.lon) return;
    readTypes(fields.type);
    if (initializedForm !== form) {
      document.getElementById('lss-poi-tools')?.remove();
      initializedForm = form;
      setTimeout(syncNativePoiSelection, 0);
    }
    createTools(form, fields);
    applyFormSettings();
  }

  document.addEventListener('keydown', event => {
    if (busy || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable) return;
    if (!getForm()) return;
    const key = event.key.toLowerCase();
    if (key === 'v') queueCurrentPosition();
    if (key === 's') saveQueued();
    if (key === 'r') resetQueue();
  });

  const observer = new MutationObserver(() => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(initialize, 100);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'class',
      'style',
      'hidden',
      'aria-selected',
      'aria-pressed',
      'aria-expanded'
    ]
  });
  initialize();
})();
