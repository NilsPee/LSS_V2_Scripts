
// ==UserScript==
// @name         Leitstelle Bepo-Werber
// @namespace    NilsPe.bepo.personnel
// @version      1.3.1
// @description  BePo-Personalwerber mit getrennten Modi für unausgebildetes und ausgebildetes Personal
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

  const VERSION = '1.3.1';
  const PREFIX = '[Leitstelle BePo-Werber]';
  const SETTINGS_IDENTIFIER = 'nilspe_bepo_personnel';

  const KEYS = {
    targetPersonnel: 'nilspe_bepo_target_personnel',
    policeReserve: 'nilspe_bepo_police_reserve',
    bepoReserve: 'nilspe_bepo_bepo_reserve',
    excludedTargets: 'nilspe_bepo_excluded_targets',
    excludedSources: 'nilspe_bepo_excluded_sources',
    excludedDispatchCenters:
      'nilspe_bepo_excluded_dispatch_centers',
    limitedDispatchCenters:
      'nilspe_bepo_limited_dispatch_centers',
    requestDelay: 'nilspe_bepo_request_delay',

    mode: 'nilspe_bepo_personnel_mode_v1',
    trainingCounts: 'nilspe_bepo_training_counts_v1'
  };

  const MODES = {
    UNTRAINED: 'untrained',
    TRAINED: 'trained'
  };

  /*
   * Jede Ausbildung besitzt eine eigene
   * Stückzahl im Ausbildungsmodus.
   *
   * Die Bezeichnungen in aliases werden
   * exakt mit der Personalliste abgeglichen.
   */

  const EDUCATIONS = [
    {
      key: 'zugfuehrer',
      label: 'Zugführer',
      aliases: [
        'Zugführer',
        'Zugführer (leBefKw)'
      ]
    },
    {
      key: 'hundertschaftsfuehrer',
      label: 'Hundertschaftsführer',
      aliases: [
        'Hundertschaftsführer',
        'Hundertschaftsführer (FüKw)'
      ]
    },
    {
      key: 'wasserwerfer',
      label: 'Wasserwerfer',
      aliases: [
        'Wasserwerfer'
      ]
    },
    {
      key: 'sek',
      label: 'SEK',
      aliases: [
        'SEK'
      ]
    },
    {
      key: 'mek',
      label: 'MEK',
      aliases: [
        'MEK'
      ]
    },
    {
      key: 'hundefuehrer',
      label: 'Hundeführer',
      aliases: [
        'Hundeführer',
        'Hundeführer (Schutzhund)'
      ]
    }
  ];

  const SOURCE_TYPES = [6, 11];
  const TARGET_TYPE = 11;

  /*
   * Im Ausbildungsmodus bleibt immer
   * mindestens eine Person je Quelle.
   *
   * Die regulären Mindestpersonalwerte
   * werden dort NICHT verwendet.
   */

  const TRAINED_SOURCE_RESERVE = 1;

  let RUN_LOCK_KEY = null;
  let SESSION_RUN_KEY = null;

  let running = false;
  let cancelRequested = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text) {
      node.textContent = text;
    }

    return node;
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFC')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLocaleLowerCase('de-DE');
  }

  function parseJson(value, fallback) {
    try {
      return typeof value === 'string'
        ? JSON.parse(value)
        : value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function csrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ?? '';
  }

  function currentBuildingId() {
    const match = location.pathname.match(
      /^\/buildings\/(\d+)/
    );

    return match ? Number(match[1]) : null;
  }

  function currentBuildingType() {
    return Number(
      document.querySelector(
        'h1[building_type]'
      )?.getAttribute('building_type')
    );
  }

  /*
   * ==========================================
   * ACCOUNT / SPEICHER
   * ==========================================
   */

  async function accountStorageKey(key) {
    const accountId = await getCurrentAccountId();
    return `${key}_${accountId}`;
  }

  async function initializeAccountKeys() {
    const accountId = await getCurrentAccountId();

    RUN_LOCK_KEY =
      `nilspe_bepo_personnel_running_${accountId}`;

    SESSION_RUN_KEY =
      `nilspe_bepo_personnel_session_${accountId}`;
  }

  async function loadMode() {
    const key = await accountStorageKey(KEYS.mode);
    const mode = await GM.getValue(
      key,
      MODES.UNTRAINED
    );

    return Object.values(MODES).includes(mode)
      ? mode
      : MODES.UNTRAINED;
  }

  async function saveMode(mode) {
    if (!Object.values(MODES).includes(mode)) {
      throw new Error('Ungültiger Modus.');
    }

    const key = await accountStorageKey(KEYS.mode);
    await GM.setValue(key, mode);
  }

  function emptyTrainingCounts() {
    const result = {};

    for (const education of EDUCATIONS) {
      result[education.key] = 0;
    }

    return result;
  }

  async function loadTrainingCounts() {
    const key = await accountStorageKey(
      KEYS.trainingCounts
    );

    const raw = await GM.getValue(key, '{}');
    const parsed = parseJson(raw, {});

    const result = emptyTrainingCounts();

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return result;
    }

    for (const education of EDUCATIONS) {
      const value = Number(
        parsed[education.key] ?? 0
      );

      if (
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 400
      ) {
        result[education.key] = value;
      }
    }

    return result;
  }

  async function saveTrainingCounts(counts) {
    const key = await accountStorageKey(
      KEYS.trainingCounts
    );

    await GM.setValue(
      key,
      JSON.stringify(counts)
    );
  }

  async function storedArray(key) {
    const raw = await GM.getValue(key, '[]');
    const parsed = parseJson(raw, []);

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
      personal_count: Number(
        building.personal_count ?? 0
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

  /*
   * ==========================================
   * EINSTELLUNGEN DER SKRIPTBASIS
   * ==========================================
   *
   * Die bisherigen Keys bleiben erhalten.
   *
   * Die Modusauswahl und die sechs
   * Ausbildungsfelder werden ergänzt.
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
   * EINSTELLUNGSSTYLES
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

    const style = el('style');
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

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-number label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-number
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

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-select label {
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
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-count {
        font-size: 12px;
        opacity: .75;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-mode {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-mode-btn {
        min-height: 31px;
        min-width: 148px;
        font-size: 13px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-mode-btn.active {
        background: #5cb85c;
        color: #fff;
        border-color: #4cae4c;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-mode-info {
        font-size: 12px;
        margin-bottom: 10px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-mode-status {
        font-size: 12px;
        margin-bottom: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-bepo-training-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 7px 9px;
        margin-bottom: 4px;
        border: 1px solid #8885;
        background: #8881;
        border-radius: 3px;
      }

      #${SETTINGS_IDENTIFIER}
      .nilspe-bepo-training-row.active {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER}
      .nilspe-bepo-training-input {
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        padding: 3px 7px !important;
        margin: 0 !important;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER}
      .nilspe-bepo-training-label {
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER}
      .nilspe-bepo-training-summary {
        margin-top: 10px;
        padding: 8px 10px;
        background: #8881;
        border: 1px solid #8885;
        border-radius: 3px;
        font-size: 12px;
      }

      #${SETTINGS_IDENTIFIER}
      .nilspe-bepo-training-status {
        margin-top: 6px;
        font-size: 12px;
        opacity: .85;
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

    if (typeof jq !== 'function') return;

    const picker = jq(select);

    if (typeof picker.selectpicker === 'function') {
      picker.selectpicker('refresh');
    }
  }

  /*
   * ==========================================
   * ORIGINALFELDER DER SKRIPTBASIS
   * ==========================================
   */

  function findSettingField(body, key) {
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

    return container.parentElement === body
      ? { control, container }
      : null;
  }

  function makeGroup(title, description) {
    const details = el(
      'details',
      'nilspe-bepo-group'
    );

    const summary = el('summary', '', title);

    const content = el(
      'div',
      'nilspe-bepo-group-body'
    );

    if (description) {
      content.append(
        el('p', 'nilspe-bepo-help', description)
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  function decorateSelect(container, select) {
    const toolbar = el(
      'div',
      'nilspe-bepo-toolbar'
    );

    const clear = el(
      'button',
      'btn btn-default btn-xs nilspe-bepo-bulk',
      'Alle abwählen'
    );

    clear.type = 'button';

    const count = el(
      'span',
      'nilspe-bepo-count'
    );

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
        'changed.bs.select.nilspeBepoUi',
        updateCount
      );
    }

    toolbar.append(clear, count);
    container.append(toolbar);

    updateCount();
  }

  /*
   * ==========================================
   * MODUSAUSWAHL
   * ==========================================
   *
   * Die Auswahl steht ganz oben.
   *
   * Beide Modi haben eigene Einstellungen.
   * Gemeinsame Filter bleiben erhalten.
   */

  async function createModeSelector(
    root,
    untrainedGroup,
    trainedGroup
  ) {
    const wrapper = el(
      'div',
      'nilspe-bepo-mode'
    );

    const untrainedButton = el(
      'button',
      'btn btn-default nilspe-bepo-mode-btn',
      'Ohne Ausbildung'
    );

    const trainedButton = el(
      'button',
      'btn btn-default nilspe-bepo-mode-btn',
      'Mit Ausbildung'
    );

    untrainedButton.type = 'button';
    trainedButton.type = 'button';

    const status = el(
      'div',
      'nilspe-bepo-mode-status'
    );

    const info = el(
      'p',
      'nilspe-bepo-mode-info'
    );

    wrapper.append(
      untrainedButton,
      trainedButton
    );

    root.append(wrapper, status, info);

    let mode = await loadMode();

    function renderMode() {
      untrainedButton.classList.toggle(
        'active',
        mode === MODES.UNTRAINED
      );

      trainedButton.classList.toggle(
        'active',
        mode === MODES.TRAINED
      );

      untrainedGroup.details.style.display =
        mode === MODES.UNTRAINED ? '' : 'none';

      trainedGroup.details.style.display =
        mode === MODES.TRAINED ? '' : 'none';

      untrainedGroup.details.open =
        mode === MODES.UNTRAINED;

      trainedGroup.details.open =
        mode === MODES.TRAINED;

      info.textContent =
        mode === MODES.UNTRAINED
          ? 'Ohne Ausbildung: Die Zielwachen werden ' +
            'bis zum eingestellten Gesamtpersonalbestand ' +
            'aufgefüllt. Die Mindestpersonalwerte ' +
            'der Quellwachen gelten.'
          : 'Mit Ausbildung: Die eingestellten Mengen ' +
            'werden pro BePo-Zielwache verschoben. ' +
            'Die Mindestpersonalwerte werden ignoriert; ' +
            'eine Person verbleibt je Quellwache.';
    }

    async function changeMode(nextMode) {
      if (mode === nextMode) return;

      const previousMode = mode;
      mode = nextMode;

      renderMode();

      status.textContent = 'Speichere Modus ...';

      try {
        await saveMode(nextMode);
        status.textContent = 'Modus gespeichert';
      } catch (error) {
        mode = previousMode;
        renderMode();

        status.textContent =
          'Modus konnte nicht gespeichert werden';

        console.error(PREFIX, error);
      }
    }

    untrainedButton.addEventListener(
      'click',
      () => void changeMode(MODES.UNTRAINED)
    );

    trainedButton.addEventListener(
      'click',
      () => void changeMode(MODES.TRAINED)
    );

    renderMode();
  }

  /*
   * ==========================================
   * SECHS AUSBILDUNGSFELDER
   * ==========================================
   */

  async function createTrainingSettings(content) {
    if (
      content.querySelector(
        '#nilspe-bepo-training-settings'
      )
    ) {
      return;
    }

    const root = el('div');
    root.id = 'nilspe-bepo-training-settings';

    const summary = el(
      'div',
      'nilspe-bepo-training-summary'
    );

    const status = el(
      'div',
      'nilspe-bepo-training-status'
    );

    const inputs = new Map();
    const rows = new Map();

    for (const education of EDUCATIONS) {
      const row = el(
        'div',
        'nilspe-bepo-training-row'
      );

      const input = el(
        'input',
        'form-control nilspe-bepo-training-input'
      );

      input.type = 'number';
      input.min = '0';
      input.max = '400';
      input.step = '1';
      input.value = '0';

      input.id =
        `nilspe-bepo-training-${education.key}`;

      const label = el(
        'label',
        'nilspe-bepo-training-label',
        education.label
      );

      label.htmlFor = input.id;

      row.append(input, label);
      root.append(row);

      inputs.set(education.key, input);
      rows.set(education.key, row);
    }

    root.append(summary, status);
    content.append(root);

    for (const input of inputs.values()) {
      input.disabled = true;
    }

    let counts;

    try {
      counts = await loadTrainingCounts();
    } catch (error) {
      status.textContent =
        'Ausbildungswerte konnten nicht geladen werden.';

      console.error(PREFIX, error);
      return;
    }

    function updateSummary() {
      let total = 0;
      let active = 0;

      for (const education of EDUCATIONS) {
        const input = inputs.get(education.key);
        const row = rows.get(education.key);

        const amount = Math.max(
          0,
          Number(input.value) || 0
        );

        total += amount;

        if (amount > 0) active++;

        row.classList.toggle(
          'active',
          amount > 0
        );
      }

      summary.textContent =
        `${active} Ausbildungsarten aktiv · ` +
        `${total} Personen pro Zielwache und Durchlauf`;
    }

    for (const education of EDUCATIONS) {
      const input = inputs.get(education.key);

      input.value = String(
        counts[education.key] ?? 0
      );

      input.disabled = false;
    }

    let saveQueue = Promise.resolve();

    function collectCounts() {
      const next = {};

      for (const education of EDUCATIONS) {
        const input = inputs.get(education.key);
        const raw = input.value;
        const value = Number(raw);

        if (
          raw.trim() === '' ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > 400
        ) {
          throw new Error(
            `Ungültiger Wert bei ${education.label}. ` +
            'Erlaubt sind ganze Zahlen von 0 bis 400.'
          );
        }

        next[education.key] = value;
      }

      return next;
    }

    function persist() {
      let next;

      try {
        next = collectCounts();
      } catch (error) {
        status.textContent = error.message;
        return;
      }

      updateSummary();
      status.textContent = 'Speichere ...';

      saveQueue = saveQueue
        .catch(() => {})
        .then(() => saveTrainingCounts(next))
        .then(() => {
          counts = next;
          status.textContent = 'Gespeichert';
        })
        .catch(error => {
          status.textContent =
            'Speichern fehlgeschlagen';

          console.error(PREFIX, error);
        });
    }

    for (const input of inputs.values()) {
      input.addEventListener(
        'input',
        updateSummary
      );

      input.addEventListener(
        'change',
        persist
      );
    }

    updateSummary();
    status.textContent = 'Ausbildungswerte geladen';
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

    if (
      body.querySelector('.nilspe-bepo-groups')
    ) {
      return true;
    }

    const fields = new Map();

    for (const definition of SETTINGS_DEFINITIONS) {
      if (!definition.key) continue;

      const field = findSettingField(
        body,
        definition.key
      );

      if (!field) return false;

      fields.set(definition.key, field);
    }

    injectSettingsStyles();

    const root = el(
      'section',
      'nilspe-bepo-groups'
    );

    root.append(
      el('h2', '', 'BePo-Personalwerber')
    );

    const untrainedGroup = makeGroup(
      'Ohne Ausbildung',
      'Auf den gewünschten Gesamtpersonalbestand ' +
      'auffüllen. Die Mindestpersonalwerte gelten.'
    );

    const trainedGroup = makeGroup(
      'Mit Ausbildung',
      'Feste Anzahl pro Ausbildung und Zielwache. ' +
      'Die Mindestpersonalwerte gelten hier nicht.'
    );

    const commonGroup = makeGroup(
      'Allgemein',
      'Gemeinsame Anfragepause.'
    );

    const targetGroup = makeGroup(
      'Zielwachen',
      'Diese BePo-Wachen werden nicht bearbeitet.'
    );

    const sourceGroup = makeGroup(
      'Quellwachen',
      'Von diesen Wachen wird kein Personal entnommen.'
    );

    const dispatchGroup = makeGroup(
      'Leitstellenfilter',
      'Beide Filter gelten für die Personalquellen.'
    );

    const assignments = [
      {
        group: untrainedGroup,
        keys: [
          KEYS.targetPersonnel,
          KEYS.policeReserve,
          KEYS.bepoReserve
        ]
      },
      {
        group: commonGroup,
        keys: [
          KEYS.requestDelay
        ]
      },
      {
        group: targetGroup,
        keys: [
          KEYS.excludedTargets
        ]
      },
      {
        group: sourceGroup,
        keys: [
          KEYS.excludedSources
        ]
      },
      {
        group: dispatchGroup,
        keys: [
          KEYS.excludedDispatchCenters,
          KEYS.limitedDispatchCenters
        ]
      }
    ];

    for (const assignment of assignments) {
      for (const key of assignment.keys) {
        const field = fields.get(key);

        field.container.classList.add(
          'nilspe-bepo-field'
        );

        if (field.control.tagName === 'SELECT') {
          field.container.classList.add(
            'nilspe-bepo-select'
          );

          decorateSelect(
            field.container,
            field.control
          );
        } else {
          field.container.classList.add(
            'nilspe-bepo-number',
            'selected'
          );
        }

        assignment.group.content.append(
          field.container
        );
      }
    }

    /*
     * Modusauswahl oben.
     * Die passende Einstellungsgruppe
     * wird sichtbar gemacht.
     */

    const modeContainer = el('div');

    root.append(
      modeContainer,
      untrainedGroup.details,
      trainedGroup.details,
      commonGroup.details,
      targetGroup.details,
      sourceGroup.details,
      dispatchGroup.details
    );

    /*
     * Nur die alte Überschrift entfernen.
     * Die Originalfelder bleiben bestehen.
     */

    for (const child of [...body.children]) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        child.textContent.trim() ===
          'Allgemeine Einstellungen'
      ) {
        child.remove();
      }
    }

    body.prepend(root);

    void createModeSelector(
      modeContainer,
      untrainedGroup,
      trainedGroup
    ).catch(error => {
      console.error(
        PREFIX,
        'Modusauswahl konnte nicht geladen werden:',
        error
      );
    });

    void createTrainingSettings(
      trainedGroup.content
    ).catch(error => {
      console.error(
        PREFIX,
        'Ausbildungsfelder konnten nicht geladen werden:',
        error
      );
    });

    console.log(
      PREFIX,
      `Einstellungsoberfläche v${VERSION} geladen`
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
      title: 'BePo-Personal',
      settings: SETTINGS_DEFINITIONS
    });

    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) return;

    let scheduled = false;

    const observer = new MutationObserver(() => {
      if (scheduled) return;

      scheduled = true;

      queueMicrotask(() => {
        scheduled = false;

        try {
          groupRenderedSettings();
        } catch (error) {
          console.error(
            PREFIX,
            'Einstellungsoberfläche fehlgeschlagen:',
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
   * GEBÄUDE LADEN
   * ==========================================
   */

  async function loadBuildings() {
    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      return (await getAllData(
        db,
        'buildings'
      ))
        .map(normalizeBuilding)
        .filter(building =>
          SOURCE_TYPES.includes(
            building.building_type
          )
        );
    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * KONFIGURATION
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
      mode: await loadMode(),

      targetPersonnel: await numberValue(
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

      trainingCounts: await loadTrainingCounts(),

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
   *
   * Beide Modi verwenden dieselben
   * Zielwachen und Zielwachen-Ausschlüsse.
   */

  function selectTargets(
    buildings,
    config,
    context
  ) {
    return buildings
      .filter(building =>
        building.building_type === TARGET_TYPE
      )
      .filter(building =>
        !config.excludedTargets.has(
          building.id
        )
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
      .sort((a, b) => a.id - b.id);
  }

  /*
   * ==========================================
   * QUELLWACHEN
   * ==========================================
   *
   * OHNE AUSBILDUNG:
   *   Polizei-Mindestpersonal
   *   BePo-Mindestpersonal
   *
   * MIT AUSBILDUNG:
   *   Mindestpersonal ignorieren.
   *   Nur eine Person verbleibt.
   */

  function reserveForBuilding(building, config) {
    if (config.mode === MODES.TRAINED) {
      return TRAINED_SOURCE_RESERVE;
    }

    return building.building_type === 11
      ? config.bepoReserve
      : config.policeReserve;
  }

  function selectSources(buildings, config) {
    const limited =
      config.limitedDispatchCenters.size > 0;

    return buildings
      .filter(building =>
        !config.excludedSources.has(
          building.id
        )
      )
      .filter(building =>
        !config.excludedDispatchCenters.has(
          building.leitstelle_building_id
        )
      )
      .filter(building =>
        !limited ||
        config.limitedDispatchCenters.has(
          building.leitstelle_building_id
        )
      )
      .map(building => {
        const reserve = reserveForBuilding(
          building,
          config
        );

        return {
          ...building,
          reserve,
          available: Math.max(
            building.personal_count - reserve,
            0
          )
        };
      })
      .filter(building => building.available > 0)
      .sort((a, b) =>
        b.available - a.available ||
        a.id - b.id
      );
  }

  /*
   * ==========================================
   * PERSONALLISTEN
   * ==========================================
   */

  function personnelTable(doc, buildingId) {
    return doc.getElementById(
      `personal_table_${buildingId}`
    ) ?? doc.querySelector('table');
  }

  function countPersonnel(doc, buildingId) {
    const table = personnelTable(
      doc,
      buildingId
    );

    return table
      ? table.querySelectorAll('tbody tr').length
      : null;
  }

  async function loadPersonnelDocument(buildingId) {
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
        `Personalliste HTTP ${response.status}`
      );
    }

    return new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
  }

  /*
   * ==========================================
   * PERSONAL FILTERN
   * ==========================================
   *
   * Die bisherige Tabellenstruktur wird
   * weiterhin verwendet:
   *
   * td[0] = Personal-ID
   * td[2] = Ausbildung
   * td[3] = laufender Lehrgang
   *
   * Personen in laufender Ausbildung
   * werden nicht verschoben.
   */

  function matchingPersonnelIds(
    doc,
    buildingId,
    educationKey
  ) {
    const table = personnelTable(
      doc,
      buildingId
    );

    if (!table) return [];

    let accepted;

    if (educationKey === 'untrained') {
      accepted = new Set(['']);
    } else {
      const education = EDUCATIONS.find(
        item => item.key === educationKey
      );

      if (!education) {
        throw new Error(
          `Unbekannte Ausbildung: ${educationKey}`
        );
      }

      accepted = new Set(
        education.aliases.map(normalizeText)
      );
    }

    const ids = [];

    for (const row of table.querySelectorAll(
      'tbody tr'
    )) {
      const cells = row.querySelectorAll('td');

      const input = cells[0]?.querySelector(
        'input[value]'
      );

      if (!input?.value) continue;

      const schoolingCell = cells[2];
      const courseCell = cells[3];

      if (!schoolingCell || !courseCell) {
        continue;
      }

      const schooling = normalizeText(
        schoolingCell.textContent
      );

      const currentCourse = normalizeText(
        courseCell.textContent
      );

      if (currentCourse !== '') {
        continue;
      }

      if (accepted.has(schooling)) {
        ids.push(input.value);
      }
    }

    return ids;
  }

  /*
   * ==========================================
   * PERSONALQUELLE LADEN
   * ==========================================
   *
   * Quellbestand wird live gezählt.
   * Die gewählte Reserve wird beachtet.
   *
   * Im Ausbildungsmodus ist die Reserve 1.
   */

  async function sourcePersonnelPool(
    source,
    allPools
  ) {
    if (allPools.has(source.id)) {
      return allPools.get(source.id);
    }

    const doc = await loadPersonnelDocument(
      source.id
    );

    const liveCount = countPersonnel(
      doc,
      source.id
    );

    if (!Number.isInteger(liveCount)) {
      throw new Error(
        'Personalbestand konnte nicht ermittelt werden.'
      );
    }

    source.personal_count = liveCount;

    source.available = Math.max(
      Math.min(
        source.available,
        liveCount - source.reserve
      ),
      0
    );

    const byEducation = new Map();

    byEducation.set(
      'untrained',
      matchingPersonnelIds(
        doc,
        source.id,
        'untrained'
      )
    );

    for (const education of EDUCATIONS) {
      byEducation.set(
        education.key,
        matchingPersonnelIds(
          doc,
          source.id,
          education.key
        )
      );
    }

    const pool = { byEducation };

    allPools.set(source.id, pool);

    return pool;
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
    if (!personnelIds.length) return;

    const token = csrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token wurde nicht gefunden.'
      );
    }

    const form = new URLSearchParams();

    form.append('utf8', '✓');
    form.append('authenticity_token', token);

    for (const id of personnelIds) {
      form.append('personal_ids[]', id);
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
   * QUELLEN NACH TRANSFER AKTUALISIEREN
   * ==========================================
   */

  function updateSourceCounts(
    sources,
    target,
    reservations,
    transferred
  ) {
    target.personal_count += transferred;

    const targetSource = sources.find(
      source => source.id === target.id
    );

    if (targetSource) {
      targetSource.personal_count += transferred;

      /*
       * Neu eingetroffene Personen werden
       * nicht in bereits geladene Quellen-
       * Pools aufgenommen.
       */
    }

    for (const reservation of reservations) {
      const source = reservation.source;

      source.personal_count = Math.max(
        source.personal_count -
        reservation.ids.length,
        0
      );

      source.available = Math.max(
        Math.min(
          source.available,
          source.personal_count - source.reserve
        ),
        0
      );
    }
  }

  /*
   * ==========================================
   * PERSONAL VERSCHIEBEN
   * ==========================================
   *
   * Verwendet in beiden Modi dieselbe
   * Übernahmelogik.
   *
   * Unterschiedlich sind:
   *   - gesuchte Ausbildung
   *   - benötigte Menge
   *   - Quellreserve
   */

  async function fillEducation(
    target,
    educationKey,
    wanted,
    sources,
    config,
    allPools
  ) {
    const selectedIds = [];
    const reservations = [];

    for (const source of sources) {
      if (
        !runIsActive() ||
        selectedIds.length >= wanted
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
        const pool = await sourcePersonnelPool(
          source,
          allPools
        );

        const availableIds =
          pool.byEducation.get(educationKey) ?? [];

        const count = Math.min(
          wanted - selectedIds.length,
          source.available,
          availableIds.length
        );

        if (count <= 0) continue;

        const ids = availableIds.splice(
          0,
          count
        );

        selectedIds.push(...ids);

        reservations.push({
          source,
          availableIds,
          ids
        });

        source.available -= ids.length;

      } catch (error) {
        console.warn(
          PREFIX,
          'Quellwache übersprungen:',
          source.id,
          educationKey,
          error
        );
      }

      if (config.requestDelay > 0) {
        await sleep(config.requestDelay);
      }
    }

    /*
     * Bei Abbruch vor der Übernahme
     * alle reservierten IDs freigeben.
     */

    if (!selectedIds.length || !runIsActive()) {
      for (const reservation of reservations) {
        reservation.availableIds.unshift(
          ...reservation.ids
        );

        reservation.source.available +=
          reservation.ids.length;
      }

      return 0;
    }

    try {
      await adoptPersonnel(
        target.id,
        selectedIds
      );
    } catch (error) {
      for (const reservation of reservations) {
        reservation.availableIds.unshift(
          ...reservation.ids
        );

        reservation.source.available +=
          reservation.ids.length;
      }

      throw error;
    }

    updateSourceCounts(
      sources,
      target,
      reservations,
      selectedIds.length
    );

    return selectedIds.length;
  }

  /*
   * ==========================================
   * MODUS 1: OHNE AUSBILDUNG
   * ==========================================
   *
   * Gesamtpersonal-Sollwert.
   * Quellreserven gelten.
   */

  async function fillTargetUntrained(
    target,
    sources,
    config,
    allPools
  ) {
    try {
      const doc = await loadPersonnelDocument(
        target.id
      );

      const liveCount = countPersonnel(
        doc,
        target.id
      );

      if (Number.isInteger(liveCount)) {
        target.personal_count = liveCount;
      }
    } catch (error) {
      console.warn(
        PREFIX,
        'Live-Zielbestand nicht geladen:',
        target.id,
        error
      );
    }

    const wanted = Math.max(
      config.targetPersonnel -
      target.personal_count,
      0
    );

    if (wanted <= 0) {
      return {
        transferred: 0,
        missing: 0
      };
    }

    const transferred = await fillEducation(
      target,
      'untrained',
      wanted,
      sources,
      config,
      allPools
    );

    return {
      transferred,
      missing: runIsActive()
        ? Math.max(wanted - transferred, 0)
        : 0
    };
  }

  /*
   * ==========================================
   * MODUS 2: MIT AUSBILDUNG
   * ==========================================
   *
   * Alle sechs Ausbildungsmengen werden
   * für jede Zielwache abgearbeitet.
   *
   * Kein Soll-Ist-Abgleich.
   * Keine regulären Mindestpersonalwerte.
   * Eine Person pro Quelle verbleibt.
   */

  async function fillTargetTrained(
    target,
    sources,
    config,
    allPools
  ) {
    let transferred = 0;
    let missing = 0;

    for (const education of EDUCATIONS) {
      if (!runIsActive()) break;

      const wanted = Number(
        config.trainingCounts[education.key] ?? 0
      );

      if (wanted <= 0) continue;

      const moved = await fillEducation(
        target,
        education.key,
        wanted,
        sources,
        config,
        allPools
      );

      transferred += moved;

      if (runIsActive()) {
        const shortage = Math.max(
          wanted - moved,
          0
        );

        missing += shortage;

        if (shortage > 0) {
          console.warn(
            PREFIX,
            'Fehlmenge:',
            target.caption,
            education.label,
            `Gewünscht: ${wanted}`,
            `Übernommen: ${moved}`
          );
        }
      }
    }

    return { transferred, missing };
  }

  /*
   * ==========================================
   * LAUFSPERRE
   * ==========================================
   */

  function runIsActive() {
    return running && !cancelRequested;
  }

  async function acquireRunLock() {
    if (!RUN_LOCK_KEY || !SESSION_RUN_KEY) {
      await initializeAccountKeys();
    }

    if (running) return false;

    const existing = await GM.getValue(
      RUN_LOCK_KEY,
      false
    );

    if (existing) {
      console.warn(
        PREFIX,
        'Vorhandene Laufsperre erkannt.'
      );
      return false;
    }

    running = true;
    cancelRequested = false;

    sessionStorage.setItem(
      SESSION_RUN_KEY,
      'true'
    );

    try {
      await GM.setValue(RUN_LOCK_KEY, true);
    } catch (error) {
      running = false;

      sessionStorage.removeItem(
        SESSION_RUN_KEY
      );

      throw error;
    }

    return true;
  }

  async function stopRun(
    message = 'Abgebrochen',
    type = 'warning'
  ) {
    cancelRequested = true;
    running = false;

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

    const style = el('style');
    style.id = 'nilspe-bepo-progress-style';

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

    const container = el('div');
    container.id = 'nilspe-bepo-progress';

    const row = el('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:12px';

    const cancelButton = el(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancelButton.type = 'button';

    cancelButton.addEventListener('click', () => {
      cancelRequested = true;

      const status = document.getElementById(
        'nilspe-bepo-status'
      );

      if (status) {
        status.className = 'label label-warning';
        status.textContent =
          'Abbruch angefordert';
      }
    });

    const status = el(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id = 'nilspe-bepo-status';

    const track = el('div');
    track.id = 'nilspe-bepo-track';

    const fill = el('div');
    fill.id = 'nilspe-bepo-fill';

    track.append(fill);

    row.append(cancelButton, status);
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
      'nilspe-bepo-status'
    );

    const fill = document.getElementById(
      'nilspe-bepo-fill'
    );

    status.className = `label label-${type}`;
    status.textContent = message;

    fill.style.width = total > 0
      ? `${Math.min(
          100,
          completed / total * 100
        )}%`
      : '0%';
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function runRecruiter() {
    if (!await acquireRunLock()) {
      setProgress(
        'Personalwerber läuft bereits.',
        0,
        0,
        'warning'
      );
      return;
    }

    try {
      setProgress(
        'Gebäude werden geladen ...'
      );

      const config = await loadConfiguration();

      if (config.mode === MODES.UNTRAINED) {
        if (
          !Number.isInteger(config.targetPersonnel) ||
          config.targetPersonnel <= 0
        ) {
          throw new Error(
            'Bitte ein Zielpersonal größer als 0 einstellen.'
          );
        }
      } else {
        const activeCount = EDUCATIONS.reduce(
          (sum, education) =>
            sum + Number(
              config.trainingCounts[education.key] ?? 0
            ),
          0
        );

        if (activeCount <= 0) {
          throw new Error(
            'Bitte mindestens eine Ausbildung ' +
            'mit einer Anzahl größer als 0 aktivieren.'
          );
        }
      }

      const buildings = await loadBuildings();

      const type = currentBuildingType();
      const id = currentBuildingId();

      const context = {
        buildingId:
          type === TARGET_TYPE
            ? id
            : null,

        dispatchCenterId:
          type === 7
            ? id
            : null
      };

      const targets = selectTargets(
        buildings,
        config,
        context
      );

      const sources = selectSources(
        buildings,
        config
      );

      if (!targets.length) {
        await stopRun(
          'Keine passenden BePo-Zielwachen vorhanden',
          'success'
        );
        return;
      }

      if (!sources.length) {
        throw new Error(
          'Keine zulässigen Quellwachen mit verfügbarem Personal.'
        );
      }

      console.log(
        PREFIX,
        'Start',
        {
          mode: config.mode,
          targets: targets.length,
          targetPersonnel: config.targetPersonnel,
          trainingCounts: config.trainingCounts,
          sourceReserve:
            config.mode === MODES.TRAINED
              ? TRAINED_SOURCE_RESERVE
              : {
                  police: config.policeReserve,
                  bepo: config.bepoReserve
                }
        }
      );

      let completed = 0;
      let transferred = 0;
      let shortages = 0;
      let errors = 0;

      const allPools = new Map();

      for (const target of targets) {
        if (!runIsActive()) break;

        setProgress(
          `${completed}/${targets.length}: ${target.caption}`,
          completed,
          targets.length
        );

        try {
          const result =
            config.mode === MODES.TRAINED
              ? await fillTargetTrained(
                  target,
                  sources,
                  config,
                  allPools
                )
              : await fillTargetUntrained(
                  target,
                  sources,
                  config,
                  allPools
                );

          transferred += result.transferred;
          shortages += result.missing;

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
          `${transferred} Personen verschoben`,
          completed,
          targets.length,
          errors || shortages
            ? 'warning'
            : 'success'
        );
      }

      await stopRun(
        cancelRequested
          ? `Abgebrochen: ${transferred} Personen übernommen`
          : `Fertig: ${transferred} Personen, ` +
            `${shortages} fehlend, ${errors} Fehler`,
        cancelRequested || shortages || errors
          ? 'warning'
          : 'success'
      );

    } catch (error) {
      console.error(
        PREFIX,
        'Personalwerber fehlgeschlagen:',
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

    const term = el('dt');

    term.append(
      el('strong', '', 'Personal werben:')
    );

    const description = el('dd');

    const group = el(
      'div',
      'btn-group'
    );

    group.id = 'nilspe-bepo-buttons';

    const startButton = el(
      'button',
      'btn btn-default btn-xs',
      'BePo-Personal werben'
    );

    startButton.type = 'button';

    startButton.addEventListener(
      'click',
      () => void runRecruiter()
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
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();
    return;
  }

  const buildingType = currentBuildingType();

  if (![7, 11].includes(buildingType)) {
    return;
  }

  window.addEventListener('pagehide', () => {
    cancelRequested = true;

    if (SESSION_RUN_KEY) {
      sessionStorage.removeItem(
        SESSION_RUN_KEY
      );
    }

    if (RUN_LOCK_KEY && running) {
      void GM.deleteValue(RUN_LOCK_KEY);
    }
  });

  addBuildingButtons();

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );

})();
