// ==UserScript==
// @name         Leitstelle Mastermind
// @namespace    NilsPe.mastermind
// @version      0.3.0
// @description  Vorlagen für Ausbau, Fahrzeuge und Personal im Leitstellenspiel
// @author       NilsPe
// @license      MIT
// @match        https://*.leitstellenspiel.de/
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const QUALIFICATION_BY_VEHICLE_TYPE = new Map([
    [12, 'gw_messtechnik'], [27, 'gw_gefahrgut'],
    [29, 'notarzt'], [31, 'notarzt'],
    [33, 'gw_hoehenrettung'], [34, 'elw2'],
    [35, 'police_einsatzleiter'],
    [40, 'thw_zugtrupp'], [42, 'thw_raumen'],
    [45, 'thw_raumen'], [46, 'wechsellader'],
    [51, 'police_fukw'], [53, 'dekon_p'],
    [55, 'lna'], [56, 'orgl'],
    [57, 'fwk'], [59, 'seg_elw'],
    [60, 'seg_gw_san'],
    [61, 'polizeihubschrauber'],
    [63, 'gw_taucher'], [64, 'gw_wasserrettung'],
    [69, 'gw_taucher'], [72, 'police_wasserwerfer'],
    [74, 'notarzt'], [75, 'arff'],
    [76, 'rettungstreppe'],
    [79, 'police_sek'], [80, 'police_sek'],
    [81, 'police_mek'], [82, 'police_mek'],
    [83, 'werkfeuerwehr'], [84, 'werkfeuerwehr'],
    [85, 'werkfeuerwehr'], [86, 'werkfeuerwehr'],
    [91, 'seg_rescue_dogs'],
    [93, 'thw_rescue_dogs'],
    [94, 'k9'], [95, 'police_motorcycle'],
    [98, 'criminal_investigation'],
    [99, 'water_damage_pump'],
    [100, 'water_damage_pump'],
    [103, 'police_service_group_leader'],
    [109, 'heavy_rescue'],
    [122, 'thw_energy_supply'],
    [123, 'water_damage_pump'],
    [125, 'thw_drone'], [126, 'fire_drone'],
    [127, 'seg_drone'], [128, 'fire_drone'],
    [131, 'care_service'],
    [133, 'care_service_equipment'],
    [134, 'police_horse'], [135, 'police_horse'],
    [137, 'police_horse'],
    [140, 'fire_care_service'],
    [144, 'thw_command'], [145, 'thw_command'],
    [147, 'thw_command'], [148, 'thw_command'],
    [149, 'notarzt'], [151, 'mountain_command'],
    [153, 'seg_rescue_dogs'],
    [158, 'mountain_height_rescue'],
    [162, 'railway_fire'],
    [163, 'railway_fire'],
    [164, 'railway_fire'],
    [165, 'police_speaker_operator'],
    [171, 'disaster_response_technology'],
    [172, 'disaster_response_technology'],
    [173, 'disaster_response_technology'],
    [175, 'disaster_response_technology']
  ]);

  function numberedOptions(label, ids) {
    return ids.map((id, index) => ({
      value: id,
      name: `${label} ${index + 1}`
    }));
  }

  const KNOWN_EXTENSION_OPTIONS = new Map([
    [0, [
      { value: 0, name: 'Rettungsdienst' },
      ...numberedOptions('Abrollbehaelter', [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]),
      { value: 6, name: 'Wasserrettung' },
      { value: 8, name: 'Flughafen' },
      { value: 9, name: 'Grosswache' },
      { value: 13, name: 'Werkfeuerwehr' },
      { value: 14, name: 'NEA50' },
      { value: 15, name: 'NEA200' },
      { value: 16, name: 'Luefter' },
      { value: 18, name: 'Drohnen-Erweiterung' },
      { value: 19, name: 'Verpflegungsdienst' },
      ...numberedOptions('Anhaenger-Stellplatz', [20, 21, 22, 23, 24]),
      { value: 25, name: 'Bahnrettung' }
    ]],
    [18, [
      { value: 0, name: 'Rettungsdienst' },
      ...numberedOptions('Abrollbehaelter', [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]),
      { value: 6, name: 'Wasserrettung' },
      { value: 8, name: 'Flughafen' },
      { value: 9, name: 'Grosswache' },
      { value: 13, name: 'Werkfeuerwehr' },
      { value: 14, name: 'NEA50' },
      { value: 15, name: 'NEA200' },
      { value: 16, name: 'Luefter' },
      { value: 18, name: 'Drohnen-Erweiterung' },
      { value: 19, name: 'Verpflegungsdienst' },
      ...numberedOptions('Anhaenger-Stellplatz', [20, 21, 22, 23, 24]),
      { value: 25, name: 'Bahnrettung' }
    ]],
    [2, [{ value: 0, name: 'Grosswache' }]],
    [20, [{ value: 0, name: 'Grosswache' }]],
    [4, [
      { value: 0, name: 'Allgemeine Innere' },
      { value: 1, name: 'Allgemeine Chirurgie' },
      { value: 2, name: 'Gynaekologie' },
      { value: 3, name: 'Urologie' },
      { value: 4, name: 'Unfallchirurgie' },
      { value: 5, name: 'Neurologie' },
      { value: 6, name: 'Neurochirurgie' },
      { value: 7, name: 'Kardiologie' },
      { value: 8, name: 'Kardiochirurgie' },
      { value: 9, name: 'Grosskrankenhaus' }
    ]],
    [6, [
      ...numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      { value: 10, name: 'Diensthundestaffel' },
      { value: 11, name: 'Kriminalpolizei' },
      { value: 12, name: 'Dienstgruppenleitung' },
      { value: 13, name: 'Motorradstaffel' },
      { value: 14, name: 'Grosswache' },
      { value: 15, name: 'Grossgewahrsam' }
    ]],
    [19, [
      ...numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      { value: 10, name: 'Diensthundestaffel' },
      { value: 11, name: 'Kriminalpolizei' },
      { value: 12, name: 'Dienstgruppenleitung' },
      { value: 13, name: 'Motorradstaffel' },
      { value: 14, name: 'Grosswache' },
      { value: 15, name: 'Grossgewahrsam' }
    ]],
    [11, [
      { value: 0, name: '2. Zug der Hundertschaft' },
      { value: 1, name: '3. Zug der Hundertschaft' },
      { value: 2, name: 'Sonderfahrzeug: Gefangenenkraftwagen' },
      { value: 3, name: 'Technischer Zug: Wasserwerfer' },
      { value: 4, name: 'SEK: 1. Zug' },
      { value: 5, name: 'SEK: 2. Zug' },
      { value: 6, name: 'MEK: 1. Zug' },
      { value: 7, name: 'MEK: 2. Zug' },
      { value: 8, name: 'Diensthundestaffel' },
      { value: 9, name: 'Reiterstaffel' },
      { value: 10, name: 'LauKW' }
    ]],
    [9, [
      { value: 0, name: '1. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung' },
      { value: 1, name: '1. Technischer Zug: Zugtrupp' },
      { value: 2, name: 'Fachgruppe Raeumen' },
      { value: 3, name: 'Fachgruppe Wassergefahren' },
      { value: 4, name: '2. Technischer Zug - Grundvoraussetzungen' },
      { value: 5, name: '2. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung' },
      { value: 6, name: '2. Technischer Zug: Zugtrupp' },
      { value: 7, name: 'Fachgruppe Ortung' },
      { value: 8, name: 'Fachgruppe Wasserschaden/Pumpen' },
      { value: 9, name: 'Fachgruppe schwere Bergung' },
      { value: 10, name: 'Fachgruppe Elektroversorgung' },
      { value: 11, name: 'Ortsverbands-Mannschaftstransportwagen' },
      { value: 12, name: 'Trupp Unbemannte Luftfahrtsysteme' },
      { value: 13, name: 'Fachzug Fuehrung und Kommunikation' }
    ]],
    [12, [
      { value: 0, name: 'Fuehrung' },
      { value: 1, name: 'Sanitaetsdienst' },
      { value: 2, name: 'Wasserrettungs-Erweiterung' },
      { value: 3, name: 'Rettungshundestaffel' },
      { value: 4, name: 'SEG Drohne' },
      { value: 5, name: 'Betreuungs- und Verpflegungsdienst' },
      { value: 6, name: 'Technik und Sicherheit' }
    ]]
  ]);

  function parseLevelFromDoc(doc) {
    for (const dt of doc.querySelectorAll('dt')) {
      const title = dt.textContent
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      if (
        !/^(ausbaustufe|gebäudestufe|gebaeudestufe|stufe):?$/.test(title)
      ) {
        continue;
      }

      let next = dt.nextElementSibling;

      while (next && next.tagName !== 'DD') {
        if (next.tagName === 'DT') {
          next = null;
          break;
        }

        next = next.nextElementSibling;
      }

      if (!next) continue;

      const match = next.textContent
        .trim()
        .match(/^(?:Stufe\s*:?\s*)?(\d+)\b/i);

      if (match) {
        return Number(match[1]);
      }
    }

    for (const dd of doc.querySelectorAll('dd')) {
      const text = dd.textContent
        .replace(/\s+/g, ' ')
        .trim();

      const match = text.match(
        /^Stufe:\s*(\d+)\b/i
      );

      if (match) {
        return Number(match[1]);
      }
    }

    return null;
  }

  async function fetchBuildingDetails(buildingId) {
    const response = await fetch(
      `/buildings/${buildingId}`,
      {
        credentials: 'same-origin',
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gebäudeseite HTTP ${response.status}`
      );
    }

    const doc = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );

    const typeElement = doc.querySelector(
      'h1[building_type]'
    );

    return {
      id: buildingId,

      name: doc.querySelector('h1')
        ?.textContent.trim() || `Gebäude ${buildingId}`,

      type: typeElement
        ? Number(typeElement.getAttribute('building_type'))
        : null,

      currentLevel: parseLevelFromDoc(doc)
    };
  }

  async function upgradeOneLevel(buildingId, currentLevel) {
    const token = getCsrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token nicht gefunden'
      );
    }

    const url =
      `/buildings/${buildingId}/expand_do/credits` +
      `?level=${currentLevel}`;

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        _method: 'get',
        authenticity_token: token
      }),
      redirect: 'manual'
    });

    /*
     * Ein 3xx kann die normale Weiterleitung
     * nach einem erfolgreichen Ausbau sein.
     *
     * Ein solcher Status wird NICHT als
     * Erfolgsnachweis betrachtet.
     *
     * Die neue Stufe muss anschließend
     * bestätigt werden.
     */

    if (
      response.status >= 400 ||
      (response.status >= 300 && response.status < 400 &&
       response.status !== 302 &&
       response.status !== 303)
    ) {
      throw new Error(
        `Ausbau HTTP ${response.status}`
      );
    }

    log(
      'Kaufanfrage gesendet:',
      buildingId,
      `${currentLevel} → ${currentLevel + 1}`
    );
  }

  async function availableExtensionPurchases(buildingId) {
    const response = await fetch(`/buildings/${buildingId}`, {
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(`Gebaeudeseite: HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const purchases = new Map();

    for (const link of documentFromResponse.querySelectorAll(
      'a[href*="/extension/credits/"]'
    )) {
      const href = link.getAttribute('href') ?? '';
      const idMatch = href.match(/\/extension\/credits\/(\d+)/);

      if (idMatch) {
        purchases.set(Number(idMatch[1]), new URL(href, location.origin).href);
      }
    }

    return purchases;
  }

  async function buyExtension(url) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': token,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        _method: 'post',
        authenticity_token: token
      }),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Kauf: HTTP ${response.status}`);
    }
  }

  async function toggleUrl(buildingId) {
    const response = await fetch(`/buildings/${buildingId}`, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (!response.ok) {
      throw new Error(`Gebaeudeseite HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const link = documentFromResponse.querySelector(
      `a[href*="/buildings/${buildingId}/active"], ` +
      'a[href$="/active"][data-method], a.btn[href$="/active"]'
    );
    const href = link?.getAttribute('href');

    if (!href) {
      throw new Error('Umschalt-URL wurde nicht gefunden.');
    }

    return new URL(href, location.origin).href;
  }

  async function toggleBuilding(buildingId) {
    const response = await fetch(await toggleUrl(buildingId), {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Umschaltung HTTP ${response.status}`);
    }
  }

  async function toggleUrls(buildingId) {
    const response = await fetch(`/buildings/${buildingId}`, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (!response.ok) {
      throw new Error(`Gebaeudeseite HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const urls = new Map();

    for (const link of documentFromResponse.querySelectorAll(
      'a[href*="/extension_ready/"]'
    )) {
      const href = link.getAttribute('href') ?? '';
      const match = href.match(/\/extension_ready\/(\d+)/);

      if (match) {
        urls.set(Number(match[1]), new URL(href, location.origin).href);
      }
    }

    return urls;
  }

  async function buyVehicle(buildingId, vehicleType) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const url =
      `/buildings/${buildingId}/vehicle/${buildingId}/${vehicleType}` +
      `/credits?building=${buildingId}`;
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

  function rowMatchesQualification(row, qualification) {
    if (!qualification) {
      const schooling =
        row.children?.[1]?.textContent
          .trim()
          .toLowerCase() ?? '';

      return schooling === '' || schooling === '-';
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

  function requestHeaders() {
    return {
      'X-CSRF-Token':
        document.querySelector(
          'meta[name="csrf-token"]'
        )?.content ?? '',

      'X-Requested-With': 'XMLHttpRequest'
    };
  }

  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content;
  const getCsrfToken = csrfToken;

  async function buildingState(id) {
    const response = await fetch('/api/buildings/' + id, { cache: 'no-store' });
    if (!response.ok) throw new Error('Gebäudebestand HTTP ' + response.status);
    const result = extractResult(await response.json());
    const building = Array.isArray(result) ? result.find(item => Number(item.id) === id) : result;
    if (Number(building?.id) !== id) throw new Error('Gebäudebestand konnte nicht bestätigt werden.');
    return building;
  }

  async function vehiclesAt(db, id, refresh = true) {
    if (refresh) await updateVehiclesV2(db, 0);
    const vehicles = await getDataByIndex(db, 'vehicles', 'building_id', id);
    if (vehicles.some(vehicle => vehicle.id == null || vehicle.vehicle_type == null)) {
      throw new Error('Unbekanntes Fahrzeugformat.');
    }
    return vehicles;
  }

  async function confirmState(read, matches, label) {
    for (const delay of [0, 400, 1000]) {
      if (delay) await pause(delay);
      const value = await read();
      if (matches(value)) return value;
    }
    throw new Error(label + ' konnte nicht bestätigt werden.');
  }

  async function currentMax(vehicle) {
    const response = await fetch('/vehicles/' + vehicle.id + '/edit', { cache: 'no-store' });
    if (!response.ok) throw new Error('Fahrzeugbearbeitung HTTP ' + response.status);
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    const value = page.querySelector('[name="vehicle[personal_max]"]')?.value;
    if (value == null || value === '' || !Number.isInteger(Number(value))) {
      throw new Error('Maximalpersonal für Fahrzeug ' + vehicle.id + ' nicht ermittelbar.');
    }
    return Number(value);
  }

  function crewFor(page, type) {
    return personnelRows(page, QUALIFICATION_BY_VEHICLE_TYPE.get(type));
  }

  async function adjustCrew(vehicle, target, phase, act) {
    const read = () => assignmentDocument(vehicle.id);
    const type = Number(vehicle.vehicle_type);
    const assignedRows = doc => [...doc.querySelectorAll('tr')].filter(row => row.querySelector('a.btn-assigned'));
    const adding = phase === 'add';
    const count = doc => assignedRows(doc).length;
    const action = adding ? 'Personal zuweisen' : 'Personal entfernen';
    let page = await read();
    while (adding ? count(page) < target : count(page) > target) {
      const crew = crewFor(page, type);
      const assigned = assignedRows(page);
      const row = adding ? crew.available[0] :
        assigned.findLast(item => !crew.assigned.includes(item)) ?? assigned.at(-1);
      const href = row?.querySelector(adding ? 'a.btn-success' : 'a.btn-assigned')?.getAttribute('href');
      if (!href) {
        throw new Error(adding ? 'Zu wenig geeignetes Personal für Fahrzeug ' + vehicle.id :
          'Kein Link zum Entfernen von Personal für Fahrzeug ' + vehicle.id);
      }
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith('/vehicles/' + vehicle.id + '/')) {
        throw new Error('Unerwarteter Zuweisungslink für Fahrzeug ' + vehicle.id);
      }
      const expected = count(page) + (adding ? 1 : -1);
      await act(action + ' · Fahrzeug ' + vehicle.id, async () => {
        const response = await fetch(url, { method: 'POST', headers: requestHeaders() });
        if (!response.ok) throw new Error(action + ' · HTTP ' + response.status);
      });
      page = await confirmState(read, doc => count(doc) === expected, action);
    }
  }

  const crewModes = [
    ['both', 'Zuweisen und entfernen'],
    ['add', 'Nur zuweisen'],
    ['remove', 'Nur entfernen']
  ];

  function extensionByType(building, type) {
    if (!Array.isArray(building.extensions)) throw new Error('Erweiterungsbestand fehlt.');
    return building.extensions.find(extension => Number(extension.type_id) === type);
  }

  function vehicleGroup(vehicles, type) {
    return vehicles.filter(vehicle => Number(vehicle.vehicle_type) === type);
  }

  function vehicleTarget(rule, building) {
    if (!rule.countByStaff) return rule.count;
    const value = building.personal_count;
    const staff = Number(value);
    if (value == null || value === '' || !Number.isSafeInteger(staff) || staff < 0) {
      throw new Error('Personalzahl für Wache #' + building.id + ' nicht ermittelbar.');
    }
    return staff;
  }

  async function applyTemplate(db, id, template, act, check) {
    const readBuilding = () => buildingState(id);
    let building = await readBuilding();
    if (Number(building.building_type) !== template.type) throw new Error('Gebäudetyp wurde geändert.');
    const targets = new Map(template.vehicles.map(rule => [rule.type, vehicleTarget(rule, building)]));
    if (template.level != null) {
      const readLevel = async () => (await fetchBuildingDetails(id)).currentLevel;
      let level = await readLevel();
      if (level == null) throw new Error('Ausbaustufe nicht ermittelbar.');
      while (level < template.level) {
        const expected = level + 1;
        await act('Ausbaustufe ' + expected + ' kaufen', () => upgradeOneLevel(id, level));
        level = await confirmState(readLevel, value => value >= expected && value != null, 'Ausbau');
      }
    }

    // Ein Kauf kann weitere Erweiterungen freischalten.
    let pending = template.extensions.filter(item => item.buy && !extensionByType(building, item.type));
    while (pending.length) {
      check();
      const offers = await availableExtensionPurchases(id);
      const next = pending.find(item => offers.has(item.type));
      if (!next) throw new Error('Erweiterung derzeit nicht kaufbar: ' + pending.map(item => item.name).join(', '));
      await act(next.name + ' kaufen', () => buyExtension(offers.get(next.type)));
      building = await confirmState(readBuilding, value => !!extensionByType(value, next.type), next.name);
      pending = pending.filter(item => !extensionByType(building, item.type));
    }

    if (template.vehicles.length) {
      let vehicles = await vehiclesAt(db, id);
      for (const rule of template.vehicles) {
        let group = vehicleGroup(vehicles, rule.type);
        const target = targets.get(rule.type);
        while (target != null && group.length < target) {
          const expected = group.length + 1;
          await act(rule.name + ' kaufen', () => buyVehicle(id, rule.type));
          vehicles = await confirmState(
            () => vehiclesAt(db, id),
            value => vehicleGroup(value, rule.type).length >= expected,
            'Fahrzeugkauf'
          );
          group = vehicleGroup(vehicles, rule.type);
        }
      }

      for (const rule of template.vehicles) {
        for (const vehicle of vehicleGroup(vehicles, rule.type)) {
          check();
          const crewMode = rule.crewMode ?? 'add';
          if (rule.crew != null && crewMode !== 'add') {
            await adjustCrew(vehicle, rule.crew, 'remove', act);
          }
          if (rule.max != null && await currentMax(vehicle) !== rule.max) {
            await act(rule.name + ' · Maximalpersonal ' + rule.max,
              () => changeVehicleMaxPersonal(vehicle.id, rule.max));
            await confirmState(() => currentMax(vehicle), value => value === rule.max, 'Maximalpersonal');
          }
          if (rule.crew > 0 && crewMode !== 'remove') {
            await adjustCrew(vehicle, rule.crew, 'add', act);
          }
        }
      }
    }

    for (const rule of template.extensions) {
      check();
      if (rule.enabled == null) continue;
      building = await readBuilding();
      const extension = extensionByType(building, rule.type);
      if (!extension) throw new Error(rule.name + ' fehlt.');
      if (typeof extension.enabled !== 'boolean') throw new Error('Status unbekannt: ' + rule.name);
      if (extension.enabled === rule.enabled) continue;
      const url = (await toggleUrls(id)).get(rule.type);
      if (!url) throw new Error('Umschaltung derzeit nicht verfügbar: ' + rule.name);
      await act(rule.name + (rule.enabled ? ' aktivieren' : ' deaktivieren'), () => buyExtension(url));
      await confirmState(readBuilding,
        value => extensionByType(value, rule.type)?.enabled === rule.enabled, rule.name);
    }

    if (template.enabled != null) {
      building = await readBuilding();
      if ((building.enabled !== false) !== template.enabled) {
        await act(template.enabled ? 'Gebäude aktivieren' : 'Gebäude deaktivieren', () => toggleBuilding(id));
        await confirmState(readBuilding, value => (value.enabled !== false) === template.enabled, 'Gebäudestatus');
      }
    }
  }

  function element(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }

  function button(text, primary = false) {
    return element('button', { type: 'button', class: 'btn btn-' + (primary ? 'primary' : 'default') }, text);
  }

  function select(options) {
    return element('select', { class: 'form-control' },
      ...options.map(([value, name]) => element('option', { value }, name)));
  }

  function label(name, input) {
    return element('label', {}, name, input);
  }

  function numberInput(placeholder = '') {
    return element('input', { class: 'form-control', type: 'number', min: 0, step: 1, placeholder });
  }

  function optionalNumber(input) {
    if (!input.checkValidity()) throw new Error('Bitte nur ganze, nichtnegative Zahlen eingeben.');
    return input.value === '' ? null : input.valueAsNumber;
  }

  const stateChoices = [['', 'Unverändert'], ['on', 'Aktiv'], ['off', 'Inaktiv']];
  const readState = input => input.value ? input.value === 'on' : null;
  const showState = value => value == null ? '' : value ? 'on' : 'off';

  async function mountMastermind(root) {
    const account = await getCurrentAccountId();
    const storageKey = 'nilspe.mastermind.templates.' + account;
    let templates = await GM.getValue(storageKey, {});
    const db = await openDb();

    const logBox = element('pre', { 'aria-live': 'polite', class: 'mm-log' });
    const report = message => {
      logBox.textContent += message + '\n';
      logBox.scrollTop = logBox.scrollHeight;
    };
    const picker = select([['', 'Neue Vorlage']]);
    const name = element('input', { class: 'form-control', placeholder: 'z. B. BePol-Vollausbau' });
    const type = select([['', 'Gebäudetyp wählen']]);
    const level = numberInput('Unverändert');
    const active = select(stateChoices);
    const stationList = element('div', { class: 'mm-stations' });
    const search = element('input', { class: 'form-control', type: 'search', placeholder: 'Wachen suchen' });
    const dispatch = select([['', 'Alle Leitstellen'], ['none', 'Ohne Leitstelle']]);
    const selectAll = button('Alle Treffer auswählen');
    const deselectAll = button('Treffer abwählen');
    const selectionCount = element('span', { role: 'status' });
    const extensionList = element('div');
    const vehicleList = element('div');
    const addVehicle = button('Fahrzeugtyp hinzufügen');
    const bepolPreset = button('BePo-Verband übernehmen');
    const save = button('Vorlage speichern');
    const remove = button('Vorlage löschen');
    const preview = button('Vorschau laden', true);
    const start = button('Ablauf starten', true);
    const stop = button('Nach dem laufenden Schritt anhalten');
    const form = element('fieldset');
    let prepared = null;
    let busy = false;
    let cancelled = false;
    let buildings = [];
    let vehicleOptions = [];
    const chosen = new Set();

    function invalidate() {
      prepared = null;
      start.disabled = true;
    }

    function refreshTemplates(selected = '') {
      picker.replaceChildren(element('option', { value: '' }, 'Neue Vorlage'),
        ...Object.entries(templates).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'de'))
          .map(([id, template]) => element('option', { value: id }, template.name)));
      picker.value = selected;
    }

    function dispatchId(building) {
      return Number(building.leitstelle_building_id ?? building.dispatch_center_id ??
        building.dispatch_center_building_id ?? 0);
    }

    function filteredStations() {
      const query = search.value.trim().toLowerCase();
      return buildings.filter(building => type.value !== '' &&
        Number(building.building_type) === Number(type.value) &&
        (!dispatch.value || dispatchId(building) === (dispatch.value === 'none' ? 0 : Number(dispatch.value))) &&
        (building.caption + ' ' + building.id).toLowerCase().includes(query));
    }

    function drawStations() {
      const matches = filteredStations();
      const rows = document.createDocumentFragment();
      const updateSelection = () => {
        const shown = matches.filter(building => chosen.has(Number(building.id))).length;
        selectionCount.textContent = chosen.size + ' ausgewählt · ' + shown + ' von ' + matches.length + ' Treffern';
        selectAll.disabled = shown === matches.length;
        deselectAll.disabled = shown === 0;
      };
      for (const building of matches) {
        const box = element('input', { type: 'checkbox' });
        const id = Number(building.id);
        box.checked = chosen.has(id);
        box.addEventListener('change', () => {
          if (box.checked) chosen.add(id);
          else chosen.delete(id);
          updateSelection();
          invalidate();
        });
        rows.append(element('label', { class: 'mm-station' }, box, ' ' + building.caption + ' (#' + id + ')'));
      }
      stationList.replaceChildren(rows);
      if (!matches.length) stationList.append('Keine passenden Gebäude.');
      updateSelection();
    }

    function drawExtensions(saved = []) {
      const options = new Map((KNOWN_EXTENSION_OPTIONS.get(Number(type.value)) ?? [])
        .map(item => [item.value, item.name]));
      for (const building of buildings) {
        if (type.value === '' || Number(building.building_type) !== Number(type.value)) continue;
        for (const ext of building.extensions ?? []) {
          const id = Number(ext.type_id);
          if (Number.isInteger(id) && !options.has(id)) options.set(id, ext.caption || 'Erweiterung ' + id);
        }
      }
      for (const item of saved) if (!options.has(item.type)) options.set(item.type, item.name);
      extensionList.replaceChildren(...[...options].map(([id, title]) => {
        const buy = element('input', { type: 'checkbox' });
        const state = select(stateChoices);
        const previous = saved.find(item => item.type === id);
        buy.checked = previous?.buy ?? false;
        state.value = showState(previous?.enabled);
        return element('div', { class: 'mm-extension', 'data-type': id },
          element('span', {}, title), element('label', {}, buy, ' Bei Bedarf kaufen'), label('Status', state));
      }));
    }

    function addVehicleRow(saved = {}) {
      const options = [['', 'Fahrzeugtyp wählen'], ...vehicleOptions];
      if (saved.type != null && !options.some(([id]) => Number(id) === saved.type)) {
        options.push([saved.type, saved.name]);
      }
      const vehicle = select(options);
      const count = numberInput('Unverändert');
      const countMode = select([['fixed', 'Feste Anzahl'], ['staff', '1 Fahrzeug je Mitarbeiter']]);
      const max = numberInput('Unverändert');
      const crew = numberInput('Unverändert');
      const crewMode = select(crewModes);
      const del = button('Entfernen');
      vehicle.value = saved.type ?? '';
      count.value = saved.count ?? '';
      countMode.value = saved.countByStaff ? 'staff' : 'fixed';
      const syncCountMode = () => { count.disabled = countMode.value === 'staff'; };
      countMode.addEventListener('change', syncCountMode);
      syncCountMode();
      max.value = saved.max ?? '';
      crew.value = saved.crew ?? '';
      crewMode.value = saved.crewMode ?? (saved.type == null ? 'both' : 'add');
      const row = element('div', { class: 'mm-vehicle' }, label('Fahrzeugtyp', vehicle),
        label('Bestand nach', countMode), label('Sollbestand', count),
        label('Maximalpersonal', max), label('Zielbesatzung', crew),
        label('Personalaktion', crewMode), del);
      del.addEventListener('click', () => { row.remove(); invalidate(); });
      vehicleList.append(row);
    }

    function readTemplate() {
      if (type.value === '') throw new Error('Bitte einen Gebäudetyp wählen.');
      const vehicles = [...vehicleList.children].map(row => {
        const vehicle = row.querySelector('select');
        const [, countMode, crewMode] = row.querySelectorAll('select');
        const countByStaff = countMode.value === 'staff';
        if (!vehicle.value) throw new Error('Bitte einen Fahrzeugtyp auswählen.');
        const [count, max, crew] = [...row.querySelectorAll('input')].map(input =>
          input.disabled ? null : optionalNumber(input));
        if (max != null && crew != null && crew > max) {
          throw new Error('Die Zielbesatzung darf das Maximalpersonal nicht überschreiten.');
        }
        return { type: Number(vehicle.value), name: vehicle.selectedOptions[0].textContent,
          count, countByStaff, max, crew, crewMode: crewMode.value };
      }).filter(rule => rule.countByStaff || rule.count != null || rule.max != null || rule.crew != null);
      if (new Set(vehicles.map(rule => rule.type)).size !== vehicles.length) {
        throw new Error('Jeden Fahrzeugtyp bitte nur einmal eintragen.');
      }
      const extensions = [...extensionList.children].map(row => ({
        type: Number(row.dataset.type), name: row.firstChild.textContent,
        buy: row.querySelector('input').checked, enabled: readState(row.querySelector('select'))
      })).filter(rule => rule.buy || rule.enabled != null);
      return { name: name.value.trim(), type: Number(type.value), level: optionalNumber(level),
        enabled: readState(active), extensions, vehicles };
    }

    function loadTemplate() {
      const template = templates[picker.value];
      name.value = template?.name ?? '';
      type.value = template?.type ?? '';
      level.value = template?.level ?? '';
      active.value = showState(template?.enabled);
      chosen.clear();
      vehicleList.replaceChildren();
      for (const rule of template?.vehicles ?? []) addVehicleRow(rule);
      drawExtensions(template?.extensions);
      drawStations();
      invalidate();
    }

    function setBusy(value, running = false) {
      busy = value;
      form.disabled = value;
      preview.disabled = value;
      start.disabled = value || !prepared;
      stop.disabled = !running;
    }

    async function action(handler, running = false) {
      if (busy) return;
      setBusy(true, running);
      try {
        await handler();
      } catch (error) {
        report(error.message);
      } finally {
        setBusy(false);
      }
    }

    refreshTemplates();
    picker.addEventListener('change', loadTemplate);
    type.addEventListener('change', () => { chosen.clear(); drawStations(); drawExtensions(); });
    search.addEventListener('input', drawStations);
    dispatch.addEventListener('change', drawStations);
    selectAll.addEventListener('click', () => {
      for (const building of filteredStations()) chosen.add(Number(building.id));
      invalidate();
      drawStations();
    });
    deselectAll.addEventListener('click', () => {
      for (const building of filteredStations()) chosen.delete(Number(building.id));
      invalidate();
      drawStations();
    });
    form.addEventListener('input', invalidate);
    addVehicle.addEventListener('click', () => addVehicleRow());
    bepolPreset.addEventListener('click', () => {
      picker.value = '';
      loadTemplate();
      type.value = '11';
      name.value = 'BePo-Verband';
      addVehicleRow({ type: 50, name: 'GruKw', countByStaff: true, max: 1, crewMode: 'both' });
      drawExtensions();
      drawStations();
    });
    save.addEventListener('click', () => void action(async () => {
      const template = readTemplate();
      if (!template.name) throw new Error('Bitte einen Namen für die Vorlage eingeben.');
      const id = picker.value || crypto.randomUUID();
      const next = { ...templates, [id]: template };
      await GM.setValue(storageKey, next);
      templates = next;
      refreshTemplates(id);
      report('Vorlage gespeichert: ' + template.name);
    }));
    remove.addEventListener('click', () => void action(async () => {
      if (!picker.value || !window.confirm('Diese Vorlage löschen?')) return;
      const next = { ...templates };
      delete next[picker.value];
      await GM.setValue(storageKey, next);
      templates = next;
      refreshTemplates();
      loadTemplate();
    }));

    preview.addEventListener('click', () => void action(async () => {
      invalidate();
      const template = readTemplate();
      const ids = [...chosen];
      if (!ids.length) throw new Error('Bitte mindestens eine Wache auswählen.');
      logBox.textContent = '';
      report('Lade den aktuellen Bestand …');
      if (template.vehicles.length) await updateVehiclesV2(db, 0);
      for (const id of ids) {
        const building = await buildingState(id);
        report('\n' + (building.caption ?? id));
        if (template.level != null) {
          const current = (await fetchBuildingDetails(id)).currentLevel;
          if (current == null) throw new Error('Ausbaustufe nicht ermittelbar.');
          report('  Ausbaustufe ' + current + (current < template.level ? ' → ' + template.level : ' · Soll erreicht'));
        }
        for (const rule of template.extensions) {
          const current = extensionByType(building, rule.type);
          const purchase = rule.buy && !current ? ' · kaufen' : '';
          const status = rule.enabled != null && current?.enabled !== rule.enabled ?
            (rule.enabled ? ' · aktivieren' : ' · deaktivieren') : '';
          report('  ' + rule.name + (purchase + status || ' · Soll erreicht'));
        }
        if (template.vehicles.length) {
          const vehicles = await vehiclesAt(db, id, false);
          for (const rule of template.vehicles) {
            const current = vehicleGroup(vehicles, rule.type).length;
            const target = vehicleTarget(rule, building);
            const deficit = Math.max(0, (target ?? current) - current);
            report('  ' + rule.name + ' · Bestand ' + current + (deficit ? ' · ' + deficit + ' kaufen' : '') +
              (target != null ? ' · Soll ' + target + (rule.countByStaff ? ' laut Personalbestand' : '') : '') +
              (rule.max != null ? ' · Max. ' + rule.max : '') + (rule.crew != null ?
                ' · Zielbesatzung ' + rule.crew + ' (' + crewModes.find(([id]) => id === rule.crewMode)[1] + ')' : ''));
          }
        }
        if (template.enabled != null) {
          report('  Gebäudestatus · ' + (template.enabled ? 'aktiv' : 'inaktiv'));
        }
      }
      prepared = { template, ids };
      report('\nVorschau fertig. Käufe erfolgen mit Credits.');
    }));

    start.addEventListener('click', () => void action(async () => {
      if (!prepared) return;
      const { template, ids } = prepared;
      invalidate();
      cancelled = false;
      const check = () => {
        if (cancelled) throw new Error('Ablauf angehalten.');
      };
      const run = async () => {
        for (const id of ids) {
          check();
          report('\nWache #' + id);
          await applyTemplate(db, id, template, async (message, write) => {
            check();
            report('  ' + message);
            await write();
            await pause(350);
          }, check);
          report('  Fertig.');
        }
        report('\nAblauf abgeschlossen.');
      };
      if (navigator.locks?.request) {
        await navigator.locks.request('nilspe.mastermind.' + account, { ifAvailable: true }, async lock => {
          if (!lock) throw new Error('Mastermind läuft bereits in einem anderen Tab.');
          await run();
        });
      } else {
        throw new Error('Der Browser unterstützt die Sperre für parallele Abläufe nicht.');
      }
    }, true));
    stop.addEventListener('click', () => {
      cancelled = true;
      stop.disabled = true;
      report('Mastermind hält nach dem laufenden Schritt an.');
    });

    form.append(
      element('section', {}, element('h2', {}, 'Vorlage'),
        element('div', { class: 'mm-grid' }, label('Gespeicherte Vorlagen', picker), label('Name', name),
          label('Gebäudetyp', type), label('Zielstufe', level), label('Gebäudestatus', active)),
        element('div', { class: 'mm-actions' }, save, remove, bepolPreset)),
      element('section', {}, element('h2', {}, 'Erweiterungen'), extensionList),
      element('section', {}, element('h2', {}, 'Fahrzeuge und Personal'),
        element('p', {}, 'Personalvorgaben gelten für alle Fahrzeuge des gewählten Typs an der Wache.'),
        vehicleList, addVehicle),
      element('section', {}, element('h2', {}, 'Wachen'),
        element('div', { class: 'mm-grid' }, label('Leitstelle', dispatch), label('Suche', search)),
        element('div', { class: 'mm-actions' }, selectAll, deselectAll, selectionCount), stationList)
    );
    root.append(form, element('div', { class: 'mm-actions' }, preview, start, stop), logBox);
    setBusy(true);
    report('Lade Gebäude- und Fahrzeugtypen …');
    try {
      await Promise.all([updateBuildings(db), updateVehicleTypes(db), updateBuildingTypes(db)]);
      const [stationData, vehicleTypes, buildingTypes] = await Promise.all([
        getAllData(db, 'buildings'), getAllData(db, 'vehicleTypes'), getAllData(db, 'buildingTypes')
      ]);
      buildings = stationData.sort((a, b) => String(a.caption).localeCompare(String(b.caption), 'de'));
      vehicleOptions = vehicleTypes.map(item => [item.id, item.caption || 'Fahrzeugtyp ' + item.id])
        .sort(([, a], [, b]) => a.localeCompare(b, 'de'));
      const typeNames = new Map(buildingTypes.map(item => [Number(item.id), item.caption]));
      if (!typeNames.has(11)) typeNames.set(11, 'Bereitschaftspolizei');
      for (const building of buildings) {
        const id = Number(building.building_type);
        if (Number.isInteger(id) && !typeNames.has(id)) typeNames.set(id, 'Gebäudetyp ' + id);
      }
      for (const [id, caption] of [...typeNames].sort(([, a], [, b]) =>
        String(a).localeCompare(String(b), 'de'))) {
        type.append(element('option', { value: id }, caption || 'Gebäudetyp ' + id));
      }
      for (const center of buildings.filter(item => Number(item.building_type) === 7)) {
        dispatch.append(element('option', { value: center.id }, center.caption || 'Leitstelle #' + center.id));
      }
      const initial = Number(new URLSearchParams(location.search).get('building'));
      const station = buildings.find(item => Number(item.id) === initial);
      if (station && Number(station.building_type) === 7) {
        dispatch.value = String(initial);
      } else if (station) {
        type.value = station.building_type;
        chosen.add(initial);
      }
      drawExtensions();
      drawStations();
      logBox.textContent = '';
      setBusy(false);
    } catch (error) {
      db.close();
      throw error;
    }
  }

  const masterUrl = '/settings/index?mastermind=1';
  if (location.pathname === '/settings/index' && new URLSearchParams(location.search).has('mastermind')) {
    document.title = 'Mastermind · Leitstellenspiel';
    const root = element('main', { id: 'nilspe-mastermind' }, element('h1', {}, 'Mastermind'));
    document.body.replaceChildren(root);
    document.head.append(element('style', {}, `
      #nilspe-mastermind { max-width: 1120px; padding: 24px; margin: auto; }
      #nilspe-mastermind section { border: 1px solid #8887; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
      #nilspe-mastermind h2 { font-size: 20px; margin: 0 0 12px; }
      #nilspe-mastermind .mm-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      #nilspe-mastermind .mm-vehicle, #nilspe-mastermind .mm-extension { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
      #nilspe-mastermind .mm-vehicle label:first-child, #nilspe-mastermind .mm-extension span { flex: 1 1 230px; }
      #nilspe-mastermind .mm-vehicle input { max-width: 145px; }
      #nilspe-mastermind .mm-stations { max-height: 260px; overflow: auto; margin-top: 8px; }
      #nilspe-mastermind .mm-station { display: block; font-weight: normal; padding: 3px; }
      #nilspe-mastermind .mm-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
      #nilspe-mastermind .mm-log { max-height: 330px; overflow: auto; white-space: pre-wrap; color: inherit; background: transparent; }
    `));
    void mountMastermind(root).catch(error => root.append(element('p', { role: 'alert' }, error.message)));
  } else {
    const building = location.pathname.match(/^\/buildings\/(\d+)\/?$/)?.[1];
    if (location.pathname === '/' || building) {
      const link = element('a', {
        href: masterUrl + (building ? '&building=' + building : ''),
        target: '_blank', rel: 'noopener', class: 'btn btn-default'
      }, 'Mastermind');
      const heading = building ? document.querySelector('h1[building_type]') : null;
      if (heading) heading.after(link);
      else {
        link.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:1050';
        document.body.append(link);
      }
    }
  }
})();
