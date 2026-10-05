// ==UserScript==
// @name         Leitstelle Assign Trailer
// @namespace    NilsPe.assign.trailer
// @version      2.5.0
// @description  Weist Anhänger festen, konfigurierten Zugfahrzeugen derselben Wache zu und korrigiert falsche/Zufalls-Zuweisungen
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Trailer.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Trailer.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_assign_trailer';

  const KEYS = {
    requestDelay: 'nilspe_at_v3_request_delay',
    checkDelay: 'nilspe_at_v3_check_delay'
  };

  const BUILDING_TYPES = {
    FIRE: [0, 18],
    THW: [9],
    BEPO: [11],
    SEG: [12]
  };

  let running = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  // ============================================================
  // Anhänger-Konfiguration
  // ============================================================

  const TRAILER_CONFIG = [

    // ==========================================================
    // Feuerwehr
    // ==========================================================

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 143,
      trailerName: 'Anh Schlauch',
      key: 'nilspe_at_v3_fw_anh_schlauch',
      towVehicles: [
        { id: 90, name: 'HLF 10' },
        { id: 4, name: 'RW' },
        { id: 27, name: 'GW-Gefahrgut' },
        { id: 53, name: 'Dekon-P' },
        { id: 104, name: 'GW-L1' },
        { id: 105, name: 'GW-L2' },
        { id: 1, name: 'LF 10' },
        { id: 6, name: 'LF 8/6' },
        { id: 8, name: 'LF 10/6' },
        { id: 9, name: 'LF 16-TS' },
        { id: 15, name: 'SW 2000-Tr' },
        { id: 16, name: 'SW-KatS' },
        { id: 18, name: 'TLF 3000' },
        { id: 21, name: 'TLF 16/24-Tr' },
        { id: 22, name: 'TLF 16/25' },
        { id: 36, name: 'MTW' },
        { id: 37, name: 'TSF-W' },
        { id: 89, name: 'MLF' },
        { id: 88, name: 'KLF' },
        { id: 5, name: 'GW-A' }
      ]
    },

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 111,
      trailerName: 'NEA50',
      key: 'nilspe_at_v3_fw_nea50',
      towVehicles: [
        { id: 90, name: 'HLF 10' },
        { id: 4, name: 'RW' },
        { id: 27, name: 'GW-Gefahrgut' },
        { id: 53, name: 'Dekon-P' },
        { id: 104, name: 'GW-L1' },
        { id: 105, name: 'GW-L2' },
        { id: 1, name: 'LF 10' },
        { id: 6, name: 'LF 8/6' },
        { id: 8, name: 'LF 10/6' },
        { id: 9, name: 'LF 16-TS' },
        { id: 15, name: 'SW 2000-Tr' },
        { id: 16, name: 'SW-KatS' },
        { id: 18, name: 'TLF 3000' },
        { id: 21, name: 'TLF 16/24-Tr' },
        { id: 22, name: 'TLF 16/25' },
        { id: 83, name: 'GW-Werkfeuerwehr' },
        { id: 46, name: 'WLF' }
      ]
    },

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 113,
      trailerName: 'NEA200',
      key: 'nilspe_at_v3_fw_nea200',
      towVehicles: [
        { id: 90, name: 'HLF 10' },
        { id: 4, name: 'RW' },
        { id: 27, name: 'GW-Gefahrgut' },
        { id: 53, name: 'Dekon-P' },
        { id: 104, name: 'GW-L1' },
        { id: 105, name: 'GW-L2' },
        { id: 1, name: 'LF 10' },
        { id: 6, name: 'LF 8/6' },
        { id: 8, name: 'LF 10/6' },
        { id: 9, name: 'LF 16-TS' },
        { id: 15, name: 'SW 2000-Tr' },
        { id: 16, name: 'SW-KatS' },
        { id: 18, name: 'TLF 3000' },
        { id: 21, name: 'TLF 16/24-Tr' },
        { id: 22, name: 'TLF 16/25' },
        { id: 46, name: 'WLF' }
      ]
    },

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 115,
      trailerName: 'Anh Lüfter',
      key: 'nilspe_at_v3_fw_anh_luefter',
      towVehicles: [
        { id: 90, name: 'HLF 10' },
        { id: 4, name: 'RW' },
        { id: 27, name: 'GW-Gefahrgut' },
        { id: 53, name: 'Dekon-P' },
        { id: 104, name: 'GW-L1' },
        { id: 105, name: 'GW-L2' },
        { id: 1, name: 'LF 10' },
        { id: 6, name: 'LF 8/6' },
        { id: 8, name: 'LF 10/6' },
        { id: 9, name: 'LF 16-TS' },
        { id: 15, name: 'SW 2000-Tr' },
        { id: 16, name: 'SW-KatS' },
        { id: 18, name: 'TLF 3000' },
        { id: 21, name: 'TLF 16/24-Tr' },
        { id: 22, name: 'TLF 16/25' },
        { id: 5, name: 'GW-A' },
        { id: 83, name: 'GW-Werkfeuerwehr' },
        { id: 46, name: 'WLF' }
      ]
    },

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 141,
      trailerName: 'FKH',
      key: 'nilspe_at_v3_fw_fkh',
      towVehicles: [
        { id: 138, name: 'GW-Verpflegung' }
      ]
    },

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 168,
      trailerName: 'Anh Sonderlöschmittel',
      key: 'nilspe_at_v3_fw_anh_sonderloeschmittel',
      towVehicles: [
        { id: 90, name: 'HLF 10' },
        { id: 4, name: 'RW' },
        { id: 27, name: 'GW-Gefahrgut' },
        { id: 53, name: 'Dekon-P' },
        { id: 104, name: 'GW-L1' },
        { id: 105, name: 'GW-L2' },
        { id: 1, name: 'LF 10' },
        { id: 6, name: 'LF 8/6' },
        { id: 8, name: 'LF 10/6' },
        { id: 9, name: 'LF 16-TS' },
        { id: 15, name: 'SW 2000-Tr' },
        { id: 16, name: 'SW-KatS' },
        { id: 18, name: 'TLF 3000' },
        { id: 21, name: 'TLF 16/24-Tr' },
        { id: 22, name: 'TLF 16/25' },
        { id: 36, name: 'MTW' },
        { id: 37, name: 'TSF-W' },
        { id: 89, name: 'MLF' },
        { id: 88, name: 'KLF' }
      ]
    },

    // ==========================================================
    // SEG
    // ==========================================================

    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 70,
      trailerName: 'MZB',
      key: 'nilspe_at_v3_seg_mzb',
      towVehicles: [
        { id: 63, name: 'GW-Taucher' },
        { id: 64, name: 'GW-Wasserrettung' }
      ]
    },

    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 132,
      trailerName: 'FKH',
      key: 'nilspe_at_v3_seg_fkh',
      towVehicles: [
        { id: 133, name: 'Bt LKW' }
      ]
    },

    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 174,
      trailerName: 'Anh TeSi',
      key: 'nilspe_at_v3_seg_anh_tesi',
      towVehicles: [
        { id: 171, name: 'GW-TeSi' },
        { id: 173, name: 'MTW-TeSi' }
      ]
    },

    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 175,
      trailerName: 'Anh NEA 50',
      key: 'nilspe_at_v3_seg_nea50',
      towVehicles: [
        { id: 172, name: 'LKW Technik (Notstrom)' }
      ]
    },

    // ==========================================================
    // Bereitschaftspolizei
    // ==========================================================

    {
      category: 'Bereitschaftspolizei',
      buildingTypes: BUILDING_TYPES.BEPO,
      trailerTypeId: 136,
      trailerName: 'Anh Pferdetransport',
      key: 'nilspe_at_v3_bepo_pferdetransport',
      towVehicles: [
        { id: 134, name: 'Pferdetransporter klein' },
        { id: 135, name: 'Pferdetransporter groß' },
        { id: 137, name: 'Zugfahrzeug Pferdetransport' }
      ]
    },

    // ==========================================================
    // THW
    // ==========================================================

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 43,
      trailerName: 'BRmG R',
      key: 'nilspe_at_v3_thw_brmg_r',
      towVehicles: [
        { id: 42, name: 'LKW K 9' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 110,
      trailerName: 'NEA50',
      key: 'nilspe_at_v3_thw_nea50',
      towVehicles: [
        { id: 41, name: 'MzGW (FGr N)' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 44,
      trailerName: 'Anh DLE',
      key: 'nilspe_at_v3_thw_anh_dle',
      towVehicles: [
        { id: 41, name: 'MzGW (FGr N)' },
        { id: 39, name: 'GKW' },
        { id: 45, name: 'MLW 5' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 66,
      trailerName: 'Anh MzB',
      key: 'nilspe_at_v3_thw_anh_mzb',
      towVehicles: [
        { id: 65, name: 'LKW 7 Lkr 19 tm' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 67,
      trailerName: 'Anh SchlB',
      key: 'nilspe_at_v3_thw_anh_schlb',
      towVehicles: [
        { id: 65, name: 'LKW 7 Lkr 19 tm' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 68,
      trailerName: 'Anh MzAB',
      key: 'nilspe_at_v3_thw_anh_mzab',
      towVehicles: [
        { id: 65, name: 'LKW 7 Lkr 19 tm' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 92,
      trailerName: 'Anh Hund',
      key: 'nilspe_at_v3_thw_anh_hund',
      towVehicles: [
        { id: 93, name: 'MTW-O' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 101,
      trailerName: 'Anh SwPu',
      key: 'nilspe_at_v3_thw_anh_swpu',
      towVehicles: [
        { id: 123, name: 'LKW 7 Lbw (FGr WP)' },
        { id: 100, name: 'MLW 4' },
        { id: 99, name: 'LKW 7 Lbw' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 102,
      trailerName: 'Anh 7',
      key: 'nilspe_at_v3_thw_anh_7',
      towVehicles: [
        { id: 123, name: 'LKW 7 Lbw (FGr WP)' },
        { id: 100, name: 'MLW 4' },
        { id: 99, name: 'LKW 7 Lbw' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 112,
      trailerName: 'NEA200',
      key: 'nilspe_at_v3_thw_nea200',
      towVehicles: [
        { id: 122, name: 'LKW 7 Lbw (FGr E)' },
        { id: 99, name: 'LKW 7 Lbw' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 146,
      trailerName: 'Anh FüLa',
      key: 'nilspe_at_v3_thw_anh_fuela',
      towVehicles: [
        { id: 145, name: 'FüKomKW' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 178,
      trailerName: 'Anh 12 Lbw (FGr Log-V)',
      key: 'nilspe_at_v3_thw_anh_12_lbw_logv',
      towVehicles: [
        { id: 176, name: 'LKW 7 Lbw (FGr Log-V)' }
      ]
    },

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 183,
      trailerName: 'Anh Plattform (FGr BrB)',
      key: 'nilspe_at_v3_thw_anh_plattform_brb',
      towVehicles: [
        { id: 181, name: 'MzGW (FGr BrB)' }
      ]
    }
  ];

  // ============================================================
  // Einstellungen
  // ============================================================

  function settingOptions(config) {
    return [
      {
        value: 0,
        name: 'Keine Zuweisung'
      },
      ...config.towVehicles.map(vehicle => ({
        value: vehicle.id,
        name: vehicle.name
      }))
    ];
  }

  async function bindTrailerSettingPersistence(config) {
    const select =
      Array.from(
        document.querySelectorAll('select')
      ).find(element =>
        element.id?.includes(config.key)
      );

    if (!select) {
      return;
    }

    let storedValues = [];

    try {
      const raw =
        await GM.getValue(
          config.key,
          '[]'
        );

      const parsed =
        JSON.parse(raw);

      if (Array.isArray(parsed)) {
        storedValues = parsed;
      }
    } catch {
      storedValues = [];
    }

    const stored =
      storedValues.length === 1
        ? String(storedValues[0])
        : '0';

    for (const option of select.options) {
      option.selected =
        String(option.value) === stored;
    }

    const pageJQuery =
      typeof unsafeWindow !== 'undefined'
        ? unsafeWindow.jQuery ?? unsafeWindow.$
        : globalThis.jQuery ?? globalThis.$;

    if (typeof pageJQuery === 'function') {
      const picker =
        pageJQuery(select);

      if (
        picker &&
        typeof picker.selectpicker === 'function'
      ) {
        picker.selectpicker('refresh');
      }
    }

    const saveSelection =
      async () => {
        const selected =
          Number(select.value);

        const value =
          Number.isInteger(selected)
            ? selected
            : 0;

        await GM.setValue(
          config.key,
          JSON.stringify([value])
        );
      };

    select.addEventListener(
      'change',
      saveSelection
    );

    if (
      typeof pageJQuery === 'function'
    ) {
      pageJQuery(select)
        .off(
          'changed.bs.select.nilspeAssignTrailer'
        )
        .on(
          'changed.bs.select.nilspeAssignTrailer',
          saveSelection
        );
    }
  }

  async function createSettings() {
    if (
      typeof addOptions !== 'function'
    ) {
      console.error(
        '[Assign Trailer] Scriptbasis/addOptions fehlt.'
      );

      return;
    }

    const settings = [];
    let lastCategory = null;

    for (const config of TRAILER_CONFIG) {
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
        key: config.key,
        label: config.trailerName,
        title: 'Zugfahrzeug auswählen',
        multiple: false,
        options: settingOptions(config)
      });
    }

    settings.push(
      {
        type: 'header',
        text: 'Ablauf'
      },
      {
        type: 'number',
        key: KEYS.checkDelay,
        label: 'Pause zwischen Prüfungen [ms]',
        min: 0,
        max: 5000,
        default: 100
      },
      {
        type: 'number',
        key: KEYS.requestDelay,
        label: 'Pause zwischen Zuweisungen [ms]',
        min: 0,
        max: 5000,
        default: 500
      }
    );

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Assign Trailer',
      settings
    });

    for (const config of TRAILER_CONFIG) {
      await bindTrailerSettingPersistence(
        config
      );
    }
  }

  async function selectedTowTypeId(config) {
    let values;

    try {
      values =
        JSON.parse(
          await GM.getValue(
            config.key,
            '[]'
          )
        );
    } catch {
      return null;
    }

    if (
      !Array.isArray(values) ||
      values.length !== 1
    ) {
      return null;
    }

    const typeId =
      Number(values[0]);

    if (
      !Number.isInteger(typeId) ||
      typeId <= 0
    ) {
      return null;
    }

    return config.towVehicles.some(
      vehicle =>
        vehicle.id === typeId
    )
      ? typeId
      : null;
  }

  async function loadMappings() {
    const mappings = [];

    for (const config of TRAILER_CONFIG) {
      const towTypeId =
        await selectedTowTypeId(
          config
        );

      if (towTypeId === null) {
        continue;
      }

      const towConfig =
        config.towVehicles.find(
          vehicle =>
            vehicle.id === towTypeId
        );

      mappings.push({
        category: config.category,
        buildingTypes:
          config.buildingTypes,
        trailerTypeId:
          config.trailerTypeId,
        trailerName:
          config.trailerName,
        towTypeId,
        towName:
          towConfig?.name ??
          `Typ ${towTypeId}`
      });
    }

    return mappings;
  }

  async function configuration() {
    return {
      mappings:
        await loadMappings(),

      checkDelay:
        Math.max(
          0,
          Number(
            await GM.getValue(
              KEYS.checkDelay,
              100
            )
          ) || 0
        ),

      requestDelay:
        Math.max(
          0,
          Number(
            await GM.getValue(
              KEYS.requestDelay,
              500
            )
          ) || 0
        )
    };
  }

  // ============================================================
  // Leitstelle / Fahrzeuge
  // ============================================================

  function vehicleTable() {
    return document.getElementById(
      'vehicle_table'
    );
  }

  function currentDispatchCenterId() {
    const match =
      location.pathname.match(
        /^\/buildings\/(\d+)/
      );

    return match
      ? Number(match[1])
      : null;
  }

  async function loadBuildingTypeMap(
    dispatchCenterId
  ) {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function' ||
      typeof getDataByIndex !== 'function'
    ) {
      throw new Error(
        'Gebäude-Funktionen der Scriptbasis fehlen.'
      );
    }

    const db =
      await openDb();

    try {
      await updateBuildings(
        db,
        60
      );

      const buildings =
        await getDataByIndex(
          db,
          'buildings',
          'leitstelle_building_id',
          Number(dispatchCenterId)
        );

      const map =
        new Map();

      for (const building of buildings) {
        map.set(
          Number(building.id),
          Number(building.building_type)
        );
      }

      return map;

    } finally {
      db.close();
    }
  }

  function getVehiclesFromTable(
    buildingTypeMap
  ) {
    const table =
      vehicleTable();

    if (!table) {
      return [];
    }

    const vehicles = [];

    for (
      const row
      of table.querySelectorAll(
        'tbody tr'
      )
    ) {
      const vehicleLink =
        row.querySelector(
          'td:nth-child(2) a[href*="/vehicles/"]'
        );

      const vehicleMatch =
        vehicleLink
          ?.getAttribute('href')
          ?.match(
            /\/vehicles\/(\d+)/
          );

      if (!vehicleMatch) {
        continue;
      }

      const id =
        Number(
          vehicleMatch[1]
        );

      const image =
        row.querySelector(
          'img.vehicle_image_reload'
        );

      const typeId =
        Number(
          image?.getAttribute(
            'vehicle_type_id'
          )
        );

      if (
        !Number.isInteger(typeId)
      ) {
        continue;
      }

      const buildingLink =
        row.querySelector(
          'a[href^="/buildings/"]'
        );

      const buildingMatch =
        buildingLink
          ?.getAttribute('href')
          ?.match(
            /\/buildings\/(\d+)/
          );

      const buildingId =
        buildingMatch
          ? Number(
              buildingMatch[1]
            )
          : null;

      const buildingType =
        buildingId !== null
          ? buildingTypeMap.get(
              buildingId
            )
          : null;

      vehicles.push({
        id,
        typeId,
        buildingId,
        buildingType,
        name:
          vehicleLink
            ?.textContent
            ?.trim() ??
          `Fahrzeug ${id}`
      });
    }

    return vehicles;
  }

  // ============================================================
  // Aktuelle Anhänger-Zuweisung auslesen
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
      Number(select?.value);

    if (
      !Number.isInteger(towVehicleId) ||
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
      !Number.isInteger(towVehicleId) ||
      towVehicleId <= 0
    ) {
      towVehicleId = null;
    }

    return {
      random,
      assigned:
        towVehicleId !== null,
      towVehicleId
    };
  }

  // ============================================================
  // Anhänger speichern
  // ============================================================

  function csrfToken() {
    return (
      document.querySelector(
        'meta[name="csrf-token"]'
      )?.content ??
      ''
    );
  }

  async function assignTrailer(
    trailerId,
    towVehicleId
  ) {
    const token =
      csrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token wurde nicht gefunden.'
      );
    }

    const response =
      await fetch(
        `/vehicles/${trailerId}`,
        {
          method: 'POST',

          credentials:
            'same-origin',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded; charset=UTF-8',

            'X-CSRF-Token':
              token,

            'X-Requested-With':
              'XMLHttpRequest'
          },

          body:
            new URLSearchParams({
              _method:
                'put',

              authenticity_token:
                token,

              // WICHTIG:
              // Zufallsfahrzeug immer AUS.
              'vehicle[tractive_random]':
                '0',

              // Konkretes Zugfahrzeug.
              'vehicle[tractive_vehicle_id]':
                String(
                  towVehicleId
                )
            }),

          redirect:
            'follow'
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }
  }

  // ============================================================
  // Alle relevanten Anhänger prüfen
  // ============================================================

  async function inspectTrailers(
    vehicles,
    mappings,
    checkDelay
  ) {
    const mappingByTrailerType =
      new Map(
        mappings.map(
          mapping => [
            mapping.trailerTypeId,
            mapping
          ]
        )
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

    const trailers =
      vehicles
        .filter(vehicle => {
          const mapping =
            mappingByTrailerType.get(
              vehicle.typeId
            );

          return (
            mapping &&
            mapping.buildingTypes.includes(
              vehicle.buildingType
            )
          );
        })
        .sort(
          (a, b) =>
            a.id - b.id
        );

    const inspected = [];

    let checked = 0;
    let errors = 0;

    for (const trailer of trailers) {
      if (!running) {
        break;
      }

      const mapping =
        mappingByTrailerType.get(
          trailer.typeId
        );

      try {
        const state =
          await fetchTrailerAssignment(
            trailer.id
          );

        const currentTow =
          state.towVehicleId
            ? vehicleById.get(
                state.towVehicleId
              )
            : null;

        inspected.push({
          trailer,
          mapping,
          state,
          currentTow
        });

      } catch (error) {
        errors++;

        console.error(
          '[Assign Trailer] Prüfung fehlgeschlagen:',
          trailer.id,
          error
        );
      }

      checked++;

      setProgress(
        `Prüfe Anhänger ${checked}/${trailers.length} ...`,
        checked,
        errors,
        trailers.length,
        errors
          ? 'warning'
          : 'info'
      );

      if (checkDelay > 0) {
        await sleep(
          checkDelay
        );
      }
    }

    return {
      inspected,
      errors
    };
  }

  // ============================================================
  // Reparaturplan
  // ============================================================

  function buildRepairPlan(
    inspected,
    vehicles
  ) {
    /*
     * Zugfahrzeuge, die bereits eine saubere,
     * feste 1:1-Zuweisung besitzen, werden reserviert.
     */
    const reservedTowIds =
      new Set();

    const keep = [];
    const repair = [];

    /*
     * Pass 1:
     * Bereits korrekte feste Zuweisungen behalten.
     *
     * "random" gilt ausdrücklich NICHT als korrekt.
     */
    for (const item of inspected) {
      const {
        state,
        currentTow,
        mapping,
        trailer
      } = item;

      const correctFixed =
        !state.random &&
        state.assigned &&
        currentTow &&
        currentTow.typeId ===
          mapping.towTypeId &&
        currentTow.buildingId ===
          trailer.buildingId &&
        !reservedTowIds.has(
          currentTow.id
        );

      if (correctFixed) {
        reservedTowIds.add(
          currentTow.id
        );

        keep.push(
          item
        );

      } else {
        repair.push(
          item
        );
      }
    }

    /*
     * Pass 2:
     * Offene, falsche, zufällige oder mehrfache
     * Zuweisungen reparieren.
     */
    const plan = [];
    const noTowVehicle = [];

    for (const item of repair) {
      const candidates =
        vehicles
          .filter(vehicle =>
            vehicle.typeId ===
              item.mapping.towTypeId &&

            vehicle.buildingId ===
              item.trailer.buildingId &&

            !reservedTowIds.has(
              vehicle.id
            )
          )
          .sort(
            (a, b) =>
              a.id - b.id
          );

      const towVehicle =
        candidates[0];

      if (!towVehicle) {
        noTowVehicle.push(
          item
        );

        continue;
      }

      reservedTowIds.add(
        towVehicle.id
      );

      let reason =
        'nicht zugewiesen';

      if (item.state.random) {
        reason =
          'Zufallsfahrzeug aktiv';

      } else if (
        item.state.assigned &&
        item.currentTow?.typeId !==
          item.mapping.towTypeId
      ) {
        reason =
          'falscher Zugfahrzeugtyp';

      } else if (
        item.state.assigned &&
        item.currentTow?.buildingId !==
          item.trailer.buildingId
      ) {
        reason =
          'Zugfahrzeug falsche Wache';

      } else if (
        item.state.assigned
      ) {
        reason =
          'Zugfahrzeug mehrfach verwendet';
      }

      plan.push({
        ...item,
        towVehicle,
        reason
      });
    }

    return {
      keep,
      plan,
      noTowVehicle
    };
  }

  // ============================================================
  // Fortschrittsanzeige
  // ============================================================

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-at-progress'
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        'style'
      );

    style.id =
      'nilspe-at-style';

    style.textContent = `
      #nilspe-at-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-at-progress-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #nilspe-at-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-at-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-at-errors {
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
      'nilspe-at-progress';

    const row =
      document.createElement(
        'div'
      );

    row.id =
      'nilspe-at-progress-row';

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
      'nilspe-at-status';

    status.className =
      'label label-info';

    status.textContent =
      'Bereit';

    const track =
      document.createElement(
        'div'
      );

    track.id =
      'nilspe-at-track';

    const success =
      document.createElement(
        'div'
      );

    success.id =
      'nilspe-at-success';

    const errors =
      document.createElement(
        'div'
      );

    errors.id =
      'nilspe-at-errors';

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
        'nilspe-at-status'
      );

    const success =
      document.getElementById(
        'nilspe-at-success'
      );

    const errorBar =
      document.getElementById(
        'nilspe-at-errors'
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
  // Hauptlauf
  // ============================================================

  async function run(buttons) {
    if (running) {
      return;
    }

    try {
      const config =
        await configuration();

      if (
        !config.mappings.length
      ) {
        setProgress(
          'Keine Anhängerzuweisungen ausgewählt',
          0,
          0,
          0,
          'success'
        );

        return;
      }

      running = true;

      buttons.forEach(
        button => {
          button.disabled = true;
        }
      );

      const dispatchCenterId =
        currentDispatchCenterId();

      if (
        !Number.isInteger(
          dispatchCenterId
        )
      ) {
        throw new Error(
          'Leitstellen-ID konnte nicht ermittelt werden.'
        );
      }

      setProgress(
        'Gebäude werden geladen ...'
      );

      const buildingTypeMap =
        await loadBuildingTypeMap(
          dispatchCenterId
        );

      setProgress(
        'Fahrzeugtabelle wird ausgewertet ...'
      );

      const vehicles =
        getVehiclesFromTable(
          buildingTypeMap
        );

      if (!vehicles.length) {
        throw new Error(
          'Keine Fahrzeuge gefunden.'
        );
      }

      /*
       * Anders als früher werden jetzt ALLE
       * konfigurierten Anhänger geprüft.
       */
      const {
        inspected,
        errors: checkErrors
      } =
        await inspectTrailers(
          vehicles,
          config.mappings,
          config.checkDelay
        );

      if (!running) {
        return;
      }

      if (!inspected.length) {
        setProgress(
          'Keine konfigurierten Anhänger gefunden',
          0,
          checkErrors,
          0,
          checkErrors
            ? 'warning'
            : 'success'
        );

        return;
      }

      const {
        keep,
        plan,
        noTowVehicle
      } =
        buildRepairPlan(
          inspected,
          vehicles
        );

      if (!plan.length) {
        const message =
          noTowVehicle.length
            ? (
                `Keine Änderung möglich: ` +
                `${keep.length} korrekt, ` +
                `${noTowVehicle.length} ohne freies passendes Zugfahrzeug`
              )
            : (
                `Alles korrekt: ` +
                `${keep.length} feste Zuweisungen`
              );

        setProgress(
          message,
          inspected.length,
          checkErrors,
          inspected.length,
          checkErrors ||
          noTowVehicle.length
            ? 'warning'
            : 'success'
        );

        return;
      }

      let completed = 0;
      let errors =
        checkErrors;
      let changed = 0;

      setProgress(
        `0/${plan.length} Zuweisungen werden korrigiert`,
        0,
        0,
        plan.length
      );

      for (const assignment of plan) {
        if (!running) {
          break;
        }

        const {
          trailer,
          towVehicle,
          mapping,
          reason
        } =
          assignment;

        setProgress(
          `${completed}/${plan.length}: ` +
          `${mapping.trailerName} → ${mapping.towName} ` +
          `(${reason})`,
          completed,
          errors - checkErrors,
          plan.length
        );

        try {
          /*
           * assignTrailer setzt IMMER:
           *
           * tractive_random = 0
           * +
           * konkrete Zugfahrzeug-ID.
           */
          await assignTrailer(
            trailer.id,
            towVehicle.id
          );

          changed++;

          console.log(
            '[Assign Trailer] Korrigiert:',
            trailer.id,
            '→',
            towVehicle.id,
            mapping.towName,
            '| Grund:',
            reason
          );

        } catch (error) {
          errors++;

          console.error(
            '[Assign Trailer] Zuweisung fehlgeschlagen:',
            assignment,
            error
          );
        }

        completed++;

        setProgress(
          `${completed}/${plan.length} bearbeitet, ` +
          `${changed} geändert`,
          completed,
          errors - checkErrors,
          plan.length,
          errors > checkErrors
            ? 'warning'
            : 'success'
        );

        if (
          running &&
          config.requestDelay > 0
        ) {
          await sleep(
            config.requestDelay
          );
        }
      }

      if (!running) {
        return;
      }

      setProgress(
        `Fertig: ` +
        `${keep.length} bereits korrekt, ` +
        `${changed} geändert, ` +
        `${noTowVehicle.length} ohne freies Zugfahrzeug, ` +
        `${errors} Fehler`,
        plan.length,
        errors - checkErrors,
        plan.length,
        errors ||
        noTowVehicle.length
          ? 'warning'
          : 'success'
      );

    } catch (error) {
      console.error(
        '[Assign Trailer] Lauf fehlgeschlagen:',
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

      buttons.forEach(
        button => {
          button.disabled =
            false;
        }
      );
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

  function addButtons() {
    if (
      document.getElementById(
        'nilspe-at-button-row'
      )
    ) {
      return;
    }

    const activeVehicleTab =
      document.querySelector(
        '#tab_vehicle.active'
      );

    const table =
      vehicleTable();

    if (
      !activeVehicleTab ||
      !table
    ) {
      return;
    }

    const group =
      document.createElement(
        'div'
      );

    group.id =
      'nilspe-at-buttons';

    group.className =
      'btn-group';

    const assignButton =
      document.createElement(
        'button'
      );

    assignButton.type =
      'button';

    assignButton.className =
      'btn btn-default btn-xs';

    assignButton.textContent =
      'Anhänger zuweisen';

    const buttons = [
      assignButton
    ];

    assignButton.addEventListener(
      'click',
      () => {
        void run(
          buttons
        );
      }
    );

    group.append(
      assignButton,
      settingsButton()
    );

    const row =
      document.createElement(
        'div'
      );

    row.id =
      'nilspe-at-button-row';

    row.style.display =
      'block';

    row.style.width =
      '100%';

    row.style.margin =
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

  addButtons();

  const buttonInterval =
    setInterval(
      () => {
        addButtons();

        if (
          document.getElementById(
            'nilspe-at-button-row'
          )
        ) {
          clearInterval(
            buttonInterval
          );
        }
      },
      500
    );

})();
