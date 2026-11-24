
// ==UserScript==
// @name         Leitstelle Autobuy Level
// @namespace    NilsPe.autobuy.level.api
// @version      2.8.2
// @description  Direktausbau bis zur absoluten Zielstufe mit Weiterleitungs- und Sicherheitsprüfung
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Level.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Level.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @match        https://leitstellenspiel.de/buildings/*
// @match        https://leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const PREFIX = '[Autobuy Level]';
  const VERSION = '2.8.2';

  const BUILDING_TYPES = [
    { id: 0, label: 'Feuerwache', maxLevel: 19 },
    { id: 2, label: 'Rettungswache', maxLevel: 14 },
    { id: 4, label: 'Krankenhaus', maxLevel: 20 },
    { id: 5, label: 'Rettungshubschrauber-Station', maxLevel: 14 },
    { id: 6, label: 'Polizeiwache', maxLevel: 14 },
    { id: 15, label: 'Wasserrettung', maxLevel: 5 },
    { id: 18, label: 'Feuerwache (Kleinwache)', maxLevel: 5 },
    { id: 19, label: 'Polizeiwache (Kleinwache)', maxLevel: 5 },
    { id: 20, label: 'Rettungswache (Kleinwache)', maxLevel: 5 },
    { id: 21, label: 'Rettungshundestaffel', maxLevel: 5 },
    { id: 22, label: 'Großer Komplex', maxLevel: 5 },
    { id: 23, label: 'Kleiner Komplex', maxLevel: 5 },
    { id: 25, label: 'Bergrettungswache', maxLevel: 14 },
    { id: 26, label: 'Seenotrettungswache', maxLevel: 4 },
    { id: 29, label: 'Autobahnpolizei', maxLevel: 9 }
  ];

  const SETTINGS_IDENTIFIER = 'autobuy_level_types';
  const KEY_LEVEL_PREFIX = 'abl_target_level_';
  const KEY_DISABLED_PREFIX = 'abl_disabled_type_';
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
    if (typeof waitForSettingsDom !== 'function' ||
        typeof createSettingsPane !== 'function') {
      console.error(PREFIX, 'NilsPe-Skriptbasis fehlt');
      return;
    }
    if (!await waitForSettingsDom()) return;

    const { anchor, body } = createSettingsPane(
      SETTINGS_IDENTIFIER, 'Autobuy Level'
    );
    let rendered = false;
    anchor.addEventListener('click', () => void renderSettings());

    async function renderSettings() {
      if (rendered) return;
      rendered = true;
      const title = document.createElement('h2');
      title.textContent = 'Absolute Zielstufen je Gebäudetyp';
      body.append(title);

      for (const type of BUILDING_TYPES) {
        const targetKey = KEY_LEVEL_PREFIX + type.id;
        const disabledKey = KEY_DISABLED_PREFIX + type.id;
        let target = Math.min(type.maxLevel, Number(await GM.getValue(targetKey, 0)));
        let active = !(await GM.getValue(disabledKey, false));

        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:240px minmax(max-content,1fr) 40px;align-items:center;gap:12px;padding:6px 8px;margin-bottom:4px;border:1px solid;border-radius:3px;overflow-x:auto';
        const name = document.createElement('span');
        name.textContent = `${type.label} (${type.id})`;
        name.style.whiteSpace = 'nowrap';
        const levels = document.createElement('div');
        levels.style.cssText = 'display:flex;align-items:center;flex-wrap:nowrap;gap:4px';
        const levelButtons = [];
        for (let level = 1; level <= type.maxLevel; level++) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-default btn-xs';
          button.textContent = String(level);
          button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:28px;height:28px;margin:0;padding:2px 5px;vertical-align:middle;font-size:13px;line-height:1';
          button.title = `Zielstufe ${level}`;
          button.addEventListener('click', async () => {
            target = target === level ? 0 : level;
            updateRow();
            await GM.setValue(targetKey, target);
          });
          levelButtons.push(button);
          levels.append(button);
        }
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:32px;height:28px;margin:0;padding:2px 5px;vertical-align:middle;font-size:13px;line-height:1';
        function updateRow() {
          row.style.background = active ? 'rgba(92, 184, 92, .10)' : '#8881';
          row.style.borderColor = active ? 'rgba(92, 184, 92, .35)' : '#8885';
          name.style.opacity = active ? '1' : '.6';
          toggle.textContent = active ? '✕' : '✓';
          toggle.className = active
            ? 'btn btn-danger btn-xs' : 'btn btn-success btn-xs';
          toggle.title = active ? 'Gebäudetyp abwählen' : 'Gebäudetyp auswählen';
          for (let index = 0; index < levelButtons.length; index++) {
            levelButtons[index].className = index + 1 === target
              ? 'btn btn-success btn-xs' : 'btn btn-default btn-xs';
          }
        }
        toggle.addEventListener('click', async () => {
          active = !active;
          updateRow();
          await GM.setValue(disabledKey, !active);
        });
        name.addEventListener('click', () => toggle.click());
        row.append(name, levels, toggle);
        updateRow();
        body.append(row);
      }

      const flowTitle = document.createElement('h2');
      flowTitle.textContent = 'Ablauf';
      body.append(flowTitle);
      for (const [key, label, fallback] of [
        [KEY_DELAY_BUILDING, 'Pause nach einem Direktkauf [ms]', DEFAULT_DELAY_BUILDING],
        [KEY_DELAY_FETCH, 'Delay nach HTML-Fallback [ms]', DEFAULT_DELAY_FETCH]
      ]) {
        const field = document.createElement('label');
        field.style.cssText = 'display:block;margin-bottom:10px';
        field.textContent = label;
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
        field.append(input);
        body.append(field);
      }
    }
    if (location.hash === `#${SETTINGS_IDENTIFIER}`) {
      await renderSettings();
      anchor.click();
    }
    return;
  }

  /*
   * ==========================================
   * KONFIGURATION
   * ==========================================
   */

  async function getTargetLevel(typeId) {
    const key = String(typeId);
    const maximum = BUILDING_TYPES.find(type => type.id === Number(typeId))?.maxLevel ?? 0;

    if (!targetCache.has(key)) {
      const value = Number(
        await GM.getValue(
          KEY_LEVEL_PREFIX + key,
          0
        )
      );
      const disabled = await GM.getValue(
        KEY_DISABLED_PREFIX + key,
        false
      );

      targetCache.set(
        key,
        !disabled && Number.isInteger(value) && value > 0
          ? Math.min(value, maximum)
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
    if (document.getElementById('abl-style')) return;
    const style = document.createElement('style');
    style.id = 'abl-style';
    style.textContent = `
      #abl-nav {position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:9px 12px;border-top:1px solid #888;background:#333;color:#fff}
      #abl-wrap {display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      #abl-statistics {display:flex;flex-wrap:wrap;gap:20px;margin-top:6px;font-size:12px}
      #abl-progress {height:12px;margin-top:6px;overflow:hidden;border-radius:4px;background:#777}
      #abl-bar-ok {height:100%;width:0;background:#5cb85c;transition:width .15s}
    `;
    document.head.append(style);
  }

  function createNavbar() {
    ensureStyles();
    if (document.getElementById('abl-nav')) {
      document.getElementById('abl-stop').disabled = false;
      document.getElementById('abl-close').disabled = true;
      return;
    }
    const nav = document.createElement('div');
    nav.id = 'abl-nav';
    const wrap = document.createElement('div');
    wrap.id = 'abl-wrap';
    const label = document.createElement('span');
    label.id = 'abl-state';
    label.className = 'label label-info';
    label.textContent = 'Bereit';
    const stop = document.createElement('button');
    stop.id = 'abl-stop';
    stop.type = 'button';
    stop.className = 'btn btn-danger btn-xs';
    stop.textContent = 'Abbrechen';
    stop.addEventListener('click', () => {
      cancelled = true;
      stop.disabled = true;
      label.textContent = 'Abbruch – laufende Anfrage wird beendet...';
    });
    const close = document.createElement('button');
    close.id = 'abl-close';
    close.type = 'button';
    close.className = 'btn btn-default btn-xs';
    close.textContent = 'Schließen';
    close.disabled = true;
    close.addEventListener('click', () => {
      if (running) return;
      nav.remove();
      document.getElementById('abl-style')?.remove();
    });
    wrap.append(stop, label, close);
    const statistics = document.createElement('div');
    statistics.id = 'abl-statistics';
    const progress = document.createElement('div');
    progress.id = 'abl-progress';
    const bar = document.createElement('div');
    bar.id = 'abl-bar-ok';
    progress.append(bar);
    nav.append(wrap, statistics, progress);
    document.body.append(nav);
  }

  function setState(text, cls = 'info') {
    const label = document.getElementById('abl-state');
    if (!label) return;
    label.className = `label label-${cls}`;
    label.textContent = text;
  }

  function updateProgress(done, errors, total) {
    const bar = document.getElementById('abl-bar-ok');
    if (!bar) return;
    bar.style.width = total > 0
      ? `${Math.min(100, (done + errors) / total * 100)}%`
      : '0%';
  }

  function updateStatistics(upgraded, skipped, errors, total) {
    const element = document.getElementById('abl-statistics');
    if (!element) return;
    const format = number => Number(number).toLocaleString('de-DE');
    element.replaceChildren();
    for (const entry of [
      `Ausgebaut: ${format(upgraded)}`,
      `Übersprungen: ${format(skipped)}`,
      `Fehler: ${format(errors)}`,
      `Gebäude: ${format(upgraded + skipped + errors)}/${format(total)}`
    ]) {
      const span = document.createElement('span');
      span.textContent = entry;
      element.append(span);
    }
  }

  function finishNavbar() {
    const stop = document.getElementById('abl-stop');
    const close = document.getElementById('abl-close');
    if (stop) stop.disabled = true;
    if (close) close.disabled = false;
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
      updateStatistics(0, skipped, 0, total);

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
        updateStatistics(upgraded, skipped + additionalSkipped, errors, total);

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
      finishNavbar();
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
          updateStatistics(0, 1, 0, 1);
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
        updateStatistics(result.status === 'upgraded' ? 1 : 0,
          result.status === 'skipped' ? 1 : 0, 0, 1);

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
        updateStatistics(0, 0, 1, 1);

      } finally {
        running = false;
        sessionStorage.removeItem(RUN_FLAG);
        finishNavbar();
      }
    }
  );

  log('Version', VERSION, 'geladen');

})();
