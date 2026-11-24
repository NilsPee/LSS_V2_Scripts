
// ==UserScript==
// @name         Leitstelle Share Buildings
// @namespace    NilsPe.share.buildings
// @version      2.1.1
// @description  Gibt Krankenhausbetten und Polizeizellen im Verband frei und setzt die Gebühren
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Share-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Share-Buildings.user.js
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

  const VERSION = '2.1.1';
  const PREFIX = '[Leitstelle Share Buildings]';
  const SETTINGS_IDENTIFIER = 'nilspe_share_buildings';

  const KEYS = {
    processHospitals: 'nilspe_sb_process_hospitals',
    processCells: 'nilspe_sb_process_cells',
    hospitalPercent: 'nilspe_sb_hospital_percent',
    cellPercent: 'nilspe_sb_cell_percent',
    showUnshareButton: 'nilspe_sb_show_unshare_button',
    concurrency: 'nilspe_sb_concurrency',
    requestDelay: 'nilspe_sb_request_delay'
  };

  const FEE_OPTIONS = [
    { value: 0, name: '0 %' },
    { value: 10, name: '10 %' },
    { value: 20, name: '20 %' },
    { value: 30, name: '30 %' },
    { value: 40, name: '40 %' },
    { value: 50, name: '50 %' }
  ];

  let running = false;
  let busy = false;
  let cancelRequested = false;
  let addingButtons = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function format(value) {
    return Number(value).toLocaleString('de-DE');
  }

  function clampNumber(raw, fallback, min, max) {
    const number = Number(raw);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }

  // ============================================================
  // EINSTELLUNGEN
  // ============================================================

  const SETTINGS = [
    {
      type: 'header',
      text: 'Gebäude'
    },
    {
      type: 'checkbox',
      key: KEYS.processHospitals,
      label: 'Krankenhausbetten freigeben',
      default: true
    },
    {
      type: 'checkbox',
      key: KEYS.processCells,
      label: 'Polizeizellen freigeben',
      default: true
    },
    {
      type: 'header',
      text: 'Gebühren'
    },
    {
      type: 'select',
      key: KEYS.hospitalPercent,
      label: 'Krankenhausgebühr',
      title: 'Gebühr auswählen',
      multiple: false,
      options: FEE_OPTIONS
    },
    {
      type: 'select',
      key: KEYS.cellPercent,
      label: 'Zellengebühr',
      title: 'Gebühr auswählen',
      multiple: false,
      options: FEE_OPTIONS
    },
    {
      type: 'header',
      text: 'Bedienung'
    },
    {
      type: 'checkbox',
      key: KEYS.showUnshareButton,
      label: 'Button zum Zurücknehmen der Freigaben einblenden',
      default: false
    },
    {
      type: 'header',
      text: 'Ablauf'
    },
    {
      type: 'number',
      key: KEYS.concurrency,
      label: 'Parallele Gebäude',
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
      default: 100
    }
  ];

  // ============================================================
  // EINHEITLICHE EINSTELLUNGSOBERFLÄCHE
  // ============================================================

  function injectSettingsStyles() {
    if (document.getElementById('nilspe-sb-settings-style')) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-sb-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-sb-settings-root {
        margin-bottom: 24px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-group-body {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-field {
        box-sizing: border-box;
        margin-bottom: 4px;
        padding: 7px 9px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-field .form-group {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-field .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-number .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-number label {
        order: 2;
        flex: 1;
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-number input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        text-align: left;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-checkbox .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-checkbox input[type="checkbox"] {
        position: static !important;
        margin: 0 !important;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-checkbox label {
        margin: 0;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-select label {
        display: block;
        margin-bottom: 6px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-select .bootstrap-select {
        max-width: 100%;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-select .bootstrap-select > button {
        min-height: 28px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-sb-note {
        padding: 8px 10px;
        margin-top: 8px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
        font-size: 12px;
        opacity: .9;
      }
    `;

    document.head.append(style);
  }

  function settingField(body, key) {
    const prefix = `nilspe_setting_${key}_`;

    const control = Array.from(
      body.querySelectorAll('input[id], select[id]')
    ).find(node => node.id.startsWith(prefix));

    if (!control) return null;

    let container = control;

    while (
      container.parentElement &&
      container.parentElement !== body
    ) {
      container = container.parentElement;
    }

    if (container.parentElement !== body) return null;

    return { control, container };
  }

  function makeGroup(title, description) {
    const details = el('details', 'nilspe-sb-group');
    const summary = el('summary', '', title);
    const content = el('div', 'nilspe-sb-group-body');

    if (description) {
      content.append(
        el('p', 'nilspe-sb-info', description)
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  function decorateField(field) {
    const { control, container } = field;

    container.classList.add('nilspe-sb-field');

    if (control.tagName === 'SELECT') {
      container.classList.add('nilspe-sb-select', 'selected');
      return;
    }

    if (control.type === 'number') {
      container.classList.add('nilspe-sb-number', 'selected');
      return;
    }

    if (control.type === 'checkbox') {
      container.classList.add('nilspe-sb-checkbox');

      const update = () => {
        container.classList.toggle('selected', control.checked);
      };

      control.addEventListener('change', update);
      update();
    }
  }

  function groupRenderedSettings() {
    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector('.settings-tab-body');

    if (!body) return false;

    if (body.querySelector('.nilspe-sb-settings-root')) {
      return true;
    }

    const fields = new Map();

    for (const definition of SETTINGS) {
      if (!definition.key) continue;

      const field = settingField(body, definition.key);

      if (!field) return false;

      fields.set(definition.key, field);
    }

    injectSettingsStyles();

    const root = el('section', 'nilspe-sb-settings-root');

    root.append(
      el('h2', '', 'Share Buildings'),
      el(
        'p',
        'nilspe-sb-info',
        'Krankenhausbetten und Polizeizellen für den Verband ' +
        'freigeben und ihre Gebühren getrennt einstellen.'
      )
    );

    const buildings = makeGroup(
      'Gebäude',
      'Welche Gebäudebereiche sollen berücksichtigt werden?'
    );

    const fees = makeGroup(
      'Gebühren',
      'Gebühren für Krankenhausbetten und Polizeizellen.'
    );

    const controls = makeGroup(
      'Bedienung',
      'Optionalen Button zum Zurücknehmen von Freigaben einblenden.'
    );

    const flow = makeGroup(
      'Ablauf',
      'Parallele Verarbeitung und Anfragepause.'
    );

    const assignments = [
      {
        group: buildings,
        keys: [
          KEYS.processHospitals,
          KEYS.processCells
        ]
      },
      {
        group: fees,
        keys: [
          KEYS.hospitalPercent,
          KEYS.cellPercent
        ]
      },
      {
        group: controls,
        keys: [
          KEYS.showUnshareButton
        ]
      },
      {
        group: flow,
        keys: [
          KEYS.concurrency,
          KEYS.requestDelay
        ]
      }
    ];

    for (const assignment of assignments) {
      for (const key of assignment.keys) {
        const field = fields.get(key);

        decorateField(field);
        assignment.group.content.append(field.container);
      }

      root.append(assignment.group.details);
    }

    controls.content.append(
      el(
        'div',
        'nilspe-sb-note',
        'Diese Option blendet einen zusätzlichen Button im ' +
        'Reiter „Gebäude“ ein. Freigaben werden dadurch ' +
        'nicht automatisch zurückgenommen.'
      )
    );

    for (const child of [...body.children]) {
      if (
        /^H[1-6]$/.test(child.tagName) &&
        [
          'Gebaeude',
          'Gebäude',
          'Gebuehren',
          'Gebühren',
          'Bedienung',
          'Ablauf'
        ].includes(child.textContent.trim())
      ) {
        child.remove();
      }
    }

    body.prepend(root);

    console.log(PREFIX, `Einstellungen v${VERSION} geladen`);
    return true;
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(PREFIX, 'NilsPe-Skriptbasis fehlt.');
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Share Buildings',
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

  // ============================================================
  // KONFIGURATION
  // ============================================================

  function parseSelectValue(value, fallback) {
    try {
      const parsed = typeof value === 'string'
        ? JSON.parse(value)
        : value;

      if (Array.isArray(parsed)) {
        return parsed.length ? Number(parsed[0]) : fallback;
      }

      const number = Number(parsed);
      return Number.isFinite(number) ? number : fallback;
    } catch {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }
  }

  async function configuration() {
    return {
      processHospitals: await GM.getValue(
        KEYS.processHospitals,
        true
      ),
      processCells: await GM.getValue(
        KEYS.processCells,
        true
      ),
      hospitalPercent: parseSelectValue(
        await GM.getValue(
          KEYS.hospitalPercent,
          JSON.stringify([10])
        ),
        10
      ),
      cellPercent: parseSelectValue(
        await GM.getValue(
          KEYS.cellPercent,
          JSON.stringify([10])
        ),
        10
      ),
      showUnshareButton: await GM.getValue(
        KEYS.showUnshareButton,
        false
      ),
      concurrency: clampNumber(
        await GM.getValue(KEYS.concurrency, 3),
        3,
        1,
        5
      ),
      requestDelay: clampNumber(
        await GM.getValue(KEYS.requestDelay, 100),
        100,
        0,
        5000
      )
    };
  }

  // ============================================================
  // TABELLE UND ZIELE
  // ============================================================

  function norm(value) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function pctToStep(percent) {
    const number = Number(percent);

    if (![0, 10, 20, 30, 40, 50].includes(number)) {
      throw new Error(`Ungültiger Prozentwert: ${number}`);
    }

    return number / 10;
  }

  /*
   * Der Button befindet sich ab v2.1.1
   * im Reiter "Gebäude".
   *
   * Die Freigabe- und Gebührenlinks werden
   * weiterhin aus der Erweiterungstabelle
   * der Leitstelle ausgelesen.
   */

  function buildingTable() {
    return (
      document.getElementById('building_table') ??
      document.querySelector('#tab_buildings table')
    );
  }

  function extensionTable() {
    return document.querySelector('#tab_extensions table');
  }

  function isBlockHeaderRow(row) {
    const button = row.querySelector('a.btn');

    if (!button) return false;

    const text = norm(button.textContent);

    return (
      text.includes('im verband freigeben') ||
      text.includes('nicht im verband freigeben')
    );
  }

  function rowType(row) {
    const button = row.querySelector('a.btn');
    const buttonText = norm(button?.textContent);
    const text = norm(row.innerText);

    if (
      buttonText.includes('zellen') ||
      text.includes('zellen')
    ) {
      return 'cells';
    }

    if (
      buttonText.includes('krankenhaus') ||
      text.includes('betten')
    ) {
      return 'hospital';
    }

    return 'unknown';
  }

  function findShareButton(row) {
    return Array.from(
      row.querySelectorAll('a.btn')
    ).find(button =>
      button.classList.contains('btn-success') &&
      norm(button.textContent).includes('im verband freigeben')
    ) ?? null;
  }

  function findUnshareButton(row) {
    return Array.from(
      row.querySelectorAll('a.btn')
    ).find(button =>
      norm(button.textContent).includes('nicht im verband freigeben')
    ) ?? null;
  }

  function getBuildingIdFromBlock(headerRow) {
    const share = headerRow.querySelector(
      'a.btn[href*="/buildings/"]'
    );

    let match = share?.href?.match(
      /\/buildings\/(\d+)\b/
    );

    if (match) return Number(match[1]);

    let current = headerRow;

    while (current) {
      const link = current.querySelector(
        'a[href*="/buildings/"]'
      );

      match = link?.href?.match(
        /\/buildings\/(\d+)\b/
      );

      if (match) return Number(match[1]);

      current = current.nextElementSibling;

      if (current && isBlockHeaderRow(current)) {
        break;
      }
    }

    return null;
  }

  function findCostLinkNearbyFromHeader(headerRow, step) {
    function linkIn(row) {
      return Array.from(
        row.querySelectorAll(
          'a[href*="/alliance_costs/"]'
        )
      ).find(link => {
        const match = link.href.match(
          /\/alliance_costs\/(\d+)\b/
        );

        return Number(match?.[1]) === step;
      }) ?? null;
    }

    let link = linkIn(headerRow);

    if (link) return link;

    let current = headerRow.nextElementSibling;

    while (current && !isBlockHeaderRow(current)) {
      link = linkIn(current);

      if (link) return link;

      current = current.nextElementSibling;
    }

    return null;
  }

  function collectTargets(config) {
    const table = extensionTable();

    if (!table) {
      throw new Error(
        'Die Erweiterungstabelle ist nicht geladen. ' +
        'Bitte den Reiter „Erweiterungen“ einmal öffnen ' +
        'und danach zum Reiter „Gebäude“ zurückkehren.'
      );
    }

    const rows = Array.from(
      table.querySelectorAll('tr')
    ).filter(row => row.querySelector('td'));

    const headers = rows.filter(isBlockHeaderRow);
    const seen = new Set();

    return headers
      .map(row => ({
        row,
        type: rowType(row),
        id: getBuildingIdFromBlock(row)
      }))
      .filter(target =>
        target.id &&
        (
          (target.type === 'hospital' && config.processHospitals) ||
          (target.type === 'cells' && config.processCells)
        )
      )
      .filter(target => {
        const key = `${target.type}:${target.id}`;

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      });
  }

  // ============================================================
  // ANFRAGEN
  // ============================================================

  async function fireLinkGET(urlOrElement) {
    const href =
      typeof urlOrElement === 'string'
        ? urlOrElement
        : urlOrElement?.href;

    if (!href) {
      throw new Error('Keine URL für Anfrage gefunden.');
    }

    const response = await fetch(href, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return true;
  }

  async function shareTarget(target, config) {
    const percent =
      target.type === 'hospital'
        ? config.hospitalPercent
        : config.cellPercent;

    const step = pctToStep(percent);
    const shareButton = findShareButton(target.row);

    if (shareButton) {
      await fireLinkGET(shareButton);
    }

    const feeLink = findCostLinkNearbyFromHeader(
      target.row,
      step
    );

    await fireLinkGET(
      feeLink ??
      `/buildings/${target.id}/alliance_costs/${step}`
    );
  }

  async function unshareTarget(target) {
    const button = findUnshareButton(target.row);

    if (!button) {
      throw new Error(
        'Freigabe-Button wurde nicht gefunden.'
      );
    }

    await fireLinkGET(button);
  }

  // ============================================================
  // FORTSCHRITT
  // ============================================================

  function ensureProgress() {
    if (document.getElementById('nilspe-sb-progress')) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-sb-style';

    style.textContent = `
      #nilspe-sb-progress {
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

      #nilspe-sb-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      #nilspe-sb-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-sb-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-sb-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }

      body.dark #nilspe-sb-progress,
      body.dark-mode #nilspe-sb-progress {
        background: #222;
        color: #eee;
        border-color: #444;
      }
    `;

    document.head.append(style);

    const container = el('div');
    container.id = 'nilspe-sb-progress';

    const row = el('div');
    row.id = 'nilspe-sb-row';

    const cancel = el(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancel.type = 'button';
    cancel.id = 'nilspe-sb-cancel';

    cancel.addEventListener('click', () => {
      if (!running) return;

      cancelRequested = true;
      cancel.disabled = true;

      const status = document.getElementById(
        'nilspe-sb-status'
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

    status.id = 'nilspe-sb-status';

    const track = el('div');
    track.id = 'nilspe-sb-track';

    const success = el('div');
    success.id = 'nilspe-sb-success';

    const errors = el('div');
    errors.id = 'nilspe-sb-errors';

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
      'nilspe-sb-status'
    );

    const success = document.getElementById(
      'nilspe-sb-success'
    );

    const errorBar = document.getElementById(
      'nilspe-sb-errors'
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
  // HAUPTABLAUF
  // ============================================================

  async function run(mode, buttons) {
    if (running || busy) return;

    busy = true;

    try {
      const config = await configuration();

      if (!config.processHospitals && !config.processCells) {
        setProgress(
          'Weder Krankenhausbetten noch Polizeizellen ausgewählt',
          0, 0, 0, 'warning'
        );
        return;
      }

      let targets = collectTargets(config);

      if (mode === 'unshare') {
        targets = targets.filter(target =>
          Boolean(findUnshareButton(target.row))
        );
      }

      if (!targets.length) {
        setProgress(
          mode === 'share'
            ? 'Keine passenden Gebäude gefunden'
            : 'Keine freigegebenen Gebäude gefunden',
          0, 0, 0, 'success'
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
        'nilspe-sb-cancel'
      );

      if (cancelButton) {
        cancelButton.disabled = false;
      }

      let completed = 0;
      let errors = 0;
      let successful = 0;
      let nextIndex = 0;

      const total = targets.length;

      setProgress(
        mode === 'share'
          ? `0/${total} Gebäude freigeben`
          : `0/${total} Freigaben zurücknehmen`,
        0, 0, total
      );

      async function worker() {
        while (!cancelRequested) {
          const index = nextIndex++;

          if (index >= total) {
            return;
          }

          const target = targets[index];

          try {
            if (mode === 'share') {
              await shareTarget(target, config);
            } else {
              await unshareTarget(target);
            }

            successful++;
          } catch (error) {
            errors++;

            console.error(
              PREFIX,
              mode === 'share'
                ? 'Freigabe fehlgeschlagen:'
                : 'Freigabe zurücknehmen fehlgeschlagen:',
              target.id,
              error
            );
          }

          completed++;

          setProgress(
            `${completed}/${total} Gebäude bearbeitet`,
            completed,
            errors,
            total,
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
              total
            )
          },
          () => worker()
        )
      );

      if (cancelRequested) {
        setProgress(
          `Abgebrochen: ${format(successful)} erfolgreich, ` +
          `${format(errors)} Fehler, ` +
          `${format(total - completed)} offen`,
          completed,
          errors,
          total,
          'warning'
        );
      } else {
        setProgress(
          mode === 'share'
            ? `Fertig: ${format(successful)} freigegeben / Gebühren gesetzt, ${format(errors)} Fehler`
            : `Fertig: ${format(successful)} Freigaben zurückgenommen, ${format(errors)} Fehler`,
          completed,
          errors,
          total,
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
      busy = false;
      cancelRequested = false;

      for (const button of buttons) {
        button.disabled = false;
      }

      const cancelButton = document.getElementById(
        'nilspe-sb-cancel'
      );

      if (cancelButton) {
        cancelButton.disabled = true;
      }
    }
  }

  // ============================================================
  // BUTTONS IM REITER "GEBÄUDE"
  // ============================================================

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
      el('span', 'glyphicon glyphicon-cog')
    );

    return button;
  }

  async function addButtons() {
    if (
      addingButtons ||
      document.getElementById('nilspe-sb-button-row') ||
      document.getElementById('nilspe-sb-buttons')
    ) {
      return;
    }

    const heading = document.querySelector(
      'h1[building_type]'
    );

    // Typ 7 = Leitstelle.
    if (
      Number(
        heading?.getAttribute('building_type')
      ) !== 7
    ) {
      return;
    }

    /*
     * NEU v2.1.1:
     *
     * Ziel ist jetzt ausschließlich
     * die Gebäudetabelle.
     *
     * Gleiche Position wie:
     * - Rename Buildings
     * - Move Buildings
     */

    const table = buildingTable();

    if (!table?.parentElement) {
      return;
    }

    addingButtons = true;

    try {
      const config = await configuration();

      if (
        document.getElementById('nilspe-sb-button-row') ||
        document.getElementById('nilspe-sb-buttons')
      ) {
        return;
      }

      const group = el('div', 'btn-group');
      group.id = 'nilspe-sb-buttons';

      const shareButton = el(
        'button',
        'btn btn-default btn-xs',
        'Gebäude freigeben'
      );

      shareButton.type = 'button';
      shareButton.style.backgroundColor = '#222';
      shareButton.style.borderColor = '#222';
      shareButton.style.color = '#fff';

      const buttons = [shareButton];

      let unshareButton = null;

      if (config.showUnshareButton) {
        unshareButton = el(
          'button',
          'btn btn-danger btn-xs',
          'Freigaben zurücknehmen'
        );

        unshareButton.type = 'button';
        buttons.push(unshareButton);
      }

      shareButton.addEventListener(
        'click',
        () => void run('share', buttons)
      );

      if (unshareButton) {
        unshareButton.addEventListener(
          'click',
          () => void run('unshare', buttons)
        );
      }

      group.append(shareButton);

      if (unshareButton) {
        group.append(unshareButton);
      }

      group.append(settingsButton());

      const row = el('div');
      row.id = 'nilspe-sb-button-row';

      row.style.cssText =
        'display:block;width:100%;margin:0';

      row.append(group);

      table.parentElement.insertBefore(
        row,
        table
      );
    } finally {
      addingButtons = false;
    }
  }

  // ============================================================
  // INITIALISIERUNG
  // ============================================================

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
  } else {
    void addButtons();

    new MutationObserver(() => {
      void addButtons();
    }).observe(
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
