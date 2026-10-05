// ==UserScript==
// @name         Leitstelle Rename Buildings
// @namespace    NilsPe.rename.buildings
// @version      1.0.0
// @description  Benennt Gebaeude einer Leitstelle nach Typ, Namens-Suffix und fortlaufender Nummer um
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Rename-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Rename-Buildings.user.js
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

  // ============================================================
  // Einstellungen
  // ============================================================

  const SETTINGS_IDENTIFIER = 'nilspe_rename_buildings';

  const KEYS = {
    startNumber: 'nilspe_rename_buildings_start_number',
    digits: 'nilspe_rename_buildings_digits',
    suffix: 'nilspe_rename_buildings_suffix',
    concurrency: 'nilspe_rename_buildings_concurrency',
    requestDelay: 'nilspe_rename_buildings_request_delay'
  };

  // ============================================================
  // Gebaeudetypen
  //
  // defaultName ist nur der voreingestellte Name.
  // Ein leeres Feld bedeutet: Typ wird nicht umbenannt.
  // ============================================================

  const BUILDING_TYPES = [
    { id: 0,  name: 'Feuerwache',                         defaultName: 'Feuerwache' },
    { id: 2,  name: 'Rettungswache',                      defaultName: 'Rettungswache' },
    { id: 4,  name: 'Krankenhaus',                        defaultName: 'KH' },
    { id: 5,  name: 'Rettungshubschrauber-Station',       defaultName: 'RTH' },
    { id: 6,  name: 'Polizeiwache',                       defaultName: 'Polizeiwache' },
    { id: 9,  name: 'THW-Ortsverband',                    defaultName: 'THW' },
    { id: 11, name: 'Bereitschaftspolizei',               defaultName: 'Bepol' },
    { id: 12, name: 'Schnelleinsatzgruppe (SEG)',         defaultName: 'SEG' },
    { id: 13, name: 'Polizeihubschrauberstation',         defaultName: 'Polizeihubschrauber' },
    { id: 15, name: 'Wasserrettung',                       defaultName: 'Wasserrettung' },
    { id: 16, name: 'Verbandszellen',                     defaultName: 'JVA' },
    { id: 17, name: 'Polizei-Sondereinheiten',            defaultName: 'Sondereinheiten' },
    { id: 18, name: 'Feuerwache (Kleinwache)',            defaultName: 'Feuerwache' },
    { id: 19, name: 'Polizeiwache (Kleinwache)',          defaultName: 'Polizeiwache' },
    { id: 20, name: 'Rettungswache (Kleinwache)',         defaultName: 'Rettungswache' },
    { id: 21, name: 'Rettungshundestaffel',               defaultName: 'Rettungshunde' },
    { id: 24, name: 'Reiterstaffel',                       defaultName: 'Reiterstaffel' },
    { id: 25, name: 'Bergrettung',                         defaultName: 'Bergrettung' },
    { id: 26, name: 'Seenotrettungswache',                 defaultName: 'Seenotrettung' },
    { id: 28, name: 'Hubschrauberstation (Seenotrettung)', defaultName: 'Seenotrettung RTH' }
  ];

  for (const type of BUILDING_TYPES) {
    type.key = `nilspe_rename_buildings_type_${type.id}`;
  }

  const TYPE_MAP = new Map(
    BUILDING_TYPES.map(type => [type.id, type])
  );

  // ============================================================
  // Status
  // ============================================================

  let running = false;

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  // ============================================================
  // Einstellungen erstellen
  // ============================================================

  async function initializeDefaults() {
    for (const type of BUILDING_TYPES) {
      const stored = await GM.getValue(type.key, null);

      if (stored === null) {
        await GM.setValue(type.key, type.defaultName);
      }
    }
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await initializeDefaults();

    const settings = [
      {
        type: 'header',
        text: 'Benamung'
      },
      {
        type: 'number',
        key: KEYS.startNumber,
        label: 'Startnummer',
        info: 'Erste Nummer je Gebaeudetyp.',
        min: 0,
        max: 999999,
        default: 1
      },
      {
        type: 'number',
        key: KEYS.digits,
        label: 'Nummerierung',
        info: 'Anzahl Stellen. Beispiel: 3 = 001, 002, 003 ...',
        min: 1,
        max: 10,
        default: 3
      },
      {
        type: 'text',
        key: KEYS.suffix,
        label: 'Namens-Suffix',
        info: 'Zum Beispiel Berlin, NRW, Koeln oder Madrid.',
        default: ''
      },

      {
        type: 'header',
        text: 'Wachentypen'
      }
    ];

    for (const type of BUILDING_TYPES) {
      settings.push({
        type: 'text',
        key: type.key,
        label: `${type.id} ${type.name}`,
        info: 'Leer lassen, wenn dieser Gebaeudetyp nicht umbenannt werden soll.',
        default: type.defaultName
      });
    }

    settings.push(
      {
        type: 'header',
        text: 'Ablauf'
      },
      {
        type: 'number',
        key: KEYS.concurrency,
        label: 'Parallele Umbenennungen',
        min: 1,
        max: 5,
        default: 3
      },
      {
        type: 'number',
        key: KEYS.requestDelay,
        label: 'Pause je Worker [ms]',
        min: 0,
        max: 5000,
        default: 150
      }
    );

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Rename Buildings',
      settings
    });
  }

  // ============================================================
  // Konfiguration
  // ============================================================

  async function configuration() {
    const startNumber = Math.max(
      0,
      Number(await GM.getValue(KEYS.startNumber, 1)) || 0
    );

    const digits = Math.max(
      1,
      Math.min(
        10,
        Number(await GM.getValue(KEYS.digits, 3)) || 3
      )
    );

    const suffix = String(
      await GM.getValue(KEYS.suffix, '')
    ).trim();

    const concurrency = Math.max(
      1,
      Math.min(
        5,
        Number(await GM.getValue(KEYS.concurrency, 3)) || 3
      )
    );

    const requestDelay = Math.max(
      0,
      Number(await GM.getValue(KEYS.requestDelay, 150)) || 0
    );

    const typeNames = new Map();

    for (const type of BUILDING_TYPES) {
      const name = String(
        await GM.getValue(type.key, type.defaultName)
      ).trim();

      if (name) {
        typeNames.set(type.id, name);
      }
    }

    return {
      startNumber,
      digits,
      suffix,
      concurrency,
      requestDelay,
      typeNames
    };
  }

  // ============================================================
  // Gebaeude
  // ============================================================

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
        dispatchCenterId == null
          ? null
          : Number(dispatchCenterId),
      caption:
        building.caption ||
        building.name ||
        `Gebaeude ${building.id}`
    };
  }

  async function loadBuildings(dispatchCenterId) {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function'
    ) {
      throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      return (
        await getDataByIndex(
          db,
          'buildings',
          'leitstelle_building_id',
          Number(dispatchCenterId)
        )
      )
        .map(normalizeBuilding)
        .sort((a, b) =>
          a.building_type - b.building_type ||
          a.id - b.id
        );
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Neue Namen berechnen
  // ============================================================

  function formatNumber(number, digits) {
    return String(number).padStart(digits, '0');
  }

  function buildName(typeName, suffix, number, digits) {
    return [
      typeName,
      suffix,
      formatNumber(number, digits)
    ]
      .filter(part => String(part).trim() !== '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createRenamePlan(buildings, config) {
    const groups = new Map();

    // Nur konfigurierte Gebaeudetypen aufnehmen
    for (const building of buildings) {
      if (!config.typeNames.has(building.building_type)) {
        continue;
      }

      if (!groups.has(building.building_type)) {
        groups.set(building.building_type, []);
      }

      groups.get(building.building_type).push(building);
    }

    const plan = [];

    for (const [buildingType, group] of groups) {
      // Wichtig:
      // Innerhalb jedes Typs entscheidet ausschliesslich die Building-ID
      // ueber die Reihenfolge.
      group.sort((a, b) => a.id - b.id);

      const typeName = config.typeNames.get(buildingType);

      group.forEach((building, index) => {
        const number = config.startNumber + index;

        const newName = buildName(
          typeName,
          config.suffix,
          number,
          config.digits
        );

        plan.push({
          id: building.id,
          buildingType,
          typeLabel:
            TYPE_MAP.get(buildingType)?.name ??
            `Typ ${buildingType}`,
          oldName: building.caption,
          newName,
          number,
          changed: building.caption !== newName
        });
      });
    }

    return plan.sort((a, b) =>
      a.buildingType - b.buildingType ||
      a.id - b.id
    );
  }

  // ============================================================
  // CSRF / Request
  // ============================================================

  function csrfToken() {
    return (
      document.querySelector('meta[name="csrf-token"]')?.content ??
      document.querySelector(
        'input[name="authenticity_token"]'
      )?.value ??
      ''
    );
  }

  async function renameBuilding(buildingId, newName) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const response = await fetch(`/buildings/${buildingId}`, {
      method: 'POST',
      credentials: 'same-origin',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'text/html'
      },

      body: new URLSearchParams({
        _method: 'patch',
        authenticity_token: token,
        'building[name]': newName,
        commit: 'Speichern'
      }),

      // Das Spiel antwortet nach erfolgreichem Speichern mit 302.
      // Wir wollen nicht fuer jede Wache noch die Zielseite laden.
      redirect: 'manual'
    });

    /*
     * Bei redirect:'manual' liefert Fetch fuer den 302-Redirect
     * normalerweise eine opaqueredirect-Response mit Status 0.
     *
     * HTTP-Fehler wie 422/500 bleiben dagegen erkennbar.
     */
    if (
      response.type !== 'opaqueredirect' &&
      response.status !== 0 &&
      !response.ok &&
      response.status !== 302
    ) {
      throw new Error(
        `Umbenennung HTTP ${response.status}`
      );
    }
  }

  // ============================================================
  // Cache nach dem Lauf aktualisieren
  // ============================================================

  async function refreshBuildingCache() {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function'
    ) {
      return;
    }

    const db = await openDb();

    try {
      // maxAge 0 erzwingt eine Aktualisierung.
      // Durch den V2-Inkrementalsync sollten nur geaenderte
      // Gebaeude nachgeladen werden.
      await updateBuildings(db, 0);
    } finally {
      db.close();
    }
  }

  // ============================================================
  // Fortschrittsanzeige
  // ============================================================

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-rename-building-progress'
      )
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-rename-building-style';

    style.textContent = `
      #nilspe-rename-building-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
        color: #333;
      }

      #nilspe-rename-building-progress-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #nilspe-rename-building-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-rename-building-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-rename-building-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }

      body.dark #nilspe-rename-building-progress,
      body.dark-mode #nilspe-rename-building-progress {
        background: #222;
        color: #eee;
        border-color: #444;
      }


      /* Vorschau */

      #nilspe-rename-preview-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483001;
        background: rgba(0, 0, 0, .55);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      #nilspe-rename-preview {
        width: min(1200px, 96vw);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        background: #fff;
        color: #333;
        border-radius: 6px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, .35);
        overflow: hidden;
      }

      #nilspe-rename-preview-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 15px;
        border-bottom: 1px solid #ddd;
      }

      #nilspe-rename-preview-header h3 {
        margin: 0;
        flex: 1;
      }

      #nilspe-rename-preview-summary {
        padding: 10px 15px;
        border-bottom: 1px solid #ddd;
      }

      #nilspe-rename-preview-table-wrapper {
        overflow: auto;
        flex: 1 1 auto;
      }

      #nilspe-rename-preview table {
        margin: 0;
      }

      #nilspe-rename-preview th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #f5f5f5;
      }

      #nilspe-rename-preview td,
      #nilspe-rename-preview th {
        white-space: nowrap;
      }

      #nilspe-rename-preview .nilspe-rename-changed {
        font-weight: bold;
      }

      #nilspe-rename-preview-footer {
        padding: 10px 15px;
        border-top: 1px solid #ddd;
        text-align: right;
      }

      body.dark #nilspe-rename-preview,
      body.dark-mode #nilspe-rename-preview {
        background: #222;
        color: #eee;
      }

      body.dark #nilspe-rename-preview th,
      body.dark-mode #nilspe-rename-preview th {
        background: #333;
      }

      body.dark #nilspe-rename-preview-header,
      body.dark #nilspe-rename-preview-summary,
      body.dark #nilspe-rename-preview-footer,
      body.dark-mode #nilspe-rename-preview-header,
      body.dark-mode #nilspe-rename-preview-summary,
      body.dark-mode #nilspe-rename-preview-footer {
        border-color: #444;
      }
    `;

    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-rename-building-progress';

    const row = document.createElement('div');
    row.id = 'nilspe-rename-building-progress-row';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-default btn-xs';
    cancel.textContent = 'Abbrechen';

    cancel.addEventListener('click', () => {
      running = false;

      setProgress(
        'Abgebrochen',
        0,
        0,
        0,
        'danger'
      );
    });

    const status = document.createElement('span');
    status.id = 'nilspe-rename-building-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';

    const track = document.createElement('div');
    track.id = 'nilspe-rename-building-track';

    const success = document.createElement('div');
    success.id = 'nilspe-rename-building-success';

    const errors = document.createElement('div');
    errors.id = 'nilspe-rename-building-errors';

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

    const status = document.getElementById(
      'nilspe-rename-building-status'
    );

    const success = document.getElementById(
      'nilspe-rename-building-success'
    );

    const errorBar = document.getElementById(
      'nilspe-rename-building-errors'
    );

    const safeTotal = Math.max(total, 1);

    status.className = `label label-${type}`;
    status.textContent = message;

    success.style.width =
      `${Math.max(0, completed - errors) / safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  // ============================================================
  // Auswahl / Plan
  // ============================================================

  function currentDispatchCenterId() {
    return Number(
      location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
    );
  }

  async function selection() {
    const dispatchCenterId = currentDispatchCenterId();

    if (
      !Number.isInteger(dispatchCenterId) ||
      dispatchCenterId <= 0
    ) {
      throw new Error(
        'Leitstellen-ID konnte nicht ermittelt werden.'
      );
    }

    const config = await configuration();

    if (config.typeNames.size === 0) {
      throw new Error(
        'Kein Wachentyp fuer die Umbenennung konfiguriert.'
      );
    }

    setProgress(
      'Gebaeude werden aus dem API-Cache geladen ...'
    );

    const buildings = await loadBuildings(
      dispatchCenterId
    );

    const plan = createRenamePlan(
      buildings,
      config
    );

    return {
      config,
      buildings,
      plan
    };
  }

  // ============================================================
  // Vorschau
  // ============================================================

  function closePreview() {
    document.getElementById(
      'nilspe-rename-preview-backdrop'
    )?.remove();
  }

  function summaryByType(plan) {
    const summary = new Map();

    for (const item of plan) {
      if (!summary.has(item.buildingType)) {
        summary.set(item.buildingType, {
          typeLabel: item.typeLabel,
          total: 0,
          changed: 0
        });
      }

      const entry = summary.get(item.buildingType);
      entry.total++;

      if (item.changed) {
        entry.changed++;
      }
    }

    return [...summary.values()];
  }

  function showPreview(plan, config) {
    closePreview();
    ensureProgress();

    const changed = plan.filter(item => item.changed);
    const unchanged = plan.length - changed.length;

    const backdrop = document.createElement('div');
    backdrop.id = 'nilspe-rename-preview-backdrop';

    const modal = document.createElement('div');
    modal.id = 'nilspe-rename-preview';

    // Header
    const header = document.createElement('div');
    header.id = 'nilspe-rename-preview-header';

    const title = document.createElement('h3');
    title.textContent = 'Umbenennvorschau';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-default btn-sm';
    close.textContent = 'Schliessen';
    close.addEventListener('click', closePreview);

    header.append(title, close);

    // Summary
    const summary = document.createElement('div');
    summary.id = 'nilspe-rename-preview-summary';

    const headline = document.createElement('div');

    headline.innerHTML =
      `<strong>${plan.length.toLocaleString('de-DE')}</strong> ` +
      `Gebaeude beruecksichtigt &nbsp; | &nbsp; ` +
      `<strong>${changed.length.toLocaleString('de-DE')}</strong> ` +
      `werden geaendert &nbsp; | &nbsp; ` +
      `<strong>${unchanged.toLocaleString('de-DE')}</strong> ` +
      `sind bereits korrekt`;

    summary.append(headline);

    const configLine = document.createElement('div');
    configLine.style.marginTop = '6px';

    configLine.textContent =
      `Suffix: "${config.suffix}" | ` +
      `Start: ${config.startNumber} | ` +
      `Nummerierung: ${config.digits}`;

    summary.append(configLine);

    const perType = summaryByType(plan);

    if (perType.length) {
      const typeLine = document.createElement('div');
      typeLine.style.marginTop = '8px';

      typeLine.textContent = perType
        .map(entry =>
          `${entry.typeLabel}: ${entry.changed}/${entry.total}`
        )
        .join(' | ');

      summary.append(typeLine);
    }

    // Tabelle
    const wrapper = document.createElement('div');
    wrapper.id = 'nilspe-rename-preview-table-wrapper';

    const table = document.createElement('table');
    table.className =
      'table table-striped table-condensed table-hover';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    for (const text of [
      'Building-ID',
      'Typ',
      'Alter Name',
      'Neuer Name'
    ]) {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.append(th);
    }

    thead.append(headerRow);

    const tbody = document.createElement('tbody');

    /*
     * Damit auch bei vielen tausend Gebaeuden die Vorschau
     * fluessig bleibt, zeigen wir maximal 2000 geaenderte Namen.
     * Die komplette Umbenennung ist davon nicht betroffen.
     */
    const previewItems = changed.slice(0, 2000);

    for (const item of previewItems) {
      const row = document.createElement('tr');

      const id = document.createElement('td');
      id.textContent = item.id;

      const type = document.createElement('td');
      type.textContent = item.typeLabel;

      const oldName = document.createElement('td');
      oldName.textContent = item.oldName;

      const newName = document.createElement('td');
      newName.className = 'nilspe-rename-changed';
      newName.textContent = item.newName;

      row.append(
        id,
        type,
        oldName,
        newName
      );

      tbody.append(row);
    }

    table.append(thead, tbody);
    wrapper.append(table);

    if (changed.length > previewItems.length) {
      const note = document.createElement('div');
      note.className = 'alert alert-info';
      note.style.margin = '10px';

      note.textContent =
        `Vorschau auf ${previewItems.length.toLocaleString('de-DE')} ` +
        `von ${changed.length.toLocaleString('de-DE')} Aenderungen begrenzt.`;

      wrapper.append(note);
    }

    // Footer
    const footer = document.createElement('div');
    footer.id = 'nilspe-rename-preview-footer';

    const closeBottom = document.createElement('button');
    closeBottom.type = 'button';
    closeBottom.className = 'btn btn-default';
    closeBottom.textContent = 'Schliessen';
    closeBottom.addEventListener('click', closePreview);

    footer.append(closeBottom);

    modal.append(
      header,
      summary,
      wrapper,
      footer
    );

    backdrop.append(modal);

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        closePreview();
      }
    });

    document.body.append(backdrop);
  }

  async function preview() {
    try {
      const {
        config,
        plan
      } = await selection();

      showPreview(plan, config);

      const changed =
        plan.filter(item => item.changed).length;

      setProgress(
        `Vorschau: ${changed.toLocaleString('de-DE')} Namen werden geaendert`,
        0,
        0,
        0,
        changed ? 'warning' : 'success'
      );
    } catch (error) {
      console.error(
        '[Rename Buildings] Vorschau fehlgeschlagen:',
        error
      );

      setProgress(
        `Fehler: ${error.message ?? error}`,
        0,
        0,
        0,
        'danger'
      );
    }
  }

  // ============================================================
  // Umbenennung
  // ============================================================

  async function run(buttons) {
    if (running) {
      return;
    }

    try {
      const {
        config,
        plan
      } = await selection();

      /*
       * Wichtig:
       * Die Nummern wurden bereits anhand ALLER Gebaeude des
       * jeweiligen Typs berechnet.
       *
       * Erst DANACH filtern wir auf geaenderte Namen.
       *
       * Dadurch bleibt die Nummerierung bei einem erneuten Lauf
       * immer identisch.
       */
      const changes = plan.filter(
        item => item.changed
      );

      if (changes.length === 0) {
        setProgress(
          'Alle Gebaeudenamen sind bereits korrekt',
          0,
          0,
          0,
          'success'
        );
        return;
      }

      const confirmed = globalThis.confirm(
        `${changes.length.toLocaleString('de-DE')} Gebaeude werden umbenannt.\n\n` +
        `Namens-Suffix: ${config.suffix || '(leer)'}\n` +
        `Startnummer: ${config.startNumber}\n` +
        `Nummerierung: ${config.digits}\n\n` +
        `Umbenennung jetzt starten?`
      );

      if (!confirmed) {
        setProgress(
          'Umbenennung nicht gestartet',
          0,
          0,
          0,
          'warning'
        );
        return;
      }

      running = true;

      buttons.forEach(button => {
        button.disabled = true;
      });

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;
      let renamed = 0;

      async function worker() {
        while (running) {
          const index = nextIndex++;

          if (index >= changes.length) {
            return;
          }

          const item = changes[index];

          setProgress(
            `${completed}/${changes.length}: ${item.newName}`,
            completed,
            errors,
            changes.length
          );

          try {
            await renameBuilding(
              item.id,
              item.newName
            );

            renamed++;
          } catch (error) {
            errors++;

            console.error(
              '[Rename Buildings] Gebaeude fehlgeschlagen:',
              {
                id: item.id,
                oldName: item.oldName,
                newName: item.newName,
                error
              }
            );
          }

          completed++;

          setProgress(
            `${completed}/${changes.length} bearbeitet, ` +
            `${renamed} umbenannt, ${errors} Fehler`,
            completed,
            errors,
            changes.length,
            errors ? 'warning' : 'success'
          );

          if (
            running &&
            config.requestDelay > 0
          ) {
            await sleep(config.requestDelay);
          }
        }
      }

      await Promise.all(
        Array.from(
          {
            length: Math.min(
              config.concurrency,
              changes.length
            )
          },
          worker
        )
      );

      if (!running) {
        return;
      }

      setProgress(
        'Gebaeude-Cache wird aktualisiert ...',
        completed,
        errors,
        changes.length,
        'info'
      );

      try {
        await refreshBuildingCache();
      } catch (error) {
        console.warn(
          '[Rename Buildings] Cache konnte nicht aktualisiert werden:',
          error
        );
      }

      setProgress(
        `Fertig: ${renamed.toLocaleString('de-DE')} umbenannt, ` +
        `${errors.toLocaleString('de-DE')} Fehler`,
        completed,
        errors,
        changes.length,
        errors ? 'warning' : 'success'
      );

    } catch (error) {
      console.error(
        '[Rename Buildings] Lauf fehlgeschlagen:',
        error
      );

      setProgress(
        `Fehler: ${error.message ?? error}`,
        0,
        0,
        0,
        'danger'
      );
    } finally {
      running = false;

      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  // ============================================================
  // Buttons
  // ============================================================

  function settingsButton() {
    const button = document.createElement('a');

    button.className =
      'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';

    button.append(icon);

    return button;
  }

  function buildingTable() {
    return (
      document.getElementById('building_table') ??
      document.querySelector('#tab_buildings table')
    );
  }

  function addButtons() {
    const heading =
      document.querySelector('h1[building_type]');

    /*
     * Typ 7 = Leitstelle
     *
     * Der Renamer wird nur auf einer Leitstellenseite
     * eingeblendet.
     */
    if (
      Number(
        heading?.getAttribute('building_type')
      ) !== 7 ||
      document.getElementById(
        'nilspe-rename-building-buttons'
      )
    ) {
      return;
    }

    const table = buildingTable();

    if (!table) {
      return;
    }

    const group = document.createElement('div');

    group.id =
      'nilspe-rename-building-buttons';

    group.className = 'btn-group';

    const previewButton =
      document.createElement('button');

    previewButton.type = 'button';
    previewButton.className =
      'btn btn-default btn-xs';

    previewButton.textContent =
      'Umbenennvorschau';

    previewButton.addEventListener(
      'click',
      preview
    );

    const renameButton =
      document.createElement('button');

    renameButton.type = 'button';
    renameButton.className =
      'btn btn-primary btn-xs';

    renameButton.textContent =
      'Gebaeude umbenennen';

    const buttons = [
      previewButton,
      renameButton
    ];

    renameButton.addEventListener(
      'click',
      () => run(buttons)
    );

    group.append(
      previewButton,
      renameButton,
      settingsButton()
    );

    const row = document.createElement('div');

    row.id =
      'nilspe-rename-building-button-row';

    row.style.display = 'block';
    row.style.width = '100%';

    row.append(group);

    table.parentElement?.insertBefore(
      row,
      table
    );
  }

  // ============================================================
  // Start
  // ============================================================

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();
  } else {
    addButtons();

    new MutationObserver(
      addButtons
    ).observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

})();