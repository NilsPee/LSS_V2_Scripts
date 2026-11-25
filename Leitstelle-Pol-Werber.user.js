
// ==UserScript==
// @name         Leitstelle Pol-Werber
// @namespace    NilsPe.police.personnel
// @version      1.1.1
// @description  Verteilt unausgebildetes Personal aus Polizei- und BePo-Wachen auf Polizeiwachen
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Pol-Werber.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Pol-Werber.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const PREFIX = '[Leitstelle Pol-Werber]';
  const VERSION = '1.1.1';
  const SETTINGS_IDENTIFIER = 'nilspe_police_personnel';

  let RUN_LOCK_KEY = null;
  let SESSION_RUN_KEY = null;

  const POLICE_TYPES = [6, 19];
  const SOURCE_TYPES = [6, 11, 19];

  const KEYS = {
    targetPersonnel: 'nilspe_police_target_personnel',
    policeReserve: 'nilspe_police_police_reserve',
    bepoReserve: 'nilspe_police_bepo_reserve',
    excludedTargets: 'nilspe_police_excluded_targets',
    excludedSources: 'nilspe_police_excluded_sources',
    excludedDispatchCenters: 'nilspe_police_excluded_dispatch_centers',
    limitedDispatchCenters: 'nilspe_police_limited_dispatch_centers',
    requestDelay: 'nilspe_police_request_delay'
  };

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  /*
   * ==========================================
   * ACCOUNT / LAUFSPERRE
   * ==========================================
   */

  async function initializeAccountKeys() {
    const accountId = await getCurrentAccountId();

    RUN_LOCK_KEY =
      `nilspe_police_personnel_running_${accountId}`;

    SESSION_RUN_KEY =
      `nilspe_police_personnel_session_${accountId}`;
  }

  async function storedArray(key) {
    const value = await GM.getValue(key, '[]');
    const parsed = parseJson(value, []);

    return Array.isArray(parsed)
      ? parsed.map(Number).filter(Number.isFinite)
      : [];
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
      personal_count: Number(building.personal_count ?? 0),
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

  /*
   * ==========================================
   * EINSTELLUNGEN
   * ==========================================
   *
   * Alle bestehenden Speicherkeys bleiben
   * unverändert.
   */

  const SETTINGS_DEFINITIONS = [
    {
      type: 'header',
      text: 'Allgemeine Einstellungen'
    },
    {
      type: 'number',
      key: KEYS.targetPersonnel,
      label: 'Zielpersonal der Polizeiwachen',
      min: 0,
      max: 400,
      default: 36
    },
    {
      type: 'number',
      key: KEYS.policeReserve,
      label: 'Mindestpersonal auf Polizei-Quellwachen',
      min: 2,
      max: 400,
      default: 36
    },
    {
      type: 'number',
      key: KEYS.bepoReserve,
      label: 'Mindestpersonal auf BePo-Quellwachen',
      min: 0,
      max: 400,
      default: 244
    },
    {
      type: 'number',
      key: KEYS.requestDelay,
      label: 'Pause zwischen Anfragen [ms]',
      min: 0,
      max: 5000,
      default: 100
    },
    {
      type: 'select',
      selectType: 'police_buildings',
      key: KEYS.excludedTargets,
      label: 'Polizeiwachen, die nicht aufgefüllt werden',
      title: 'Zielwachen ausschließen',
      multiple: true
    },
    {
      type: 'select',
      selectType: 'police_personnel_generating_buildings',
      key: KEYS.excludedSources,
      label: 'Wachen, von denen kein Personal genommen wird',
      title: 'Quellwachen ausschließen',
      multiple: true
    },
    {
      type: 'select',
      selectType: 'dispatch_centers',
      key: KEYS.excludedDispatchCenters,
      label: 'Quell-Leitstellen ausschließen',
      title: 'Leitstellen ausschließen',
      multiple: true
    },
    {
      type: 'select',
      selectType: 'dispatch_centers',
      key: KEYS.limitedDispatchCenters,
      label: 'Quellen auf diese Leitstellen begrenzen',
      title: 'Erlaubte Leitstellen',
      multiple: true
    }
  ];

  /*
   * ==========================================
   * EINSTELLUNGSSTYLES
   * ==========================================
   */

  function injectSettingsStyles() {
    if (document.getElementById('nilspe-pol-settings-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-pol-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-pol-groups {
        margin-bottom: 24px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-group > summary {
        padding: 9px 12px;
        cursor: pointer;
        background: #8882;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-group-body {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-help {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-field {
        box-sizing: border-box;
        margin-bottom: 4px;
        padding: 7px 9px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-field
      .form-group {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-field
      .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-number
      .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-number
      label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-number
      input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        box-sizing: border-box;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        text-align: left;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-select
      label {
        display: block;
        margin-bottom: 6px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-select
      .bootstrap-select {
        max-width: 100%;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-select
      .bootstrap-select > button {
        min-height: 28px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-bulk {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 110px;
        height: 28px;
        margin: 0 !important;
        padding: 2px 6px !important;
        font-size: 13px;
        line-height: 1;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-pol-count {
        font-size: 12px;
        opacity: .75;
      }
    `;

    document.head.append(style);
  }

  function pageJQuery() {
    if (typeof unsafeWindow !== 'undefined') {
      return unsafeWindow.jQuery ??
        unsafeWindow.$ ??
        null;
    }

    return null;
  }

  function refreshSelectpicker(select) {
    const jq = pageJQuery();

    if (typeof jq !== 'function') {
      return;
    }

    const picker = jq(select);

    if (typeof picker.selectpicker === 'function') {
      picker.selectpicker('refresh');
    }
  }

  /*
   * ==========================================
   * FORMULARFELDER ERKENNEN
   * ==========================================
   */

  function findSettingField(body, key) {
    const prefix = `nilspe_setting_${key}_`;

    const control = Array.from(
      body.querySelectorAll('input[id], select[id]')
    ).find(node =>
      node.id.startsWith(prefix)
    );

    if (!control) {
      return null;
    }

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

  /*
   * ==========================================
   * AUFKLAPPBARE GRUPPEN
   * ==========================================
   */

  function makeGroup(title, description) {
    const details = document.createElement('details');
    details.className = 'nilspe-pol-group';

    const summary = document.createElement('summary');
    summary.textContent = title;

    const content = document.createElement('div');
    content.className = 'nilspe-pol-group-body';

    if (description) {
      const info = document.createElement('p');
      info.className = 'nilspe-pol-help';
      info.textContent = description;
      content.append(info);
    }

    details.append(summary, content);

    return { details, content };
  }

  /*
   * ==========================================
   * MEHRFACHAUSWAHL
   * ==========================================
   */

  function decorateSelect(container, select) {
    const toolbar = document.createElement('div');
    toolbar.className = 'nilspe-pol-toolbar';

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className =
      'btn btn-default btn-xs nilspe-pol-bulk';
    clear.textContent = 'Alle abwählen';

    const count = document.createElement('span');
    count.className = 'nilspe-pol-count';

    function updateCount() {
      const selected = select.selectedOptions.length;

      count.textContent =
        `${selected} von ${select.options.length} ausgewählt`;

      container.classList.toggle(
        'selected',
        selected > 0
      );
    }

    clear.addEventListener('click', () => {
      for (const option of select.options) {
        option.selected = false;
      }

      refreshSelectpicker(select);

      select.dispatchEvent(
        new Event('change', { bubbles: true })
      );

      updateCount();
    });

    select.addEventListener('change', updateCount);

    const jq = pageJQuery();

    if (typeof jq === 'function') {
      jq(select).on(
        'changed.bs.select.nilspePolUi',
        updateCount
      );
    }

    toolbar.append(clear, count);
    container.append(toolbar);

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

    if (!body) {
      return false;
    }

    if (body.querySelector('.nilspe-pol-groups')) {
      return true;
    }

    const definitions = SETTINGS_DEFINITIONS.filter(
      item => item.key
    );

    const fields = new Map();

    for (const definition of definitions) {
      const field = findSettingField(
        body,
        definition.key
      );

      if (!field) {
        return false;
      }

      fields.set(definition.key, field);
    }

    injectSettingsStyles();

    const root = document.createElement('section');
    root.className = 'nilspe-pol-groups';

    const title = document.createElement('h2');
    title.textContent = 'Polizei-Personalwerber';

    const info = document.createElement('p');
    info.className = 'nilspe-pol-help';

    info.textContent =
      'Unausgebildetes Personal auf Polizeiwachen ' +
      'verteilen. Mindestreserven und Ausschlüsse ' +
      'werden berücksichtigt.';

    root.append(title, info);

    const groupDefinitions = [
      {
        title: 'Allgemein',
        description:
          'Zielpersonal, Mindestreserven und Anfragepause.',
        keys: [
          KEYS.targetPersonnel,
          KEYS.policeReserve,
          KEYS.bepoReserve,
          KEYS.requestDelay
        ]
      },
      {
        title: 'Zielwachen',
        description:
          'Diese Polizeiwachen werden nicht aufgefüllt.',
        keys: [KEYS.excludedTargets]
      },
      {
        title: 'Quellwachen',
        description:
          'Von diesen Polizei- und BePo-Wachen ' +
          'wird kein Personal entnommen.',
        keys: [KEYS.excludedSources]
      },
      {
        title: 'Leitstellenfilter',
        description:
          'Beide Filter betreffen ausschließlich ' +
          'die Herkunft des Personals.',
        keys: [
          KEYS.excludedDispatchCenters,
          KEYS.limitedDispatchCenters
        ]
      }
    ];

    for (const definition of groupDefinitions) {
      const group = makeGroup(
        definition.title,
        definition.description
      );

      for (const key of definition.keys) {
        const field = fields.get(key);

        field.container.classList.add('nilspe-pol-field');

        if (field.control.tagName === 'SELECT') {
          field.container.classList.add('nilspe-pol-select');

          decorateSelect(
            field.container,
            field.control
          );
        } else {
          field.container.classList.add(
            'nilspe-pol-number',
            'selected'
          );
        }

        group.content.append(field.container);
      }

      root.append(group.details);
    }

    for (const child of Array.from(body.children)) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        child.textContent.trim() ===
          'Allgemeine Einstellungen'
      ) {
        child.remove();
      }
    }

    body.prepend(root);

    console.log(
      PREFIX,
      `UI v${VERSION} geladen:`,
      fields.size,
      'Felder in vier Gruppen'
    );

    return true;
  }

  /*
   * ==========================================
   * EINSTELLUNGEN INITIALISIEREN
   * ==========================================
   */

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      const warning = document.createElement('div');
      warning.className = 'alert alert-danger';
      warning.textContent =
        'Polizei-Personal-Werber: NilsPe-Skriptbasis fehlt.';

      (
        document.querySelector('.container') ??
        document.body
      ).prepend(warning);

      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Polizei-Personal',
      settings: SETTINGS_DEFINITIONS
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

    const observer = new MutationObserver(() => {
      if (scheduled) {
        return;
      }

      scheduled = true;

      queueMicrotask(() => {
        scheduled = false;

        try {
          groupRenderedSettings();
        } catch (error) {
          console.error(
            PREFIX,
            'UI-Gruppierung fehlgeschlagen:',
            error
          );
        }
      });
    });

    observer.observe(body, {
      childList: true
    });

    groupRenderedSettings();
  }

  /*
   * ==========================================
   * GEBÄUDE / SEITENKONTEXT
   * ==========================================
   */

  function currentBuildingId() {
    const match = location.pathname.match(
      /^\/buildings\/(\d+)/
    );

    return match ? Number(match[1]) : null;
  }

  function currentBuildingType() {
    return Number(
      document.querySelector('h1[building_type]')
        ?.getAttribute('building_type')
    );
  }

  function csrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ?? '';
  }

  /*
   * ==========================================
   * FORTSCHRITTSANZEIGE
   * ==========================================
   */

  function ensureProgressUi() {
    if (document.getElementById('nilspe-police-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-police-style';

    style.textContent = `
      #nilspe-police-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-police-track {
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-police-fill {
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
    `;

    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-police-progress';

    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:12px';

    const stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'btn btn-default btn-xs';
    stopButton.textContent = 'Abbrechen';
    stopButton.addEventListener('click', stopRun);

    const status = document.createElement('span');
    status.id = 'nilspe-police-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';

    row.append(stopButton, status);

    const track = document.createElement('div');
    track.id = 'nilspe-police-track';

    const fill = document.createElement('div');
    fill.id = 'nilspe-police-fill';

    track.append(fill);
    container.append(row, track);
    document.body.append(container);
  }

  function setProgress(
    message,
    completed = 0,
    total = 0,
    type = 'info'
  ) {
    ensureProgressUi();

    const status = document.getElementById(
      'nilspe-police-status'
    );

    const fill = document.getElementById(
      'nilspe-police-fill'
    );

    status.className = `label label-${type}`;
    status.textContent = message;

    fill.style.width = total > 0
      ? `${completed / total * 100}%`
      : '0%';
  }

  /*
   * ==========================================
   * LAUFSPERRE
   * ==========================================
   */

  async function stopRun(
    message = 'Abgebrochen',
    type = 'danger'
  ) {
    if (SESSION_RUN_KEY) {
      sessionStorage.removeItem(SESSION_RUN_KEY);
    }

    if (RUN_LOCK_KEY) {
      await GM.deleteValue(RUN_LOCK_KEY);
    }

    setProgress(message, 0, 0, type);
  }

  function runIsActive() {
    return SESSION_RUN_KEY !== null &&
      sessionStorage.getItem(SESSION_RUN_KEY) === 'true';
  }

  async function acquireRunLock() {
    if (!RUN_LOCK_KEY || !SESSION_RUN_KEY) {
      await initializeAccountKeys();
    }

    const globalLock = await GM.getValue(
      RUN_LOCK_KEY,
      false
    );

    if (globalLock && !runIsActive()) {
      console.warn(
        PREFIX,
        'Verwaister Run-Lock gefunden und entfernt.'
      );

      await GM.deleteValue(RUN_LOCK_KEY);
    }

    if (runIsActive()) {
      return false;
    }

    sessionStorage.setItem(SESSION_RUN_KEY, 'true');
    await GM.setValue(RUN_LOCK_KEY, true);

    return true;
  }

  /*
   * ==========================================
   * GEBÄUDE LADEN
   * ==========================================
   */

  async function loadBuildings() {
    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      return (
        await getAllData(db, 'buildings')
      )
        .map(normalizeBuilding)
        .filter(building =>
          SOURCE_TYPES.includes(building.building_type)
        );

    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * KONFIGURATION LADEN
   * ==========================================
   */

  async function loadConfiguration() {
    const numberValue = async (key, fallback) => {
      const value = Number(
        await GM.getValue(key, fallback)
      );

      return Number.isFinite(value)
        ? value
        : fallback;
    };

    return {
      targetPersonnel:
        await numberValue(KEYS.targetPersonnel, 36),

      policeReserve: Math.max(
        await numberValue(KEYS.policeReserve, 36),
        2
      ),

      bepoReserve: Math.max(
        await numberValue(KEYS.bepoReserve, 244),
        0
      ),

      requestDelay: Math.max(
        await numberValue(KEYS.requestDelay, 100),
        0
      ),

      excludedTargets: new Set(
        await storedArray(KEYS.excludedTargets)
      ),

      excludedSources: new Set(
        await storedArray(KEYS.excludedSources)
      ),

      excludedDispatchCenters: new Set(
        await storedArray(KEYS.excludedDispatchCenters)
      ),

      limitedDispatchCenters: new Set(
        await storedArray(KEYS.limitedDispatchCenters)
      )
    };
  }

  /*
   * ==========================================
   * ZIELWACHEN ERMITTELN
   * ==========================================
   */

  function selectTargets(
    buildings,
    configuration,
    context
  ) {
    return buildings
      .filter(building =>
        POLICE_TYPES.includes(building.building_type)
      )
      .filter(building =>
        !configuration.excludedTargets.has(building.id)
      )
      .filter(building => {
        if (context.buildingId !== null) {
          return building.id === context.buildingId;
        }

        return (
          building.leitstelle_building_id ===
          context.dispatchCenterId
        );
      })
      .map(building => ({
        ...building,

        needed: Math.max(
          configuration.targetPersonnel -
          building.personal_count,
          0
        )
      }))
      .filter(building => building.needed > 0)
      .sort((a, b) => a.id - b.id);
  }

  /*
   * ==========================================
   * QUELLWACHEN ERMITTELN
   * ==========================================
   */

  function selectSources(
    buildings,
    configuration
  ) {
    const limited =
      configuration.limitedDispatchCenters.size > 0;

    return buildings
      .filter(building =>
        !configuration.excludedSources.has(building.id)
      )
      .filter(building =>
        !configuration.excludedDispatchCenters.has(
          building.leitstelle_building_id
        )
      )
      .filter(building =>
        !limited ||
        configuration.limitedDispatchCenters.has(
          building.leitstelle_building_id
        )
      )
      .map(building => {
        const reserve =
          building.building_type === 11
            ? configuration.bepoReserve
            : configuration.policeReserve;

        return {
          ...building,
          reserve,

          available: Math.max(
            building.personal_count - reserve,
            0
          )
        };
      })
      .filter(building =>
        building.available > 0
      )
      .sort((a, b) =>
        b.available - a.available ||
        a.id - b.id
      );
  }

  /*
   * ==========================================
   * UNAUSGEBILDETES PERSONAL
   * ==========================================
   */

  function untrainedPersonnelIds(
    documentFromResponse,
    sourceBuildingId
  ) {
    const table =
      documentFromResponse.getElementById(
        `personal_table_${sourceBuildingId}`
      ) ??
      documentFromResponse.querySelector('table');

    if (!table) {
      return [];
    }

    const personnelIds = [];

    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = row.querySelectorAll('td');

      const input = cells[0]?.querySelector(
        'input[value]'
      );

      const schooling =
        cells[2]?.textContent.trim() ?? '';

      const course =
        cells[3]?.textContent.trim() ?? '';

      if (
        input &&
        schooling === '' &&
        course === ''
      ) {
        personnelIds.push(input.value);
      }
    }

    return personnelIds;
  }

  /*
   * ==========================================
   * LIVE-PERSONALZÄHLUNG
   * ==========================================
   */

  function personnelCountFromDocument(
    documentFromResponse,
    buildingId
  ) {
    const table =
      documentFromResponse.getElementById(
        `personal_table_${buildingId}`
      ) ??
      documentFromResponse.querySelector('table');

    return table?.querySelectorAll(
      'tbody tr input[value]'
    ).length ?? null;
  }

  async function livePersonnelCount(buildingId) {
    const response = await fetch(
      `/buildings/${buildingId}/schooling_personal_select`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Personalzählung HTTP ${response.status}`
      );
    }

    const doc = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );

    return personnelCountFromDocument(
      doc,
      buildingId
    );
  }

  async function refreshTargetNeed(
    target,
    configuration
  ) {
    try {
      const liveCount = await livePersonnelCount(target.id);

      if (Number.isInteger(liveCount)) {
        target.personal_count = Math.max(
          target.personal_count,
          liveCount
        );

        target.needed = Math.max(
          configuration.targetPersonnel -
          target.personal_count,
          0
        );
      }

    } catch (error) {
      console.warn(
        PREFIX,
        'Ziel-Personalzählung fehlgeschlagen:',
        target.id,
        error
      );
    }

    return target.needed;
  }

  /*
   * ==========================================
   * VERFÜGBARES PERSONAL
   * ==========================================
   */

  async function availablePersonnelIds(
    sourceBuilding
  ) {
    const response = await fetch(
      `/buildings/${sourceBuilding.id}/schooling_personal_select`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `${sourceBuilding.caption}: ` +
        `Personalabfrage HTTP ${response.status}`
      );
    }

    const doc = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );

    const livePersonnel = personnelCountFromDocument(
      doc,
      sourceBuilding.id
    );

    const liveAvailable = Number.isInteger(livePersonnel)
      ? Math.max(
          livePersonnel - sourceBuilding.reserve,
          0
        )
      : sourceBuilding.available;

    const allowed = Math.min(
      sourceBuilding.available,
      liveAvailable
    );

    if (allowed <= 0) {
      return [];
    }

    return untrainedPersonnelIds(
      doc,
      sourceBuilding.id
    ).slice(0, allowed);
  }

  /*
   * ==========================================
   * PERSONAL ÜBERNEHMEN
   * ==========================================
   */

  async function adoptPersonnel(
    targetBuildingId,
    personnelIds
  ) {
    const token = csrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token wurde nicht gefunden.'
      );
    }

    const form = new URLSearchParams();

    form.append('utf8', '✓');
    form.append('authenticity_token', token);

    for (const personnelId of personnelIds) {
      form.append('personal_ids[]', personnelId);
    }

    form.append('commit', 'Personal übernehmen');

    const response = await fetch(
      `/buildings/${targetBuildingId}/adopt`,
      {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
        redirect: 'manual'
      }
    );

    if (response.status >= 400) {
      throw new Error(
        `Personalübernahme HTTP ${response.status}`
      );
    }
  }

  /*
   * ==========================================
   * ZIELWACHE AUFFÜLLEN
   * ==========================================
   */

  async function fillTarget(
    target,
    sources,
    requestDelay,
    personnelPools
  ) {
    const selectedPersonnel = [];
    const selections = [];

    for (const source of sources) {
      if (
        !runIsActive() ||
        selectedPersonnel.length >= target.needed
      ) {
        break;
      }

      if (
        source.available <= 0 ||
        source.id === target.id
      ) {
        continue;
      }

      try {
        if (!personnelPools.has(source.id)) {
          personnelPools.set(
            source.id,
            await availablePersonnelIds(source)
          );
        }

        const pool = personnelPools.get(source.id);

        const count = Math.min(
          target.needed - selectedPersonnel.length,
          source.available,
          pool.length
        );

        const ids = pool.splice(0, count);

        if (ids.length === 0) {
          source.available = 0;
          continue;
        }

        selectedPersonnel.push(...ids);

        selections.push({
          source,
          pool,
          ids
        });

        source.available -= ids.length;

        if (
          selectedPersonnel.length >= target.needed
        ) {
          break;
        }

      } catch (error) {
        console.warn(
          PREFIX,
          'Quelle übersprungen:',
          error
        );
      }

      if (requestDelay > 0) {
        await sleep(requestDelay);
      }
    }

    if (selectedPersonnel.length === 0) {
      return 0;
    }

    try {
      await adoptPersonnel(
        target.id,
        selectedPersonnel
      );

    } catch (error) {
      for (
        const { source, pool, ids }
        of selections.reverse()
      ) {
        pool.unshift(...ids);
        source.available += ids.length;
      }

      throw error;
    }

    target.personal_count += selectedPersonnel.length;

    target.needed = Math.max(
      target.needed - selectedPersonnel.length,
      0
    );

    return selectedPersonnel.length;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function runRecruiter() {
    try {
      if (!await acquireRunLock()) {
        setProgress(
          'Personalwerber läuft bereits.',
          0,
          0,
          'warning'
        );
        return;
      }

      setProgress('Gebäude werden geladen ...');

      const configuration = await loadConfiguration();

      if (configuration.targetPersonnel <= 0) {
        throw new Error(
          'Das Zielpersonal ist nicht größer als 0.'
        );
      }

      const buildings = await loadBuildings();

      const type = currentBuildingType();
      const id = currentBuildingId();

      const context = {
        buildingId:
          POLICE_TYPES.includes(type)
            ? id
            : null,

        dispatchCenterId:
          type === 7
            ? id
            : null
      };

      const targets = selectTargets(
        buildings,
        configuration,
        context
      );

      const sources = selectSources(
        buildings,
        configuration
      );

      if (targets.length === 0) {
        await stopRun(
          'Keine Polizeiwache muss aufgefüllt werden',
          'success'
        );
        return;
      }

      if (sources.length === 0) {
        throw new Error(
          'Kein Personal oberhalb der eingestellten Reserven.'
        );
      }

      let completed = 0;
      let errors = 0;
      let transferred = 0;

      const personnelPools = new Map();

      for (const target of targets) {
        if (!runIsActive()) {
          return;
        }

        setProgress(
          `${completed}/${targets.length}: ${target.caption}`,
          completed,
          targets.length
        );

        try {
          await refreshTargetNeed(
            target,
            configuration
          );

          if (target.needed <= 0) {
            completed++;

            setProgress(
              `${completed}/${targets.length} Wachen, ` +
              `${transferred} Personen`,
              completed,
              targets.length,
              errors ? 'warning' : 'success'
            );

            continue;
          }

          transferred += await fillTarget(
            target,
            sources,
            configuration.requestDelay,
            personnelPools
          );

        } catch (error) {
          errors++;

          console.error(
            PREFIX,
            'Zielwache fehlgeschlagen:',
            target.id,
            error
          );
        }

        completed++;

        setProgress(
          `${completed}/${targets.length} Wachen, ` +
          `${transferred} Personen`,
          completed,
          targets.length,
          errors ? 'warning' : 'success'
        );
      }

      await stopRun(
        `Fertig: ${transferred} Personen übernommen, ` +
        `${errors} Fehler`,
        errors ? 'warning' : 'success'
      );

    } catch (error) {
      console.error(
        PREFIX,
        'Lauf fehlgeschlagen:',
        error
      );

      await stopRun(
        `Fehler: ${error.message ?? error}`,
        'danger'
      );
    }
  }

  /*
   * ==========================================
   * EINSTELLUNGSBUTTON
   * ==========================================
   */

  function settingsButton() {
    const button = document.createElement('a');

    button.className = 'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';

    const icon = document.createElement('span');

    icon.className = 'glyphicon glyphicon-cog';

    icon.title = 'Einstellungen';

    button.append(icon);

    return button;
  }

  /*
   * ==========================================
   * BUTTONS AN LEITSTELLE / POLIZEIWACHE
   * ==========================================
   *
   * v1.1.1:
   * Gleiche Beschriftung und Anordnung
   * wie beim BePo-Werber.
   */

  function addBuildingButtons() {
    const details = document.querySelector(
      '.building-title ~ dl.dl-horizontal'
    );

    if (
      !details ||
      document.getElementById('nilspe-police-buttons')
    ) {
      return;
    }

    const term = document.createElement('dt');

    const strong = document.createElement('strong');

    // Angepasst an BePo-Werber
    strong.textContent = 'Personal werben:';

    term.append(strong);

    const description = document.createElement('dd');

    const group = document.createElement('div');

    group.id = 'nilspe-police-buttons';
    group.className = 'btn-group';

    const startButton = document.createElement('button');

    startButton.type = 'button';

    startButton.className =
      'btn btn-default btn-xs';

    // Angepasst an BePo-Werber
    startButton.textContent = 'Polizei-Personal werben';

    startButton.addEventListener(
      'click',
      runRecruiter
    );

    group.append(
      startButton,
      settingsButton()
    );

    description.append(group);

    details.append(
      term,
      description
    );
  }

  /*
   * ==========================================
   * INITIALISIERUNG
   * ==========================================
   */

  if (
    location.pathname.startsWith('/settings/index')
  ) {
    await createSettings();
    return;
  }

  const buildingType = currentBuildingType();

  if (![7, ...POLICE_TYPES].includes(buildingType)) {
    return;
  }

  window.addEventListener('pagehide', () => {
    if (runIsActive()) {
      sessionStorage.removeItem(SESSION_RUN_KEY);
      GM.deleteValue(RUN_LOCK_KEY);
    }
  });

  addBuildingButtons();

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );

})();
