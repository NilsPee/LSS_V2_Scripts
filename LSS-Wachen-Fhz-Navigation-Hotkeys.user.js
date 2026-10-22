// ==UserScript==
// @name         LSS Wachen/Fhz Navigation Hotkeys
// @namespace    NilsPe.Wachennavigation
// @version      1.4.2
// @license      MIT
// @author       NilsPe
// @description  Hotkeys zum Navigieren zwischen Gebaeuden und Fahrzeugen.
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Wachen-Fhz-Navigation-Hotkeys.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Wachen-Fhz-Navigation-Hotkeys.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/vehicles/*
// @match        https://*.leitstellenspiel.de/Vehicles/*
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// ==/UserScript==

(function () {
  'use strict';

  const isTypingContext = element => {
    if (!element) return false;
    if (element.closest('input, textarea, select, [contenteditable="true"]')) {
      return true;
    }

    const role = element.getAttribute?.('role');
    return ['textbox', 'combobox', 'searchbox', 'spinbutton'].includes(role);
  };

  const inBuildings = () => /\/buildings\//i.test(location.pathname);
  const inVehicles = () => /\/vehicles\//i.test(location.pathname);

  const buildDialogIsOpen = () => {
    const form = document.getElementById('new_building');

    if (!form) {
      return false;
    }

    const modal = form.closest('.modal');
    return modal ? modal.offsetParent !== null : form.offsetParent !== null;
  };

  const SCOPE_KEY = 'nilspe_navigation_current_dispatch_center';
  const buildingId = Number(location.pathname.match(/^\/buildings\/(\d+)/i)?.[1]);
  let buildingNavigation = { prev: null, next: null, middle: null };
  let navigationReady = false;

  // Numeric IDs give a stable order, including when the API returns unsorted pages.
  function buildingNeighbours(buildings, currentId, onlyDispatchCenter) {
    const current = buildings.find(item => Number(item.id) === currentId);
    if (!current) return null;
    const dispatchId = value => Number(value ?? 0);
    const matches = buildings
      .filter(item =>
        Number(item.building_type) === Number(current.building_type) &&
        (!onlyDispatchCenter ||
          dispatchId(item.leitstelle_building_id ?? item.dispatch_center_id ??
            item.dispatch_center_building_id) ===
          dispatchId(current.leitstelle_building_id ?? current.dispatch_center_id ??
            current.dispatch_center_building_id))
      )
      .sort((a, b) => Number(a.id) - Number(b.id));
    const index = matches.findIndex(item => Number(item.id) === currentId);
    return {
      previous: matches[index - 1] ?? null,
      next: matches[index + 1] ?? null,
      position: index + 1,
      total: matches.length
    };
  }

  const findBuildingNav = () => buildingNavigation;

  async function setupBuildingNavigation() {
    if (!buildingId || document.getElementById('nilspe-building-navigation')) return;
    const header = document.querySelector('.page-header') ??
      document.querySelector('h1');
    if (!header) return;

    const panel = document.createElement('div');
    panel.id = 'nilspe-building-navigation';
    panel.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0';
    const previous = document.createElement('a');
    const next = document.createElement('a');
    for (const link of [previous, next]) {
      link.className = 'btn btn-default btn-sm';
      link.addEventListener('click', event => {
        if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
      });
    }
    previous.textContent = '← Zurueck';
    next.textContent = 'Weiter →';
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;margin:0';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    label.append(checkbox, document.createTextNode('Nur aktuelle Leitstelle'));
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const originalNavigation = document.getElementById('building-navigation-container');
    if (originalNavigation) {
      // Replace only the original direction controls; keep the dispatch-center
      // link and other actions. Explicit directions also handle a missing arrow.
      for (const link of originalNavigation.querySelectorAll('a')) {
        const description = [link.textContent, link.getAttribute('title'),
          link.getAttribute('aria-label')].filter(Boolean).join(' ');
        if (/vorheriges? Geb|n[aä]chstes? Geb|previous building|next building/i.test(description) ||
            link.querySelector('.glyphicon-arrow-left, .glyphicon-arrow-right') ||
            (link.classList.contains('btn-success') &&
              /\/buildings\/\d+/.test(link.getAttribute('href') ?? ''))) {
          link.remove();
        }
      }
      previous.className = next.className = 'btn btn-success btn-xs';
      previous.textContent = 'Vorheriges Gebaeude';
      next.textContent = 'Naechstes Gebaeude';
      originalNavigation.insertBefore(previous, originalNavigation.firstChild);
      originalNavigation.append(next);
      originalNavigation.style.display = 'flex';
      originalNavigation.style.flexWrap = 'wrap';
      originalNavigation.style.justifyContent = 'flex-end';
      panel.style.flexBasis = '100%';
      panel.style.width = '100%';
      panel.style.justifyContent = 'flex-end';
      panel.style.margin = '6px 0 0';
      panel.append(label, status);
      originalNavigation.append(panel);
    } else {
      panel.append(previous, next, label, status);
      header.after(panel);
    }

    function updateLink(link, target) {
      link.classList.toggle('disabled', !target);
      link.setAttribute('aria-disabled', String(!target));
      if (target) {
        link.href = '/buildings/' + target.id;
        link.title = target.caption ?? '';
        link.removeAttribute('tabindex');
      } else {
        link.removeAttribute('href');
        link.removeAttribute('title');
        link.setAttribute('tabindex', '-1');
      }
    }
    updateLink(previous, null);
    updateLink(next, null);
    checkbox.disabled = true;
    status.textContent = 'Navigation wird geladen …';

    let buildings;
    function render() {
      const neighbours = buildingNeighbours(buildings, buildingId, checkbox.checked);
      navigationReady = !!neighbours;
      updateLink(previous, neighbours?.previous);
      updateLink(next, neighbours?.next);
      const middle = document.querySelector(
        '#building-navigation-container a.btn-default[href*="/buildings/"], ' +
        '#building-navigation-container a.btn-primary[href*="/buildings/"]'
      );
      buildingNavigation = {
        prev: neighbours?.previous ? previous : null,
        next: neighbours?.next ? next : null,
        middle
      };
      status.textContent = neighbours
        ? neighbours.position + ' / ' + neighbours.total
        : 'Dieses Gebaeude wurde nicht in den eigenen Gebaeudedaten gefunden.';
    }

    try {
      checkbox.checked = await GM.getValue(SCOPE_KEY, false) === true;
      const db = await openDb();
      try {
        await updateBuildings(db, 60);
        buildings = await getAllData(db, 'buildings');
        // A newly built station may not be in a still-fresh cache yet.
        if (!buildings.some(item => Number(item.id) === buildingId)) {
          await updateBuildings(db, 0);
          buildings = await getAllData(db, 'buildings');
        }
      } finally {
        db.close();
      }
      render();
      checkbox.disabled = !navigationReady;
      checkbox.addEventListener('change', () => {
        render();
        GM.setValue(SCOPE_KEY, checkbox.checked).catch(error => {
          console.error('[Navigation] Einstellung konnte nicht gespeichert werden:', error);
          status.textContent += ' – Einstellung nur fuer diese Seite gespeichert';
        });
      });
    } catch (error) {
      console.error('[Navigation] Gebaeudedaten konnten nicht geladen werden:', error);
      status.textContent = 'Navigation nicht verfuegbar – Seite erneut laden.';
    }
  }

  const findVehicleNav = () => {
    const left = document
      .querySelector('a.btn span.glyphicon-arrow-left')
      ?.closest('a');
    const right = document
      .querySelector('a.btn span.glyphicon-arrow-right')
      ?.closest('a');
    const clickable = link =>
      link?.classList.contains('btn-success') &&
      link.getAttribute('href') &&
      link.getAttribute('href') !== '#';

    return {
      prev: clickable(left) ? left : null,
      next: clickable(right) ? right : null
    };
  };

  const activate = (event, link) => {
    if (!link) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    link.click();
    return true;
  };

  document.addEventListener('keydown', event => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      event.repeat ||
      isTypingContext(event.target) ||
      buildDialogIsOpen()
    ) {
      return;
    }

    const key = (event.key || '').toLowerCase();
    let prev = null;
    let next = null;
    let middle = null;

    if (inBuildings()) {
      ({ prev, next, middle } = findBuildingNav());
    } else if (inVehicles()) {
      ({ prev, next } = findVehicleNav());
    } else {
      return;
    }

    if ((key === 'a' || key === 'arrowleft') && activate(event, prev)) {
      return;
    }

    if ((key === 'd' || key === 'arrowright') && activate(event, next)) {
      return;
    }

    if (key === 'w' && inBuildings() && activate(event, middle)) {
      return;
    }

    if (key === 's' && inBuildings() && buildingId) {
      event.preventDefault();
      event.stopPropagation();
      location.assign(
        '/buildings/' + buildingId + '/vehicles/new'
      );
    }
  }, { capture: true });

  setupBuildingNavigation().catch(console.error);
})();

