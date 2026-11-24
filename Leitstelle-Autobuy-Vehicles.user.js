// ==UserScript==
// @name         Leitstelle Autobuy Vehicles
// @namespace    NilsPe.autobuy.vehicles
// @version      1.6.1
// @description  Kauft konfigurierte Fahrzeuge fuer einzelne Gebaeude oder eine Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Vehicles.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Vehicles.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_autobuy_vehicles';
  const CONFIG_KEY_PREFIX = 'nilspe_abv_config_';
  const DISABLED_KEY_PREFIX = 'nilspe_abv_disabled_';
  const VEHICLE_DELAY_KEY = 'nilspe_abv_vehicle_delay';
  const BUILDING_DELAY_KEY = 'nilspe_abv_building_delay';
  const DEFAULT_VEHICLE_DELAY = 150;
  const DEFAULT_BUILDING_DELAY = 100;
  let running = false;
  let cancelled = false;

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
  ].map(([id, label]) => ({ id, label }));

  const BUILDING_TYPE_BY_ID = new Map(
    BUILDING_TYPES.map(buildingType => [buildingType.id, buildingType])
  );

  const KNOWN_VEHICLES = new Map([
    [0, [
      [0, 'LF 20'], [1, 'LF 10'], [2, 'DLK 23'], [3, 'ELW 1'],
      [4, 'RW'], [5, 'GW-A'], [6, 'LF 8/6'], [7, 'LF 20/16'],
      [8, 'LF 10/6'], [9, 'LF 16-TS'], [10, 'GW-Oel'],
      [11, 'GW-L2-Wasser'], [12, 'GW-Messtechnik'], [13, 'SW 1000'],
      [14, 'SW 2000'], [15, 'SW 2000-Tr'], [16, 'SW Kats'],
      [17, 'TLF 2000'], [18, 'TLF 3000'], [19, 'TLF 8/8'],
      [20, 'TLF 8/18'], [21, 'TLF 16/24-Tr'], [22, 'TLF 16/25'],
      [23, 'TLF 16/45'], [24, 'TLF 20/40'], [25, 'TLF 20/40-SL'],
      [26, 'TLF 16'], [27, 'GW-Gefahrgut'], [30, 'HLF 20'],
      [33, 'GW-Hoehenrettung'], [34, 'ELW 2'], [36, 'MTW'],
      [37, 'TSF-W'], [46, 'WLF'], [47, 'AB-Ruest'],
      [48, 'AB-Atemschutz'], [49, 'AB-Oel'], [53, 'Dekon-P'],
      [54, 'AB-Dekon-P'], [57, 'FwK'], [62, 'AB-Schlauch'],
      [63, 'GW-Taucher'], [64, 'GW-Wasserrettung'], [70, 'MZB'],
      [71, 'AB-MZB'], [73, 'GRTW'], [75, 'FLF'],
      [76, 'Rettungstreppe'], [77, 'AB-Gefahrgut'],
      [78, 'AB-Einsatzleitung'], [83, 'GW-Werkfeuerwehr'],
      [84, 'ULF mit Loescharm'], [85, 'TM 50'], [86, 'Turboloescher'],
      [87, 'TLF 4000'], [88, 'KLF'], [89, 'MLF'], [90, 'HLF 10'],
      [104, 'GW-L1'], [105, 'GW-L2'], [106, 'MTF-L'], [107, 'LF-L'],
      [108, 'AB-L'], [111, 'NEA50 (FW)'], [113, 'NEA200 (FW)'],
      [114, 'GW-Luefter'], [115, 'Anh Luefter'], [116, 'AB-Luefter'],
      [117, 'AB-Tank'], [118, 'Kleintankwagen'], [119, 'AB-Loesch'],
      [120, 'Tankwagen'], [121, 'GTLF'], [126, 'MTF Drohne'],
      [128, 'ELW 1 Drohne'], [129, 'ELW 2 Drohne'],
      [138, 'GW-Verpflegung'], [139, 'GW-Kueche'],
      [140, 'MTW-Verpflegung'], [141, 'FKH'], [142, 'AB-Kueche'],
      [143, 'Anh Schlauch'], [162, 'RW Schiene'], [163, 'HLF Schiene'],
      [164, 'AB Schiene'], [166, 'PTLF 4000'], [167, 'SLF'],
      [168, 'Anh Sonderloeschmittel'], [169, 'AB-Sonderloeschmittel'],
      [170, 'AB-Wasser/Schaum'], [179, 'AB-NEA50'], [180, 'AB-NEA200'],
      [185, 'GW-Tierrettung'], [186, 'Anh Tierrettung']
    ]],
    [18, []],
    [2, [
      [28, 'RTW'], [29, 'NEF'], [38, 'KTW'], [55, 'KdoW-LNA'],
      [56, 'KdoW-OrgL'], [73, 'GRTW'], [74, 'NAW'], [97, 'ITW']
    ]],
    [20, []],
    [6, [
      [32, 'FuStW'], [52, 'GefKw'], [94, 'DhuFueKw'],
      [95, 'Polizeimotorrad'], [98, 'Zivilstreifenwagen'],
      [103, 'FuStW (DGL)']
    ]],
    [19, []],
    [9, [
      [39, 'GKW'], [40, 'MTW-TZ'], [41, 'MzGW (FGr N)'],
      [42, 'LKW K 9'], [43, 'BrmG R'], [44, 'Anh DLE'], [45, 'MLW 5'],
      [65, 'LKW 7 Lkr 19 tm'], [66, 'Anh MzB'], [67, 'Anh SchlB'],
      [68, 'Anh MzAB'], [69, 'Tauchkraftwagen'], [92, 'Anh Hund'],
      [93, 'MTW-O'], [100, 'MLW 4'], [101, 'Anh SwPu'], [102, 'Anh 7'],
      [109, 'MzGW SB'], [110, 'NEA50 (THW)'], [112, 'NEA200 (THW)'],
      [122, 'LKW 7 Lbw (FGr E)'], [123, 'LKW 7 Lbw (FGr WP)'],
      [124, 'MTW-OV'], [125, 'MTW-TR UL (Drohne)'],
      [144, 'FueKW (THW)'], [145, 'FueKomKW'], [146, 'Anh FueLa'],
      [147, 'FmKW'], [148, 'MTW-FGr K'],
      [176, 'LKW 7 Lbw (FGr Log-V)'], [177, 'MTW-FGr Log-V'],
      [178, 'Anh 12 Lbw (FGr Log-V)'], [181, 'MzGW (FGr BrB)'],
      [182, 'Mobilkran'], [183, 'Anh Plattform (FGr BrB)']
    ]],
    [11, [
      [35, 'leBefKw'], [50, 'GruKw'], [51, 'FueKw'], [52, 'GefKw'],
      [72, 'WaWe 10'], [79, 'SEK - ZF'], [80, 'SEK - MTF'],
      [81, 'MEK - ZF'], [82, 'MEK - MTF'], [94, 'DhuFueKw'],
      [134, 'Pferdetransporter klein'], [135, 'Pferdetransporter gross'],
      [136, 'Anh Pferdetransport'], [137, 'Zugfahrzeug Pferdetransport'],
      [165, 'LauKW']
    ]],
    [12, [
      [28, 'RTW'], [58, 'KTW Typ B'], [59, 'ELW 1 (SEG)'],
      [60, 'GW-San'], [63, 'GW-Taucher'], [64, 'GW-Wasserrettung'],
      [70, 'MZB'], [91, 'Rettungshundefahrzeug'],
      [127, 'GW UAS (Drohnenfahrzeug)'], [130, 'GW-Bt'],
      [131, 'Bt-Kombi'], [132, 'FKH'], [133, 'Bt LKW'],
      [171, 'GW TeSi'], [172, 'LKW Technik (Notstrom)'],
      [173, 'MTW TeSi'], [174, 'Anh TeSi'], [175, 'NEA 50']
    ]],
    [13, [[61, 'Polizeihubschrauber'], [96, 'Außenlastbehälter'],
      [156, 'Polizeihubschrauber mit Winde']]],
    [15, [[63, 'GW-Taucher'], [64, 'GW-Wasserrettung'], [70, 'MZB']]],
    [5, [[31, 'RTH'], [157, 'RTH Winde']]],
    [17, [[79, 'SEK - ZF'], [80, 'SEK - MTF'], [81, 'MEK - ZF'], [82, 'MEK - MTF']]],
    [21, [[91, 'Rettungshundefahrzeug']]],
    [24, [[134, 'Pferdetransporter klein'], [135, 'Pferdetransporter groß'],
      [136, 'Anh Pferdetransport'], [137, 'Zugfahrzeug Pferdetransport']]],
    [25, [[149, 'GW-Bergrettung (NEF)'], [150, 'GW-Bergrettung'],
      [151, 'ELW Bergrettung'], [152, 'ATV'],
      [153, 'Hundestaffel (Bergrettung)'], [154, 'Schneefahrzeug'],
      [155, 'Anh Höhenrettung (Bergrettung)'],
      [158, 'GW-Höhenrettung (Bergrettung)']]],
    [26, [[159, 'Seenotrettungskreuzer'], [160, 'Seenotrettungsboot']]],
    [28, [[161, 'Hubschrauber (Seenotrettung)']]],
    [29, [[32, 'FuStW'], [184, 'FuStW (AP)']]]
  ]);

  KNOWN_VEHICLES.set(18, KNOWN_VEHICLES.get(0));
  KNOWN_VEHICLES.set(20, KNOWN_VEHICLES.get(2));
  KNOWN_VEHICLES.set(19, KNOWN_VEHICLES.get(6));

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function configurationKey(buildingType) {
    return `${CONFIG_KEY_PREFIX}${buildingType}`;
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
      leitstelle_building_id:
        dispatchCenterId == null ? null : Number(dispatchCenterId),
      caption: building.caption || building.name || `Gebaeude ${building.id}`
    };
  }

  async function openCurrentDb() {
    if (typeof openDb !== 'function' ||
        typeof updateBuildings !== 'function') {
      throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 0);
      return db;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  function buildingIdFromLocation() {
    const match = location.pathname.match(/^\/buildings\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  }

  function parseConfiguration(value) {
    try {
      const parsed = JSON.parse(value);

      if (!Array.isArray(parsed)) {
        return new Map();
      }

      return new Map(
        parsed
          .filter(entry =>
            Array.isArray(entry) &&
            Number.isInteger(Number(entry[0])) &&
            Number(entry[1]) > 0
          )
          .map(entry => [Number(entry[0]), Number(entry[1])])
      );
    } catch {
      return new Map();
    }
  }

  async function loadConfiguration(buildingType) {
    const configuration = parseConfiguration(
      await GM.getValue(configurationKey(buildingType), '[]')
    );
    const disabled = new Set(JSON.parse(
      await GM.getValue(`${DISABLED_KEY_PREFIX}${buildingType}`, '[]')
    ));
    for (const id of disabled) configuration.delete(Number(id));
    return configuration;
  }

  async function saveConfiguration(buildingType, row) {
    const configuration = [];
    const disabled = [];

    for (const input of row.querySelectorAll('input[data-vehicle-type]')) {
      const vehicleType = Number(input.dataset.vehicleType);
      const count = Number(input.value);
      const enabled = row.querySelector(
        `input[data-enabled-type="${vehicleType}"]`
      )?.checked;

      if (Number.isInteger(vehicleType) &&
          Number.isInteger(count) &&
          count > 0) {
        configuration.push([vehicleType, count]);
        if (!enabled) disabled.push(vehicleType);
      }
    }

    await GM.setValue(
      configurationKey(buildingType),
      JSON.stringify(configuration)
    );
    await GM.setValue(
      `${DISABLED_KEY_PREFIX}${buildingType}`,
      JSON.stringify(disabled)
    );
  }

  async function discoverVehicleOptions() {
    const db = await openCurrentDb();
    let buildings;
    try {
      buildings = await getAllData(db, 'buildings');
    } finally {
      db.close();
    }

    const sampleByType = new Map();
    for (const building of buildings) {
      const type = Number(building.building_type);
      if (BUILDING_TYPE_BY_ID.has(type) && !sampleByType.has(type)) {
        sampleByType.set(type, Number(building.id));
      }
    }

    const discovered = new Map();
    await Promise.all([...sampleByType].map(async ([type, id]) => {
      try {
        const response = await fetch(`/buildings/${id}/vehicles/new`, {
          credentials: 'same-origin', cache: 'no-store'
        });
        if (!response.ok) return;
        const page = new DOMParser().parseFromString(await response.text(), 'text/html');
        const options = new Map();
        for (const link of page.querySelectorAll('section.purchase a[href]')) {
          const path = new URL(link.getAttribute('href'), location.origin).pathname;
          const match = path.match(/\/vehicle\/\d+\/(\d+)\/credits$/);
          if (!match) continue;
          const section = link.closest('section.purchase');
          const name = section?.dataset.vehicleName ||
            section?.closest('.vehicle_type')?.querySelector('b')?.textContent?.trim();
          options.set(Number(match[1]), name || `Fahrzeug ${match[1]}`);
        }
        discovered.set(type, options);
      } catch (error) {
        console.warn('[Autobuy Vehicles] Fahrzeugoptionen nicht geladen:', type, error);
      }
    }));
    return discovered;
  }

  async function createVehicleSettingsSection(panel) {
    const section = document.createElement('div');
    section.style.margin = '15px';
    const heading = document.createElement('h2');
    heading.textContent = 'Fahrzeuge je Gebaeudetyp';
    section.append(heading);
    let discovered = new Map();
    try {
      discovered = await discoverVehicleOptions();
    } catch (error) {
      console.warn('[Autobuy Vehicles] Fahrzeugoptionen aus Cache nicht geladen:', error);
    }

    for (const buildingType of BUILDING_TYPES) {
      const options = new Map(
        (KNOWN_VEHICLES.get(buildingType.id) ?? [])
          .map(([id, name]) => [id, { id, name }])
      );
      for (const [id, name] of discovered.get(buildingType.id) ?? []) {
        options.set(id, { id, name });
      }

      if (options.size === 0) {
        continue;
      }

      const stored = parseConfiguration(
        await GM.getValue(configurationKey(buildingType.id), '[]')
      );
      const disabled = new Set(JSON.parse(
        await GM.getValue(`${DISABLED_KEY_PREFIX}${buildingType.id}`, '[]')
      ));
      const wrapper = document.createElement('details');
      wrapper.className = 'form-group';
      wrapper.style.paddingBottom = '12px';
      wrapper.style.marginBottom = '12px';
      wrapper.style.borderBottom = '1px solid #777';
      const label = document.createElement('summary');
      label.textContent = `${buildingType.id} ${buildingType.label}`;
      const countLabel = document.createElement('span');
      countLabel.className = 'label label-default';
      countLabel.style.marginLeft = '10px';
      label.append(countLabel);
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gap = '4px';
      const toolbar = document.createElement('div');
      toolbar.style.margin = '10px 0';
      toolbar.style.display = 'flex';
      toolbar.style.gap = '5px';
      function updateCount() {
        const active = [...row.querySelectorAll('input[data-enabled-type]')]
          .filter(input => input.checked).length;
        countLabel.textContent = `${active} / ${options.size} ausgewählt`;
        countLabel.className = active ? 'label label-success' : 'label label-default';
      }
      for (const [text, checked, color] of [
        ['Alle auswählen', true, 'btn-success'],
        ['Alle abwählen', false, 'btn-danger']
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn btn-xs ${color}`;
        button.style.width = '78px';
        button.style.paddingLeft = '2px';
        button.style.paddingRight = '2px';
        button.textContent = text;
        button.addEventListener('click', () => {
          for (const input of row.querySelectorAll('input[data-enabled-type]')) {
            input.checked = checked;
            input.dispatchEvent(new Event('change'));
          }
        });
        toolbar.append(button);
      }

      for (const option of [...options.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'de')
      )) {
        const field = document.createElement('div');
        field.style.display = 'grid';
        field.style.gridTemplateColumns = '90px minmax(150px, 1fr) 60px';
        field.style.alignItems = 'center';
        field.style.gap = '12px';
        field.style.padding = '6px 8px';
        field.style.border = '1px solid #8885';
        field.style.borderRadius = '3px';
        field.style.marginBottom = '3px';
        const name = document.createElement('span');
        name.textContent = `${option.name} (${option.id})`;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.className = 'form-control';
        input.style.width = '85px';
        input.dataset.vehicleType = String(option.id);
        input.value = stored.get(option.id) ?? '';
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.style.display = 'none';
        toggle.dataset.enabledType = String(option.id);
        toggle.checked = !disabled.has(option.id);
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.style.width = '32px';
        toggleButton.addEventListener('click', () => {
          toggle.checked = !toggle.checked;
          toggle.dispatchEvent(new Event('change'));
        });
        function updateColor() {
          field.style.background = toggle.checked
            ? 'rgba(92, 184, 92, .10)' : '#8881';
          field.style.borderColor = toggle.checked
            ? 'rgba(92, 184, 92, .35)' : '#8885';
          name.style.opacity = toggle.checked ? '1' : '.6';
          toggleButton.textContent = toggle.checked ? '✕' : '✓';
          toggleButton.className = toggle.checked
            ? 'btn btn-danger btn-xs' : 'btn btn-success btn-xs';
          toggleButton.title = toggle.checked
            ? 'Fahrzeug abwählen' : 'Fahrzeug auswählen';
        }
        input.addEventListener('change', () =>
          saveConfiguration(buildingType.id, row)
        );
        toggle.addEventListener('change', () => {
          updateColor();
          updateCount();
          void saveConfiguration(buildingType.id, row);
        });
        input.addEventListener('input', updateColor);
        name.addEventListener('click', () => toggleButton.click());
        field.append(input, name, toggle, toggleButton);
        updateColor();
        row.append(field);
      }

      updateCount();
      wrapper.append(label, toolbar, row);
      section.append(wrapper);
    }

    const body = panel.querySelector('.settings-tab-body');

    if (body) {
      const firstHeading = body.querySelector('h2');
      body.insertBefore(section, firstHeading ?? body.firstChild);
    }
  }

  async function createSettings() {
    if (typeof waitForSettingsDom !== 'function' || typeof createSettingsPane !== 'function') {
      const warning = document.createElement('div');
      warning.className = 'alert alert-danger';
      warning.textContent = 'Autobuy Vehicles: NilsPe-Skriptbasis fehlt.';
      (document.querySelector('.container') ?? document.body).prepend(warning);
      return;
    }

    if (!await waitForSettingsDom()) return;
    const { anchor, body } = createSettingsPane(SETTINGS_IDENTIFIER, 'Autobuy Vehicles');
    let rendered = false;
    async function render() {
      if (rendered) return;
      rendered = true;
      const panel = document.createElement('div');
      const tabBody = document.createElement('div');
      tabBody.className = 'settings-tab-body';
      panel.append(tabBody);
      await createVehicleSettingsSection(panel);
      body.append(...tabBody.childNodes);
      const heading = document.createElement('h2');
      heading.textContent = 'Ablauf';
      body.append(heading);
      for (const [key, label, fallback] of [
        [VEHICLE_DELAY_KEY, 'Pause nach einem Fahrzeugkauf [ms]', DEFAULT_VEHICLE_DELAY],
        [BUILDING_DELAY_KEY, 'Pause nach einem Gebäude [ms]', DEFAULT_BUILDING_DELAY]
      ]) {
        const row = document.createElement('label');
        row.style.display = 'block';
        row.style.marginBottom = '10px';
        row.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '5000';
        input.className = 'form-control';
        input.style.width = '130px';
        input.value = await GM.getValue(key, fallback);
        input.addEventListener('change', () => {
          void GM.setValue(key, Math.min(5000, Math.max(0, Number(input.value) || 0)));
        });
        row.append(input);
        body.append(row);
      }
    }
    anchor.addEventListener('click', () => void render());
    if (location.hash === `#${SETTINGS_IDENTIFIER}`) {
      await render();
      anchor.click();
    }
  }

  async function configuredDelays() {
    const vehicle = Number(await GM.getValue(
      VEHICLE_DELAY_KEY,
      DEFAULT_VEHICLE_DELAY
    ));
    const building = Number(await GM.getValue(
      BUILDING_DELAY_KEY,
      DEFAULT_BUILDING_DELAY
    ));

    return {
      vehicle: Number.isFinite(vehicle) && vehicle >= 0
        ? vehicle
        : DEFAULT_VEHICLE_DELAY,
      building: Number.isFinite(building) && building >= 0
        ? building
        : DEFAULT_BUILDING_DELAY
    };
  }

  async function buildingById(buildingId) {
    const db = await openCurrentDb();

    try {
      const building = await getData(db, 'buildings', Number(buildingId));
      return building ? normalizeBuilding(building) : null;
    } finally {
      db.close();
    }
  }

  async function buildingsForDispatchCenter(dispatchCenterId) {
    const targetId = Number(dispatchCenterId);
    const db = await openCurrentDb();
    let buildings;

    try {
      buildings = await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        IDBKeyRange.only(targetId)
      );

      if (buildings.length === 0) {
        buildings = (await getAllData(db, 'buildings'))
          .map(normalizeBuilding)
          .filter(building => building.leitstelle_building_id === targetId);
      }
    } finally {
      db.close();
    }

    return buildings
      .map(normalizeBuilding)
      .filter(building => BUILDING_TYPE_BY_ID.has(building.building_type))
      .sort((a, b) => a.id - b.id);
  }

  function rowVehicleType(row) {
    const element = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );
    return Number(
      element?.getAttribute('vehicle_type_id') ??
      element?.getAttribute('data-vehicle-type-id')
    );
  }

  function rowBuildingId(row) {
    const attributeId = Number(
      row.getAttribute('building_id') ??
      row.getAttribute('data-building_id') ??
      row.getAttribute('data-building-id')
    );

    if (Number.isInteger(attributeId) && attributeId > 0) {
      return attributeId;
    }

    const link = row.querySelector('a[href*="/buildings/"]');
    const source = link?.getAttribute('href') ?? row.innerHTML;
    const fromRow = Number(source.match(/\/buildings\/(\d+)/)?.[1]);
    return fromRow || buildingIdFromLocation();
  }

  function vehicleTabPane() {
    return document.querySelector('#vehicle, #tab_vehicle, #tab_vehicles');
  }

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const style = getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetParent !== null;
  }

  function vehicleTabShowsEmptyState() {
    const pane = vehicleTabPane();
    const text = (pane?.textContent ?? '').replace(/\s+/g, ' ').trim();

    return /hat keine fahrzeuge|keine fahrzeuge|keine daten|no data/i.test(text);
  }

  function vehicleTableIsProcessing() {
    return Array.from(document.querySelectorAll(
      '#vehicle_table_processing, .dataTables_processing'
    )).some(isVisible);
  }

  function vehicleRowLooksValid(row) {
    return Number.isInteger(rowVehicleType(row));
  }

  function vehicleTableIsReady(table, allowEmptyState = false) {
    const tbody = table?.querySelector('tbody');

    if (!tbody || vehicleTableIsProcessing()) {
      return false;
    }

    const rows = Array.from(tbody.querySelectorAll('tr'));

    if (rows.some(vehicleRowLooksValid)) {
      return true;
    }

    return allowEmptyState && vehicleTabShowsEmptyState();
  }

  async function loadVehicleTable() {
    const tabLink = document.querySelector(
      'a[href="#vehicle"], a[href="#tab_vehicle"], a[href="#tab_vehicles"]'
    );

    if (!tabLink && !document.getElementById('vehicle_table') &&
        !vehicleTabShowsEmptyState()) {
      throw new Error('Der Fahrzeug-Tab wurde nicht gefunden.');
    }

    setProgress('Fahrzeugliste wird geladen ...');
    tabLink?.click();

    const startedAt = Date.now();

    while (Date.now() - startedAt < 20_000) {
      const table = document.getElementById('vehicle_table');
      const allowEmptyState = Date.now() - startedAt > 1_500;

      if (table && vehicleTableIsReady(table, allowEmptyState)) {
        return table;
      }

      if (!table && allowEmptyState && vehicleTabShowsEmptyState()) {
        return null;
      }

      await sleep(100);
    }

    const table = document.getElementById('vehicle_table');

    if (table && table.querySelector('tbody')) {
      return table;
    }

    if (vehicleTabShowsEmptyState()) {
      return null;
    }

    throw new Error('Fahrzeugliste wurde nicht innerhalb von 20 Sekunden geladen.');
  }

  function vehicleCountsFromTable(buildingIds) {
    const table = document.getElementById('vehicle_table');

    if (!table) {
      setProgress('Keine vorhandenen Fahrzeuge gefunden', 1, 1, 'success');
      return new Map();
    }

    const allowedBuildings = new Set(buildingIds.map(Number));
    const rows = Array.from(table.querySelectorAll('tbody tr'))
      .filter(row => !row.querySelector('.dataTables_empty'));
    const counts = new Map();
    let evaluated = 0;

    for (const row of rows) {
      const buildingId = rowBuildingId(row);
      const vehicleType = rowVehicleType(row);

      if (!allowedBuildings.has(buildingId) || !Number.isInteger(vehicleType)) {
        continue;
      }

      const key = `${buildingId}:${vehicleType}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      evaluated++;
    }

    setProgress(
      `${evaluated.toLocaleString('de-DE')} Fahrzeugzeilen ausgewertet`,
      1,
      1,
      'success'
    );
    return counts;
  }

  async function buyVehicle(buildingId, vehicleType, quantity = 1) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const url =
      `/buildings/${buildingId}/vehicle/${buildingId}/${vehicleType}` +
      `/credits?building=${buildingId}` +
      (quantity > 1 ? `&quantity=${quantity}` : '');
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        _method: 'get',
        authenticity_token: token
      }),
      redirect: 'manual'
    });

    if (response.status >= 400) {
      throw new Error(`Fahrzeugkauf: HTTP ${response.status}`);
    }
  }

  async function availablePurchase(buildingId, vehicleType) {
    const response = await fetch(`/buildings/${buildingId}/vehicles/new`, {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error(`Fahrzeugangebote: HTTP ${response.status}`);
    }

    const documentForBuilding = new DOMParser().parseFromString(
      await response.text(), 'text/html'
    );
    if (documentForBuilding.querySelector('input[type="password"]')) {
      throw new Error('Anmeldung erforderlich.');
    }
    const expectedPath = `/vehicle/${buildingId}/${vehicleType}/credits`;
    const link = [...documentForBuilding.querySelectorAll('section.purchase a[href]')]
      .find(candidate => new URL(candidate.getAttribute('href'), location.origin)
        .pathname.endsWith(expectedPath));
    if (!link || link.getAttribute('aria-disabled') === 'true' ||
        link.classList.contains('disabled')) {
      return 0;
    }

    const purchase = link.closest('section.purchase');
    const input = purchase?.querySelector('input.quantity-input');
    if (!input) return 1;

    const maximum = Number(purchase.dataset.max ?? input.max);
    return Number.isInteger(maximum) && maximum > 0 ? maximum : 0;
  }

    async function processBuilding(
      building,
      counts,
      vehicleDelay,
      configuration = null
    ) {
      configuration ??= await loadConfiguration(building.building_type);

      if (configuration.size === 0) {
        return 0;
      }

      let bought = 0;

      for (const [vehicleType, wanted] of configuration) {
        if (cancelled) break;
        const key = `${building.id}:${vehicleType}`;
        const current = counts.get(key) ?? 0;

        let missing = Math.max(0, wanted - current);
        while (missing > 0 && !cancelled) {
          const available = await availablePurchase(building.id, vehicleType);
          if (available === 0) {
            console.info('[Autobuy Vehicles] Derzeit nicht kaufbar:',
              building.id, vehicleType, `${missing} fehlen`);
            break;
          }
          const quantity = Math.min(missing, available);
          await buyVehicle(building.id, vehicleType, quantity);
          counts.set(key, (counts.get(key) ?? 0) + quantity);
          bought += quantity;
          missing -= quantity;
          await sleep(vehicleDelay);
        }
      }

      return bought;
    }

  function ensureProgressBar() {
    if (document.getElementById('nilspe-abv-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-abv-style';
    style.textContent = `
      #nilspe-abv-progress {
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
      #nilspe-abv-progress-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      #nilspe-abv-statistics {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-top: 6px;
        font-size: 12px;
      }
      #nilspe-abv-track {
        height: 12px;
        margin-top: 6px;
        overflow: hidden;
        border-radius: 4px;
        background: #777;
      }
      #nilspe-abv-fill {
        height: 100%;
        width: 0;
        background: #5cb85c;
        transition: width .15s;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-abv-progress';
    const status = document.createElement('span');
    status.id = 'nilspe-abv-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const row = document.createElement('div');
    row.id = 'nilspe-abv-progress-row';
    const stop = document.createElement('button');
    stop.id = 'nilspe-abv-stop';
    stop.type = 'button';
    stop.className = 'btn btn-danger btn-xs';
    stop.textContent = 'Abbrechen';
    stop.addEventListener('click', () => {
      cancelled = true;
      stop.disabled = true;
      status.textContent = 'Abbruch – laufende Anfrage wird beendet...';
    });
    const close = document.createElement('button');
    close.id = 'nilspe-abv-close';
    close.type = 'button';
    close.className = 'btn btn-default btn-xs';
    close.textContent = 'Schließen';
    close.disabled = true;
    close.addEventListener('click', () => {
      if (running) return;
      container.remove();
      style.remove();
    });
    row.append(stop, status, close);
    const statistics = document.createElement('div');
    statistics.id = 'nilspe-abv-statistics';
    const track = document.createElement('div');
    track.id = 'nilspe-abv-track';
    const fill = document.createElement('div');
    fill.id = 'nilspe-abv-fill';
    track.append(fill);
    container.append(row, statistics, track);
    document.body.append(container);
  }

  function setProgress(message, completed = 0, total = 0, style = 'info') {
    ensureProgressBar();
    const status = document.getElementById('nilspe-abv-status');
    const fill = document.getElementById('nilspe-abv-fill');
    status.className = `label label-${style}`;
    status.textContent = message;
    fill.style.width = total > 0
      ? `${Math.min(100, completed / total * 100)}%` : '0%';
  }

  function updateStatistics(completed, total, bought, errors) {
    const element = document.getElementById('nilspe-abv-statistics');
    if (!element) return;
    const format = value => Number(value).toLocaleString('de-DE');
    element.replaceChildren();
    for (const entry of [
      `Gekaufte Fahrzeuge: ${format(bought)}`,
      `Fehler: ${format(errors)}`,
      `Wachen: ${format(completed)}/${format(total)}`
    ]) {
      const span = document.createElement('span');
      span.textContent = entry;
      element.append(span);
    }
  }

    async function runForBuildings(buildings) {
      if (running) return;
      running = true;
      cancelled = false;
      ensureProgressBar();
      document.getElementById('nilspe-abv-stop').disabled = false;
      document.getElementById('nilspe-abv-close').disabled = true;
      try {
      const delays = await configuredDelays();
      const configurationByBuildingType = new Map();

      for (const building of buildings) {
        const buildingType = Number(building.building_type);

        if (!configurationByBuildingType.has(buildingType)) {
          configurationByBuildingType.set(
            buildingType,
            await loadConfiguration(buildingType)
          );
        }
      }

      const configuredBuildings = buildings.filter(building => {
        const configuration = configurationByBuildingType.get(
          Number(building.building_type)
        );

        return configuration instanceof Map && configuration.size > 0;
      });

      if (configuredBuildings.length === 0) {
        setProgress(
          'Für diese Gebäude sind keine Fahrzeuge konfiguriert',
          0,
          0,
          'warning'
        );

        updateStatistics(0, 0, 0, 0);
        return;
      }

      await loadVehicleTable();

      const counts = vehicleCountsFromTable(
        configuredBuildings.map(building => building.id)
      );

      let completed = 0;
      let errors = 0;
      let totalBought = 0;
      updateStatistics(0, configuredBuildings.length, 0, 0);

      await runWithConcurrency(
        configuredBuildings,
        async building => {
          if (cancelled) return;
          setProgress(
            `${completed}/${configuredBuildings.length}: ${building.caption}`,
            completed,
            configuredBuildings.length
          );

          try {
            const configuration = configurationByBuildingType.get(
              Number(building.building_type)
            );

            const bought = await processBuilding(
              building,
              counts,
              delays.vehicle,
              configuration
            );
            totalBought += bought;
          } catch (error) {
            errors++;

            console.error(
              '[Autobuy Vehicles] Fehler bei Gebaeude',
              building.id,
              building.caption,
              error
            );
          }

          completed++;
          updateStatistics(completed, configuredBuildings.length, totalBought, errors);

          setProgress(
            `${completed}/${configuredBuildings.length} Gebaeude, ${totalBought} gekauft`,
            completed,
            configuredBuildings.length,
            errors ? 'warning' : 'success'
          );
        },
        { concurrency: 2, delay: delays.building }
      );

      setProgress(
        cancelled ? 'Abgebrochen' : `Fertig: ${totalBought} Fahrzeuge gekauft, ${errors} Fehler`,
        completed,
        configuredBuildings.length,
        cancelled || errors ? 'warning' : 'success'
      );
      } finally {
        running = false;
        document.getElementById('nilspe-abv-stop').disabled = true;
        document.getElementById('nilspe-abv-close').disabled = false;
      }
    }

  function settingsButton() {
    const button = document.createElement('a');
    button.className = 'btn btn-default btn-xs';
    button.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
    button.target = '_blank';
    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';
    icon.title = 'Einstellungen';
    button.append(icon);
    return button;
  }

  function appendDetailButtons(labelText, buttonId, run) {
    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details || document.getElementById(buttonId)) {
      return;
    }

    const label = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = labelText;
    label.append(strong);
    const value = document.createElement('dd');
    const group = document.createElement('div');
    group.id = buttonId;
    group.className = 'btn-group';
    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'btn btn-default btn-xs';
    runButton.textContent = 'Autobuy Vehicles';
    runButton.addEventListener('click', async () => {
      runButton.disabled = true;

      try {
        await run();
      } catch (error) {
        console.error('[Autobuy Vehicles] Lauf fehlgeschlagen:', error);
        setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 'danger');
      } finally {
        runButton.disabled = false;
      }
    });

    group.append(runButton, settingsButton());
    value.append(group);
    details.append(label, value);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
    return;
  }

  const heading = document.querySelector('h1[building_type]');
  const buildingId = buildingIdFromLocation();

  if (!heading || !buildingId) {
    return;
  }

  const buildingType = Number(heading.getAttribute('building_type'));

  if (buildingType === 7) {
    appendDetailButtons(
      'Fahrzeuge kaufen:',
      'nilspe-abv-dispatch-buttons',
      async () => {
        setProgress('Lade Gebaeude und Fahrzeuge...');
        const buildings = await buildingsForDispatchCenter(buildingId);

        if (buildings.length === 0) {
          setProgress('Keine zugeordneten Gebaeude gefunden', 0, 0, 'warning');
          return;
        }

        await runForBuildings(buildings);
      }
    );
    return;
  }

  if (!BUILDING_TYPE_BY_ID.has(buildingType)) {
    return;
  }

  appendDetailButtons(
    'Fahrzeuge kaufen:',
    'nilspe-abv-building-buttons',
    async () => {
      const building = await buildingById(buildingId);

      if (!building) {
        setProgress('Gebaeude nicht im API-Cache gefunden', 0, 0, 'danger');
        return;
      }

      await runForBuildings([building]);
    }
  );
})();
