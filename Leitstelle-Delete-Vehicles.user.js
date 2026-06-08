// ==UserScript==
// @name         Leitstelle Delete Vehicles
// @namespace    NilsPe.delete.vehicles
// @version      1.0.0
// @description  Markiert und loescht ausgewaehlte Fahrzeugtypen aus der sichtbaren Fahrzeugtabelle
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
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.9
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_delete_vehicles';
  const KEYS = {
    vehicleTypes: 'nilspe_delete_vehicle_types',
    keepPerStation: 'nilspe_delete_keep_per_station',
    requestDelay: 'nilspe_delete_request_delay',
    concurrency: 'nilspe_delete_concurrency',
    deletionEnabled: 'nilspe_delete_enabled'
  };

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  function parseArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : [];
    } catch {
      return [];
    }
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Delete Vehicles',
      settings: [
        { type: 'header', text: 'Fahrzeugauswahl' },
        {
          type: 'select',
          selectType: 'vehicle_types',
          key: KEYS.vehicleTypes,
          label: 'Zu loeschende Fahrzeugtypen',
          title: 'Fahrzeugtypen auswaehlen',
          multiple: true
        },
        {
          type: 'number',
          key: KEYS.keepPerStation,
          label: 'Fahrzeuge je Typ und Wache behalten',
          min: 0,
          max: 1_000,
          default: 0
        },
        { type: 'header', text: 'Sicherheit' },
        {
          type: 'checkbox',
          key: KEYS.deletionEnabled,
          label: 'Endgueltiges Loeschen freischalten',
          default: false
        },
        { type: 'header', text: 'Ablauf' },
        {
          type: 'number',
          key: KEYS.requestDelay,
          label: 'Pause je Worker [ms]',
          min: 100,
          max: 5_000,
          default: 250
        },
        {
          type: 'number',
          key: KEYS.concurrency,
          label: 'Parallele Loeschanfragen',
          min: 1,
          max: 3,
          default: 1
        }
      ]
    });
  }

  async function configuration() {
    return {
      types: new Set(parseArray(await GM.getValue(KEYS.vehicleTypes, '[]'))),
      keepPerStation: Math.max(
        0,
        Number(await GM.getValue(KEYS.keepPerStation, 0)) || 0
      ),
      requestDelay: Math.max(
        100,
        Number(await GM.getValue(KEYS.requestDelay, 250)) || 250
      ),
      concurrency: Math.max(
        1,
        Math.min(
          3,
          Number(await GM.getValue(KEYS.concurrency, 1)) || 1
        )
      ),
      deletionEnabled: await GM.getValue(KEYS.deletionEnabled, false) === true
    };
  }

  function vehicleTable() {
    return document.getElementById('vehicle_table');
  }

  function vehicleRows() {
    return Array.from(vehicleTable()?.tBodies?.[0]?.rows ?? []);
  }

  function vehicleId(row) {
    const link = Array.from(row.querySelectorAll('a[href*="/vehicles/"]'))
      .find(element => /\/vehicles\/\d+/.test(element.getAttribute('href') ?? ''));
    return Number(link?.getAttribute('href')?.match(/\/vehicles\/(\d+)/)?.[1]);
  }

  function vehicleType(row) {
    const element = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );
    return Number(
      element?.getAttribute('vehicle_type_id') ??
      element?.getAttribute('data-vehicle-type-id')
    );
  }

  function stationId(row) {
    const link = row.querySelector('a[href*="/buildings/"]');
    const source = link?.getAttribute('href') ?? row.innerHTML;
    const fromRow = Number(source.match(/\/buildings\/(\d+)/)?.[1]);
    const fromPage = Number(location.pathname.match(/^\/buildings\/(\d+)/)?.[1]);
    return fromRow || fromPage || vehicleId(row);
  }

  function rowsToDelete(config) {
    const matching = vehicleRows().filter(row =>
      config.types.has(vehicleType(row))
    );

    if (config.keepPerStation <= 0) {
      return matching;
    }

    const groups = new Map();

    for (const row of matching) {
      const key = `${stationId(row)}:${vehicleType(row)}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(row);
    }

    const result = [];

    for (const rows of groups.values()) {
      result.push(...rows.slice(config.keepPerStation));
    }

    return result;
  }

  function clearPreview() {
    for (const row of document.querySelectorAll('.nilspe-delete-preview')) {
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
      row.style.background = 'rgba(217, 83, 79, .12)';
    }
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ??
      document.querySelector('input[name="authenticity_token"]')?.value ??
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
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
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
      throw new Error(`Loeschen HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-delete-progress')) {
      return;
    }

    const style = document.createElement('style');
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
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
      #nilspe-delete-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-delete-progress';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-default btn-xs';
    cancel.textContent = 'Abbrechen';
    cancel.addEventListener('click', () => {
      running = false;
      setProgress('Abgebrochen', 0, 0, 0, 'danger');
    });
    const status = document.createElement('span');
    status.id = 'nilspe-delete-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-delete-track';
    const success = document.createElement('div');
    success.id = 'nilspe-delete-success';
    const errors = document.createElement('div');
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
    const status = document.getElementById('nilspe-delete-status');
    const success = document.getElementById('nilspe-delete-success');
    const errorBar = document.getElementById('nilspe-delete-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    success.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function preview() {
    const config = await configuration();

    if (config.types.size === 0) {
      setProgress('Keine Fahrzeugtypen ausgewaehlt', 0, 0, 0, 'warning');
      clearPreview();
      return;
    }

    const rows = rowsToDelete(config);
    markPreview(rows);
    setProgress(
      `Vorschau: ${rows.length} Fahrzeuge wuerden geloescht`,
      0,
      0,
      0,
      rows.length ? 'warning' : 'success'
    );
  }

  async function run(buttons) {
    if (running) {
      return;
    }

    const config = await configuration();

    if (!config.deletionEnabled) {
      await preview();
      globalThis.alert(
        'Loeschen ist in den Einstellungen nicht freigeschaltet. ' +
        'Es wurde nur die Vorschau markiert.'
      );
      return;
    }

    const rows = rowsToDelete(config);

    if (rows.length === 0) {
      setProgress('Keine passenden Fahrzeuge gefunden', 0, 0, 0, 'success');
      return;
    }

    const phrase = `LOESCHEN ${rows.length}`;
    const confirmation = globalThis.prompt(
      `${rows.length} Fahrzeuge werden endgueltig geloescht.\n` +
      `Zum Bestaetigen exakt eingeben: ${phrase}`
    );

    if (confirmation !== phrase) {
      setProgress('Loeschen nicht bestaetigt', 0, 0, 0, 'warning');
      return;
    }

    running = true;
    buttons.forEach(button => {
      button.disabled = true;
    });
    let nextIndex = 0;
    let completed = 0;
    let errors = 0;

    try {
      async function worker() {
        while (running) {
          const index = nextIndex++;

          if (index >= rows.length) {
            return;
          }

          const row = rows[index];
          const id = vehicleId(row);

          try {
            await deleteVehicle(id);
            row.remove();
          } catch (error) {
            errors++;
            console.error(
              '[Leitstelle Delete Vehicles] Fahrzeug fehlgeschlagen:',
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
            errors ? 'warning' : 'success'
          );
          await sleep(config.requestDelay);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(config.concurrency, rows.length) },
          worker
        )
      );

      if (!running) {
        return;
      }

      clearPreview();
      setProgress(
        `Fertig: ${completed - errors} geloescht, ${errors} Fehler`,
        completed,
        errors,
        rows.length,
        errors ? 'warning' : 'success'
      );
    } finally {
      running = false;
      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  function settingsButton() {
    const button = document.createElement('a');
    button.className = 'btn btn-default btn-xs';
    button.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
    button.target = '_blank';
    button.title = 'Einstellungen';
    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';
    button.append(icon);
    return button;
  }

  function addButtons() {
    const table = vehicleTable();

    if (!table || document.getElementById('nilspe-delete-buttons')) {
      return;
    }

    const group = document.createElement('div');
    group.id = 'nilspe-delete-buttons';
    group.className = 'btn-group';
    const previewButton = document.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'btn btn-default btn-xs';
    previewButton.textContent = 'Loeschvorschau';
    previewButton.addEventListener('click', preview);
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'btn btn-danger btn-xs';
    deleteButton.textContent = 'Fahrzeuge loeschen';
    const buttons = [previewButton, deleteButton];
    deleteButton.addEventListener('click', () => run(buttons));
    group.append(previewButton, deleteButton, settingsButton());

    const row = document.createElement('div');
    row.id = 'nilspe-delete-button-row';
    row.style.display = 'block';
    row.style.width = '100%';
    row.style.margin = '0 0 8px';
    row.append(group);
    table.parentElement?.insertBefore(row, table);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
  } else {
    addButtons();
    new MutationObserver(addButtons).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
