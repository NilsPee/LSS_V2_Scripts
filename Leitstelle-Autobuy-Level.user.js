// ==UserScript==
// @name         Leitstelle Autobuy Level
// @namespace    NilsPe.autobuy.level.api
// @version      2.4.3
// @description  Autobuy Level mit zentraler NilsPe-Skriptbasis und Fortschrittsbalken
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

  //----------------------------------------------
  // GEBÄUDETYPEN
  //----------------------------------------------
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
    { id: 28, label: 'Hubschrauberstation (Seenotrettung)' },
  ];

  //----------------------------------------------
  // SETTINGS / KEYS
  //----------------------------------------------
  const SETTINGS_IDENTIFIER = 'autobuy_level_types';
  const KEY_LEVEL_PREFIX = 'abl_target_level_';
  const KEY_DELAY_BUILDING = 'abl_delay_per_building';
  const KEY_DELAY_FETCH = 'abl_delay_after_fetch';
  const DEFAULT_DELAY_BUILDING = 100;
  const DEFAULT_DELAY_FETCH = 100;
  const RUN_FLAG = 'abl_run_flag';

  //----------------------------------------------
  // SETTINGS-SEITE
  //----------------------------------------------
  if (location.pathname.startsWith('/settings/index')) {
    if (typeof addOptions !== 'function') {
      console.error(
        '[Autobuy Level] NilsPe-Skriptbasis wurde nicht geladen. ' +
        'Bitte im Userscript-Manager den Zugriff auf lokale Datei-URLs erlauben.'
      );
      const warning = document.createElement('div');
      warning.className = 'alert alert-danger';
      warning.textContent =
        'Autobuy Level: Die lokale NilsPe-Skriptbasis konnte nicht geladen werden. ' +
        'Bitte den Zugriff auf Datei-URLs im Userscript-Manager aktivieren.';
      (document.querySelector('.container') ?? document.body).prepend(warning);
      return;
    }

    const typeInputs = BUILDING_TYPES.map(t => ({
      type: 'number',
      key: KEY_LEVEL_PREFIX + t.id,
      default: 0,
      min: 0,
      max: 50,
      label: `${t.id} ${t.label} – Zielstufe`
    }));

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Autobuy Level',
      settings: [
        { type: 'header', text: 'Zielstufen je Gebäudetyp' },
        ...typeInputs,
        { type: 'header', text: 'Ablauf' },
        { type: 'number', key: KEY_DELAY_BUILDING, default: DEFAULT_DELAY_BUILDING, min: 0, max: 5000, label: 'Delay pro Ausbau [ms]' },
        { type: 'number', key: KEY_DELAY_FETCH, default: DEFAULT_DELAY_FETCH, min: 0, max: 5000, label: 'Delay nach Seitenabruf [ms] (nur HTML-Fallback)' }
      ]
    });
    return;
  }

  //----------------------------------------------
  // HELPERS
  //----------------------------------------------
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const targetLevelPromises = new Map();

  async function getTargetLevel(typeId) {
    const key = String(typeId);

    if (!targetLevelPromises.has(key)) {
      targetLevelPromises.set(
        key,
        GM.getValue(KEY_LEVEL_PREFIX + key).then(value =>
          Number(value ?? 0) || 0
        )
      );
    }

    return targetLevelPromises.get(key);
  }

  async function getConfiguredDelays() {
    const storedDelayB = Number(await GM.getValue(KEY_DELAY_BUILDING, DEFAULT_DELAY_BUILDING));
    const storedDelayF = Number(await GM.getValue(KEY_DELAY_FETCH, DEFAULT_DELAY_FETCH));
    const delayB = Number.isFinite(storedDelayB) ? storedDelayB : DEFAULT_DELAY_BUILDING;
    const delayF = Number.isFinite(storedDelayF) ? storedDelayF : DEFAULT_DELAY_FETCH;
    return { delayB, delayF };
  }

  function parseLevelFromDoc(doc) {
    const dd = Array.from(doc.querySelectorAll('dd')).find(el => el.innerText.includes('Stufe'));
    if (!dd) return 0;
    const m = dd.innerText.match(/Stufe:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function getBuildingIdFromUrl() {
    return Number(location.pathname.split('/').filter(Boolean).pop());
  }

  function getBuildingCaption(building) {
    return building.caption || building.name || `Gebäude ${building.id}`;
  }

  function normalizeApiBuilding(building) {
    const dispatchCenterId =
      building.leitstelle_building_id ??
      building.dispatch_center_id ??
      building.dispatch_center_building_id ??
      null;

    return {
      ...building,
      id: Number(building.id),
      name: getBuildingCaption(building),
      type: Number(building.building_type),
      building_type: Number(building.building_type),
      leitstelle_building_id: dispatchCenterId == null ? null : Number(dispatchCenterId),
      currentLevel: Number(building.level ?? building.building_level ?? 0) || 0
    };
  }

  function isSupportedType(typeId) {
    return BUILDING_TYPES.some(t => t.id === Number(typeId));
  }

  function getCsrfToken() {
    return document.querySelector('meta[name=csrf-token]')?.content ?? '';
  }

  //----------------------------------------------
  // API-SPEICHER / INDEXEDDB
  //----------------------------------------------
  async function openUpdatedBuildingDb(maxAgeSeconds = 60) {
    if (typeof openDb !== 'function' || typeof updateBuildings !== 'function') {
      throw new Error('NilsPe-Skriptbasis ist nicht verfügbar.');
    }

    const db = await openDb();
    const updated = await updateBuildings(db, maxAgeSeconds);

    if (updated === false) {
      const buildingCount = await getCount(db, 'buildings');

      if (buildingCount === 0) {
        db.close();
        throw new Error('Der Gebäude-Cache ist leer und die API-Aktualisierung ist fehlgeschlagen.');
      }
    }

    return db;
  }

  async function getBuildingsOfLeitstelleFromApi(leitstellenId) {
    const targetId = Number(leitstellenId);
    const db = await openUpdatedBuildingDb(60);
    let allBuildings;

    try {
      allBuildings = await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        IDBKeyRange.only(targetId)
      );

      if (allBuildings.length === 0) {
        allBuildings = (await getAllData(db, 'buildings'))
          .map(normalizeApiBuilding)
          .filter(building => building.leitstelle_building_id === targetId);
      }
    } finally {
      db.close();
    }

    console.log('[Autobuy Level] Leitstellen-ID der Seite:', targetId);
    console.log('[Autobuy Level] Zugeordnete API-Gebäude:', allBuildings.length);

    const out = [];

    for (const rawBuilding of allBuildings) {
      const b = normalizeApiBuilding(rawBuilding);
      if (!isSupportedType(b.building_type)) continue;

      const target = await getTargetLevel(b.building_type);

      out.push({
        id: b.id,
        name: b.name,
        type: b.building_type,
        target,
        currentLevel: b.currentLevel
      });
    }

    return out.sort((a, b) => a.id - b.id);
  }

  async function getApiBuildingById(buildingId) {
    const id = Number(buildingId);
    const db = await openUpdatedBuildingDb(60);

    try {
      const building = await getData(db, 'buildings', id);
      return building ? normalizeApiBuilding(building) : null;
    } finally {
      db.close();
    }
  }

  //----------------------------------------------
  // HTML-FALLBACK
  //----------------------------------------------
  async function fetchLevelFromBuildingPage(building) {
    const page = await fetch(`/buildings/${building.id}`, { credentials: 'same-origin' });
    const html = await page.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      ...building,
      name: doc.querySelector('h1')?.textContent?.trim() || building.name,
      currentLevel: parseLevelFromDoc(doc)
    };
  }

  async function fetchBuildingsOfLeitstelleFallback(leitstellenId, delayAfterFetch) {
    const out = [];

    try {
      const res = await fetch(`/buildings/${leitstellenId}/leitstelle-buildings`, { credentials: 'same-origin' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll("a[href^='/buildings/']"));
      const seen = new Set();

      for (const a of links) {
        const id = Number(a.getAttribute('href').split('/buildings/')[1].split('/')[0]);
        if (!Number.isFinite(id) || seen.has(id)) continue;
        seen.add(id);

        try {
          const page = await fetch(`/buildings/${id}`, { credentials: 'same-origin' });
          const pageHtml = await page.text();
          const pageDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
          const h1 = pageDoc.querySelector('h1[building_type]');
          const type = h1 ? Number(h1.getAttribute('building_type')) : null;
          const target = await getTargetLevel(type);

          if (isSupportedType(type)) {
            out.push({
              id,
              name: pageDoc.querySelector('h1')?.textContent?.trim() || a.innerText.trim() || `Gebäude ${id}`,
              type,
              target,
              currentLevel: parseLevelFromDoc(pageDoc)
            });
          }

          await delay(delayAfterFetch);
        } catch (e) {
          console.warn('[Autobuy Level] Fallback-Gebäude konnte nicht geladen werden:', id, e);
        }
      }
    } catch (e) {
      console.error('[Autobuy Level] HTML-Fallback fehlgeschlagen:', e);
    }

    return out;
  }

  async function getBuildingsOfLeitstelle(leitstellenId, delayAfterFetch) {
    try {
      const apiBuildings = await getBuildingsOfLeitstelleFromApi(leitstellenId);
      if (Array.isArray(apiBuildings) && apiBuildings.length > 0) {
        return apiBuildings;
      }

      const db = await openUpdatedBuildingDb(60);

      try {
        const cachedBuildings = await getAllData(db, 'buildings');
        const cachedLeitstellenIds = [...new Set(
          cachedBuildings
            .map(normalizeApiBuilding)
            .map(building => building.leitstelle_building_id)
            .filter(id => id !== null)
        )];
        console.warn(
          '[Autobuy Level] Keine API-Zuordnung für Leitstelle',
          Number(leitstellenId),
          'gefunden. IDs im Cache:',
          cachedLeitstellenIds
        );
      } finally {
        db.close();
      }

      console.warn(
        '[Autobuy Level] API-Speicher enthält keine Gebäude für diese Leitstelle, ' +
        'nutze HTML-Fallback.'
      );
    } catch (e) {
      console.warn('[Autobuy Level] API-Speicher fehlgeschlagen, nutze HTML-Fallback:', e);
    }

    return await fetchBuildingsOfLeitstelleFallback(leitstellenId, delayAfterFetch);
  }

  //----------------------------------------------
  // AUSBAU
  //----------------------------------------------
  async function upgradeBuildingLevel(buildingId, targetLevel, delayPerBuilding) {
    const token = getCsrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const response = await fetch(`/buildings/${buildingId}/expand_do/credits?level=${targetLevel - 1}`, {
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
      throw new Error(`Level-Ausbau für Gebäude ${buildingId} fehlgeschlagen. Status: ${response.status}`);
    }

    await delay(delayPerBuilding);
  }

  //----------------------------------------------
  // BOTTOM-BAR
  //----------------------------------------------
  function ensureStyles() {
    if (document.getElementById('abl-style')) return;
    const s = document.createElement('style');
    s.id = 'abl-style';
    s.textContent = `
      #abl-nav { position: fixed; left:0; right:0; bottom:0; background:#f8f8f8; border-top:1px solid #e7e7e7; z-index:2147483000; padding:6px 10px; }
      body.abl-hasbar { padding-bottom: 40px !important; }
      #abl-wrap { display:flex; align-items:center; gap:12px; }
      #abl-state { min-width:240px; font-size:13px; }
      #abl-progress { flex:1; height:12px; margin:0; background:#eee; border-radius:4px; overflow:hidden; display:flex; }
      #abl-bar-ok  { height:100%; background:#5cb85c; width:0%; }
      #abl-bar-err { height:100%; background:#d9534f; width:0%; }
    `;
    document.head.appendChild(s);
  }

  function createNavbar() {
    if (document.getElementById('abl-nav')) return;
    ensureStyles();
    const nav = document.createElement('div'); nav.id = 'abl-nav';
    const wrap = document.createElement('div'); wrap.id = 'abl-wrap';
    const label = document.createElement('span'); label.id = 'abl-state'; label.className = 'label label-success'; label.textContent = 'Bereit';
    const progress = document.createElement('div'); progress.id = 'abl-progress';
    const ok = document.createElement('div'); ok.id = 'abl-bar-ok';
    const err = document.createElement('div'); err.id = 'abl-bar-err';
    progress.append(ok, err); wrap.append(label, progress); nav.append(wrap);
    document.body.append(nav); document.body.classList.add('abl-hasbar');
  }

  function destroyNavbar() {
    document.getElementById('abl-nav')?.remove();
    document.body.classList.remove('abl-hasbar');
  }

  function setState(text, cls = 'info', title) {
    const label = document.getElementById('abl-state');
    if (!label) return;
    label.className = `label label-${cls}`;
    label.textContent = text;
    if (title) label.title = title;
  }

  function updateProgress(ok, err, total, msg) {
    const okBar = document.getElementById('abl-bar-ok');
    const errBar = document.getElementById('abl-bar-err');
    const label = document.getElementById('abl-state');
    if (!okBar || !errBar || !label) return;

    const safeTotal = Math.max(total, 1);
    okBar.style.width = `${(ok / safeTotal) * 100}%`;
    errBar.style.width = `${(err / safeTotal) * 100}%`;

    const done = ok + err;
    label.className = done === total ? 'label label-success' : 'label label-warning';
    label.textContent = done === total ? `${done}/${total} fertig` : `${done}/${total} Gebäude`;
    if (msg) label.title = msg;
  }

  //----------------------------------------------
  // LAUFLOGIK
  //----------------------------------------------
  async function runAutobuyLevelForLeitstelle(leitstellenId) {
    if (sessionStorage.getItem(RUN_FLAG)) sessionStorage.removeItem(RUN_FLAG);
    sessionStorage.setItem(RUN_FLAG, 'true');

    createNavbar();
    setState('Lade Gebäude über API-Speicher...', 'info');

    const { delayB, delayF } = await getConfiguredDelays();
    const loadingStartedAt = Date.now();
    const loadingStatusTimer = setInterval(() => {
      const seconds = Math.floor((Date.now() - loadingStartedAt) / 1_000);
      setState(`Lade Gebäude über API-Speicher... ${seconds}s`, 'info');
    }, 1_000);
    let list;

    try {
      list = await getBuildingsOfLeitstelle(leitstellenId, delayF);
    } catch (error) {
      console.error('[Autobuy Level] Gebäude konnten nicht geladen werden:', error);
      setState(`Ladefehler: ${error.message ?? error}`, 'danger');
      sessionStorage.removeItem(RUN_FLAG);
      return;
    } finally {
      clearInterval(loadingStatusTimer);
    }

    console.log('[Autobuy Level] Verwendbare Gebäude geladen:', list.length);
    const configured = list.filter(building => building.target > 0);

    const targets = configured
      .filter(b => (b.currentLevel ?? 0) < b.target)
      .map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        target: b.target,
        currentLevel: b.currentLevel ?? 0
      }));

    if (list.length === 0) {
      setState('Keine Gebäude für diese Leitstelle gefunden', 'danger');
      console.error('[Autobuy Level] Weder API noch HTML lieferten zugeordnete Gebäude.');
      sessionStorage.removeItem(RUN_FLAG);
      return;
    }

    if (configured.length === 0) {
      setState('Keine Zielstufe für diese Gebäudetypen gesetzt', 'warning');
      console.warn(
        '[Autobuy Level] Gefundene Gebäudetypen:',
        [...new Set(list.map(building => building.type))].sort((a, b) => a - b)
      );
      sessionStorage.removeItem(RUN_FLAG);
      return;
    }

    if (targets.length === 0) {
      setState('Alle Gebäude bereits auf Zielstufe', 'success');
      sessionStorage.removeItem(RUN_FLAG);
      setTimeout(destroyNavbar, 1200);
      return;
    }

    let ok = 0;
    let err = 0;
    const total = targets.length;

    for (const t of targets) {
      if (!sessionStorage.getItem(RUN_FLAG)) break;

      try {
        setState(`${t.name} → Stufe ${t.target}`, 'info');
        updateProgress(ok, err, total, `${t.name}: ${t.currentLevel} → ${t.target}`);
        await upgradeBuildingLevel(t.id, t.target, delayB);
        ok++;
      } catch (e) {
        console.error('[Autobuy Level] Fehler bei Gebäude', t.id, t.name, e);
        err++;
      }

      updateProgress(ok, err, total);
    }

    setState('Fertig', err ? 'warning' : 'success');
    sessionStorage.removeItem(RUN_FLAG);
    setTimeout(destroyNavbar, 1500);
  }

  //----------------------------------------------
  // SEITE ERKENNEN
  //----------------------------------------------
  const h1 = document.querySelector('h1[building_type]');
  if (!h1) return;

  const buildingTypeID = Number(h1.getAttribute('building_type'));
  const buildingId = getBuildingIdFromUrl();

  //----------------------------------------------
  // BUTTONS: LEITSTELLE IM GEBÄUDEDETAIL-BEREICH
  //----------------------------------------------
  if (buildingTypeID === 7) {
    function addAutobuyButtonToBuildingDetails() {
      const buildingDetailsElement = document.querySelector('.building-title ~ dl.dl-horizontal');
      if (!buildingDetailsElement) return;
      if (document.getElementById('abl-building-details-buttons')) return;

      const dtElement = document.createElement('dt');
      const dtTextElement = document.createElement('strong');
      dtTextElement.innerText = 'Gebäudestufen kaufen:';
      dtElement.appendChild(dtTextElement);

      const buttonGroup = document.createElement('div');
      buttonGroup.id = 'abl-building-details-buttons';
      buttonGroup.className = 'btn-group';

      const btnRun = document.createElement('a');
      btnRun.href = '';
      btnRun.className = 'btn btn-default btn-xs';
      btnRun.innerText = 'Autobuy Level';

      const btnSettings = document.createElement('a');
      btnSettings.className = 'btn btn-default btn-xs';
      btnSettings.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
      btnSettings.target = '_blank';

      const cog = document.createElement('span');
      cog.className = 'glyphicon glyphicon-cog';
      cog.title = 'Einstellungen';
      btnSettings.appendChild(cog);

      btnRun.addEventListener('click', async (event) => {
        event.preventDefault();
        if (btnRun.classList.contains('disabled')) return;
        btnRun.classList.add('disabled');

        try {
          await runAutobuyLevelForLeitstelle(buildingId);
        } catch (e) {
          console.error('[Autobuy Level] Leitstellenlauf fehlgeschlagen', e);
          createNavbar();
          setState('Fehler beim Leitstellenlauf', 'danger');
          sessionStorage.removeItem(RUN_FLAG);
        }

        btnRun.classList.remove('disabled');
      });

      buttonGroup.append(btnRun, btnSettings);

      const ddElement = document.createElement('dd');
      ddElement.appendChild(buttonGroup);

      buildingDetailsElement.appendChild(dtElement);
      buildingDetailsElement.appendChild(ddElement);
    }

    addAutobuyButtonToBuildingDetails();
    return;
  }

  //----------------------------------------------
  // BUTTONS: EINZELGEBÄUDE
  //----------------------------------------------
  (function singleBuilding() {
    if (!isSupportedType(buildingTypeID)) return;

    const buildingDetailsElement = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (buildingDetailsElement && !document.getElementById('abl-single-building-details-buttons')) {
      const dtElement = document.createElement('dt');
      const dtTextElement = document.createElement('strong');
      dtTextElement.innerText = 'Autobuy Level:';
      dtElement.appendChild(dtTextElement);

      const buttonGroup = document.createElement('div');
      buttonGroup.id = 'abl-single-building-details-buttons';
      buttonGroup.className = 'btn-group';

      const btn = document.createElement('a');
      btn.href = '';
      btn.className = 'btn btn-default btn-xs';
      btn.innerText = 'Autobuy Level';

      const btnSettings = document.createElement('a');
      btnSettings.className = 'btn btn-default btn-xs';
      btnSettings.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
      btnSettings.target = '_blank';

      const cog = document.createElement('span');
      cog.className = 'glyphicon glyphicon-cog';
      cog.title = 'Einstellungen';
      btnSettings.appendChild(cog);

      btn.addEventListener('click', async (event) => {
        event.preventDefault();

        const { delayB } = await getConfiguredDelays();
        const target = await getTargetLevel(buildingTypeID);

        let currentLevel = parseLevelFromDoc(document);

        // Falls die Seite die Stufe nicht sauber hergibt, API-Speicher versuchen
        if (!Number.isFinite(currentLevel) || currentLevel < 0) {
          const apiBuilding = await getApiBuildingById(buildingId).catch(() => null);
          currentLevel = apiBuilding?.currentLevel ?? 0;
        }

        if (target <= 0) { alert('Keine Zielstufe eingestellt'); return; }
        if (currentLevel >= target) { alert(`Bereits Stufe ${currentLevel}`); return; }

        createNavbar();
        setState(`Ausbau auf Stufe ${target}`, 'info');
        updateProgress(0, 0, 1, `→ ${target}`);

        try {
          await upgradeBuildingLevel(buildingId, target, delayB);
          updateProgress(1, 0, 1);
          setState('Fertig', 'success');
          setTimeout(() => location.reload(), 500);
        } catch (e) {
          console.error('[Autobuy Level] Fehler beim Einzelgebäude', buildingId, e);
          updateProgress(0, 1, 1);
          setState('Fehler', 'danger');
        } finally {
          setTimeout(destroyNavbar, 1500);
        }
      });

      buttonGroup.append(btn, btnSettings);

      const ddElement = document.createElement('dd');
      ddElement.appendChild(buttonGroup);

      buildingDetailsElement.appendChild(dtElement);
      buildingDetailsElement.appendChild(ddElement);
      return;
    }

    // Fallback, falls die Detail-Liste auf irgendeiner Gebäudeseite nicht vorhanden ist
    const wrap = document.createElement('div');
    wrap.style.padding = '10px 0';
    h1.parentNode.parentNode.insertBefore(wrap, h1.parentNode.nextSibling);

    const btn = document.createElement('a');
    btn.className = 'btn btn-success btn-xs';
    btn.innerText = 'Autobuy Level';
    wrap.appendChild(btn);
  })();
})();
