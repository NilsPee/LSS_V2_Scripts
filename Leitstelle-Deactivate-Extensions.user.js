
// ==UserScript==
// @name         Leitstelle De-/Activate Extensions
// @namespace    NilsPe.activate.extensions
// @version      1.2.2
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

  const VERSION = '1.2.2';
  const PREFIX = '[De-/Activate Extensions]';
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
    [27, 'Schule für Seefahrt und Seenotrettung'],
    [28, 'Hubschrauberstation (Seenotrettung)'],
    [29, 'Autobahnpolizei']
  ].map(([id, name]) => ({ id, name }));

  function numberedOptions(name, ids) {
    return ids.map((id, index) => ({
      value: id,
      name: `${name} ${index + 1}`
    }));
  }

  /*
   * ==========================================
   * ERWEITERUNGSKATALOG
   * ==========================================
   */

  const EXTENSIONS = new Map([
    [0, [
      { value: 0, name: 'Rettungsdienst' },
      ...numberedOptions(
        'Abrollbehälter',
        [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]
      ),
      { value: 6, name: 'Wasserrettung' },
      { value: 8, name: 'Flughafen' },
      { value: 9, name: 'Großwache' },
      { value: 13, name: 'Werkfeuerwehr' },
      { value: 14, name: 'NEA50' },
      { value: 15, name: 'NEA200' },
      { value: 16, name: 'Lüfter' },
      { value: 18, name: 'Drohnen-Erweiterung' },
      { value: 19, name: 'Verpflegungsdienst' },
      ...numberedOptions(
        'Anhänger-Stellplatz',
        [20, 21, 22, 23, 24]
      ),
      { value: 25, name: 'Bahnrettung' }
    ]],

    [18, [
      { value: 0, name: 'Rettungsdienst' },
      ...numberedOptions(
        'Abrollbehälter',
        [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]
      ),
      { value: 6, name: 'Wasserrettung' },
      { value: 8, name: 'Flughafen' },
      { value: 9, name: 'Großwache' },
      { value: 13, name: 'Werkfeuerwehr' },
      { value: 14, name: 'NEA50' },
      { value: 15, name: 'NEA200' },
      { value: 16, name: 'Lüfter' },
      { value: 18, name: 'Drohnen-Erweiterung' },
      { value: 19, name: 'Verpflegungsdienst' },
      ...numberedOptions(
        'Anhänger-Stellplatz',
        [20, 21, 22, 23, 24]
      ),
      { value: 25, name: 'Bahnrettung' }
    ]],

    [2, [
      { value: 0, name: 'Großwache' }
    ]],

    [20, [
      { value: 0, name: 'Großwache' }
    ]],

    [4, [
      { value: 0, name: 'Allgemeine Innere' },
      { value: 1, name: 'Allgemeine Chirurgie' },
      { value: 2, name: 'Gynäkologie' },
      { value: 3, name: 'Urologie' },
      { value: 4, name: 'Unfallchirurgie' },
      { value: 5, name: 'Neurologie' },
      { value: 6, name: 'Neurochirurgie' },
      { value: 7, name: 'Kardiologie' },
      { value: 8, name: 'Kardiochirurgie' },
      { value: 9, name: 'Großkrankenhaus' }
    ]],

    [6, [
      ...numberedOptions(
        'Zelle',
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      ),
      { value: 10, name: 'Diensthundestaffel' },
      { value: 11, name: 'Kriminalpolizei' },
      { value: 12, name: 'Dienstgruppenleitung' },
      { value: 13, name: 'Motorradstaffel' },
      { value: 14, name: 'Großwache' },
      { value: 15, name: 'Großgewahrsam' }
    ]],

    [19, [
      ...numberedOptions(
        'Zelle',
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      ),
      { value: 10, name: 'Diensthundestaffel' },
      { value: 11, name: 'Kriminalpolizei' },
      { value: 12, name: 'Dienstgruppenleitung' },
      { value: 13, name: 'Motorradstaffel' },
      { value: 14, name: 'Großwache' },
      { value: 15, name: 'Großgewahrsam' }
    ]],

    [16, numberedOptions(
      'Zelle',
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    )],

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
      {
        value: 0,
        name: '1. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung'
      },
      {
        value: 1,
        name: '1. Technischer Zug: Zugtrupp'
      },
      { value: 2, name: 'Fachgruppe Räumen' },
      { value: 3, name: 'Fachgruppe Wassergefahren' },
      {
        value: 4,
        name: '2. Technischer Zug - Grundvoraussetzungen'
      },
      {
        value: 5,
        name: '2. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung'
      },
      {
        value: 6,
        name: '2. Technischer Zug: Zugtrupp'
      },
      { value: 7, name: 'Fachgruppe Ortung' },
      { value: 8, name: 'Fachgruppe Wasserschaden/Pumpen' },
      { value: 9, name: 'Fachgruppe schwere Bergung' },
      { value: 10, name: 'Fachgruppe Elektroversorgung' },
      {
        value: 11,
        name: 'Ortsverbands-Mannschaftstransportwagen'
      },
      {
        value: 12,
        name: 'Trupp Unbemannte Luftfahrtsysteme'
      },
      {
        value: 13,
        name: 'Fachzug Führung und Kommunikation'
      },
      {
        value: 14,
        name: 'Fachgruppe Logistik-Verpflegung'
      }
    ]],

    [12, [
      { value: 0, name: 'Führung' },
      { value: 1, name: 'Sanitätsdienst' },
      { value: 2, name: 'Wasserrettungs-Erweiterung' },
      { value: 3, name: 'Rettungshundestaffel' },
      { value: 4, name: 'SEG Drohne' },
      { value: 5, name: 'Betreuungs- und Verpflegungsdienst' },
      { value: 6, name: 'Technik und Sicherheit' }
    ]]
  ]);

  let running = false;
  let cancelled = false;
  let buttons = [];

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function el(tag, className = '', text = '') {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function parseStoredArray(value) {
    try {
      const parsed = typeof value === 'string'
        ? JSON.parse(value)
        : value;

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  async function selectedIds(prefix, buildingType) {
    return parseStoredArray(
      await GM.getValue(
        `${prefix}${buildingType}`,
        '[]'
      )
    )
      .map(Number)
      .filter(Number.isInteger);
  }

  function safeNumber(raw, fallback, min, max) {
    const number = Number(raw);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    return Math.max(
      min,
      Math.min(max, Math.floor(number))
    );
  }

  function formatNumber(value) {
    return Number(value).toLocaleString('de-DE');
  }

  /*
   * ==========================================
   * GEBÄUDE LADEN
   * ==========================================
   */

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
        dispatchCenterId == null
          ? null
          : Number(dispatchCenterId),
      caption:
        building.caption ||
        building.name ||
        `Gebäude ${building.id}`,
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
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function' ||
      typeof getDataByIndex !== 'function'
    ) {
      throw new Error(
        'NilsPe-Skriptbasis wurde nicht geladen.'
      );
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      return (
        await getDataByIndex(
          db,
          'buildings',
          'leitstelle_building_id',
          Number(dispatchCenterId)
        )
      )
        .map(normalizeBuilding)
        .sort((a, b) => a.id - b.id);
    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * ERWEITERUNGEN FÜR EINSTELLUNGEN
   * ==========================================
   *
   * Grundkatalog + aus API-Cache
   * erkannte Erweiterungen.
   */

  async function extensionOptions() {
    const optionsByType = new Map();

    for (const buildingType of BUILDING_TYPES) {
      optionsByType.set(
        buildingType.id,
        new Map(
          (EXTENSIONS.get(buildingType.id) ?? [])
            .map(option => [
              Number(option.value),
              option
            ])
        )
      );
    }

    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function'
    ) {
      return optionsByType;
    }

    const db = await openDb();

    try {
      await updateBuildings(db, 60);

      for (
        const rawBuilding of
        await getAllData(db, 'buildings')
      ) {
        const building = normalizeBuilding(
          rawBuilding
        );

        const options = optionsByType.get(
          building.building_type
        );

        if (!options) continue;

        for (const extension of building.extensions) {
          if (
            !Number.isInteger(extension.type_id)
          ) {
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
        PREFIX,
        'API-Erweiterungen konnten nicht geladen werden:',
        error
      );
    } finally {
      db.close();
    }

    return optionsByType;
  }

  /*
   * ==========================================
   * EINHEITLICHER EINSTELLUNGSSTANDARD
   * ==========================================
   *
   * Überschrift und Beschreibung
   * identisch zum Delete-Buildings-Stil.
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-ae-settings-style'
      )
    ) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-ae-settings-style';

    style.textContent = `
      #${SETTINGS_IDENTIFIER} .nilspe-ae-info {
        margin-bottom: 10px;
        font-size: 12px;
        opacity: .85;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-group > summary {
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
        font-weight: bold;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-content {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-subgroup {
        margin-bottom: 6px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-subgroup > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 9px 12px;
        background: #8882;
        cursor: pointer;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-subgroup-content {
        padding: 10px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 9px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-bulk {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 110px;
        height: 28px;
        margin: 0 !important;
        padding: 2px 6px !important;
        font-size: 13px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-option {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 7px 9px;
        margin-bottom: 4px;
        background: #8881;
        border: 1px solid #8885;
        border-radius: 3px;
        box-sizing: border-box;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-option.active {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-option-label {
        flex: 1;
        margin: 0;
        cursor: pointer;
        font-weight: normal;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-option:not(.active)
      .nilspe-ae-option-label {
        opacity: .7;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-toggle {
        flex: 0 0 30px;
        width: 30px;
        min-width: 30px;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-number {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 7px 9px;
        margin-bottom: 4px;
        border: 1px solid rgba(92,184,92,.35);
        border-radius: 3px;
        background: rgba(92,184,92,.10);
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-number input {
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        padding: 3px 7px !important;
        box-sizing: border-box;
        text-align: left;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-number label {
        flex: 1;
        margin: 0;
        font-weight: normal;
      }

      #${SETTINGS_IDENTIFIER} .nilspe-ae-save {
        font-size: 12px;
        opacity: .75;
      }
    `;

    document.head.append(style);
  }

  function makeGroup(title, description) {
    const details = el(
      'details',
      'nilspe-ae-group'
    );

    const summary = el(
      'summary',
      '',
      title
    );

    const content = el(
      'div',
      'nilspe-ae-content'
    );

    if (description) {
      content.append(
        el(
          'p',
          'nilspe-ae-info',
          description
        )
      );
    }

    details.append(summary, content);

    return { details, content };
  }

  /*
   * ==========================================
   * AUSWAHLLISTE JE GEBÄUDETYP
   * ==========================================
   */

  async function createExtensionSelection(
    parent,
    prefix,
    buildingType,
    options
  ) {
    if (!options.length) return;

    const storageKey =
      `${prefix}${buildingType.id}`;

    const allowedIds = new Set(
      options.map(option => Number(option.value))
    );

    const selected = new Set(
      (await selectedIds(
        prefix,
        buildingType.id
      )).filter(id => allowedIds.has(id))
    );

    const details = el(
      'details',
      'nilspe-ae-subgroup'
    );

    const summary = el('summary');

    const title = el(
      'strong',
      '',
      `${buildingType.id} – ${buildingType.name}`
    );

    const badge = el(
      'span',
      'label label-default'
    );

    summary.append(title, badge);

    const content = el(
      'div',
      'nilspe-ae-subgroup-content'
    );

    const toolbar = el(
      'div',
      'nilspe-ae-toolbar'
    );

    const selectAll = el(
      'button',
      'btn btn-default btn-xs nilspe-ae-bulk',
      'Alle anwählen'
    );

    const clearAll = el(
      'button',
      'btn btn-default btn-xs nilspe-ae-bulk',
      'Alle abwählen'
    );

    selectAll.type = 'button';
    clearAll.type = 'button';

    const saveStatus = el(
      'span',
      'nilspe-ae-save'
    );

    const list = el('div');

    let saveQueue = Promise.resolve();

    function save() {
      const snapshot = [...selected].sort(
        (a, b) => a - b
      );

      saveStatus.textContent = 'Speichere ...';

      saveQueue = saveQueue
        .catch(() => {})
        .then(() =>
          GM.setValue(
            storageKey,
            JSON.stringify(snapshot)
          )
        )
        .then(() => {
          saveStatus.textContent = 'Gespeichert';
        })
        .catch(error => {
          saveStatus.textContent =
            'Speichern fehlgeschlagen';

          console.error(
            PREFIX,
            'Speichern fehlgeschlagen:',
            storageKey,
            error
          );
        });
    }

    function update() {
      badge.textContent =
        `${selected.size} / ${options.length} ausgewählt`;

      badge.className = selected.size
        ? 'label label-success'
        : 'label label-default';

      list.replaceChildren();

      for (const option of options) {
        const id = Number(option.value);
        const active = selected.has(id);

        const row = el(
          'div',
          'nilspe-ae-option'
        );

        row.classList.toggle('active', active);

        const label = el(
          'span',
          'nilspe-ae-option-label',
          `${option.name} (${id})`
        );

        const toggle = el(
          'button',
          'btn btn-xs nilspe-ae-toggle ' +
            (active
              ? 'btn-danger'
              : 'btn-success'),
          active ? '✕' : '✓'
        );

        toggle.type = 'button';

        toggle.title = active
          ? 'Erweiterung abwählen'
          : 'Erweiterung auswählen';

        function toggleSelection() {
          if (selected.has(id)) {
            selected.delete(id);
          } else {
            selected.add(id);
          }

          update();
          save();
        }

        label.addEventListener(
          'click',
          toggleSelection
        );

        toggle.addEventListener(
          'click',
          toggleSelection
        );

        row.append(label, toggle);
        list.append(row);
      }
    }

    selectAll.addEventListener('click', () => {
      selected.clear();

      for (const option of options) {
        selected.add(
          Number(option.value)
        );
      }

      update();
      save();
    });

    clearAll.addEventListener('click', () => {
      selected.clear();
      update();
      save();
    });

    toolbar.append(
      selectAll,
      clearAll,
      saveStatus
    );

    content.append(toolbar, list);

    details.append(summary, content);
    parent.append(details);

    update();
  }

  /*
   * ==========================================
   * ZAHLENFELDER
   * ==========================================
   */

  async function createNumberSetting(
    parent,
    {
      key,
      label,
      fallback,
      min = 0,
      max = 5000
    }
  ) {
    const row = el(
      'div',
      'nilspe-ae-number'
    );

    const input = el(
      'input',
      'form-control input-sm'
    );

    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';

    input.value = String(
      safeNumber(
        await GM.getValue(
          key,
          fallback
        ),
        fallback,
        min,
        max
      )
    );

    const caption = el(
      'label',
      '',
      label
    );

    const status = el(
      'span',
      'nilspe-ae-save'
    );

    row.append(
      input,
      caption,
      status
    );

    let saveQueue = Promise.resolve();

    input.addEventListener('change', () => {
      const value = safeNumber(
        input.value,
        fallback,
        min,
        max
      );

      input.value = String(value);
      status.textContent = 'Speichere ...';

      saveQueue = saveQueue
        .catch(() => {})
        .then(() => GM.setValue(key, value))
        .then(() => {
          status.textContent = 'Gespeichert';
        })
        .catch(error => {
          status.textContent =
            'Speichern fehlgeschlagen';

          console.error(
            PREFIX,
            key,
            error
          );
        });
    });

    parent.append(row);
  }

  /*
   * ==========================================
   * EINSTELLUNGSSEITE
   * ==========================================
   */

  async function createSettings() {
    if (
      typeof waitForSettingsDom !== 'function' ||
      typeof createSettingsPane !== 'function'
    ) {
      console.error(
        PREFIX,
        'NilsPe-Skriptbasis fehlt.'
      );

      return;
    }

    if (!await waitForSettingsDom()) {
      return;
    }

    const { anchor, body } =
      createSettingsPane(
        SETTINGS_IDENTIFIER,
        'De-/Activate Extensions'
      );

    injectSettingsStyles();

    let rendered = false;
    let rendering = false;

    async function renderSettings() {
      if (rendered || rendering) {
        return;
      }

      rendering = true;

      try {
        const optionsByType =
          await extensionOptions();

        const activate = makeGroup(
          'Erweiterungen aktivieren',
          'Auswahl der Erweiterungen, die auf ' +
          'den zugehörigen Gebäudetypen ' +
          'aktiviert werden sollen.'
        );

        const deactivate = makeGroup(
          'Erweiterungen deaktivieren',
          'Auswahl der Erweiterungen, die auf ' +
          'den zugehörigen Gebäudetypen ' +
          'deaktiviert werden sollen.'
        );

        const flow = makeGroup(
          'Ablauf',
          'Die Geschwindigkeitseinstellungen ' +
          'gelten für beide Aktionen.'
        );

        for (const buildingType of BUILDING_TYPES) {
          const options = [
            ...(
              optionsByType.get(
                buildingType.id
              )?.values() ?? []
            )
          ].sort((a, b) =>
            Number(a.value) - Number(b.value)
          );

          if (!options.length) {
            continue;
          }

          await createExtensionSelection(
            activate.content,
            ACTIVATE_PREFIX,
            buildingType,
            options
          );

          await createExtensionSelection(
            deactivate.content,
            DEACTIVATE_PREFIX,
            buildingType,
            options
          );
        }

        await createNumberSetting(
          flow.content,
          {
            key: ACTION_DELAY_KEY,
            label: 'Pause nach einer Umschaltung [ms]',
            fallback: DEFAULT_ACTION_DELAY
          }
        );

        await createNumberSetting(
          flow.content,
          {
            key: BUILDING_DELAY_KEY,
            label: 'Pause nach einem Gebäude [ms]',
            fallback: DEFAULT_BUILDING_DELAY
          }
        );

        /*
         * Einheitliche Hauptüberschrift
         * wie bei Delete Buildings.
         *
         * Normales h2 ohne Fettschrift.
         * Beschreibung direkt darunter.
         */

        const title = el(
          'h2',
          '',
          'De-/Activate Extensions'
        );

        const description = el(
          'p',
          'nilspe-ae-info',
          'Erweiterungen auswählen und deren Aktivierung oder Deaktivierung konfigurieren.'
        );

        body.replaceChildren(
          title,
          description,
          activate.details,
          deactivate.details,
          flow.details
        );

        rendered = true;

        console.log(
          PREFIX,
          `Einstellungen v${VERSION} geladen`
        );
      } catch (error) {
        console.error(
          PREFIX,
          'Einstellungsoberfläche fehlgeschlagen:',
          error
        );
      } finally {
        rendering = false;
      }
    }

    anchor.addEventListener(
      'click',
      () => void renderSettings()
    );

    if (
      location.hash ===
      `#${SETTINGS_IDENTIFIER}`
    ) {
      await renderSettings();
      anchor.click();
    }
  }

  /*
   * ==========================================
   * UMSCHALT-URLS DER ERWEITERUNGEN
   * ==========================================
   */

  function csrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ?? '';
  }

  async function toggleUrls(buildingId) {
    const response = await fetch(
      `/buildings/${buildingId}`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gebäudeseite HTTP ${response.status}`
      );
    }

    const parsed = new DOMParser()
      .parseFromString(
        await response.text(),
        'text/html'
      );

    const urls = new Map();

    for (
      const link of
      parsed.querySelectorAll(
        'a[href*="/extension_ready/"]'
      )
    ) {
      const href =
        link.getAttribute('href') ?? '';

      const match = href.match(
        /\/extension_ready\/(\d+)/
      );

      if (!match) {
        continue;
      }

      urls.set(
        Number(match[1]),
        new URL(
          href,
          location.origin
        ).href
      );
    }

    return urls;
  }

  /*
   * ==========================================
   * ERWEITERUNG UMSCHALTEN
   * ==========================================
   */

  async function toggleExtension(url) {
    const token = csrfToken();

    if (!token) {
      throw new Error(
        'CSRF-Token wurde nicht gefunden.'
      );
    }

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
        _method: 'post',
        authenticity_token: token
      }),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(
        `Umschaltung HTTP ${response.status}`
      );
    }
  }

  /*
   * ==========================================
   * FORTSCHRITTSANZEIGE
   * ==========================================
   */

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-ae-progress'
      )
    ) {
      return;
    }

    const style = el('style');
    style.id = 'nilspe-ae-style';

    style.textContent = `
      #nilspe-ae-progress {
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

      #nilspe-ae-progress-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      #nilspe-ae-statistics {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-top: 6px;
        font-size: 12px;
      }

      #nilspe-ae-track {
        height: 12px;
        margin-top: 6px;
        overflow: hidden;
        border-radius: 4px;
        background: #777;
      }

      #nilspe-ae-fill {
        height: 100%;
        width: 0;
        background: #5cb85c;
        transition: width .15s;
      }
    `;

    document.head.append(style);

    const container = el('div');
    container.id = 'nilspe-ae-progress';

    const row = el('div');
    row.id = 'nilspe-ae-progress-row';

    const stop = el(
      'button',
      'btn btn-danger btn-xs',
      'Abbrechen'
    );

    stop.id = 'nilspe-ae-stop';
    stop.type = 'button';

    stop.addEventListener('click', () => {
      if (!running) return;

      cancelled = true;
      stop.disabled = true;

      const status = document.getElementById(
        'nilspe-ae-status'
      );

      if (status) {
        status.textContent =
          'Abbruch – laufende Anfragen werden beendet ...';
      }
    });

    const status = el(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id = 'nilspe-ae-status';

    const close = el(
      'button',
      'btn btn-default btn-xs',
      'Schließen'
    );

    close.id = 'nilspe-ae-close';
    close.type = 'button';
    close.disabled = true;

    close.addEventListener('click', () => {
      if (running) return;
      container.remove();
    });

    const statistics = el('div');
    statistics.id = 'nilspe-ae-statistics';

    const track = el('div');
    track.id = 'nilspe-ae-track';

    const fill = el('div');
    fill.id = 'nilspe-ae-fill';

    track.append(fill);
    row.append(stop, status, close);

    container.append(
      row,
      statistics,
      track
    );

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

    const status = document.getElementById(
      'nilspe-ae-status'
    );

    const fill = document.getElementById(
      'nilspe-ae-fill'
    );

    status.className = `label label-${type}`;
    status.textContent = message;

    fill.style.width = total > 0
      ? `${Math.min(
          100,
          completed / total * 100
        )}%`
      : '0%';
  }

  function updateStatistics(
    changed,
    completed,
    errors,
    total
  ) {
    const statistics = document.getElementById(
      'nilspe-ae-statistics'
    );

    if (!statistics) return;

    statistics.replaceChildren();

    for (const item of [
      `Umgeschaltete Erweiterungen: ${formatNumber(changed)}`,
      `Fehler: ${formatNumber(errors)}`,
      `Gebäude: ${formatNumber(completed)}/${formatNumber(total)}`
    ]) {
      statistics.append(
        el('span', '', item)
      );
    }
  }

  function finishProgress() {
    const stop = document.getElementById(
      'nilspe-ae-stop'
    );

    const close = document.getElementById(
      'nilspe-ae-close'
    );

    if (stop) stop.disabled = true;
    if (close) close.disabled = false;
  }

  /*
   * ==========================================
   * ERWEITERUNGEN PRO GEBÄUDE
   * ==========================================
   */

  async function configurationFor(
    building,
    desiredState,
    selectedExtensionIds = null
  ) {
    const prefix = desiredState
      ? ACTIVATE_PREFIX
      : DEACTIVATE_PREFIX;

    const selected =
      selectedExtensionIds ??
      new Set(
        await selectedIds(
          prefix,
          building.building_type
        )
      );

    return building.extensions.filter(
      extension =>
        selected.has(extension.type_id) &&
        extension.available !== false &&
        extension.enabled !== desiredState
    );
  }

  /*
   * ==========================================
   * EIN GEBÄUDE ABARBEITEN
   * ==========================================
   */

  async function processBuilding(
    building,
    desiredState,
    actionDelay,
    configuredExtensions = null
  ) {
    const extensions =
      configuredExtensions ??
      await configurationFor(
        building,
        desiredState
      );

    if (!extensions.length) {
      return 0;
    }

    const urls = await toggleUrls(building.id);
    let changed = 0;

    for (const extension of extensions) {
      if (cancelled) {
        break;
      }

      const url = urls.get(
        extension.type_id
      );

      if (!url) {
        console.warn(
          PREFIX,
          'Keine Umschalt-URL:',
          building.id,
          extension.type_id
        );

        continue;
      }

      await toggleExtension(url);
      changed++;

      if (
        !cancelled &&
        actionDelay > 0
      ) {
        await sleep(actionDelay);
      }
    }

    return changed;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function run(desiredState) {
    if (running) {
      return;
    }

    running = true;
    cancelled = false;

    for (const button of buttons) {
      button.disabled = true;
    }

    ensureProgress();

    const stop = document.getElementById(
      'nilspe-ae-stop'
    );

    const close = document.getElementById(
      'nilspe-ae-close'
    );

    stop.disabled = false;
    close.disabled = true;

    let completed = 0;
    let errors = 0;
    let changed = 0;
    let total = 0;

    updateStatistics(0, 0, 0, 0);

    try {
      const dispatchCenterId = Number(
        location.pathname.match(
          /^\/buildings\/(\d+)/
        )?.[1]
      );

      if (
        !Number.isSafeInteger(dispatchCenterId) ||
        dispatchCenterId <= 0
      ) {
        throw new Error(
          'Ungültige Leitstellen-ID.'
        );
      }

      const actionDelay = safeNumber(
        await GM.getValue(
          ACTION_DELAY_KEY,
          DEFAULT_ACTION_DELAY
        ),
        DEFAULT_ACTION_DELAY,
        0,
        5000
      );

      const buildingDelay = safeNumber(
        await GM.getValue(
          BUILDING_DELAY_KEY,
          DEFAULT_BUILDING_DELAY
        ),
        DEFAULT_BUILDING_DELAY,
        0,
        5000
      );

      setProgress(
        'Gebäude werden geladen ...'
      );

      const buildings = await loadBuildings(
        dispatchCenterId
      );

      const prefix = desiredState
        ? ACTIVATE_PREFIX
        : DEACTIVATE_PREFIX;

      const selectedByBuildingType = new Map();

      for (const building of buildings) {
        const buildingType =
          building.building_type;

        if (
          !selectedByBuildingType.has(
            buildingType
          )
        ) {
          selectedByBuildingType.set(
            buildingType,
            new Set(
              await selectedIds(
                prefix,
                buildingType
              )
            )
          );
        }
      }

      const relevant = [];

      for (const building of buildings) {
        const extensions =
          await configurationFor(
            building,
            desiredState,
            selectedByBuildingType.get(
              building.building_type
            )
          );

        if (extensions.length > 0) {
          relevant.push({
            building,
            extensions
          });
        }
      }

      total = relevant.length;

      if (!total) {
        setProgress(
          'Keine Umschaltung erforderlich',
          0, 0, 0, 'success'
        );

        updateStatistics(0, 0, 0, 0);
        return;
      }

      updateStatistics(
        0,
        0,
        0,
        total
      );

      await runWithConcurrency(
        relevant,

        async ({ building, extensions }) => {
          if (cancelled) return;

          setProgress(
            `${completed}/${total}: ${building.caption}`,
            completed,
            errors,
            total
          );

          try {
            const buildingChanges =
              await processBuilding(
                building,
                desiredState,
                actionDelay,
                extensions
              );

            changed += buildingChanges;

          } catch (error) {
            errors++;

            console.error(
              PREFIX,
              'Gebäude fehlgeschlagen:',
              building.id,
              error
            );
          }

          completed++;

          updateStatistics(
            changed,
            completed,
            errors,
            total
          );

          setProgress(
            `${completed}/${total} Gebäude, ` +
            `${changed} umgeschaltet`,
            completed,
            errors,
            total,
            errors ? 'warning' : 'info'
          );
        },

        {
          concurrency: 3,
          delay: buildingDelay,
          shouldContinue: () => !cancelled
        }
      );

      if (cancelled) {
        setProgress(
          `Abgebrochen: ${changed} umgeschaltet, ` +
          `${errors} Fehler, ${total - completed} Gebäude offen`,
          completed,
          errors,
          total,
          'warning'
        );
      } else {
        setProgress(
          `Fertig: ${changed} umgeschaltet, ` +
          `${errors} Fehler`,
          completed,
          errors,
          total,
          errors ? 'warning' : 'success'
        );
      }

    } catch (error) {
      console.error(
        PREFIX,
        'Lauf fehlgeschlagen:',
        error
      );

      setProgress(
        `Fehler: ${error.message ?? error}`,
        completed,
        errors,
        total,
        'danger'
      );

    } finally {
      running = false;

      for (const button of buttons) {
        button.disabled = false;
      }

      finishProgress();
    }
  }

  /*
   * ==========================================
   * BUTTONS IN DER LEITSTELLE
   * ==========================================
   */

  function settingsButton() {
    const button = el(
      'a',
      'btn btn-default btn-xs'
    );

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    button.append(
      el(
        'span',
        'glyphicon glyphicon-cog'
      )
    );

    return button;
  }

  function addButtons() {
    const heading = document.querySelector(
      'h1[building_type]'
    );

    if (
      Number(
        heading?.getAttribute(
          'building_type'
        )
      ) !== 7 ||
      document.getElementById(
        'nilspe-ae-buttons'
      )
    ) {
      return;
    }

    const details = document.querySelector(
      '.building-title ~ dl.dl-horizontal'
    );

    if (!details) {
      return;
    }

    const term = el('dt');

    term.append(
      el('strong', '', 'Erweiterungen:')
    );

    const description = el('dd');

    const group = el(
      'div',
      'btn-group'
    );

    group.id = 'nilspe-ae-buttons';

    const activate = el(
      'button',
      'btn btn-default btn-xs',
      'Aktivieren'
    );

    const deactivate = el(
      'button',
      'btn btn-default btn-xs',
      'Deaktivieren'
    );

    activate.type = 'button';
    deactivate.type = 'button';

    buttons = [
      activate,
      deactivate
    ];

    activate.addEventListener(
      'click',
      () => void run(true)
    );

    deactivate.addEventListener(
      'click',
      () => void run(false)
    );

    group.append(
      activate,
      deactivate,
      settingsButton()
    );

    description.append(group);

    details.append(
      term,
      description
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
    addButtons();

    new MutationObserver(addButtons).observe(
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
