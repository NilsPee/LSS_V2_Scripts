
// ==UserScript==
// @name         Leitstelle Assign Personal
// @namespace    NilsPe.assign.personal
// @version      2.4.1
// @description  Personal zuweisen oder entfernen mit einheitlicher Fahrzeugauswahl
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Personal.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Personal.user.js
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

  const PREFIX = '[Leitstelle Assign Personal]';
  const VERSION = '2.4.1';

  const SETTINGS_IDENTIFIER = 'nilspe_assign_personal';
  const TARGET_PREFIX = 'nilspe_assign_personal_target_';
  const ZERO_PREFIX = 'nilspe_assign_personal_explicit_zero_';
  const ENABLED_PREFIX = 'nilspe_assign_personal_enabled_';

  const KEYS = {
    personDelay: 'nilspe_assign_personal_person_delay',
    vehicleDelay: 'nilspe_assign_personal_vehicle_delay',
    skipSatisfied: 'nilspe_assign_personal_skip_satisfied'
  };

  /*
   * ==========================================
   * GEBÄUDETYPEN MIT FAHRZEUGEN
   * ==========================================
   */

  const BUILDING_TYPES = [
    [0, 'Feuerwache'],
    [2, 'Rettungswache'],
    [5, 'Rettungshubschrauber-Station'],
    [6, 'Polizeiwache'],
    [9, 'THW-Ortsverband'],
    [11, 'Bereitschaftspolizei'],
    [12, 'Schnelleinsatzgruppe (SEG)'],
    [13, 'Polizeihubschrauberstation'],
    [15, 'Wasserrettung'],
    [17, 'Polizei-Sondereinheiten'],
    [18, 'Feuerwache (Kleinwache)'],
    [19, 'Polizeiwache (Kleinwache)'],
    [20, 'Rettungswache (Kleinwache)'],
    [21, 'Rettungshundestaffel'],
    [24, 'Reiterstaffel'],
    [25, 'Bergrettung'],
    [26, 'Seenotrettungswache'],
    [28, 'Hubschrauberstation (Seenotrettung)'],
    [29, 'Autobahnpolizei']
  ];

  /*
   * ==========================================
   * FAHRZEUGLISTEN
   * ==========================================
   *
   * Grundlage ist Autobuy Vehicles v1.6.4.
   *
   * Besatzungslose Fahrzeuge werden weiter
   * unten zentral herausgefiltert.
   */

  const KNOWN_VEHICLES = new Map([
    [0, [
      [0, 'LF 20'], [1, 'LF 10'],
      [2, 'DLK 23'], [3, 'ELW 1'],
      [4, 'RW'], [5, 'GW-A'],
      [6, 'LF 8/6'], [7, 'LF 20/16'],
      [8, 'LF 10/6'], [9, 'LF 16-TS'],
      [10, 'GW-Öl'], [11, 'GW-L2-Wasser'],
      [12, 'GW-Messtechnik'],
      [13, 'SW 1000'], [14, 'SW 2000'],
      [15, 'SW 2000-Tr'], [16, 'SW Kats'],
      [17, 'TLF 2000'], [18, 'TLF 3000'],
      [19, 'TLF 8/8'], [20, 'TLF 8/18'],
      [21, 'TLF 16/24-Tr'], [22, 'TLF 16/25'],
      [23, 'TLF 16/45'], [24, 'TLF 20/40'],
      [25, 'TLF 20/40-SL'], [26, 'TLF 16'],
      [27, 'GW-Gefahrgut'],
      [30, 'HLF 20'],
      [33, 'GW-Höhenrettung'],
      [34, 'ELW 2'], [36, 'MTW'],
      [37, 'TSF-W'], [46, 'WLF'],
      [47, 'AB-Rüst'], [48, 'AB-Atemschutz'],
      [49, 'AB-Öl'], [53, 'Dekon-P'],
      [54, 'AB-Dekon-P'], [57, 'FwK'],
      [62, 'AB-Schlauch'],
      [63, 'GW-Taucher'],
      [64, 'GW-Wasserrettung'],
      [70, 'MZB'], [71, 'AB-MZB'],
      [73, 'GRTW'], [75, 'FLF'],
      [76, 'Rettungstreppe'],
      [77, 'AB-Gefahrgut'],
      [78, 'AB-Einsatzleitung'],
      [83, 'GW-Werkfeuerwehr'],
      [84, 'ULF mit Löscharm'],
      [85, 'TM 50'], [86, 'Turbolöscher'],
      [87, 'TLF 4000'], [88, 'KLF'],
      [89, 'MLF'], [90, 'HLF 10'],
      [104, 'GW-L1'], [105, 'GW-L2'],
      [106, 'MTF-L'], [107, 'LF-L'],
      [108, 'AB-L'],
      [111, 'NEA50 (FW)'],
      [113, 'NEA200 (FW)'],
      [114, 'GW-Lüfter'],
      [115, 'Anh Lüfter'],
      [116, 'AB-Lüfter'],
      [117, 'AB-Tank'],
      [118, 'Kleintankwagen'],
      [119, 'AB-Lösch'],
      [120, 'Tankwagen'],
      [121, 'GTLF'],
      [126, 'MTF Drohne'],
      [128, 'ELW 1 Drohne'],
      [129, 'ELW 2 Drohne'],
      [138, 'GW-Verpflegung'],
      [139, 'GW-Küche'],
      [140, 'MTW-Verpflegung'],
      [141, 'FKH'],
      [142, 'AB-Küche'],
      [143, 'Anh Schlauch'],
      [162, 'RW Schiene'],
      [163, 'HLF Schiene'],
      [164, 'AB Schiene'],
      [166, 'PTLF 4000'],
      [167, 'SLF'],
      [168, 'Anh Sonderlöschmittel'],
      [169, 'AB-Sonderlöschmittel'],
      [170, 'AB-Wasser/Schaum'],
      [179, 'AB-NEA50'],
      [180, 'AB-NEA200'],
      [185, 'GW-Tierrettung'],
      [186, 'Anh Tierrettung']
    ]],

    [2, [
      [28, 'RTW'], [29, 'NEF'],
      [38, 'KTW'],
      [55, 'KdoW-LNA'],
      [56, 'KdoW-OrgL'],
      [73, 'GRTW'],
      [74, 'NAW'],
      [97, 'ITW']
    ]],

    [5, [
      [31, 'RTH'],
      [157, 'RTH Winde']
    ]],

    [6, [
      [32, 'FuStW'],
      [52, 'GefKw'],
      [94, 'DhuFüKw'],
      [95, 'Polizeimotorrad'],
      [98, 'Zivilstreifenwagen'],
      [103, 'FuStW (DGL)']
    ]],

    [9, [
      [39, 'GKW'],
      [40, 'MTW-TZ'],
      [41, 'MzGW (FGr N)'],
      [42, 'LKW K 9'],
      [43, 'BrmG R'],
      [44, 'Anh DLE'],
      [45, 'MLW 5'],
      [65, 'LKW 7 Lkr 19 tm'],
      [66, 'Anh MzB'],
      [67, 'Anh SchlB'],
      [68, 'Anh MzAB'],
      [69, 'Tauchkraftwagen'],
      [92, 'Anh Hund'],
      [93, 'MTW-O'],
      [100, 'MLW 4'],
      [101, 'Anh SwPu'],
      [102, 'Anh 7'],
      [109, 'MzGW SB'],
      [110, 'NEA50 (THW)'],
      [112, 'NEA200 (THW)'],
      [122, 'LKW 7 Lbw (FGr E)'],
      [123, 'LKW 7 Lbw (FGr WP)'],
      [124, 'MTW-OV'],
      [125, 'MTW-TR UL (Drohne)'],
      [144, 'FüKW (THW)'],
      [145, 'FüKomKW'],
      [146, 'Anh FüLa'],
      [147, 'FmKW'],
      [148, 'MTW-FGr K'],
      [176, 'LKW 7 Lbw (FGr Log-V)'],
      [177, 'MTW-FGr Log-V'],
      [178, 'Anh 12 Lbw (FGr Log-V)'],
      [181, 'MzGW (FGr BrB)'],
      [182, 'Mobilkran'],
      [183, 'Anh Plattform (FGr BrB)']
    ]],

    [11, [
      [35, 'leBefKw'],
      [50, 'GruKw'],
      [51, 'FüKw'],
      [52, 'GefKw'],
      [72, 'WaWe 10'],
      [79, 'SEK-ZF'],
      [80, 'SEK-MTF'],
      [81, 'MEK-ZF'],
      [82, 'MEK-MTF'],
      [94, 'DhuFüKw'],
      [134, 'Pferdetransporter klein'],
      [135, 'Pferdetransporter groß'],
      [136, 'Anh Pferdetransport'],
      [137, 'Zugfahrzeug Pferdetransport'],
      [165, 'LauKW']
    ]],

    [12, [
      [28, 'RTW'],
      [58, 'KTW Typ B'],
      [59, 'ELW 1 (SEG)'],
      [60, 'GW-San'],
      [63, 'GW-Taucher'],
      [64, 'GW-Wasserrettung'],
      [70, 'MZB'],
      [91, 'Rettungshundefahrzeug'],
      [127, 'GW UAS'],
      [130, 'GW-Bt'],
      [131, 'Bt-Kombi'],
      [132, 'FKH'],
      [133, 'Bt LKW'],
      [171, 'GW TeSi'],
      [172, 'LKW Technik (Notstrom)'],
      [173, 'MTW TeSi'],
      [174, 'Anh TeSi'],
      [175, 'NEA 50']
    ]],

    [13, [
      [61, 'Polizeihubschrauber'],
      [96, 'Außenlastbehälter'],
      [156, 'Polizeihubschrauber mit Winde']
    ]],

    [15, [
      [63, 'GW-Taucher'],
      [64, 'GW-Wasserrettung'],
      [70, 'MZB']
    ]],

    [17, [
      [79, 'SEK-ZF'],
      [80, 'SEK-MTF'],
      [81, 'MEK-ZF'],
      [82, 'MEK-MTF']
    ]],

    [21, [
      [91, 'Rettungshundefahrzeug']
    ]],

    [24, [
      [134, 'Pferdetransporter klein'],
      [135, 'Pferdetransporter groß'],
      [136, 'Anh Pferdetransport'],
      [137, 'Zugfahrzeug Pferdetransport']
    ]],

    [25, [
      [149, 'GW-Bergrettung (NEF)'],
      [150, 'GW-Bergrettung'],
      [151, 'ELW Bergrettung'],
      [152, 'ATV'],
      [153, 'Hundestaffel (Bergrettung)'],
      [154, 'Schneefahrzeug'],
      [155, 'Anh Höhenrettung'],
      [158, 'GW-Höhenrettung (Bergrettung)']
    ]],

    [26, [
      [159, 'Seenotrettungskreuzer'],
      [160, 'Seenotrettungsboot']
    ]],

    [28, [
      [161, 'Hubschrauber (Seenotrettung)']
    ]],

    [29, [
      [32, 'FuStW'],
      [184, 'FuStW (AP)']
    ]]
  ]);

  KNOWN_VEHICLES.set(
    18,
    KNOWN_VEHICLES.get(0)
  );

  KNOWN_VEHICLES.set(
    19,
    KNOWN_VEHICLES.get(6)
  );

  KNOWN_VEHICLES.set(
    20,
    KNOWN_VEHICLES.get(2)
  );

  /*
   * ==========================================
   * BESATZUNGSLOSE FAHRZEUGE
   * ==========================================
   *
   * Werden vollständig aus der Auswahl
   * und aus allen Durchläufen entfernt.
   *
   * Dazu gehören:
   * - Abrollbehälter
   * - Anhänger
   * - Außenlastbehälter
   * - Feldküchenanhänger (FKH)
   */

  const UNCREWED_TYPES = new Set([
    44, 47, 48, 49, 54, 62,
    66, 67, 68, 71, 77, 78,
    92, 96, 101, 102, 108,
    115, 116, 117, 119,
    132, 136, 141, 142, 143,
    146, 155, 164, 168,
    169, 170, 174, 178,
    179, 180, 183, 186
  ]);

  /*
   * Nur Fahrzeuge mit eigener Besatzung
   * übernehmen.
   */

  for (const [buildingType, vehicles] of KNOWN_VEHICLES) {
    KNOWN_VEHICLES.set(
      buildingType,
      vehicles.filter(
        ([type]) => !UNCREWED_TYPES.has(type)
      )
    );
  }

  /*
   * ==========================================
   * QUALIFIKATIONEN
   * ==========================================
   */

  const QUALIFICATION_BY_VEHICLE_TYPE = new Map([
    [12, 'gw_messtechnik'],
    [27, 'gw_gefahrgut'],
    [29, 'notarzt'],
    [31, 'notarzt'],
    [33, 'gw_hoehenrettung'],
    [34, 'elw2'],
    [35, 'police_einsatzleiter'],
    [40, 'thw_zugtrupp'],
    [42, 'thw_raumen'],
    [45, 'thw_raumen'],
    [46, 'wechsellader'],
    [51, 'police_fukw'],
    [53, 'dekon_p'],
    [55, 'lna'],
    [56, 'orgl'],
    [57, 'fwk'],
    [59, 'seg_elw'],
    [60, 'seg_gw_san'],
    [61, 'polizeihubschrauber'],
    [63, 'gw_taucher'],
    [64, 'gw_wasserrettung'],
    [69, 'gw_taucher'],
    [72, 'police_wasserwerfer'],
    [74, 'notarzt'],
    [75, 'arff'],
    [76, 'rettungstreppe'],
    [79, 'police_sek'],
    [80, 'police_sek'],
    [81, 'police_mek'],
    [82, 'police_mek'],
    [83, 'werkfeuerwehr'],
    [84, 'werkfeuerwehr'],
    [85, 'werkfeuerwehr'],
    [86, 'werkfeuerwehr'],
    [91, 'seg_rescue_dogs'],
    [93, 'thw_rescue_dogs'],
    [94, 'k9'],
    [95, 'police_motorcycle'],
    [98, 'criminal_investigation'],
    [99, 'water_damage_pump'],
    [100, 'water_damage_pump'],
    [103, 'police_service_group_leader'],
    [109, 'heavy_rescue'],
    [122, 'thw_energy_supply'],
    [123, 'water_damage_pump'],
    [125, 'thw_drone'],
    [126, 'fire_drone'],
    [127, 'seg_drone'],
    [128, 'fire_drone'],
    [131, 'care_service'],
    [133, 'care_service_equipment'],
    [134, 'police_horse'],
    [135, 'police_horse'],
    [137, 'police_horse'],
    [140, 'fire_care_service'],
    [144, 'thw_command'],
    [145, 'thw_command'],
    [147, 'thw_command'],
    [148, 'thw_command'],
    [149, 'notarzt'],
    [151, 'mountain_command'],
    [153, 'seg_rescue_dogs'],
    [158, 'mountain_height_rescue'],
    [162, 'railway_fire'],
    [163, 'railway_fire'],
    [164, 'railway_fire'],
    [165, 'police_speaker_operator'],
    [171, 'disaster_response_technology'],
    [172, 'disaster_response_technology'],
    [173, 'disaster_response_technology'],
    [175, 'disaster_response_technology'],
    [97, 'notarzt'],
    [129, 'fire_drone'],
    [156, 'polizeihubschrauber'],
    [157, 'notarzt']
  ]);

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  let running = false;
  let cancelled = false;

  /*
   * ==========================================
   * SOLLWERTE
   * ==========================================
   */

  async function getTarget(type) {
    const value = Number(
      await GM.getValue(
        TARGET_PREFIX + type,
        0
      )
    );

    if (
      Number.isFinite(value) &&
      value > 0
    ) {
      return Math.trunc(value);
    }

    const explicitZero = await GM.getValue(
      ZERO_PREFIX + type,
      false
    );

    return explicitZero === true
      ? 0
      : null;
  }

  async function setTarget(type, rawValue) {
    const text = String(
      rawValue ?? ''
    ).trim();

    if (text === '') {
      await GM.setValue(
        TARGET_PREFIX + type,
        0
      );

      await GM.setValue(
        ZERO_PREFIX + type,
        false
      );

      return null;
    }

    const number = Number(text);

    if (
      !Number.isInteger(number) ||
      number < 0 ||
      number > 50
    ) {
      throw new Error(
        'Sollwert muss zwischen 0 und 50 liegen'
      );
    }

    await GM.setValue(
      TARGET_PREFIX + type,
      number
    );

    await GM.setValue(
      ZERO_PREFIX + type,
      number === 0
    );

    return number;
  }

  /*
   * ==========================================
   * AKTIVIERUNGSSTATUS
   * ==========================================
   */

  async function getEnabled(
    type,
    target = undefined
  ) {
    const saved = await GM.getValue(
      ENABLED_PREFIX + type,
      null
    );

    if (saved !== null) {
      return saved === true ||
        saved === 'true';
    }

    const configuredTarget =
      target === undefined
        ? await getTarget(type)
        : target;

    return configuredTarget !== null;
  }

  async function setEnabled(type, enabled) {
    await GM.setValue(
      ENABLED_PREFIX + type,
      Boolean(enabled)
    );
  }

  /*
   * ==========================================
   * DOM-HILFSFUNKTION
   * ==========================================
   */

  function createElement(
    tag,
    className = '',
    text = ''
  ) {
    const element =
      document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  /*
   * ==========================================
   * EINSTELLUNGSSTYLES
   * ==========================================
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-assign-settings-styles'
      )
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id =
      'nilspe-assign-settings-styles';

    style.textContent = `
      #nilspe-assign-targets {
        margin-bottom: 24px;
      }

      .nilspe-ap-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      .nilspe-ap-group > summary {
        padding: 9px 12px;
        cursor: pointer;
        background: #8882;
        font-weight: bold;
      }

      .nilspe-ap-group-content {
        padding: 10px;
      }

      .nilspe-ap-toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      .nilspe-ap-bulk {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
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

      .nilspe-ap-vehicle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        margin-bottom: 3px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      .nilspe-ap-vehicle.active {
        background: rgba(92, 184, 92, .10);
        border-color: rgba(92, 184, 92, .35);
      }

      /*
       * NEU:
       * Sollwert steht ganz links.
       */

      .nilspe-ap-target {
        order: 0;
        flex: 0 0 76px;
        box-sizing: border-box;
        width: 76px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        text-align: left;
      }

      .nilspe-ap-name {
        order: 1;
        flex: 1;
        min-width: 130px;
        cursor: pointer;
      }

      .nilspe-ap-vehicle:not(.active)
      .nilspe-ap-name {
        opacity: .6;
      }

      .nilspe-ap-toggle {
        order: 2;
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

      .nilspe-ap-count {
        margin-left: auto;
        opacity: .7;
        font-size: 12px;
      }
    `;

    document.head.append(style);
  }

  /*
   * ==========================================
   * EINSTELLUNGEN
   * ==========================================
   */

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(
        PREFIX,
        'NilsPe-Skriptbasis nicht verfügbar'
      );
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Assign Personal',
      settings: [
        {
          type: 'header',
          text: 'Ablauf'
        },
        {
          type: 'number',
          key: KEYS.personDelay,
          label: 'Pause nach einer Person [ms]',
          min: 0,
          max: 5000,
          default: 100
        },
        {
          type: 'number',
          key: KEYS.vehicleDelay,
          label: 'Pause nach einem Fahrzeug [ms]',
          min: 0,
          max: 5000,
          default: 100
        },
        {
          type: 'checkbox',
          key: KEYS.skipSatisfied,
          label: 'Fahrzeuge mit erreichter Zielbesatzung überspringen',
          default: true
        }
      ]
    });

    const panel = document.getElementById(
      SETTINGS_IDENTIFIER
    );

    const body = panel?.querySelector(
      '.settings-tab-body'
    );

    if (
      !body ||
      document.getElementById(
        'nilspe-assign-targets'
      )
    ) {
      return;
    }

    injectSettingsStyles();

    const section =
      createElement('section');

    section.id = 'nilspe-assign-targets';

    const heading = createElement(
      'h2',
      '',
      'Ziel-Besatzung je Fahrzeugtyp'
    );

    const info = createElement('p');

    info.textContent =
      'Leer = keine Zielvorgabe | ' +
      '0 = gesamtes Personal entfernen | ' +
      '1–50 = gewünschte Besatzung. ' +
      'Nur aktivierte Fahrzeugtypen werden bearbeitet.';

    info.style.fontSize = '12px';
    info.style.marginBottom = '12px';

    section.append(heading, info);

    /*
     * Gemeinsame Einstellungen für Fahrzeugtypen,
     * die an mehreren Wachen vorkommen.
     */

    const views = new Map();
    const states = new Map();
    const saveQueues = new Map();
    const allTypes = new Set();
    const groupRefreshers = [];

    for (const vehicles of KNOWN_VEHICLES.values()) {
      for (const [type] of vehicles) {
        allTypes.add(type);
      }
    }

    for (const type of allTypes) {
      const target = await getTarget(type);

      states.set(type, {
        target,
        enabled: await getEnabled(
          type,
          target
        )
      });
    }

    function queueSave(type, action) {
      const previous =
        saveQueues.get(type) ||
        Promise.resolve();

      const next = previous
        .catch(() => {})
        .then(action);

      saveQueues.set(type, next);

      void next.catch(error => {
        console.error(
          PREFIX,
          'Speichern fehlgeschlagen:',
          type,
          error
        );
      });
    }

    function renderType(type) {
      const state = states.get(type);

      if (!state) return;

      for (const view of views.get(type) || []) {
        const active =
          state.enabled &&
          state.target !== null;

        view.row.classList.toggle(
          'active',
          active
        );

        view.input.value =
          state.target === null
            ? ''
            : String(state.target);

        view.toggle.className =
          'btn btn-xs nilspe-ap-toggle ' +
          (
            state.enabled
              ? 'btn-danger'
              : 'btn-success'
          );

        view.toggle.textContent =
          state.enabled ? '✕' : '✓';

        view.toggle.title =
          state.enabled
            ? 'Fahrzeugtyp abwählen'
            : 'Fahrzeugtyp auswählen';
      }
    }

    function refreshAll() {
      for (const type of allTypes) {
        renderType(type);
      }

      for (const refresh of groupRefreshers) {
        refresh();
      }
    }

    /*
     * Gebäudebereiche erzeugen.
     */

    for (
      const [buildingType, buildingName]
      of BUILDING_TYPES
    ) {
      const vehicles =
        KNOWN_VEHICLES.get(buildingType) || [];

      if (!vehicles.length) {
        continue;
      }

      const wrapper = createElement(
        'details',
        'nilspe-ap-group'
      );

      const summary = createElement(
        'summary',
        '',
        `${buildingType} ${buildingName}`
      );

      const content = createElement(
        'div',
        'nilspe-ap-group-content'
      );

      const toolbar = createElement(
        'div',
        'nilspe-ap-toolbar'
      );

      const list = createElement('div');

      const count = createElement(
        'span',
        'nilspe-ap-count'
      );

      function updateCount() {
        const active = vehicles.filter(
          ([type]) => {
            const state = states.get(type);

            return (
              state?.enabled &&
              state.target !== null
            );
          }
        ).length;

        count.textContent =
          `${active} von ${vehicles.length} ausgewählt`;
      }

      groupRefreshers.push(updateCount);

      /*
       * Alle auswählen / abwählen.
       */

      function bulkButton(
        text,
        color,
        enabled
      ) {
        const button = createElement(
          'button',
          `btn btn-xs ${color} nilspe-ap-bulk`,
          text
        );

        button.type = 'button';

        button.addEventListener(
          'click',
          () => {
            for (const [type] of vehicles) {
              const state = states.get(type);

              if (!state) continue;

              state.enabled = enabled;

              queueSave(
                type,
                () => setEnabled(
                  type,
                  enabled
                )
              );
            }

            refreshAll();
          }
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

      /*
       * Fahrzeugzeilen.
       *
       * Reihenfolge:
       *
       * [ Sollwert ] [ Fahrzeugname ] [ Auswahl ]
       */

      for (const [type, labelText] of vehicles) {
        const state = states.get(type);

        if (!state) continue;

        const row = createElement(
          'div',
          'nilspe-ap-vehicle'
        );

        /*
         * EINGABEFELD LINKS
         */

        const input = createElement(
          'input',
          'form-control input-sm nilspe-ap-target'
        );

        input.type = 'number';
        input.min = '0';
        input.max = '50';
        input.step = '1';
        input.placeholder = 'Soll';

        input.title =
          'Gewünschte Personalanzahl (0–50)';

        /*
         * FAHRZEUGNAME MITTIG
         */

        const name = createElement(
          'span',
          'nilspe-ap-name',
          `${labelText} (${type})`
        );

        /*
         * AN-/ABWAHL RECHTS
         */

        const toggle = createElement(
          'button',
          'btn btn-xs nilspe-ap-toggle'
        );

        toggle.type = 'button';

        if (!views.has(type)) {
          views.set(type, []);
        }

        views.get(type).push({
          row,
          input,
          toggle
        });

        /*
         * Sollwert speichern.
         */

        async function changeTarget() {
          const raw = input.value.trim();

          if (
            raw !== '' &&
            (
              !Number.isInteger(Number(raw)) ||
              Number(raw) < 0 ||
              Number(raw) > 50
            )
          ) {
            alert(
              'Bitte einen Sollwert zwischen 0 und 50 eingeben.'
            );

            renderType(type);
            return;
          }

          const target =
            raw === ''
              ? null
              : Number(raw);

          state.target = target;

          const explicitSelection =
            await GM.getValue(
              ENABLED_PREFIX + type,
              null
            );

          if (
            target !== null &&
            explicitSelection === null
          ) {
            state.enabled = true;
          }

          queueSave(
            type,
            async () => {
              await setTarget(type, raw);

              if (
                target !== null &&
                explicitSelection === null
              ) {
                await setEnabled(type, true);
              }
            }
          );

          refreshAll();
        }

        input.addEventListener(
          'change',
          () => void changeTarget()
        );

        /*
         * Fahrzeugtyp umschalten.
         */

        function toggleType() {
          state.enabled = !state.enabled;

          const enabled = state.enabled;

          queueSave(
            type,
            () => setEnabled(
              type,
              enabled
            )
          );

          refreshAll();
        }

        toggle.addEventListener(
          'click',
          toggleType
        );

        name.addEventListener(
          'click',
          toggleType
        );

        /*
         * WICHTIG:
         * Eingabefeld zuerst anhängen.
         */

        row.append(
          input,
          name,
          toggle
        );

        list.append(row);
      }

      content.append(toolbar, list);
      wrapper.append(summary, content);
      section.append(wrapper);
    }

    refreshAll();
    body.prepend(section);

    console.log(
      PREFIX,
      'Fahrzeuge mit Besatzung geladen:',
      allTypes.size
    );
  }

  /*
   * ==========================================
   * FORTSCHRITTSANZEIGE
   * ==========================================
   */

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-assign-progress'
      )
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-assign-style';

    style.textContent = `
      #nilspe-assign-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-assign-track {
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-assign-fill {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
    `;

    document.head.append(style);

    const container = createElement('div');
    container.id = 'nilspe-assign-progress';

    const row = createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const cancel = createElement(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancel.type = 'button';

    cancel.addEventListener('click', () => {
      cancelled = true;

      const status = document.getElementById(
        'nilspe-assign-status'
      );

      if (status) {
        status.className = 'label label-danger';
        status.textContent = 'Abbruch angefordert';
      }
    });

    const status = createElement(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id = 'nilspe-assign-status';

    const track = createElement('div');
    track.id = 'nilspe-assign-track';

    const fill = createElement('div');
    fill.id = 'nilspe-assign-fill';

    track.append(fill);
    row.append(cancel, status);

    container.append(row, track);
    document.body.append(container);
  }

  function setProgress(
    message,
    completed,
    total,
    type = 'info'
  ) {
    ensureProgress();

    const status = document.getElementById(
      'nilspe-assign-status'
    );

    const fill = document.getElementById(
      'nilspe-assign-fill'
    );

    status.className = `label label-${type}`;
    status.textContent = message;

    fill.style.width = total > 0
      ? `${Math.min(100, completed / total * 100)}%`
      : '0%';
  }

  /*
   * ==========================================
   * FAHRZEUGE AUS DER TABELLE
   * ==========================================
   */

  function vehicleRows() {
    const table = document.getElementById(
      'vehicle_table'
    );

    return Array.from(
      table?.tBodies?.[0]?.rows ?? []
    );
  }

  function rowVehicleId(row) {
    const link = Array.from(
      row.querySelectorAll(
        'a[href*="/vehicles/"]'
      )
    ).find(element =>
      /\/vehicles\/\d+/.test(
        element.getAttribute('href') ?? ''
      )
    );

    const match = link?.getAttribute('href')
      ?.match(/\/vehicles\/(\d+)/);

    return match ? Number(match[1]) : null;
  }

  function rowVehicleType(row) {
    const element = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );

    const value =
      element?.getAttribute('vehicle_type_id') ??
      element?.getAttribute('data-vehicle-type-id');

    return value == null
      ? NaN
      : Number(value);
  }

  function rowCrew(row) {
    const matches = [
      ...(row.textContent ?? '').matchAll(
        /(\d+)\s*\/\s*(\d+)/g
      )
    ];

    const match = matches.at(-1);

    return match
      ? {
          current: Number(match[1]),
          maximum: Number(match[2])
        }
      : null;
  }

  /*
   * ==========================================
   * KONFIGURATION
   * ==========================================
   */

  async function loadConfiguration(rows) {
    const types = [
      ...new Set(
        rows.map(rowVehicleType)
          .filter(Number.isInteger)
      )
    ];

    const targets = new Map();
    const enabled = new Map();

    for (const type of types) {
      const target = await getTarget(type);

      targets.set(type, target);

      enabled.set(
        type,
        await getEnabled(type, target)
      );
    }

    return {
      targets,
      enabled,

      personDelay: Math.max(
        0,
        Number(
          await GM.getValue(
            KEYS.personDelay,
            100
          )
        ) || 0
      ),

      vehicleDelay: Math.max(
        0,
        Number(
          await GM.getValue(
            KEYS.vehicleDelay,
            100
          )
        ) || 0
      ),

      skipSatisfied:
        await GM.getValue(
          KEYS.skipSatisfied,
          true
        ) !== false
    };
  }

  /*
   * ==========================================
   * ZUWEISUNGSSEITE
   * ==========================================
   */

  async function assignmentDocument(vehicleId) {
    const response = await fetch(
      `/vehicles/${vehicleId}/zuweisung`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Zuweisungsseite HTTP ${response.status}`
      );
    }

    return new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
  }

  function rowMatchesQualification(
    row,
    qualification
  ) {
    if (!qualification) {
      const schooling =
        row.children?.[1]?.textContent
          .trim()
          .toLowerCase() ?? '';

      return schooling === '' ||
        schooling === '-';
    }

    return (
      row.dataset.filterableBy ?? ''
    ).includes(qualification);
  }

  function personnelRows(doc, qualification) {
    const rows = Array.from(
      doc.querySelectorAll('tr')
    );

    const assigned = rows.filter(row =>
      row.querySelector('a.btn-assigned') &&
      rowMatchesQualification(
        row,
        qualification
      )
    );

    const available = rows.filter(row => {
      const button = row.querySelector(
        'a.btn-success'
      );

      const course =
        row.children?.[2]?.textContent.trim() ?? '';

      return (
        button &&
        rowMatchesQualification(
          row,
          qualification
        ) &&
        !course.startsWith('Im Unterricht')
      );
    });

    return {
      assigned,
      available
    };
  }

  function allAssignedPersonnel(doc) {
    return Array.from(
      doc.querySelectorAll('tr')
    ).filter(row =>
      row.querySelector('a.btn-assigned')
    );
  }

  function requestHeaders() {
    return {
      'X-CSRF-Token':
        document.querySelector(
          'meta[name="csrf-token"]'
        )?.content ?? '',

      'X-Requested-With': 'XMLHttpRequest'
    };
  }

  async function postPersonnelLink(link) {
    if (!link?.href) {
      throw new Error('Personal-Link fehlt');
    }

    let lastError;

    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {
      try {
        const response = await fetch(
          link.href,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: requestHeaders()
          }
        );

        if (response.ok) {
          return;
        }

        lastError = new Error(
          `HTTP ${response.status}`
        );

        await sleep(
          response.status === 429
            ? 1000
            : 250
        );

      } catch (error) {
        lastError = error;
        await sleep(250);
      }
    }

    throw lastError ??
      new Error('Personalanfrage fehlgeschlagen');
  }

  /*
   * ==========================================
   * FAHRZEUG BEARBEITEN
   * ==========================================
   */

  async function adjustVehicle(
    job,
    configuration,
    phase
  ) {
    const doc = await assignmentDocument(
      job.vehicleId
    );

    const qualification =
      QUALIFICATION_BY_VEHICLE_TYPE.get(
        job.vehicleType
      );

    const personnel = personnelRows(
      doc,
      qualification
    );

    const assigned = job.target === 0
      ? allAssignedPersonnel(doc)
      : personnel.assigned;

    const available = personnel.available;

    let assignedCount = assigned.length;

    if (cancelled) {
      return assignedCount;
    }

    if (
      configuration.skipSatisfied &&
      assignedCount === job.target
    ) {
      return assignedCount;
    }

    /*
     * ENTFERNEN
     */

    if (phase === 'remove') {
      if (assignedCount <= job.target) {
        return assignedCount;
      }

      for (const row of [...assigned].reverse()) {
        if (
          cancelled ||
          assignedCount <= job.target
        ) {
          break;
        }

        const link = row.querySelector(
          'a.btn-assigned'
        );

        if (!link) continue;

        await postPersonnelLink(link);

        assignedCount--;

        console.log(
          PREFIX,
          'Personal entfernt:',
          job.vehicleId,
          `${assignedCount}/${job.target}`
        );

        if (configuration.personDelay > 0) {
          await sleep(configuration.personDelay);
        }
      }

      return assignedCount;
    }

    /*
     * ZUWEISEN
     */

    if (phase === 'assign') {
      if (
        job.target === 0 ||
        assignedCount >= job.target
      ) {
        return assignedCount;
      }

      for (const row of available) {
        if (
          cancelled ||
          assignedCount >= job.target
        ) {
          break;
        }

        const link = row.querySelector(
          'a.btn-success'
        );

        if (!link) continue;

        await postPersonnelLink(link);

        assignedCount++;

        console.log(
          PREFIX,
          'Personal zugewiesen:',
          job.vehicleId,
          `${assignedCount}/${job.target}`
        );

        if (configuration.personDelay > 0) {
          await sleep(configuration.personDelay);
        }
      }

      return assignedCount;
    }

    return assignedCount;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function runAssignment(mode) {
    if (
      running ||
      !['both', 'assign', 'remove'].includes(mode)
    ) {
      return;
    }

    running = true;
    cancelled = false;

    const buttonIds = [
      'nilspe-assign-button',
      'nilspe-assign-only-button',
      'nilspe-remove-only-button'
    ];

    const buttons = buttonIds.map(
      id => document.getElementById(id)
    );

    buttons.forEach(button => {
      if (button) button.disabled = true;
    });

    try {
      const rows = vehicleRows();
      const configuration =
        await loadConfiguration(rows);

      const jobs = rows.map(row => {
        const vehicleType = rowVehicleType(row);

        return {
          row,
          vehicleId: rowVehicleId(row),
          vehicleType,
          crew: rowCrew(row),
          target:
            configuration.targets.get(
              vehicleType
            ) ?? null,
          enabled:
            configuration.enabled.get(
              vehicleType
            ) === true
        };

      }).filter(job =>
        Number.isInteger(job.vehicleId) &&
        Number.isInteger(job.vehicleType) &&
        job.enabled &&
        job.target !== null &&
        Number.isInteger(job.target) &&
        job.target >= 0 &&
        !UNCREWED_TYPES.has(job.vehicleType)
      );

      if (!jobs.length) {
        setProgress(
          'Keine aktivierten Fahrzeuge mit Sollwert gefunden',
          0,
          0,
          'warning'
        );
        return;
      }

      const phases =
        mode === 'both'
          ? [
              {
                id: 'remove',
                label: 'Phase 1/2 – Entfernen'
              },
              {
                id: 'assign',
                label: 'Phase 2/2 – Zuweisen'
              }
            ]
          : [
              {
                id: mode,
                label: mode === 'remove'
                  ? 'Entfernen'
                  : 'Zuweisen'
              }
            ];

      const totalSteps =
        jobs.length * phases.length;

      let completed = 0;
      let errors = 0;
      let shortages = 0;
      let excess = 0;

      const finalResults = new Map();
      const failedVehicles = new Set();

      console.log(
        PREFIX,
        `Version ${VERSION}`,
        'Modus:',
        mode,
        'Fahrzeuge:',
        jobs.length
      );

      for (const phase of phases) {
        if (cancelled) break;

        setProgress(
          phase.label,
          completed,
          totalSteps
        );

        const phaseJobs = jobs.filter(job =>
          !failedVehicles.has(
            job.vehicleId
          )
        );

        await runWithConcurrency(
          phaseJobs,

          async job => {
            try {
              if (cancelled) return;

              const assigned =
                await adjustVehicle(
                  job,
                  configuration,
                  phase.id
                );

              if (cancelled) return;

              const isFinalPhase =
                mode !== 'both' ||
                phase.id === 'assign';

              if (isFinalPhase) {
                finalResults.set(
                  job.vehicleId,
                  assigned
                );

                displayCrewResult(
                  job.row,
                  job.target,
                  assigned
                );
              }

            } catch (error) {
              errors++;

              failedVehicles.add(
                job.vehicleId
              );

              console.error(
                PREFIX,
                'Fahrzeug fehlgeschlagen:',
                job.vehicleId,
                error
              );

            } finally {
              completed++;

              setProgress(
                `${phase.label}: ${completed}/${totalSteps}`,
                completed,
                totalSteps,
                errors
                  ? 'warning'
                  : 'info'
              );
            }
          },

          {
            concurrency: 1,
            delay: configuration.vehicleDelay,
            shouldContinue: () => !cancelled
          }
        );
      }

      if (cancelled) {
        setProgress(
          'Abgebrochen',
          completed,
          totalSteps,
          'warning'
        );
        return;
      }

      for (const job of jobs) {
        if (!finalResults.has(job.vehicleId)) {
          continue;
        }

        const assigned =
          finalResults.get(job.vehicleId);

        if (assigned < job.target) {
          shortages++;
        }

        if (assigned > job.target) {
          excess++;
        }
      }

      const checkedVehicles =
        finalResults.size;

      const statusText =
        mode === 'remove'
          ? 'Entfernen fertig'
          : mode === 'assign'
            ? 'Zuweisen fertig'
            : 'Abgleich fertig';

      setProgress(
        `${statusText}: ${checkedVehicles} Fahrzeuge, ` +
        `${shortages} unter Soll, ` +
        `${excess} über Soll, ` +
        `${errors} Fehler`,
        totalSteps,
        totalSteps,
        errors || shortages || excess
          ? 'warning'
          : 'success'
      );

      console.log(
        PREFIX,
        'Fertig:',
        {
          mode,
          vehicles: checkedVehicles,
          shortages,
          excess,
          errors
        }
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
        'danger'
      );

    } finally {
      running = false;

      buttons.forEach(button => {
        if (button) {
          button.disabled = false;
        }
      });
    }
  }

  /*
   * ==========================================
   * BESATZUNGSERGEBNIS
   * ==========================================
   */

  function displayCrewResult(
    row,
    target,
    actual
  ) {
    const cell = row.cells?.[4];

    if (!cell) return;

    let badge = cell.querySelector(
      '.nilspe-crew-result'
    );

    if (!badge) {
      badge = createElement('span');
      badge.style.marginLeft = '6px';
      cell.append(badge);
    }

    const color =
      actual < target
        ? 'danger'
        : actual === target
          ? 'success'
          : 'warning';

    badge.className =
      `nilspe-crew-result label label-${color}`;

    badge.textContent =
      `Soll: ${target} | Ist: ${actual}`;

    badge.title =
      target === 0
        ? 'Soll 0: Sämtliches Personal entfernen'
        : 'Zugewiesenes Personal mit passender Ausbildung';
  }

  /*
   * ==========================================
   * EINSTELLUNGSBUTTON
   * ==========================================
   */

  function settingsButton() {
    const button = createElement(
      'a',
      'btn btn-default btn-xs'
    );

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    const icon = createElement(
      'span',
      'glyphicon glyphicon-cog'
    );

    button.append(icon);

    return button;
  }

  /*
   * ==========================================
   * DREI MODI
   * ==========================================
   */

  function addButton() {
    const table = document.getElementById(
      'vehicle_table'
    );

    if (
      !table ||
      document.getElementById(
        'nilspe-assign-buttons'
      )
    ) {
      return;
    }

    const group = createElement(
      'div',
      'btn-group'
    );

    group.id = 'nilspe-assign-buttons';

    group.style.cssText =
      'display:flex;width:fit-content;margin:0';

    function modeButton(
      id,
      label,
      mode
    ) {
      const button = createElement(
        'button',
        'btn btn-default btn-xs',
        label
      );

      button.id = id;
      button.type = 'button';

      button.addEventListener(
        'click',
        () => runAssignment(mode)
      );

      return button;
    }

    const both = modeButton(
      'nilspe-assign-button',
      'Entfernen & Zuweisen',
      'both'
    );

    const assign = modeButton(
      'nilspe-assign-only-button',
      'Zuweisen',
      'assign'
    );

    const remove = modeButton(
      'nilspe-remove-only-button',
      'Entfernen',
      'remove'
    );

    group.append(
      both,
      assign,
      remove,
      settingsButton()
    );

    const row = createElement('div');

    row.id = 'nilspe-assign-button-row';

    row.style.cssText =
      'display:flex;width:100%;margin:0;' +
      'padding:0;line-height:0';

    row.append(group);

    table.parentElement?.insertBefore(
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
  }

  console.log(
    PREFIX,
    `Version ${VERSION} geladen`
  );

})();
