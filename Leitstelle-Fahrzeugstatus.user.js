// ==UserScript==
// @name         Leitstelle Fahrzeugstatus 2/6
// @namespace    NilsPe.vehicle.status
// @version      1.1.5
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
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.11
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_vehicle_status';
  const KEYS = {
    vehicleTypes: 'nilspe_vehicle_status_types',
    keepPerStation: 'nilspe_vehicle_status_keep',
    requestDelay: 'nilspe_vehicle_status_delay',
    concurrency: 'nilspe_vehicle_status_concurrency'
  };

  const DEFAULT_TYPES = [
    2, 5, 10, 12, 14, 27, 30, 33, 34, 40, 42, 43, 44, 45, 53, 57, 61,
    63, 64, 70, 91, 99, 100, 101, 102, 109, 122, 123, 127, 144, 145, 146,
    147
  ];

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  function parseArray(value, fallback = []) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : fallback;
    } catch {
      return fallback;
    }
  }

  async function initializeDefaults() {
    if (await GM.getValue(KEYS.vehicleTypes, null) === null) {
      await GM.setValue(KEYS.vehicleTypes, JSON.stringify(DEFAULT_TYPES));
    }
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await initializeDefaults();
    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Fahrzeugstatus 2/6',
      settings: [
        { type: 'header', text: 'Fahrzeugtypen' },
        {
          type: 'select',
          selectType: 'vehicle_types',
          key: KEYS.vehicleTypes,
          label: 'Fahrzeugtypen auswaehlen',
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
        { type: 'header', text: 'Ablauf' },
        {
          type: 'number',
          key: KEYS.requestDelay,
          label: 'Pause je Worker [ms]',
          min: 0,
          max: 5_000,
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
      ]
    });
  }

  async function configuration() {
    const selected = parseArray(
      await GM.getValue(KEYS.vehicleTypes, JSON.stringify(DEFAULT_TYPES)),
      DEFAULT_TYPES
    );

    return {
      types: new Set(selected),
      keepPerStation: Math.max(
        0,
        Math.min(
          100,
          Number(await GM.getValue(KEYS.keepPerStation, 0)) || 0
        )
      ),
      requestDelay: Math.max(
        0,
        Number(await GM.getValue(KEYS.requestDelay, 100)) || 0
      ),
      concurrency: Math.max(
        1,
        Math.min(
          10,
          Number(await GM.getValue(KEYS.concurrency, 3)) || 3
        )
      )
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

  function vehicleFms(row) {
    const element = row.querySelector('.building_list_fms');
    const className = element?.className ?? '';
    return Number(className.match(/building_list_fms_(\d+)/)?.[1]);
  }

  function stationId(row) {
    const link = row.querySelector('a[href*="/buildings/"]');
    const href = link?.getAttribute('href') ?? row.innerHTML;
    return Number(href.match(/\/buildings\/(\d+)/)?.[1]) || 0;
  }

  function matchingRows(config, targetStatus) {
    return vehicleRows().filter(row => {
      const type = vehicleType(row);
      const fms = vehicleFms(row);
      return config.types.has(type) &&
        (targetStatus === 6 ? fms !== 6 : fms === 6);
    });
  }

  function rowsForStatus6(rows, config) {
    const candidates = rows;

    if (config.keepPerStation <= 0) {
      return candidates;
    }

    const groups = new Map();

    for (const row of candidates) {
      const key = `${stationId(row)}:${vehicleType(row)}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(row);
    }

    const result = [];

    for (const group of groups.values()) {
      result.push(...group.slice(config.keepPerStation));
    }

    return result;
  }

  function rowsForStatus(targetStatus, config) {
    const rows = matchingRows(config, targetStatus);
    return targetStatus === 6 ? rowsForStatus6(rows, config) : rows;
  }

  async function setVehicleStatus(vehicleId, status) {
    const response = await fetch(`/vehicles/${vehicleId}/set_fms/${status}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Status ${status}: HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-fms-progress')) {
      return;
    }

    const style = document.createElement('style');
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

    const container = document.createElement('div');
    container.id = 'nilspe-fms-progress';
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
    status.id = 'nilspe-fms-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-fms-track';
    const success = document.createElement('div');
    success.id = 'nilspe-fms-success';
    const errors = document.createElement('div');
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
    const status = document.getElementById('nilspe-fms-status');
    const successBar = document.getElementById('nilspe-fms-success');
    const errorBar = document.getElementById('nilspe-fms-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    successBar.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function run(targetStatus, buttons) {
    if (running) {
      return;
    }

    running = true;
    buttons.forEach(button => {
      button.disabled = true;
    });

    try {
      const config = await configuration();

      if (config.types.size === 0) {
        setProgress('Keine Fahrzeugtypen ausgewaehlt', 0, 0, 0, 'warning');
        return;
      }

      const jobs = rowsForStatus(targetStatus, config);

      if (jobs.length === 0) {
        setProgress(
          `Keine Fahrzeuge fuer Status ${targetStatus}`,
          0,
          0,
          0,
          'success'
        );
        return;
      }

      if (!globalThis.confirm(
        `${jobs.length} Fahrzeuge auf Status ${targetStatus} setzen?`
      )) {
        setProgress('Abgebrochen', 0, 0, 0, 'warning');
        return;
      }

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;

      async function worker() {
        while (running) {
          const index = nextIndex++;

          if (index >= jobs.length) {
            return;
          }

          const row = jobs[index];
          const id = vehicleId(row);

          try {
            await setVehicleStatus(id, targetStatus);
            row.remove();
          } catch (error) {
            errors++;
            console.error(
              '[Leitstelle Fahrzeugstatus] Fahrzeug fehlgeschlagen:',
              id,
              error
            );
          }

          completed++;
          setProgress(
            `${completed}/${jobs.length} auf Status ${targetStatus}`,
            completed,
            errors,
            jobs.length,
            errors ? 'warning' : 'success'
          );
          await sleep(config.requestDelay);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(config.concurrency, jobs.length) },
          worker
        )
      );

      if (!running) {
        return;
      }

      setProgress(
        `Fertig: ${completed - errors} auf Status ${targetStatus}, ${errors} Fehler`,
        completed,
        errors,
        jobs.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[Leitstelle Fahrzeugstatus] Lauf fehlgeschlagen:', error);
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 0, 'danger');
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

    if (!table || document.getElementById('nilspe-fms-buttons')) {
      return;
    }

    const group = document.createElement('div');
    group.id = 'nilspe-fms-buttons';
    group.className = 'btn-group';
    group.style.display = 'flex';
    group.style.width = 'fit-content';
    group.style.margin = '0';
    const status6 = document.createElement('button');
    status6.type = 'button';
    status6.className = 'btn btn-default btn-xs';
    status6.textContent = 'S6 setzen';
    const status2 = document.createElement('button');
    status2.type = 'button';
    status2.className = 'btn btn-default btn-xs';
    status2.textContent = 'S2 setzen';
    const settings = settingsButton();
    const buttons = [status2, status6];

    status6.addEventListener('click', () => run(6, buttons));
    status2.addEventListener('click', () => run(2, buttons));
    group.append(status2, status6, settings);

    const row = document.createElement('div');
    row.id = 'nilspe-fms-button-row';
    row.style.display = 'flex';
    row.style.width = '100%';
    row.style.margin = '0';
    row.style.padding = '0';
    row.style.lineHeight = '0';
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
