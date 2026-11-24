// ==UserScript==
// @name         Leitstelle De-/Activate Extensions
// @namespace    NilsPe.activate.extensions
// @version      1.1.3
// @description  Aktiviert oder deaktiviert konfigurierte Erweiterungen einer Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Extensions.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Deactivate-Extensions.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_activate_extensions';
  const ACTIVATE_PREFIX = 'nilspe_ae_activate_';
  const DEACTIVATE_PREFIX = 'nilspe_ae_deactivate_';
  const ACTION_DELAY_KEY = 'nilspe_ae_action_delay';
  const BUILDING_DELAY_KEY = 'nilspe_ae_building_delay';
  const DEFAULT_ACTION_DELAY = 200;
  const DEFAULT_BUILDING_DELAY = 100;

  const BUILDING_TYPES = [
    [0, 'Feuerwache'],
    [1, 'Feuerwehrschule'],
    [2, 'Rettungswache'],
    [3, 'Rettungsschule'],
    [4, 'Krankenhaus'],
    [5, 'Rettungshubschrauber-Station'],
    [6, 'Polizeiwache'],
    [8, 'Polizeischule'],
    [9, 'THW-Ortsverband'],
    [10, 'THW Bundesschule'],
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
    [27, 'Schule fuer Seefahrt und Seenotrettung'],
    [28, 'Hubschrauberstation (Seenotrettung)'],
    [29, 'Autobahnpolizei']
  ].map(([id, name]) => ({ id, name }));

  function numberedOptions(name, ids) {
    return ids.map((id, index) => ({
      value: id,
      name: `${name} ${index + 1}`
    }));
  }

  const EXTENSIONS = new Map([
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
    [16, numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])],
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
      { value: 13, name: 'Fachzug Fuehrung und Kommunikation' },
      { value: 14, name: 'Fachgruppe Logistik-Verpflegung' }
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

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;
  let cancelled = false;

  function parseStoredArray(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function selectedIds(prefix, buildingType) {
    return parseStoredArray(
      await GM.getValue(`${prefix}${buildingType}`, '[]')
    ).map(Number).filter(Number.isInteger);
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
      extensions: Array.isArray(building.extensions)
        ? building.extensions.map(extension => ({
          ...extension,
          type_id: Number(extension.type_id),
          enabled: extension.enabled === true
        }))
        : []
    };
  }

  async function loadBuildings(dispatchCenterId) {
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
      )).map(normalizeBuilding).sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  async function extensionOptions() {
    const optionsByType = new Map();

    for (const buildingType of BUILDING_TYPES) {
      optionsByType.set(
        buildingType.id,
        new Map(
          (EXTENSIONS.get(buildingType.id) ?? [])
            .map(option => [Number(option.value), option])
        )
      );
    }

    if (typeof openDb !== 'function' || typeof updateBuildings !== 'function') {
      return optionsByType;
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      for (const rawBuilding of await getAllData(db, 'buildings')) {
        const building = normalizeBuilding(rawBuilding);
        const options = optionsByType.get(building.building_type);

        if (!options) {
          continue;
        }

        for (const extension of building.extensions) {
          if (!Number.isInteger(extension.type_id)) {
            continue;
          }

          if (!options.has(extension.type_id)) {
            options.set(extension.type_id, {
              value: extension.type_id,
              name:
                extension.caption ||
                `Erweiterung ${extension.type_id}`
            });
          }
        }
      }
    } catch (error) {
      console.warn(
        '[De-/Activate Extensions] API-Erweiterungen konnten nicht geladen werden:',
        error
      );
    } finally {
      db.close();
    }

    return optionsByType;
  }

  async function createSettings() {
    if (typeof waitForSettingsDom !== 'function' ||
        typeof createSettingsPane !== 'function') {
      console.error('[De-/Activate Extensions] NilsPe-Skriptbasis fehlt.');
      return;
    }
    if (!await waitForSettingsDom()) return;

    const { anchor, body } = createSettingsPane(
      SETTINGS_IDENTIFIER, 'De-/Activate Extensions'
    );
    let rendered = false;
    anchor.addEventListener('click', () => void renderSettings());

    async function renderSettings() {
      if (rendered) return;
      rendered = true;
      const optionsByType = await extensionOptions();

      for (const [prefix, title] of [
        [ACTIVATE_PREFIX, 'Erweiterungen aktivieren'],
        [DEACTIVATE_PREFIX, 'Erweiterungen deaktivieren']
      ]) {
        const heading = document.createElement('h2');
        heading.textContent = title;
        body.append(heading);

        for (const buildingType of BUILDING_TYPES) {
          const options = [...(optionsByType.get(buildingType.id)?.values() ?? [])]
            .sort((a, b) => Number(a.value) - Number(b.value));
          if (!options.length) continue;

          const selected = new Set(await selectedIds(prefix, buildingType.id));
          const panel = document.createElement('details');
          panel.style.cssText = 'margin-bottom:7px;border:1px solid #8885;border-radius:4px';
          const summary = document.createElement('summary');
          summary.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:9px 12px;cursor:pointer;background:#8882';
          const name = document.createElement('strong');
          name.textContent = `${buildingType.id} – ${buildingType.name}`;
          const count = document.createElement('span');
          count.className = 'label label-default';
          summary.append(name, count);
          const content = document.createElement('div');
          content.style.padding = '10px';
          const toolbar = document.createElement('div');
          toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px';
          const list = document.createElement('div');
          const key = `${prefix}${buildingType.id}`;
          let saveQueue = Promise.resolve();

          function save() {
            const snapshot = [...selected];
            saveQueue = saveQueue.catch(() => {}).then(() =>
              GM.setValue(key, JSON.stringify(snapshot))
            );
            void saveQueue.catch(error =>
              console.error('[De-/Activate Extensions] Speichern fehlgeschlagen:', error)
            );
          }

          function update() {
            count.textContent = `${selected.size} / ${options.length} ausgewählt`;
            count.className = selected.size ? 'label label-success' : 'label label-default';
            list.replaceChildren();
            for (const option of options) {
              const id = Number(option.value);
              const active = selected.has(id);
              const row = document.createElement('div');
              row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:3px;border:1px solid;border-radius:3px';
              row.style.background = active ? 'rgba(92, 184, 92, .10)' : '#8881';
              row.style.borderColor = active ? 'rgba(92, 184, 92, .35)' : '#8885';
              const label = document.createElement('span');
              label.style.flex = '1';
              label.style.cursor = 'pointer';
              label.style.opacity = active ? '1' : '.6';
              label.textContent = `${option.name} (${id})`;
              const toggle = document.createElement('button');
              toggle.type = 'button';
              toggle.className = active ? 'btn btn-danger btn-xs' : 'btn btn-success btn-xs';
              toggle.style.width = '30px';
              toggle.textContent = active ? '✕' : '✓';
              toggle.title = active ? 'Erweiterung abwählen' : 'Erweiterung auswählen';
              function toggleSelection() {
                if (selected.has(id)) selected.delete(id);
                else selected.add(id);
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
            button.title = active ? 'Alle Erweiterungen auswählen' : 'Alle Erweiterungen abwählen';
            button.textContent = text;
            button.addEventListener('click', () => {
              selected.clear();
              if (active) for (const option of options) selected.add(Number(option.value));
              update();
              save();
            });
            toolbar.append(button);
          }
          update();
          content.append(toolbar, list);
          panel.append(summary, content);
          body.append(panel);
        }
      }

      const flow = document.createElement('h2');
      flow.textContent = 'Ablauf';
      body.append(flow);
      for (const [key, label, fallback] of [
        [ACTION_DELAY_KEY, 'Pause nach einer Umschaltung [ms]', DEFAULT_ACTION_DELAY],
        [BUILDING_DELAY_KEY, 'Pause nach einem Gebäude [ms]', DEFAULT_BUILDING_DELAY]
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
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
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

  async function toggleExtension(url) {
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
      throw new Error(`Umschaltung HTTP ${response.status}`);
    }
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-ae-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-ae-style';
    style.textContent = `
      #nilspe-ae-progress {position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:9px 12px;border-top:1px solid #888;background:#333;color:#fff}
      #nilspe-ae-progress-row {display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      #nilspe-ae-statistics {display:flex;flex-wrap:wrap;gap:20px;margin-top:6px;font-size:12px}
      #nilspe-ae-track {height:12px;margin-top:6px;overflow:hidden;border-radius:4px;background:#777}
      #nilspe-ae-fill {height:100%;width:0;background:#5cb85c;transition:width .15s}
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-ae-progress';
    const row = document.createElement('div');
    row.id = 'nilspe-ae-progress-row';
    const stop = document.createElement('button');
    stop.id = 'nilspe-ae-stop';
    stop.type = 'button';
    stop.className = 'btn btn-danger btn-xs';
    stop.textContent = 'Abbrechen';
    stop.addEventListener('click', () => {
      cancelled = true;
      stop.disabled = true;
      document.getElementById('nilspe-ae-status').textContent =
        'Abbruch – laufende Anfrage wird beendet...';
    });
    const status = document.createElement('span');
    status.id = 'nilspe-ae-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const close = document.createElement('button');
    close.id = 'nilspe-ae-close';
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
    statistics.id = 'nilspe-ae-statistics';
    const track = document.createElement('div');
    track.id = 'nilspe-ae-track';
    const fill = document.createElement('div');
    fill.id = 'nilspe-ae-fill';
    track.append(fill);
    container.append(row, statistics, track);
    document.body.append(container);
  }

  function setProgress(message, completed = 0, errors = 0, total = 0, type = 'info') {
    ensureProgress();
    const status = document.getElementById('nilspe-ae-status');
    const fill = document.getElementById('nilspe-ae-fill');
    status.className = `label label-${type}`;
    status.textContent = message;
    fill.style.width = total > 0
      ? `${Math.min(100, completed / total * 100)}%` : '0%';
  }

  function updateStatistics(changed, completed, errors, total) {
    const statistics = document.getElementById('nilspe-ae-statistics');
    if (!statistics) return;
    const format = number => Number(number).toLocaleString('de-DE');
    statistics.replaceChildren();
    for (const entry of [
      `Umgeschaltete Erweiterungen: ${format(changed)}`,
      `Fehler: ${format(errors)}`,
      `Gebäude: ${format(completed)}/${format(total)}`
    ]) {
      const span = document.createElement('span');
      span.textContent = entry;
      statistics.append(span);
    }
  }

  function finishProgress() {
    const stop = document.getElementById('nilspe-ae-stop');
    const close = document.getElementById('nilspe-ae-close');
    if (stop) stop.disabled = true;
    if (close) close.disabled = false;
  }

  async function configurationFor(
    building,
    desiredState,
    selectedExtensionIds = null
  ) {
    const prefix = desiredState ? ACTIVATE_PREFIX : DEACTIVATE_PREFIX;
    const selected = selectedExtensionIds ?? new Set(
      await selectedIds(prefix, building.building_type)
    );

    return building.extensions.filter(extension =>
      selected.has(extension.type_id) &&
      extension.available !== false &&
      extension.enabled !== desiredState
    );
  }

  async function processBuilding(
    building,
    desiredState,
    actionDelay,
    configuredExtensions = null
  ) {
    const extensions = configuredExtensions ??
      await configurationFor(building, desiredState);

    if (extensions.length === 0) {
      return 0;
    }

    const urls = await toggleUrls(building.id);
    let changed = 0;

    for (const extension of extensions) {
      if (cancelled) {
        break;
      }

      const url = urls.get(extension.type_id);

      if (!url) {
        console.warn(
          '[De-/Activate Extensions] Keine Umschalt-URL:',
          building.id,
          extension.type_id
        );
        continue;
      }

      await toggleExtension(url);
      changed++;
      await sleep(actionDelay);
    }

    return changed;
  }

  async function run(desiredState, button) {
    if (running) {
      return;
    }

    running = true;
    cancelled = false;
    button.disabled = true;
    ensureProgress();
    document.getElementById('nilspe-ae-stop').disabled = false;
    document.getElementById('nilspe-ae-close').disabled = true;

    try {
      const dispatchCenterId = Number(
        location.pathname.match(/^\/buildings\/(\d+)/)?.[1]
      );
      const actionDelay = Math.max(
        0,
        Number(await GM.getValue(ACTION_DELAY_KEY, DEFAULT_ACTION_DELAY))
      );
      const buildingDelay = Math.max(
        0,
        Number(await GM.getValue(BUILDING_DELAY_KEY, DEFAULT_BUILDING_DELAY))
      );
      setProgress('Gebaeude werden geladen ...');
      const buildings = await loadBuildings(dispatchCenterId);
      const prefix = desiredState ? ACTIVATE_PREFIX : DEACTIVATE_PREFIX;
      const selectedByBuildingType = new Map();

      for (const building of buildings) {
        const buildingType = Number(building.building_type);

        if (!selectedByBuildingType.has(buildingType)) {
          selectedByBuildingType.set(
            buildingType,
            new Set(await selectedIds(prefix, buildingType))
          );
        }
      }

      const relevant = [];

      for (const building of buildings) {
        const extensions = await configurationFor(
          building,
          desiredState,
          selectedByBuildingType.get(Number(building.building_type))
        );

        if (extensions.length > 0) {
          relevant.push({ building, extensions });
        }
      }

      if (relevant.length === 0) {
        setProgress('Keine Umschaltung erforderlich', 0, 0, 0, 'success');
        updateStatistics(0, 0, 0, 0);
        return;
      }

      let completed = 0;
      let errors = 0;
      let changed = 0;
      updateStatistics(0, 0, 0, relevant.length);

      await runWithConcurrency(
        relevant,
        async ({ building, extensions }) => {
          if (cancelled) return;
          setProgress(
            `${completed}/${relevant.length}: ${building.caption}`,
            completed,
            errors,
            relevant.length
          );

          try {
            const buildingChanges = await processBuilding(
              building,
              desiredState,
              actionDelay,
              extensions
            );
            changed += buildingChanges;
          } catch (error) {
            errors++;
            console.error(
              '[De-/Activate Extensions] Gebaeude fehlgeschlagen:',
              building.id,
              error
            );
          }

          completed++;
          updateStatistics(changed, completed, errors, relevant.length);
          setProgress(
            `${completed}/${relevant.length} Gebaeude, ${changed} umgeschaltet`,
            completed,
            errors,
            relevant.length,
            errors ? 'warning' : 'success'
          );
        },
        {
          concurrency: 3,
          delay: buildingDelay,
          shouldContinue: () => !cancelled
        }
      );

      if (cancelled) {
        setProgress('Abgebrochen', completed, errors, relevant.length, 'warning');
        return;
      }

      setProgress(
        `Fertig: ${changed} umgeschaltet, ${errors} Fehler`,
        completed,
        errors,
        relevant.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[De-/Activate Extensions] Lauf fehlgeschlagen:', error);
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
      document.getElementById('nilspe-ae-buttons')
    ) {
      return;
    }

    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details) {
      return;
    }

    const term = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = 'Erweiterungen:';
    term.append(strong);
    const description = document.createElement('dd');
    const group = document.createElement('div');
    group.id = 'nilspe-ae-buttons';
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

