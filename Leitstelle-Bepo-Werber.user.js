
// ==UserScript==
// @name         Leitstelle-Bepo-Werber
// @namespace    NilsPe.bepo.personnel
// @version      1.1.2
// @description  Verteilt unausgebildetes Personal aus Polizei- und BePo-Wachen auf BePo-Zielwachen
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Bepo-Werber.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Bepo-Werber.user.js
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

  const PREFIX = '[Leitstelle BePo-Werber]';
  const VERSION = '1.1.2';
  const SETTINGS_IDENTIFIER = 'nilspe_bepo_personnel';

  let RUN_LOCK_KEY = null;
  let SESSION_RUN_KEY = null;

  const KEYS = {
    targetPersonnel: 'nilspe_bepo_target_personnel',
    policeReserve: 'nilspe_bepo_police_reserve',
    bepoReserve: 'nilspe_bepo_bepo_reserve',
    excludedTargets: 'nilspe_bepo_excluded_targets',
    excludedSources: 'nilspe_bepo_excluded_sources',
    excludedDispatchCenters: 'nilspe_bepo_excluded_dispatch_centers',
    limitedDispatchCenters: 'nilspe_bepo_limited_dispatch_centers',
    requestDelay: 'nilspe_bepo_request_delay'
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

  async function initializeAccountKeys() {
    const accountId = await getCurrentAccountId();

    RUN_LOCK_KEY =
      `nilspe_bepo_personnel_running_${accountId}`;

    SESSION_RUN_KEY =
      `nilspe_bepo_personnel_session_${accountId}`;
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
   * Unveränderte Speicherkeys.
   *
   * Die NilsPe-Skriptbasis übernimmt weiterhin
   * die Speicherung sämtlicher Felder.
   */

  const SETTINGS_DEFINITIONS = [
    {
      type: 'header',
      text: 'Allgemeine Einstellungen'
    },
    {
      type: 'number',
      key: KEYS.targetPersonnel,
      label: 'Zielpersonal der BePo-Wachen',
      min: 0,
      max: 400,
      default: 0
    },
    {
      type: 'number',
      key: KEYS.policeReserve,
      label: 'Mindestpersonal auf Polizeiwachen',
      min: 2,
      max: 400,
      default: 36
    },
    {
      type: 'number',
      key: KEYS.bepoReserve,
      label: 'Mindestpersonal auf BePo-Wachen',
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
      selectType: 'bepo_buildings',
      key: KEYS.excludedTargets,
      label: 'BePo-Wachen, die nicht aufgefüllt werden',
      title: 'Zielwachen ausschließen',
      multiple: true
    },
    {
      type: 'select',
      selectType: 'bepo_personnel_generating_buildings',
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
   * EINSTELLUNGSOBERFLÄCHE
   * ==========================================
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-bepo-settings-style'
      )
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-bepo-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-bepo-groups {
        margin-bottom: 24px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-group > summary {
        padding: 9px 12px;
        cursor: pointer;
        background: #8882;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-group-body {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-help {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-field {
        box-sizing: border-box;
        margin-bottom: 4px;
        padding: 7px 9px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-field
      .form-group {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-field
      .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-number
      .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-number
      label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-number
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

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-select
      label {
        display: block;
        margin-bottom: 6px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-select
      .bootstrap-select {
        max-width: 100%;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-select
      .bootstrap-select > button {
        min-height: 28px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-bulk {
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

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-count {
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

    if (
      typeof picker.selectpicker === 'function'
    ) {
      picker.selectpicker('refresh');
    }
  }

  /*
   * ==========================================
   * FELDER DER SKRIPTBASIS ERKENNEN
   * ==========================================
   *
   * WICHTIGE KORREKTUR v1.1.2:
   *
   * Zahlenfelder:
   *
   * body
   *   -> .form-group
   *       -> .col-sm-6
   *           -> input
   *
   * Mehrfachauswahlen:
   *
   * body
   *   -> div
   *       -> .form-group
   *           -> .col-sm-6
   *               -> select
   *
   * Es wird immer der vollständige direkte
   * Kindknoten des Einstellungs-Bodys gesucht.
   */

  function findSettingField(body, key) {
    const prefix =
      `nilspe_setting_${key}_`;

    const control = Array.from(
      body.querySelectorAll(
        'input[id], select[id]'
      )
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

    if (
      container.parentElement !== body
    ) {
      return null;
    }

    return {
      control,
      container
    };
  }

  function makeGroup(title, description) {
    const details = document.createElement(
      'details'
    );

    details.className =
      'nilspe-bepo-group';

    const summary = document.createElement(
      'summary'
    );

    summary.textContent = title;

    const content = document.createElement(
      'div'
    );

    content.className =
      'nilspe-bepo-group-body';

    if (description) {
      const info = document.createElement('p');

      info.className =
        'nilspe-bepo-help';

      info.textContent = description;

      content.append(info);
    }

    details.append(summary, content);

    return {
      details,
      content
    };
  }

  function decorateSelect(
    container,
    select
  ) {
    const toolbar = document.createElement(
      'div'
    );

    toolbar.className =
      'nilspe-bepo-toolbar';

    const clear = document.createElement(
      'button'
    );

    clear.type = 'button';

    clear.className =
      'btn btn-default btn-xs nilspe-bepo-bulk';

    clear.textContent =
      'Alle abwählen';

    const count = document.createElement(
      'span'
    );

    count.className =
      'nilspe-bepo-count';

    function updateCount() {
      const selected =
        select.selectedOptions.length;

      count.textContent =
        `${selected} von ${select.options.length} ausgewählt`;

      container.classList.toggle(
        'selected',
        selected > 0
      );
    }

    clear.addEventListener(
      'click',
      () => {
        for (const option of select.options) {
          option.selected = false;
        }

        refreshSelectpicker(select);

        // Die Skriptbasis speichert über
        // das reguläre change-Ereignis.
        select.dispatchEvent(
          new Event('change', {
            bubbles: true
          })
        );

        updateCount();
      }
    );

    select.addEventListener(
      'change',
      updateCount
    );

    const jq = pageJQuery();

    if (typeof jq === 'function') {
      jq(select).on(
        'changed.bs.select.nilspeBepoUi',
        updateCount
      );
    }

    toolbar.append(
      clear,
      count
    );

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
    )?.querySelector(
      '.settings-tab-body'
    );

    if (!body) {
      return false;
    }

    if (
      body.querySelector(
        '.nilspe-bepo-groups'
      )
    ) {
      return true;
    }

    const definitions =
      SETTINGS_DEFINITIONS.filter(
        item => item.key
      );

    const fields = new Map();

    /*
     * Erst dann umbauen, wenn ALLE
     * Eingaben vollständig vorhanden sind.
     */

    for (const definition of definitions) {
      const field = findSettingField(
        body,
        definition.key
      );

      if (!field) {
        return false;
      }

      fields.set(
        definition.key,
        field
      );
    }

    injectSettingsStyles();

    const root = document.createElement(
      'section'
    );

    root.className =
      'nilspe-bepo-groups';

    const title = document.createElement(
      'h2'
    );

    title.textContent =
      'BePo-Personalwerber';

    const info = document.createElement(
      'p'
    );

    info.className =
      'nilspe-bepo-help';

    info.textContent =
      'Unausgebildetes Personal auf ' +
      'BePo-Zielwachen verteilen. ' +
      'Mindestreserven und Ausschlüsse ' +
      'werden berücksichtigt.';

    root.append(
      title,
      info
    );

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
          'Diese BePo-Wachen werden nicht aufgefüllt.',
        keys: [
          KEYS.excludedTargets
        ]
      },
      {
        title: 'Quellwachen',
        description:
          'Von diesen Wachen wird kein Personal entnommen.',
        keys: [
          KEYS.excludedSources
        ]
      },
      {
        title: 'Leitstellenfilter',
        description:
          'Beide Filter betreffen ausschließlich die Personalquellen.',
        keys: [
          KEYS.excludedDispatchCenters,
          KEYS.limitedDispatchCenters
        ]
      }
    ];

    /*
     * Die Original-Elemente umhängen.
     * Alle Event-Listener bleiben erhalten.
     */

    for (const definition of groupDefinitions) {
      const group = makeGroup(
        definition.title,
        definition.description
      );

      for (const key of definition.keys) {
        const field = fields.get(key);

        field.container.classList.add(
          'nilspe-bepo-field'
        );

        if (
          field.control.tagName === 'SELECT'
        ) {
          field.container.classList.add(
            'nilspe-bepo-select'
          );

          decorateSelect(
            field.container,
            field.control
          );

        } else {
          field.container.classList.add(
            'nilspe-bepo-number'
          );

          field.container.classList.add(
            'selected'
          );
        }

        group.content.append(
          field.container
        );
      }

      root.append(
        group.details
      );
    }

    /*
     * Nur die alte Überschrift entfernen.
     * Keine Formularfelder löschen.
     */

    for (const child of Array.from(
      body.children
    )) {
      if (
        /^H[1-6]$/.test(
          child.tagName
        ) &&
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
   * TAB-RENDERING BEOBACHTEN
   * ==========================================
   *
   * addOptions() baut die Einstellungen
   * erst beim Öffnen des Tabs auf.
   *
   * Die Gruppierung wird deshalb sowohl
   * bei Direktaufruf per Hash als auch
   * beim normalen Tabwechsel ausgeführt.
   */

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(
        PREFIX,
        'NilsPe-Skriptbasis fehlt.'
      );

      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'BePo-Personal',
      settings: SETTINGS_DEFINITIONS
    });

    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector(
      '.settings-tab-body'
    );

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
   * GEBÄUDE / KONTEXT
   * ==========================================
   */

  function currentBuildingId() {
    const match = location.pathname.match(
      /^\/buildings\/(\d+)/
    );

    return match
      ? Number(match[1])
      : null;
  }

  function currentBuildingType() {
    return Number(
      document.querySelector(
        'h1[building_type]'
      )?.getAttribute(
        'building_type'
      )
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
    if (
      document.getElementById(
        'nilspe-bepo-progress'
      )
    ) {
      return;
    }

    const style = document.createElement(
      'style'
    );

    style.id = 'nilspe-bepo-style';

    style.textContent = `
      #nilspe-bepo-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-bepo-track {
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-bepo-fill {
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
    `;

    document.head.append(style);

    const container = document.createElement(
      'div'
    );

    container.id =
      'nilspe-bepo-progress';

    const row = document.createElement(
      'div'
    );

    row.style.cssText =
      'display:flex;align-items:center;gap:12px';

    const stopButton = document.createElement(
      'button'
    );

    stopButton.type = 'button';
    stopButton.className =
      'btn btn-default btn-xs';
    stopButton.textContent =
      'Abbrechen';

    stopButton.addEventListener(
      'click',
      stopRun
    );

    const status = document.createElement(
      'span'
    );

    status.id =
      'nilspe-bepo-status';

    status.className =
      'label label-info';

    status.textContent =
      'Bereit';

    row.append(
      stopButton,
      status
    );

    const track = document.createElement(
      'div'
    );

    track.id =
      'nilspe-bepo-track';

    const fill = document.createElement(
      'div'
    );

    fill.id =
      'nilspe-bepo-fill';

    track.append(fill);

    container.append(
      row,
      track
    );

    document.body.append(
      container
    );
  }

  function setProgress(
    message,
    completed = 0,
    total = 0,
    type = 'info'
  ) {
    ensureProgressUi();

    const status = document.getElementById(
      'nilspe-bepo-status'
    );

    const fill = document.getElementById(
      'nilspe-bepo-fill'
    );

    status.className =
      `label label-${type}`;

    status.textContent = message;

    fill.style.width =
      total > 0
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
      sessionStorage.removeItem(
        SESSION_RUN_KEY
      );
    }

    if (RUN_LOCK_KEY) {
      await GM.deleteValue(
        RUN_LOCK_KEY
      );
    }

    setProgress(
      message,
      0,
      0,
      type
    );
  }

  function runIsActive() {
    return SESSION_RUN_KEY !== null &&
      sessionStorage.getItem(
        SESSION_RUN_KEY
      ) === 'true';
  }

  async function acquireRunLock() {
    if (
      !RUN_LOCK_KEY ||
      !SESSION_RUN_KEY
    ) {
      await initializeAccountKeys();
    }

    const globalLock = await GM.getValue(
      RUN_LOCK_KEY,
      false
    );

    if (
      globalLock &&
      !runIsActive()
    ) {
      console.warn(
        PREFIX,
        'Verwaister Run-Lock gefunden und entfernt.'
      );

      await GM.deleteValue(
        RUN_LOCK_KEY
      );
    }

    if (runIsActive()) {
      return false;
    }

    sessionStorage.setItem(
      SESSION_RUN_KEY,
      'true'
    );

    await GM.setValue(
      RUN_LOCK_KEY,
      true
    );

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
      await updateBuildings(
        db,
        60
      );

      return (
        await getAllData(
          db,
          'buildings'
        )
      )
        .map(normalizeBuilding)
        .filter(building =>
          [6, 11].includes(
            building.building_type
          )
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
    const numberValue = async (
      key,
      fallback
    ) => {
      const value = Number(
        await GM.getValue(
          key,
          fallback
        )
      );

      return Number.isFinite(value)
        ? value
        : fallback;
    };

    return {
      targetPersonnel:
        await numberValue(
          KEYS.targetPersonnel,
          0
        ),

      policeReserve: Math.max(
        await numberValue(
          KEYS.policeReserve,
          36
        ),
        2
      ),

      bepoReserve: Math.max(
        await numberValue(
          KEYS.bepoReserve,
          244
        ),
        0
      ),

      requestDelay: Math.max(
        await numberValue(
          KEYS.requestDelay,
          100
        ),
        0
      ),

      excludedTargets: new Set(
        await storedArray(
          KEYS.excludedTargets
        )
      ),

      excludedSources: new Set(
        await storedArray(
          KEYS.excludedSources
        )
      ),

      excludedDispatchCenters: new Set(
        await storedArray(
          KEYS.excludedDispatchCenters
        )
      ),

      limitedDispatchCenters: new Set(
        await storedArray(
          KEYS.limitedDispatchCenters
        )
      )
    };
  }

  /*
   * ==========================================
   * ZIELWACHEN
   * ==========================================
   */

  function selectTargets(
    buildings,
    configuration,
    context
  ) {
    return buildings
      .filter(building =>
        building.building_type === 11
      )
      .filter(building =>
        !configuration.excludedTargets.has(
          building.id
        )
      )
      .filter(building => {
        if (
          context.buildingId !== null
        ) {
          return (
            building.id ===
            context.buildingId
          );
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
      .filter(building =>
        building.needed > 0
      )
      .sort((a, b) =>
        a.id - b.id
      );
  }

  /*
   * ==========================================
   * QUELLWACHEN
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
        !configuration.excludedSources.has(
          building.id
        )
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
            building.personal_count -
            reserve,
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
      documentFromResponse.querySelector(
        'table'
      );

    if (!table) {
      return [];
    }

    const personnelIds = [];

    for (const row of table.querySelectorAll(
      'tbody tr'
    )) {
      const cells = row.querySelectorAll(
        'td'
      );

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
        personnelIds.push(
          input.value
        );
      }
    }

    return personnelIds;
  }

  function personnelCountFromDocument(
    documentFromResponse,
    buildingId
  ) {
    const table =
      documentFromResponse.getElementById(
        `personal_table_${buildingId}`
      ) ??
      documentFromResponse.querySelector(
        'table'
      );

    if (!table) {
      return null;
    }

    return table.querySelectorAll(
      'tbody tr'
    ).length;
  }

  /*
   * ==========================================
   * LIVE-PERSONALZÄHLUNG
   * ==========================================
   */

  async function livePersonnelCount(
    buildingId
  ) {
    const response = await fetch(
      `/buildings/${buildingId}/schooling_personal_select`,
      {
        credentials: 'same-origin',

        headers: {
          'X-Requested-With':
            'XMLHttpRequest',

          'X-CSRF-Token':
            csrfToken()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Personalzählung HTTP ${response.status}`
      );
    }

    const documentFromResponse =
      new DOMParser().parseFromString(
        await response.text(),
        'text/html'
      );

    return personnelCountFromDocument(
      documentFromResponse,
      buildingId
    );
  }

  async function refreshTargetNeed(
    target,
    configuration
  ) {
    try {
      const liveCount =
        await livePersonnelCount(
          target.id
        );

      if (
        Number.isInteger(liveCount)
      ) {
        target.personal_count =
          liveCount;

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
          'X-Requested-With':
            'XMLHttpRequest',

          'X-CSRF-Token':
            csrfToken()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `${sourceBuilding.caption}: ` +
        `Personalabfrage HTTP ${response.status}`
      );
    }

    const documentFromResponse =
      new DOMParser().parseFromString(
        await response.text(),
        'text/html'
      );

    const personnelIds =
      untrainedPersonnelIds(
        documentFromResponse,
        sourceBuilding.id
      );

    const liveCount =
      personnelCountFromDocument(
        documentFromResponse,
        sourceBuilding.id
      );

    const liveAvailable =
      Number.isInteger(liveCount)
        ? Math.max(
          liveCount -
          sourceBuilding.reserve,
          0
        )
        : sourceBuilding.available;

    if (
      Number.isInteger(liveCount)
    ) {
      sourceBuilding.personal_count =
        liveCount;

      sourceBuilding.available =
        Math.min(
          sourceBuilding.available,
          liveAvailable
        );
    }

    const allowed = Math.min(
      sourceBuilding.available,
      liveAvailable,
      personnelIds.length
    );

    if (allowed <= 0) {
      return [];
    }

    return personnelIds.slice(
      0,
      allowed
    );
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

    form.append(
      'utf8',
      '✓'
    );

    form.append(
      'authenticity_token',
      token
    );

    for (const personnelId of personnelIds) {
      form.append(
        'personal_ids[]',
        personnelId
      );
    }

    form.append(
      'commit',
      'Personal übernehmen'
    );

    const response = await fetch(
      `/buildings/${targetBuildingId}/adopt`,
      {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
        redirect: 'manual'
      }
    );

    if (
      response.status >= 400
    ) {
      throw new Error(
        `Personalübernahme HTTP ${response.status}`
      );
    }
  }

  /*
   * ==========================================
   * QUELLEN SYNCHRONISIEREN
   * ==========================================
   */

  function syncSourceEntryForTarget(
    sources,
    target
  ) {
    const sourceEntry =
      sources.find(source =>
        source.id === target.id
      );

    if (!sourceEntry) {
      return;
    }

    sourceEntry.personal_count =
      target.personal_count;

    sourceEntry.available = Math.max(
      sourceEntry.personal_count -
      sourceEntry.reserve,
      0
    );
  }

  function applySuccessfulTransfer(
    target,
    sources,
    selections,
    transferred
  ) {
    target.personal_count +=
      transferred;

    target.needed = Math.max(
      target.needed -
      transferred,
      0
    );

    syncSourceEntryForTarget(
      sources,
      target
    );

    for (
      const { source, ids }
      of selections
    ) {
      source.personal_count = Math.max(
        source.personal_count -
        ids.length,
        0
      );

      source.available = Math.max(
        Math.min(
          source.available,
          source.personal_count -
          source.reserve
        ),
        0
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
        selectedPersonnel.length >=
          target.needed
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
        if (
          !personnelPools.has(
            source.id
          )
        ) {
          personnelPools.set(
            source.id,
            await availablePersonnelIds(
              source
            )
          );
        }

        const pool =
          personnelPools.get(
            source.id
          );

        const count = Math.min(
          target.needed -
          selectedPersonnel.length,
          source.available,
          pool.length
        );

        const ids = pool.splice(
          0,
          count
        );

        if (
          ids.length === 0
        ) {
          source.available = 0;
          continue;
        }

        selectedPersonnel.push(
          ...ids
        );

        selections.push({
          source,
          pool,
          ids
        });

        source.available -=
          ids.length;

        if (
          selectedPersonnel.length >=
          target.needed
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
        await sleep(
          requestDelay
        );
      }
    }

    if (
      selectedPersonnel.length === 0
    ) {
      return 0;
    }

    try {
      await adoptPersonnel(
        target.id,
        selectedPersonnel
      );

    } catch (error) {
      for (
        const {
          source,
          pool,
          ids
        }
        of selections.reverse()
      ) {
        pool.unshift(
          ...ids
        );

        source.available +=
          ids.length;
      }

      throw error;
    }

    applySuccessfulTransfer(
      target,
      sources,
      selections,
      selectedPersonnel.length
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
      if (
        !await acquireRunLock()
      ) {
        setProgress(
          'Personalwerber läuft bereits.',
          0,
          0,
          'warning'
        );

        return;
      }

      setProgress(
        'Gebäude werden geladen ...'
      );

      const configuration =
        await loadConfiguration();

      if (
        configuration.targetPersonnel <= 0
      ) {
        throw new Error(
          'Das Zielpersonal ist nicht größer als 0.'
        );
      }

      const buildings =
        await loadBuildings();

      const type =
        currentBuildingType();

      const id =
        currentBuildingId();

      const context = {
        buildingId:
          type === 11
            ? id
            : null,

        dispatchCenterId:
          type === 7
            ? id
            : null
      };

      const targets =
        selectTargets(
          buildings,
          configuration,
          context
        );

      const sources =
        selectSources(
          buildings,
          configuration
        );

      if (
        targets.length === 0
      ) {
        await stopRun(
          'Keine BePo-Wache muss aufgefüllt werden',
          'success'
        );

        return;
      }

      if (
        sources.length === 0
      ) {
        throw new Error(
          'Kein Personal oberhalb der eingestellten Reserven.'
        );
      }

      let completed = 0;
      let errors = 0;
      let transferred = 0;

      const personnelPools =
        new Map();

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

          syncSourceEntryForTarget(
            sources,
            target
          );

          if (
            target.needed <= 0
          ) {
            completed++;

            setProgress(
              `${completed}/${targets.length} Wachen, ${transferred} Personen`,
              completed,
              targets.length,
              errors
                ? 'warning'
                : 'success'
            );

            continue;
          }

          transferred +=
            await fillTarget(
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
          `${completed}/${targets.length} Wachen, ${transferred} Personen`,
          completed,
          targets.length,
          errors
            ? 'warning'
            : 'success'
        );
      }

      await stopRun(
        `Fertig: ${transferred} Personen übernommen, ${errors} Fehler`,
        errors
          ? 'warning'
          : 'success'
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
   * BUTTONS
   * ==========================================
   */

  function settingsButton() {
    const button = document.createElement(
      'a'
    );

    button.className =
      'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target =
      '_blank';

    button.title =
      'Einstellungen';

    const icon = document.createElement(
      'span'
    );

    icon.className =
      'glyphicon glyphicon-cog';

    button.append(icon);

    return button;
  }

  function addBuildingButtons() {
    const details = document.querySelector(
      '.building-title ~ dl.dl-horizontal'
    );

    if (
      !details ||
      document.getElementById(
        'nilspe-bepo-buttons'
      )
    ) {
      return;
    }

    const term = document.createElement(
      'dt'
    );

    const strong = document.createElement(
      'strong'
    );

    strong.textContent =
      'Personal werben:';

    term.append(strong);

    const description =
      document.createElement('dd');

    const group =
      document.createElement('div');

    group.id =
      'nilspe-bepo-buttons';

    group.className =
      'btn-group';

    const startButton =
      document.createElement('button');

    startButton.type =
      'button';

    startButton.className =
      'btn btn-default btn-xs';

    startButton.textContent =
      'BePo-Personal werben';

    startButton.addEventListener(
      'click',
      runRecruiter
    );

    group.append(
      startButton,
      settingsButton()
    );

    description.append(
      group
    );

    details.append(
      term,
      description
    );
  }

  /*
   * ==========================================
   * START
   * ==========================================
   */

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();
    return;
  }

  const buildingType =
    currentBuildingType();

  if (
    ![7, 11].includes(
      buildingType
    )
  ) {
    return;
  }

  window.addEventListener(
    'pagehide',
    () => {
      if (
        runIsActive()
      ) {
        sessionStorage.removeItem(
          SESSION_RUN_KEY
        );

        GM.deleteValue(
          RUN_LOCK_KEY
        );
      }
    }
  );

  addBuildingButtons();

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );

})();
