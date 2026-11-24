// ==UserScript==
// @name         Leitstelle De-/Activate Buildings
// @namespace    NilsPe.activate.buildings
// @version      1.1.3
// @description  Aktiviert oder deaktiviert konfigurierte Gebaeude einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Buildings.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_activate_buildings';
  const KEYS = {
    activateTypes: 'nilspe_ab_activate_types',
    deactivateTypes: 'nilspe_ab_deactivate_types',
    concurrency: 'nilspe_ab_concurrency',
    requestDelay: 'nilspe_ab_request_delay'
  };

  const BUILDING_TYPES = [
    [0, 'Feuerwache'],
    [2, 'Rettungswache'],
    [4, 'Krankenhaus'],
    [5, 'Rettungshubschrauber-Station'],
    [6, 'Polizeiwache'],
    [9, 'THW-Ortsverband'],
    [11, 'Bereitschaftspolizei'],
    [12, 'Schnelleinsatzgruppe (SEG)'],
    [13, 'Polizeihubschrauberstation'],
    [15, 'Wasserrettung'],
    [16, 'Verbandszellen'],
    [17, 'Polizei-Sondereinheiten'],
    [18, 'Feuerwache (Kleinwache)'],
    [19, 'Polizeiwache (Kleinwache)'],
    [20, 'Rettungswache (Kleinwache)'],
    [21, 'Rettungshundestaffel'],
    [24, 'Reiterstaffel'],
    [25, 'Bergrettung'],
    [26, 'Seenotrettungswache'],
    [28, 'Hubschrauberstation (Seenotrettung)']
  ].map(([value, name]) => ({ value, name: `${value} ${name}` }));

  const DEFAULT_TYPES = [
    0, 2, 4, 5, 6, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 24, 25,
    26, 28
  ];

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;
  let cancelled = false;

  function parseArray(value, fallback = []) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map(Number).filter(Number.isInteger)
        : fallback;
    } catch {
      return fallback;
    }
  }

  async function initializeDefaults() {
    for (const key of [KEYS.activateTypes, KEYS.deactivateTypes]) {
      const stored = await GM.getValue(key, null);

      if (stored === null) {
        await GM.setValue(key, JSON.stringify(DEFAULT_TYPES));
      }
    }
  }

  async function createSettings() {
    if (typeof waitForSettingsDom !== 'function' ||
        typeof createSettingsPane !== 'function') {
      console.error('[De-/Activate Buildings] NilsPe-Skriptbasis fehlt.');
      return;
    }
    if (!await waitForSettingsDom()) return;
    await initializeDefaults();

    const { anchor, body } = createSettingsPane(
      SETTINGS_IDENTIFIER, 'De-/Activate Buildings'
    );
    let rendered = false;
    anchor.addEventListener('click', () => void renderSettings());

    async function renderSettings() {
      if (rendered) return;
      rendered = true;
      for (const [key, title] of [
        [KEYS.activateTypes, 'Gebäude aktivieren'],
        [KEYS.deactivateTypes, 'Gebäude deaktivieren']
      ]) {
        const heading = document.createElement('h2');
        heading.textContent = title;
        body.append(heading);
        const selected = new Set(parseArray(
          await GM.getValue(key, JSON.stringify(DEFAULT_TYPES)), DEFAULT_TYPES
        ));
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px';
        const list = document.createElement('div');
        let saveQueue = Promise.resolve();

        function save() {
          const snapshot = [...selected];
          saveQueue = saveQueue.catch(() => {}).then(() =>
            GM.setValue(key, JSON.stringify(snapshot))
          );
          void saveQueue.catch(error =>
            console.error('[De-/Activate Buildings] Speichern fehlgeschlagen:', error)
          );
        }

        function update() {
          list.replaceChildren();
          for (const option of BUILDING_TYPES) {
            const active = selected.has(option.value);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:3px;border:1px solid;border-radius:3px';
            row.style.background = active ? 'rgba(92, 184, 92, .10)' : '#8881';
            row.style.borderColor = active ? 'rgba(92, 184, 92, .35)' : '#8885';
            const label = document.createElement('span');
            label.style.flex = '1';
            label.style.cursor = 'pointer';
            label.style.opacity = active ? '1' : '.6';
            label.textContent = option.name;
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = active ? 'btn btn-danger btn-xs' : 'btn btn-success btn-xs';
            toggle.style.width = '30px';
            toggle.textContent = active ? '✕' : '✓';
            toggle.title = active ? 'Gebäudetyp abwählen' : 'Gebäudetyp auswählen';
            function toggleSelection() {
              if (active) selected.delete(option.value);
              else selected.add(option.value);
              update();
              save();
            }
            label.addEventListener('click', toggleSelection);
            toggle.addEventListener('click', toggleSelection);
            row.append(label, toggle);
            list.append(row);
          }
        }

        for (const [text, active, color] of [
          ['Alle auswählen', true, 'btn-success'],
          ['Alle abwählen', false, 'btn-danger']
        ]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `btn btn-xs ${color}`;
          button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;flex:0 0 110px;width:110px;height:28px;margin:0;padding:2px 6px;vertical-align:middle;white-space:nowrap;font-size:13px;line-height:1';
          button.title = active ? 'Alle Gebäudetypen auswählen' : 'Alle Gebäudetypen abwählen';
          button.textContent = text;
          button.addEventListener('click', () => {
            selected.clear();
            if (active) for (const option of BUILDING_TYPES) selected.add(option.value);
            update();
            save();
          });
          toolbar.append(button);
        }
        update();
        body.append(toolbar, list);
      }

      const flow = document.createElement('h2');
      flow.textContent = 'Ablauf';
      body.append(flow);
      for (const [key, label, fallback, min, max] of [
        [KEYS.concurrency, 'Parallele Gebäudeprüfungen', 3, 1, 10],
        [KEYS.requestDelay, 'Pause nach einer Umschaltung [ms]', 100, 0, 5000]
      ]) {
        const field = document.createElement('label');
        field.style.cssText = 'display:block;margin:8px 0;font-weight:normal';
        const caption = document.createElement('strong');
        caption.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control input-sm';
        input.style.width = '110px';
        input.min = String(min);
        input.max = String(max);
        input.value = String(await GM.getValue(key, fallback));
        input.addEventListener('change', () => {
          const value = Math.max(min, Math.min(max, Number(input.value) || fallback));
          input.value = String(value);
          void GM.setValue(key, value);
        });
        field.append(caption, input);
        body.append(field);
      }
    }
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
      caption: building.caption || building.name || `Gebaeude ${building.id}`,
      enabled: building.enabled !== false
    };
  }

  async function loadBuildings(dispatchCenterId, types, desiredState) {
    if (typeof openDb !== 'function' || typeof updateBuildings !== 'function') {
      throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);
      return (await getDataByIndex(
        db,
        'buildings',
        'leitstelle_building_id',
        Number(dispatchCenterId)
      ))
        .map(normalizeBuilding)
        .filter(building => types.has(building.building_type))
        .filter(building => building.enabled !== desiredState)
        .sort((a, b) => a.id - b.id);
    } finally {
      db.close();
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

  function ensureProgress() {
    if (document.getElementById('nilspe-ab-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-ab-style';
    style.textContent = `
      #nilspe-ab-progress {
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
      #nilspe-ab-statistics {display:flex;flex-wrap:wrap;gap:20px;margin-top:6px;font-size:12px}
      #nilspe-ab-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #777;
      }
      #nilspe-ab-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
      #nilspe-ab-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-ab-progress';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.id = 'nilspe-ab-stop';
    cancel.className = 'btn btn-danger btn-xs';
    cancel.textContent = 'Abbrechen';
    cancel.addEventListener('click', () => {
      cancelled = true;
      cancel.disabled = true;
      document.getElementById('nilspe-ab-status').textContent =
        'Abbruch – laufende Anfragen werden beendet...';
    });
    const status = document.createElement('span');
    status.id = 'nilspe-ab-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-ab-track';
    const success = document.createElement('div');
    success.id = 'nilspe-ab-success';
    const errors = document.createElement('div');
    errors.id = 'nilspe-ab-errors';
    const close = document.createElement('button');
    close.id = 'nilspe-ab-close';
    close.type = 'button';
    close.className = 'btn btn-default btn-xs';
    close.textContent = 'Schließen';
    close.disabled = true;
    close.addEventListener('click', () => {
      if (running) return;
      container.remove();
      style.remove();
    });
    const statistics = document.createElement('div');
    statistics.id = 'nilspe-ab-statistics';
    track.append(success, errors);
    row.append(cancel, status, close);
    container.append(row, statistics, track);
    document.body.append(container);
  }

  function setProgress(
    message,
    completed = 0,
    errors = 0,
    total = 0,
    type = 'info'
  ) {
    ensureProgress();
    const status = document.getElementById('nilspe-ab-status');
    const successBar = document.getElementById('nilspe-ab-success');
    const errorBar = document.getElementById('nilspe-ab-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    successBar.style.width = `${Math.max(0, (completed - errors) / safeTotal * 100)}%`;
    errorBar.style.width = `${Math.max(0, errors / safeTotal * 100)}%`;
  }

  function updateStatistics(changed, completed, errors, total) {
    const statistics = document.getElementById('nilspe-ab-statistics');
    if (!statistics) return;
    const format = number => Number(number).toLocaleString('de-DE');
    statistics.replaceChildren();
    for (const entry of [
      `Umgeschaltete Gebäude: ${format(changed)}`,
      `Fehler: ${format(errors)}`,
      `Gebäude: ${format(completed)}/${format(total)}`
    ]) {
      const span = document.createElement('span');
      span.textContent = entry;
      statistics.append(span);
    }
  }

  function finishProgress() {
    const stop = document.getElementById('nilspe-ab-stop');
    const close = document.getElementById('nilspe-ab-close');
    if (stop) stop.disabled = true;
    if (close) close.disabled = false;
  }

  async function run(desiredState, button) {
    if (running) {
      return;
    }

    running = true;
    cancelled = false;
    button.disabled = true;
    ensureProgress();
    document.getElementById('nilspe-ab-stop').disabled = false;
    document.getElementById('nilspe-ab-close').disabled = true;
    updateStatistics(0, 0, 0, 0);

    try {
      const dispatchCenterId = Number(
        location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
      );
      const typeKey = desiredState
        ? KEYS.activateTypes
        : KEYS.deactivateTypes;
      const types = new Set(parseArray(
        await GM.getValue(typeKey, JSON.stringify(DEFAULT_TYPES)),
        DEFAULT_TYPES
      ));
      const concurrency = Math.max(
        1,
        Math.min(10, Number(await GM.getValue(KEYS.concurrency, 3)) || 3)
      );
      const requestDelay = Math.max(
        0,
        Number(await GM.getValue(KEYS.requestDelay, 100)) || 0
      );

      setProgress('Gebaeude werden geladen ...');
      const buildings = await loadBuildings(
        dispatchCenterId,
        types,
        desiredState
      );

      if (buildings.length === 0) {
        setProgress('Keine Umschaltung erforderlich', 0, 0, 0, 'success');
        updateStatistics(0, 0, 0, 0);
        return;
      }

      let nextIndex = 0;
      let completed = 0;
      let errors = 0;
      let changed = 0;
      updateStatistics(changed, completed, errors, buildings.length);

      async function worker() {
        while (!cancelled) {
          const index = nextIndex++;

          if (index >= buildings.length) {
            return;
          }

          const building = buildings[index];
          setProgress(
            `${completed}/${buildings.length}: ${building.caption}`,
            completed,
            errors,
            buildings.length
          );

          try {
            await toggleBuilding(building.id);
            changed++;
          } catch (error) {
            errors++;
            console.error(
              '[De-/Activate Buildings] Gebaeude fehlgeschlagen:',
              building.id,
              error
            );
          }

          completed++;
          updateStatistics(changed, completed, errors, buildings.length);
          setProgress(
            `${completed}/${buildings.length} Gebaeude, ${changed} umgeschaltet`,
            completed,
            errors,
            buildings.length,
            errors ? 'warning' : 'success'
          );
          await sleep(requestDelay);
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, buildings.length) },
          worker
        )
      );

      if (cancelled) {
        setProgress('Abgebrochen', completed, errors, buildings.length, 'warning');
        return;
      }

      setProgress(
        `Fertig: ${changed} umgeschaltet, ${errors} Fehler`,
        completed,
        errors,
        buildings.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[De-/Activate Buildings] Lauf fehlgeschlagen:', error);
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 0, 'danger');
    } finally {
      running = false;
      button.disabled = false;
      finishProgress();
    }
  }

  function settingsButton() {
    const button = document.createElement('a');
    button.className = 'btn btn-default btn-xs';
    button.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
    button.target = '_blank';
    button.title = 'Einstellungen';
    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';
    button.append(icon);
    return button;
  }

  function addButtons() {
    const heading = document.querySelector('h1[building_type]');

    if (
      Number(heading?.getAttribute('building_type')) !== 7 ||
      document.getElementById('nilspe-ab-buttons')
    ) {
      return;
    }

    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details) {
      return;
    }

    const term = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = 'Gebaeude:';
    term.append(strong);
    const description = document.createElement('dd');
    const group = document.createElement('div');
    group.id = 'nilspe-ab-buttons';
    group.className = 'btn-group';
    const activate = document.createElement('button');
    activate.type = 'button';
    activate.className = 'btn btn-default btn-xs';
    activate.textContent = 'Aktivieren';
    activate.addEventListener('click', () => run(true, activate));
    const deactivate = document.createElement('button');
    deactivate.type = 'button';
    deactivate.className = 'btn btn-default btn-xs';
    deactivate.textContent = 'Deaktivieren';
    deactivate.addEventListener('click', () => run(false, deactivate));
    group.append(activate, deactivate, settingsButton());
    description.append(group);
    details.append(term, description);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
  } else {
    addButtons();
    new MutationObserver(addButtons).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();

