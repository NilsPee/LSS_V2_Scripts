
// ==UserScript==
// @name         Leitstelle Rename Buildings
// @namespace    NilsPe.rename.buildings
// @version      1.1.1
// @description  Benennt Gebäude nach Typ, Namenssuffix und fortlaufender Nummer um
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

  const VERSION = '1.1.1';
  const PREFIX = '[Leitstelle Rename Buildings]';
  const SETTINGS_IDENTIFIER = 'nilspe_rename_buildings';

  const KEYS = {
    startNumber: 'nilspe_rename_buildings_start_number',
    digits: 'nilspe_rename_buildings_digits',
    suffix: 'nilspe_rename_buildings_suffix',
    concurrency: 'nilspe_rename_buildings_concurrency',
    requestDelay: 'nilspe_rename_buildings_request_delay'
  };

  /*
   * ==========================================
   * GEBÄUDETYPEN
   * ==========================================
   *
   * Bestehende Typen behalten ihre
   * bisherigen Speicherkeys und Namen.
   *
   * Neu in v1.1.1 ergänzte Typen:
   * 1, 3, 8, 10, 14, 22, 23, 27, 29
   *
   * Für neu ergänzte Typen gilt zunächst
   * defaultName = ''.
   *
   * Damit werden sie erst umbenannt,
   * nachdem ein Name eingetragen wurde.
   */

  const BUILDING_TYPES = [
    { id: 0, name: 'Feuerwache', defaultName: 'Feuerwache' },
    { id: 1, name: 'Feuerwehrschule', defaultName: '' },
    { id: 2, name: 'Rettungswache', defaultName: 'Rettungswache' },
    { id: 3, name: 'Rettungsschule', defaultName: '' },
    { id: 4, name: 'Krankenhaus', defaultName: 'KH' },
    { id: 5, name: 'Rettungshubschrauber-Station', defaultName: 'RTH' },
    { id: 6, name: 'Polizeiwache', defaultName: 'Polizeiwache' },
    { id: 8, name: 'Polizeischule', defaultName: '' },
    { id: 9, name: 'THW-Ortsverband', defaultName: 'THW' },
    { id: 10, name: 'THW-Bundesschule', defaultName: '' },
    { id: 11, name: 'Bereitschaftspolizei', defaultName: 'Bepol' },
    { id: 12, name: 'Schnelleinsatzgruppe (SEG)', defaultName: 'SEG' },
    { id: 13, name: 'Polizeihubschrauberstation', defaultName: 'Polizeihubschrauber' },
    { id: 14, name: 'Bereitstellungsraum', defaultName: '' },
    { id: 15, name: 'Wasserrettung', defaultName: 'Wasserrettung' },
    { id: 16, name: 'Verbandszellen', defaultName: 'JVA' },
    { id: 17, name: 'Polizei-Sondereinheiten', defaultName: 'Sondereinheiten' },
    { id: 18, name: 'Feuerwache (Kleinwache)', defaultName: 'Feuerwache' },
    { id: 19, name: 'Polizeiwache (Kleinwache)', defaultName: 'Polizeiwache' },
    { id: 20, name: 'Rettungswache (Kleinwache)', defaultName: 'Rettungswache' },
    { id: 21, name: 'Rettungshundestaffel', defaultName: 'Rettungshunde' },
    { id: 22, name: 'Großer Komplex', defaultName: '' },
    { id: 23, name: 'Kleiner Komplex', defaultName: '' },
    { id: 24, name: 'Reiterstaffel', defaultName: 'Reiterstaffel' },
    { id: 25, name: 'Bergrettung', defaultName: 'Bergrettung' },
    { id: 26, name: 'Seenotrettungswache', defaultName: 'Seenotrettung' },
    { id: 27, name: 'Schule für Seefahrt und Seenotrettung', defaultName: '' },
    { id: 28, name: 'Hubschrauberstation (Seenotrettung)', defaultName: 'Seenotrettung RTH' },
    { id: 29, name: 'Autobahnpolizei', defaultName: '' }
  ];

  for (const type of BUILDING_TYPES) {
    type.key = `nilspe_rename_buildings_type_${type.id}`;
  }

  const TYPE_MAP = new Map(
    BUILDING_TYPES.map(type => [type.id, type])
  );

  let running = false;
  let busy = false;
  let cancelRequested = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function el(tag, className = '', text = '') {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text) element.textContent = text;

    return element;
  }

  function formatCount(value) {
    return Number(value).toLocaleString('de-DE');
  }

  function clampInteger(value, fallback, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.max(
      min,
      Math.min(max, Math.floor(number))
    );
  }

  /*
   * ==========================================
   * EINSTELLUNGEN
   * ==========================================
   *
   * Sämtliche bestehenden Speicherkeys
   * bleiben unverändert.
   */

  async function initializeDefaults() {
    for (const type of BUILDING_TYPES) {
      const stored = await GM.getValue(
        type.key,
        null
      );

      if (stored === null) {
        await GM.setValue(
          type.key,
          type.defaultName
        );
      }
    }
  }

  const SETTINGS = [
    {
      type: 'header',
      text: 'Benennung'
    },
    {
      type: 'number',
      key: KEYS.startNumber,
      label: 'Startnummer',
      info: 'Erste Nummer je Gebäudetyp.',
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
      info: 'Zum Beispiel Berlin, NRW, Köln oder Madrid.',
      default: ''
    },
    {
      type: 'header',
      text: 'Wachentypen'
    },
    ...BUILDING_TYPES.map(type => ({
      type: 'text',
      key: type.key,
      label: `${type.id} ${type.name}`,
      info: 'Leer lassen, wenn dieser Gebäudetyp nicht umbenannt werden soll.',
      default: type.defaultName
    })),
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
  ];

  /*
   * ==========================================
   * EINHEITLICHER EINSTELLUNGSSTANDARD
   * ==========================================
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-rb-settings-style'
      )
    ) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-rb-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-rb-root {
        margin-bottom: 24px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-group > summary {
        padding: 9px 12px;
        cursor: pointer;
        background: #8882;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-group-body {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-field {
        box-sizing: border-box;
        margin-bottom: 4px;
        padding: 7px 9px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-field .form-group {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-field .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-number .col-sm-6,
      #${SETTINGS_IDENTIFIER} .nilspe-rb-text .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-number label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-number input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        padding: 3px 7px !important;
        margin: 0 !important;
        text-align: left;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-text label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-text input[type="text"] {
        order: 1;
        flex: 0 0 215px;
        width: 215px !important;
        max-width: 55%;
        min-width: 0;
        height: 28px !important;
        padding: 3px 7px !important;
        margin: 0 !important;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-button {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 2px 10px !important;
        font-size: 13px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-rb-active-count {
        font-size: 12px;
        opacity: .8;
      }
    `;

    document.head.append(style);
  }

  function settingField(body, key) {
    const prefix = `nilspe_setting_${key}_`;

    const control = Array.from(
      body.querySelectorAll(
        'input[id], select[id]'
      )
    ).find(node => node.id.startsWith(prefix));

    if (!control) return null;

    let container = control;

    while (
      container.parentElement &&
      container.parentElement !== body
    ) {
      container = container.parentElement;
    }

    if (container.parentElement !== body) {
      return null;
    }

    return { control, container };
  }

  function makeGroup(title, description) {
    const details = el(
      'details',
      'nilspe-rb-group'
    );

    const summary = el('summary', '', title);

    const content = el(
      'div',
      'nilspe-rb-group-body'
    );

    if (description) {
      content.append(
        el('p', 'nilspe-rb-info', description)
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  /*
   * ==========================================
   * WACHENTYPEN
   * ==========================================
   */

  function enhanceTypeFields(
    content,
    typeFields
  ) {
    const toolbar = el(
      'div',
      'nilspe-rb-toolbar'
    );

    const defaultsButton = el(
      'button',
      'btn btn-default btn-xs nilspe-rb-button',
      'Standardnamen einsetzen'
    );

    const clearButton = el(
      'button',
      'btn btn-default btn-xs nilspe-rb-button',
      'Alle Namen leeren'
    );

    defaultsButton.type = 'button';
    clearButton.type = 'button';

    const count = el(
      'span',
      'nilspe-rb-active-count'
    );

    function updateCount() {
      let active = 0;

      for (const type of BUILDING_TYPES) {
        const field = typeFields.get(type.id);

        if (!field) continue;

        const hasName =
          field.control.value.trim() !== '';

        field.container.classList.toggle(
          'selected',
          hasName
        );

        if (hasName) active++;
      }

      count.textContent =
        `${active} von ${BUILDING_TYPES.length} Wachentypen aktiv`;
    }

    function setTypeNames(useDefaults) {
      for (const type of BUILDING_TYPES) {
        const field = typeFields.get(type.id);
        if (!field) continue;

        field.control.value =
          useDefaults ? type.defaultName : '';

        field.control.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        );
      }

      updateCount();
    }

    defaultsButton.addEventListener(
      'click',
      () => {
        if (!window.confirm(
          'Alle bisher eingestellten Wachentyp-Namen ' +
          'durch die Standardnamen ersetzen?'
        )) return;

        setTypeNames(true);
      }
    );

    clearButton.addEventListener(
      'click',
      () => {
        if (!window.confirm(
          'Alle Wachentyp-Namen leeren?\n\n' +
          'Damit werden bei der nächsten Umbenennung ' +
          'keine Wachentypen berücksichtigt.'
        )) return;

        setTypeNames(false);
      }
    );

    for (const field of typeFields.values()) {
      field.control.addEventListener(
        'input',
        updateCount
      );

      field.control.addEventListener(
        'change',
        updateCount
      );
    }

    toolbar.append(
      defaultsButton,
      clearButton,
      count
    );

    content.prepend(toolbar);
    updateCount();
  }

  /*
   * ==========================================
   * EINSTELLUNGEN GRUPPIEREN
   * ==========================================
   */

  function groupRenderedSettings() {
    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) return false;

    if (body.querySelector('.nilspe-rb-root')) {
      return true;
    }

    const fields = new Map();

    for (const definition of SETTINGS) {
      if (!definition.key) continue;

      const field = settingField(
        body,
        definition.key
      );

      if (!field) return false;

      fields.set(definition.key, field);
    }

    injectSettingsStyles();

    const root = el(
      'section',
      'nilspe-rb-root'
    );

    root.append(
      el('h2', '', 'Rename Buildings'),
      el(
        'p',
        'nilspe-rb-info',
        'Gebäudenamen und Nummerierung konfigurieren. ' +
        'Vor der Umbenennung kannst du alle Änderungen ' +
        'in einer Vorschau überprüfen.'
      )
    );

    const naming = makeGroup(
      'Benennung',
      'Startnummer, Ziffernanzahl und Namenssuffix ' +
      'gelten für alle aktivierten Wachentypen.'
    );

    const types = makeGroup(
      'Wachentypen',
      'Ein leerer Name bedeutet, dass dieser Gebäudetyp ' +
      'nicht umbenannt wird.'
    );

    const flow = makeGroup(
      'Ablauf',
      'Anzahl paralleler Umbenennungen und Anfragepause.'
    );

    const assignments = [
      {
        group: naming,
        keys: [
          KEYS.startNumber,
          KEYS.digits,
          KEYS.suffix
        ]
      },
      {
        group: types,
        keys: BUILDING_TYPES.map(
          type => type.key
        )
      },
      {
        group: flow,
        keys: [
          KEYS.concurrency,
          KEYS.requestDelay
        ]
      }
    ];

    const typeFields = new Map();

    for (const assignment of assignments) {
      for (const key of assignment.keys) {
        const field = fields.get(key);

        field.container.classList.add(
          'nilspe-rb-field'
        );

        if (field.control.type === 'number') {
          field.container.classList.add(
            'nilspe-rb-number',
            'selected'
          );
        } else {
          field.container.classList.add(
            'nilspe-rb-text'
          );
        }

        assignment.group.content.append(
          field.container
        );
      }
    }

    for (const type of BUILDING_TYPES) {
      typeFields.set(
        type.id,
        fields.get(type.key)
      );
    }

    enhanceTypeFields(
      types.content,
      typeFields
    );

    root.append(
      naming.details,
      types.details,
      flow.details
    );

    for (const child of [...body.children]) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        [
          'Benamung',
          'Benennung',
          'Wachentypen',
          'Ablauf'
        ].includes(child.textContent.trim())
      ) {
        child.remove();
      }
    }

    body.prepend(root);

    console.log(
      PREFIX,
      `Einstellungen v${VERSION} geladen`
    );

    return true;
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(
        PREFIX,
        'NilsPe-Skriptbasis fehlt.'
      );
      return;
    }

    await initializeDefaults();

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Rename Buildings',
      settings: SETTINGS
    });

    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) {
      console.error(
        PREFIX,
        'Einstellungscontainer fehlt.'
      );
      return;
    }

    let scheduled = false;

    new MutationObserver(() => {
      if (scheduled) return;

      scheduled = true;

      queueMicrotask(() => {
        scheduled = false;

        try {
          groupRenderedSettings();
        } catch (error) {
          console.error(
            PREFIX,
            'Einstellungen konnten nicht gruppiert werden:',
            error
          );
        }
      });
    }).observe(body, {
      childList: true
    });

    groupRenderedSettings();
  }

  /*
   * ==========================================
   * KONFIGURATION
   * ==========================================
   */

  async function configuration() {
    const startNumber = clampInteger(
      await GM.getValue(
        KEYS.startNumber,
        1
      ),
      1, 0, 999999
    );

    const digits = clampInteger(
      await GM.getValue(
        KEYS.digits,
        3
      ),
      3, 1, 10
    );

    const suffix = String(
      await GM.getValue(
        KEYS.suffix,
        ''
      )
    ).trim();

    const concurrency = clampInteger(
      await GM.getValue(
        KEYS.concurrency,
        3
      ),
      3, 1, 5
    );

    const requestDelay = clampInteger(
      await GM.getValue(
        KEYS.requestDelay,
        150
      ),
      150, 0, 5000
    );

    const typeNames = new Map();

    for (const type of BUILDING_TYPES) {
      const name = String(
        await GM.getValue(
          type.key,
          type.defaultName
        )
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

  /*
   * ==========================================
   * GEBÄUDE LADEN
   * ==========================================
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
      building_type: Number(
        building.building_type
      ),
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

  async function loadBuildings(dispatchCenterId) {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function' ||
      typeof getDataByIndex !== 'function'
    ) {
      throw new Error(
        'NilsPe-Skriptbasis wurde nicht geladen.'
      );
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
        .filter(building =>
          Number.isSafeInteger(building.id) &&
          building.id > 0 &&
          building.leitstelle_building_id ===
            dispatchCenterId
        )
        .sort((a, b) =>
          a.building_type - b.building_type ||
          a.id - b.id
        );
    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * NAMEN BERECHNEN
   * ==========================================
   */

  function formatNumber(number, digits) {
    return String(number).padStart(
      digits,
      '0'
    );
  }

  function buildName(
    typeName,
    suffix,
    number,
    digits
  ) {
    return [
      typeName,
      suffix,
      formatNumber(number, digits)
    ]
      .filter(part =>
        String(part).trim() !== ''
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function createRenamePlan(
    buildings,
    config
  ) {
    const groups = new Map();

    for (const building of buildings) {
      if (
        !config.typeNames.has(
          building.building_type
        )
      ) {
        continue;
      }

      if (
        !groups.has(
          building.building_type
        )
      ) {
        groups.set(
          building.building_type,
          []
        );
      }

      groups.get(
        building.building_type
      ).push(building);
    }

    const plan = [];

    for (const [buildingType, group] of groups) {
      group.sort((a, b) => a.id - b.id);

      const typeName =
        config.typeNames.get(buildingType);

      group.forEach((building, index) => {
        const number =
          config.startNumber + index;

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

  /*
   * ==========================================
   * GEBÄUDE UMBENENNEN
   * ==========================================
   */

  function csrfToken() {
    return (
      document.querySelector(
        'meta[name="csrf-token"]'
      )?.content ??
      document.querySelector(
        'input[name="authenticity_token"]'
      )?.value ??
      ''
    );
  }

  async function renameBuilding(
    buildingId,
    newName
  ) {
    const token = csrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token wurde nicht gefunden.'
      );
    }

    const response = await fetch(
      `/buildings/${buildingId}`,
      {
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
        redirect: 'manual'
      }
    );

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

  /*
   * ==========================================
   * CACHE AKTUALISIEREN
   * ==========================================
   */

  async function refreshBuildingCache() {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function'
    ) {
      return;
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 0);
    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * FORTSCHRITT UND VORSCHAU
   * ==========================================
   */

  function ensureStyles() {
    if (
      document.getElementById(
        'nilspe-rename-building-style'
      )
    ) {
      return;
    }

    const style = el('style');
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
        height: 100%;
        width: 0;
        background: #5cb85c;
      }

      #nilspe-rename-building-errors {
        height: 100%;
        width: 0;
        background: #d9534f;
      }

      body.dark #nilspe-rename-building-progress,
      body.dark-mode #nilspe-rename-building-progress {
        background: #222;
        color: #eee;
        border-color: #444;
      }

      #nilspe-rename-preview-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2147483001;
        background: rgba(0,0,0,.55);
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
        overflow: hidden;
        background: #fff;
        color: #333;
        border-radius: 6px;
        box-shadow: 0 8px 30px rgba(0,0,0,.35);
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
  }

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-rename-building-progress'
      )
    ) {
      return;
    }

    ensureStyles();

    const container = el('div');
    container.id =
      'nilspe-rename-building-progress';

    const row = el('div');
    row.id =
      'nilspe-rename-building-progress-row';

    const cancel = el(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancel.type = 'button';
    cancel.id = 'nilspe-rename-building-cancel';

    cancel.addEventListener('click', () => {
      if (!running) return;

      cancelRequested = true;
      cancel.disabled = true;

      const status = document.getElementById(
        'nilspe-rename-building-status'
      );

      if (status) {
        status.className = 'label label-warning';
        status.textContent =
          'Abbruch angefordert – laufende Anfragen werden beendet ...';
      }
    });

    const status = el(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id =
      'nilspe-rename-building-status';

    const track = el('div');
    track.id = 'nilspe-rename-building-track';

    const success = el('div');
    success.id =
      'nilspe-rename-building-success';

    const errors = el('div');
    errors.id =
      'nilspe-rename-building-errors';

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
      `${Math.max(0, completed - errors) /
        safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  function currentDispatchCenterId() {
    const heading = document.querySelector(
      'h1[building_type]'
    );

    if (
      Number(
        heading?.getAttribute('building_type')
      ) !== 7
    ) {
      throw new Error(
        'Umbenennung nur von einer Leitstelle aus möglich.'
      );
    }

    const id = Number(
      location.pathname.match(
        /^\/buildings\/(\d+)/
      )?.[1]
    );

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error(
        'Leitstellen-ID konnte nicht ermittelt werden.'
      );
    }

    return id;
  }

  async function selection() {
    const dispatchCenterId =
      currentDispatchCenterId();

    const config = await configuration();

    if (!config.typeNames.size) {
      throw new Error(
        'Kein Gebäudetyp für die Umbenennung konfiguriert.'
      );
    }

    setProgress(
      'Gebäude werden aus dem API-Cache geladen ...'
    );

    const buildings = await loadBuildings(
      dispatchCenterId
    );

    return {
      config,
      buildings,
      plan: createRenamePlan(
        buildings,
        config
      )
    };
  }

  /*
   * ==========================================
   * UMBENENNVORSCHAU
   * ==========================================
   */

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

      const entry = summary.get(
        item.buildingType
      );

      entry.total++;

      if (item.changed) {
        entry.changed++;
      }
    }

    return [...summary.values()];
  }

  function showPreview(plan, config) {
    closePreview();
    ensureStyles();

    const changed = plan.filter(
      item => item.changed
    );

    const unchanged =
      plan.length - changed.length;

    const backdrop = el('div');
    backdrop.id =
      'nilspe-rename-preview-backdrop';

    const modal = el('div');
    modal.id = 'nilspe-rename-preview';

    const header = el('div');
    header.id =
      'nilspe-rename-preview-header';

    const title = el(
      'h3',
      '',
      'Umbenennvorschau'
    );

    const close = el(
      'button',
      'btn btn-default btn-sm',
      'Schließen'
    );

    close.type = 'button';
    close.addEventListener(
      'click',
      closePreview
    );

    header.append(title, close);

    const summary = el('div');
    summary.id =
      'nilspe-rename-preview-summary';

    const headline = el('div');

    headline.innerHTML =
      `<strong>${formatCount(plan.length)}</strong> ` +
      `Gebäude berücksichtigt &nbsp; | &nbsp; ` +
      `<strong>${formatCount(changed.length)}</strong> ` +
      `werden geändert &nbsp; | &nbsp; ` +
      `<strong>${formatCount(unchanged)}</strong> ` +
      `sind bereits korrekt`;

    summary.append(headline);

    const configLine = el(
      'div',
      '',
      `Suffix: "${config.suffix}" | ` +
      `Start: ${config.startNumber} | ` +
      `Nummerierung: ${config.digits}`
    );

    configLine.style.marginTop = '6px';
    summary.append(configLine);

    const perType = summaryByType(plan);

    if (perType.length) {
      const typeLine = el(
        'div',
        '',
        perType.map(entry =>
          `${entry.typeLabel}: ` +
          `${entry.changed}/${entry.total}`
        ).join(' | ')
      );

      typeLine.style.marginTop = '8px';
      summary.append(typeLine);
    }

    const wrapper = el('div');
    wrapper.id =
      'nilspe-rename-preview-table-wrapper';

    const table = el(
      'table',
      'table table-striped table-condensed table-hover'
    );

    const thead = el('thead');
    const headerRow = el('tr');

    for (const text of [
      'Building-ID',
      'Typ',
      'Alter Name',
      'Neuer Name'
    ]) {
      headerRow.append(
        el('th', '', text)
      );
    }

    thead.append(headerRow);

    const tbody = el('tbody');

    const previewItems = changed.slice(
      0,
      2000
    );

    for (const item of previewItems) {
      const row = el('tr');

      const id = el(
        'td',
        '',
        String(item.id)
      );

      const type = el(
        'td',
        '',
        item.typeLabel
      );

      const oldName = el(
        'td',
        '',
        item.oldName
      );

      const newName = el(
        'td',
        'nilspe-rename-changed',
        item.newName
      );

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

    if (
      changed.length >
      previewItems.length
    ) {
      const note = el(
        'div',
        'alert alert-info',
        `Vorschau auf ${formatCount(previewItems.length)} ` +
        `von ${formatCount(changed.length)} Änderungen begrenzt.`
      );

      note.style.margin = '10px';

      wrapper.append(note);
    }

    const footer = el('div');
    footer.id =
      'nilspe-rename-preview-footer';

    const closeBottom = el(
      'button',
      'btn btn-default',
      'Schließen'
    );

    closeBottom.type = 'button';

    closeBottom.addEventListener(
      'click',
      closePreview
    );

    footer.append(closeBottom);

    modal.append(
      header,
      summary,
      wrapper,
      footer
    );

    backdrop.append(modal);

    backdrop.addEventListener(
      'click',
      event => {
        if (event.target === backdrop) {
          closePreview();
        }
      }
    );

    document.body.append(backdrop);
  }

  async function preview() {
    if (running || busy) return;

    busy = true;

    try {
      const {
        config,
        plan
      } = await selection();

      showPreview(plan, config);

      const changed = plan.filter(
        item => item.changed
      ).length;

      setProgress(
        `Vorschau: ${formatCount(changed)} Namen werden geändert`,
        0, 0, 0,
        changed ? 'warning' : 'success'
      );
    } catch (error) {
      console.error(
        PREFIX,
        'Vorschau fehlgeschlagen:',
        error
      );

      setProgress(
        `Fehler: ${error.message ?? error}`,
        0, 0, 0,
        'danger'
      );
    } finally {
      busy = false;
    }
  }

  /*
   * ==========================================
   * UMBENENNDURCHLAUF
   * ==========================================
   */

  async function run(buttons) {
    if (running || busy) {
      return;
    }

    busy = true;

    try {
      const {
        config,
        plan
      } = await selection();

      const changes = plan.filter(
        item => item.changed
      );

      if (!changes.length) {
        setProgress(
          'Alle Gebäudenamen sind bereits korrekt',
          0, 0, 0, 'success'
        );
        return;
      }

      const confirmed = window.confirm(
        `${formatCount(changes.length)} Gebäude ` +
        `werden umbenannt.\n\n` +
        `Namens-Suffix: ${config.suffix || '(leer)'}\n` +
        `Startnummer: ${config.startNumber}\n` +
        `Nummerierung: ${config.digits}\n\n` +
        `Umbenennung jetzt starten?`
      );

      if (!confirmed) {
        setProgress(
          'Umbenennung nicht gestartet',
          0, 0, 0, 'warning'
        );
        return;
      }

      running = true;
      cancelRequested = false;

      for (const button of buttons) {
        button.disabled = true;
      }

      ensureProgress();

      const cancelButton = document.getElementById(
        'nilspe-rename-building-cancel'
      );

      if (cancelButton) {
        cancelButton.disabled = false;
      }

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;
      let renamed = 0;

      async function worker() {
        while (!cancelRequested) {
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
              PREFIX,
              'Gebäude fehlgeschlagen:',
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
              changes.length
            )
          },
          () => worker()
        )
      );

      if (renamed > 0) {
        setProgress(
          'Gebäude-Cache wird aktualisiert ...',
          completed,
          errors,
          changes.length,
          'info'
        );

        try {
          await refreshBuildingCache();
        } catch (error) {
          console.warn(
            PREFIX,
            'Cache konnte nicht aktualisiert werden:',
            error
          );
        }
      }

      if (cancelRequested) {
        setProgress(
          `Abgebrochen: ${formatCount(renamed)} umbenannt, ` +
          `${formatCount(errors)} Fehler, ` +
          `${formatCount(changes.length - completed)} offen`,
          completed,
          errors,
          changes.length,
          'warning'
        );
      } else {
        setProgress(
          `Fertig: ${formatCount(renamed)} umbenannt, ` +
          `${formatCount(errors)} Fehler`,
          completed,
          errors,
          changes.length,
          errors ? 'warning' : 'success'
        );
      }

    } catch (error) {
      console.error(
        PREFIX,
        'Lauf fehlgeschlagen:',
        error
      );

      setProgress(
        `Fehler: ${error.message ?? error}`,
        0, 0, 0,
        'danger'
      );
    } finally {
      running = false;
      busy = false;
      cancelRequested = false;

      for (const button of buttons) {
        button.disabled = false;
      }

      const cancelButton = document.getElementById(
        'nilspe-rename-building-cancel'
      );

      if (cancelButton) {
        cancelButton.disabled = true;
      }
    }
  }

  /*
   * ==========================================
   * BUTTONS
   * ==========================================
   */

  function settingsButton() {
    const button = el(
      'a',
      'btn btn-default btn-xs'
    );

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    button.append(
      el(
        'span',
        'glyphicon glyphicon-cog'
      )
    );

    return button;
  }

  function buildingTable() {
    return (
      document.getElementById(
        'building_table'
      ) ??
      document.querySelector(
        '#tab_buildings table'
      )
    );
  }

  function addButtons() {
    const heading = document.querySelector(
      'h1[building_type]'
    );

    if (
      Number(
        heading?.getAttribute(
          'building_type'
        )
      ) !== 7 ||
      document.getElementById(
        'nilspe-rename-building-buttons'
      )
    ) {
      return;
    }

    const table = buildingTable();

    if (!table?.parentElement) {
      return;
    }

    const group = el(
      'div',
      'btn-group'
    );

    group.id =
      'nilspe-rename-building-buttons';

    const previewButton = el(
      'button',
      'btn btn-default btn-xs',
      'Umbenennvorschau'
    );

    const renameButton = el(
      'button',
      'btn btn-primary btn-xs',
      'Gebäude umbenennen'
    );

    previewButton.type = 'button';
    renameButton.type = 'button';

    const buttons = [
      previewButton,
      renameButton
    ];

    previewButton.addEventListener(
      'click',
      () => void preview()
    );

    renameButton.addEventListener(
      'click',
      () => void run(buttons)
    );

    group.append(
      previewButton,
      renameButton,
      settingsButton()
    );

    const row = el('div');

    row.id =
      'nilspe-rename-building-button-row';

    row.style.cssText =
      'display:block;width:100%;margin:0';

    row.append(group);

    table.parentElement.insertBefore(
      row,
      table
    );
  }

  /*
   * ==========================================
   * INITIALISIERUNG
   * ==========================================
   */

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();
  } else {
    addButtons();

    new MutationObserver(addButtons).observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );
})();
