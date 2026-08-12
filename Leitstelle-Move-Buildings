// ==UserScript==
// @name         Leitstelle Move Buildings
// @namespace    NilsPe.move.buildings
// @version      2.0.0
// @description  Verschiebt Wachen einer Leitstelle anhand eines Namensfilters in eine andere Leitstelle
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Move-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Move-Buildings.user.js
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

  // ============================================================
  // Einstellungen
  // ============================================================

  const SETTINGS_IDENTIFIER = 'nilspe_move_buildings';

  const KEYS = {
    targetDispatchCenter: 'nilspe_mb_target_dispatch_center',
    nameFilter: 'nilspe_mb_name_filter',
    concurrency: 'nilspe_mb_concurrency',
    requestDelay: 'nilspe_mb_request_delay',
    dryRun: 'nilspe_mb_dry_run',
    requireConfirm: 'nilspe_mb_require_confirm'
  };

  let running = false;
  let addingButtons = false;

  // ============================================================
  // Einstellungen
  // ============================================================

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Wachenverschieber',

      settings: [
        {
          type: 'header',
          text: 'Verschieben'
        },
        {
          type: 'select',
          key: KEYS.targetDispatchCenter,
          label: 'Ziel-Leitstelle',
          title: 'Ziel-Leitstelle auswählen',
          multiple: false,
          selectType: 'dispatch_centers'
        },
        {
          type: 'text',
          key: KEYS.nameFilter,
          label: 'Namensfilter',
          info: 'Es werden nur Wachen verschoben, deren Name diesen Text enthält.',
          default: ''
        },

        {
          type: 'header',
          text: 'Ablauf'
        },
        {
          type: 'number',
          key: KEYS.concurrency,
          label: 'Parallele Verschiebungen',
          min: 1,
          max: 5,
          default: 3
        },
        {
          type: 'number',
          key: KEYS.requestDelay,
          label: 'Pause zwischen Anfragen [ms]',
          min: 0,
          max: 5000,
          default: 150
        },
        {
          type: 'checkbox',
          key: KEYS.requireConfirm,
          label: 'Vor dem Verschieben Bestätigung anzeigen',
          default: true
        },
        {
          type: 'checkbox',
          key: KEYS.dryRun,
          label: 'Testlauf aktivieren',
          default: false
        }
      ]
    });
  }

  // ============================================================
  // Konfiguration
  // ============================================================

  function parseSelectValue(value, fallback = null) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.length
          ? Number(parsed[0])
          : fallback;
      }

      return Number(parsed);
    } catch {
      const number = Number(value);

      return Number.isFinite(number)
        ? number
        : fallback;
    }
  }

  async function configuration() {
    return {
      targetDispatchCenter:
        parseSelectValue(
          await GM.getValue(
            KEYS.targetDispatchCenter,
            '[]'
          ),
          null
        ),

      nameFilter:
        String(
          await GM.getValue(
            KEYS.nameFilter,
            ''
          )
        ).trim(),

      concurrency:
        Math.max(
          1,
          Math.min(
            5,
            Number(
              await GM.getValue(
                KEYS.concurrency,
                3
              )
            ) || 3
          )
        ),

      requestDelay:
        Math.max(
          0,
          Number(
            await GM.getValue(
              KEYS.requestDelay,
              150
            )
          ) || 0
        ),

      dryRun:
        await GM.getValue(
          KEYS.dryRun,
          false
        ),

      requireConfirm:
        await GM.getValue(
          KEYS.requireConfirm,
          true
        )
    };
  }

  // ============================================================
  // Helper
  // ============================================================

  function normalize(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  function currentDispatchCenterId() {
    return Number(
      location.pathname.match(
        /^\/buildings\/(\d+)/
      )?.[1]
    );
  }

  // ============================================================
  // Gebäude laden
  // ============================================================

  function normalizeBuilding(building) {
    const dispatchCenterId =
      building.leitstelle_building_id ??
      building.dispatch_center_id ??
      building.dispatch_center_building_id ??
      null;

    return {
      ...building,

      id:
        Number(building.id),

      building_type:
        Number(building.building_type),

      leitstelle_building_id:
        dispatchCenterId == null
          ? null
          : Number(dispatchCenterId),

      caption:
        building.caption ||
        building.name ||
        `Gebäude ${building.id}`
    };
  }

  async function loadBuildings(dispatchCenterId) {
    if (
      typeof openDb !== 'function' ||
      typeof updateBuildings !== 'function'
    ) {
      throw new Error(
        'NilsPe-Skriptbasis wurde nicht geladen.'
      );
    }

    const db =
      await openDb();

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
        .sort(
          (a, b) =>
            a.id - b.id
        );

    } finally {
      db.close();
    }
  }

  function filterBuildings(
    buildings,
    nameFilter
  ) {
    const needle =
      normalize(nameFilter);

    if (!needle) {
      return [];
    }

    return buildings.filter(
      building =>
        normalize(
          building.caption
        ).includes(
          needle
        )
    );
  }

  // ============================================================
  // Verschieben
  // ============================================================

  async function moveBuilding(
    buildingId,
    targetDispatchCenterId
  ) {
    const url =
      `/buildings/${buildingId}` +
      `/leitstelle-set/${targetDispatchCenterId}`;

    const response =
      await fetch(
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
        `HTTP ${response.status}`
      );
    }
  }

  // ============================================================
  // Fortschritt
  // ============================================================

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-mb-progress'
      )
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id =
      'nilspe-mb-style';

    style.textContent = `
      #nilspe-mb-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-mb-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #nilspe-mb-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-mb-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-mb-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;

    document.head.append(
      style
    );

    const container =
      document.createElement('div');

    container.id =
      'nilspe-mb-progress';

    const row =
      document.createElement('div');

    row.id =
      'nilspe-mb-row';

    const cancel =
      document.createElement('button');

    cancel.type =
      'button';

    cancel.className =
      'btn btn-default btn-xs';

    cancel.textContent =
      'Abbrechen';

    cancel.addEventListener(
      'click',
      () => {
        running = false;

        setProgress(
          'Abgebrochen',
          0,
          0,
          0,
          'danger'
        );
      }
    );

    const status =
      document.createElement('span');

    status.id =
      'nilspe-mb-status';

    status.className =
      'label label-info';

    status.textContent =
      'Bereit';

    const track =
      document.createElement('div');

    track.id =
      'nilspe-mb-track';

    const success =
      document.createElement('div');

    success.id =
      'nilspe-mb-success';

    const errors =
      document.createElement('div');

    errors.id =
      'nilspe-mb-errors';

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
        'nilspe-mb-status'
      );

    const success =
      document.getElementById(
        'nilspe-mb-success'
      );

    const errorBar =
      document.getElementById(
        'nilspe-mb-errors'
      );

    const safeTotal =
      Math.max(
        total,
        1
      );

    status.className =
      `label label-${type}`;

    status.textContent =
      message;

    success.style.width =
      `${Math.max(
        0,
        completed - errors
      ) / safeTotal * 100}%`;

    errorBar.style.width =
      `${errors / safeTotal * 100}%`;
  }

  // ============================================================
  // Auswahl
  // ============================================================

  async function selection() {
    const config =
      await configuration();

    const sourceDispatchCenter =
      currentDispatchCenterId();

    if (
      !Number.isInteger(
        sourceDispatchCenter
      ) ||
      sourceDispatchCenter <= 0
    ) {
      throw new Error(
        'Quell-Leitstelle konnte nicht ermittelt werden.'
      );
    }

    if (
      !Number.isInteger(
        config.targetDispatchCenter
      ) ||
      config.targetDispatchCenter <= 0
    ) {
      throw new Error(
        'Bitte zuerst eine Ziel-Leitstelle auswählen.'
      );
    }

    if (
      sourceDispatchCenter ===
      config.targetDispatchCenter
    ) {
      throw new Error(
        'Quell- und Ziel-Leitstelle sind identisch.'
      );
    }

    if (
      !config.nameFilter
    ) {
      throw new Error(
        'Bitte zuerst einen Namensfilter eintragen.'
      );
    }

    setProgress(
      'Gebäude werden aus dem API-Cache geladen ...'
    );

    const buildings =
      await loadBuildings(
        sourceDispatchCenter
      );

    const matchingBuildings =
      filterBuildings(
        buildings,
        config.nameFilter
      );

    return {
      config,
      sourceDispatchCenter,
      buildings,
      matchingBuildings
    };
  }

  // ============================================================
  // Lauf
  // ============================================================

  async function runMover(
    buttons
  ) {
    if (running) {
      return;
    }

    try {
      const {
        config,
        matchingBuildings
      } = await selection();

      if (
        !matchingBuildings.length
      ) {
        setProgress(
          `Keine Wachen mit "${config.nameFilter}" gefunden`,
          0,
          0,
          0,
          'success'
        );

        return;
      }

      if (
        config.requireConfirm
      ) {
        const preview =
          matchingBuildings
            .slice(0, 30)
            .map(
              building =>
                `- ${building.caption}`
            )
            .join('\n');

        const more =
          matchingBuildings.length > 30
            ? `\n\n... und ${
                matchingBuildings.length - 30
              } weitere`
            : '';

        const message =
          config.dryRun
            ? `Testlauf:\n\n` +
              `${matchingBuildings.length} Wachen würden verschoben.\n\n` +
              `Filter: "${config.nameFilter}"\n` +
              `Ziel-Leitstelle: ${config.targetDispatchCenter}\n\n` +
              `${preview}${more}`
            : `${matchingBuildings.length} Wachen werden verschoben.\n\n` +
              `Filter: "${config.nameFilter}"\n` +
              `Ziel-Leitstelle: ${config.targetDispatchCenter}\n\n` +
              `${preview}${more}`;

        if (
          !globalThis.confirm(
            message
          )
        ) {
          setProgress(
            'Verschieben nicht gestartet',
            0,
            0,
            0,
            'warning'
          );

          return;
        }
      }

      running = true;

      buttons.forEach(
        button =>
          button.disabled = true
      );

      let completed = 0;
      let errors = 0;
      let moved = 0;

      setProgress(
        config.dryRun
          ? `Testlauf: 0/${matchingBuildings.length}`
          : `0/${matchingBuildings.length} Wachen`,
        0,
        0,
        matchingBuildings.length
      );

      async function worker(
        building
      ) {
        if (!running) {
          return;
        }

        try {
          if (
            !config.dryRun
          ) {
            await moveBuilding(
              building.id,
              config.targetDispatchCenter
            );
          }

          moved++;

        } catch (error) {
          errors++;

          console.error(
            '[Wachenverschieber] Gebäude fehlgeschlagen:',
            building.id,
            building.caption,
            error
          );
        }

        completed++;

        setProgress(
          config.dryRun
            ? `${completed}/${matchingBuildings.length} geprüft`
            : `${completed}/${matchingBuildings.length} bearbeitet, ${moved} verschoben`,
          completed,
          errors,
          matchingBuildings.length,
          errors
            ? 'warning'
            : 'success'
        );
      }

      if (
        typeof runWithConcurrency ===
        'function'
      ) {
        await runWithConcurrency(
          matchingBuildings,
          worker,
          {
            concurrency:
              config.concurrency,

            delay:
              config.requestDelay,

            shouldContinue:
              () => running
          }
        );

      } else {
        for (
          const building of matchingBuildings
        ) {
          if (!running) {
            break;
          }

          await worker(
            building
          );
        }
      }

      if (!running) {
        return;
      }

      setProgress(
        config.dryRun
          ? `Testlauf fertig: ${moved} Wachen geprüft`
          : `Fertig: ${moved} verschoben, ${errors} Fehler`,
        completed,
        errors,
        matchingBuildings.length,
        errors
          ? 'warning'
          : 'success'
      );

    } catch (error) {
      console.error(
        '[Wachenverschieber] Lauf fehlgeschlagen:',
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

      buttons.forEach(
        button =>
          button.disabled = false
      );
    }
  }

  // ============================================================
  // Settings Button
  // ============================================================

  function settingsButton() {
    const button =
      document.createElement('a');

    button.className =
      'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target =
      '_blank';

    button.title =
      'Einstellungen';

    const icon =
      document.createElement('span');

    icon.className =
      'glyphicon glyphicon-cog';

    button.append(
      icon
    );

    return button;
  }

  // ============================================================
  // UI
  // ============================================================

  function buildingTable() {
    return (
      document.getElementById(
        'building_table'
      ) ??
      document.querySelector(
        '#tab_buildings table'
      )
    );
  }

  async function addButtons() {
    if (
      addingButtons ||
      document.getElementById(
        'nilspe-mb-button-row'
      ) ||
      document.getElementById(
        'nilspe-mb-buttons'
      )
    ) {
      return;
    }

    const heading =
      document.querySelector(
        'h1[building_type]'
      );

    if (
      Number(
        heading?.getAttribute(
          'building_type'
        )
      ) !== 7
    ) {
      return;
    }

    const table =
      buildingTable();

    if (!table) {
      return;
    }

    addingButtons = true;

    try {
      if (
        document.getElementById(
          'nilspe-mb-button-row'
        )
      ) {
        return;
      }

      const group =
        document.createElement('div');

      group.id =
        'nilspe-mb-buttons';

      group.className =
        'btn-group';

      const moveButton =
        document.createElement(
          'button'
        );

      moveButton.type =
        'button';

      moveButton.className =
        'btn btn-default btn-xs';

      moveButton.textContent =
        'Wachen verschieben';

      const buttons = [
        moveButton
      ];

      moveButton.addEventListener(
        'click',
        () =>
          runMover(buttons)
      );

      group.append(
        moveButton,
        settingsButton()
      );

      const row =
        document.createElement(
          'div'
        );

      row.id =
        'nilspe-mb-button-row';

      row.style.display =
        'block';

      row.style.width =
        '100%';

      row.style.margin =
        '0';

      row.append(
        group
      );

      table.parentElement
        ?.insertBefore(
          row,
          table
        );

    } finally {
      addingButtons = false;
    }
  }

  // ============================================================
  // Start
  // ============================================================

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();

  } else {
    void addButtons();

    new MutationObserver(
      () => {
        void addButtons();
      }
    ).observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

})();