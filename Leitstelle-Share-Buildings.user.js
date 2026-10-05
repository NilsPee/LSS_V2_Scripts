// ==UserScript==
// @name         Leitstelle Share Buildings
// @namespace    NilsPe.share.buildings
// @version      2.0.2
// @description  Gibt Krankenhausbetten und Polizeizellen im Verband frei und setzt die Gebuehren
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Share-Buildings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Share-Buildings.user.js
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

  const SETTINGS_IDENTIFIER = 'nilspe_share_buildings';

  const KEYS = {
    processHospitals: 'nilspe_sb_process_hospitals',
    processCells: 'nilspe_sb_process_cells',

    hospitalPercent: 'nilspe_sb_hospital_percent',
    cellPercent: 'nilspe_sb_cell_percent',

    showUnshareButton: 'nilspe_sb_show_unshare_button',

    concurrency: 'nilspe_sb_concurrency',
    requestDelay: 'nilspe_sb_request_delay'
  };

  const FEE_OPTIONS = [
    { value: 0, name: '0 %' },
    { value: 10, name: '10 %' },
    { value: 20, name: '20 %' },
    { value: 30, name: '30 %' },
    { value: 40, name: '40 %' },
    { value: 50, name: '50 %' }
  ];

  let running = false;

  /*
   * Verhindert, dass der MutationObserver addButtons()
   * mehrfach gleichzeitig startet, waehrend noch auf die
   * Einstellungen gewartet wird.
   */
  let addingButtons = false;

  // ============================================================
  // Einstellungen erstellen
  // ============================================================

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Share Buildings',

      settings: [
        {
          type: 'header',
          text: 'Gebaeude'
        },
        {
          type: 'checkbox',
          key: KEYS.processHospitals,
          label: 'Krankenhausbetten freigeben',
          default: true
        },
        {
          type: 'checkbox',
          key: KEYS.processCells,
          label: 'Polizeizellen freigeben',
          default: true
        },

        {
          type: 'header',
          text: 'Gebuehren'
        },
        {
          type: 'select',
          key: KEYS.hospitalPercent,
          label: 'Krankenhausgebuehr',
          title: 'Gebuehr auswaehlen',
          multiple: false,
          options: FEE_OPTIONS
        },
        {
          type: 'select',
          key: KEYS.cellPercent,
          label: 'Zellengebuehr',
          title: 'Gebuehr auswaehlen',
          multiple: false,
          options: FEE_OPTIONS
        },

        {
          type: 'header',
          text: 'Bedienung'
        },
        {
          type: 'checkbox',
          key: KEYS.showUnshareButton,
          label: 'Button zum Zuruecknehmen der Freigaben einblenden',
          default: false
        },

        {
          type: 'header',
          text: 'Ablauf'
        },
        {
          type: 'number',
          key: KEYS.concurrency,
          label: 'Parallele Gebaeude',
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
          default: 100
        }
      ]
    });
  }

  // ============================================================
  // Konfiguration laden
  // ============================================================

  function parseSelectValue(value, fallback) {
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
      processHospitals:
        await GM.getValue(
          KEYS.processHospitals,
          true
        ),

      processCells:
        await GM.getValue(
          KEYS.processCells,
          true
        ),

      hospitalPercent:
        parseSelectValue(
          await GM.getValue(
            KEYS.hospitalPercent,
            JSON.stringify([10])
          ),
          10
        ),

      cellPercent:
        parseSelectValue(
          await GM.getValue(
            KEYS.cellPercent,
            JSON.stringify([10])
          ),
          10
        ),

      showUnshareButton:
        await GM.getValue(
          KEYS.showUnshareButton,
          false
        ),

      concurrency: Math.max(
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

      requestDelay: Math.max(
        0,
        Number(
          await GM.getValue(
            KEYS.requestDelay,
            100
          )
        ) || 0
      )
    };
  }

  // ============================================================
  // Helper
  // ============================================================

  function norm(value) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function pctToStep(percent) {
    const value = Number(percent);

    if (
      ![
        0,
        10,
        20,
        30,
        40,
        50
      ].includes(value)
    ) {
      throw new Error(
        `Ungueltiger Prozentwert: ${value}`
      );
    }

    return Math.floor(value / 10);
  }

  function isBlockHeaderRow(row) {
    const button =
      row.querySelector('a.btn');

    if (!button) {
      return false;
    }

    const text =
      norm(button.textContent);

    return (
      text.includes('im verband freigeben') ||
      text.includes(
        'nicht im verband freigeben'
      )
    );
  }

  function rowType(row) {
    const button =
      row.querySelector('a.btn');

    const buttonText =
      norm(button?.textContent);

    const text =
      norm(row.innerText);

    if (
      buttonText.includes('zellen') ||
      text.includes('zellen')
    ) {
      return 'cells';
    }

    if (
      buttonText.includes('krankenhaus') ||
      text.includes('betten')
    ) {
      return 'hospital';
    }

    return 'unknown';
  }

  function findShareButton(row) {
    return Array
      .from(
        row.querySelectorAll('a.btn')
      )
      .find(button =>
        button.classList.contains(
          'btn-success'
        ) &&
        norm(
          button.textContent
        ).includes(
          'im verband freigeben'
        )
      ) ?? null;
  }

  function findUnshareButton(row) {
    return Array
      .from(
        row.querySelectorAll('a.btn')
      )
      .find(button =>
        norm(
          button.textContent
        ).includes(
          'nicht im verband freigeben'
        )
      ) ?? null;
  }

  function getBuildingIdFromBlock(
    headerRow
  ) {
    const share =
      headerRow.querySelector(
        'a.btn[href*="/buildings/"]'
      );

    let match =
      share?.href?.match(
        /\/buildings\/(\d+)\b/
      );

    if (match) {
      return Number(match[1]);
    }

    let current = headerRow;

    while (current) {
      const link =
        current.querySelector(
          'a[href*="/buildings/"]'
        );

      match =
        link?.href?.match(
          /\/buildings\/(\d+)\b/
        );

      if (match) {
        return Number(match[1]);
      }

      current =
        current.nextElementSibling;

      if (
        current &&
        isBlockHeaderRow(current)
      ) {
        break;
      }
    }

    return null;
  }

  function findCostLinkNearbyFromHeader(
    headerRow,
    step
  ) {
    function linkIn(row) {
      return Array
        .from(
          row.querySelectorAll(
            'a[href*="/alliance_costs/"]'
          )
        )
        .find(link => {
          const match =
            link.href.match(
              /\/alliance_costs\/(\d+)\b/
            );

          return Number(
            match?.[1]
          ) === step;
        }) ?? null;
    }

    let link =
      linkIn(headerRow);

    if (link) {
      return link;
    }

    let current =
      headerRow.nextElementSibling;

    while (
      current &&
      !isBlockHeaderRow(current)
    ) {
      link =
        linkIn(current);

      if (link) {
        return link;
      }

      current =
        current.nextElementSibling;
    }

    return null;
  }

  // ============================================================
  // Requests
  // ============================================================

  async function fireLinkGET(
    urlOrElement
  ) {
    const href =
      typeof urlOrElement === 'string'
        ? urlOrElement
        : urlOrElement?.href;

    if (!href) {
      throw new Error(
        'Keine URL fuer Anfrage gefunden.'
      );
    }

    const response =
      await fetch(
        href,
        {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With':
              'XMLHttpRequest'
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return true;
  }

  // ============================================================
  // Ziele sammeln
  // ============================================================

  function extensionTable() {
    return document.querySelector(
      '#tab_extensions table'
    );
  }

  function collectTargets(config) {
    const table =
      extensionTable();

    if (!table) {
      throw new Error(
        'Erweiterungs-Tabelle wurde nicht gefunden.'
      );
    }

    const rows =
      Array
        .from(
          table.querySelectorAll('tr')
        )
        .filter(row =>
          row.querySelector('td')
        );

    const headers =
      rows.filter(
        isBlockHeaderRow
      );

    return headers
      .map(row => ({
        row,
        type: rowType(row),
        id:
          getBuildingIdFromBlock(row)
      }))
      .filter(target =>
        target.id &&
        (
          (
            target.type === 'hospital' &&
            config.processHospitals
          ) ||
          (
            target.type === 'cells' &&
            config.processCells
          )
        )
      );
  }

  // ============================================================
  // Fortschritt
  // ============================================================

  function ensureProgress() {
    if (
      document.getElementById(
        'nilspe-sb-progress'
      )
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id =
      'nilspe-sb-style';

    style.textContent = `
      #nilspe-sb-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-sb-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #nilspe-sb-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-sb-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }

      #nilspe-sb-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;

    document.head.append(style);

    const container =
      document.createElement('div');

    container.id =
      'nilspe-sb-progress';

    const row =
      document.createElement('div');

    row.id =
      'nilspe-sb-row';

    const cancel =
      document.createElement('button');

    cancel.type = 'button';

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
      'nilspe-sb-status';

    status.className =
      'label label-info';

    status.textContent =
      'Bereit';

    const track =
      document.createElement('div');

    track.id =
      'nilspe-sb-track';

    const success =
      document.createElement('div');

    success.id =
      'nilspe-sb-success';

    const errors =
      document.createElement('div');

    errors.id =
      'nilspe-sb-errors';

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
        'nilspe-sb-status'
      );

    const success =
      document.getElementById(
        'nilspe-sb-success'
      );

    const errorBar =
      document.getElementById(
        'nilspe-sb-errors'
      );

    const safeTotal =
      Math.max(total, 1);

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
  // Freigeben
  // ============================================================

  async function shareTarget(
    target,
    config
  ) {
    const percent =
      target.type === 'hospital'
        ? config.hospitalPercent
        : config.cellPercent;

    const step =
      pctToStep(percent);

    const shareButton =
      findShareButton(
        target.row
      );

    if (shareButton) {
      await fireLinkGET(
        shareButton
      );
    }

    const feeLink =
      findCostLinkNearbyFromHeader(
        target.row,
        step
      );

    await fireLinkGET(
      feeLink ??
      `/buildings/${target.id}/alliance_costs/${step}`
    );
  }

  async function runSharing(
    buttons
  ) {
    if (running) {
      return;
    }

    try {
      const config =
        await configuration();

      const targets =
        collectTargets(config);

      if (!targets.length) {
        setProgress(
          'Keine passenden Gebaeude gefunden',
          0,
          0,
          0,
          'success'
        );

        return;
      }

      running = true;

      buttons.forEach(
        button =>
          button.disabled = true
      );

      let completed = 0;
      let errors = 0;

      setProgress(
        `0/${targets.length} Gebaeude`,
        0,
        0,
        targets.length
      );

      async function worker(
        target
      ) {
        if (!running) {
          return;
        }

        try {
          await shareTarget(
            target,
            config
          );
        } catch (error) {
          errors++;

          console.error(
            '[Share Buildings] Gebaeude fehlgeschlagen:',
            target.id,
            error
          );
        }

        completed++;

        setProgress(
          `${completed}/${targets.length} Gebaeude bearbeitet`,
          completed,
          errors,
          targets.length,
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
          targets,
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
          const target of targets
        ) {
          if (!running) {
            break;
          }

          await worker(target);

          if (
            config.requestDelay > 0
          ) {
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  config.requestDelay
                )
            );
          }
        }
      }

      if (!running) {
        return;
      }

      setProgress(
        `Fertig: ${completed - errors} erfolgreich, ${errors} Fehler`,
        completed,
        errors,
        targets.length,
        errors
          ? 'warning'
          : 'success'
      );

    } catch (error) {
      console.error(
        '[Share Buildings] Lauf fehlgeschlagen:',
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
  // Freigaben zuruecknehmen
  // ============================================================

  async function runUnsharing(
    buttons
  ) {
    if (running) {
      return;
    }

    try {
      const config =
        await configuration();

      const targets =
        collectTargets(config)
          .filter(target =>
            findUnshareButton(
              target.row
            )
          );

      if (!targets.length) {
        setProgress(
          'Keine freigegebenen Gebaeude gefunden',
          0,
          0,
          0,
          'success'
        );

        return;
      }

      running = true;

      buttons.forEach(
        button =>
          button.disabled = true
      );

      let completed = 0;
      let errors = 0;

      setProgress(
        `0/${targets.length} Freigaben`,
        0,
        0,
        targets.length
      );

      async function worker(
        target
      ) {
        if (!running) {
          return;
        }

        try {
          const button =
            findUnshareButton(
              target.row
            );

          if (!button) {
            return;
          }

          await fireLinkGET(
            button
          );

        } catch (error) {
          errors++;

          console.error(
            '[Share Buildings] Freigabe konnte nicht zurueckgenommen werden:',
            target.id,
            error
          );
        }

        completed++;

        setProgress(
          `${completed}/${targets.length} Freigaben zurueckgenommen`,
          completed,
          errors,
          targets.length,
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
          targets,
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
          const target of targets
        ) {
          if (!running) {
            break;
          }

          await worker(target);

          if (
            config.requestDelay > 0
          ) {
            await new Promise(
              resolve =>
                setTimeout(
                  resolve,
                  config.requestDelay
                )
            );
          }
        }
      }

      if (!running) {
        return;
      }

      setProgress(
        `Fertig: ${completed - errors} zurueckgenommen, ${errors} Fehler`,
        completed,
        errors,
        targets.length,
        errors
          ? 'warning'
          : 'success'
      );

    } catch (error) {
      console.error(
        '[Share Buildings] Zuruecknehmen fehlgeschlagen:',
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

    button.append(icon);

    return button;
  }

  // ============================================================
  // UI
  // ============================================================

  async function addButtons() {
    if (
      addingButtons ||
      document.getElementById(
        'nilspe-sb-button-row'
      ) ||
      document.getElementById(
        'nilspe-sb-buttons'
      )
    ) {
      return;
    }

    const table =
      extensionTable();

    if (!table) {
      return;
    }

    addingButtons = true;

    try {
      /*
       * Nach dem await noch einmal pruefen.
       * Falls zwischenzeitlich bereits eine andere Instanz
       * die Buttonleiste erstellt hat, brechen wir ab.
       */
      const config =
        await configuration();

      if (
        document.getElementById(
          'nilspe-sb-button-row'
        ) ||
        document.getElementById(
          'nilspe-sb-buttons'
        )
      ) {
        return;
      }

      const group =
        document.createElement('div');

      group.id =
        'nilspe-sb-buttons';

      group.className =
        'btn-group';

      // ----------------------------------------------------------
      // Freigeben
      // ----------------------------------------------------------

      const shareButton =
        document.createElement(
          'button'
        );

      shareButton.type =
        'button';

      shareButton.className =
        'btn btn-default btn-xs';

      shareButton.style.backgroundColor =
        '#222';

      shareButton.style.borderColor =
        '#222';

      shareButton.style.color =
        '#fff';

      shareButton.textContent =
        'Gebaeude freigeben';

      const buttons = [
        shareButton
      ];

      // ----------------------------------------------------------
      // Freigaben zuruecknehmen
      // ----------------------------------------------------------

      let unshareButton =
        null;

      if (
        config.showUnshareButton
      ) {
        unshareButton =
          document.createElement(
            'button'
          );

        unshareButton.type =
          'button';

        unshareButton.className =
          'btn btn-danger btn-xs';

        unshareButton.textContent =
          'Freigaben zuruecknehmen';

        buttons.push(
          unshareButton
        );
      }

      shareButton.addEventListener(
        'click',
        () =>
          runSharing(buttons)
      );

      if (unshareButton) {
        unshareButton.addEventListener(
          'click',
          () =>
            runUnsharing(buttons)
        );
      }

      group.append(
        shareButton
      );

      if (unshareButton) {
        group.append(
          unshareButton
        );
      }

      group.append(
        settingsButton()
      );

      const row =
        document.createElement(
          'div'
        );

      row.id =
        'nilspe-sb-button-row';

      /*
       * Wie bei Delete Buildings / Rename Buildings:
       * keine grosse zusaetzliche Luecke zur Tabelle.
       */
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