// ==UserScript==
// @name         Leitstelle Wachenpersonal
// @namespace    NilsPe.building.personnel
// @version      2.0.5
// @description  Setzt Personal-Soll und automatische Personalwerbung fuer konfigurierte Wachen einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Wachenpersonal.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Wachenpersonal.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.11
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_building_personnel';
  const TARGET_PREFIX = 'nilspe_building_personnel_target_';
  const REQUEST_DELAY_KEY = 'nilspe_building_personnel_request_delay';
  const DEFAULT_REQUEST_DELAY = 100;

  const BUILDING_TYPES = [
    [0, 'Feuerwache'],
    [18, 'Feuerwache (Kleinwache)'],
    [2, 'Rettungswache'],
    [20, 'Rettungswache (Kleinwache)'],
    [5, 'Rettungshubschrauber-Station'],
    [12, 'Schnelleinsatzgruppe (SEG)'],
    [6, 'Polizeiwache'],
    [19, 'Polizeiwache (Kleinwache)'],
    [11, 'Bereitschaftspolizei'],
    [17, 'Polizei-Sondereinheiten'],
    [13, 'Polizeihubschrauberstation'],
    [9, 'THW-Ortsverband'],
    [15, 'Wasserrettung'],
    [21, 'Rettungshundestaffel'],
    [24, 'Reiterstaffel'],
    [25, 'Bergrettung'],
    [26, 'Seenotrettungswache'],
    [28, 'Hubschrauberstation (Seenotrettung)']
  ].map(([id, name]) => ({ id, name }));

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    const settings = [
      { type: 'header', text: 'Personal-Soll je Gebaeudetyp' }
    ];

    for (const buildingType of BUILDING_TYPES) {
      settings.push({
        type: 'number',
        key: `${TARGET_PREFIX}${buildingType.id}`,
        label: `${buildingType.id} ${buildingType.name}`,
        info: '0 = diesen Gebaeudetyp ueberspringen',
        min: 0,
        max: 10_000,
        default: 0
      });
    }

    settings.push(
      { type: 'header', text: 'Ablauf' },
      {
        type: 'number',
        key: REQUEST_DELAY_KEY,
        label: 'Abstand zwischen Starts [ms]',
        min: 0,
        max: 5_000,
        default: DEFAULT_REQUEST_DELAY
      }
    );

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Wachenpersonal',
      settings
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
      personal_count_target: Number(building.personal_count_target ?? 0),
      hiring_automatic:
        building.hiring_automatic === true ||
        building.hiring_automatic === 1 ||
        building.hiring_automatic === '1' ||
        building.hiring_automatic === 'true'
    };
  }

  async function configuredTargets() {
    const targets = new Map();

    for (const buildingType of BUILDING_TYPES) {
      const target = Number(
        await GM.getValue(`${TARGET_PREFIX}${buildingType.id}`, 0)
      );

      if (Number.isInteger(target) && target > 0) {
        targets.set(buildingType.id, target);
      }
    }

    return targets;
  }

  async function loadBuildings(dispatchCenterId, targets) {
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
        .filter(building => targets.has(building.building_type))
        .sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  }

  async function setPersonnelTarget(buildingId, target) {
    const token = csrfToken();
    const body = new URLSearchParams({
      'building[personal_count_target]': String(target),
      _method: 'put'
    });

    if (token) {
      body.append('authenticity_token', token);
    }

    const response = await fetch(
      `/buildings/${buildingId}?personal_count_target_only=1`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-CSRF-Token': token,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body
      }
    );

    if (!response.ok) {
      throw new Error(`Personal-Soll HTTP ${response.status}`);
    }
  }

  async function ensureBuildingListLoaded() {
    if (document.querySelector('#building_table tbody tr')) {
      return;
    }

    const tabButton = document.querySelector(
      'a[href="#tab_buildings"], ' +
      'a[href$="#tab_buildings"], ' +
      'a[data-target="#tab_buildings"], ' +
      '[aria-controls="tab_buildings"]'
    );

    if (!tabButton) {
      throw new Error('Der Tab mit der Gebaeudeliste wurde nicht gefunden.');
    }

    setProgress('Gebaeudeliste wird geoeffnet ...');
    tabButton.click();

    const timeoutAt = Date.now() + 15_000;

    while (Date.now() < timeoutAt) {
      if (document.querySelector('#building_table tbody tr')) {
        return;
      }

      await sleep(100);
    }

    throw new Error('Die Gebaeudeliste konnte nicht geladen werden.');
  }
  function automaticHireUrlFromDocument(sourceDocument, buildingId) {
    const buildingPath = `/buildings/${buildingId}`;
    const links = sourceDocument.querySelectorAll(
      'a.btn-hire[duration="automatic"], ' +
      'a.btn-hire[data-duration="automatic"]'
    );

    for (const link of links) {
      const row = link.closest('tr');
      const belongsToBuilding =
        link.getAttribute('href')?.includes(buildingPath) ||
        row?.querySelector(
          `a[href="${buildingPath}"], a[href^="${buildingPath}?"]`
        );

      if (belongsToBuilding) {
        const href = link.getAttribute('href');
        if (href) {
          return new URL(href, location.origin).href;
        }
      }
    }

    return null;
  }

  async function automaticHireUrl(buildingId) {
    const urlFromBuildingTable = automaticHireUrlFromDocument(
      document,
      buildingId
    );

    if (urlFromBuildingTable) {
      return urlFromBuildingTable;
    }

    const response = await fetch(`/buildings/${buildingId}`, {
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`Gebaeudeseite HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const urlFromBuildingPage = automaticHireUrlFromDocument(
      documentFromResponse,
      buildingId
    );

    if (!urlFromBuildingPage) {
      throw new Error('Automatik-URL wurde nicht gefunden.');
    }

    return urlFromBuildingPage;
  }

  async function enableAutomaticHire(buildingId) {
    const response = await fetch(await automaticHireUrl(buildingId), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Personalwerbung HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-personnel-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-personnel-progress-style';
    style.textContent = `
      #nilspe-personnel-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-personnel-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-personnel-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
      #nilspe-personnel-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-personnel-progress';
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
    status.id = 'nilspe-personnel-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-personnel-track';
    const success = document.createElement('div');
    success.id = 'nilspe-personnel-success';
    const errors = document.createElement('div');
    errors.id = 'nilspe-personnel-errors';
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
    const status = document.getElementById('nilspe-personnel-status');
    const success = document.getElementById('nilspe-personnel-success');
    const errorBar = document.getElementById('nilspe-personnel-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    success.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function processBuilding(building, target) {
    let changed = 0;

    if (building.personal_count_target !== target) {
      await setPersonnelTarget(building.id, target);
      changed++;
    }

    if (!running) {
      return changed;
    }

    if (!building.hiring_automatic) {
      await enableAutomaticHire(building.id);
      changed++;
    }

    return changed;
  }

  async function run(button) {
    if (running) {
      return;
    }

    running = true;
    button.disabled = true;

    try {
      const dispatchCenterId = Number(
        location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
      );
      const targets = await configuredTargets();

      if (targets.size === 0) {
        setProgress('Kein Personal-Soll konfiguriert', 0, 0, 0, 'warning');
        return;
      }

      const requestDelay = Math.max(
        0,
        Number(
          await GM.getValue(REQUEST_DELAY_KEY, DEFAULT_REQUEST_DELAY)
        ) || 0
      );
      await ensureBuildingListLoaded();
      setProgress('Gebaeude werden aus dem API-Cache geladen ...');
      const buildings = await loadBuildings(dispatchCenterId, targets);

      if (buildings.length === 0) {
        setProgress(
          'Keine konfigurierten Gebaeude gefunden',
          0,
          0,
          0,
          'success'
        );
        return;
      }

      const jobs = buildings.filter(building => {
        const target = targets.get(building.building_type);
        return building.personal_count_target !== target ||
          !building.hiring_automatic;
      });

      if (jobs.length === 0) {
        setProgress(
          'Personal-Soll und Automatik sind bereits korrekt',
          0,
          0,
          0,
          'success'
        );
        return;
      }

      let completed = 0;
      let errors = 0;
      let changes = 0;

      let started = 0;

      await Promise.all(jobs.map(async (building, index) => {
        await sleep(index * requestDelay);

        if (!running) {
          return;
        }

        started++;
        setProgress(
          `${started}/${jobs.length} gestartet: ${building.caption}`,
          completed,
          errors,
          jobs.length
        );

        try {
          changes += await processBuilding(
            building,
            targets.get(building.building_type)
          );
        } catch (error) {
          errors++;
          console.error(
            '[Leitstelle Wachenpersonal] Gebaeude fehlgeschlagen:',
            building.id,
            error
          );
        }

        if (!running) {
          return;
        }

        completed++;
        setProgress(
          `${completed}/${jobs.length} Gebaeude, ${changes} Aenderungen`,
          completed,
          errors,
          jobs.length,
          errors ? 'warning' : 'success'
        );
      }));

      if (!running) {
        return;
      }

      setProgress(
        `Fertig: ${changes} Aenderungen, ${errors} Fehler`,
        completed,
        errors,
        jobs.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[Leitstelle Wachenpersonal] Lauf fehlgeschlagen:', error);
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
      document.getElementById('nilspe-personnel-buttons')
    ) {
      return;
    }

    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details) {
      return;
    }

    const term = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = 'Wachenpersonal:';
    term.append(strong);
    const description = document.createElement('dd');
    const group = document.createElement('div');
    group.id = 'nilspe-personnel-buttons';
    group.className = 'btn-group';
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'btn btn-default btn-xs';
    start.textContent = 'Personal setzen';
    start.addEventListener('click', () => run(start));
    group.append(start, settingsButton());
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
