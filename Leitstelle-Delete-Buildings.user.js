// ==UserScript==
// @name         Leitstelle Delete Buildings
// @namespace    NilsPe.delete.buildings
// @version      1.0.2
// @description  Markiert und loescht konfigurierte Gebaeude einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Delete-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Delete-Buildings.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_delete_buildings';
  const KEYS = {
    buildingTypes: 'nilspe_delete_building_types',
    everyNth: 'nilspe_delete_building_every_nth',
    startAt: 'nilspe_delete_building_start_at',
    requestDelay: 'nilspe_delete_building_delay',
    concurrency: 'nilspe_delete_building_concurrency'
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

  const TYPE_NAMES = new Map(
    BUILDING_TYPES.map(type => [Number(type.value), type.name])
  );

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  function parseArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : [];
    } catch {
      return [];
    }
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Delete Buildings',
      settings: [
        { type: 'header', text: 'Gebaeudeauswahl' },
        {
          type: 'select',
          key: KEYS.buildingTypes,
          label: 'Zu loeschende Gebaeudetypen',
          title: 'Gebaeudetypen auswaehlen',
          multiple: true,
          options: BUILDING_TYPES
        },
        {
          type: 'number',
          key: KEYS.everyNth,
          label: 'Nur jedes N-te Gebaeude je Typ',
          info: '1 = alle passenden Gebaeude',
          min: 1,
          max: 1_000,
          default: 1
        },
        {
          type: 'number',
          key: KEYS.startAt,
          label: 'Startposition je Typ',
          info: 'Beispiel: N = 2 und Start = 2 loescht Position 2, 4, 6 ...',
          min: 1,
          max: 1_000,
          default: 1
        },
        { type: 'header', text: 'Ablauf' },
        {
          type: 'number',
          key: KEYS.requestDelay,
          label: 'Pause je Worker [ms]',
          min: 100,
          max: 5_000,
          default: 150
        },
        {
          type: 'number',
          key: KEYS.concurrency,
          label: 'Parallele Loeschanfragen',
          min: 1,
          max: 3,
          default: 3
        }
      ]
    });
  }

  async function configuration() {
    const everyNth = Math.max(
      1,
      Number(await GM.getValue(KEYS.everyNth, 1)) || 1
    );

    return {
      types: new Set(parseArray(await GM.getValue(KEYS.buildingTypes, '[]'))),
      everyNth,
      startAt: Math.max(
        1,
        Math.min(
          everyNth,
          Number(await GM.getValue(KEYS.startAt, 1)) || 1
        )
      ),
      requestDelay: Math.max(
        100,
        Number(await GM.getValue(KEYS.requestDelay, 150)) || 150
      ),
      concurrency: Math.max(
        1,
        Math.min(
          3,
          Number(await GM.getValue(KEYS.concurrency, 3)) || 3
        )
      )
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
      caption: building.caption || building.name || `Gebaeude ${building.id}`
    };
  }

  async function loadBuildings(dispatchCenterId, selectedTypes) {
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
        .filter(building => selectedTypes.has(building.building_type))
        .sort((a, b) =>
          a.building_type - b.building_type || a.id - b.id
        );
    } finally {
      db.close();
    }
  }

  function selectBuildings(buildings, config) {
    const groups = new Map();

    for (const building of buildings) {
      if (!groups.has(building.building_type)) {
        groups.set(building.building_type, []);
      }

      groups.get(building.building_type).push(building);
    }

    const selected = [];

    for (const group of groups.values()) {
      group.sort((a, b) => a.id - b.id);

      for (let index = config.startAt - 1; index < group.length; index += config.everyNth) {
        selected.push(group[index]);
      }
    }

    return selected;
  }

  function buildingTable() {
    return document.getElementById('building_table') ??
      document.querySelector('#tab_buildings table');
  }

  function visibleBuildingRows() {
    return Array.from(buildingTable()?.tBodies?.[0]?.rows ?? []);
  }

  function rowBuildingId(row) {
    const link = row.querySelector(
      'a[building_type][href*="/buildings/"], ' +
      'a[data-building-type][href*="/buildings/"], ' +
      'td:nth-child(2) a[href*="/buildings/"]'
    );
    return Number(link?.getAttribute('href')?.match(/\/buildings\/(\d+)/)?.[1]);
  }

  function clearPreview() {
    for (const row of document.querySelectorAll('.nilspe-delete-building-preview')) {
      row.classList.remove('nilspe-delete-building-preview');
      row.style.outline = '';
      row.style.background = '';
    }
  }

  function markVisibleBuildings(buildings) {
    clearPreview();
    const ids = new Set(buildings.map(building => building.id));

    for (const row of visibleBuildingRows()) {
      if (!ids.has(rowBuildingId(row))) {
        continue;
      }

      row.classList.add('nilspe-delete-building-preview');
      row.style.outline = '2px solid #d9534f';
      row.style.background = 'rgba(217, 83, 79, .12)';
    }
  }

  function countSummary(buildings) {
    const counts = new Map();

    for (const building of buildings) {
      counts.set(
        building.building_type,
        (counts.get(building.building_type) ?? 0) + 1
      );
    }

    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([type, count]) => `${TYPE_NAMES.get(type) ?? `Typ ${type}`}: ${count}`)
      .join('\n');
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ??
      document.querySelector('input[name="authenticity_token"]')?.value ??
      '';
  }

  async function deleteBuilding(id) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const response = await fetch(`/buildings/${id}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        _method: 'delete',
        authenticity_token: token
      }),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Loeschen HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-delete-building-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-delete-building-style';
    style.textContent = `
      #nilspe-delete-building-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-delete-building-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-delete-building-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
      #nilspe-delete-building-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-delete-building-progress';
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
    status.id = 'nilspe-delete-building-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-delete-building-track';
    const success = document.createElement('div');
    success.id = 'nilspe-delete-building-success';
    const errors = document.createElement('div');
    errors.id = 'nilspe-delete-building-errors';
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
    const status = document.getElementById('nilspe-delete-building-status');
    const success = document.getElementById('nilspe-delete-building-success');
    const errorBar = document.getElementById('nilspe-delete-building-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    success.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function selection() {
    const config = await configuration();

    if (config.types.size === 0) {
      throw new Error('Keine Gebaeudetypen ausgewaehlt.');
    }

    const dispatchCenterId = Number(
      location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
    );
    const buildings = await loadBuildings(dispatchCenterId, config.types);
    return {
      config,
      buildings: selectBuildings(buildings, config)
    };
  }

  async function preview() {
    try {
      setProgress('Gebaeude werden aus dem API-Cache geladen ...');
      const { buildings } = await selection();
      markVisibleBuildings(buildings);
      setProgress(
        `Vorschau: ${buildings.length} Gebaeude, sichtbare Treffer rot markiert`,
        0,
        0,
        0,
        buildings.length ? 'warning' : 'success'
      );
    } catch (error) {
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 0, 'danger');
    }
  }

  async function run(buttons) {
    if (running) {
      return;
    }

    try {
      setProgress('Gebaeude werden aus dem API-Cache geladen ...');
      const { config, buildings } = await selection();

      if (buildings.length === 0) {
        setProgress('Keine passenden Gebaeude gefunden', 0, 0, 0, 'success');
        return;
      }

      markVisibleBuildings(buildings);
      const phrase = `LOESCHEN ${buildings.length}`;
      const confirmation = globalThis.prompt(
        `${buildings.length} Gebaeude werden endgueltig ohne Erstattung geloescht.\n\n` +
        `${countSummary(buildings)}\n\n` +
        `Zum Bestaetigen exakt eingeben: ${phrase}`
      );

      if (confirmation !== phrase) {
        setProgress('Loeschen nicht bestaetigt', 0, 0, 0, 'warning');
        return;
      }

      running = true;
      buttons.forEach(button => {
        button.disabled = true;
      });
      let nextIndex = 0;
      let completed = 0;
      let errors = 0;

      async function worker() {
        while (running) {
          const index = nextIndex++;

          if (index >= buildings.length) {
            return;
          }

          const building = buildings[index];

          try {
            await deleteBuilding(building.id);
            visibleBuildingRows()
              .find(row => rowBuildingId(row) === building.id)
              ?.remove();
          } catch (error) {
            errors++;
            console.error(
              '[Leitstelle Delete Buildings] Gebaeude fehlgeschlagen:',
              building.id,
              error
            );
          }

          completed++;
          setProgress(
            `${completed}/${buildings.length} Gebaeude bearbeitet`,
            completed,
            errors,
            buildings.length,
            errors ? 'warning' : 'success'
          );
          await sleep(config.requestDelay);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(config.concurrency, buildings.length) },
          worker
        )
      );

      if (!running) {
        return;
      }

      clearPreview();
      setProgress(
        `Fertig: ${completed - errors} geloescht, ${errors} Fehler`,
        completed,
        errors,
        buildings.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[Leitstelle Delete Buildings] Lauf fehlgeschlagen:', error);
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 0, 'danger');
    } finally {
      running = false;
      buttons.forEach(button => {
        button.disabled = false;
      });
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
      document.getElementById('nilspe-delete-building-buttons')
    ) {
      return;
    }

    const table = buildingTable();

    if (!table) {
      return;
    }

    const group = document.createElement('div');
    group.id = 'nilspe-delete-building-buttons';
    group.className = 'btn-group';
    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'btn btn-default btn-xs';
    previewButton.textContent = 'Loeschvorschau';
    previewButton.addEventListener('click', preview);
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-danger btn-xs';
    deleteButton.textContent = 'Gebaeude loeschen';
    const buttons = [previewButton, deleteButton];
    deleteButton.addEventListener('click', () => run(buttons));
    group.append(previewButton, deleteButton, settingsButton());

    const row = document.createElement('div');
    row.id = 'nilspe-delete-building-button-row';
    row.style.display = 'block';
    row.style.width = '100%';
    row.style.margin = '0';
    row.append(group);
    table.parentElement?.insertBefore(row, table);
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
