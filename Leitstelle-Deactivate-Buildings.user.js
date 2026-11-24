
// ==UserScript==
// @name         Leitstelle De-/Activate Buildings
// @namespace    NilsPe.activate.buildings
// @version      1.2.2
// @description  Aktiviert oder deaktiviert konfigurierte Gebäude einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js
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

  const VERSION = '1.2.2';
  const PREFIX = '[De-/Activate Buildings]';
  const SETTINGS_IDENTIFIER = 'nilspe_activate_buildings';

  const KEYS = {
    activateTypes: 'nilspe_ab_activate_types',
    deactivateTypes: 'nilspe_ab_deactivate_types',
    concurrency: 'nilspe_ab_concurrency',
    requestDelay: 'nilspe_ab_request_delay'
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

  const DEFAULT_TYPES = BUILDING_TYPES.map(
    type => type.value
  );

  let running = false;
  let cancelled = false;
  let buttons = [];

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function el(tag, className = '', text = '') {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text) element.textContent = text;

    return element;
  }

  function parseArray(value, fallback = []) {
    try {
      const parsed = typeof value === 'string'
        ? JSON.parse(value)
        : value;

      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : fallback;
    } catch {
      return fallback;
    }
  }

  function format(number) {
    return Number(number).toLocaleString('de-DE');
  }

  function safeNumber(raw, fallback, min, max) {
    const value = Number(raw);

    if (!Number.isFinite(value)) return fallback;

    return Math.max(
      min,
      Math.min(max, Math.floor(value))
    );
  }

  /*
   * ==========================================
   * SPEICHER / EINSTELLUNGEN
   * ==========================================
   */

  async function initializeDefaults() {
    for (const key of [
      KEYS.activateTypes,
      KEYS.deactivateTypes
    ]) {
      const stored = await GM.getValue(key, null);

      if (stored === null) {
        await GM.setValue(
          key,
          JSON.stringify(DEFAULT_TYPES)
        );
      }
    }
  }

  /*
   * ==========================================
   * EINHEITLICHER EINSTELLUNGSSTANDARD
   * ==========================================
   *
   * Hauptüberschrift und Beschreibung
   * entsprechen Delete Buildings.
   *
   * Keine eigene h2-Fettschrift oder
   * abweichende h2-Abstände.
   */

  function injectSettingsStyles() {
    if (document.getElementById(
      'nilspe-ab-settings-style'
    )) return;

    const style = el('style');
    style.id = 'nilspe-ab-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-ab-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-group-content {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 9px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-bulk {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 110px;
        height: 28px;
        padding: 2px 6px !important;
        margin: 0 !important;
        font-size: 13px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-count {
        font-size: 12px;
        opacity: .75;
        margin-left: 4px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-option {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 7px 9px;
        margin-bottom: 4px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-option.active {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-option-label {
        flex: 1;
        margin: 0;
        cursor: pointer;
        font-weight: normal;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-option:not(.active)
      .nilspe-ab-option-label {
        opacity: .7;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-toggle {
        width: 30px;
        min-width: 30px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-number {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 7px 9px;
        margin-bottom: 4px;
        border: 1px solid rgba(92,184,92,.35);
        border-radius: 3px;
        background: rgba(92,184,92,.10);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-number input {
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        padding: 3px 7px !important;
        box-sizing: border-box;
        text-align: left;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-number label {
        flex: 1;
        margin: 0;
        font-weight: normal;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ab-save-state {
        font-size: 12px;
        opacity: .75;
      }
    `;

    document.head.append(style);
  }

  function makeGroup(title, description) {
    const details = el(
      'details',
      'nilspe-ab-group'
    );

    const summary = el('summary', '', title);

    const content = el(
      'div',
      'nilspe-ab-group-content'
    );

    if (description) {
      content.append(
        el('p', 'nilspe-ab-info', description)
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  /*
   * ==========================================
   * GEBÄUDETYPEN-AUSWAHL
   * ==========================================
   */

  async function createTypeSelection(
    content,
    key,
    defaultTypes = DEFAULT_TYPES
  ) {
    const selected = new Set(
      parseArray(
        await GM.getValue(
          key,
          JSON.stringify(defaultTypes)
        ),
        defaultTypes
      )
    );

    const toolbar = el(
      'div',
      'nilspe-ab-toolbar'
    );

    const allButton = el(
      'button',
      'btn btn-default btn-xs nilspe-ab-bulk',
      'Alle anwählen'
    );

    const noneButton = el(
      'button',
      'btn btn-default btn-xs nilspe-ab-bulk',
      'Alle abwählen'
    );

    allButton.type = 'button';
    noneButton.type = 'button';

    const count = el(
      'span',
      'nilspe-ab-count'
    );

    const saveState = el(
      'span',
      'nilspe-ab-save-state'
    );

    const list = el('div');

    let saveQueue = Promise.resolve();

    function save() {
      const snapshot = [...selected].sort(
        (a, b) => a - b
      );

      saveState.textContent = 'Speichere ...';

      saveQueue = saveQueue
        .catch(() => {})
        .then(() =>
          GM.setValue(
            key,
            JSON.stringify(snapshot)
          )
        )
        .then(() => {
          saveState.textContent = 'Gespeichert';
        })
        .catch(error => {
          saveState.textContent =
            'Speichern fehlgeschlagen';

          console.error(
            PREFIX,
            'Einstellung speichern fehlgeschlagen:',
            key,
            error
          );
        });
    }

    function update() {
      count.textContent =
        `${selected.size} von ${BUILDING_TYPES.length} ausgewählt`;

      list.replaceChildren();

      for (const option of BUILDING_TYPES) {
        const active = selected.has(option.value);

        const row = el(
          'div',
          'nilspe-ab-option'
        );

        row.classList.toggle('active', active);

        const label = el(
          'span',
          'nilspe-ab-option-label',
          option.name
        );

        const toggle = el(
          'button',
          'btn btn-xs nilspe-ab-toggle ' +
          (active ? 'btn-danger' : 'btn-success'),
          active ? '✕' : '✓'
        );

        toggle.type = 'button';
        toggle.title = active
          ? 'Gebäudetyp abwählen'
          : 'Gebäudetyp auswählen';

        function toggleSelection() {
          if (selected.has(option.value)) {
            selected.delete(option.value);
          } else {
            selected.add(option.value);
          }

          update();
          save();
        }

        label.addEventListener(
          'click',
          toggleSelection
        );

        toggle.addEventListener(
          'click',
          toggleSelection
        );

        row.append(label, toggle);
        list.append(row);
      }
    }

    allButton.addEventListener('click', () => {
      selected.clear();

      for (const option of BUILDING_TYPES) {
        selected.add(option.value);
      }

      update();
      save();
    });

    noneButton.addEventListener('click', () => {
      selected.clear();
      update();
      save();
    });

    toolbar.append(
      allButton,
      noneButton,
      count,
      saveState
    );

    content.append(toolbar, list);

    update();
  }

  /*
   * ==========================================
   * ZAHLENFELDER
   * ==========================================
   */

  async function createNumberSetting(
    content,
    { key, label, fallback, min, max }
  ) {
    const row = el(
      'div',
      'nilspe-ab-number'
    );

    const input = el(
      'input',
      'form-control input-sm'
    );

    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';

    input.value = String(
      safeNumber(
        await GM.getValue(key, fallback),
        fallback,
        min,
        max
      )
    );

    const caption = el('label', '', label);

    const status = el(
      'span',
      'nilspe-ab-save-state'
    );

    row.append(input, caption, status);

    input.addEventListener('change', () => {
      const value = safeNumber(
        input.value,
        fallback,
        min,
        max
      );

      input.value = String(value);
      status.textContent = 'Speichere ...';

      void GM.setValue(key, value)
        .then(() => {
          status.textContent = 'Gespeichert';
        })
        .catch(error => {
          status.textContent =
            'Speichern fehlgeschlagen';
          console.error(PREFIX, error);
        });
    });

    content.append(row);
  }

  /*
   * ==========================================
   * EINSTELLUNGSSEITE
   * ==========================================
   */

  async function createSettings() {
    if (
      typeof waitForSettingsDom !== 'function' ||
      typeof createSettingsPane !== 'function'
    ) {
      console.error(
        PREFIX,
        'NilsPe-Skriptbasis fehlt.'
      );
      return;
    }

    if (!await waitForSettingsDom()) {
      return;
    }

    await initializeDefaults();

    const { anchor, body } = createSettingsPane(
      SETTINGS_IDENTIFIER,
      'De-/Activate Buildings'
    );

    injectSettingsStyles();

    let rendered = false;
    let rendering = false;

    async function renderSettings() {
      if (rendered || rendering) return;

      rendering = true;

      try {
        const activate = makeGroup(
          'Gebäude aktivieren',
          'Gebäudetypen auswählen, die aktiviert werden sollen.'
        );

        const deactivate = makeGroup(
          'Gebäude deaktivieren',
          'Gebäudetypen auswählen, die deaktiviert werden sollen.'
        );

        const flow = makeGroup(
          'Ablauf',
          'Gemeinsame Geschwindigkeitseinstellungen.'
        );

        await createTypeSelection(
          activate.content,
          KEYS.activateTypes
        );

        await createTypeSelection(
          deactivate.content,
          KEYS.deactivateTypes
        );

        await createNumberSetting(flow.content, {
          key: KEYS.concurrency,
          label: 'Parallele Gebäudeprüfungen',
          fallback: 3,
          min: 1,
          max: 10
        });

        await createNumberSetting(flow.content, {
          key: KEYS.requestDelay,
          label: 'Pause nach einer Umschaltung [ms]',
          fallback: 100,
          min: 0,
          max: 5000
        });

        /*
         * Einheitliche Hauptüberschrift
         * wie bei Delete Buildings.
         *
         * Normales h2 ohne eigene Klasse.
         * Kein font-weight: bold.
         * Keine abweichenden Außenabstände.
         */

        const title = el(
          'h2',
          '',
          'De-/Activate Buildings'
        );

        const description = el(
          'p',
          'nilspe-ab-info',
          'Gebäudetypen auswählen und deren Aktivierung oder Deaktivierung konfigurieren.'
        );

        body.replaceChildren(
          title,
          description,
          activate.details,
          deactivate.details,
          flow.details
        );

        rendered = true;
      } catch (error) {
        console.error(
          PREFIX,
          'Einstellungen konnten nicht erstellt werden:',
          error
        );
      } finally {
        rendering = false;
      }
    }

    anchor.addEventListener(
      'click',
      () => void renderSettings()
    );

    if (
      location.hash === `#${SETTINGS_IDENTIFIER}`
    ) {
      await renderSettings();
      anchor.click();
    }
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
      building_type: Number(building.building_type),
      leitstelle_building_id:
        dispatchCenterId == null
          ? null
          : Number(dispatchCenterId),
      caption:
        building.caption ||
        building.name ||
        `Gebäude ${building.id}`,
      enabled: building.enabled !== false
    };
  }

  async function loadBuildings(
    dispatchCenterId,
    types,
    desiredState
  ) {
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
          types.has(building.building_type)
        )
        .filter(building =>
          building.enabled !== desiredState
        )
        .sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * UMSCHALT-URL
   * ==========================================
   */

  async function toggleUrl(buildingId) {
    const response = await fetch(
      `/buildings/${buildingId}`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gebäudeseite HTTP ${response.status}`
      );
    }

    const parsed = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );

    const link = parsed.querySelector(
      `a[href*="/buildings/${buildingId}/active"], ` +
      'a[href$="/active"][data-method], ' +
      'a.btn[href$="/active"]'
    );

    const href = link?.getAttribute('href');

    if (!href) {
      throw new Error(
        'Umschalt-URL wurde nicht gefunden.'
      );
    }

    return new URL(href, location.origin).href;
  }

  async function toggleBuilding(buildingId) {
    const url = await toggleUrl(buildingId);

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
        `Umschaltung HTTP ${response.status}`
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
        'nilspe-ab-progress'
      )
    ) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-ab-style';

    style.textContent = `
      #nilspe-ab-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 9px 12px;
        border-top: 1px solid #888;
        background: #333;
        color: #fff;
      }

      #nilspe-ab-progress-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      #nilspe-ab-statistics {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-top: 6px;
        font-size: 12px;
      }

      #nilspe-ab-track {
        display: flex;
        height: 12px;
        margin-top: 6px;
        overflow: hidden;
        border-radius: 4px;
        background: #777;
      }

      #nilspe-ab-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-ab-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;

    document.head.append(style);

    const progress = el('div');
    progress.id = 'nilspe-ab-progress';

    const top = el('div');
    top.id = 'nilspe-ab-progress-row';

    const stop = el(
      'button',
      'btn btn-danger btn-xs',
      'Abbrechen'
    );

    stop.type = 'button';
    stop.id = 'nilspe-ab-stop';

    stop.addEventListener('click', () => {
      if (!running) return;

      cancelled = true;
      stop.disabled = true;

      const status = document.getElementById(
        'nilspe-ab-status'
      );

      if (status) {
        status.textContent =
          'Abbruch – laufende Anfragen werden beendet ...';
      }
    });

    const status = el(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id = 'nilspe-ab-status';

    const close = el(
      'button',
      'btn btn-default btn-xs',
      'Schließen'
    );

    close.type = 'button';
    close.id = 'nilspe-ab-close';
    close.disabled = true;

    close.addEventListener('click', () => {
      if (running) return;

      progress.remove();
    });

    const statistics = el('div');
    statistics.id = 'nilspe-ab-statistics';

    const track = el('div');
    track.id = 'nilspe-ab-track';

    const success = el('div');
    success.id = 'nilspe-ab-success';

    const errors = el('div');
    errors.id = 'nilspe-ab-errors';

    track.append(success, errors);
    top.append(stop, status, close);

    progress.append(
      top,
      statistics,
      track
    );

    document.body.append(progress);
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
      'nilspe-ab-status'
    );

    const success = document.getElementById(
      'nilspe-ab-success'
    );

    const errorBar = document.getElementById(
      'nilspe-ab-errors'
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

  function updateStatistics(
    changed,
    completed,
    errors,
    total
  ) {
    const statistics = document.getElementById(
      'nilspe-ab-statistics'
    );

    if (!statistics) return;

    statistics.replaceChildren();

    for (const item of [
      `Umgeschaltete Gebäude: ${format(changed)}`,
      `Fehler: ${format(errors)}`,
      `Gebäude: ${format(completed)}/${format(total)}`
    ]) {
      statistics.append(el('span', '', item));
    }
  }

  function finishProgress() {
    const stop = document.getElementById(
      'nilspe-ab-stop'
    );

    const close = document.getElementById(
      'nilspe-ab-close'
    );

    if (stop) stop.disabled = true;
    if (close) close.disabled = false;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function run(desiredState) {
    if (running) return;

    running = true;
    cancelled = false;

    for (const button of buttons) {
      button.disabled = true;
    }

    ensureProgress();

    const stop = document.getElementById(
      'nilspe-ab-stop'
    );

    const close = document.getElementById(
      'nilspe-ab-close'
    );

    stop.disabled = false;
    close.disabled = true;

    let completed = 0;
    let errors = 0;
    let changed = 0;
    let total = 0;

    updateStatistics(0, 0, 0, 0);

    try {
      const dispatchCenterId = Number(
        location.pathname.match(
          /^\/buildings\/(\d+)/
        )?.[1]
      );

      if (
        !Number.isSafeInteger(dispatchCenterId) ||
        dispatchCenterId <= 0
      ) {
        throw new Error(
          'Ungültige Leitstellen-ID.'
        );
      }

      const typeKey = desiredState
        ? KEYS.activateTypes
        : KEYS.deactivateTypes;

      const types = new Set(
        parseArray(
          await GM.getValue(
            typeKey,
            JSON.stringify(DEFAULT_TYPES)
          ),
          DEFAULT_TYPES
        )
      );

      if (!types.size) {
        setProgress(
          'Keine Gebäudetypen ausgewählt',
          0, 0, 0, 'warning'
        );
        return;
      }

      const concurrency = safeNumber(
        await GM.getValue(KEYS.concurrency, 3),
        3, 1, 10
      );

      const requestDelay = safeNumber(
        await GM.getValue(KEYS.requestDelay, 100),
        100, 0, 5000
      );

      setProgress(
        'Gebäude werden geladen ...'
      );

      const buildings = await loadBuildings(
        dispatchCenterId,
        types,
        desiredState
      );

      total = buildings.length;

      if (!total) {
        setProgress(
          'Keine Umschaltung erforderlich',
          0, 0, 0, 'success'
        );
        return;
      }

      updateStatistics(0, 0, 0, total);

      let nextIndex = 0;

      async function worker() {
        while (!cancelled) {
          const index = nextIndex++;

          if (index >= total) return;

          const building = buildings[index];

          setProgress(
            `${completed}/${total}: ${building.caption}`,
            completed,
            errors,
            total
          );

          try {
            await toggleBuilding(building.id);
            changed++;
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

          updateStatistics(
            changed,
            completed,
            errors,
            total
          );

          setProgress(
            `${completed}/${total} Gebäude, ` +
            `${changed} umgeschaltet`,
            completed,
            errors,
            total,
            errors ? 'warning' : 'info'
          );

          if (
            !cancelled &&
            requestDelay > 0
          ) {
            await sleep(requestDelay);
          }
        }
      }

      await Promise.all(
        Array.from(
          {
            length: Math.min(
              concurrency,
              total
            )
          },
          () => worker()
        )
      );

      if (cancelled) {
        setProgress(
          `Abgebrochen: ${changed} umgeschaltet, ` +
          `${errors} Fehler, ${total - completed} offen`,
          completed,
          errors,
          total,
          'warning'
        );
      } else {
        setProgress(
          `Fertig: ${changed} umgeschaltet, ` +
          `${errors} Fehler`,
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
        completed,
        errors,
        total,
        'danger'
      );
    } finally {
      running = false;

      for (const button of buttons) {
        button.disabled = false;
      }

      finishProgress();
    }
  }

  /*
   * ==========================================
   * BUTTONS IN DER LEITSTELLE
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

  function addButtons() {
    const heading = document.querySelector(
      'h1[building_type]'
    );

    if (
      Number(
        heading?.getAttribute('building_type')
      ) !== 7 ||
      document.getElementById(
        'nilspe-ab-buttons'
      )
    ) {
      return;
    }

    const details = document.querySelector(
      '.building-title ~ dl.dl-horizontal'
    );

    if (!details) return;

    const term = el('dt');

    term.append(
      el('strong', '', 'Gebäude:')
    );

    const description = el('dd');

    const group = el(
      'div',
      'btn-group'
    );

    group.id = 'nilspe-ab-buttons';

    const activate = el(
      'button',
      'btn btn-default btn-xs',
      'Aktivieren'
    );

    const deactivate = el(
      'button',
      'btn btn-default btn-xs',
      'Deaktivieren'
    );

    activate.type = 'button';
    deactivate.type = 'button';

    buttons = [activate, deactivate];

    activate.addEventListener(
      'click',
      () => void run(true)
    );

    deactivate.addEventListener(
      'click',
      () => void run(false)
    );

    group.append(
      activate,
      deactivate,
      settingsButton()
    );

    description.append(group);
    details.append(term, description);
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
