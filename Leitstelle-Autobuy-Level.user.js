
// ==UserScript==
// @name         Leitstelle Autobuy Level
// @namespace    NilsPe.autobuy.level.api
// @version      2.6.1
// @description  Direktausbau bis zur absoluten Zielstufe mit Weiterleitungs- und Sicherheitsprüfung
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Level.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Level.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const PREFIX = '[Autobuy Level]';
  const VERSION = '2.6.1';

  const BUILDING_TYPES = [
    { id: 0, label: 'Feuerwache' },
    { id: 1, label: 'Feuerwehrschule' },
    { id: 2, label: 'Rettungswache' },
    { id: 3, label: 'Rettungsschule' },
    { id: 4, label: 'Krankenhaus' },
    { id: 5, label: 'Rettungshubschrauber-Station' },
    { id: 6, label: 'Polizeiwache' },
    { id: 7, label: 'Leitstelle' },
    { id: 8, label: 'Polizeischule' },
    { id: 9, label: 'THW-Ortsverband' },
    { id: 10, label: 'THW Bundesschule' },
    { id: 11, label: 'Bereitschaftspolizei' },
    { id: 12, label: 'Schnelleinsatzgruppe (SEG)' },
    { id: 13, label: 'Polizeihubschrauberstation' },
    { id: 14, label: 'Bereitstellungsraum' },
    { id: 15, label: 'Wasserrettung' },
    { id: 16, label: 'Verbandszellen' },
    { id: 17, label: 'Polizei-Sondereinheiten' },
    { id: 18, label: 'Feuerwache (Kleinwache)' },
    { id: 19, label: 'Polizeiwache (Kleinwache)' },
    { id: 20, label: 'Rettungswache (Kleinwache)' },
    { id: 21, label: 'Rettungshundestaffel' },
    { id: 22, label: 'Großer Komplex' },
    { id: 23, label: 'Kleiner Komplex' },
    { id: 24, label: 'Reiterstaffel' },
    { id: 25, label: 'Bergrettung' },
    { id: 26, label: 'Seenotrettungswache' },
    { id: 27, label: 'Schule für Seefahrt und Seenotrettung' },
    { id: 28, label: 'Hubschrauberstation (Seenotrettung)' }
  ];

  const SETTINGS_IDENTIFIER = 'autobuy_level_types';
  const KEY_LEVEL_PREFIX = 'abl_target_level_';
  const KEY_DELAY_BUILDING = 'abl_delay_per_building';
  const KEY_DELAY_FETCH = 'abl_delay_after_fetch';

  const DEFAULT_DELAY_BUILDING = 100;
  const DEFAULT_DELAY_FETCH = 100;

  const RUN_FLAG = 'abl_run_flag';

  const CFG = {
    verifyRetries: 4,
    verifyRetryDelay: 300,
    debug: true
  };

  const targetCache = new Map();
  const supportedTypes = new Set(
    BUILDING_TYPES.map(t => t.id)
  );

  let running = false;
  let cancelled = false;

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function log(...args) {
    if (CFG.debug) {
      console.log(PREFIX, ...args);
    }
  }

  function warn(...args) {
    console.warn(PREFIX, ...args);
  }

  /*
   * ==========================================
   * EINSTELLUNGEN
   * ==========================================
   */

  if (location.pathname.startsWith('/settings/index')) {
    if (typeof addOptions !== 'function') {
      console.error(PREFIX, 'NilsPe-Skriptbasis fehlt');
      return;
    }

    const typeInputs = BUILDING_TYPES.map(type => ({
      type: 'number',
      key: KEY_LEVEL_PREFIX + type.id,
      default: 0,
      min: 0,
      max: 50,
      label: `${type.id} ${type.label} – Zielstufe`
    }));

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Autobuy Level',
      settings: [
        {
          type: 'header',
          text: 'Absolute Zielstufen je Gebäudetyp'
        },
        ...typeInputs,
        {
          type: 'header',
          text: 'Ablauf'
        },
        {
          type: 'number',
          key: KEY_DELAY_BUILDING,
          default: DEFAULT_DELAY_BUILDING,
          min: 0,
          max: 5000,
          label: 'Pause nach einem Direktkauf [ms]'
        },
        {
          type: 'number',
          key: KEY_DELAY_FETCH,
          default: DEFAULT_DELAY_FETCH,
          min: 0,
          max: 5000,
          label: 'Delay nach HTML-Fallback [ms]'
        }
      ]
    });

    return;
  }

  /*
   * ==========================================
   * KONFIGURATION
   * ==========================================
   */

  async function getTargetLevel(typeId) {
    const key = String(typeId);

    if (!targetCache.has(key)) {
      const value = Number(
        await GM.getValue(
          KEY_LEVEL_PREFIX + key,
          0
        )
      );

      targetCache.set(
        key,
        Number.isInteger(value) && value > 0
          ? value
          : 0
      );
    }

    return targetCache.get(key);
  }

  async function getConfiguredDelays() {
    const rawB = Number(
      await GM.getValue(
        KEY_DELAY_BUILDING,
        DEFAULT_DELAY_BUILDING
      )
    );

    const rawF = Number(
      await GM.getValue(
        KEY_DELAY_FETCH,
        DEFAULT_DELAY_FETCH
      )
    );

    return {
      delayB: Number.isFinite(rawB)
        ? Math.max(0, rawB)
        : DEFAULT_DELAY_BUILDING,

      delayF: Number.isFinite(rawF)
        ? Math.max(0, rawF)
        : DEFAULT_DELAY_FETCH
    };
  }

  function isSupportedType(typeId) {
    return supportedTypes.has(Number(typeId));
  }

  function getBuildingIdFromUrl() {
    const match = location.pathname.match(
      /\/buildings\/(\d+)/
    );

    return match ? Number(match[1]) : null;
  }

  function getCsrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ?? '';
  }

  function isRunning() {
    return running &&
      !cancelled &&
      sessionStorage.getItem(RUN_FLAG) === 'true';
  }

  /*
   * ==========================================
   * GEBÄUDETABELLE AUSLESEN
   * ==========================================
   *
   * td[0] = Symbol
   * td[1] = Name / Gebäude-ID / Gebäudetyp
   * td[2] = Ausbaustufe
   */

  function parseBuildingTable(doc) {
    const table = doc.querySelector('#building_table');

    if (!table) return [];

    const result = [];
    const seen = new Set();

    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = row.querySelectorAll(':scope > td');

      if (cells.length < 3) continue;

      const link = cells[1].querySelector(
        'a[href*="/buildings/"]'
      );

      if (!link) continue;

      const match = link.getAttribute('href')
        ?.match(/\/buildings\/(\d+)/);

      if (!match) continue;

      const id = Number(match[1]);

      const typeAttribute = link.getAttribute(
        'building_type'
      );

      if (typeAttribute === null) continue;

      const type = Number(typeAttribute);
      const levelText = cells[2].textContent.trim();

      const level = /^\d+$/.test(levelText)
        ? Number(levelText)
        : null;

      if (
        !Number.isInteger(id) ||
        !Number.isInteger(type) ||
        !isSupportedType(type) ||
        seen.has(id)
      ) {
        continue;
      }

      seen.add(id);

      result.push({
        id,
        name: link.textContent.trim(),
        type,
        currentLevel: level,
        source: 'Leitstellen-Tabelle'
      });
    }

    return result;
  }

  /*
   * ==========================================
   * AUSBAUSTUFE AUS GEBÄUDESEITE
   * ==========================================
   *
   * Unbekannte Stufe = null.
   * Niemals automatisch Stufe 0 annehmen.
   */

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

  function validateBuildingType(building, details) {
    if (
      details.type !== null &&
      Number.isInteger(details.type) &&
      details.type !== building.type
    ) {
      throw new Error(
        `Gebäudetyp stimmt nicht überein: ` +
        `${building.type} / ${details.type}`
      );
    }
  }

  /*
   * ==========================================
   * AKTUELLE STUFE BESTIMMEN
   * ==========================================
   */

  async function getInitialLevel(building) {
    if (
      Number.isInteger(building.currentLevel) &&
      building.currentLevel >= 0
    ) {
      return building.currentLevel;
    }

    log(
      'Stufe unbekannt, prüfe Einzelseite:',
      building.id
    );

    const details = await fetchBuildingDetails(
      building.id
    );

    validateBuildingType(building, details);

    if (
      !Number.isInteger(details.currentLevel) ||
      details.currentLevel < 0
    ) {
      throw new Error(
        `Aktuelle Stufe von Gebäude ${building.id} ` +
        `konnte nicht ermittelt werden`
      );
    }

    return details.currentLevel;
  }

  /*
   * ==========================================
   * API / INDEXEDDB
   * ==========================================
   *
   * API nur zur Gebäudezuordnung.
   * Keine Kaufentscheidung anhand des API-Levels.
   */

  function normalizeApiBuilding(building) {
    const dispatchCenterId =
      building.leitstelle_building_id ??
      building.dispatch_center_id ??
      building.dispatch_center_building_id ??
      null;

    return {
      id: Number(building.id),

      name: building.caption ??
        building.name ??
        `Gebäude ${building.id}`,

      type: Number(building.building_type),

      leitstelle_building_id:
        dispatchCenterId === null
          ? null
          : Number(dispatchCenterId)
    };
  }

  async function openUpdatedBuildingDb() {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function'
    ) {
      throw new Error(
        'NilsPe-Skriptbasis nicht verfügbar'
      );
    }

    const db = await openDb();

    try {
      const updated = await updateBuildings(db, 60);

      if (updated === false) {
        const count = await getCount(
          db,
          'buildings'
        );

        if (count === 0) {
          throw new Error(
            'Gebäude-Cache leer und Aktualisierung fehlgeschlagen'
          );
        }
      }

      return db;

    } catch (error) {
      db.close();
      throw error;
    }
  }

  async function getBuildingsFromApi(leitstellenId) {
    const db = await openUpdatedBuildingDb();

    try {
      let rawBuildings = await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        IDBKeyRange.only(Number(leitstellenId))
      );

      if (!rawBuildings.length) {
        rawBuildings = await getAllData(
          db,
          'buildings'
        );
      }

      return rawBuildings
        .map(normalizeApiBuilding)
        .filter(building =>
          building.leitstelle_building_id ===
            Number(leitstellenId) &&
          Number.isInteger(building.id) &&
          isSupportedType(building.type)
        );

    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * LEITSTELLEN-TABELLE LADEN
   * ==========================================
   */

  async function getBuildingTable(leitstellenId) {
    const response = await fetch(
      `/buildings/${leitstellenId}/leitstelle-buildings`,
      {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gebäudetabelle HTTP ${response.status}`
      );
    }

    const doc = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );

    const buildings = parseBuildingTable(doc);

    if (buildings.length) {
      return buildings;
    }

    const fallback = parseBuildingTable(document);

    if (fallback.length) {
      warn(
        'Serverantwort ohne Gebäudetabelle. ' +
        'Verwende sichtbare Tabelle.'
      );
    }

    return fallback;
  }

  async function getBuildingsOfLeitstelle(leitstellenId) {
    let apiBuildings = [];
    let tableBuildings = [];

    try {
      apiBuildings = await getBuildingsFromApi(
        leitstellenId
      );
    } catch (error) {
      warn('API-Liste nicht verfügbar:', error);
    }

    try {
      tableBuildings = await getBuildingTable(
        leitstellenId
      );
    } catch (error) {
      warn('Gebäudetabelle nicht verfügbar:', error);
    }

    const result = new Map();

    for (const building of apiBuildings) {
      result.set(building.id, {
        ...building,
        currentLevel: null,
        source: 'API'
      });
    }

    for (const building of tableBuildings) {
      const existing = result.get(building.id);

      result.set(building.id, {
        ...existing,
        ...building
      });
    }

    const buildings = [...result.values()]
      .sort((a, b) => a.id - b.id);

    log('Gebäude geladen:', {
      api: apiBuildings.length,
      table: tableBuildings.length,
      total: buildings.length
    });

    return buildings;
  }

  /*
   * ==========================================
   * DIREKTAUSBAU – VERSION 2.6.1
   * ==========================================
   *
   * level = Zielstufe - 1
   *
   * Neu:
   *
   * Bei redirect: 'manual' kann Chrome
   * eine opaqueredirect-Antwort zurückgeben.
   *
   * Diese besitzt:
   *
   * status = 0
   * type   = 'opaqueredirect'
   *
   * Das ist kein bestätigter Kauf,
   * aber auch kein unmittelbarer Fehler.
   *
   * Die anschließende Stufenprüfung
   * entscheidet über den Erfolg.
   */

  async function buyDirectLevel(building, targetLevel) {
    if (
      !Number.isInteger(targetLevel) ||
      targetLevel <= 0
    ) {
      throw new Error('Ungültige Zielstufe');
    }

    const token = getCsrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token nicht gefunden'
      );
    }

    const parameter = targetLevel - 1;

    const url =
      `/buildings/${building.id}/expand_do/credits` +
      `?level=${parameter}`;

    log(
      'Direktkauf wird gesendet:',
      building.name,
      'Zielstufe:',
      targetLevel,
      'Parameter:',
      parameter
    );

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
     * NEU IN VERSION 2.6.1
     *
     * Eine opaqueredirect-Antwort ist
     * eine vom Browser verborgene Weiterleitung.
     *
     * Status 0 darf deshalb nicht pauschal
     * als fehlgeschlagener Kauf gelten.
     */

    if (response.type === 'opaqueredirect') {
      log(
        'Weiterleitung nach Direktkauf erkannt:',
        building.id,
        'HTTP 0 / opaqueredirect',
        'Prüfe jetzt die tatsächliche Stufe.'
      );

      return {
        status: 0,
        redirected: true,
        needsVerification: true
      };
    }

    /*
     * Andere Status-0-Antworten gelten
     * weiterhin als nicht zulässig.
     */

    if (response.status === 0) {
      throw new Error(
        `Unbekannte Antwort bei Gebäude ${building.id}: ` +
        `HTTP 0, Typ ${response.type}`
      );
    }

    /*
     * Normale HTTP-Erfolgsantworten und
     * explizite Weiterleitungen akzeptieren.
     *
     * Auch hier bestätigt erst die
     * spätere Stufenprüfung den Kauf.
     */

    if (
      !response.ok &&
      response.status !== 302 &&
      response.status !== 303
    ) {
      throw new Error(
        `Direktkauf HTTP ${response.status}`
      );
    }

    log(
      'Direktkauf-Anfrage abgeschlossen:',
      building.id,
      'HTTP:',
      response.status,
      'Typ:',
      response.type
    );

    return {
      status: response.status,
      redirected:
        response.status === 302 ||
        response.status === 303,
      needsVerification: true
    };
  }

  /*
   * ==========================================
   * DIREKTAUSBAU KONTROLLIEREN
   * ==========================================
   *
   * Ein erfolgreicher Request allein
   * reicht nicht als Bestätigung.
   *
   * Es muss die tatsächliche Sollstufe
   * gelesen werden.
   *
   * Kein automatischer zweiter Kauf.
   */

  async function verifyDirectUpgrade(
    building,
    targetLevel
  ) {
    let lastLevel = null;
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= CFG.verifyRetries;
      attempt++
    ) {
      if (!isRunning()) {
        throw new Error('Lauf abgebrochen');
      }

      if (attempt > 1) {
        await sleep(CFG.verifyRetryDelay);
      }

      try {
        const details = await fetchBuildingDetails(
          building.id
        );

        validateBuildingType(building, details);

        lastLevel = details.currentLevel;

        if (lastLevel === targetLevel) {
          log(
            '✓ Direktausbau bestätigt:',
            building.name,
            'Stufe:',
            lastLevel
          );

          return {
            confirmed: true,
            level: lastLevel
          };
        }

        /*
         * Eine höhere Stufe als gewünscht
         * ist ein Fehler.
         *
         * Keine weiteren Käufe.
         */

        if (
          Number.isInteger(lastLevel) &&
          lastLevel > targetLevel
        ) {
          throw new Error(
            `Gebäude ${building.id} steht auf Stufe ` +
            `${lastLevel}, Ziel war ${targetLevel}`
          );
        }

        warn(
          'Direktausbau noch nicht bestätigt:',
          building.id,
          `Versuch ${attempt}/${CFG.verifyRetries}`,
          'Ist:',
          lastLevel,
          'Soll:',
          targetLevel
        );

      } catch (error) {
        lastError = error;

        if (
          error.message?.includes(
            'Gebäudetyp stimmt nicht'
          ) ||
          error.message?.includes(
            'Ziel war'
          )
        ) {
          throw error;
        }

        warn(
          'Kontrolle fehlgeschlagen:',
          building.id,
          error
        );
      }
    }

    throw new Error(
      `Direktausbau bei Gebäude ${building.id} ` +
      `nicht bestätigt. Soll ${targetLevel}, ` +
      `zuletzt gelesen ${lastLevel}. ` +
      `Kein weiterer Kauf ausgeführt.` +
      (lastError ? ` ${lastError.message}` : '')
    );
  }

  /*
   * ==========================================
   * ABSOLUTE ZIELSTUFE
   * ==========================================
   */

  async function upgradeToTarget(
    building,
    targetLevel
  ) {
    const currentLevel = await getInitialLevel(
      building
    );

    /*
     * Ist >= Soll:
     * Sofort überspringen.
     */

    if (currentLevel >= targetLevel) {
      log(
        'Gebäude übersprungen:',
        building.name,
        `Ist ${currentLevel}, Soll ${targetLevel}`
      );

      return {
        status: 'skipped',
        initialLevel: currentLevel,
        finalLevel: currentLevel,
        requests: 0
      };
    }

    if (!isRunning()) {
      throw new Error('Lauf abgebrochen');
    }

    setState(
      `${building.name}: ${currentLevel} → ${targetLevel}`,
      'info'
    );

    /*
     * Nur eine Kaufanfrage.
     */

    const purchase = await buyDirectLevel(
      building,
      targetLevel
    );

    log(
      'Prüfe Direktkauf:',
      building.id,
      purchase
    );

    /*
     * Auch bei HTTP 0 / opaqueredirect
     * wird hier die Stufe überprüft.
     */

    const verification = await verifyDirectUpgrade(
      building,
      targetLevel
    );

    return {
      status: 'upgraded',
      initialLevel: currentLevel,
      finalLevel: verification.level,
      requests: 1
    };
  }

  /*
   * ==========================================
   * FORTSCHRITTSBALKEN
   * ==========================================
   */

  function ensureStyles() {
    if (document.getElementById('abl-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'abl-style';

    style.textContent = `
      #abl-nav {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        background: #f8f8f8;
        border-top: 1px solid #e7e7e7;
        z-index: 2147483000;
        padding: 7px 10px;
      }

      body.abl-hasbar {
        padding-bottom: 45px !important;
      }

      #abl-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #abl-state {
        min-width: 260px;
        font-size: 13px;
        white-space: normal;
      }

      #abl-progress {
        flex: 1;
        height: 12px;
        background: #eee;
        border-radius: 4px;
        overflow: hidden;
        display: flex;
      }

      #abl-bar-ok {
        height: 100%;
        background: #5cb85c;
        width: 0%;
      }

      #abl-bar-err {
        height: 100%;
        background: #d9534f;
        width: 0%;
      }
    `;

    document.head.append(style);
  }

  function createNavbar() {
    if (document.getElementById('abl-nav')) {
      return;
    }

    ensureStyles();

    const nav = document.createElement('div');
    nav.id = 'abl-nav';

    const wrap = document.createElement('div');
    wrap.id = 'abl-wrap';

    const label = document.createElement('span');
    label.id = 'abl-state';
    label.className = 'label label-info';
    label.textContent = 'Bereit';

    const progress = document.createElement('div');
    progress.id = 'abl-progress';

    const ok = document.createElement('div');
    ok.id = 'abl-bar-ok';

    const err = document.createElement('div');
    err.id = 'abl-bar-err';

    progress.append(ok, err);
    wrap.append(label, progress);
    nav.append(wrap);

    document.body.append(nav);
    document.body.classList.add('abl-hasbar');
  }

  function setState(text, cls = 'info') {
    const label = document.getElementById('abl-state');

    if (!label) return;

    label.className = `label label-${cls}`;
    label.textContent = text;
  }

  function updateProgress(done, errors, total) {
    const okBar = document.getElementById('abl-bar-ok');
    const errBar = document.getElementById('abl-bar-err');

    if (!okBar || !errBar) return;

    const safeTotal = Math.max(total, 1);

    okBar.style.width =
      `${done / safeTotal * 100}%`;

    errBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  /*
   * ==========================================
   * LEITSTELLENLAUF
   * ==========================================
   *
   * 1. Gebäudeliste laden
   * 2. Ist >= Soll überspringen
   * 3. Ist < Soll direkt kaufen
   * 4. Ergebnis verifizieren
   *
   * Keine parallelen Käufe.
   */

  async function runAutobuyLevelForLeitstelle(
    leitstellenId
  ) {
    if (running) return;

    running = true;
    cancelled = false;

    sessionStorage.setItem(RUN_FLAG, 'true');

    createNavbar();
    setState('Lade Gebäudeliste...', 'info');

    try {
      const { delayB } = await getConfiguredDelays();

      const buildings = await getBuildingsOfLeitstelle(
        leitstellenId
      );

      if (!buildings.length) {
        setState('Keine Gebäude gefunden', 'warning');
        return;
      }

      const configured = [];

      for (const building of buildings) {
        const target = await getTargetLevel(
          building.type
        );

        if (target <= 0) continue;

        configured.push({
          ...building,
          target
        });
      }

      if (!configured.length) {
        setState(
          'Keine Zielstufen eingestellt',
          'warning'
        );
        return;
      }

      /*
       * SCHNELLE VORAUSWAHL
       */

      let skipped = 0;
      const candidates = [];

      for (const building of configured) {
        const level = building.currentLevel;

        if (
          Number.isInteger(level) &&
          level >= building.target
        ) {
          skipped++;
          continue;
        }

        candidates.push(building);
      }

      const total = configured.length;

      log('Vorauswahl:', {
        configured: total,
        skipped,
        candidates: candidates.length
      });

      updateProgress(skipped, 0, total);

      if (!candidates.length) {
        setState(
          `Alle ${skipped} Gebäude bereits auf Zielstufe`,
          'success'
        );
        return;
      }

      let upgraded = 0;
      let errors = 0;
      let additionalSkipped = 0;
      let directPurchases = 0;

      /*
       * NUR GEBÄUDE UNTER SOLL
       */

      for (const building of candidates) {
        if (!isRunning()) break;

        setState(
          `${building.name}: Soll ${building.target}`,
          'info'
        );

        let purchasedSuccessfully = false;

        try {
          const result = await upgradeToTarget(
            building,
            building.target
          );

          if (result.status === 'skipped') {
            additionalSkipped++;
          } else {
            upgraded++;
            directPurchases++;
            purchasedSuccessfully = true;
          }

          log(
            'Gebäude abgeschlossen:',
            building.name,
            result
          );

        } catch (error) {
          errors++;

          console.error(
            PREFIX,
            'Gebäude fehlgeschlagen:',
            building.id,
            building.name,
            error
          );
        }

        const done =
          skipped + additionalSkipped + upgraded;

        updateProgress(
          done,
          errors,
          total
        );

        setState(
          `${upgraded} ausgebaut, ` +
          `${skipped + additionalSkipped} übersprungen, ` +
          `${errors} Fehler`,
          errors ? 'warning' : 'info'
        );

        /*
         * Pause nur nach einem erfolgreich
         * bestätigten Direktkauf.
         */

        if (
          purchasedSuccessfully &&
          delayB > 0 &&
          isRunning()
        ) {
          await sleep(delayB);
        }
      }

      log('Leitstellenlauf beendet:', {
        total,
        upgraded,
        skipped: skipped + additionalSkipped,
        errors,
        directPurchases
      });

      setState(
        cancelled
          ? 'Abgebrochen'
          : `Fertig: ${upgraded} ausgebaut, ` +
            `${skipped + additionalSkipped} übersprungen, ` +
            `${errors} Fehler`,
        cancelled || errors ? 'warning' : 'success'
      );

    } catch (error) {
      console.error(
        PREFIX,
        'Leitstellenlauf fehlgeschlagen:',
        error
      );

      setState(
        `Fehler: ${error.message ?? error}`,
        'danger'
      );

    } finally {
      running = false;
      sessionStorage.removeItem(RUN_FLAG);
    }
  }

  /*
   * ==========================================
   * BUTTONS
   * ==========================================
   */

  function settingsButton() {
    const button = document.createElement('a');

    button.className = 'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';

    button.append(icon);

    return button;
  }

  function addButtonToDetails(
    id,
    label,
    onClick
  ) {
    const details = document.querySelector(
      '.building-title ~ dl.dl-horizontal'
    );

    if (
      !details ||
      document.getElementById(id)
    ) {
      return;
    }

    const dt = document.createElement('dt');
    const title = document.createElement('strong');

    title.textContent = 'Gebäudestufen kaufen:';
    dt.append(title);

    const dd = document.createElement('dd');

    const group = document.createElement('div');
    group.id = id;
    group.className = 'btn-group';

    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'btn btn-default btn-xs';
    start.textContent = label;

    start.addEventListener('click', async () => {
      if (running) return;

      start.disabled = true;

      try {
        await onClick();
      } finally {
        start.disabled = false;
      }
    });

    group.append(
      start,
      settingsButton()
    );

    dd.append(group);
    details.append(dt, dd);
  }

  /*
   * ==========================================
   * SEITE ERKENNEN
   * ==========================================
   */

  const h1 = document.querySelector(
    'h1[building_type]'
  );

  if (!h1) return;

  const buildingTypeId = Number(
    h1.getAttribute('building_type')
  );

  const buildingId = getBuildingIdFromUrl();

  if (!Number.isInteger(buildingId)) {
    return;
  }

  /*
   * ==========================================
   * LEITSTELLE
   * ==========================================
   */

  if (buildingTypeId === 7) {
    addButtonToDetails(
      'abl-building-details-buttons',
      'Autobuy Level',
      async () => {
        await runAutobuyLevelForLeitstelle(
          buildingId
        );
      }
    );

    log('Version', VERSION, 'geladen');
    return;
  }

  /*
   * ==========================================
   * EINZELGEBÄUDE
   * ==========================================
   */

  if (!isSupportedType(buildingTypeId)) {
    return;
  }

  addButtonToDetails(
    'abl-single-building-details-buttons',
    'Autobuy Level',
    async () => {
      const target = await getTargetLevel(
        buildingTypeId
      );

      if (target <= 0) {
        alert('Keine Zielstufe eingestellt');
        return;
      }

      if (running) return;

      running = true;
      cancelled = false;

      sessionStorage.setItem(RUN_FLAG, 'true');
      createNavbar();

      try {
        const building = {
          id: buildingId,
          name: h1.textContent.trim(),
          type: buildingTypeId,
          currentLevel: parseLevelFromDoc(document)
        };

        /*
         * Ist >= Soll:
         * Sofort überspringen.
         */

        if (
          Number.isInteger(building.currentLevel) &&
          building.currentLevel >= target
        ) {
          setState(
            `Bereits Stufe ${building.currentLevel} (Soll ${target})`,
            'success'
          );

          updateProgress(1, 0, 1);
          return;
        }

        /*
         * Direkter Ausbau auf Soll.
         */

        const result = await upgradeToTarget(
          building,
          target
        );

        setState(
          result.status === 'skipped'
            ? `Bereits Stufe ${result.finalLevel}`
            : `Stufe ${result.finalLevel} erreicht`,
          'success'
        );

        updateProgress(1, 0, 1);

        /*
         * Gewollter Reload nur nach
         * erfolgreich bestätigtem Kauf.
         */

        if (result.status === 'upgraded') {
          setTimeout(
            () => location.reload(),
            700
          );
        }

      } catch (error) {
        console.error(
          PREFIX,
          'Einzelgebäude fehlgeschlagen:',
          error
        );

        setState(
          `Fehler: ${error.message ?? error}`,
          'danger'
        );

        updateProgress(0, 1, 1);

      } finally {
        running = false;
        sessionStorage.removeItem(RUN_FLAG);
      }
    }
  );

  log('Version', VERSION, 'geladen');

})();
