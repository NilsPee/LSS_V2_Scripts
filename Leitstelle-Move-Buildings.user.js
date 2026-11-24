
// ==UserScript==
// @name         Leitstelle Move Buildings
// @namespace    NilsPe.move.buildings
// @version      2.1.0
// @description  Verschiebt Wachen einer Leitstelle anhand eines Namensfilters in eine andere Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Move-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Move-Buildings.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @match        https://leitstellenspiel.de/buildings/*
// @match        https://leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const VERSION = '2.1.0';
  const PREFIX = '[Leitstelle Move Buildings]';
  const SETTINGS_IDENTIFIER = 'nilspe_move_buildings';

  const KEYS = {
    targetDispatchCenter: 'nilspe_mb_target_dispatch_center',
    nameFilter: 'nilspe_mb_name_filter',
    concurrency: 'nilspe_mb_concurrency',
    requestDelay: 'nilspe_mb_request_delay',
    dryRun: 'nilspe_mb_dry_run',
    requireConfirm: 'nilspe_mb_require_confirm'
  };

  let running = false;
  let busy = false;
  let cancelRequested = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function el(tag, className = '', text = '') {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

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

    return Math.min(
      max,
      Math.max(min, Math.floor(number))
    );
  }

  /*
   * ==========================================
   * EINSTELLUNGEN
   * ==========================================
   *
   * Alle Speicherkeys aus v2.0.0
   * bleiben unverändert.
   */

  const SETTINGS = [
    {
      type: 'header',
      text: 'Verschieben'
    },
    {
      type: 'select',
      key: KEYS.targetDispatchCenter,
      label: 'Ziel-Leitstelle',
      title: 'Ziel-Leitstelle auswählen',
      multiple: false,
      selectType: 'dispatch_centers'
    },
    {
      type: 'text',
      key: KEYS.nameFilter,
      label: 'Namensfilter',
      info: 'Nur Wachen, deren Name diesen Text enthält.',
      default: ''
    },
    {
      type: 'header',
      text: 'Ablauf'
    },
    {
      type: 'number',
      key: KEYS.concurrency,
      label: 'Parallele Verschiebungen',
      min: 1,
      max: 5,
      default: 3
    },
    {
      type: 'number',
      key: KEYS.requestDelay,
      label: 'Pause zwischen Anfragen [ms]',
      min: 0,
      max: 5000,
      default: 150
    },
    {
      type: 'checkbox',
      key: KEYS.requireConfirm,
      label: 'Vor dem Verschieben Bestätigung anzeigen',
      default: true
    },
    {
      type: 'checkbox',
      key: KEYS.dryRun,
      label: 'Testlauf aktivieren',
      default: false
    }
  ];

  /*
   * ==========================================
   * EINHEITLICHE EINSTELLUNGSOBERFLÄCHE
   * ==========================================
   *
   * Stil nach Delete Buildings:
   * - normale h2-Überschrift
   * - kurze Beschreibung
   * - einklappbare Gruppen
   * - einheitliche Eingabefelder
   */

  function injectSettingsStyles() {
    if (document.getElementById(
      'nilspe-mb-settings-style'
    )) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-mb-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-mb-settings-root {
        margin-bottom: 24px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-group-body {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-field {
        box-sizing: border-box;
        margin-bottom: 4px;
        padding: 7px 9px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-field .form-group {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-field .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-number .col-sm-6,
      #${SETTINGS_IDENTIFIER} .nilspe-mb-text .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-number label,
      #${SETTINGS_IDENTIFIER} .nilspe-mb-text label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-number input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        box-sizing: border-box;
        text-align: left;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-text input[type="text"] {
        order: 1;
        flex: 0 0 215px;
        width: 215px !important;
        max-width: 55%;
        min-width: 0;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-select label {
        display: block;
        margin-bottom: 6px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-select .bootstrap-select {
        max-width: 100%;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-select
      .bootstrap-select > button {
        min-height: 28px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-checkbox
      .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-checkbox
      input[type="checkbox"] {
        margin: 0 !important;
        position: static !important;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-checkbox label {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-mb-note {
        padding: 8px 10px;
        margin-top: 10px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
        font-size: 12px;
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

    return container.parentElement === body
      ? { control, container }
      : null;
  }

  function makeGroup(title, description) {
    const details = el(
      'details',
      'nilspe-mb-group'
    );

    const summary = el('summary', '', title);

    const content = el(
      'div',
      'nilspe-mb-group-body'
    );

    if (description) {
      content.append(
        el('p', 'nilspe-mb-info', description)
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  function decorateField(field) {
    const { control, container } = field;

    container.classList.add(
      'nilspe-mb-field'
    );

    if (control.tagName === 'SELECT') {
      container.classList.add(
        'nilspe-mb-select'
      );
      return;
    }

    if (control.type === 'number') {
      container.classList.add(
        'nilspe-mb-number',
        'selected'
      );
      return;
    }

    if (control.type === 'text') {
      container.classList.add(
        'nilspe-mb-text'
      );

      const update = () => {
        container.classList.toggle(
          'selected',
          control.value.trim().length > 0
        );
      };

      control.addEventListener('input', update);
      control.addEventListener('change', update);
      update();
      return;
    }

    if (control.type === 'checkbox') {
      container.classList.add(
        'nilspe-mb-checkbox'
      );

      const update = () => {
        container.classList.toggle(
          'selected',
          control.checked
        );
      };

      control.addEventListener('change', update);
      update();
    }
  }

  function groupRenderedSettings() {
    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) {
      return false;
    }

    if (
      body.querySelector(
        '.nilspe-mb-settings-root'
      )
    ) {
      return true;
    }

    const fields = new Map();

    for (const definition of SETTINGS) {
      if (!definition.key) continue;

      const field = settingField(
        body,
        definition.key
      );

      if (!field) {
        return false;
      }

      fields.set(definition.key, field);
    }

    injectSettingsStyles();

    const root = el(
      'section',
      'nilspe-mb-settings-root'
    );

    root.append(
      el('h2', '', 'Wachenverschieber'),
      el(
        'p',
        'nilspe-mb-info',
        'Wachen anhand ihres Namensfilters einer ' +
        'anderen Leitstelle zuordnen. ' +
        'Testlauf und Bestätigung können vorab ' +
        'in den Einstellungen festgelegt werden.'
      )
    );

    const moveGroup = makeGroup(
      'Verschieben',
      'Ziel-Leitstelle und Suchtext für die Wachen.'
    );

    const flowGroup = makeGroup(
      'Ablauf',
      'Verarbeitungsgeschwindigkeit und Sicherheitsoptionen.'
    );

    const assignments = [
      {
        group: moveGroup,
        keys: [
          KEYS.targetDispatchCenter,
          KEYS.nameFilter
        ]
      },
      {
        group: flowGroup,
        keys: [
          KEYS.concurrency,
          KEYS.requestDelay,
          KEYS.requireConfirm,
          KEYS.dryRun
        ]
      }
    ];

    for (const assignment of assignments) {
      for (const key of assignment.keys) {
        const field = fields.get(key);

        decorateField(field);
        assignment.group.content.append(
          field.container
        );
      }
    }

    flowGroup.content.append(
      el(
        'div',
        'nilspe-mb-note',
        'Testlauf: Es werden keine Wachen verschoben. ' +
        'Bei deaktiviertem Testlauf führt der Button ' +
        'die tatsächliche Verschiebung aus.'
      )
    );

    root.append(
      moveGroup.details,
      flowGroup.details
    );

    /*
     * Die ursprünglichen Eingabefelder
     * bleiben erhalten und werden lediglich
     * in die Gruppen verschoben.
     */

    for (const child of [...body.children]) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        [
          'Verschieben',
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

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Wachenverschieber',
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

  function parseSelectValue(
    value,
    fallback = null
  ) {
    try {
      const parsed = typeof value === 'string'
        ? JSON.parse(value)
        : value;

      if (Array.isArray(parsed)) {
        if (!parsed.length) return fallback;

        const number = Number(parsed[0]);

        return Number.isSafeInteger(number)
          ? number
          : fallback;
      }

      const number = Number(parsed);

      return Number.isSafeInteger(number)
        ? number
        : fallback;

    } catch {
      const number = Number(value);

      return Number.isSafeInteger(number)
        ? number
        : fallback;
    }
  }

  async function configuration() {
    return {
      targetDispatchCenter:
        parseSelectValue(
          await GM.getValue(
            KEYS.targetDispatchCenter,
            '[]'
          )
        ),

      nameFilter: String(
        await GM.getValue(
          KEYS.nameFilter,
          ''
        )
      ).trim(),

      concurrency: clampInteger(
        await GM.getValue(
          KEYS.concurrency,
          3
        ),
        3, 1, 5
      ),

      requestDelay: clampInteger(
        await GM.getValue(
          KEYS.requestDelay,
          150
        ),
        150, 0, 5000
      ),

      dryRun: await GM.getValue(
        KEYS.dryRun,
        false
      ),

      requireConfirm: await GM.getValue(
        KEYS.requireConfirm,
        true
      )
    };
  }

  /*
   * ==========================================
   * GEBÄUDE LADEN
   * ==========================================
   */

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .toLocaleLowerCase('de-DE');
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
        'Der Wachenverschieber kann nur auf einer Leitstelle gestartet werden.'
      );
    }

    const id = Number(
      location.pathname.match(
        /^\/buildings\/(\d+)/
      )?.[1]
    );

    if (
      !Number.isSafeInteger(id) ||
      id <= 0
    ) {
      throw new Error(
        'Quell-Leitstelle konnte nicht ermittelt werden.'
      );
    }

    return id;
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
            dispatchCenterId &&
          building.id !== dispatchCenterId
        )
        .sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  function filterBuildings(
    buildings,
    nameFilter
  ) {
    const needle = normalize(nameFilter);

    if (!needle) {
      return [];
    }

    return buildings.filter(building =>
      normalize(building.caption).includes(
        needle
      )
    );
  }

  /*
   * ==========================================
   * VERSCHIEBEN
   * ==========================================
   */

  async function moveBuilding(
    buildingId,
    targetDispatchCenterId
  ) {
    const url =
      `/buildings/${buildingId}` +
      `/leitstelle-set/${targetDispatchCenterId}`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(
        `Gebäude ${buildingId}: HTTP ${response.status}`
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
        'nilspe-mb-progress'
      )
    ) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-mb-style';

    style.textContent = `
      #nilspe-mb-progress {
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

      #nilspe-mb-progress-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #nilspe-mb-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-mb-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-mb-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }

      body.dark #nilspe-mb-progress,
      body.dark-mode #nilspe-mb-progress {
        background: #222;
        color: #eee;
        border-color: #444;
      }
    `;

    document.head.append(style);

    const container = el('div');
    container.id = 'nilspe-mb-progress';

    const row = el('div');
    row.id = 'nilspe-mb-progress-row';

    const cancel = el(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancel.type = 'button';
    cancel.id = 'nilspe-mb-cancel';

    cancel.addEventListener('click', () => {
      if (!running) return;

      cancelRequested = true;
      cancel.disabled = true;

      const status = document.getElementById(
        'nilspe-mb-status'
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

    status.id = 'nilspe-mb-status';

    const track = el('div');
    track.id = 'nilspe-mb-track';

    const success = el('div');
    success.id = 'nilspe-mb-success';

    const errors = el('div');
    errors.id = 'nilspe-mb-errors';

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
      'nilspe-mb-status'
    );

    const success = document.getElementById(
      'nilspe-mb-success'
    );

    const errorBar = document.getElementById(
      'nilspe-mb-errors'
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

  /*
   * ==========================================
   * AUSWAHL UND SICHERHEITSPRÜFUNGEN
   * ==========================================
   */

  async function selection() {
    const config = await configuration();
    const sourceDispatchCenter =
      currentDispatchCenterId();

    if (
      !Number.isSafeInteger(
        config.targetDispatchCenter
      ) ||
      config.targetDispatchCenter <= 0
    ) {
      throw new Error(
        'Bitte zuerst eine Ziel-Leitstelle auswählen.'
      );
    }

    if (
      sourceDispatchCenter ===
      config.targetDispatchCenter
    ) {
      throw new Error(
        'Quell- und Ziel-Leitstelle sind identisch.'
      );
    }

    if (!config.nameFilter) {
      throw new Error(
        'Bitte zuerst einen Namensfilter eintragen.'
      );
    }

    setProgress(
      'Gebäude werden aus dem API-Cache geladen ...'
    );

    const buildings = await loadBuildings(
      sourceDispatchCenter
    );

    const matchingBuildings = filterBuildings(
      buildings,
      config.nameFilter
    );

    return {
      config,
      sourceDispatchCenter,
      buildings,
      matchingBuildings
    };
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function runMover(buttons) {
    if (running || busy) {
      return;
    }

    busy = true;

    try {
      const {
        config,
        matchingBuildings
      } = await selection();

      if (!matchingBuildings.length) {
        setProgress(
          `Keine Wachen mit "${config.nameFilter}" gefunden`,
          0, 0, 0, 'success'
        );
        return;
      }

      if (config.requireConfirm) {
        const preview = matchingBuildings
          .slice(0, 30)
          .map(building =>
            `- ${building.caption}`
          )
          .join('\n');

        const remaining =
          matchingBuildings.length > 30
            ? `\n\n... und ${
                matchingBuildings.length - 30
              } weitere`
            : '';

        const message =
          `${config.dryRun ? 'Testlauf' : 'Verschieben'}:\n\n` +
          `${formatCount(matchingBuildings.length)} Wachen ` +
          `${config.dryRun ? 'würden verschoben' : 'werden verschoben'}.\n\n` +
          `Filter: "${config.nameFilter}"\n` +
          `Ziel-Leitstelle: ${config.targetDispatchCenter}\n\n` +
          `${preview}${remaining}`;

        if (!window.confirm(message)) {
          setProgress(
            'Verschieben nicht gestartet',
            0, 0, 0, 'warning'
          );
          return;
        }
      }

      running = true;
      cancelRequested = false;

      for (const button of buttons) {
        button.disabled = true;
      }

      ensureProgress();

      const cancelButton = document.getElementById(
        'nilspe-mb-cancel'
      );

      if (cancelButton) {
        cancelButton.disabled = false;
      }

      let completed = 0;
      let errors = 0;
      let moved = 0;
      let nextIndex = 0;

      const total = matchingBuildings.length;

      setProgress(
        config.dryRun
          ? `Testlauf: 0/${total}`
          : `0/${total} Wachen`,
        0, 0, total
      );

      /*
       * Maximal die eingestellte Anzahl
       * gleichzeitiger Anfragen.
       *
       * Beim Abbruch starten keine
       * weiteren Verschiebungen mehr.
       */

      async function worker() {
        while (!cancelRequested) {
          const index = nextIndex++;

          if (index >= total) {
            return;
          }

          const building =
            matchingBuildings[index];

          try {
            if (!config.dryRun) {
              await moveBuilding(
                building.id,
                config.targetDispatchCenter
              );
            }

            moved++;

          } catch (error) {
            errors++;

            console.error(
              PREFIX,
              'Gebäude fehlgeschlagen:',
              building.id,
              building.caption,
              error
            );
          }

          completed++;

          setProgress(
            config.dryRun
              ? `${completed}/${total} im Testlauf geprüft`
              : `${completed}/${total} bearbeitet, ${moved} verschoben`,
            completed,
            errors,
            total,
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

      await Promise.all(
        Array.from(
          {
            length: Math.min(
              config.concurrency,
              total
            )
          },
          () => worker()
        )
      );

      if (cancelRequested) {
        setProgress(
          `Abgebrochen: ${moved} ${config.dryRun ? 'geprüft' : 'verschoben'}, ` +
          `${errors} Fehler, ${total - completed} offen`,
          completed,
          errors,
          total,
          'warning'
        );
      } else {
        setProgress(
          config.dryRun
            ? `Testlauf fertig: ${moved} Wachen geprüft`
            : `Fertig: ${moved} verschoben, ${errors} Fehler`,
          completed,
          errors,
          total,
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
      busy = false;
      cancelRequested = false;

      for (const button of buttons) {
        button.disabled = false;
      }

      const cancelButton = document.getElementById(
        'nilspe-mb-cancel'
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
    const link = el(
      'a',
      'btn btn-default btn-xs'
    );

    link.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    link.target = '_blank';
    link.title = 'Einstellungen';

    link.append(
      el(
        'span',
        'glyphicon glyphicon-cog'
      )
    );

    return link;
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
        heading?.getAttribute('building_type')
      ) !== 7 ||
      document.getElementById(
        'nilspe-mb-buttons'
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

    group.id = 'nilspe-mb-buttons';

    const moveButton = el(
      'button',
      'btn btn-default btn-xs',
      'Wachen verschieben'
    );

    moveButton.type = 'button';

    const buttons = [moveButton];

    moveButton.addEventListener(
      'click',
      () => void runMover(buttons)
    );

    group.append(
      moveButton,
      settingsButton()
    );

    const row = el('div');
    row.id = 'nilspe-mb-button-row';

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
