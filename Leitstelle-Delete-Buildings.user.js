
// ==UserScript==
// @name         Leitstelle Delete Buildings
// @namespace    NilsPe.delete.buildings
// @version      1.1.0
// @description  Vorschau und kontrolliertes Löschen konfigurierter Gebäude einer Leitstelle
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
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const VERSION = '1.1.0';
  const PREFIX = '[Leitstelle Delete Buildings]';
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
  ].map(([value, name]) => ({
    value,
    name: `${value} ${name}`
  }));

  const TYPE_NAMES = new Map(
    BUILDING_TYPES.map(type => [
      Number(type.value),
      type.name
    ])
  );

  const SETTINGS = [
    {
      type: 'header',
      text: 'Gebäudeauswahl'
    },
    {
      type: 'select',
      key: KEYS.buildingTypes,
      label: 'Zu löschende Gebäudetypen',
      title: 'Gebäudetypen auswählen',
      multiple: true,
      options: BUILDING_TYPES
    },
    {
      type: 'number',
      key: KEYS.everyNth,
      label: 'Nur jedes N-te Gebäude je Typ',
      info: '1 = alle passenden Gebäude',
      min: 1,
      max: 1000,
      default: 1
    },
    {
      type: 'number',
      key: KEYS.startAt,
      label: 'Startposition je Typ',
      info: 'N = 2, Start = 2: Position 2, 4, 6 ...',
      min: 1,
      max: 1000,
      default: 1
    },
    {
      type: 'header',
      text: 'Ablauf'
    },
    {
      type: 'number',
      key: KEYS.requestDelay,
      label: 'Pause je Worker [ms]',
      min: 100,
      max: 5000,
      default: 150
    },
    {
      type: 'number',
      key: KEYS.concurrency,
      label: 'Parallele Löschanfragen',
      min: 1,
      max: 3,
      default: 3
    }
  ];

  let running = false;
  let busy = false;
  let cancelRequested = false;
  let previewSnapshot = null;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function node(tag, cls = '', text = '') {
    const result = document.createElement(tag);
    if (cls) result.className = cls;
    if (text) result.textContent = text;
    return result;
  }

  function parseArray(raw) {
    try {
      const values = typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;

      return Array.isArray(values)
        ? values.map(Number).filter(Number.isInteger)
        : [];
    } catch {
      return [];
    }
  }

  async function configuration() {
    const number = async (key, fallback, min, max) => {
      const raw = Number(await GM.getValue(key, fallback));
      return Number.isFinite(raw)
        ? Math.max(min, Math.min(max, Math.floor(raw)))
        : fallback;
    };

    const everyNth = await number(
      KEYS.everyNth, 1, 1, 1000
    );

    return {
      types: new Set(parseArray(
        await GM.getValue(KEYS.buildingTypes, '[]')
      )),
      everyNth,
      startAt: Math.min(
        everyNth,
        await number(KEYS.startAt, 1, 1, 1000)
      ),
      requestDelay: await number(
        KEYS.requestDelay, 150, 100, 5000
      ),
      concurrency: await number(
        KEYS.concurrency, 3, 1, 3
      )
    };
  }

  /*
   * =====================================
   * EINSTELLUNGSOBERFLÄCHE
   * =====================================
   *
   * Die Originalfelder der Skriptbasis
   * werden verschoben, nicht neu erstellt.
   * Dadurch bleiben Speicher-Eventhandler
   * und bestehende Einstellungen erhalten.
   */

  function injectStyles() {
    if (document.getElementById(
      'nilspe-delete-buildings-settings-style'
    )) return;

    const style = node('style');
    style.id = 'nilspe-delete-buildings-settings-style';
    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-db-group {
        margin: 0 0 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-content {
        padding: 10px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-field {
        box-sizing: border-box;
        padding: 7px 9px;
        margin-bottom: 4px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-field .form-group {
        margin: 0;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-field .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-number .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-number label {
        order: 2;
        flex: 1;
        margin: 0;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-number input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        box-sizing: border-box;
        text-align: left;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-select label {
        display: block;
        margin-bottom: 6px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-select .bootstrap-select {
        max-width: 100%;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-select
      .bootstrap-select > button {
        min-height: 28px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-bulk {
        display: inline-flex !important;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        width: 110px;
        height: 28px;
        padding: 2px 6px !important;
        margin: 0 !important;
        font-size: 13px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-db-count {
        font-size: 12px;
        opacity: .75;
      }
    `;

    document.head.append(style);
  }

  function settingField(body, key) {
    const prefix = `nilspe_setting_${key}_`;

    const input = Array.from(
      body.querySelectorAll('input[id],select[id]')
    ).find(control => control.id.startsWith(prefix));

    if (!input) return null;

    let container = input;
    while (
      container.parentElement &&
      container.parentElement !== body
    ) {
      container = container.parentElement;
    }

    return container.parentElement === body
      ? { container, input }
      : null;
  }

  function makeGroup(title, description) {
    const details = node('details', 'nilspe-db-group');
    const summary = node('summary', '', title);
    const content = node('div', 'nilspe-db-content');

    if (description) {
      content.append(
        node('p', 'nilspe-db-info', description)
      );
    }

    details.append(summary, content);
    return { details, content };
  }

  function enhanceSelect(container, select) {
    const toolbar = node('div', 'nilspe-db-toolbar');
    const all = node(
      'button',
      'btn btn-default btn-xs nilspe-db-bulk',
      'Alle anwählen'
    );
    const none = node(
      'button',
      'btn btn-default btn-xs nilspe-db-bulk',
      'Alle abwählen'
    );
    const count = node('span', 'nilspe-db-count');

    all.type = 'button';
    none.type = 'button';

    const jq = typeof unsafeWindow !== 'undefined'
      ? unsafeWindow.jQuery ?? unsafeWindow.$
      : null;

    function refresh() {
      const selected = select.selectedOptions.length;
      count.textContent =
        `${selected} von ${select.options.length} ausgewählt`;

      container.classList.toggle('selected', selected > 0);
    }

    function setAll(selected) {
      for (const option of select.options) {
        if (!option.disabled) {
          option.selected = selected;
        }
      }

      if (typeof jq === 'function') {
        const picker = jq(select);
        if (typeof picker.selectpicker === 'function') {
          picker.selectpicker('refresh');
        }
      }

      select.dispatchEvent(new Event('change', {
        bubbles: true
      }));
      refresh();
    }

    all.addEventListener('click', () => setAll(true));
    none.addEventListener('click', () => setAll(false));
    select.addEventListener('change', refresh);

    if (typeof jq === 'function') {
      jq(select).on(
        'changed.bs.select.nilspeDeleteBuildings',
        refresh
      );
    }

    toolbar.append(all, none, count);
    container.append(toolbar);
    refresh();
  }

  function groupSettings() {
    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) return false;

    if (body.querySelector('.nilspe-db-root')) {
      return true;
    }

    const fields = new Map();

    for (const setting of SETTINGS) {
      if (!setting.key) continue;

      const found = settingField(body, setting.key);
      if (!found) return false;
      fields.set(setting.key, found);
    }

    injectStyles();

    const root = node('section', 'nilspe-db-root');
    root.append(
      node('h2', '', 'Delete Buildings'),
      node(
        'p',
        'nilspe-db-info',
        'Gebäudeauswahl prüfen, bevor Gebäude dauerhaft gelöscht werden.'
      )
    );

    const groups = [
      {
        title: 'Gebäudeauswahl',
        description:
          'Gebäudetypen und Auswahlpositionen je Typ.',
        keys: [
          KEYS.buildingTypes,
          KEYS.everyNth,
          KEYS.startAt
        ]
      },
      {
        title: 'Ablauf',
        description:
          'Pause und parallele Löschanfragen.',
        keys: [
          KEYS.requestDelay,
          KEYS.concurrency
        ]
      }
    ];

    for (const definition of groups) {
      const group = makeGroup(
        definition.title,
        definition.description
      );

      for (const key of definition.keys) {
        const field = fields.get(key);
        field.container.classList.add('nilspe-db-field');

        if (field.input.tagName === 'SELECT') {
          field.container.classList.add('nilspe-db-select');
          enhanceSelect(field.container, field.input);
        } else {
          field.container.classList.add(
            'nilspe-db-number',
            'selected'
          );
        }

        group.content.append(field.container);
      }

      root.append(group.details);
    }

    for (const child of [...body.children]) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        ['Gebaeudeauswahl', 'Gebäudeauswahl', 'Ablauf']
          .includes(child.textContent.trim())
      ) {
        child.remove();
      }
    }

    body.prepend(root);
    return true;
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(PREFIX, 'Skriptbasis fehlt.');
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Delete Buildings',
      settings: SETTINGS
    });

    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) return;

    let scheduled = false;

    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;

      queueMicrotask(() => {
        scheduled = false;
        groupSettings();
      });
    }).observe(body, { childList: true });

    groupSettings();
  }

  /*
   * =====================================
   * GEBÄUDE AUS DER SKRIPTBASIS
   * =====================================
   */

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
        `Gebäude ${building.id}`
    };
  }

  function currentDispatchCenterId() {
    const heading = document.querySelector(
      'h1[building_type]'
    );

    if (
      Number(heading?.getAttribute('building_type')) !== 7
    ) {
      throw new Error(
        'Dieses Script kann nur auf einer Leitstelle gestartet werden.'
      );
    }

    const id = Number(
      location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
    );

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Leitstellen-ID fehlt.');
    }

    return id;
  }

  async function loadBuildings(dispatchCenterId, types) {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function' ||
      typeof getDataByIndex !== 'function'
    ) {
      throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      const records = await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        dispatchCenterId
      );

      return records
        .map(normalizeBuilding)
        .filter(building =>
          types.has(building.building_type) &&
          building.leitstelle_building_id === dispatchCenterId &&
          Number.isSafeInteger(building.id) &&
          building.id > 0 &&
          building.id !== dispatchCenterId
        )
        .sort((a, b) =>
          a.building_type - b.building_type ||
          a.id - b.id
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

      for (
        let index = config.startAt - 1;
        index < group.length;
        index += config.everyNth
      ) {
        selected.push(group[index]);
      }
    }

    return selected;
  }

  async function selection() {
    const config = await configuration();

    if (!config.types.size) {
      throw new Error('Keine Gebäudetypen ausgewählt.');
    }

    const dispatchCenterId = currentDispatchCenterId();
    const all = await loadBuildings(
      dispatchCenterId,
      config.types
    );

    return {
      config,
      dispatchCenterId,
      buildings: selectBuildings(all, config)
    };
  }

  /*
   * =====================================
   * VORSCHAU
   * =====================================
   *
   * Die Auswahl wird als unveränderliche
   * ID-Liste vorgemerkt. Vor dem Löschen
   * muss dieselbe Auswahl erneut entstehen.
   */

  function buildingTable() {
    return document.getElementById('building_table') ??
      document.querySelector('#tab_buildings table');
  }

  function visibleBuildingRows() {
    return Array.from(
      buildingTable()?.tBodies?.[0]?.rows ?? []
    );
  }

  function rowBuildingId(row) {
    const link = row.querySelector(
      'a[building_type][href*="/buildings/"],' +
      'a[data-building-type][href*="/buildings/"],' +
      'td:nth-child(2) a[href*="/buildings/"]'
    );

    return Number(
      link?.getAttribute('href')
        ?.match(/\/buildings\/(\d+)/)?.[1]
    ) || 0;
  }

  function clearPreview() {
    for (const row of document.querySelectorAll(
      '.nilspe-delete-building-preview'
    )) {
      row.classList.remove(
        'nilspe-delete-building-preview'
      );
      row.style.outline = '';
      row.style.background = '';
    }
  }

  function markVisibleBuildings(buildings) {
    clearPreview();

    const ids = new Set(
      buildings.map(building => building.id)
    );

    for (const row of visibleBuildingRows()) {
      if (!ids.has(rowBuildingId(row))) continue;

      row.classList.add(
        'nilspe-delete-building-preview'
      );

      row.style.outline = '2px solid #d9534f';
      row.style.background = 'rgba(217,83,79,.12)';
    }
  }

  function selectionSignature(selection) {
    return JSON.stringify({
      dispatchCenterId: selection.dispatchCenterId,
      ids: selection.buildings
        .map(building => building.id)
        .sort((a, b) => a - b)
    });
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
      .map(([type, count]) =>
        `${TYPE_NAMES.get(type) ?? `Typ ${type}`}: ${count}`
      )
      .join('\n');
  }

  /*
   * =====================================
   * FORTSCHRITT
   * =====================================
   */

  function ensureProgress() {
    if (document.getElementById(
      'nilspe-delete-building-progress'
    )) return;

    const style = node('style');
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
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
      #nilspe-delete-building-errors {
        height: 100%;
        width: 0;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = node('div');
    container.id = 'nilspe-delete-building-progress';

    const row = node('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:12px';

    const cancel = node(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );
    cancel.type = 'button';

    cancel.addEventListener('click', () => {
      if (!running) return;
      cancelRequested = true;

      const status = document.getElementById(
        'nilspe-delete-building-status'
      );
      if (status) {
        status.className = 'label label-warning';
        status.textContent =
          'Abbruch angefordert ...';
      }
    });

    const status = node(
      'span',
      'label label-info',
      'Bereit'
    );
    status.id = 'nilspe-delete-building-status';

    const track = node('div');
    track.id = 'nilspe-delete-building-track';

    const success = node('div');
    success.id = 'nilspe-delete-building-success';

    const errors = node('div');
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

    const status = document.getElementById(
      'nilspe-delete-building-status'
    );
    const success = document.getElementById(
      'nilspe-delete-building-success'
    );
    const errorBar = document.getElementById(
      'nilspe-delete-building-errors'
    );

    const denominator = Math.max(total, 1);
    const successful = Math.max(0, completed - errors);

    status.className = `label label-${type}`;
    status.textContent = message;
    success.style.width =
      `${successful / denominator * 100}%`;
    errorBar.style.width =
      `${errors / denominator * 100}%`;
  }

  /*
   * =====================================
   * LÖSCHANFRAGE
   * =====================================
   */

  function csrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ??
    document.querySelector(
      'input[name="authenticity_token"]'
    )?.value ??
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
        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8',
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
      throw new Error(
        `Gebäude ${id}: HTTP ${response.status}`
      );
    }
  }

  /*
   * =====================================
   * VORSCHAU ERSTELLEN
   * =====================================
   */

  async function preview() {
    if (busy || running) return;
    busy = true;
    previewSnapshot = null;

    try {
      setProgress('Gebäudeauswahl wird ermittelt ...');
      const selected = await selection();

      markVisibleBuildings(selected.buildings);

      previewSnapshot = selectionSignature(selected);

      console.table(selected.buildings.map(building => ({
        ID: building.id,
        Typ: TYPE_NAMES.get(building.building_type),
        Name: building.caption
      })));

      setProgress(
        `Vorschau: ${selected.buildings.length} Gebäude, ` +
        'sichtbare Treffer rot markiert',
        0, 0, 0,
        selected.buildings.length ? 'warning' : 'success'
      );
    } catch (error) {
      clearPreview();
      setProgress(
        `Fehler: ${error.message ?? error}`,
        0, 0, 0, 'danger'
      );
    } finally {
      busy = false;
    }
  }

  /*
   * =====================================
   * LÖSCHDURCHLAUF
   * =====================================
   */

  async function run(buttons) {
    if (busy || running) return;
    busy = true;

    try {
      if (!previewSnapshot) {
        setProgress(
          'Bitte zuerst die Löschvorschau starten.',
          0, 0, 0, 'warning'
        );
        return;
      }

      setProgress('Gebäudeauswahl wird überprüft ...');

      const selected = await selection();
      const { config, buildings } = selected;

      if (
        selectionSignature(selected) !==
        previewSnapshot
      ) {
        previewSnapshot = null;
        clearPreview();

        setProgress(
          'Auswahl hat sich geändert: Bitte Vorschau erneuern.',
          0, 0, 0, 'warning'
        );
        return;
      }

      if (!buildings.length) {
        setProgress(
          'Keine passenden Gebäude gefunden',
          0, 0, 0, 'success'
        );
        return;
      }

      markVisibleBuildings(buildings);

      const phrase = `LOESCHEN ${buildings.length}`;

      const confirmation = window.prompt(
        `${buildings.length} Gebäude werden endgültig ` +
        `ohne Erstattung gelöscht.\n\n` +
        `${countSummary(buildings)}\n\n` +
        `Zum Bestätigen exakt eingeben: ${phrase}`
      );

      if (confirmation !== phrase) {
        setProgress(
          'Löschen nicht bestätigt',
          0, 0, 0, 'warning'
        );
        return;
      }

      // Die Vorschau gilt nur für diesen Löschversuch.
      previewSnapshot = null;

      running = true;
      cancelRequested = false;

      buttons.forEach(button => {
        button.disabled = true;
      });

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;

      async function worker() {
        while (!cancelRequested) {
          const index = nextIndex++;

          if (index >= buildings.length) return;

          const building = buildings[index];

          try {
            await deleteBuilding(building.id);

            visibleBuildingRows().find(
              row => rowBuildingId(row) === building.id
            )?.remove();
          } catch (error) {
            errors++;
            console.error(
              PREFIX,
              'Gebäude fehlgeschlagen:',
              building.id,
              error
            );
          }

          completed++;

          setProgress(
            `${completed}/${buildings.length} Gebäude bearbeitet`,
            completed,
            errors,
            buildings.length,
            errors ? 'warning' : 'info'
          );

          if (
            !cancelRequested &&
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
              buildings.length
            )
          },
          () => worker()
        )
      );

      clearPreview();

      if (cancelRequested) {
        setProgress(
          `Abgebrochen: ${completed - errors} gelöscht, ` +
          `${errors} Fehler, ${buildings.length - completed} offen`,
          completed,
          errors,
          buildings.length,
          'warning'
        );
      } else {
        setProgress(
          `Fertig: ${completed - errors} gelöscht, ` +
          `${errors} Fehler`,
          completed,
          errors,
          buildings.length,
          errors ? 'warning' : 'success'
        );
      }
    } catch (error) {
      console.error(PREFIX, 'Lauf fehlgeschlagen:', error);

      setProgress(
        `Fehler: ${error.message ?? error}`,
        0, 0, 0, 'danger'
      );
    } finally {
      running = false;
      cancelRequested = false;
      busy = false;

      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  /*
   * =====================================
   * BUTTONS IN DER LEITSTELLE
   * =====================================
   */

  function buildingButtons() {
    const heading = document.querySelector(
      'h1[building_type]'
    );

    if (
      Number(heading?.getAttribute('building_type')) !== 7 ||
      document.getElementById(
        'nilspe-delete-building-buttons'
      )
    ) {
      return;
    }

    const table = buildingTable();
    if (!table?.parentElement) return;

    const group = node('div', 'btn-group');
    group.id = 'nilspe-delete-building-buttons';

    const previewButton = node(
      'button',
      'btn btn-default btn-xs',
      'Löschvorschau'
    );

    const deleteButton = node(
      'button',
      'btn btn-danger btn-xs',
      'Gebäude löschen'
    );

    previewButton.type = 'button';
    deleteButton.type = 'button';

    const buttons = [previewButton, deleteButton];

    previewButton.addEventListener(
      'click',
      () => void preview()
    );

    deleteButton.addEventListener(
      'click',
      () => void run(buttons)
    );

    const settings = node('a', 'btn btn-default btn-xs');
    settings.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;
    settings.target = '_blank';
    settings.title = 'Einstellungen';
    settings.append(
      node('span', 'glyphicon glyphicon-cog')
    );

    group.append(
      previewButton,
      deleteButton,
      settings
    );

    const row = node('div');
    row.id = 'nilspe-delete-building-button-row';
    row.style.cssText = 'display:block;width:100%;margin:0';
    row.append(group);

    table.parentElement.insertBefore(row, table);
  }

  /*
   * =====================================
   * INITIALISIERUNG
   * =====================================
   */

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
  } else {
    buildingButtons();

    new MutationObserver(buildingButtons).observe(
      document.body,
      { childList: true, subtree: true }
    );
  }

  console.log(PREFIX, `Version ${VERSION} geladen`);
})();
