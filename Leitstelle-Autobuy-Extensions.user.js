// ==UserScript==
// @name         Leitstelle Autobuy Extensions
// @namespace    NilsPe.autobuy.extensions
// @version      1.1.1
// @description  Kauft konfigurierte Erweiterungen einzelner Gebaeude oder einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Extensions.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Extensions.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.7
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_autobuy_extensions';
  const EXTENSION_KEY_PREFIX = 'nilspe_abe_extensions_';
  const ACTION_DELAY_KEY = 'nilspe_abe_action_delay';
  const BUILDING_DELAY_KEY = 'nilspe_abe_building_delay';
  const DEFAULT_ACTION_DELAY = 150;
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
  ].map(([id, label]) => ({ id, label }));

  function numberedOptions(label, ids) {
    return ids.map((id, index) => ({
      value: id,
      name: `${label} ${index + 1}`
    }));
  }

  const KNOWN_EXTENSION_OPTIONS = new Map([
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
      { value: 13, name: 'Fachzug Fuehrung und Kommunikation' }
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

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function extensionKey(buildingType) {
    return `${EXTENSION_KEY_PREFIX}${buildingType}`;
  }

  function parseJsonArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function selectedExtensionIds(buildingType) {
    const stored = await GM.getValue(extensionKey(buildingType), '[]');
    return parseJsonArray(stored)
      .map(Number)
      .filter(Number.isInteger);
  }

  async function configuredDelays() {
    const action = Number(await GM.getValue(ACTION_DELAY_KEY, DEFAULT_ACTION_DELAY));
    const building = Number(await GM.getValue(BUILDING_DELAY_KEY, DEFAULT_BUILDING_DELAY));

    return {
      action: Number.isFinite(action) && action >= 0 ? action : DEFAULT_ACTION_DELAY,
      building: Number.isFinite(building) && building >= 0 ? building : DEFAULT_BUILDING_DELAY
    };
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
      extensions: Array.isArray(building.extensions) ? building.extensions : []
    };
  }

  async function openCurrentBuildingCache(maxAge = 60) {
    if (typeof openDb !== 'function' || typeof updateBuildings !== 'function') {
      throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
    }

    const db = await openDb();

    try {
      const updated = await updateBuildings(db, maxAge);
      const count = await getCount(db, 'buildings');

      if (updated === false && count === 0) {
        throw new Error('Gebaeude-API konnte nicht geladen werden.');
      }

      return db;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  async function extensionOptionsByBuildingType() {
    const db = await openCurrentBuildingCache();

    try {
      const buildings = (await getAllData(db, 'buildings')).map(normalizeBuilding);
      const optionsByType = new Map();

      for (const building of buildings) {
        if (!optionsByType.has(building.building_type)) {
          optionsByType.set(building.building_type, new Map());
        }

        const options = optionsByType.get(building.building_type);

        for (const extension of building.extensions) {
          const id = Number(extension.type_id);

          if (Number.isInteger(id) && !options.has(id)) {
            options.set(id, {
              value: id,
              name: extension.caption || `Erweiterung ${id}`
            });
          }
        }
      }

      return new Map(
        [...optionsByType].map(([type, options]) => [
          type,
          [...options.values()].sort((a, b) =>
            a.name.localeCompare(b.name, 'de')
          )
        ])
      );
    } finally {
      db.close();
    }
  }

  function mergedExtensionOptions(buildingType, discoveredOptions) {
    const merged = new Map();

    for (const option of KNOWN_EXTENSION_OPTIONS.get(buildingType) ?? []) {
      merged.set(Number(option.value), option);
    }

    for (const option of discoveredOptions) {
      const id = Number(option.value);

      if (!merged.has(id)) {
        merged.set(id, option);
      }
    }

    return [...merged.values()].sort((a, b) =>
      Number(a.value) - Number(b.value)
    );
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      const warning = document.createElement('div');
      warning.className = 'alert alert-danger';
      warning.textContent = 'Autobuy Extensions: NilsPe-Skriptbasis fehlt.';
      (document.querySelector('.container') ?? document.body).prepend(warning);
      return;
    }

    let optionsByType = new Map();

    try {
      optionsByType = await extensionOptionsByBuildingType();
    } catch (error) {
      console.error('[Autobuy Extensions] Erweiterungen konnten nicht geladen werden:', error);
    }

    const settings = [
      {
        type: 'header',
        text: 'Erweiterungen je Gebaeudetyp'
      }
    ];

    for (const buildingType of BUILDING_TYPES) {
      const discoveredOptions = optionsByType.get(buildingType.id) ?? [];
      const mergedOptions = mergedExtensionOptions(
        buildingType.id,
        discoveredOptions
      );
      const options = mergedOptions.length > 0
        ? mergedOptions
        : [{
            value: '',
            name: 'Keine Erweiterungen aus API bekannt',
            disabled: true
          }];

      settings.push({
        type: 'select',
        key: extensionKey(buildingType.id),
        label: `${buildingType.id} ${buildingType.label}`,
        title: mergedOptions.length > 0
          ? 'Zu kaufende Erweiterungen'
          : 'Keine Erweiterungsdaten vorhanden',
        multiple: true,
        options
      });
    }

    settings.push(
      { type: 'header', text: 'Ablauf' },
      {
        type: 'number',
        key: ACTION_DELAY_KEY,
        label: 'Pause nach einem Kauf [ms]',
        default: DEFAULT_ACTION_DELAY,
        min: 0,
        max: 5_000
      },
      {
        type: 'number',
        key: BUILDING_DELAY_KEY,
        label: 'Pause nach einem Gebaeude [ms]',
        default: DEFAULT_BUILDING_DELAY,
        min: 0,
        max: 5_000
      }
    );

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Autobuy Extensions',
      settings
    });
  }

  function buildingIdFromLocation() {
    const match = location.pathname.match(/^\/buildings\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  }

  async function buildingById(buildingId) {
    const db = await openCurrentBuildingCache();

    try {
      const building = await getData(db, 'buildings', Number(buildingId));
      return building ? normalizeBuilding(building) : null;
    } finally {
      db.close();
    }
  }

  async function buildingsForDispatchCenter(dispatchCenterId) {
    const targetId = Number(dispatchCenterId);
    const db = await openCurrentBuildingCache();
    let buildings;

    try {
      buildings = await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        IDBKeyRange.only(targetId)
      );

      if (buildings.length === 0) {
        buildings = (await getAllData(db, 'buildings'))
          .map(normalizeBuilding)
          .filter(building => building.leitstelle_building_id === targetId);
      }
    } finally {
      db.close();
    }

    return buildings.map(normalizeBuilding).sort((a, b) => a.id - b.id);
  }

  async function availableExtensionPurchases(buildingId) {
    const response = await fetch(`/buildings/${buildingId}`, {
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`Gebaeudeseite: HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const purchases = new Map();

    for (const link of documentFromResponse.querySelectorAll(
      'a[href*="/extension/credits/"]'
    )) {
      const href = link.getAttribute('href') ?? '';
      const idMatch = href.match(/\/extension\/credits\/(\d+)/);

      if (idMatch) {
        purchases.set(Number(idMatch[1]), new URL(href, location.origin).href);
      }
    }

    return purchases;
  }

  async function buyExtension(url) {
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
      throw new Error(`Kauf: HTTP ${response.status}`);
    }
  }

  async function processBuilding(building, actionDelay) {
    const selected = await selectedExtensionIds(building.building_type);

    if (selected.length === 0) {
      return { bought: 0, skipped: true };
    }

    let purchases = await availableExtensionPurchases(building.id);
    let bought = 0;

    for (const extensionId of selected) {
      const purchaseUrl = purchases.get(extensionId);

      if (!purchaseUrl) {
        continue;
      }

      await buyExtension(purchaseUrl);
      bought++;
      await sleep(actionDelay);

      // A purchase may unlock the next extension.
      purchases = await availableExtensionPurchases(building.id);
    }

    return { bought, skipped: false };
  }

  function ensureProgressBar() {
    if (document.getElementById('nilspe-abe-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-abe-style';
    style.textContent = `
      #nilspe-abe-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-abe-track {
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-abe-fill {
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-abe-progress';
    const status = document.createElement('span');
    status.id = 'nilspe-abe-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-abe-track';
    const fill = document.createElement('div');
    fill.id = 'nilspe-abe-fill';
    track.append(fill);
    container.append(status, track);
    document.body.append(container);
  }

  function setProgress(message, completed = 0, total = 0, style = 'info') {
    ensureProgressBar();
    const status = document.getElementById('nilspe-abe-status');
    const fill = document.getElementById('nilspe-abe-fill');
    status.className = `label label-${style}`;
    status.textContent = message;
    fill.style.width = total > 0 ? `${completed / total * 100}%` : '0%';
  }

  function removeProgressBar(delay = 1_500) {
    setTimeout(() => {
      document.getElementById('nilspe-abe-progress')?.remove();
      document.getElementById('nilspe-abe-style')?.remove();
    }, delay);
  }

  async function runForBuildings(buildings) {
    const delays = await configuredDelays();
    let completed = 0;
    let errors = 0;
    let totalBought = 0;

    for (const building of buildings) {
      setProgress(
        `${completed}/${buildings.length}: ${building.caption}`,
        completed,
        buildings.length
      );

      try {
        const result = await processBuilding(building, delays.action);
        totalBought += result.bought;
      } catch (error) {
        errors++;
        console.error(
          '[Autobuy Extensions] Fehler bei Gebaeude',
          building.id,
          building.caption,
          error
        );
      }

      completed++;
      setProgress(
        `${completed}/${buildings.length} Gebaeude, ${totalBought} gekauft`,
        completed,
        buildings.length,
        errors ? 'warning' : 'success'
      );
      await sleep(delays.building);
    }

    setProgress(
      `Fertig: ${totalBought} Erweiterungen gekauft, ${errors} Fehler`,
      completed,
      buildings.length,
      errors ? 'warning' : 'success'
    );
    removeProgressBar();
  }

  function settingsButton() {
    const button = document.createElement('a');
    button.className = 'btn btn-default btn-xs';
    button.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
    button.target = '_blank';
    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';
    icon.title = 'Einstellungen';
    button.append(icon);
    return button;
  }

  function appendDetailButtons(labelText, buttonId, run) {
    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details || document.getElementById(buttonId)) {
      return;
    }

    const label = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = labelText;
    label.append(strong);

    const value = document.createElement('dd');
    const group = document.createElement('div');
    group.id = buttonId;
    group.className = 'btn-group';
    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'btn btn-default btn-xs';
    runButton.textContent = 'Autobuy Extensions';
    runButton.addEventListener('click', async () => {
      runButton.disabled = true;

      try {
        await run();
      } finally {
        runButton.disabled = false;
      }
    });

    group.append(runButton, settingsButton());
    value.append(group);
    details.append(label, value);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
    return;
  }

  const heading = document.querySelector('h1[building_type]');
  const buildingId = buildingIdFromLocation();

  if (!heading || !buildingId) {
    return;
  }

  const buildingType = Number(heading.getAttribute('building_type'));

  if (buildingType === 7) {
    appendDetailButtons(
      'Erweiterungen kaufen:',
      'nilspe-abe-dispatch-buttons',
      async () => {
        setProgress('Lade Gebaeude...');
        const buildings = await buildingsForDispatchCenter(buildingId);

        if (buildings.length === 0) {
          setProgress('Keine zugeordneten Gebaeude gefunden', 0, 0, 'warning');
          return;
        }

        await runForBuildings(buildings);
      }
    );
    return;
  }

  appendDetailButtons(
    'Erweiterungen kaufen:',
    'nilspe-abe-building-buttons',
    async () => {
      const building = await buildingById(buildingId);

      if (!building) {
        setProgress('Gebaeude nicht im API-Cache gefunden', 0, 0, 'danger');
        return;
      }

      await runForBuildings([building]);
    }
  );
})();
