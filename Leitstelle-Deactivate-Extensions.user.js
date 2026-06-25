// ==UserScript==
// @name         Leitstelle De-/Activate Extensions
// @namespace    NilsPe.activate.extensions
// @version      1.0.0
// @description  Aktiviert oder deaktiviert konfigurierte Erweiterungen einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Extensions.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Extensions.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_activate_extensions';
  const ACTIVATE_PREFIX = 'nilspe_ae_activate_';
  const DEACTIVATE_PREFIX = 'nilspe_ae_deactivate_';
  const ACTION_DELAY_KEY = 'nilspe_ae_action_delay';
  const BUILDING_DELAY_KEY = 'nilspe_ae_building_delay';
  const DEFAULT_ACTION_DELAY = 200;
  const DEFAULT_BUILDING_DELAY = 100;

  const BUILDING_TYPES = [
    [0, 'Feuerwache'],
    [1, 'Feuerwehrschule'],
    [2, 'Rettungswache'],
    [3, 'Rettungsschule'],
    [4, 'Krankenhaus'],
    [5, 'Rettungshubschrauber-Station'],
    [6, 'Polizeiwache'],
    [8, 'Polizeischule'],
    [9, 'THW-Ortsverband'],
    [10, 'THW Bundesschule'],
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
    [27, 'Schule fuer Seefahrt und Seenotrettung'],
    [28, 'Hubschrauberstation (Seenotrettung)']
  ].map(([id, name]) => ({ id, name }));

  function numberedOptions(name, ids) {
    return ids.map((id, index) => ({
      value: id,
      name: `${name} ${index + 1}`
    }));
  }

  const EXTENSIONS = new Map([
    [0, [
      { value: 0, name: 'Rettungsdienst' },
      ...numberedOptions('Abrollbehaelter', [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]),
      { value: 6, name: 'Wasserrettung' },
      { value: 8, name: 'Flughafen' },
      { value: 9, name: 'Grosswache' },
      { value: 13, name: 'Werkfeuerwehr' },
      { value: 14, name: 'NEA50' },
      { value: 15, name: 'NEA200' },
      { value: 16, name: 'Luefter' },
      { value: 18, name: 'Drohnen-Erweiterung' },
      { value: 19, name: 'Verpflegungsdienst' },
      ...numberedOptions('Anhaenger-Stellplatz', [20, 21, 22, 23, 24]),
      { value: 25, name: 'Bahnrettung' }
    ]],
    [18, [
      { value: 0, name: 'Rettungsdienst' },
      ...numberedOptions('Abrollbehaelter', [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]),
      { value: 6, name: 'Wasserrettung' },
      { value: 8, name: 'Flughafen' },
      { value: 9, name: 'Grosswache' },
      { value: 13, name: 'Werkfeuerwehr' },
      { value: 14, name: 'NEA50' },
      { value: 15, name: 'NEA200' },
      { value: 16, name: 'Luefter' },
      { value: 18, name: 'Drohnen-Erweiterung' },
      { value: 19, name: 'Verpflegungsdienst' },
      ...numberedOptions('Anhaenger-Stellplatz', [20, 21, 22, 23, 24]),
      { value: 25, name: 'Bahnrettung' }
    ]],
    [2, [{ value: 0, name: 'Grosswache' }]],
    [20, [{ value: 0, name: 'Grosswache' }]],
    [4, [
      { value: 0, name: 'Allgemeine Innere' },
      { value: 1, name: 'Allgemeine Chirurgie' },
      { value: 2, name: 'Gynaekologie' },
      { value: 3, name: 'Urologie' },
      { value: 4, name: 'Unfallchirurgie' },
      { value: 5, name: 'Neurologie' },
      { value: 6, name: 'Neurochirurgie' },
      { value: 7, name: 'Kardiologie' },
      { value: 8, name: 'Kardiochirurgie' },
      { value: 9, name: 'Grosskrankenhaus' }
    ]],
    [6, [
      ...numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      { value: 10, name: 'Diensthundestaffel' },
      { value: 11, name: 'Kriminalpolizei' },
      { value: 12, name: 'Dienstgruppenleitung' },
      { value: 13, name: 'Motorradstaffel' },
      { value: 14, name: 'Grosswache' },
      { value: 15, name: 'Grossgewahrsam' }
    ]],
    [19, [
      ...numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      { value: 10, name: 'Diensthundestaffel' },
      { value: 11, name: 'Kriminalpolizei' },
      { value: 12, name: 'Dienstgruppenleitung' },
      { value: 13, name: 'Motorradstaffel' },
      { value: 14, name: 'Grosswache' },
      { value: 15, name: 'Grossgewahrsam' }
    ]],
    [16, numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])],
    [11, [
      { value: 0, name: '2. Zug der Hundertschaft' },
      { value: 1, name: '3. Zug der Hundertschaft' },
      { value: 2, name: 'Sonderfahrzeug: Gefangenenkraftwagen' },
      { value: 3, name: 'Technischer Zug: Wasserwerfer' },
      { value: 4, name: 'SEK: 1. Zug' },
      { value: 5, name: 'SEK: 2. Zug' },
      { value: 6, name: 'MEK: 1. Zug' },
      { value: 7, name: 'MEK: 2. Zug' },
      { value: 8, name: 'Diensthundestaffel' },
      { value: 9, name: 'Reiterstaffel' },
      { value: 10, name: 'LauKW' }
    ]],
    [9, [
      { value: 0, name: '1. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung' },
      { value: 1, name: '1. Technischer Zug: Zugtrupp' },
      { value: 2, name: 'Fachgruppe Raeumen' },
      { value: 3, name: 'Fachgruppe Wassergefahren' },
      { value: 4, name: '2. Technischer Zug - Grundvoraussetzungen' },
      { value: 5, name: '2. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung' },
      { value: 6, name: '2. Technischer Zug: Zugtrupp' },
      { value: 7, name: 'Fachgruppe Ortung' },
      { value: 8, name: 'Fachgruppe Wasserschaden/Pumpen' },
      { value: 9, name: 'Fachgruppe schwere Bergung' },
      { value: 10, name: 'Fachgruppe Elektroversorgung' },
      { value: 11, name: 'Ortsverbands-Mannschaftstransportwagen' },
      { value: 12, name: 'Trupp Unbemannte Luftfahrtsysteme' },
      { value: 13, name: 'Fachzug Fuehrung und Kommunikation' },
      { value: 14, name: 'Fachgruppe Logistik-Verpflegung' }
    ]],
    [12, [
      { value: 0, name: 'Fuehrung' },
      { value: 1, name: 'Sanitaetsdienst' },
      { value: 2, name: 'Wasserrettungs-Erweiterung' },
      { value: 3, name: 'Rettungshundestaffel' },
      { value: 4, name: 'SEG Drohne' },
      { value: 5, name: 'Betreuungs- und Verpflegungsdienst' },
      { value: 6, name: 'Technik und Sicherheit' }
    ]]
  ]);

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  function parseStoredArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function selectedIds(prefix, buildingType) {
    return parseStoredArray(
      await GM.getValue(`${prefix}${buildingType}`, '[]')
    ).map(Number).filter(Number.isInteger);
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
      extensions: Array.isArray(building.extensions)
        ? building.extensions.map(extension => ({
          ...extension,
          type_id: Number(extension.type_id),
          enabled: extension.enabled === true
        }))
        : []
    };
  }

  async function loadBuildings(dispatchCenterId) {
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
      )).map(normalizeBuilding).sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  async function extensionOptions() {
    const optionsByType = new Map();

    for (const buildingType of BUILDING_TYPES) {
      optionsByType.set(
        buildingType.id,
        new Map(
          (EXTENSIONS.get(buildingType.id) ?? [])
            .map(option => [Number(option.value), option])
        )
      );
    }

    if (typeof openDb !== 'function' || typeof updateBuildings !== 'function') {
      return optionsByType;
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      for (const rawBuilding of await getAllData(db, 'buildings')) {
        const building = normalizeBuilding(rawBuilding);
        const options = optionsByType.get(building.building_type);

        if (!options) {
          continue;
        }

        for (const extension of building.extensions) {
          if (!Number.isInteger(extension.type_id)) {
            continue;
          }

          if (!options.has(extension.type_id)) {
            options.set(extension.type_id, {
              value: extension.type_id,
              name:
                extension.caption ||
                `Erweiterung ${extension.type_id}`
            });
          }
        }
      }
    } catch (error) {
      console.warn(
        '[De-/Activate Extensions] API-Erweiterungen konnten nicht geladen werden:',
        error
      );
    } finally {
      db.close();
    }

    return optionsByType;
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    const optionsByType = await extensionOptions();
    const visibleBuildingTypes = BUILDING_TYPES.filter(
      buildingType => optionsByType.get(buildingType.id)?.size
    );
    const settings = [{ type: 'header', text: 'Erweiterungen aktivieren' }];

    for (const buildingType of visibleBuildingTypes) {
      settings.push({
        type: 'select',
        key: `${ACTIVATE_PREFIX}${buildingType.id}`,
        label: `${buildingType.id} ${buildingType.name}`,
        title: 'Zu aktivierende Erweiterungen',
        multiple: true,
        options: [...optionsByType.get(buildingType.id).values()]
          .sort((a, b) => Number(a.value) - Number(b.value))
      });
    }

    settings.push({ type: 'header', text: 'Erweiterungen deaktivieren' });

    for (const buildingType of visibleBuildingTypes) {
      settings.push({
        type: 'select',
        key: `${DEACTIVATE_PREFIX}${buildingType.id}`,
        label: `${buildingType.id} ${buildingType.name}`,
        title: 'Zu deaktivierende Erweiterungen',
        multiple: true,
        options: [...optionsByType.get(buildingType.id).values()]
          .sort((a, b) => Number(a.value) - Number(b.value))
      });
    }

    settings.push(
      { type: 'header', text: 'Ablauf' },
      {
        type: 'number',
        key: ACTION_DELAY_KEY,
        label: 'Pause nach einer Umschaltung [ms]',
        min: 0,
        max: 5_000,
        default: DEFAULT_ACTION_DELAY
      },
      {
        type: 'number',
        key: BUILDING_DELAY_KEY,
        label: 'Pause nach einem Gebaeude [ms]',
        min: 0,
        max: 5_000,
        default: DEFAULT_BUILDING_DELAY
      }
    );

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'De-/Activate Extensions',
      settings
    });
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  }

  async function toggleUrls(buildingId) {
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
    const urls = new Map();

    for (const link of documentFromResponse.querySelectorAll(
      'a[href*="/extension_ready/"]'
    )) {
      const href = link.getAttribute('href') ?? '';
      const match = href.match(/\/extension_ready\/(\d+)/);

      if (match) {
        urls.set(Number(match[1]), new URL(href, location.origin).href);
      }
    }

    return urls;
  }

  async function toggleExtension(url) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        _method: 'post',
        authenticity_token: token
      }),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Umschaltung HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-ae-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-ae-style';
    style.textContent = `
      #nilspe-ae-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-ae-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-ae-success {
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
      #nilspe-ae-errors {
        height: 100%;
        width: 0;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-ae-progress';
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
    status.id = 'nilspe-ae-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-ae-track';
    const success = document.createElement('div');
    success.id = 'nilspe-ae-success';
    const errors = document.createElement('div');
    errors.id = 'nilspe-ae-errors';
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
    const status = document.getElementById('nilspe-ae-status');
    const successBar = document.getElementById('nilspe-ae-success');
    const errorBar = document.getElementById('nilspe-ae-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    successBar.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function configurationFor(building, desiredState) {
    const prefix = desiredState ? ACTIVATE_PREFIX : DEACTIVATE_PREFIX;
    const selected = new Set(await selectedIds(prefix, building.building_type));

    return building.extensions.filter(extension =>
      selected.has(extension.type_id) &&
      extension.available !== false &&
      extension.enabled !== desiredState
    );
  }

  async function processBuilding(building, desiredState, actionDelay) {
    const extensions = await configurationFor(building, desiredState);

    if (extensions.length === 0) {
      return 0;
    }

    const urls = await toggleUrls(building.id);
    let changed = 0;

    for (const extension of extensions) {
      if (!running) {
        break;
      }

      const url = urls.get(extension.type_id);

      if (!url) {
        console.warn(
          '[De-/Activate Extensions] Keine Umschalt-URL:',
          building.id,
          extension.type_id
        );
        continue;
      }

      await toggleExtension(url);
      changed++;
      await sleep(actionDelay);
    }

    return changed;
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
      const actionDelay = Math.max(
        0,
        Number(await GM.getValue(ACTION_DELAY_KEY, DEFAULT_ACTION_DELAY))
      );
      const buildingDelay = Math.max(
        0,
        Number(await GM.getValue(BUILDING_DELAY_KEY, DEFAULT_BUILDING_DELAY))
      );
      setProgress('Gebaeude werden geladen ...');
      const buildings = await loadBuildings(dispatchCenterId);
      const relevant = [];

      for (const building of buildings) {
        if ((await configurationFor(building, desiredState)).length > 0) {
          relevant.push(building);
        }
      }

      if (relevant.length === 0) {
        setProgress('Keine Umschaltung erforderlich', 0, 0, 0, 'success');
        return;
      }

      let completed = 0;
      let errors = 0;
      let changed = 0;

      for (const building of relevant) {
        if (!running) {
          return;
        }

        setProgress(
          `${completed}/${relevant.length}: ${building.caption}`,
          completed,
          errors,
          relevant.length
        );

        try {
          changed += await processBuilding(
            building,
            desiredState,
            actionDelay
          );
        } catch (error) {
          errors++;
          console.error(
            '[De-/Activate Extensions] Gebaeude fehlgeschlagen:',
            building.id,
            error
          );
        }

        completed++;
        setProgress(
          `${completed}/${relevant.length} Gebaeude, ${changed} umgeschaltet`,
          completed,
          errors,
          relevant.length,
          errors ? 'warning' : 'success'
        );
        await sleep(buildingDelay);
      }

      setProgress(
        `Fertig: ${changed} umgeschaltet, ${errors} Fehler`,
        completed,
        errors,
        relevant.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[De-/Activate Extensions] Lauf fehlgeschlagen:', error);
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
      document.getElementById('nilspe-ae-buttons')
    ) {
      return;
    }

    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details) {
      return;
    }

    const term = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = 'Erweiterungen:';
    term.append(strong);
    const description = document.createElement('dd');
    const group = document.createElement('div');
    group.id = 'nilspe-ae-buttons';
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
