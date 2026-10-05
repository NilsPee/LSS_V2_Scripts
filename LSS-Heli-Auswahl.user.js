// ==UserScript==
// @name         LSS Heli Auswahl
// @namespace    NilsPe.lss.heli.auswahl
// @version      1.0.1
// @description  Wählt die nächsten passenden Helikopter und begrenzt deren Anflugzeit bei der AAO-Auswahl.
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Heli-Auswahl.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Heli-Auswahl.user.js
// @match        https://*.leitstellenspiel.de/missions/*
// @grant        none
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';
  if (!/^\/missions\/\d+\/?$/.test(location.pathname) || window.LSSHeliAAO) return;

  const STORAGE_KEY = 'lss_heli_aao_settings_v1';
  const HELI_TYPES = new Set([31, 61, 156, 157, 161]);
  const requiredHooks = ['get_elements_for_aao', 'get_elements_for_aao_key', 'set_elements_for_aao_key'];
  const wrappers = new Map();
  let settings = readSettings();
  let installed = false;
  let storageFailed = false;
  let updateTimer = null;
  let timer = null;
  let nextProbe = null;
  let missionCoordinates;
  window.LSSHeliAAO = Object.freeze({ version: '1.0.1' });

  function normalizeSettings(value) {
    const minutes = Number(value?.maxMinutes);
    return { enabled: value?.enabled !== false,
      maxMinutes: Number.isFinite(minutes) && minutes >= 1 ? Math.min(1440, Math.floor(minutes)) : 60 };
  }

  function readSettings() {
    try { return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return normalizeSettings(null); }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      storageFailed = false;
    } catch { storageFailed = true; }
    updateStatus();
  }

  function isHelicopter(element) {
    return HELI_TYPES.has(Number(element.getAttribute('vehicle_type_id')));
  }

  function readSeconds(cell, attribute) {
    const raw = cell?.getAttribute(attribute);
    if (raw == null || raw.trim() === '') return null;
    const seconds = Number(raw);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  function getMissionCoordinates() {
    if (missionCoordinates) return missionCoordinates;
    const values = { lat: new Set(), lon: new Set() };
    for (const script of document.scripts) {
      for (const match of (script.textContent || '').matchAll(/\bmission_(lat|lon)\s*=\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)\s*[,;]/gi)) {
        values[match[1].toLowerCase()].add(Number(match[2]));
      }
    }
    const lat = Array.from(values.lat)[0];
    const lon = Array.from(values.lon)[0];
    if (values.lat.size !== 1 || values.lon.size !== 1 || !Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    missionCoordinates = { lat, lon };
    return missionCoordinates;
  }

  function getOrigin(cell) {
    for (const name of (cell?.getAttribute('class') || '').split(/\s+/)) {
      const decimal = name.match(/^alarm_distance_(-?\d+)_(\d+)_(-?\d+)_(\d+)_1$/);
      const integer = name.match(/^alarm_distance_(-?\d+)_(-?\d+)_1$/);
      if (!decimal && !integer) continue;
      const lat = Number(decimal ? `${decimal[1]}.${decimal[2]}` : integer[1]);
      const lon = Number(decimal ? `${decimal[3]}.${decimal[4]}` : integer[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
    }
    return null;
  }

  function travelSeconds(element) {
    const cell = document.getElementById(`vehicle_sort_${element.getAttribute('value')}`);
    const rendered = readSeconds(cell, 'timevalue');
    // timevalue already includes start_delay; sortvalue can be a distance sentinel.
    if (rendered !== null) return rendered;
    const target = getMissionCoordinates();
    const origin = getOrigin(cell);
    if (!target || !origin || typeof window.vehicleDistanceDirectTimeToObject !== 'function') return null;
    try {
      // Until the game renders its current driving mode, use the slower mode.
      // Never optimistically admit a heli based on an unknown Sonderrechte state.
      const travel = window.vehicleDistanceDirectTimeToObject(190, origin.lat, origin.lon, target.lat, target.lon, false);
      return Number.isFinite(travel) && travel >= 0 ? travel + (readSeconds(cell, 'start_delay') ?? 0) : null;
    } catch { return null; }
  }

  function orderedCandidates(elements) {
    const candidates = [];
    const times = new Map();
    for (const element of elements) {
      if (isHelicopter(element)) {
        const seconds = travelSeconds(element);
        if (seconds === null || seconds > settings.maxMinutes * 60) continue;
        times.set(element, seconds);
      }
      candidates.push(element);
    }
    const helicopters = candidates.filter(element => times.has(element)).sort((a, b) => times.get(a) - times.get(b));
    let index = 0;
    return candidates.map(element => times.has(element) ? helicopters[index++] : element);
  }

  function hooksHealthy() {
    return installed && Array.from(wrappers).every(([name, wrapper]) => window[name] === wrapper);
  }

  function wrap(name, factory) {
    const wrapper = factory(window[name]);
    window[name] = wrapper;
    wrappers.set(name, wrapper);
  }

  function installHooks() {
    if (installed || !requiredHooks.every(name => typeof window[name] === 'function')) return;
    wrap('get_elements_for_aao', original => function (...args) {
      const elements = original.apply(this, args);
      if (!settings.enabled) return elements;
      const ordered = orderedCandidates(elements);
      if (nextProbe) nextProbe.elements = ordered;
      return ordered;
    });
    // Availability checks otherwise reuse previously filtered candidate lists.
    // Do not write our filtered results into the game's own per-AAO cache.
    wrap('get_elements_for_aao_key', original => function (...args) {
      return settings.enabled ? undefined : original.apply(this, args);
    });
    wrap('set_elements_for_aao_key', original => function (...args) {
      if (!settings.enabled) return original.apply(this, args);
    });
    if (typeof window.aaoNextAvailable_new === 'function') {
      wrap('aaoNextAvailable_new', original => function (key, button, ...args) {
        if (!settings.enabled) return original.call(this, key, button, ...args);
        const parentProbe = nextProbe;
        const probe = { elements: null };
        nextProbe = probe;
        try {
          const result = original.call(this, key, button, ...args);
          // Mixed AAOs compare this value across vehicle categories. Replace
          // a heli's pre-render sorting sentinel with its actual computed time.
          if (!probe.elements || typeof window.aao_building_check_native_new !== 'function') return result;
          let buildings = [];
          try { buildings = JSON.parse(button.getAttribute('building_ids') || '[]'); }
          catch { return result; }
          const selected = probe.elements.find(element => !element.checked && !element.disabled &&
            element.getAttribute('ignore_aao') <= 0 &&
            (element.getAttribute('vehicle_type_ignore_default_aao') <= 0 || String(key).includes('custom_')) &&
            window.aao_building_check_native_new(buildings, element));
          return selected && isHelicopter(selected) ? travelSeconds(selected) ?? result : result;
        } finally { nextProbe = parentProbe; }
      });
    }
    installed = true;
  }

  function mountControls() {
    if (document.getElementById('lss-heli-aao-controls')) return;
    const group = document.getElementById('mission-aao-group');
    if (!group) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'lss-heli-aao-controls';
    toolbar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:7px 0;margin:4px 0;border-bottom:1px solid #888;font-size:12px;line-height:1.5;';
    toolbar.innerHTML = '<strong>Heli-AAO</strong>' +
      '<label style="margin:0;white-space:nowrap;"><input id="lss-heli-aao-enabled" type="checkbox"> Aktiv</label>' +
      '<label style="margin:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">Max. Anflug (min) <input id="lss-heli-aao-minutes" type="number" min="1" max="1440" step="1" class="form-control input-sm" style="width:76px;display:inline-block;"></label>' +
      '<span id="lss-heli-aao-status" role="status" style="min-width:0;overflow-wrap:anywhere;"></span>';
    group.before(toolbar);
    const enabled = toolbar.querySelector('#lss-heli-aao-enabled');
    const minutes = toolbar.querySelector('#lss-heli-aao-minutes');
    enabled.checked = settings.enabled;
    minutes.value = String(settings.maxMinutes);
    enabled.addEventListener('change', () => { settings.enabled = enabled.checked; saveSettings(); });
    minutes.addEventListener('change', () => {
      settings = normalizeSettings({ enabled: settings.enabled, maxMinutes: minutes.value });
      minutes.value = String(settings.maxMinutes);
      saveSettings();
    });
  }

  function updateStatus() {
    const status = document.getElementById('lss-heli-aao-status');
    if (!status) return;
    let text;
    let warning = false;
    if (!settings.enabled) text = 'Aus';
    else if (!hooksHealthy()) { text = 'AAO-Anbindung nicht verfuegbar'; warning = true; }
    else {
      let allowed = 0, far = 0, unknown = 0;
      for (const element of document.querySelectorAll('.vehicle_checkbox')) {
        if (!isHelicopter(element) || element.disabled || element.checked) continue;
        const seconds = travelSeconds(element);
        if (seconds === null) unknown++;
        else if (seconds > settings.maxMinutes * 60) far++;
        else allowed++;
      }
      text = `${allowed} im Limit | ${far} zu weit | ${unknown} ohne Zeit`;
    }
    if (storageFailed) { text += ' | Einstellungen nicht gespeichert'; warning = true; }
    if (status.textContent !== text) status.textContent = text;
    status.style.color = warning ? '#e58e26' : '';
  }

  function refresh() {
    updateTimer = null;
    installHooks();
    mountControls();
    updateStatus();
  }

  function scheduleRefresh() {
    if (updateTimer === null) updateTimer = window.setTimeout(refresh, 150);
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('#lss-heli-aao-controls'))) scheduleRefresh();
  });
  function startWatching() {
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['timevalue', 'start_delay', 'class', 'disabled'] });
    if (timer === null) timer = window.setInterval(refresh, 2000);
    refresh();
  }
  document.addEventListener('change', scheduleRefresh);
  document.addEventListener('click', event => {
    if (!event.target.closest?.('.aao')) return;
    installHooks();
    if (settings.enabled && !hooksHealthy()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      updateStatus();
    }
  }, true);
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return;
    settings = readSettings();
    const enabled = document.getElementById('lss-heli-aao-enabled');
    const minutes = document.getElementById('lss-heli-aao-minutes');
    if (enabled) enabled.checked = settings.enabled;
    if (minutes) minutes.value = String(settings.maxMinutes);
    scheduleRefresh();
  });
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    window.clearInterval(timer);
    if (updateTimer !== null) window.clearTimeout(updateTimer);
    timer = null;
    updateTimer = null;
  });
  window.addEventListener('pageshow', event => { if (event.persisted) startWatching(); });
  startWatching();
})();