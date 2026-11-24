
// ==UserScript==
// @name         Leitstelle Delete Vehicles
// @namespace    NilsPe.delete.vehicles
// @version      1.1.0
// @description  Vorschau und kontrolliertes Löschen ausgewählter Fahrzeuge
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Delete-Vehicles.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Delete-Vehicles.user.js
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
  const PREFIX = '[Leitstelle Delete Vehicles]';
  const SETTINGS_IDENTIFIER = 'nilspe_delete_vehicles';

  const KEYS = {
    vehicleTypes: 'nilspe_delete_vehicle_types',
    keepPerStation: 'nilspe_delete_keep_per_station',
    everyNthStation: 'nilspe_delete_every_nth_station',
    requestDelay: 'nilspe_delete_request_delay',
    concurrency: 'nilspe_delete_concurrency'
  };

  const SETTINGS = [
    {
      type: 'header',
      text: 'Fahrzeugauswahl'
    },
    {
      type: 'select',
      selectType: 'vehicle_types',
      key: KEYS.vehicleTypes,
      label: 'Zu löschende Fahrzeugtypen',
      title: 'Fahrzeugtypen auswählen',
      multiple: true
    },
    {
      type: 'number',
      key: KEYS.keepPerStation,
      label: 'Fahrzeuge je Typ und Wache behalten',
      min: 0,
      max: 1000,
      default: 0
    },
    {
      type: 'number',
      key: KEYS.everyNthStation,
      label: 'Nur auf jeder n-ten Wache löschen (1 = alle)',
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
      const parsed = typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;

      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : [];
    } catch {
      return [];
    }
  }

  async function configuration() {
    const number = async (key, fallback, min, max) => {
      const value = Number(await GM.getValue(key, fallback));

      return Number.isFinite(value)
        ? Math.max(min, Math.min(max, Math.floor(value)))
        : fallback;
    };

    return {
      types: new Set(
        parseArray(
          await GM.getValue(KEYS.vehicleTypes, '[]')
        )
      ),
      keepPerStation: await number(
        KEYS.keepPerStation, 0, 0, 1000
      ),
      everyNthStation: await number(
        KEYS.everyNthStation, 1, 1, 1000
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
   * Originalfelder werden umgehängt.
   * Ihre Speicher-Eventhandler bleiben
   * unverändert erhalten.
   */

  function injectStyles() {
    if (document.getElementById(
      'nilspe-delete-vehicles-settings-style'
    )) return;

    const style = node('style');
    style.id = 'nilspe-delete-vehicles-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-dv-group {
        margin: 0 0 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-content {
        padding: 10px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-field {
        box-sizing: border-box;
        padding: 7px 9px;
        margin-bottom: 4px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-field.selected {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-field .form-group {
        margin: 0;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-field .col-sm-6 {
        float: none;
        width: 100%;
        padding: 0;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-number .col-sm-6 {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-number label {
        order: 2;
        flex: 1;
        margin: 0;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-number input[type="number"] {
        order: 1;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        box-sizing: border-box;
        text-align: left;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-select label {
        display: block;
        margin-bottom: 6px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-select .bootstrap-select {
        max-width: 100%;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-select
      .bootstrap-select > button {
        min-height: 28px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
      }
      #${SETTINGS_IDENTIFIER} .nilspe-dv-bulk {
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
      #${SETTINGS_IDENTIFIER} .nilspe-dv-count {
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
    const details = node('details', 'nilspe-dv-group');
    const summary = node('summary', '', title);
    const content = node('div', 'nilspe-dv-content');

    if (description) {
      content.append(
        node('p', 'nilspe-dv-info', description)
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  function enhanceSelect(container, select) {
    const toolbar = node('div', 'nilspe-dv-toolbar');

    const all = node(
      'button',
      'btn btn-default btn-xs nilspe-dv-bulk',
      'Alle anwählen'
    );

    const none = node(
      'button',
      'btn btn-default btn-xs nilspe-dv-bulk',
      'Alle abwählen'
    );

    const count = node('span', 'nilspe-dv-count');

    all.type = 'button';
    none.type = 'button';

    const jq = typeof unsafeWindow !== 'undefined'
      ? unsafeWindow.jQuery ?? unsafeWindow.$
      : null;

    function refresh() {
      const selected = select.selectedOptions.length;

      count.textContent =
        `${selected} von ${select.options.length} ausgewählt`;

      container.classList.toggle(
        'selected',
        selected > 0
      );
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
        'changed.bs.select.nilspeDeleteVehicles',
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

    if (body.querySelector('.nilspe-dv-root')) {
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

    const root = node('section', 'nilspe-dv-root');

    root.append(
      node('h2', '', 'Delete Vehicles'),
      node(
        'p',
        'nilspe-dv-info',
        'Nur Fahrzeuge aus der geladenen Tabelle werden berücksichtigt.'
      )
    );

    const groups = [
      {
        title: 'Fahrzeugauswahl',
        description:
          'Fahrzeugtypen, verbleibende Fahrzeuge und Wachenauswahl.',
        keys: [
          KEYS.vehicleTypes,
          KEYS.keepPerStation,
          KEYS.everyNthStation
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
        field.container.classList.add('nilspe-dv-field');

        if (field.input.tagName === 'SELECT') {
          field.container.classList.add('nilspe-dv-select');
          enhanceSelect(field.container, field.input);
        } else {
          field.container.classList.add(
            'nilspe-dv-number',
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
        [
          'Fahrzeugauswahl',
          'Ablauf'
        ].includes(child.textContent.trim())
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
      title: 'Delete Vehicles',
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
   * FAHRZEUGE ERMITTELN
   * =====================================
   */

  function vehicleTable() {
    return document.getElementById('vehicle_table');
  }

  function vehicleRows() {
    return Array.from(
      vehicleTable()?.tBodies?.[0]?.rows ?? []
    );
  }

  function vehicleId(row) {
    const link = Array.from(
      row.querySelectorAll('a[href*="/vehicles/"]')
    ).find(a =>
      /\/vehicles\/\d+/.test(
        a.getAttribute('href') ?? ''
      )
    );

    return Number(
      link?.getAttribute('href')
        ?.match(/\/vehicles\/(\d+)/)?.[1]
    ) || 0;
  }

  function vehicleType(row) {
    const element = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );

    const value =
      element?.getAttribute('vehicle_type_id') ??
      element?.getAttribute('data-vehicle-type-id');

    return value == null ? NaN : Number(value);
  }

  function stationId(row) {
    const link = row.querySelector(
      'a[href*="/buildings/"]'
    );

    const source =
      link?.getAttribute('href') ??
      row.innerHTML;

    const fromRow = Number(
      source.match(/\/buildings\/(\d+)/)?.[1]
    );

    const fromPage = Number(
      location.pathname.match(
        /^\/buildings\/(\d+)/
      )?.[1]
    );

    return fromRow || fromPage || vehicleId(row);
  }

  /*
   * =====================================
   * AUSWAHLLOGIK DES ORIGINALS
   * =====================================
   *
   * 1. Wachen in Tabellenreihenfolge zählen.
   * 2. Nur jede n-te Wache berücksichtigen.
   * 3. Je Wache und Fahrzeugtyp die ersten
   *    N passenden Fahrzeuge behalten.
   */

  function rowsToDelete(config) {
    const rows = vehicleRows();
    const stationPositions = new Map();

    let stationPosition = 0;

    for (const row of rows) {
      const id = stationId(row);

      if (!stationPositions.has(id)) {
        stationPositions.set(
          id,
          ++stationPosition
        );
      }
    }

    const matching = rows.filter(row =>
      vehicleId(row) > 0 &&
      config.types.has(vehicleType(row)) &&
      (
        config.everyNthStation === 1 ||
        stationPositions.get(stationId(row)) %
          config.everyNthStation === 0
      )
    );

    if (config.keepPerStation <= 0) {
      return matching;
    }

    const groups = new Map();

    for (const row of matching) {
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

  /*
   * =====================================
   * VORSCHAU
   * =====================================
   */

  function clearPreview() {
    for (const row of document.querySelectorAll(
      '.nilspe-delete-preview'
    )) {
      row.classList.remove('nilspe-delete-preview');
      row.style.outline = '';
      row.style.background = '';
    }
  }

  function markPreview(rows) {
    clearPreview();

    for (const row of rows) {
      row.classList.add('nilspe-delete-preview');
      row.style.outline = '2px solid #d9534f';
      row.style.background = 'rgba(217,83,79,.12)';
    }
  }

  function selectionSignature(rows) {
    return JSON.stringify(
      rows.map(vehicleId).sort((a, b) => a - b)
    );
  }

  /*
   * =====================================
   * FORTSCHRITT
   * =====================================
   */

  function ensureProgress() {
    if (document.getElementById(
      'nilspe-delete-progress'
    )) return;

    const style = node('style');
    style.id = 'nilspe-delete-style';
    style.textContent = `
      #nilspe-delete-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-delete-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-delete-success {
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
      #nilspe-delete-errors {
        height: 100%;
        width: 0;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = node('div');
    container.id = 'nilspe-delete-progress';

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
        'nilspe-delete-status'
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
    status.id = 'nilspe-delete-status';

    const track = node('div');
    track.id = 'nilspe-delete-track';

    const success = node('div');
    success.id = 'nilspe-delete-success';

    const errors = node('div');
    errors.id = 'nilspe-delete-errors';

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
      'nilspe-delete-status'
    );

    const success = document.getElementById(
      'nilspe-delete-success'
    );

    const errorBar = document.getElementById(
      'nilspe-delete-errors'
    );

    const denominator = Math.max(1, total);
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
   * FAHRZEUGE LÖSCHEN
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

  async function deleteVehicle(id) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const response = await fetch(`/vehicles/${id}`, {
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
        `Fahrzeug ${id}: HTTP ${response.status}`
      );
    }
  }

  /*
   * =====================================
   * VORSCHAU STARTEN
   * =====================================
   */

  async function preview() {
    if (busy || running) return;
    busy = true;
    previewSnapshot = null;

    try {
      const config = await configuration();

      if (!config.types.size) {
        clearPreview();
        setProgress(
          'Keine Fahrzeugtypen ausgewählt',
          0, 0, 0, 'warning'
        );
        return;
      }

      const rows = rowsToDelete(config);
      markPreview(rows);

      previewSnapshot = selectionSignature(rows);

      setProgress(
        `Vorschau: ${rows.length} Fahrzeuge würden gelöscht`,
        0, 0, 0,
        rows.length ? 'warning' : 'success'
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
      if (previewSnapshot === null) {
        setProgress(
          'Bitte zuerst die Löschvorschau starten.',
          0, 0, 0, 'warning'
        );
        return;
      }

      const config = await configuration();
      const rows = rowsToDelete(config);

      if (
        selectionSignature(rows) !==
        previewSnapshot
      ) {
        previewSnapshot = null;
        clearPreview();

        setProgress(
          'Auswahl geändert: Bitte Vorschau erneuern.',
          0, 0, 0, 'warning'
        );
        return;
      }

      if (!rows.length) {
        setProgress(
          'Keine passenden Fahrzeuge gefunden',
          0, 0, 0, 'success'
        );
        return;
      }

      const phrase = `LOESCHEN ${rows.length}`;

      const confirmation = window.prompt(
        `${rows.length} Fahrzeuge werden endgültig gelöscht.\n\n` +
        `Zum Bestätigen exakt eingeben: ${phrase}`
      );

      if (confirmation !== phrase) {
        setProgress(
          'Löschen nicht bestätigt',
          0, 0, 0, 'warning'
        );
        return;
      }

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

          if (index >= rows.length) return;

          const row = rows[index];
          const id = vehicleId(row);

          try {
            if (!id) {
              throw new Error('Fahrzeug-ID fehlt.');
            }

            await deleteVehicle(id);
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
            `${completed}/${rows.length} Fahrzeuge bearbeitet`,
            completed,
            errors,
            rows.length,
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
              rows.length
            )
          },
          () => worker()
        )
      );

      clearPreview();

      if (cancelRequested) {
        setProgress(
          `Abgebrochen: ${completed - errors} gelöscht, ` +
          `${errors} Fehler, ${rows.length - completed} offen`,
          completed,
          errors,
          rows.length,
          'warning'
        );
      } else {
        setProgress(
          `Fertig: ${completed - errors} gelöscht, ` +
          `${errors} Fehler`,
          completed,
          errors,
          rows.length,
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
   * BUTTONS ÜBER DER FAHRZEUGTABELLE
   * =====================================
   */

  function addButtons() {
    const table = vehicleTable();

    if (
      !table?.parentElement ||
      document.getElementById(
        'nilspe-delete-buttons'
      )
    ) {
      return;
    }

    const group = node('div', 'btn-group');
    group.id = 'nilspe-delete-buttons';

    group.style.cssText =
      'display:flex;width:fit-content;margin:0';

    const previewButton = node(
      'button',
      'btn btn-default btn-xs',
      'Löschvorschau'
    );

    const deleteButton = node(
      'button',
      'btn btn-danger btn-xs',
      'Fahrzeuge löschen'
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
    row.id = 'nilspe-delete-button-row';

    row.style.cssText =
      'display:flex;width:100%;margin:0;padding:0;line-height:0';

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
    addButtons();

    new MutationObserver(addButtons).observe(
      document.body,
      { childList: true, subtree: true }
    );
  }

  console.log(PREFIX, `Version ${VERSION} geladen`);
})();
