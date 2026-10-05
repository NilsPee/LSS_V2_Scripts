// ==UserScript==
// @name         Leitstelle Trailer-Checker
// @namespace    NilsPe.trailer.checker
// @version      1.2.0
// @description  Prüft Anhänger-Zuweisungen und erkennt fehlende, falsche, zufällige und mehrfache Zugfahrzeug-Zuweisungen
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Trailer-Checker.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Trailer-Checker.user.js
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

  const SETTINGS_IDENTIFIER =
    'nilspe_trailer_checker';

  const TARGET_PREFIX =
    'nilspe_trailer_checker_target_';

  const DELAY_KEY =
    'nilspe_trailer_checker_delay';

  const DEFAULT_DELAY = 120;

  let running = false;

  const sleep = ms =>
    new Promise(
      resolve =>
        setTimeout(resolve, ms)
    );

  // ============================================================
  // Konfiguration
  // ============================================================

  const TRAILER_CONFIG = [

    // Feuerwehr

    {
      category: 'Feuerwehr',
      trailerTypeId: 143,
      trailerName: 'Anh Schlauch',
      towVehicles: [
        [90, 'HLF 10'],
        [4, 'RW'],
        [27, 'GW-Gefahrgut'],
        [53, 'Dekon-P'],
        [104, 'GW-L1'],
        [105, 'GW-L2'],
        [1, 'LF 10'],
        [6, 'LF 8/6'],
        [8, 'LF 10/6'],
        [9, 'LF 16-TS'],
        [15, 'SW 2000-Tr'],
        [16, 'SW-KatS'],
        [18, 'TLF 3000'],
        [21, 'TLF 16/24-Tr'],
        [22, 'TLF 16/25'],
        [36, 'MTW'],
        [37, 'TSF-W'],
        [89, 'MLF'],
        [88, 'KLF'],
        [5, 'GW-A']
      ]
    },

    {
      category: 'Feuerwehr',
      trailerTypeId: 111,
      trailerName: 'NEA50',
      towVehicles: [
        [90, 'HLF 10'],
        [4, 'RW'],
        [27, 'GW-Gefahrgut'],
        [53, 'Dekon-P'],
        [104, 'GW-L1'],
        [105, 'GW-L2'],
        [1, 'LF 10'],
        [6, 'LF 8/6'],
        [8, 'LF 10/6'],
        [9, 'LF 16-TS'],
        [15, 'SW 2000-Tr'],
        [16, 'SW-KatS'],
        [18, 'TLF 3000'],
        [21, 'TLF 16/24-Tr'],
        [22, 'TLF 16/25'],
        [83, 'GW-Werkfeuerwehr'],
        [46, 'WLF']
      ]
    },

    {
      category: 'Feuerwehr',
      trailerTypeId: 113,
      trailerName: 'NEA200',
      towVehicles: [
        [90, 'HLF 10'],
        [4, 'RW'],
        [27, 'GW-Gefahrgut'],
        [53, 'Dekon-P'],
        [104, 'GW-L1'],
        [105, 'GW-L2'],
        [1, 'LF 10'],
        [6, 'LF 8/6'],
        [8, 'LF 10/6'],
        [9, 'LF 16-TS'],
        [15, 'SW 2000-Tr'],
        [16, 'SW-KatS'],
        [18, 'TLF 3000'],
        [21, 'TLF 16/24-Tr'],
        [22, 'TLF 16/25'],
        [46, 'WLF']
      ]
    },

    {
      category: 'Feuerwehr',
      trailerTypeId: 115,
      trailerName: 'Anh Lüfter',
      towVehicles: [
        [90, 'HLF 10'],
        [4, 'RW'],
        [27, 'GW-Gefahrgut'],
        [53, 'Dekon-P'],
        [104, 'GW-L1'],
        [105, 'GW-L2'],
        [1, 'LF 10'],
        [6, 'LF 8/6'],
        [8, 'LF 10/6'],
        [9, 'LF 16-TS'],
        [15, 'SW 2000-Tr'],
        [16, 'SW-KatS'],
        [18, 'TLF 3000'],
        [21, 'TLF 16/24-Tr'],
        [22, 'TLF 16/25'],
        [5, 'GW-A'],
        [83, 'GW-Werkfeuerwehr'],
        [46, 'WLF']
      ]
    },

    {
      category: 'Feuerwehr',
      trailerTypeId: 141,
      trailerName: 'FKH',
      towVehicles: [
        [138, 'GW-Verpflegung']
      ]
    },

    {
      category: 'Feuerwehr',
      trailerTypeId: 168,
      trailerName: 'Anh Sonderlöschmittel',
      towVehicles: [
        [90, 'HLF 10'],
        [4, 'RW'],
        [27, 'GW-Gefahrgut'],
        [53, 'Dekon-P'],
        [104, 'GW-L1'],
        [105, 'GW-L2'],
        [1, 'LF 10'],
        [6, 'LF 8/6'],
        [8, 'LF 10/6'],
        [9, 'LF 16-TS'],
        [15, 'SW 2000-Tr'],
        [16, 'SW-KatS'],
        [18, 'TLF 3000'],
        [21, 'TLF 16/24-Tr'],
        [22, 'TLF 16/25'],
        [36, 'MTW'],
        [37, 'TSF-W'],
        [89, 'MLF'],
        [88, 'KLF']
      ]
    },

    // SEG

    {
      category: 'SEG',
      trailerTypeId: 70,
      trailerName: 'MZB',
      towVehicles: [
        [63, 'GW-Taucher'],
        [64, 'GW-Wasserrettung']
      ]
    },

    {
      category: 'SEG',
      trailerTypeId: 132,
      trailerName: 'FKH',
      towVehicles: [
        [133, 'Bt LKW']
      ]
    },

    {
      category: 'SEG',
      trailerTypeId: 174,
      trailerName: 'Anh TeSi',
      towVehicles: [
        [171, 'GW-TeSi'],
        [173, 'MTW-TeSi']
      ]
    },

    {
      category: 'SEG',
      trailerTypeId: 175,
      trailerName: 'Anh NEA 50',
      towVehicles: [
        [172, 'LKW Technik (Notstrom)']
      ]
    },

    // Bereitschaftspolizei

    {
      category: 'Bereitschaftspolizei',
      trailerTypeId: 136,
      trailerName: 'Anh Pferdetransport',
      towVehicles: [
        [134, 'Pferdetransporter klein'],
        [135, 'Pferdetransporter groß'],
        [137, 'Zugfahrzeug Pferdetransport']
      ]
    },

    // THW

    {
      category: 'THW',
      trailerTypeId: 43,
      trailerName: 'BRmG R',
      towVehicles: [
        [42, 'LKW K 9']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 110,
      trailerName: 'NEA50',
      towVehicles: [
        [41, 'MzGW (FGr N)']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 44,
      trailerName: 'Anh DLE',
      towVehicles: [
        [41, 'MzGW (FGr N)'],
        [39, 'GKW'],
        [45, 'MLW 5']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 66,
      trailerName: 'Anh MzB',
      towVehicles: [
        [65, 'LKW 7 Lkr 19 tm']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 67,
      trailerName: 'Anh SchlB',
      towVehicles: [
        [65, 'LKW 7 Lkr 19 tm']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 68,
      trailerName: 'Anh MzAB',
      towVehicles: [
        [65, 'LKW 7 Lkr 19 tm']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 92,
      trailerName: 'Anh Hund',
      towVehicles: [
        [93, 'MTW-O']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 101,
      trailerName: 'Anh SwPu',
      towVehicles: [
        [123, 'LKW 7 Lbw (FGr WP)'],
        [100, 'MLW 4'],
        [99, 'LKW 7 Lbw']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 102,
      trailerName: 'Anh 7',
      towVehicles: [
        [123, 'LKW 7 Lbw (FGr WP)'],
        [100, 'MLW 4'],
        [99, 'LKW 7 Lbw']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 112,
      trailerName: 'NEA200',
      towVehicles: [
        [122, 'LKW 7 Lbw (FGr E)'],
        [99, 'LKW 7 Lbw']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 146,
      trailerName: 'Anh FüLa',
      towVehicles: [
        [145, 'FüKomKW']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 178,
      trailerName: 'Anh 12 Lbw (FGr Log-V)',
      towVehicles: [
        [176, 'LKW 7 Lbw (FGr Log-V)']
      ]
    },

    {
      category: 'THW',
      trailerTypeId: 183,
      trailerName: 'Anh Plattform (FGr BrB)',
      towVehicles: [
        [181, 'MzGW (FGr BrB)']
      ]
    }
  ];

  // ============================================================
  // Einstellungen
  // ============================================================

  function settingKey(config) {
    return (
      `${TARGET_PREFIX}` +
      `${config.trailerTypeId}`
    );
  }

  function settingOptions(config) {
    return [
      {
        value: 0,
        name: 'Keine Prüfung'
      },

      ...config.towVehicles.map(
        ([id, name]) => ({
          value: id,
          name
        })
      )
    ];
  }

  async function bindSettingPersistence(
    config
  ) {
    const key =
      settingKey(config);

    const select =
      Array.from(
        document.querySelectorAll(
          'select'
        )
      ).find(
        element =>
          element.id?.includes(key)
      );

    if (!select) {
      return;
    }

    const stored =
      Number(
        await GM.getValue(
          key,
          0
        )
      ) || 0;

    for (
      const option
      of select.options
    ) {
      option.selected =
        Number(option.value) ===
        stored;
    }

    const pageJQuery =
      typeof unsafeWindow !==
      'undefined'
        ? unsafeWindow.jQuery ??
          unsafeWindow.$
        : globalThis.jQuery ??
          globalThis.$;

    if (
      typeof pageJQuery ===
      'function'
    ) {
      const picker =
        pageJQuery(select);

      if (
        picker &&
        typeof picker.selectpicker ===
          'function'
      ) {
        picker.selectpicker(
          'refresh'
        );
      }
    }

    const saveSelection =
      async () => {
        const value =
          Number(
            select.value
          );

        const valid =
          value === 0 ||
          config.towVehicles.some(
            ([id]) =>
              id === value
          );

        await GM.setValue(
          key,
          valid
            ? value
            : 0
        );
      };

    select.addEventListener(
      'change',
      saveSelection
    );

    if (
      typeof pageJQuery ===
      'function'
    ) {
      pageJQuery(select)
        .off(
          'changed.bs.select.nilspeTrailerChecker'
        )
        .on(
          'changed.bs.select.nilspeTrailerChecker',
          saveSelection
        );
    }
  }

  async function createSettings() {
    if (
      typeof addOptions !==
      'function'
    ) {
      console.error(
        '[Anhänger-Checker] Scriptbasis/addOptions fehlt.'
      );

      return;
    }

    const settings = [];

    let lastCategory = null;

    for (
      const config
      of TRAILER_CONFIG
    ) {
      if (
        config.category !==
        lastCategory
      ) {
        settings.push({
          type: 'header',
          text: config.category
        });

        lastCategory =
          config.category;
      }

      settings.push({
        type: 'select',

        key:
          settingKey(config),

        label:
          config.trailerName,

        title:
          'Erwartetes Zugfahrzeug auswählen',

        multiple:
          false,

        options:
          settingOptions(config)
      });
    }

    settings.push(
      {
        type: 'header',
        text: 'Prüfung'
      },

      {
        type: 'number',

        key:
          DELAY_KEY,

        label:
          'Pause nach einer Anhängerprüfung [ms]',

        min: 0,
        max: 5000,

        default:
          DEFAULT_DELAY
      }
    );

    await addOptions({
      identifier:
        SETTINGS_IDENTIFIER,

      title:
        'Anhänger-Checker',

      settings
    });

    for (
      const config
      of TRAILER_CONFIG
    ) {
      await bindSettingPersistence(
        config
      );
    }
  }

  async function selectedTowTypeId(
    config
  ) {
    const typeId =
      Number(
        await GM.getValue(
          settingKey(config),
          0
        )
      ) || 0;

    if (typeId <= 0) {
      return null;
    }

    return config.towVehicles.some(
      ([id]) =>
        id === typeId
    )
      ? typeId
      : null;
  }

  async function loadConfiguration() {
    const mappings = [];

    for (
      const config
      of TRAILER_CONFIG
    ) {
      const towTypeId =
        await selectedTowTypeId(
          config
        );

      if (
        towTypeId === null
      ) {
        continue;
      }

      const towVehicle =
        config.towVehicles.find(
          ([id]) =>
            id === towTypeId
        );

      mappings.push({
        trailerTypeId:
          config.trailerTypeId,

        trailerName:
          config.trailerName,

        towTypeId,

        towName:
          towVehicle?.[1] ??
          `Typ ${towTypeId}`
      });
    }

    return mappings;
  }

  // ============================================================
  // Fahrzeugtabelle
  // ============================================================

  function vehicleTable() {
    return document.getElementById(
      'vehicle_table'
    );
  }

  function vehicleRows() {
    return Array.from(
      vehicleTable()
        ?.tBodies?.[0]
        ?.rows ??
      []
    );
  }

  function vehicleId(row) {
    const link =
      Array.from(
        row.querySelectorAll(
          'a[href*="/vehicles/"]'
        )
      ).find(
        element =>
          /\/vehicles\/\d+/.test(
            element.getAttribute(
              'href'
            ) ?? ''
          )
      );

    return Number(
      link
        ?.getAttribute('href')
        ?.match(
          /\/vehicles\/(\d+)/
        )?.[1]
    );
  }

  function vehicleType(row) {
    const element =
      row.querySelector(
        '[vehicle_type_id], [data-vehicle-type-id]'
      );

    return Number(
      element?.getAttribute(
        'vehicle_type_id'
      ) ??
      element?.getAttribute(
        'data-vehicle-type-id'
      )
    );
  }

  function vehicleName(row) {
    const link =
      Array.from(
        row.querySelectorAll(
          'a[href*="/vehicles/"]'
        )
      ).find(
        element =>
          /\/vehicles\/\d+/.test(
            element.getAttribute(
              'href'
            ) ?? ''
          )
      );

    return (
      link
        ?.textContent
        ?.trim() ??
      ''
    );
  }

  function resultCell(row) {
    return (
      row.cells?.[4] ??
      null
    );
  }

  // ============================================================
  // Anhängerstatus
  // ============================================================

  async function fetchTrailerAssignment(
    trailerId
  ) {
    const response =
      await fetch(
        `/vehicles/${trailerId}/edit`,
        {
          credentials:
            'same-origin',

          headers: {
            'X-Requested-With':
              'XMLHttpRequest'
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const html =
      await response.text();

    const doc =
      new DOMParser()
        .parseFromString(
          html,
          'text/html'
        );

    const select =
      doc.querySelector(
        'select[name="vehicle[tractive_vehicle_id]"]'
      );

    const randomInput =
      doc.querySelector(
        'input[name="vehicle[tractive_random]"]'
      );

    const random =
      !!randomInput?.checked;

    let towVehicleId =
      Number(
        select?.value
      );

    if (
      !Number.isInteger(
        towVehicleId
      ) ||
      towVehicleId <= 0
    ) {
      towVehicleId =
        Number(
          select
            ?.querySelector(
              'option:checked'
            )
            ?.value
        );
    }

    if (
      !Number.isInteger(
        towVehicleId
      ) ||
      towVehicleId <= 0
    ) {
      towVehicleId =
        null;
    }

    return {
      random,

      assigned:
        towVehicleId !== null,

      towVehicleId
    };
  }

  // ============================================================
  // Anzeige
  // ============================================================

  function showTrailerResult(
    vehicle,
    state,
    expectedTowType,
    vehicleById
  ) {
    const cell =
      vehicle.cell;

    if (!cell) {
      return;
    }

    cell.style.fontWeight =
      'bold';

    if (state.random) {
      cell.textContent =
        '⚠ Zufallsfahrzeug';

      cell.style.color =
        '#f0ad4e';

      cell.title =
        'Zufälliges Zugfahrzeug ist aktiviert';

      return;
    }

    if (!state.assigned) {
      cell.textContent =
        '✗ Nicht zugewiesen';

      cell.style.color =
        '#d9534f';

      cell.title =
        'Kein Zugfahrzeug zugewiesen';

      return;
    }

    const towVehicle =
      vehicleById.get(
        state.towVehicleId
      );

    if (!towVehicle) {
      cell.textContent =
        '⚠ Zugfahrzeug unbekannt';

      cell.style.color =
        '#f0ad4e';

      cell.title =
        `Zugfahrzeug-ID: ${state.towVehicleId}`;

      return;
    }

    if (
      towVehicle.type !==
      expectedTowType
    ) {
      cell.textContent =
        '⚠ Falsches Zugfahrzeug';

      cell.style.color =
        '#f0ad4e';

      cell.title =
        `Zugewiesen: ${towVehicle.name}\n` +
        `Ist-Typ: ${towVehicle.type}\n` +
        `Soll-Typ: ${expectedTowType}`;

      return;
    }

    cell.textContent =
      '✓ Zugewiesen';

    cell.style.color =
      '#5cb85c';

    cell.title =
      `Zugfahrzeug: ${towVehicle.name}`;
  }

  function showTowResult(
    vehicle,
    trailerIds,
    vehicleById,
    wrongAssignments
  ) {
    const cell =
      vehicle.cell;

    if (!cell) {
      return;
    }

    const count =
      trailerIds.length;

    cell.style.fontWeight =
      'bold';

    if (count === 0) {
      cell.textContent =
        '✗ Kein Anhänger';

      cell.style.color =
        '#d9534f';

      cell.title =
        'Diesem Zugfahrzeug ist kein geprüfter Anhänger zugewiesen';

      return;
    }

    if (
      count === 1 &&
      wrongAssignments.length === 0
    ) {
      const trailer =
        vehicleById.get(
          trailerIds[0]
        );

      cell.textContent =
        '✓ 1 Anhänger';

      cell.style.color =
        '#5cb85c';

      cell.title =
        trailer
          ? `Anhänger: ${trailer.name}`
          : `Anhänger-ID: ${trailerIds[0]}`;

      return;
    }

    cell.textContent =
      `⚠ ${count} Anhänger`;

    cell.style.color =
      '#f0ad4e';

    const lines =
      trailerIds.map(id => {
        const trailer =
          vehicleById.get(id);

        const wrong =
          wrongAssignments.includes(
            id
          );

        return (
          `${wrong ? 'FALSCH: ' : ''}` +
          `${trailer?.name ?? `Anhänger ${id}`}`
        );
      });

    cell.title =
      count > 1
        ? (
            `Mehrfachzuweisung:\n` +
            lines.join('\n')
          )
        : lines.join('\n');
  }

  // ============================================================
  // Fortschritt
  // ============================================================

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-tc-progress'
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      'nilspe-tc-style';

    style.textContent = `
      #nilspe-tc-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-tc-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-tc-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-tc-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;

    document.head.append(
      style
    );

    const container =
      document.createElement(
        'div'
      );

    container.id =
      'nilspe-tc-progress';

    const row =
      document.createElement(
        'div'
      );

    row.style.display =
      'flex';

    row.style.alignItems =
      'center';

    row.style.gap =
      '12px';

    const cancel =
      document.createElement(
        'button'
      );

    cancel.type =
      'button';

    cancel.className =
      'btn btn-default btn-xs';

    cancel.textContent =
      'Abbrechen';

    cancel.addEventListener(
      'click',
      () => {
        running = false;

        setProgress(
          'Abgebrochen',
          0,
          0,
          0,
          'danger'
        );
      }
    );

    const status =
      document.createElement(
        'span'
      );

    status.id =
      'nilspe-tc-status';

    status.className =
      'label label-info';

    status.textContent =
      'Bereit';

    const track =
      document.createElement(
        'div'
      );

    track.id =
      'nilspe-tc-track';

    const success =
      document.createElement(
        'div'
      );

    success.id =
      'nilspe-tc-success';

    const errors =
      document.createElement(
        'div'
      );

    errors.id =
      'nilspe-tc-errors';

    track.append(
      success,
      errors
    );

    row.append(
      cancel,
      status
    );

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
    errors = 0,
    total = 0,
    type = 'info'
  ) {
    ensureProgress();

    const status =
      document.getElementById(
        'nilspe-tc-status'
      );

    const success =
      document.getElementById(
        'nilspe-tc-success'
      );

    const errorBar =
      document.getElementById(
        'nilspe-tc-errors'
      );

    const safeTotal =
      Math.max(
        total,
        1
      );

    status.className =
      `label label-${type}`;

    status.textContent =
      message;

    success.style.width =
      `${Math.max(
        0,
        completed - errors
      ) / safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  // ============================================================
  // Prüfung
  // ============================================================

  async function run(button) {
    if (running) {
      return;
    }

    running = true;
    button.disabled = true;

    try {
      const mappings =
        await loadConfiguration();

      if (!mappings.length) {
        setProgress(
          'Keine Anhängertypen konfiguriert',
          0,
          0,
          0,
          'success'
        );

        return;
      }

      const vehicles =
        vehicleRows()
          .map(row => ({
            row,

            id:
              vehicleId(row),

            type:
              vehicleType(row),

            name:
              vehicleName(row),

            cell:
              resultCell(row)
          }))
          .filter(
            vehicle =>
              vehicle.id &&
              vehicle.type
          );

      const vehicleById =
        new Map(
          vehicles.map(
            vehicle => [
              vehicle.id,
              vehicle
            ]
          )
        );

      const mappingByTrailerType =
        new Map(
          mappings.map(
            mapping => [
              mapping.trailerTypeId,
              mapping
            ]
          )
        );

      const expectedTowTypes =
        new Set(
          mappings.map(
            mapping =>
              mapping.towTypeId
          )
        );

      /*
       * Nur Anhänger, für die wirklich
       * eine Prüfung konfiguriert ist.
       */
      const trailers =
        vehicles.filter(
          vehicle =>
            mappingByTrailerType.has(
              vehicle.type
            )
        );

      if (!trailers.length) {
        setProgress(
          'Keine konfigurierten Anhänger sichtbar',
          0,
          0,
          0,
          'success'
        );

        return;
      }

      const assignments =
        new Map();

      const wrongAssignments =
        new Map();

      let completed = 0;
      let errors = 0;
      let unassigned = 0;
      let wrong = 0;
      let random = 0;

      const delay =
        Math.max(
          0,
          Number(
            await GM.getValue(
              DELAY_KEY,
              DEFAULT_DELAY
            )
          ) || 0
        );

      setProgress(
        `0/${trailers.length} Anhänger geprüft`,
        0,
        0,
        trailers.length
      );

      for (
        const trailer
        of trailers
      ) {
        if (!running) {
          return;
        }

        try {
          const mapping =
            mappingByTrailerType.get(
              trailer.type
            );

          const state =
            await fetchTrailerAssignment(
              trailer.id
            );

          if (state.random) {
            random++;
          }

          if (
            !state.assigned &&
            !state.random
          ) {
            unassigned++;
          }

          if (
            state.assigned &&
            state.towVehicleId
          ) {
            if (
              !assignments.has(
                state.towVehicleId
              )
            ) {
              assignments.set(
                state.towVehicleId,
                []
              );
            }

            assignments
              .get(
                state.towVehicleId
              )
              .push(
                trailer.id
              );

            const actualTow =
              vehicleById.get(
                state.towVehicleId
              );

            if (
              actualTow &&
              actualTow.type !==
                mapping.towTypeId
            ) {
              wrong++;

              if (
                !wrongAssignments.has(
                  state.towVehicleId
                )
              ) {
                wrongAssignments.set(
                  state.towVehicleId,
                  []
                );
              }

              wrongAssignments
                .get(
                  state.towVehicleId
                )
                .push(
                  trailer.id
                );
            }
          }

          showTrailerResult(
            trailer,
            state,
            mapping.towTypeId,
            vehicleById
          );

        } catch (error) {
          errors++;

          console.error(
            '[Anhänger-Checker] Prüfung fehlgeschlagen:',
            trailer.id,
            error
          );
        }

        completed++;

        setProgress(
          `${completed}/${trailers.length} Anhänger geprüft`,
          completed,
          errors,
          trailers.length,
          errors
            ? 'warning'
            : 'info'
        );

        if (delay > 0) {
          await sleep(
            delay
          );
        }
      }

      if (!running) {
        return;
      }

      /*
       * Zugfahrzeuge anzeigen, wenn
       *
       * 1. ihr Typ als Soll-Zugfahrzeug
       *    konfiguriert wurde
       *
       * ODER
       *
       * 2. ihnen tatsächlich ein geprüfter
       *    Anhänger zugewiesen wurde.
       */
      const relevantTowVehicles =
        vehicles.filter(
          vehicle =>
            expectedTowTypes.has(
              vehicle.type
            ) ||
            assignments.has(
              vehicle.id
            )
        );

      let multiple = 0;

      for (
        const towVehicle
        of relevantTowVehicles
      ) {
        const trailerIds =
          assignments.get(
            towVehicle.id
          ) ?? [];

        const wrongIds =
          wrongAssignments.get(
            towVehicle.id
          ) ?? [];

        if (
          trailerIds.length > 1
        ) {
          multiple++;
        }

        showTowResult(
          towVehicle,
          trailerIds,
          vehicleById,
          wrongIds
        );
      }

      setProgress(
        `Fertig: ` +
        `${completed - errors} geprüft, ` +
        `${unassigned} ohne Zugfahrzeug, ` +
        `${random} Zufallsfahrzeug, ` +
        `${wrong} falsch, ` +
        `${multiple} Zugfahrzeuge mehrfach`,
        completed,
        errors,
        trailers.length,
        errors ||
        unassigned ||
        random ||
        wrong ||
        multiple
          ? 'warning'
          : 'success'
      );

    } catch (error) {
      console.error(
        '[Anhänger-Checker] Lauf fehlgeschlagen:',
        error
      );

      setProgress(
        `Fehler: ${error.message ?? error}`,
        0,
        0,
        0,
        'danger'
      );

    } finally {
      running = false;
      button.disabled = false;
    }
  }

  // ============================================================
  // Buttons
  // ============================================================

  function settingsButton() {
    const button =
      document.createElement(
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

    const icon =
      document.createElement(
        'span'
      );

    icon.className =
      'glyphicon glyphicon-cog';

    button.append(
      icon
    );

    return button;
  }

  function addButton() {
    const table =
      vehicleTable();

    if (
      !table ||
      document.getElementById(
        'nilspe-tc-buttons'
      )
    ) {
      return;
    }

    const group =
      document.createElement(
        'div'
      );

    group.id =
      'nilspe-tc-buttons';

    group.className =
      'btn-group';

    group.style.display =
      'flex';

    group.style.width =
      'fit-content';

    group.style.margin =
      '0';

    const start =
      document.createElement(
        'button'
      );

    start.type =
      'button';

    start.className =
      'btn btn-default btn-xs';

    start.textContent =
      'Anhänger prüfen';

    start.addEventListener(
      'click',
      () => run(start)
    );

    group.append(
      start,
      settingsButton()
    );

    const row =
      document.createElement(
        'div'
      );

    row.id =
      'nilspe-tc-button-row';

    row.style.display =
      'flex';

    row.style.width =
      '100%';

    row.style.margin =
      '0';

    row.style.padding =
      '0';

    row.style.lineHeight =
      '0';

    row.append(
      group
    );

    table.parentElement
      ?.insertBefore(
        row,
        table
      );
  }

  // ============================================================
  // Start
  // ============================================================

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();
    return;
  }

  addButton();

  new MutationObserver(
    addButton
  ).observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

})();