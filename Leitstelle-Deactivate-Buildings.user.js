// ==UserScript==
// @name         Leitstelle De-/Activate Buildings
// @namespace    NilsPe.activate.buildings
// @version      1.0.3
// @description  Aktiviert oder deaktiviert konfigurierte Gebaeude einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_activate_buildings';
  const KEYS = {
    activateTypes: 'nilspe_ab_activate_types',
    deactivateTypes: 'nilspe_ab_deactivate_types',
    concurrency: 'nilspe_ab_concurrency',
    requestDelay: 'nilspe_ab_request_delay'
  };

  const BUILDING_TYPES = [
    [0, 'Feuerwache'],
    [2, 'Rettungswache'],
    [4, 'Krankenhaus'],
    [5, 'Rettungshubschrauber-Station'],
    [6, 'Polizeiwache'],
    [9, 'THW-Ortsverband'],
    [11, 'Bereitschaftspolizei'],
    [12, 'Schnelleinsatzgruppe (SEG)'],
    [13, 'Polizeihubschrauberstation'],
    [15, 'Wasserrettung'],
    [16, 'Verbandszellen'],
    [17, 'Polizei-Sondereinheiten'],
    [18, 'Feuerwache (Kleinwache)'],
    [19, 'Polizeiwache (Kleinwache)'],
    [20, 'Rettungswache (Kleinwache)'],
    [21, 'Rettungshundestaffel'],
    [24, 'Reiterstaffel'],
    [25, 'Bergrettung'],
    [26, 'Seenotrettungswache'],
    [28, 'Hubschrauberstation (Seenotrettung)']
  ].map(([value, name]) => ({ value, name: `${value} ${name}` }));

  const DEFAULT_TYPES = [
    0, 2, 4, 5, 6, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 24, 25,
    26, 28
  ];

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  function parseArray(value, fallback = []) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : fallback;
    } catch {
      return fallback;
    }
  }

  async function initializeDefaults() {
    for (const key of [KEYS.activateTypes, KEYS.deactivateTypes]) {
      const stored = await GM.getValue(key, null);

      if (stored === null) {
        await GM.setValue(key, JSON.stringify(DEFAULT_TYPES));
      }
    }
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await initializeDefaults();
    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'De-/Activate Buildings',
      settings: [
        { type: 'header', text: 'Gebaeude aktivieren' },
        {
          type: 'select',
          key: KEYS.activateTypes,
          label: 'Gebaeudetypen aktivieren',
          title: 'Gebaeudetypen auswaehlen',
          multiple: true,
          options: BUILDING_TYPES
        },
        { type: 'header', text: 'Gebaeude deaktivieren' },
        {
          type: 'select',
          key: KEYS.deactivateTypes,
          label: 'Gebaeudetypen deaktivieren',
          title: 'Gebaeudetypen auswaehlen',
          multiple: true,
          options: BUILDING_TYPES
        },
        { type: 'header', text: 'Ablauf' },
        {
          type: 'number',
          key: KEYS.concurrency,
          label: 'Parallele Gebaeudepruefungen',
          min: 1,
          max: 10,
          default: 3
        },
        {
          type: 'number',
          key: KEYS.requestDelay,
          label: 'Pause nach einer Umschaltung [ms]',
          min: 0,
          max: 5_000,
          default: 100
        }
      ]
    });
  }

  function normalizeBuilding(building) {
    const dispatchCenterId =
      building.leitstelle_building_id ??
      building.dispatch_center_id ??
      building.dispatch_center_building_id ??
      null;

    return {
      ...building,
      id: Number(building.id),
      building_type: Number(building.building_type),
      leitstelle_building_id:
        dispatchCenterId == null ? null : Number(dispatchCenterId),
      caption: building.caption || building.name || `Gebaeude ${building.id}`,
      enabled: building.enabled !== false
    };
  }

  async function loadBuildings(dispatchCenterId, types, desiredState) {
    if (typeof openDb !== 'function' || typeof updateBuildings !== 'function') {
      throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);
      return (await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        Number(dispatchCenterId)
      ))
        .map(normalizeBuilding)
        .filter(building => types.has(building.building_type))
        .filter(building => building.enabled !== desiredState)
        .sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  async function toggleUrl(buildingId) {
    const response = await fetch(`/buildings/${buildingId}`, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (!response.ok) {
      throw new Error(`Gebaeudeseite HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const link = documentFromResponse.querySelector(
      `a[href*="/buildings/${buildingId}/active"], ` +
      'a[href$="/active"][data-method], a.btn[href$="/active"]'
    );
    const href = link?.getAttribute('href');

    if (!href) {
      throw new Error('Umschalt-URL wurde nicht gefunden.');
    }

    return new URL(href, location.origin).href;
  }

  async function toggleBuilding(buildingId) {
    const response = await fetch(await toggleUrl(buildingId), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Umschaltung HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-ab-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-ab-style';
    style.textContent = `
      #nilspe-ab-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-ab-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-ab-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
      #nilspe-ab-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-ab-progress';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-default btn-xs';
    cancel.textContent = 'Abbrechen';
    cancel.addEventListener('click', () => {
      running = false;
      setProgress('Abgebrochen', 0, 0, 0, 'danger');
    });
    const status = document.createElement('span');
    status.id = 'nilspe-ab-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-ab-track';
    const success = document.createElement('div');
    success.id = 'nilspe-ab-success';
    const errors = document.createElement('div');
    errors.id = 'nilspe-ab-errors';
    track.append(success, errors);
    row.append(cancel, status);
    container.append(row, track);
    document.body.append(container);
  }

  function setProgress(
    message,
    completed = 0,
    errors = 0,
    total = 0,
    type = 'info'
  ) {
    ensureProgress();
    const status = document.getElementById('nilspe-ab-status');
    const successBar = document.getElementById('nilspe-ab-success');
    const errorBar = document.getElementById('nilspe-ab-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    successBar.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function run(desiredState, button) {
    if (running) {
      return;
    }

    running = true;
    button.disabled = true;

    try {
      const dispatchCenterId = Number(
        location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
      );
      const typeKey = desiredState
        ? KEYS.activateTypes
        : KEYS.deactivateTypes;
      const types = new Set(parseArray(
        await GM.getValue(typeKey, JSON.stringify(DEFAULT_TYPES)),
        DEFAULT_TYPES
      ));
      const concurrency = Math.max(
        1,
        Math.min(10, Number(await GM.getValue(KEYS.concurrency, 3)) || 3)
      );
      const requestDelay = Math.max(
        0,
        Number(await GM.getValue(KEYS.requestDelay, 100)) || 0
      );

      setProgress('Gebaeude werden geladen ...');
      const buildings = await loadBuildings(
        dispatchCenterId,
        types,
        desiredState
      );

      if (buildings.length === 0) {
        setProgress('Keine Umschaltung erforderlich', 0, 0, 0, 'success');
        return;
      }

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;
      let changed = 0;

      async function worker() {
        while (running) {
          const index = nextIndex++;

          if (index >= buildings.length) {
            return;
          }

          const building = buildings[index];
          setProgress(
            `${completed}/${buildings.length}: ${building.caption}`,
            completed,
            errors,
            buildings.length
          );

          try {
            await toggleBuilding(building.id);
            changed++;
          } catch (error) {
            errors++;
            console.error(
              '[De-/Activate Buildings] Gebaeude fehlgeschlagen:',
              building.id,
              error
            );
          }

          completed++;
          setProgress(
            `${completed}/${buildings.length} Gebaeude, ${changed} umgeschaltet`,
            completed,
            errors,
            buildings.length,
            errors ? 'warning' : 'success'
          );
          await sleep(requestDelay);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, buildings.length) },
          worker
        )
      );

      if (!running) {
        return;
      }

      setProgress(
        `Fertig: ${changed} umgeschaltet, ${errors} Fehler`,
        completed,
        errors,
        buildings.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[De-/Activate Buildings] Lauf fehlgeschlagen:', error);
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 0, 'danger');
    } finally {
      running = false;
      button.disabled = false;
    }
  }

  function settingsButton() {
    const button = document.createElement('a');
    button.className = 'btn btn-default btn-xs';
    button.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
    button.target = '_blank';
    button.title = 'Einstellungen';
    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';
    button.append(icon);
    return button;
  }

  function addButtons() {
    const heading = document.querySelector('h1[building_type]');

    if (
      Number(heading?.getAttribute('building_type')) !== 7 ||
      document.getElementById('nilspe-ab-buttons')
    ) {
      return;
    }

    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details) {
      return;
    }

    const term = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = 'Gebaeude:';
    term.append(strong);
    const description = document.createElement('dd');
    const group = document.createElement('div');
    group.id = 'nilspe-ab-buttons';
    group.className = 'btn-group';
    const activate = document.createElement('button');
    activate.type = 'button';
    activate.className = 'btn btn-default btn-xs';
    activate.textContent = 'Aktivieren';
    activate.addEventListener('click', () => run(true, activate));
    const deactivate = document.createElement('button');
    deactivate.type = 'button';
    deactivate.className = 'btn btn-default btn-xs';
    deactivate.textContent = 'Deaktivieren';
    deactivate.addEventListener('click', () => run(false, deactivate));
    group.append(activate, deactivate, settingsButton());
    description.append(group);
    details.append(term, description);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
  } else {
    addButtons();
    new MutationObserver(addButtons).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
