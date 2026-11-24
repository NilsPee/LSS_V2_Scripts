
// ==UserScript==
// @name         Leitstelle Fahrzeugstatus 2/6
// @namespace    NilsPe.vehicle.status
// @version      1.2.1
// @description  Setzt sichtbare konfigurierte Fahrzeuge auf Status 6 oder wieder auf Status 2
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Fahrzeugstatus.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Fahrzeugstatus.user.js
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

  const PREFIX = '[Leitstelle Fahrzeugstatus]';
  const VERSION = '1.2.1';
  const SETTINGS_IDENTIFIER = 'nilspe_vehicle_status';

  const KEYS = {
    vehicleTypes: 'nilspe_vehicle_status_types',
    keepPerStation: 'nilspe_vehicle_status_keep',
    requestDelay: 'nilspe_vehicle_status_delay',
    concurrency: 'nilspe_vehicle_status_concurrency'
  };

  const DEFAULT_TYPES = [
    2, 5, 10, 12, 14, 27, 30, 33, 34,
    40, 42, 43, 44, 45, 53, 57, 61,
    63, 64, 70, 91, 99, 100, 101,
    102, 109, 122, 123, 127, 144,
    145, 146, 147
  ];

  let running = false;
  let cancelRequested = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text) {
      node.textContent = text;
    }

    return node;
  }

  function parseArray(value, fallback = []) {
    try {
      const parsed =
        typeof value === 'string'
          ? JSON.parse(value)
          : value;

      return Array.isArray(parsed)
        ? parsed
            .map(Number)
            .filter(Number.isInteger)
        : fallback;
    } catch {
      return fallback;
    }
  }

  /*
   * ==========================================
   * EINSTELLUNGEN
   * ==========================================
   *
   * Alle bisherigen Speicherkeys bleiben
   * unverändert erhalten.
   */

  const SETTINGS_DEFINITIONS = [
    {
      type: 'header',
      text: 'Fahrzeugtypen'
    },
    {
      type: 'select',
      selectType: 'vehicle_types',
      key: KEYS.vehicleTypes,
      label: 'Fahrzeugtypen auswählen',
      title: 'Fahrzeugtypen',
      multiple: true
    },
    {
      type: 'number',
      key: KEYS.keepPerStation,
      label: 'Fahrzeuge je Typ und Wache in Status 2 behalten',
      info: 'Gilt nur beim Setzen auf Status 6',
      min: 0,
      max: 100,
      default: 0
    },
    {
      type: 'number',
      key: KEYS.requestDelay,
      label: 'Pause je Worker [ms]',
      min: 0,
      max: 5000,
      default: 100
    },
    {
      type: 'number',
      key: KEYS.concurrency,
      label: 'Parallele Anfragen',
      min: 1,
      max: 10,
      default: 3
    }
  ];

  async function initializeDefaults() {
    const existing = await GM.getValue(
      KEYS.vehicleTypes,
      null
    );

    if (existing === null) {
      await GM.setValue(
        KEYS.vehicleTypes,
        JSON.stringify(DEFAULT_TYPES)
      );
    }
  }

  /*
   * ==========================================
   * EINSTELLUNGS-STYLES
   * ==========================================
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-fms-settings-style'
      )
    ) {
      return;
    }

    const style = element('style');
    style.id = 'nilspe-fms-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-fms-groups {
        margin-bottom: 24px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-group-body {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-help {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-field {
        box-sizing: border-box;
        margin-bottom: 4px;
        padding: 7px 9px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-field
      .form-group {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-field
      .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-number
      .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-number
      label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-number
      input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        text-align: left;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-select label {
        display: block;
        margin-bottom: 6px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-select
      .bootstrap-select {
        max-width: 100%;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-select
      .bootstrap-select > button {
        min-height: 28px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-bulk {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 110px;
        height: 28px;
        margin: 0 !important;
        padding: 2px 6px !important;
        font-size: 13px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-fms-count {
        font-size: 12px;
        opacity: .75;
      }
    `;

    document.head.append(style);
  }

  function pageJQuery() {
    return unsafeWindow?.jQuery ??
      unsafeWindow?.$ ??
      null;
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
    const details = element(
      'details',
      'nilspe-fms-group'
    );

    const summary = element(
      'summary',
      '',
      title
    );

    const content = element(
      'div',
      'nilspe-fms-group-body'
    );

    if (description) {
      content.append(
        element(
          'p',
          'nilspe-fms-help',
          description
        )
      );
    }

    details.append(summary, content);

    return {
      details,
      content
    };
  }

  /*
   * ==========================================
   * FAHRZEUGTYPEN-AUSWAHL
   * ==========================================
   *
   * NEU v1.2.1:
   *
   * - Alle anwählen
   * - Alle abwählen
   *
   * Beide Buttons lösen das reguläre
   * change-Ereignis der Skriptbasis aus.
   *
   * Die Auswahl wird damit wie gewohnt
   * automatisch gespeichert.
   */

  function decorateSelect(container, select) {
    const toolbar = element(
      'div',
      'nilspe-fms-toolbar'
    );

    const selectAll = element(
      'button',
      'btn btn-default btn-xs nilspe-fms-bulk',
      'Alle anwählen'
    );

    selectAll.type = 'button';

    const clearAll = element(
      'button',
      'btn btn-default btn-xs nilspe-fms-bulk',
      'Alle abwählen'
    );

    clearAll.type = 'button';

    const count = element(
      'span',
      'nilspe-fms-count'
    );

    function updateCount() {
      const selected =
        select.selectedOptions.length;

      const total =
        select.options.length;

      count.textContent =
        `${selected} von ${total} ausgewählt`;

      container.classList.toggle(
        'selected',
        selected > 0
      );
    }

    function setAll(checked) {
      for (const option of select.options) {
        if (!option.disabled) {
          option.selected = checked;
        }
      }

      /*
       * Zuerst die native Auswahl ändern,
       * anschließend die Bootstrap-
       * Darstellung aktualisieren.
       */

      refreshSelectpicker(select);

      /*
       * Die Skriptbasis reagiert auf
       * das change-Ereignis und speichert
       * die ausgewählten Fahrzeugtypen.
       */

      select.dispatchEvent(
        new Event('change', {
          bubbles: true
        })
      );

      updateCount();
    }

    selectAll.addEventListener(
      'click',
      () => setAll(true)
    );

    clearAll.addEventListener(
      'click',
      () => setAll(false)
    );

    select.addEventListener(
      'change',
      updateCount
    );

    const jq = pageJQuery();

    if (typeof jq === 'function') {
      jq(select).on(
        'changed.bs.select.nilspeFmsUi',
        updateCount
      );
    }

    toolbar.append(
      selectAll,
      clearAll,
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
    )?.querySelector('.settings-tab-body');

    if (!body) {
      return false;
    }

    if (
      body.querySelector(
        '.nilspe-fms-groups'
      )
    ) {
      return true;
    }

    const fields = new Map();

    for (const definition of SETTINGS_DEFINITIONS) {
      if (!definition.key) {
        continue;
      }

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

    const root = element(
      'section',
      'nilspe-fms-groups'
    );

    root.append(
      element(
        'h2',
        '',
        'Fahrzeugstatus 2/6'
      ),
      element(
        'p',
        'nilspe-fms-help',
        'Ausgewählte Fahrzeugtypen in der ' +
        'sichtbaren Fahrzeugtabelle auf Status 2 ' +
        'oder Status 6 setzen.'
      )
    );

    const groups = [
      {
        title: 'Fahrzeugtypen',
        description:
          'Fahrzeugtypen auswählen und festlegen, ' +
          'wie viele Fahrzeuge je Typ und Wache ' +
          'in Status 2 bleiben sollen.',
        keys: [
          KEYS.vehicleTypes,
          KEYS.keepPerStation
        ]
      },
      {
        title: 'Ablauf',
        description:
          'Anfragepause und Anzahl gleichzeitig ' +
          'laufender Statusänderungen.',
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

        field.container.classList.add(
          'nilspe-fms-field'
        );

        if (
          field.control.tagName === 'SELECT'
        ) {
          field.container.classList.add(
            'nilspe-fms-select'
          );

          decorateSelect(
            field.container,
            field.control
          );
        } else {
          field.container.classList.add(
            'nilspe-fms-number',
            'selected'
          );
        }

        group.content.append(
          field.container
        );
      }

      root.append(group.details);
    }

    /*
     * Alte Überschriften entfernen.
     * Alle Originalfelder und ihre
     * Event-Listener bleiben erhalten.
     */

    for (const child of [...body.children]) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        (
          child.textContent.trim() ===
            'Fahrzeugtypen' ||
          child.textContent.trim() ===
            'Ablauf'
        )
      ) {
        child.remove();
      }
    }

    body.prepend(root);

    console.log(
      PREFIX,
      `Einstellungsoberfläche v${VERSION} geladen`
    );

    return true;
  }

  /*
   * ==========================================
   * EINSTELLUNGEN ANLEGEN
   * ==========================================
   */

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
      title: 'Fahrzeugstatus 2/6',
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
   * KONFIGURATION LADEN
   * ==========================================
   */

  async function configuration() {
    const selected = parseArray(
      await GM.getValue(
        KEYS.vehicleTypes,
        JSON.stringify(DEFAULT_TYPES)
      ),
      DEFAULT_TYPES
    );

    const numericValue = async (
      key,
      fallback,
      minimum,
      maximum
    ) => {
      const raw = Number(
        await GM.getValue(key, fallback)
      );

      if (!Number.isFinite(raw)) {
        return fallback;
      }

      return Math.min(
        maximum,
        Math.max(minimum, raw)
      );
    };

    return {
      types: new Set(selected),

      keepPerStation: Math.floor(
        await numericValue(
          KEYS.keepPerStation,
          0,
          0,
          100
        )
      ),

      requestDelay: await numericValue(
        KEYS.requestDelay,
        100,
        0,
        5000
      ),

      concurrency: Math.floor(
        await numericValue(
          KEYS.concurrency,
          3,
          1,
          10
        )
      )
    };
  }

  /*
   * ==========================================
   * FAHRZEUGTABELLE
   * ==========================================
   *
   * Wie bisher werden ausschließlich
   * Fahrzeuge aus der sichtbaren Tabelle
   * berücksichtigt.
   */

  function vehicleTable() {
    return document.getElementById(
      'vehicle_table'
    );
  }

  function vehicleRows() {
    return Array.from(
      vehicleTable()?.tBodies?.[0]?.rows ?? []
    );
  }

  function vehicleId(row) {
    const link = Array.from(
      row.querySelectorAll(
        'a[href*="/vehicles/"]'
      )
    ).find(node =>
      /\/vehicles\/\d+/.test(
        node.getAttribute('href') ?? ''
      )
    );

    const match = link
      ?.getAttribute('href')
      ?.match(/\/vehicles\/(\d+)/);

    return Number(match?.[1]) || 0;
  }

  function vehicleType(row) {
    const node = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );

    const value =
      node?.getAttribute('vehicle_type_id') ??
      node?.getAttribute('data-vehicle-type-id');

    return value === null || value === undefined
      ? NaN
      : Number(value);
  }

  function vehicleFms(row) {
    const node = row.querySelector(
      '.building_list_fms'
    );

    const className =
      typeof node?.className === 'string'
        ? node.className
        : '';

    const match = className.match(
      /building_list_fms_(\d+)/
    );

    return match
      ? Number(match[1])
      : NaN;
  }

  function stationId(row) {
    const link = row.querySelector(
      'a[href*="/buildings/"]'
    );

    const href =
      link?.getAttribute('href') ??
      row.innerHTML;

    return Number(
      href.match(
        /\/buildings\/(\d+)/
      )?.[1]
    ) || 0;
  }

  /*
   * ==========================================
   * FAHRZEUGE AUSWÄHLEN
   * ==========================================
   */

  function matchingRows(config, targetStatus) {
    return vehicleRows().filter(row => {
      const id = vehicleId(row);
      const type = vehicleType(row);
      const fms = vehicleFms(row);

      if (!id) {
        return false;
      }

      if (!config.types.has(type)) {
        return false;
      }

      return targetStatus === 6
        ? fms !== 6 && Number.isFinite(fms)
        : fms === 6;
    });
  }

  /*
   * ==========================================
   * FAHRZEUGE IN STATUS 2 BEHALTEN
   * ==========================================
   *
   * Pro Wache und Fahrzeugtyp werden
   * beim Setzen auf S6 die ersten N
   * passenden Fahrzeuge ausgelassen.
   */

  function rowsForStatus6(rows, config) {
    if (config.keepPerStation <= 0) {
      return rows;
    }

    const groups = new Map();

    for (const row of rows) {
      const key =
        `${stationId(row)}:${vehicleType(row)}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(row);
    }

    const result = [];

    for (const group of groups.values()) {
      result.push(
        ...group.slice(config.keepPerStation)
      );
    }

    return result;
  }

  function rowsForStatus(targetStatus, config) {
    const rows = matchingRows(
      config,
      targetStatus
    );

    return targetStatus === 6
      ? rowsForStatus6(rows, config)
      : rows;
  }

  /*
   * ==========================================
   * STATUS ÄNDERN
   * ==========================================
   */

  async function setVehicleStatus(
    id,
    status
  ) {
    const response = await fetch(
      `/vehicles/${id}/set_fms/${status}`,
      {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        redirect: 'follow'
      }
    );

    if (!response.ok) {
      throw new Error(
        `Status ${status}: HTTP ${response.status}`
      );
    }
  }

  /*
   * ==========================================
   * FORTSCHRITTSANZEIGE
   * ==========================================
   */

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-fms-progress'
      )
    ) {
      return;
    }

    const style = element('style');
    style.id = 'nilspe-fms-style';

    style.textContent = `
      #nilspe-fms-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-fms-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-fms-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-fms-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;

    document.head.append(style);

    const container = element('div');
    container.id = 'nilspe-fms-progress';

    const row = element('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:12px';

    const cancel = element(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancel.type = 'button';

    cancel.addEventListener('click', () => {
      if (!running) {
        return;
      }

      cancelRequested = true;

      const status = document.getElementById(
        'nilspe-fms-status'
      );

      if (status) {
        status.className = 'label label-warning';
        status.textContent =
          'Abbruch angefordert ...';
      }
    });

    const status = element(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id = 'nilspe-fms-status';

    const track = element('div');
    track.id = 'nilspe-fms-track';

    const success = element('div');
    success.id = 'nilspe-fms-success';

    const errors = element('div');
    errors.id = 'nilspe-fms-errors';

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
      'nilspe-fms-status'
    );

    const successBar = document.getElementById(
      'nilspe-fms-success'
    );

    const errorBar = document.getElementById(
      'nilspe-fms-errors'
    );

    const safeTotal = Math.max(total, 1);
    const successful = Math.max(
      0,
      completed - errors
    );

    status.className = `label label-${type}`;
    status.textContent = message;

    successBar.style.width =
      `${successful / safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function run(targetStatus, buttons) {
    if (running) {
      return;
    }

    running = true;
    cancelRequested = false;

    for (const button of buttons) {
      button.disabled = true;
    }

    try {
      const config = await configuration();

      if (config.types.size === 0) {
        setProgress(
          'Keine Fahrzeugtypen ausgewählt',
          0, 0, 0, 'warning'
        );
        return;
      }

      const jobs = rowsForStatus(
        targetStatus,
        config
      );

      if (!jobs.length) {
        setProgress(
          `Keine Fahrzeuge für Status ${targetStatus}`,
          0, 0, 0, 'success'
        );
        return;
      }

      if (!window.confirm(
        `${jobs.length} Fahrzeuge auf Status ${targetStatus} setzen?`
      )) {
        setProgress(
          'Abgebrochen',
          0, 0, 0, 'warning'
        );
        return;
      }

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;

      /*
       * Mehrere Worker laufen parallel.
       * Jeder Worker wartet nach seiner
       * Anfrage die eingestellte Pause ab.
       *
       * Beim Abbruch werden keine weiteren
       * Jobs begonnen.
       */

      async function worker() {
        while (!cancelRequested) {
          const index = nextIndex++;

          if (index >= jobs.length) {
            return;
          }

          const row = jobs[index];
          const id = vehicleId(row);

          try {
            if (!id) {
              throw new Error(
                'Fahrzeug-ID fehlt'
              );
            }

            await setVehicleStatus(
              id,
              targetStatus
            );

            /*
             * Erfolgreich bearbeitete Zeilen
             * wie bisher entfernen.
             */

            row.remove();

          } catch (error) {
            errors++;

            console.error(
              PREFIX,
              'Fahrzeug fehlgeschlagen:',
              id,
              error
            );
          }

          completed++;

          setProgress(
            cancelRequested
              ? `Abbruch: ${completed}/${jobs.length} bearbeitet`
              : `${completed}/${jobs.length} auf Status ${targetStatus}`,
            completed,
            errors,
            jobs.length,
            errors ? 'warning' : 'info'
          );

          if (
            !cancelRequested &&
            config.requestDelay > 0
          ) {
            await sleep(
              config.requestDelay
            );
          }
        }
      }

      const workerCount = Math.min(
        config.concurrency,
        jobs.length
      );

      await Promise.all(
        Array.from(
          { length: workerCount },
          () => worker()
        )
      );

      const successful = completed - errors;

      if (cancelRequested) {
        setProgress(
          `Abgebrochen: ${successful} erfolgreich, ` +
          `${errors} Fehler, ${jobs.length - completed} offen`,
          completed,
          errors,
          jobs.length,
          'warning'
        );
      } else {
        setProgress(
          `Fertig: ${successful} auf Status ${targetStatus}, ` +
          `${errors} Fehler`,
          completed,
          errors,
          jobs.length,
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
        0, 0, 0, 'danger'
      );

    } finally {
      running = false;
      cancelRequested = false;

      for (const button of buttons) {
        button.disabled = false;
      }
    }
  }

  /*
   * ==========================================
   * BUTTONS
   * ==========================================
   */

  function settingsButton() {
    const button = element(
      'a',
      'btn btn-default btn-xs'
    );

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    button.append(
      element(
        'span',
        'glyphicon glyphicon-cog'
      )
    );

    return button;
  }

  function addButtons() {
    const table = vehicleTable();

    if (
      !table ||
      !table.parentElement ||
      document.getElementById(
        'nilspe-fms-buttons'
      )
    ) {
      return;
    }

    const group = element(
      'div',
      'btn-group'
    );

    group.id = 'nilspe-fms-buttons';

    group.style.cssText =
      'display:flex;width:fit-content;margin:0';

    const status2 = element(
      'button',
      'btn btn-default btn-xs',
      'S2 setzen'
    );

    status2.type = 'button';

    const status6 = element(
      'button',
      'btn btn-default btn-xs',
      'S6 setzen'
    );

    status6.type = 'button';

    const buttons = [
      status2,
      status6
    ];

    status2.addEventListener(
      'click',
      () => void run(2, buttons)
    );

    status6.addEventListener(
      'click',
      () => void run(6, buttons)
    );

    group.append(
      status2,
      status6,
      settingsButton()
    );

    const row = element('div');
    row.id = 'nilspe-fms-button-row';

    row.style.cssText =
      'display:flex;width:100%;margin:0;' +
      'padding:0;line-height:0';

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
    return;
  }

  addButtons();

  new MutationObserver(addButtons).observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );

})();
