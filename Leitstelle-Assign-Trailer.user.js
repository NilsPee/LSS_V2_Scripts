
// ==UserScript==
// @name         Leitstelle Assign Trailer
// @namespace    NilsPe.assign.trailer
// @version      2.8.1
// @description  Anhänger festen Zugfahrzeugen zuweisen und fehlerhafte Zuordnungen korrigieren
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Trailer.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Trailer.user.js
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

  const PREFIX = '[Leitstelle Assign Trailer]';
  const VERSION = '2.8.1';
  const SETTINGS_IDENTIFIER = 'nilspe_assign_trailer';
  const ENABLED_PREFIX = 'nilspe_at_v3_enabled_';

  const KEYS = {
    requestDelay: 'nilspe_at_v3_request_delay',
    checkDelay: 'nilspe_at_v3_check_delay'
  };

  const BUILDING_TYPES = {
    FIRE: [0, 18],
    THW: [9],
    BEPO: [11],
    SEG: [12],
    WATER: [15],
    MOUNTAIN: [25]
  };

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  let running = false;
  let cancelled = false;

  /*
   * ==========================================
   * ZUGFAHRZEUG-KATALOG
   * ==========================================
   *
   * Bestehende Zuordnungen unverändert.
   */

  const FIRE_TOW_SMALL = [
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
    [22, 'TLF 16/25']
  ];

  const FIRE_TOW_EXTRA = [
    [36, 'MTW'],
    [37, 'TSF-W'],
    [89, 'MLF'],
    [88, 'KLF']
  ];

  const FIRE_TOW_SCHLAUCH = [
    ...FIRE_TOW_SMALL,
    ...FIRE_TOW_EXTRA,
    [5, 'GW-A']
  ];

  const FIRE_TOW_NEA50 = [
    ...FIRE_TOW_SMALL,
    [83, 'GW-Werkfeuerwehr'],
    [46, 'WLF']
  ];

  const FIRE_TOW_NEA200 = [
    ...FIRE_TOW_SMALL,
    [46, 'WLF']
  ];

  const FIRE_TOW_LUEFTER = [
    ...FIRE_TOW_SMALL,
    [5, 'GW-A'],
    [83, 'GW-Werkfeuerwehr'],
    [46, 'WLF']
  ];

  const FIRE_TOW_SONDER = [
    ...FIRE_TOW_SMALL,
    ...FIRE_TOW_EXTRA
  ];

  const MZB_TOW = [
    [63, 'GW-Taucher'],
    [64, 'GW-Wasserrettung']
  ];

  const MOUNTAIN_TOW = [
    [149, 'GW-Bergrettung (NEF)'],
    [150, 'GW-Bergrettung']
  ];

  const ANIMAL_TOW = [
    ...FIRE_TOW_SONDER,
    [185, 'GW-Tierrettung']
  ];

  function asTowVehicles(entries) {
    return entries.map(([id, name]) => ({
      id,
      name
    }));
  }

  /*
   * ==========================================
   * ANHÄNGER-KONFIGURATION
   * ==========================================
   *
   * Alle bisherigen Speicherkeys bleiben
   * bestehen.
   */

  const TRAILER_CONFIG = [

    // Feuerwehr

    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 143,
      trailerName: 'Anh Schlauch',
      key: 'nilspe_at_v3_fw_anh_schlauch',
      towVehicles: asTowVehicles(FIRE_TOW_SCHLAUCH)
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 111,
      trailerName: 'NEA50',
      key: 'nilspe_at_v3_fw_nea50',
      towVehicles: asTowVehicles(FIRE_TOW_NEA50)
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 113,
      trailerName: 'NEA200',
      key: 'nilspe_at_v3_fw_nea200',
      towVehicles: asTowVehicles(FIRE_TOW_NEA200)
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 115,
      trailerName: 'Anh Lüfter',
      key: 'nilspe_at_v3_fw_anh_luefter',
      towVehicles: asTowVehicles(FIRE_TOW_LUEFTER)
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 141,
      trailerName: 'FKH',
      key: 'nilspe_at_v3_fw_fkh',
      towVehicles: asTowVehicles([
        [138, 'GW-Verpflegung']
      ])
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 168,
      trailerName: 'Anh Sonderlöschmittel',
      key: 'nilspe_at_v3_fw_anh_sonderloeschmittel',
      towVehicles: asTowVehicles(FIRE_TOW_SONDER)
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 70,
      trailerName: 'MZB',
      key: 'nilspe_at_v3_fw_mzb',
      towVehicles: asTowVehicles(MZB_TOW)
    },
    {
      category: 'Feuerwehr',
      buildingTypes: BUILDING_TYPES.FIRE,
      trailerTypeId: 186,
      trailerName: 'Anh Tierrettung',
      key: 'nilspe_at_v3_fw_anh_tierrettung',
      towVehicles: asTowVehicles(ANIMAL_TOW)
    },

    // SEG

    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 70,
      trailerName: 'MZB',
      key: 'nilspe_at_v3_seg_mzb',
      towVehicles: asTowVehicles(MZB_TOW)
    },
    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 132,
      trailerName: 'FKH',
      key: 'nilspe_at_v3_seg_fkh',
      towVehicles: asTowVehicles([
        [133, 'Bt LKW']
      ])
    },
    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 174,
      trailerName: 'Anh TeSi',
      key: 'nilspe_at_v3_seg_anh_tesi',
      towVehicles: asTowVehicles([
        [171, 'GW-TeSi'],
        [173, 'MTW-TeSi']
      ])
    },
    {
      category: 'SEG',
      buildingTypes: BUILDING_TYPES.SEG,
      trailerTypeId: 175,
      trailerName: 'Anh NEA 50',
      key: 'nilspe_at_v3_seg_nea50',
      towVehicles: asTowVehicles([
        [172, 'LKW Technik (Notstrom)']
      ])
    },

    // Bereitschaftspolizei

    {
      category: 'Bereitschaftspolizei',
      buildingTypes: BUILDING_TYPES.BEPO,
      trailerTypeId: 136,
      trailerName: 'Anh Pferdetransport',
      key: 'nilspe_at_v3_bepo_pferdetransport',
      towVehicles: asTowVehicles([
        [134, 'Pferdetransporter klein'],
        [135, 'Pferdetransporter groß'],
        [137, 'Zugfahrzeug Pferdetransport']
      ])
    },

    // THW

    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 43,
      trailerName: 'BRmG R',
      key: 'nilspe_at_v3_thw_brmg_r',
      towVehicles: asTowVehicles([
        [42, 'LKW K 9']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 110,
      trailerName: 'NEA50',
      key: 'nilspe_at_v3_thw_nea50',
      towVehicles: asTowVehicles([
        [41, 'MzGW (FGr N)']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 44,
      trailerName: 'Anh DLE',
      key: 'nilspe_at_v3_thw_anh_dle',
      towVehicles: asTowVehicles([
        [41, 'MzGW (FGr N)'],
        [39, 'GKW'],
        [45, 'MLW 5']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 66,
      trailerName: 'Anh MzB',
      key: 'nilspe_at_v3_thw_anh_mzb',
      towVehicles: asTowVehicles([
        [65, 'LKW 7 Lkr 19 tm']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 67,
      trailerName: 'Anh SchlB',
      key: 'nilspe_at_v3_thw_anh_schlb',
      towVehicles: asTowVehicles([
        [65, 'LKW 7 Lkr 19 tm']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 68,
      trailerName: 'Anh MzAB',
      key: 'nilspe_at_v3_thw_anh_mzab',
      towVehicles: asTowVehicles([
        [65, 'LKW 7 Lkr 19 tm']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 92,
      trailerName: 'Anh Hund',
      key: 'nilspe_at_v3_thw_anh_hund',
      towVehicles: asTowVehicles([
        [93, 'MTW-O']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 101,
      trailerName: 'Anh SwPu',
      key: 'nilspe_at_v3_thw_anh_swpu',
      towVehicles: asTowVehicles([
        [123, 'LKW 7 Lbw (FGr WP)'],
        [100, 'MLW 4'],
        [99, 'LKW 7 Lbw']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 102,
      trailerName: 'Anh 7',
      key: 'nilspe_at_v3_thw_anh_7',
      towVehicles: asTowVehicles([
        [123, 'LKW 7 Lbw (FGr WP)'],
        [100, 'MLW 4'],
        [99, 'LKW 7 Lbw']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 112,
      trailerName: 'NEA200',
      key: 'nilspe_at_v3_thw_nea200',
      towVehicles: asTowVehicles([
        [122, 'LKW 7 Lbw (FGr E)'],
        [99, 'LKW 7 Lbw']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 146,
      trailerName: 'Anh FüLa',
      key: 'nilspe_at_v3_thw_anh_fuela',
      towVehicles: asTowVehicles([
        [145, 'FüKomKW']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 178,
      trailerName: 'Anh 12 Lbw (FGr Log-V)',
      key: 'nilspe_at_v3_thw_anh_12_lbw_logv',
      towVehicles: asTowVehicles([
        [176, 'LKW 7 Lbw (FGr Log-V)']
      ])
    },
    {
      category: 'THW',
      buildingTypes: BUILDING_TYPES.THW,
      trailerTypeId: 183,
      trailerName: 'Anh Plattform (FGr BrB)',
      key: 'nilspe_at_v3_thw_anh_plattform_brb',
      towVehicles: asTowVehicles([
        [181, 'MzGW (FGr BrB)']
      ])
    },

    // Wasserrettung

    {
      category: 'Wasserrettung',
      buildingTypes: BUILDING_TYPES.WATER,
      trailerTypeId: 70,
      trailerName: 'MZB',
      key: 'nilspe_at_v3_wasserrettung_mzb',
      towVehicles: asTowVehicles(MZB_TOW)
    },

    // Bergrettung

    {
      category: 'Bergrettung',
      buildingTypes: BUILDING_TYPES.MOUNTAIN,
      trailerTypeId: 155,
      trailerName: 'Anh Höhenrettung (Bergrettung)',
      key: 'nilspe_at_v3_bergrettung_anh_hoehenrettung',
      towVehicles: asTowVehicles(MOUNTAIN_TOW)
    }
  ];

  /*
   * ==========================================
   * KONFIGURATION LADEN / SPEICHERN
   * ==========================================
   */

  function parseSelection(value) {
    try {
      const parsed =
        typeof value === 'string'
          ? JSON.parse(value)
          : value;

      if (
        Array.isArray(parsed) &&
        parsed.length === 1
      ) {
        const typeId = Number(parsed[0]);

        return Number.isInteger(typeId) &&
          typeId > 0
          ? typeId
          : null;
      }
    } catch {
      return null;
    }

    return null;
  }

  async function selectedTowTypeId(config) {
    const saved = await GM.getValue(
      config.key,
      '[]'
    );

    const selected = parseSelection(saved);

    return config.towVehicles.some(
      vehicle => vehicle.id === selected
    )
      ? selected
      : null;
  }

  async function isEnabled(
    config,
    selected = undefined
  ) {
    const saved = await GM.getValue(
      ENABLED_PREFIX + config.key,
      null
    );

    if (saved !== null) {
      return saved === true ||
        saved === 'true';
    }

    const towType =
      selected === undefined
        ? await selectedTowTypeId(config)
        : selected;

    return towType !== null;
  }

  async function saveTowType(config, typeId) {
    await GM.setValue(
      config.key,
      JSON.stringify([typeId || 0])
    );
  }

  async function saveEnabled(config, enabled) {
    await GM.setValue(
      ENABLED_PREFIX + config.key,
      Boolean(enabled)
    );
  }

  /*
   * ==========================================
   * EINSTELLUNGSOBERFLÄCHE
   * ==========================================
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-at-settings-style'
      )
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-at-settings-style';

    style.textContent = `
      #nilspe-at-modern {
        margin-bottom: 20px;
      }

      .nilspe-at-category {
        border: 1px solid #8885;
        border-radius: 4px;
        margin-bottom: 7px;
        overflow: hidden;
      }

      .nilspe-at-category > summary {
        padding: 9px 12px;
        cursor: pointer;
        background: #8882;
        font-weight: bold;
      }

      .nilspe-at-category-body {
        padding: 10px;
      }

      .nilspe-at-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }

      .nilspe-at-bulk {
        display: inline-flex !important;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        flex: 0 0 110px;
        width: 110px;
        height: 28px;
        margin: 0 !important;
        padding: 2px 6px !important;
        white-space: nowrap;
        font-size: 13px;
        line-height: 1;
      }

      .nilspe-at-setting-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        margin-bottom: 3px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      .nilspe-at-setting-row.active {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      .nilspe-at-tow-select {
        box-sizing: border-box;
        flex: 0 1 260px;
        width: 260px;
        min-width: 160px;
        height: 28px !important;
        padding: 2px 7px !important;
        margin: 0 !important;
        font-size: 13px;
      }

      .nilspe-at-setting-name {
        flex: 1;
        min-width: 110px;
        cursor: pointer;
      }

      .nilspe-at-setting-row:not(.active)
      .nilspe-at-setting-name {
        opacity: .6;
      }

      .nilspe-at-setting-toggle {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        flex: 0 0 30px;
        width: 30px;
        height: 28px;
        margin: 0 !important;
        padding: 2px 5px !important;
        font-size: 13px;
        line-height: 1;
      }

      .nilspe-at-count {
        margin-left: auto;
        font-size: 12px;
        opacity: .7;
      }
    `;

    document.head.append(style);
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
      title: 'Assign Trailer',
      settings: [
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
      ]
    });

    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector(
      '.settings-tab-body'
    );

    if (
      !body ||
      document.getElementById('nilspe-at-modern')
    ) {
      return;
    }

    injectSettingsStyles();

    const root = document.createElement('section');
    root.id = 'nilspe-at-modern';

    const heading = document.createElement('h2');
    heading.textContent = 'Anhänger und Zugfahrzeuge';

    const description = document.createElement('p');

    description.textContent =
      'Pro Anhängertyp einen Zugfahrzeugtyp wählen. ' +
      'Nur aktivierte Zuordnungen werden verarbeitet. ' +
      'Beim Abwählen bleibt das Zugfahrzeug gespeichert.';

    description.style.fontSize = '12px';

    root.append(heading, description);

    const states = new Map();
    const saveQueues = new Map();

    for (const config of TRAILER_CONFIG) {
      const towType = await selectedTowTypeId(
        config
      );

      states.set(config.key, {
        towType,
        enabled: await isEnabled(
          config,
          towType
        )
      });
    }

    function queueSave(key, action) {
      const previous =
        saveQueues.get(key) ||
        Promise.resolve();

      const next = previous
        .catch(() => {})
        .then(action);

      saveQueues.set(key, next);

      void next.catch(error => {
        console.error(
          PREFIX,
          'Speichern fehlgeschlagen:',
          key,
          error
        );
      });
    }

    const categories = [
      'Feuerwehr',
      'SEG',
      'Bereitschaftspolizei',
      'THW',
      'Wasserrettung',
      'Bergrettung'
    ];

    for (const category of categories) {
      const configs = TRAILER_CONFIG.filter(
        config => config.category === category
      );

      if (!configs.length) continue;

      const details = document.createElement(
        'details'
      );

      details.className = 'nilspe-at-category';

      const summary = document.createElement(
        'summary'
      );

      summary.textContent = category;

      const content = document.createElement(
        'div'
      );

      content.className = 'nilspe-at-category-body';

      const toolbar = document.createElement(
        'div'
      );

      toolbar.className = 'nilspe-at-toolbar';

      const count = document.createElement(
        'span'
      );

      count.className = 'nilspe-at-count';

      const rows = [];

      function render() {
        for (const item of rows) {
          const state = states.get(
            item.config.key
          );

          const active =
            state.enabled &&
            state.towType !== null;

          item.row.classList.toggle(
            'active',
            active
          );

          item.select.value =
            state.towType === null
              ? '0'
              : String(state.towType);

          item.toggle.className =
            'btn btn-xs nilspe-at-setting-toggle ' +
            (
              state.enabled
                ? 'btn-danger'
                : 'btn-success'
            );

          item.toggle.textContent =
            state.enabled ? '✕' : '✓';

          item.toggle.title =
            state.enabled
              ? 'Anhänger abwählen'
              : 'Anhänger auswählen';
        }

        const active = configs.filter(config => {
          const state = states.get(config.key);

          return (
            state.enabled &&
            state.towType !== null
          );
        }).length;

        count.textContent =
          `${active} von ${configs.length} konfiguriert`;
      }

      function setAll(enabled) {
        for (const config of configs) {
          const state = states.get(config.key);

          state.enabled = enabled;

          queueSave(
            config.key,
            () => saveEnabled(config, enabled)
          );
        }

        render();
      }

      function bulkButton(
        label,
        color,
        enabled
      ) {
        const button = document.createElement(
          'button'
        );

        button.type = 'button';

        button.className =
          `btn btn-xs ${color} nilspe-at-bulk`;

        button.textContent = label;

        button.addEventListener(
          'click',
          () => setAll(enabled)
        );

        return button;
      }

      toolbar.append(
        bulkButton(
          'Alle auswählen',
          'btn-success',
          true
        ),
        bulkButton(
          'Alle abwählen',
          'btn-danger',
          false
        ),
        count
      );

      const list = document.createElement('div');

      for (const config of configs) {
        const state = states.get(config.key);

        const row = document.createElement(
          'div'
        );

        row.className = 'nilspe-at-setting-row';

        const select = document.createElement(
          'select'
        );

        select.className =
          'form-control input-sm nilspe-at-tow-select';

        const empty = document.createElement(
          'option'
        );

        empty.value = '0';
        empty.textContent = 'Kein Zugfahrzeug';

        select.append(empty);

        for (const vehicle of config.towVehicles) {
          const option = document.createElement(
            'option'
          );

          option.value = String(vehicle.id);

          option.textContent =
            `${vehicle.name} (${vehicle.id})`;

          select.append(option);
        }

        const name = document.createElement(
          'span'
        );

        name.className = 'nilspe-at-setting-name';

        name.textContent =
          `${config.trailerName} (${config.trailerTypeId})`;

        const toggle = document.createElement(
          'button'
        );

        toggle.type = 'button';

        toggle.className =
          'btn btn-xs nilspe-at-setting-toggle';

        select.addEventListener('change', () => {
          const selected = Number(
            select.value
          );

          state.towType =
            selected > 0
              ? selected
              : null;

          queueSave(
            config.key,
            () => saveTowType(
              config,
              selected
            )
          );

          render();
        });

        function toggleSelection() {
          state.enabled = !state.enabled;

          const enabled = state.enabled;

          queueSave(
            config.key,
            () => saveEnabled(
              config,
              enabled
            )
          );

          render();
        }

        toggle.addEventListener(
          'click',
          toggleSelection
        );

        name.addEventListener(
          'click',
          toggleSelection
        );

        rows.push({
          config,
          row,
          select,
          toggle
        });

        row.append(
          select,
          name,
          toggle
        );

        list.append(row);
      }

      content.append(toolbar, list);
      details.append(summary, content);
      root.append(details);

      render();
    }

    body.prepend(root);

    console.log(
      PREFIX,
      VERSION,
      'Einstellungen geladen:',
      TRAILER_CONFIG.length,
      'Zuordnungen'
    );
  }

  /*
   * ==========================================
   * KONFIGURIERTE ZUORDNUNGEN LADEN
   * ==========================================
   */

  async function loadMappings() {
    const mappings = [];

    for (const config of TRAILER_CONFIG) {
      const towTypeId = await selectedTowTypeId(
        config
      );

      if (towTypeId === null) continue;

      if (!await isEnabled(config, towTypeId)) {
        continue;
      }

      const towConfig = config.towVehicles.find(
        vehicle => vehicle.id === towTypeId
      );

      mappings.push({
        category: config.category,
        buildingTypes: config.buildingTypes,
        trailerTypeId: config.trailerTypeId,
        trailerName: config.trailerName,
        towTypeId,
        towName:
          towConfig?.name ||
          `Typ ${towTypeId}`
      });
    }

    return mappings;
  }

  async function configuration() {
    return {
      mappings: await loadMappings(),

      checkDelay: Math.max(
        0,
        Number(
          await GM.getValue(
            KEYS.checkDelay,
            100
          )
        ) || 0
      ),

      requestDelay: Math.max(
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

  /*
   * ==========================================
   * ANHÄNGER-ID + WACHENTYP
   * ==========================================
   *
   * Trennt z.B. MZB bei Feuerwehr,
   * SEG und Wasserrettung.
   */

  function mappingKey(
    trailerTypeId,
    buildingTypeId
  ) {
    return `${trailerTypeId}:${buildingTypeId}`;
  }

  function makeMappingIndex(mappings) {
    const index = new Map();

    for (const mapping of mappings) {
      for (const buildingType of mapping.buildingTypes) {
        const key = mappingKey(
          mapping.trailerTypeId,
          buildingType
        );

        if (index.has(key)) {
          console.warn(
            PREFIX,
            'Doppelte Anhängerzuordnung:',
            key
          );
          continue;
        }

        index.set(key, mapping);
      }
    }

    return index;
  }

  /*
   * ==========================================
   * LEITSTELLE / FAHRZEUGE
   * ==========================================
   */

  function vehicleTable() {
    return document.getElementById(
      'vehicle_table'
    );
  }

  function currentDispatchCenterId() {
    const match = location.pathname.match(
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

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      const buildings = await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        Number(dispatchCenterId)
      );

      const map = new Map();

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
    const table = vehicleTable();

    if (!table) return [];

    const vehicles = [];

    for (const row of table.querySelectorAll(
      'tbody tr'
    )) {
      const vehicleLink = row.querySelector(
        'td:nth-child(2) a[href*="/vehicles/"]'
      );

      const match = vehicleLink
        ?.getAttribute('href')
        ?.match(/\/vehicles\/(\d+)/);

      if (!match) continue;

      const id = Number(match[1]);

      const image = row.querySelector(
        'img.vehicle_image_reload'
      );

      const typeAttribute = image?.getAttribute(
        'vehicle_type_id'
      );

      if (typeAttribute == null) continue;

      const typeId = Number(typeAttribute);

      if (!Number.isInteger(typeId)) continue;

      const buildingLink = row.querySelector(
        'a[href^="/buildings/"]'
      );

      const buildingMatch = buildingLink
        ?.getAttribute('href')
        ?.match(/\/buildings\/(\d+)/);

      const buildingId = buildingMatch
        ? Number(buildingMatch[1])
        : null;

      const buildingType =
        buildingId !== null
          ? buildingTypeMap.get(buildingId)
          : null;

      vehicles.push({
        row,
        id,
        typeId,
        buildingId,
        buildingType,
        name:
          vehicleLink?.textContent?.trim() ||
          `Fahrzeug ${id}`
      });
    }

    return vehicles;
  }

  /*
   * ==========================================
   * AKTUELLE ANHÄNGERZUWEISUNG
   * ==========================================
   */

  async function fetchTrailerAssignment(
    trailerId
  ) {
    const response = await fetch(
      `/vehicles/${trailerId}/edit`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const doc = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );

    const select = doc.querySelector(
      'select[name="vehicle[tractive_vehicle_id]"]'
    );

    const randomInput = doc.querySelector(
      'input[name="vehicle[tractive_random]"]'
    );

    const random = !!randomInput?.checked;

    let towVehicleId = Number(select?.value);

    if (
      !Number.isInteger(towVehicleId) ||
      towVehicleId <= 0
    ) {
      towVehicleId = Number(
        select?.querySelector(
          'option:checked'
        )?.value
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
      assigned: towVehicleId !== null,
      towVehicleId
    };
  }

  /*
   * ==========================================
   * ANHÄNGER ZUWEISEN
   * ==========================================
   */

  function csrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ?? '';
  }

  async function assignTrailer(
    trailerId,
    towVehicleId
  ) {
    const token = csrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token wurde nicht gefunden.'
      );
    }

    const response = await fetch(
      `/vehicles/${trailerId}`,
      {
        method: 'POST',
        credentials: 'same-origin',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',

          'X-CSRF-Token': token,

          'X-Requested-With':
            'XMLHttpRequest'
        },

        body: new URLSearchParams({
          _method: 'put',
          authenticity_token: token,
          'vehicle[tractive_random]': '0',
          'vehicle[tractive_vehicle_id]':
            String(towVehicleId)
        }),

        redirect: 'follow'
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }
  }

  /*
   * ==========================================
   * INTERNE PRÜFUNG
   * ==========================================
   *
   * Diese Prüfung wird bei jedem Klick
   * auf "Anhänger zuweisen" ausgeführt.
   *
   * Bereits korrekt zugewiesene Anhänger
   * werden später übersprungen.
   */

  async function inspectTrailers(
    vehicles,
    mappings,
    checkDelay
  ) {
    const mappingIndex = makeMappingIndex(
      mappings
    );

    const vehicleById = new Map(
      vehicles.map(vehicle => [
        vehicle.id,
        vehicle
      ])
    );

    const trailers = vehicles
      .filter(vehicle =>
        mappingIndex.has(
          mappingKey(
            vehicle.typeId,
            vehicle.buildingType
          )
        )
      )
      .sort((a, b) => a.id - b.id);

    const inspected = [];

    let checked = 0;
    let errors = 0;

    for (const trailer of trailers) {
      if (cancelled) break;

      const mapping = mappingIndex.get(
        mappingKey(
          trailer.typeId,
          trailer.buildingType
        )
      );

      try {
        const state = await fetchTrailerAssignment(
          trailer.id
        );

        const currentTow = state.towVehicleId
          ? vehicleById.get(state.towVehicleId)
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
          PREFIX,
          'Prüfung fehlgeschlagen:',
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
        errors ? 'warning' : 'info'
      );

      if (!cancelled && checkDelay > 0) {
        await sleep(checkDelay);
      }
    }

    return {
      inspected,
      errors
    };
  }

  /*
   * ==========================================
   * PRÜFERGEBNISSE
   * ==========================================
   */

  function inspectionResults(inspected) {
    const towUsers = new Map();

    for (const item of inspected) {
      if (
        item.state.assigned &&
        !item.state.random &&
        item.state.towVehicleId
      ) {
        const ids =
          towUsers.get(item.state.towVehicleId) ??
          [];

        ids.push(item.trailer.id);

        towUsers.set(
          item.state.towVehicleId,
          ids
        );
      }
    }

    return inspected.map(item => {
      const {
        state,
        currentTow,
        mapping,
        trailer
      } = item;

      let message = 'Korrekt';

      if (state.random) {
        message = 'Zufallsfahrzeug aktiv';

      } else if (!state.assigned) {
        message = 'Nicht zugewiesen';

      } else if (!currentTow) {
        message =
          'Zugfahrzeug nicht in sichtbarer Tabelle';

      } else if (
        currentTow.typeId !== mapping.towTypeId
      ) {
        message = 'Falscher Zugfahrzeugtyp';

      } else if (
        currentTow.buildingId !== trailer.buildingId
      ) {
        message = 'Zugfahrzeug falsche Wache';

      } else if (
        (towUsers.get(currentTow.id)?.length ?? 0) > 1
      ) {
        message = 'Zugfahrzeug mehrfach verwendet';
      }

      return {
        item,
        message,
        correct: message === 'Korrekt',
        towUsers
      };
    });
  }

  function showInspectionResults(
    inspected,
    vehicles
  ) {
    const results = inspectionResults(
      inspected
    );

    function setBadge(
      vehicle,
      message,
      correct
    ) {
      const cell = vehicle.row?.cells?.[
        vehicle.row.cells.length - 1
      ];

      if (!cell) return;

      let badge = cell.querySelector(
        '.nilspe-trailer-result'
      );

      if (!badge) {
        badge = document.createElement('span');
        badge.style.marginLeft = '6px';
        cell.append(badge);
      }

      badge.className =
        'nilspe-trailer-result label label-' +
        (correct ? 'success' : 'warning');

      badge.textContent = message;
    }

    for (const vehicle of vehicles) {
      vehicle.row?.querySelector(
        '.nilspe-trailer-result'
      )?.remove();
    }

    const towTypes = new Set(
      inspected.map(item => item.mapping.towTypeId)
    );

    const towUsers =
      results[0]?.towUsers ??
      new Map();

    for (const vehicle of vehicles) {
      if (!towTypes.has(vehicle.typeId)) continue;

      const users = towUsers.get(
        vehicle.id
      ) ?? [];

      const faulty = results.some(result =>
        users.includes(
          result.item.trailer.id
        ) &&
        !result.correct
      );

      setBadge(
        vehicle,
        users.length + ' geprüfte Anhänger' +
        (
          faulty
            ? ' – Zuweisung prüfen'
            : ''
        ),
        users.length === 1 && !faulty
      );
    }

    for (const result of results) {
      setBadge(
        result.item.trailer,
        result.message,
        result.correct
      );
    }
  }

  /*
   * ==========================================
   * REPARATURPLAN
   * ==========================================
   *
   * Korrekte Zuordnungen behalten.
   * Nur fehlerhafte Anhänger neu zuweisen.
   */

  function buildRepairPlan(
    inspected,
    vehicles
  ) {
    const reservedTowIds = new Set();

    const keep = [];
    const repair = [];

    /*
     * Phase 1:
     * Bereits korrekte feste Zuweisungen
     * behalten und Zugfahrzeuge reservieren.
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
        currentTow.typeId === mapping.towTypeId &&
        currentTow.buildingId === trailer.buildingId &&
        !reservedTowIds.has(currentTow.id);

      if (correctFixed) {
        reservedTowIds.add(
          currentTow.id
        );

        keep.push(item);

      } else {
        repair.push(item);
      }
    }

    /*
     * Phase 2:
     * Fehlende oder fehlerhafte Zuordnungen
     * mit freien Zugfahrzeugen korrigieren.
     */

    const plan = [];
    const noTowVehicle = [];

    for (const item of repair) {
      const candidates = vehicles
        .filter(vehicle =>
          vehicle.typeId === item.mapping.towTypeId &&
          vehicle.buildingId === item.trailer.buildingId &&
          !reservedTowIds.has(vehicle.id)
        )
        .sort((a, b) => a.id - b.id);

      const towVehicle = candidates[0];

      if (!towVehicle) {
        noTowVehicle.push(item);
        continue;
      }

      reservedTowIds.add(
        towVehicle.id
      );

      let reason = 'nicht zugewiesen';

      if (item.state.random) {
        reason = 'Zufallsfahrzeug aktiv';

      } else if (
        item.state.assigned &&
        item.currentTow?.typeId !==
          item.mapping.towTypeId
      ) {
        reason = 'falscher Zugfahrzeugtyp';

      } else if (
        item.state.assigned &&
        item.currentTow?.buildingId !==
          item.trailer.buildingId
      ) {
        reason = 'Zugfahrzeug falsche Wache';

      } else if (item.state.assigned) {
        reason = 'Zugfahrzeug mehrfach verwendet';
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

  /*
   * ==========================================
   * FORTSCHRITTSANZEIGE
   * ==========================================
   */

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-at-progress'
      )
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-at-style';

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

    document.head.append(style);

    const container = document.createElement(
      'div'
    );

    container.id = 'nilspe-at-progress';

    const row = document.createElement('div');
    row.id = 'nilspe-at-progress-row';

    const cancel = document.createElement(
      'button'
    );

    cancel.type = 'button';
    cancel.className = 'btn btn-default btn-xs';
    cancel.textContent = 'Abbrechen';

    cancel.addEventListener('click', () => {
      cancelled = true;

      setProgress(
        'Abbruch angefordert',
        0,
        0,
        0,
        'danger'
      );
    });

    const status = document.createElement(
      'span'
    );

    status.id = 'nilspe-at-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';

    const track = document.createElement(
      'div'
    );

    track.id = 'nilspe-at-track';

    const success = document.createElement(
      'div'
    );

    success.id = 'nilspe-at-success';

    const errors = document.createElement(
      'div'
    );

    errors.id = 'nilspe-at-errors';

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

    const status = document.getElementById(
      'nilspe-at-status'
    );

    const success = document.getElementById(
      'nilspe-at-success'
    );

    const errorBar = document.getElementById(
      'nilspe-at-errors'
    );

    const safeTotal = Math.max(
      total,
      1
    );

    status.className =
      `label label-${type}`;

    status.textContent = message;

    success.style.width =
      `${Math.max(0, completed - errors) / safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   *
   * Es gibt nur noch einen Modus:
   *
   * "Anhänger zuweisen"
   *
   * Die Prüfung ist weiterhin automatisch
   * Bestandteil jedes Durchlaufs.
   */

  async function run(buttons) {
    if (running) return;

    running = true;
    cancelled = false;

    buttons.forEach(button => {
      button.disabled = true;
    });

    try {
      const config = await configuration();

      if (!config.mappings.length) {
        setProgress(
          'Keine Anhängerzuweisungen ausgewählt',
          0,
          0,
          0,
          'warning'
        );
        return;
      }

      const dispatchCenterId =
        currentDispatchCenterId();

      if (
        !Number.isInteger(dispatchCenterId)
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
       * Alle aktiv konfigurierten Anhänger
       * zunächst vollständig prüfen.
       */

      const {
        inspected,
        errors: checkErrors
      } = await inspectTrailers(
        vehicles,
        config.mappings,
        config.checkDelay
      );

      if (cancelled) {
        setProgress(
          'Abgebrochen',
          0,
          0,
          0,
          'warning'
        );
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

      /*
       * Prüfergebnisse auswerten.
       *
       * Bereits korrekte Verbindungen
       * kommen in "keep".
       *
       * Nur fehlerhafte Verbindungen
       * kommen in den Reparaturplan.
       */

      const {
        keep,
        plan,
        noTowVehicle
      } = buildRepairPlan(
        inspected,
        vehicles
      );

      showInspectionResults(
        inspected,
        vehicles
      );

      /*
       * Sicherheitsregel:
       * Bei unvollständiger Prüfung
       * werden keinerlei Änderungen
       * ausgeführt.
       */

      if (checkErrors) {
        setProgress(
          `Keine Änderungen: Prüfung unvollständig ` +
          `(${checkErrors} Fehler).`,
          inspected.length,
          checkErrors,
          inspected.length,
          'warning'
        );
        return;
      }

      /*
       * Alles bereits korrekt:
       * Kein einziger Schreibzugriff.
       */

      if (!plan.length) {
        setProgress(
          noTowVehicle.length
            ? `${keep.length} korrekt, ` +
              `${noTowVehicle.length} ohne freies Zugfahrzeug`
            : `Alles korrekt: ${keep.length} feste Zuweisungen`,
          inspected.length,
          0,
          inspected.length,
          noTowVehicle.length
            ? 'warning'
            : 'success'
        );
        return;
      }

      let completed = 0;
      let errors = checkErrors;
      let changed = 0;

      setProgress(
        `0/${plan.length} Zuweisungen werden korrigiert`,
        0,
        0,
        plan.length
      );

      /*
       * Nur Einträge im Reparaturplan
       * werden tatsächlich geändert.
       *
       * Alle Zuweisungen sequenziell.
       */

      for (const assignment of plan) {
        if (cancelled) break;

        const {
          trailer,
          towVehicle,
          mapping,
          reason
        } = assignment;

        setProgress(
          `${completed}/${plan.length}: ` +
          `${mapping.trailerName} → ${mapping.towName} ` +
          `(${reason})`,
          completed,
          errors - checkErrors,
          plan.length
        );

        try {
          await assignTrailer(
            trailer.id,
            towVehicle.id
          );

          changed++;

          assignment.state = {
            assigned: true,
            random: false,
            towVehicleId: towVehicle.id
          };

          assignment.currentTow =
            towVehicle;

          const original = inspected.find(
            item =>
              item.trailer.id === trailer.id
          );

          if (original) {
            original.state =
              assignment.state;

            original.currentTow =
              towVehicle;
          }

          showInspectionResults(
            inspected,
            vehicles
          );

          console.log(
            PREFIX,
            'Korrigiert:',
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
            PREFIX,
            'Zuweisung fehlgeschlagen:',
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
          !cancelled &&
          config.requestDelay > 0
        ) {
          await sleep(
            config.requestDelay
          );
        }
      }

      if (cancelled) {
        setProgress(
          'Abgebrochen',
          completed,
          errors - checkErrors,
          plan.length,
          'warning'
        );
        return;
      }

      setProgress(
        `Fertig: ${keep.length} bereits korrekt, ` +
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
        PREFIX,
        'Lauf fehlgeschlagen:',
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

      buttons.forEach(button => {
        button.disabled = false;
      });
    }
  }

  /*
   * ==========================================
   * BUTTONS
   * ==========================================
   *
   * v2.8.1:
   * Nur noch "Anhänger zuweisen"
   * und das Einstellungszahnrad.
   */

  function settingsButton() {
    const button = document.createElement('a');

    button.className =
      'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    const icon = document.createElement(
      'span'
    );

    icon.className =
      'glyphicon glyphicon-cog';

    button.append(icon);

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

    const table = vehicleTable();

    if (!activeVehicleTab || !table) {
      return;
    }

    const group = document.createElement(
      'div'
    );

    group.id = 'nilspe-at-buttons';
    group.className = 'btn-group';

    const assignButton = document.createElement(
      'button'
    );

    assignButton.type = 'button';

    assignButton.className =
      'btn btn-default btn-xs';

    assignButton.textContent =
      'Anhänger zuweisen';

    const buttons = [assignButton];

    assignButton.addEventListener(
      'click',
      () => {
        void run(buttons);
      }
    );

    group.append(
      assignButton,
      settingsButton()
    );

    const row = document.createElement(
      'div'
    );

    row.id = 'nilspe-at-button-row';

    row.style.cssText =
      'display:block;width:100%;margin:0';

    row.append(group);

    table.parentElement?.insertBefore(
      row,
      table
    );
  }

  /*
   * ==========================================
   * START
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

  const buttonInterval = setInterval(
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

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );

})();
