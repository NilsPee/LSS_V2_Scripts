// ==UserScript==
// @name         Leitstelle Fahrzeug Max-Personal
// @namespace    NilsPe.vehicle.maxpersonal
// @version      1.0.3
// @description  Setzt die maximale Personenanzahl konfigurierter Fahrzeuge fuer einzelne Gebaeude oder eine Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Vehicle-Max-Personal.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Vehicle-Max-Personal.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_vehicle_max_personal';
  const CONFIG_KEY_PREFIX = 'nilspe_vmp_config_';
  const VEHICLE_DELAY_KEY = 'nilspe_vmp_vehicle_delay';
  const BUILDING_DELAY_KEY = 'nilspe_vmp_building_delay';
  const DEFAULT_VEHICLE_DELAY = 100;
  const DEFAULT_BUILDING_DELAY = 100;

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
    [28, 'Hubschrauberstation (Seenotrettung)']
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
      [170, 'AB-Wasser/Schaum']
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
      [147, 'FmKW'], [148, 'MTW-FGr K']
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
    [13, [[61, 'Polizeihubschrauber'], [99, 'Aussenlastbehaelter']]],
    [15, [[63, 'GW-Taucher'], [64, 'GW-Wasserrettung'], [70, 'MZB']]]
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
      await updateBuildings(db, 60);
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
    return parseConfiguration(
      await GM.getValue(configurationKey(buildingType), '[]')
    );
  }

  async function saveConfiguration(buildingType, row) {
    const configuration = [];

    for (const input of row.querySelectorAll('input[data-vehicle-type]')) {
      const vehicleType = Number(input.dataset.vehicleType);
      const maxPersonal = Number(input.value);

      if (Number.isInteger(vehicleType) &&
          Number.isInteger(maxPersonal) &&
          maxPersonal > 0) {
        configuration.push([vehicleType, maxPersonal]);
      }
    }

    await GM.setValue(
      configurationKey(buildingType),
      JSON.stringify(configuration)
    );
  }

  async function createVehicleSettingsSection(panel) {
    const section = document.createElement('div');
    section.style.margin = '15px';
    const heading = document.createElement('h2');
    heading.textContent = 'Max-Personal je Fahrzeugtyp';
    section.append(heading);

    for (const buildingType of BUILDING_TYPES) {
      const options = new Map(
        (KNOWN_VEHICLES.get(buildingType.id) ?? [])
          .map(([id, name]) => [id, { id, name }])
      );

      if (options.size === 0) {
        continue;
      }

      const stored = await loadConfiguration(buildingType.id);
      const wrapper = document.createElement('div');
      wrapper.className = 'form-group';
      wrapper.style.paddingBottom = '12px';
      wrapper.style.marginBottom = '12px';
      wrapper.style.borderBottom = '1px solid #777';
      const label = document.createElement('h3');
      label.textContent = `${buildingType.id} ${buildingType.label}`;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.gap = '12px';

      for (const option of [...options.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'de')
      )) {
        const field = document.createElement('label');
        field.style.minWidth = '110px';
        field.style.maxWidth = '180px';
        field.textContent = option.name;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '50';
        input.className = 'form-control';
        input.style.width = '85px';
        input.dataset.vehicleType = String(option.id);
        input.value = stored.get(option.id) ?? '';
        input.addEventListener('change', () =>
          saveConfiguration(buildingType.id, row)
        );
        field.append(input);
        row.append(field);
      }

      wrapper.append(label, row);
      section.append(wrapper);
    }

    const body = panel.querySelector('.settings-tab-body');

    if (body) {
      const firstHeading = body.querySelector('h2');
      body.insertBefore(section, firstHeading ?? body.firstChild);
    }
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      const warning = document.createElement('div');
      warning.className = 'alert alert-danger';
      warning.textContent = 'Fahrzeug Max-Personal: NilsPe-Skriptbasis fehlt.';
      (document.querySelector('.container') ?? document.body).prepend(warning);
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Fahrzeug Max-Personal',
      settings: [
        { type: 'header', text: 'Ablauf' },
        {
          type: 'number',
          key: VEHICLE_DELAY_KEY,
          label: 'Pause nach einer Fahrzeug-Aenderung [ms]',
          default: DEFAULT_VEHICLE_DELAY,
          min: 0,
          max: 5_000
        },
        {
          type: 'number',
          key: BUILDING_DELAY_KEY,
          label: 'Pause nach einem Gebaeude [ms]',
          default: DEFAULT_BUILDING_DELAY,
          min: 0,
          max: 5_000
        }
      ]
    });

    const panel = document.getElementById(SETTINGS_IDENTIFIER);

    if (panel) {
      await createVehicleSettingsSection(panel);
    }
  }

  async function configuredDelays() {
    const vehicle = Number(await GM.getValue(VEHICLE_DELAY_KEY, DEFAULT_VEHICLE_DELAY));
    const building = Number(await GM.getValue(BUILDING_DELAY_KEY, DEFAULT_BUILDING_DELAY));

    return {
      vehicle: Number.isFinite(vehicle) && vehicle >= 0 ? vehicle : DEFAULT_VEHICLE_DELAY,
      building: Number.isFinite(building) && building >= 0 ? building : DEFAULT_BUILDING_DELAY
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
      buildings = await getDataByIndex(db, 'buildings', 'leitstelle_building_id', IDBKeyRange.only(targetId));

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
    const element = row.querySelector('[vehicle_type_id], [data-vehicle-type-id]');
    return Number(element?.getAttribute('vehicle_type_id') ?? element?.getAttribute('data-vehicle-type-id'));
  }

  function rowBuildingId(row) {
    const attributeId = Number(row.getAttribute('building_id') ?? row.getAttribute('data-building_id') ?? row.getAttribute('data-building-id'));

    if (Number.isInteger(attributeId) && attributeId > 0) return attributeId;

    const link = row.querySelector('a[href*="/buildings/"]');
    const source = link?.getAttribute('href') ?? row.innerHTML;
    const fromRow = Number(source.match(/\/buildings\/(\d+)/)?.[1]);
    return fromRow || buildingIdFromLocation();
  }

  function rowVehicleId(row) {
    const attributeId = Number(row.getAttribute('vehicle_id') ?? row.getAttribute('data-vehicle_id') ?? row.getAttribute('data-vehicle-id'));

    if (Number.isInteger(attributeId) && attributeId > 0) return attributeId;

    const rowId = Number(row.id?.match(/vehicle[_-](\d+)/)?.[1]);

    if (Number.isInteger(rowId) && rowId > 0) return rowId;

    const link = row.querySelector('a[href*="/vehicles/"]');
    return Number(link?.getAttribute('href')?.match(/\/vehicles\/(\d+)/)?.[1]);
  }

  function rowCurrentMaxPersonal(row) {
    const direct = row.querySelector('[data-personal-max], [vehicle_personal_max]');
    const directValue = Number(direct?.getAttribute('data-personal-max') ?? direct?.getAttribute('vehicle_personal_max'));

    if (Number.isInteger(directValue)) return directValue;

    const cell = row.querySelector('td:nth-child(6)');
    const match = cell?.textContent?.match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function vehicleTabPane() {
    return document.querySelector('#tab_vehicle, #tab_vehicles');
  }

  function isVisible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null;
  }

  function vehicleTabShowsEmptyState() {
    const pane = vehicleTabPane();
    const text = (pane?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return /keine fahrzeuge|keine daten|no data/i.test(text);
  }

  function vehicleTableIsProcessing() {
    return Array.from(document.querySelectorAll('#vehicle_table_processing, .dataTables_processing')).some(isVisible);
  }

  function vehicleRowLooksValid(row) {
    return Number.isInteger(rowVehicleType(row));
  }

  function vehicleTableIsReady(table, allowEmptyState = false) {
    const tbody = table?.querySelector('tbody');
    if (!tbody || vehicleTableIsProcessing()) return false;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.some(vehicleRowLooksValid)) return true;
    return allowEmptyState && vehicleTabShowsEmptyState();
  }

  async function loadVehicleTable() {
    const tabLink = document.querySelector('a[href="#tab_vehicle"], a[href="#tab_vehicles"]');

    if (!tabLink && !document.getElementById('vehicle_table')) {
      throw new Error('Der Fahrzeug-Tab wurde nicht gefunden.');
    }

    setProgress('Fahrzeugliste wird geladen ...');
    tabLink?.click();
    const startedAt = Date.now();

    while (Date.now() - startedAt < 20_000) {
      const table = document.getElementById('vehicle_table');
      const allowEmptyState = Date.now() - startedAt > 1_500;

      if (table && vehicleTableIsReady(table, allowEmptyState)) return table;
      if (!table && allowEmptyState && vehicleTabShowsEmptyState()) return null;
      await sleep(100);
    }

    const table = document.getElementById('vehicle_table');
    if (table && table.querySelector('tbody')) return table;
    if (vehicleTabShowsEmptyState()) return null;
    throw new Error('Fahrzeugliste wurde nicht innerhalb von 20 Sekunden geladen.');
  }

  function rowsFromVehicleTable() {
    const table = document.getElementById('vehicle_table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tbody tr'))
      .filter(row => !row.querySelector('.dataTables_empty'))
      .filter(row => Number.isInteger(rowVehicleType(row)));
  }

  function ensureProgressBar() {
    if (document.getElementById('nilspe-vmp-progress')) return;
    const style = document.createElement('style');
    style.id = 'nilspe-vmp-style';
    style.textContent = `
      #nilspe-vmp-progress { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483000; padding: 7px 12px; border-top: 1px solid #ddd; background: #f8f8f8; }
      #nilspe-vmp-track { height: 12px; margin-top: 5px; overflow: hidden; border-radius: 4px; background: #ddd; }
      #nilspe-vmp-fill { height: 100%; width: 0; background: #5cb85c; }
    `;
    document.head.append(style);
    const container = document.createElement('div');
    container.id = 'nilspe-vmp-progress';
    const status = document.createElement('span');
    status.id = 'nilspe-vmp-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-vmp-track';
    const fill = document.createElement('div');
    fill.id = 'nilspe-vmp-fill';
    track.append(fill);
    container.append(status, track);
    document.body.append(container);
  }

  function setProgress(message, completed = 0, total = 0, style = 'info') {
    ensureProgressBar();
    const status = document.getElementById('nilspe-vmp-status');
    const fill = document.getElementById('nilspe-vmp-fill');
    status.className = `label label-${style}`;
    status.textContent = message;
    fill.style.width = total > 0 ? `${completed / total * 100}%` : '0%';
  }

  function removeProgressBar(delay = 1_500) {
    setTimeout(() => {
      document.getElementById('nilspe-vmp-progress')?.remove();
      document.getElementById('nilspe-vmp-style')?.remove();
    }, delay);
  }

  async function changeVehicleMaxPersonal(vehicleId, maxPersonal) {
    const token = csrfToken();
    if (!token) throw new Error('CSRF-Token wurde nicht gefunden.');

    const body = new URLSearchParams();
    body.set('vehicle[personal_max]', String(maxPersonal));
    body.set('_method', 'put');
    body.set('authenticity_token', token);

    const response = await fetch(`/vehicles/${vehicleId}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body.toString(),
      redirect: 'manual'
    });

    if (response.status >= 400) throw new Error(`Max-Personal HTTP ${response.status}`);
  }

  async function buildJobs(buildings) {
    const buildingByIdMap = new Map(buildings.map(building => [building.id, building]));
    const configurationByBuildingType = new Map();

    for (const buildingType of new Set(buildings.map(building => building.building_type))) {
      configurationByBuildingType.set(buildingType, await loadConfiguration(buildingType));
    }

    const allowedBuildings = new Set(buildings.map(building => building.id));
    const jobs = [];

    for (const row of rowsFromVehicleTable()) {
      const buildingId = rowBuildingId(row);
      if (!allowedBuildings.has(buildingId)) continue;

      const building = buildingByIdMap.get(buildingId);
      const vehicleType = rowVehicleType(row);
      const vehicleId = rowVehicleId(row);
      const target = configurationByBuildingType.get(building.building_type)?.get(vehicleType);

      if (!target || !Number.isInteger(vehicleId) || vehicleId <= 0) continue;

      const current = rowCurrentMaxPersonal(row);
      if (current === target) continue;

      jobs.push({ vehicleId, buildingId, buildingCaption: building.caption, vehicleType, target, current });
    }

    return jobs;
  }

  async function runForBuildings(buildings) {
    const delays = await configuredDelays();
    await loadVehicleTable();
    const jobs = await buildJobs(buildings);

    if (jobs.length === 0) {
      setProgress('Keine Fahrzeug-Aenderung notwendig', 1, 1, 'success');
      removeProgressBar();
      return;
    }

    let completed = 0;
    let errors = 0;

    await runWithConcurrency(
      jobs,
      async job => {
        setProgress(
          `${completed}/${jobs.length}: Fahrzeug ${job.vehicleId} -> ${job.target}`,
          completed,
          jobs.length
        );

        try {
          await changeVehicleMaxPersonal(job.vehicleId, job.target);
        } catch (error) {
          errors++;
          console.error(
            '[Fahrzeug Max-Personal] Fehler bei Fahrzeug',
            job.vehicleId,
            job,
            error
          );
        }

        completed++;
        setProgress(
          `${completed}/${jobs.length} Fahrzeuge geaendert`,
          completed,
          jobs.length,
          errors ? 'warning' : 'success'
        );
      },
      { concurrency: 3, delay: delays.vehicle }
    );

    setProgress(
      `Fertig: ${completed - errors} Fahrzeuge geaendert, ${errors} Fehler`,
      completed,
      jobs.length,
      errors ? 'warning' : 'success'
    );
    await sleep(delays.building);
    removeProgressBar(3_000);
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

  async function buildingsForCurrentPage(buildingType, buildingId) {
    if (buildingType === 7) {
      return buildingsForDispatchCenter(buildingId);
    }

    const building = await buildingById(buildingId);
    return building ? [building] : [];
  }

  async function runForCurrentPage(runButton, buildingType, buildingId) {
    runButton.disabled = true;

    try {
      setProgress('Lade Gebaeude und Fahrzeuge...');
      const buildings = await buildingsForCurrentPage(buildingType, buildingId);

      if (buildings.length === 0) {
        setProgress(
          buildingType === 7
            ? 'Keine zugeordneten Gebaeude gefunden'
            : 'Gebaeude nicht im API-Cache gefunden',
          0,
          0,
          'warning'
        );
        return;
      }

      await runForBuildings(buildings);
    } catch (error) {
      console.error('[Fahrzeug Max-Personal] Lauf fehlgeschlagen:', error);
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 'danger');
    } finally {
      runButton.disabled = false;
    }
  }

  function addVehicleTabButton(buildingType, buildingId) {
    const table = document.getElementById('vehicle_table');

    if (!table || document.getElementById('nilspe-vmp-buttons')) {
      return;
    }

    const group = document.createElement('div');
    group.id = 'nilspe-vmp-buttons';
    group.className = 'btn-group';
    group.style.display = 'flex';
    group.style.width = 'fit-content';
    group.style.margin = '0';

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'btn btn-default btn-xs';
    runButton.textContent = 'Max-Personal setzen';
    runButton.addEventListener('click', () =>
      runForCurrentPage(runButton, buildingType, buildingId)
    );

    group.append(runButton, settingsButton());

    const row = document.createElement('div');
    row.id = 'nilspe-vmp-button-row';
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
    return;
  }

  const heading = document.querySelector('h1[building_type]');
  const buildingId = buildingIdFromLocation();
  if (!heading || !buildingId) return;

  const buildingType = Number(heading.getAttribute('building_type'));

  if (buildingType !== 7 && !BUILDING_TYPE_BY_ID.has(buildingType)) return;

  addVehicleTabButton(buildingType, buildingId);
  new MutationObserver(() => addVehicleTabButton(buildingType, buildingId))
    .observe(document.body, { childList: true, subtree: true });
})();
