
// ==UserScript==
// @name         Leitstelle Wachenpersonal
// @namespace    NilsPe.building.personnel
// @version      2.1.0
// @description  Personal-Soll und automatische Personalwerbung mit moderner Wachenauswahl
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Wachenpersonal.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Wachenpersonal.user.js
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

  const PREFIX = '[Leitstelle Wachenpersonal]';
  const VERSION = '2.1.0';

  const SETTINGS_IDENTIFIER = 'nilspe_building_personnel';
  const TARGET_PREFIX = 'nilspe_building_personnel_target_';
  const ENABLED_PREFIX = 'nilspe_building_personnel_enabled_';

  const REQUEST_DELAY_KEY =
    'nilspe_building_personnel_request_delay';

  const DEFAULT_REQUEST_DELAY = 100;

  /*
   * ==========================================
   * GEBÄUDETYPEN
   * ==========================================
   *
   * Nur Gebäude mit eigenem Fahrzeugbestand.
   * Schulen, Leitstellen usw. werden nicht
   * zur Auswahl angeboten.
   *
   * Bestehende IDs bleiben erhalten.
   */

  const BUILDING_GROUPS = [
    {
      name: 'Feuerwehr',
      buildings: [
        [0, 'Feuerwache'],
        [18, 'Feuerwache (Kleinwache)']
      ]
    },
    {
      name: 'Rettungsdienst',
      buildings: [
        [2, 'Rettungswache'],
        [20, 'Rettungswache (Kleinwache)'],
        [5, 'Rettungshubschrauber-Station'],
        [12, 'Schnelleinsatzgruppe (SEG)'],
        [15, 'Wasserrettung'],
        [21, 'Rettungshundestaffel'],
        [25, 'Bergrettung'],
        [26, 'Seenotrettungswache'],
        [28, 'Hubschrauberstation (Seenotrettung)']
      ]
    },
    {
      name: 'Polizei',
      buildings: [
        [6, 'Polizeiwache'],
        [19, 'Polizeiwache (Kleinwache)'],
        [11, 'Bereitschaftspolizei'],
        [17, 'Polizei-Sondereinheiten'],
        [13, 'Polizeihubschrauberstation'],
        [24, 'Reiterstaffel'],
        [29, 'Autobahnpolizei']
      ]
    },
    {
      name: 'THW',
      buildings: [
        [9, 'THW-Ortsverband']
      ]
    }
  ];

  const BUILDING_TYPES = BUILDING_GROUPS.flatMap(
    group => group.buildings.map(([id, name]) => ({
      id,
      name
    }))
  );

  const sleep = milliseconds =>
    new Promise(resolve =>
      setTimeout(resolve, milliseconds)
    );

  let running = false;
  let cancelled = false;

  /*
   * ==========================================
   * EINSTELLUNGEN: LESEN UND SPEICHERN
   * ==========================================
   *
   * Die bisherigen Sollwert-Keys bleiben
   * unverändert erhalten.
   */

  function targetKey(buildingType) {
    return `${TARGET_PREFIX}${buildingType}`;
  }

  function enabledKey(buildingType) {
    return `${ENABLED_PREFIX}${buildingType}`;
  }

  async function getTarget(buildingType) {
    const raw = await GM.getValue(
      targetKey(buildingType),
      0
    );

    const value = Number(raw);

    return (
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 10000
    )
      ? value
      : 0;
  }

  async function setTarget(buildingType, value) {
    const number = Number(value);

    if (
      !Number.isInteger(number) ||
      number < 0 ||
      number > 10000
    ) {
      throw new Error(
        'Der Sollwert muss zwischen 0 und 10000 liegen.'
      );
    }

    await GM.setValue(
      targetKey(buildingType),
      number
    );

    return number;
  }

  async function isEnabled(
    buildingType,
    target = undefined
  ) {
    const saved = await GM.getValue(
      enabledKey(buildingType),
      null
    );

    if (saved !== null) {
      return saved === true ||
        saved === 'true';
    }

    const configuredTarget =
      target === undefined
        ? await getTarget(buildingType)
        : target;

    // Migration: Bereits konfigurierte
    // Gebäudetypen bleiben automatisch aktiv.
    return configuredTarget > 0;
  }

  async function setEnabled(
    buildingType,
    enabled
  ) {
    await GM.setValue(
      enabledKey(buildingType),
      Boolean(enabled)
    );
  }

  /*
   * ==========================================
   * UI-HILFSFUNKTION
   * ==========================================
   */

  function element(
    tag,
    className = '',
    text = ''
  ) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text) {
      node.textContent = text;
    }

    return node;
  }

  /*
   * ==========================================
   * EINSTELLUNGS-STYLES
   * ==========================================
   */

  function injectSettingsStyles() {
    if (
      document.getElementById(
        'nilspe-wp-settings-style'
      )
    ) {
      return;
    }

    const style = element('style');
    style.id = 'nilspe-wp-settings-style';

    style.textContent = `
      #nilspe-wp-modern {
        margin-bottom: 24px;
      }

      .nilspe-wp-group {
        margin-bottom: 7px;
        border: 1px solid #8885;
        border-radius: 4px;
        overflow: hidden;
      }

      .nilspe-wp-group > summary {
        padding: 9px 12px;
        cursor: pointer;
        background: #8882;
        font-weight: bold;
      }

      .nilspe-wp-group-body {
        padding: 10px;
      }

      .nilspe-wp-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }

      .nilspe-wp-bulk {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        flex: 0 0 110px;
        width: 110px;
        height: 28px;
        padding: 2px 6px !important;
        margin: 0 !important;
        white-space: nowrap;
        font-size: 13px;
        line-height: 1;
      }

      .nilspe-wp-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        margin-bottom: 3px;
        border: 1px solid #8885;
        border-radius: 3px;
        background: #8881;
      }

      .nilspe-wp-row.active {
        background: rgba(92,184,92,.10);
        border-color: rgba(92,184,92,.35);
      }

      .nilspe-wp-target {
        order: 0;
        box-sizing: border-box;
        flex: 0 0 84px;
        width: 84px !important;
        height: 28px !important;
        margin: 0 !important;
        padding: 3px 7px !important;
        text-align: left;
      }

      .nilspe-wp-name {
        order: 1;
        flex: 1;
        min-width: 130px;
        cursor: pointer;
      }

      .nilspe-wp-row:not(.active)
      .nilspe-wp-name {
        opacity: .6;
      }

      .nilspe-wp-toggle {
        order: 2;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        flex: 0 0 30px;
        width: 30px;
        height: 28px;
        padding: 2px 5px !important;
        margin: 0 !important;
        font-size: 13px;
        line-height: 1;
      }

      .nilspe-wp-count {
        margin-left: auto;
        opacity: .7;
        font-size: 12px;
      }
    `;

    document.head.append(style);
  }

  /*
   * ==========================================
   * EINSTELLUNGSOBERFLÄCHE
   * ==========================================
   */

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(
        PREFIX,
        'NilsPe-Skriptbasis fehlt.'
      );
      return;
    }

    /*
     * Die Ablauf-Einstellungen laufen weiterhin
     * über die bewährte Scriptbasis.
     */

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Wachenpersonal',
      settings: [
        {
          type: 'header',
          text: 'Ablauf'
        },
        {
          type: 'number',
          key: REQUEST_DELAY_KEY,
          label: 'Abstand zwischen Starts [ms]',
          min: 0,
          max: 5000,
          default: DEFAULT_REQUEST_DELAY
        }
      ]
    });

    const body = document.getElementById(
      SETTINGS_IDENTIFIER
    )?.querySelector(
      '.settings-tab-body'
    );

    if (
      !body ||
      document.getElementById(
        'nilspe-wp-modern'
      )
    ) {
      return;
    }

    injectSettingsStyles();

    const root = element('section');
    root.id = 'nilspe-wp-modern';

    const heading = element(
      'h2',
      '',
      'Personal-Soll je Gebäudetyp'
    );

    const description = element('p');

    description.textContent =
      '0 = keine Vorgabe. ' +
      'Nur aktivierte Gebäudetypen mit einem ' +
      'Sollwert größer 0 werden bearbeitet. ' +
      'Beim Abwählen bleibt der Sollwert gespeichert.';

    description.style.fontSize = '12px';
    description.style.marginBottom = '12px';

    root.append(
      heading,
      description
    );

    /*
     * Gemeinsamer Status aller Gebäudetypen.
     */

    const states = new Map();
    const saveQueues = new Map();

    for (const building of BUILDING_TYPES) {
      const target = await getTarget(
        building.id
      );

      states.set(building.id, {
        target,
        enabled: await isEnabled(
          building.id,
          target
        )
      });
    }

    /*
     * Schreibvorgänge je Gebäudetyp
     * nacheinander ausführen.
     */

    function queueSave(typeId, action) {
      const previous =
        saveQueues.get(typeId) ||
        Promise.resolve();

      const next = previous
        .catch(() => {})
        .then(action);

      saveQueues.set(typeId, next);

      void next.catch(error => {
        console.error(
          PREFIX,
          'Einstellung konnte nicht gespeichert werden:',
          typeId,
          error
        );
      });
    }

    /*
     * Kategorien erzeugen.
     */

    for (const group of BUILDING_GROUPS) {
      const details = element(
        'details',
        'nilspe-wp-group'
      );

      const summary = element(
        'summary',
        '',
        group.name
      );

      const content = element(
        'div',
        'nilspe-wp-group-body'
      );

      const toolbar = element(
        'div',
        'nilspe-wp-toolbar'
      );

      const count = element(
        'span',
        'nilspe-wp-count'
      );

      const rows = [];

      /*
       * Status dieser Kategorie aktualisieren.
       */

      function render() {
        for (const item of rows) {
          const state = states.get(
            item.buildingType
          );

          const active =
            state.enabled &&
            state.target > 0;

          item.row.classList.toggle(
            'active',
            active
          );

          item.input.value = String(
            state.target
          );

          item.toggle.className =
            'btn btn-xs nilspe-wp-toggle ' +
            (
              state.enabled
                ? 'btn-danger'
                : 'btn-success'
            );

          item.toggle.textContent =
            state.enabled ? '✕' : '✓';

          item.toggle.title =
            state.enabled
              ? 'Gebäudetyp abwählen'
              : 'Gebäudetyp auswählen';
        }

        const activeCount =
          group.buildings.filter(
            ([typeId]) => {
              const state = states.get(
                typeId
              );

              return (
                state.enabled &&
                state.target > 0
              );
            }
          ).length;

        count.textContent =
          `${activeCount} von ` +
          `${group.buildings.length} konfiguriert`;
      }

      /*
       * Alle auswählen / abwählen.
       */

      function setAll(enabled) {
        for (const [typeId] of group.buildings) {
          const state = states.get(
            typeId
          );

          if (!state) continue;

          state.enabled = enabled;

          queueSave(
            typeId,
            () => setEnabled(
              typeId,
              enabled
            )
          );
        }

        render();
      }

      function bulkButton(
        text,
        color,
        enabled
      ) {
        const button = element(
          'button',
          `btn btn-xs ${color} nilspe-wp-bulk`,
          text
        );

        button.type = 'button';

        button.addEventListener(
          'click',
          () => setAll(enabled)
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

      const list = element('div');

      /*
       * Einzelne Wachentypen.
       *
       * [ Sollwert ] [ Wachenname ] [ An/Aus ]
       */

      for (
        const [typeId, buildingName]
        of group.buildings
      ) {
        const state = states.get(
          typeId
        );

        const row = element(
          'div',
          'nilspe-wp-row'
        );

        const input = element(
          'input',
          'form-control input-sm nilspe-wp-target'
        );

        input.type = 'number';
        input.min = '0';
        input.max = '10000';
        input.step = '1';
        input.title =
          'Personal-Soll je Wache (0–10000)';

        const name = element(
          'span',
          'nilspe-wp-name',
          `${buildingName} (${typeId})`
        );

        const toggle = element(
          'button',
          'btn btn-xs nilspe-wp-toggle'
        );

        toggle.type = 'button';

        /*
         * Sollwert ändern.
         */

        input.addEventListener(
          'change',
          () => {
            const raw = input.value.trim();

            const target =
              raw === ''
                ? 0
                : Number(raw);

            if (
              !Number.isInteger(target) ||
              target < 0 ||
              target > 10000
            ) {
              alert(
                'Bitte einen Personal-Sollwert ' +
                'zwischen 0 und 10000 eingeben.'
              );

              render();
              return;
            }

            state.target = target;

            queueSave(
              typeId,
              async () => {
                await setTarget(
                  typeId,
                  target
                );

                /*
                 * Nur bei erstmaliger
                 * Konfiguration automatisch
                 * aktivieren.
                 *
                 * Bewusst deaktivierte
                 * Typen bleiben aus.
                 */
                const explicitEnabled =
                  await GM.getValue(
                    enabledKey(typeId),
                    null
                  );

                if (
                  target > 0 &&
                  explicitEnabled === null
                ) {
                  state.enabled = true;

                  await setEnabled(
                    typeId,
                    true
                  );

                  render();
                }
              }
            );

            render();
          }
        );

        /*
         * Gebäudetyp aktivieren/deaktivieren.
         */

        function toggleType() {
          state.enabled = !state.enabled;

          const enabled =
            state.enabled;

          queueSave(
            typeId,
            () => setEnabled(
              typeId,
              enabled
            )
          );

          render();
        }

        toggle.addEventListener(
          'click',
          toggleType
        );

        name.addEventListener(
          'click',
          toggleType
        );

        rows.push({
          buildingType: typeId,
          row,
          input,
          toggle
        });

        row.append(
          input,
          name,
          toggle
        );

        list.append(row);
      }

      content.append(
        toolbar,
        list
      );

      details.append(
        summary,
        content
      );

      root.append(details);

      render();
    }

    body.prepend(root);

    console.log(
      PREFIX,
      VERSION,
      'Einstellungen geladen:',
      BUILDING_TYPES.length,
      'Gebäudetypen'
    );
  }

  /*
   * ==========================================
   * GEBÄUDE NORMALISIEREN
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

      building_type:
        Number(building.building_type),

      leitstelle_building_id:
        dispatchCenterId == null
          ? null
          : Number(dispatchCenterId),

      caption:
        building.caption ||
        building.name ||
        `Gebäude ${building.id}`,

      personal_count_target:
        Number(
          building.personal_count_target ??
          0
        ),

      hiring_automatic:
        building.hiring_automatic === true ||
        building.hiring_automatic === 1 ||
        building.hiring_automatic === '1' ||
        building.hiring_automatic === 'true'
    };
  }

  /*
   * ==========================================
   * KONFIGURIERTE PERSONALZIELE
   * ==========================================
   */

  async function configuredTargets() {
    const targets = new Map();

    for (const building of BUILDING_TYPES) {
      const target = await getTarget(
        building.id
      );

      if (target <= 0) {
        continue;
      }

      if (!await isEnabled(
        building.id,
        target
      )) {
        continue;
      }

      targets.set(
        building.id,
        target
      );
    }

    return targets;
  }

  /*
   * ==========================================
   * GEBÄUDE AUS DER SCRIPTBASIS
   * ==========================================
   */

  async function loadBuildings(
    dispatchCenterId,
    targets
  ) {
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
      await updateBuildings(
        db,
        60
      );

      return (
        await getDataByIndex(
          db,
          'buildings',
          'leitstelle_building_id',
          Number(dispatchCenterId)
        )
      )
        .map(normalizeBuilding)
        .filter(building =>
          targets.has(
            building.building_type
          )
        )
        .sort(
          (a, b) => a.id - b.id
        );

    } finally {
      db.close();
    }
  }

  /*
   * ==========================================
   * CSRF-TOKEN
   * ==========================================
   */

  function csrfToken() {
    return document.querySelector(
      'meta[name="csrf-token"]'
    )?.content ?? '';
  }

  /*
   * ==========================================
   * PERSONAL-SOLL SETZEN
   * ==========================================
   */

  async function setPersonnelTarget(
    buildingId,
    target
  ) {
    const token = csrfToken();

    const body = new URLSearchParams({
      'building[personal_count_target]':
        String(target),

      _method: 'put'
    });

    if (token) {
      body.append(
        'authenticity_token',
        token
      );
    }

    const response = await fetch(
      `/buildings/${buildingId}?personal_count_target_only=1`,
      {
        method: 'POST',
        credentials: 'same-origin',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded; charset=UTF-8',

          'X-CSRF-Token':
            token,

          'X-Requested-With':
            'XMLHttpRequest'
        },

        body
      }
    );

    if (!response.ok) {
      throw new Error(
        `Personal-Soll HTTP ${response.status}`
      );
    }
  }

  /*
   * ==========================================
   * GEBÄUDELISTE LADEN
   * ==========================================
   */

  async function ensureBuildingListLoaded() {
    if (
      document.querySelector(
        '#building_table tbody tr'
      )
    ) {
      return;
    }

    const tabButton = document.querySelector(
      'a[href="#tab_buildings"], ' +
      'a[href$="#tab_buildings"], ' +
      'a[data-target="#tab_buildings"], ' +
      '[aria-controls="tab_buildings"]'
    );

    if (!tabButton) {
      throw new Error(
        'Der Tab mit der Gebäudeliste wurde nicht gefunden.'
      );
    }

    setProgress(
      'Gebäudeliste wird geöffnet ...'
    );

    tabButton.click();

    const timeoutAt =
      Date.now() + 15000;

    while (
      !cancelled &&
      Date.now() < timeoutAt
    ) {
      if (
        document.querySelector(
          '#building_table tbody tr'
        )
      ) {
        return;
      }

      await sleep(100);
    }

    if (cancelled) {
      return;
    }

    throw new Error(
      'Die Gebäudeliste konnte nicht geladen werden.'
    );
  }

  /*
   * ==========================================
   * AUTOMATISCHE PERSONALWERBUNG
   * ==========================================
   */

  function automaticHireUrlFromDocument(
    sourceDocument,
    buildingId
  ) {
    const buildingPath =
      `/buildings/${buildingId}`;

    const links =
      sourceDocument.querySelectorAll(
        'a.btn-hire[duration="automatic"], ' +
        'a.btn-hire[data-duration="automatic"]'
      );

    for (const link of links) {
      const row = link.closest('tr');

      const belongsToBuilding =
        link.getAttribute('href')
          ?.includes(buildingPath) ||

        row?.querySelector(
          `a[href="${buildingPath}"], ` +
          `a[href^="${buildingPath}?"]`
        );

      if (belongsToBuilding) {
        const href =
          link.getAttribute('href');

        if (href) {
          return new URL(
            href,
            location.origin
          ).href;
        }
      }
    }

    return null;
  }

  async function automaticHireUrl(
    buildingId
  ) {
    const fromTable =
      automaticHireUrlFromDocument(
        document,
        buildingId
      );

    if (fromTable) {
      return fromTable;
    }

    const response = await fetch(
      `/buildings/${buildingId}`,
      {
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      throw new Error(
        `Gebäudeseite HTTP ${response.status}`
      );
    }

    const doc =
      new DOMParser().parseFromString(
        await response.text(),
        'text/html'
      );

    const fromBuilding =
      automaticHireUrlFromDocument(
        doc,
        buildingId
      );

    if (!fromBuilding) {
      throw new Error(
        'Automatik-URL wurde nicht gefunden.'
      );
    }

    return fromBuilding;
  }

  async function enableAutomaticHire(
    buildingId
  ) {
    const url = await automaticHireUrl(
      buildingId
    );

    if (cancelled) {
      return;
    }

    const response = await fetch(
      url,
      {
        method: 'GET',
        credentials: 'same-origin',

        headers: {
          'X-Requested-With':
            'XMLHttpRequest'
        },

        redirect: 'follow'
      }
    );

    if (!response.ok) {
      throw new Error(
        `Personalwerbung HTTP ${response.status}`
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
        'nilspe-personnel-progress'
      )
    ) {
      return;
    }

    const style = element('style');

    style.id =
      'nilspe-personnel-progress-style';

    style.textContent = `
      #nilspe-personnel-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-personnel-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-personnel-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-personnel-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;

    document.head.append(style);

    const container = element('div');
    container.id = 'nilspe-personnel-progress';

    const row = element('div');

    row.style.cssText =
      'display:flex;align-items:center;gap:12px';

    const cancel = element(
      'button',
      'btn btn-default btn-xs',
      'Abbrechen'
    );

    cancel.type = 'button';

    cancel.addEventListener(
      'click',
      () => {
        cancelled = true;

        const status =
          document.getElementById(
            'nilspe-personnel-status'
          );

        if (status) {
          status.className =
            'label label-warning';

          status.textContent =
            'Abbruch angefordert';
        }
      }
    );

    const status = element(
      'span',
      'label label-info',
      'Bereit'
    );

    status.id =
      'nilspe-personnel-status';

    const track = element('div');
    track.id = 'nilspe-personnel-track';

    const success = element('div');
    success.id = 'nilspe-personnel-success';

    const errors = element('div');
    errors.id = 'nilspe-personnel-errors';

    track.append(
      success,
      errors
    );

    row.append(
      cancel,
      status
    );

    container.append(
      row,
      track
    );

    document.body.append(
      container
    );
  }

  function setProgress(
    message,
    completed = 0,
    errors = 0,
    total = 0,
    type = 'info'
  ) {
    ensureProgress();

    const status =
      document.getElementById(
        'nilspe-personnel-status'
      );

    const success =
      document.getElementById(
        'nilspe-personnel-success'
      );

    const errorBar =
      document.getElementById(
        'nilspe-personnel-errors'
      );

    const safeTotal = Math.max(
      total,
      1
    );

    status.className =
      `label label-${type}`;

    status.textContent = message;

    success.style.width =
      `${Math.max(0, completed - errors) /
        safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  /*
   * ==========================================
   * EINZELNE WACHE BEARBEITEN
   * ==========================================
   */

  async function processBuilding(
    building,
    target
  ) {
    let changed = 0;

    if (cancelled) {
      return changed;
    }

    /*
     * Personal-Soll nur ändern,
     * wenn es abweicht.
     */

    if (
      building.personal_count_target !== target
    ) {
      await setPersonnelTarget(
        building.id,
        target
      );

      changed++;
    }

    if (cancelled) {
      return changed;
    }

    /*
     * Personalwerbung nur aktivieren,
     * wenn sie noch nicht läuft.
     */

    if (!building.hiring_automatic) {
      await enableAutomaticHire(
        building.id
      );

      if (!cancelled) {
        changed++;
      }
    }

    return changed;
  }

  /*
   * ==========================================
   * HAUPTABLAUF
   * ==========================================
   */

  async function run(button) {
    if (running) {
      return;
    }

    running = true;
    cancelled = false;

    button.disabled = true;

    try {
      const match =
        location.pathname.match(
          /^\/buildings\/(\d+)/
        );

      const dispatchCenterId =
        match ? Number(match[1]) : NaN;

      if (
        !Number.isInteger(
          dispatchCenterId
        )
      ) {
        throw new Error(
          'Leitstellen-ID konnte nicht ermittelt werden.'
        );
      }

      const targets =
        await configuredTargets();

      if (!targets.size) {
        setProgress(
          'Kein aktiver Personal-Sollwert konfiguriert',
          0,
          0,
          0,
          'warning'
        );
        return;
      }

      const requestDelay = Math.max(
        0,
        Number(
          await GM.getValue(
            REQUEST_DELAY_KEY,
            DEFAULT_REQUEST_DELAY
          )
        ) || 0
      );

      await ensureBuildingListLoaded();

      if (cancelled) {
        setProgress(
          'Abgebrochen',
          0,
          0,
          0,
          'warning'
        );
        return;
      }

      setProgress(
        'Gebäude werden aus dem API-Cache geladen ...'
      );

      const buildings =
        await loadBuildings(
          dispatchCenterId,
          targets
        );

      if (cancelled) {
        setProgress(
          'Abgebrochen',
          0,
          0,
          0,
          'warning'
        );
        return;
      }

      if (!buildings.length) {
        setProgress(
          'Keine konfigurierten Gebäude gefunden',
          0,
          0,
          0,
          'success'
        );
        return;
      }

      /*
       * Nur Wachen mit einer nötigen
       * Änderung werden bearbeitet.
       */

      const jobs = buildings.filter(
        building => {
          const target = targets.get(
            building.building_type
          );

          return (
            building.personal_count_target !== target ||
            !building.hiring_automatic
          );
        }
      );

      if (!jobs.length) {
        setProgress(
          'Personal-Soll und Automatik sind bereits korrekt',
          0,
          0,
          0,
          'success'
        );
        return;
      }

      let completed = 0;
      let errors = 0;
      let changes = 0;
      let started = 0;

      /*
       * Bewährte Parallelität:
       * Maximal drei Wachen gleichzeitig.
       */

      await runWithConcurrency(
        jobs,

        async building => {
          if (cancelled) {
            return;
          }

          started++;

          setProgress(
            `${started}/${jobs.length} gestartet: ` +
            `${building.caption}`,
            completed,
            errors,
            jobs.length
          );

          try {
            const buildingChanges =
              await processBuilding(
                building,
                targets.get(
                  building.building_type
                )
              );

            changes += buildingChanges;

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

          setProgress(
            `${completed}/${jobs.length} Gebäude, ` +
            `${changes} Änderungen`,
            completed,
            errors,
            jobs.length,
            errors
              ? 'warning'
              : 'success'
          );
        },

        {
          concurrency: 3,
          delay: requestDelay,
          shouldContinue: () => !cancelled
        }
      );

      if (cancelled) {
        setProgress(
          `Abgebrochen: ${completed} Gebäude bearbeitet`,
          completed,
          errors,
          jobs.length,
          'warning'
        );
        return;
      }

      setProgress(
        `Fertig: ${changes} Änderungen, ` +
        `${errors} Fehler`,
        completed,
        errors,
        jobs.length,
        errors
          ? 'warning'
          : 'success'
      );

      console.log(
        PREFIX,
        'Durchlauf abgeschlossen:',
        {
          buildings: completed,
          changes,
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
        0,
        'danger'
      );

    } finally {
      running = false;
      button.disabled = false;
    }
  }

  /*
   * ==========================================
   * EINSTELLUNGSBUTTON
   * ==========================================
   */

  function settingsButton() {
    const button = element(
      'a',
      'btn btn-default btn-xs'
    );

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target = '_blank';
    button.title = 'Einstellungen';

    const icon = element(
      'span',
      'glyphicon glyphicon-cog'
    );

    button.append(icon);

    return button;
  }

  /*
   * ==========================================
   * BUTTON IN DER LEITSTELLE
   * ==========================================
   */

  function addButtons() {
    const heading =
      document.querySelector(
        'h1[building_type]'
      );

    if (
      Number(
        heading?.getAttribute(
          'building_type'
        )
      ) !== 7 ||
      document.getElementById(
        'nilspe-personnel-buttons'
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

    const term = element('dt');

    const strong = element(
      'strong',
      '',
      'Wachenpersonal:'
    );

    term.append(strong);

    const description = element('dd');

    const group = element(
      'div',
      'btn-group'
    );

    group.id =
      'nilspe-personnel-buttons';

    const start = element(
      'button',
      'btn btn-default btn-xs',
      'Personal setzen'
    );

    start.type = 'button';

    start.addEventListener(
      'click',
      () => {
        void run(start);
      }
    );

    group.append(
      start,
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

    new MutationObserver(
      addButtons
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
