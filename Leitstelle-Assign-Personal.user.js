
// ==UserScript==
// @name         Leitstelle Assign Personal
// @namespace    NilsPe.assign.personal
// @version      2.2.0
// @description  Gleicht Fahrzeugbesatzungen in zwei Phasen an, Sollwert 0 entfernt sämtliches zugewiesenes Personal
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Personal.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Assign-Personal.user.js
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

  const PREFIX = '[Leitstelle Assign Personal]';

  const SETTINGS_IDENTIFIER = 'nilspe_assign_personal';
  const TARGET_PREFIX = 'nilspe_assign_personal_target_';

  // Neu: Unterscheidung zwischen leerem Feld und Sollwert 0.
  // Bisher gespeicherte Zielwerte bleiben erhalten.
  const ZERO_PREFIX = 'nilspe_assign_personal_explicit_zero_';

  const KEYS = {
    personDelay: 'nilspe_assign_personal_person_delay',
    vehicleDelay: 'nilspe_assign_personal_vehicle_delay',
    skipSatisfied: 'nilspe_assign_personal_skip_satisfied'
  };

  const VEHICLE_GROUPS = [
    {
      name: 'Feuerwehr',
      vehicles: [
        [53, 'Dekon-P'], [2, 'DLK 23'], [34, 'ELW 2'],
        [57, 'FwK'], [121, 'GTLF'], [5, 'GW-A'],
        [27, 'GW-Gefahrgut'], [33, 'GW-Hoehenrettung'],
        [104, 'GW-L1'], [105, 'GW-L2'],
        [114, 'GW-Luefter'], [12, 'GW-Messtechnik'],
        [138, 'GW-Verpflegung'], [139, 'GW-Kueche'],
        [30, 'HLF 20'], [111, 'NEA50 (FW)'],
        [113, 'NEA200 (FW)'], [14, 'SW 2000']
      ]
    },
    {
      name: 'Rettungsdienst',
      vehicles: [
        [55, 'KdoW-LNA'], [56, 'KdoW-OrgL'],
        [38, 'KTW'], [29, 'NEF'],
        [74, 'NAW'], [28, 'RTW']
      ]
    },
    {
      name: 'SEG',
      vehicles: [
        [174, 'Anh TeSi'], [133, 'Bt LKW'],
        [131, 'Bt-Kombi'], [59, 'ELW 1 (SEG)'],
        [132, 'FKH'], [130, 'GW-Bt'],
        [171, 'GW TeSi'], [127, 'GW UAS'],
        [173, 'MTW TeSi'], [175, 'NEA 50']
      ]
    },
    {
      name: 'Rettungshubschrauber',
      vehicles: [[31, 'Rettungshubschrauber']]
    },
    {
      name: 'Rettungshundestaffel',
      vehicles: [[91, 'Rettungshundefahrzeug']]
    },
    {
      name: 'Wasserrettung',
      vehicles: [
        [63, 'GW-Taucher'],
        [64, 'GW-Wasserrettung'],
        [70, 'MZB']
      ]
    },
    {
      name: 'Polizei',
      vehicles: [
        [94, 'DhuFueKw'], [32, 'FuStW'],
        [103, 'FuStW (DGL)'], [52, 'GefKw'],
        [95, 'Polizeimotorrad'],
        [98, 'Zivilstreifenwagen']
      ]
    },
    {
      name: 'Bereitschaftspolizei',
      vehicles: [
        [50, 'GruKw'], [51, 'FueKw'],
        [165, 'LauKW'], [35, 'leBefKw'],
        [72, 'WaWe 10']
      ]
    },
    {
      name: 'Polizeihubschrauber',
      vehicles: [[61, 'Polizeihubschrauber']]
    },
    {
      name: 'THW',
      vehicles: [
        [102, 'Anh 7'], [44, 'Anh DLE'],
        [146, 'Anh FueLa'], [66, 'Anh MzB'],
        [101, 'Anh SwPu'], [43, 'BrmG R'],
        [147, 'FmKW'], [39, 'GKW'],
        [100, 'MLW 4'], [45, 'MLW 5'],
        [40, 'MTW-TZ'], [41, 'MzGW (FGr N)'],
        [109, 'MzGW SB'], [110, 'NEA50 (THW)'],
        [112, 'NEA200 (THW)'],
        [122, 'LKW 7 Lbw (FGr E)'],
        [123, 'LKW 7 Lbw (FGr WP)'],
        [42, 'LKW K 9'], [172, 'LKW Technik'],
        [144, 'FueKW (THW)'],
        [145, 'FueKomKW']
      ]
    }
  ];

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

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;
  let cancelled = false;

  /*
   * =====================================================
   * ZIELWERTE LADEN UND SPEICHERN
   * =====================================================
   *
   * null = Fahrzeugtyp ignorieren
   * 0    = Sämtliches Personal entfernen
   * > 0  = Personal auf Sollwert bringen
   *
   * Alte gespeicherte 0-Werte bleiben unkonfiguriert,
   * sofern keine explizite Null-Markierung existiert.
   */

  async function getTarget(vehicleType) {
    const value = Number(
      await GM.getValue(`${TARGET_PREFIX}${vehicleType}`, 0)
    );

    if (value > 0 && Number.isFinite(value)) {
      return value;
    }

    const explicitZero = await GM.getValue(
      `${ZERO_PREFIX}${vehicleType}`,
      false
    );

    return explicitZero === true ? 0 : null;
  }

  async function setTarget(vehicleType, rawValue) {
    const text = String(rawValue ?? '').trim();

    if (text === '') {
      await GM.setValue(`${TARGET_PREFIX}${vehicleType}`, 0);
      await GM.setValue(`${ZERO_PREFIX}${vehicleType}`, false);
      return null;
    }

    const parsed = Number(text);

    if (!Number.isFinite(parsed)) {
      throw new Error('Ungültiger Sollwert');
    }

    const target = Math.max(
      0,
      Math.min(50, Math.trunc(parsed))
    );

    if (target === 0) {
      await GM.setValue(`${TARGET_PREFIX}${vehicleType}`, 0);
      await GM.setValue(`${ZERO_PREFIX}${vehicleType}`, true);
      return 0;
    }

    await GM.setValue(`${TARGET_PREFIX}${vehicleType}`, target);
    await GM.setValue(`${ZERO_PREFIX}${vehicleType}`, false);

    return target;
  }

  /*
   * EINSTELLUNGEN
   */

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Assign Personal',
      settings: [
        { type: 'header', text: 'Ablauf' },
        {
          type: 'number',
          key: KEYS.personDelay,
          label: 'Pause nach einer Person [ms]',
          min: 0,
          max: 5000,
          default: 100
        },
        {
          type: 'number',
          key: KEYS.vehicleDelay,
          label: 'Pause nach einem Fahrzeug [ms]',
          min: 0,
          max: 5000,
          default: 100
        },
        {
          type: 'checkbox',
          key: KEYS.skipSatisfied,
          label: 'Fahrzeuge mit exakt erreichter Zielbesatzung ueberspringen',
          default: true
        }
      ]
    });

    const panel = document.getElementById(SETTINGS_IDENTIFIER);
    const body = panel?.querySelector('.settings-tab-body');

    if (!body || document.getElementById('nilspe-assign-targets')) {
      return;
    }

    const section = document.createElement('section');
    section.id = 'nilspe-assign-targets';
    section.style.marginBottom = '24px';

    const heading = document.createElement('h2');
    heading.textContent = 'Ziel-Besatzung je Fahrzeugtyp';
    section.append(heading);

    const info = document.createElement('p');
    info.textContent =
      'Leer = Fahrzeugtyp ignorieren | ' +
      '0 = sämtliches Personal entfernen | ' +
      '1–50 = gewünschte Besatzung';

    info.style.fontSize = '12px';
    info.style.marginBottom = '12px';

    section.append(info);

    for (const group of VEHICLE_GROUPS) {
      const wrapper = document.createElement('div');
      wrapper.style.padding = '8px 0 12px';
      wrapper.style.borderBottom = '1px solid #777';

      const title = document.createElement('strong');
      title.textContent = group.name;
      title.style.display = 'block';
      title.style.marginBottom = '8px';

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.gap = '10px 14px';

      wrapper.append(title, row);

      for (const [vehicleType, labelText] of group.vehicles) {
        const field = document.createElement('label');
        field.style.display = 'block';
        field.style.width = '115px';
        field.style.margin = '0';

        const label = document.createElement('span');
        label.textContent = labelText;
        label.style.display = 'block';
        label.style.minHeight = '34px';

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '50';
        input.step = '1';
        input.className = 'form-control input-sm';
        input.style.width = '80px';

        const savedTarget = await getTarget(vehicleType);

        input.value = savedTarget === null
          ? ''
          : String(savedTarget);

        input.title =
          'Leer: ignorieren | 0: alle entfernen | ' +
          '1–50: Sollbesatzung';

        input.addEventListener('change', async () => {
          try {
            const target = await setTarget(
              vehicleType,
              input.value
            );

            input.value = target === null
              ? ''
              : String(target);
          } catch (error) {
            console.error(
              PREFIX,
              'Sollwert konnte nicht gespeichert werden:',
              vehicleType,
              error
            );
          }
        });

        field.append(label, input);
        row.append(field);
      }

      section.append(wrapper);
    }

    body.prepend(section);
  }

  /*
   * FORTSCHRITTSANZEIGE
   */

  function ensureProgress() {
    if (document.getElementById('nilspe-assign-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-assign-style';

    style.textContent = `
      #nilspe-assign-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }

      #nilspe-assign-track {
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }

      #nilspe-assign-fill {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
    `;

    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-assign-progress';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-default btn-xs';
    cancel.textContent = 'Abbrechen';

    cancel.addEventListener('click', () => {
      cancelled = true;
      setProgress('Abbruch angefordert', 0, 0, 'danger');
    });

    const status = document.createElement('span');
    status.id = 'nilspe-assign-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';

    const track = document.createElement('div');
    track.id = 'nilspe-assign-track';

    const fill = document.createElement('div');
    fill.id = 'nilspe-assign-fill';

    track.append(fill);
    row.append(cancel, status);
    container.append(row, track);
    document.body.append(container);
  }

  function setProgress(message, completed, total, type = 'info') {
    ensureProgress();

    const status = document.getElementById('nilspe-assign-status');
    const fill = document.getElementById('nilspe-assign-fill');

    status.className = `label label-${type}`;
    status.textContent = message;

    fill.style.width = total > 0
      ? `${completed / total * 100}%`
      : '0%';
  }

  /*
   * FAHRZEUGE ERMITTELN
   */

  function vehicleRows() {
    const table = document.getElementById('vehicle_table');
    return Array.from(table?.tBodies?.[0]?.rows ?? []);
  }

  function rowVehicleId(row) {
    const link = Array.from(
      row.querySelectorAll('a[href*="/vehicles/"]')
    ).find(element =>
      /\/vehicles\/\d+/.test(
        element.getAttribute('href') ?? ''
      )
    );

    return Number(
      link?.getAttribute('href')
        ?.match(/\/vehicles\/(\d+)/)?.[1]
    );
  }

  function rowVehicleType(row) {
    const element = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );

    const value =
      element?.getAttribute('vehicle_type_id') ??
      element?.getAttribute('data-vehicle-type-id');

    return value == null ? NaN : Number(value);
  }

  function rowCrew(row) {
    const matches = [
      ...(row.textContent ?? '').matchAll(
        /(\d+)\s*\/\s*(\d+)/g
      )
    ];

    const match = matches.at(-1);

    return match
      ? {
          current: Number(match[1]),
          maximum: Number(match[2])
        }
      : null;
  }

  async function loadConfiguration(rows) {
    const types = [
      ...new Set(
        rows.map(rowVehicleType).filter(Number.isInteger)
      )
    ];

    const targets = new Map();

    for (const type of types) {
      targets.set(type, await getTarget(type));
    }

    return {
      targets,

      personDelay: Math.max(
        0,
        Number(await GM.getValue(KEYS.personDelay, 100))
      ),

      vehicleDelay: Math.max(
        0,
        Number(await GM.getValue(KEYS.vehicleDelay, 100))
      ),

      skipSatisfied:
        await GM.getValue(KEYS.skipSatisfied, true) !== false
    };
  }

  /*
   * PERSONALZUWEISUNGEN LADEN
   */

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

  function personnelRows(documentFromResponse, qualification) {
    const rows = Array.from(
      documentFromResponse.querySelectorAll('tr')
    );

    const assigned = rows.filter(row =>
      row.querySelector('a.btn-assigned') &&
      rowMatchesQualification(row, qualification)
    );

    const available = rows.filter(row => {
      const button = row.querySelector('a.btn-success');
      const course =
        row.children?.[2]?.textContent.trim() ?? '';

      return (
        button &&
        rowMatchesQualification(row, qualification) &&
        !course.startsWith('Im Unterricht')
      );
    });

    return { assigned, available };
  }

  /*
   * Alle zugewiesenen Personen unabhängig von ihrer
   * Ausbildung erfassen.
   *
   * Wird bei einem Sollwert von 0 verwendet.
   */

  function allAssignedPersonnel(documentFromResponse) {
    return Array.from(
      documentFromResponse.querySelectorAll('tr')
    ).filter(row =>
      row.querySelector('a.btn-assigned')
    );
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

  async function postPersonnelLink(link) {
    if (!link?.href) {
      throw new Error('Personal-Link fehlt');
    }

    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(link.href, {
          method: 'POST',
          credentials: 'same-origin',
          headers: requestHeaders()
        });

        if (response.ok) {
          return;
        }

        lastError = new Error(
          `HTTP ${response.status}`
        );

        await sleep(
          response.status === 429 ? 1000 : 250
        );

      } catch (error) {
        lastError = error;
        await sleep(250);
      }
    }

    throw lastError ??
      new Error('Personalanfrage fehlgeschlagen');
  }

  /*
   * =====================================================
   * ZWEI-PHASEN-VERARBEITUNG
   * =====================================================
   *
   * Phase 1:
   * - Überbesetzungen reduzieren
   * - Fahrzeuge mit Sollwert 0 vollständig leeren
   *
   * Phase 2:
   * - Unterbesetzungen auffüllen
   *
   * Bei Sollwert 0 werden alle zugewiesenen Personen
   * unabhängig von ihrer Ausbildung entfernt.
   */

  async function adjustVehicle(job, configuration, phase) {
    const documentFromResponse =
      await assignmentDocument(job.vehicleId);

    const qualification =
      QUALIFICATION_BY_VEHICLE_TYPE.get(
        job.vehicleType
      );

    const personnel = personnelRows(
      documentFromResponse,
      qualification
    );

    const assigned = job.target === 0
      ? allAssignedPersonnel(documentFromResponse)
      : personnel.assigned;

    const available = personnel.available;

    let assignedCount = assigned.length;

    if (cancelled || phase === 'check') {
      return assignedCount;
    }

    if (
      configuration.skipSatisfied &&
      assignedCount === job.target
    ) {
      return assignedCount;
    }

    /*
     * PHASE 1 – PERSONAL ENTFERNEN
     */

    if (phase === 'remove') {
      if (assignedCount <= job.target) {
        return assignedCount;
      }

      for (const row of [...assigned].reverse()) {
        if (
          cancelled ||
          assignedCount <= job.target
        ) {
          break;
        }

        const link =
          row.querySelector('a.btn-assigned');

        if (!link) continue;

        await postPersonnelLink(link);

        assignedCount--;

        console.log(
          PREFIX,
          'Personal entfernt:',
          job.vehicleId,
          `${assignedCount}/${job.target}`
        );

        await sleep(configuration.personDelay);
      }

      return assignedCount;
    }

    /*
     * PHASE 2 – PERSONAL ZUWEISEN
     */

    if (phase === 'assign') {
      // Fahrzeuge mit Sollwert 0 bleiben leer.
      if (job.target === 0) {
        return assignedCount;
      }

      if (assignedCount >= job.target) {
        return assignedCount;
      }

      for (const row of available) {
        if (
          cancelled ||
          assignedCount >= job.target
        ) {
          break;
        }

        const link =
          row.querySelector('a.btn-success');

        if (!link) continue;

        await postPersonnelLink(link);

        assignedCount++;

        console.log(
          PREFIX,
          'Personal zugewiesen:',
          job.vehicleId,
          `${assignedCount}/${job.target}`
        );

        await sleep(configuration.personDelay);
      }

      return assignedCount;
    }

    return assignedCount;
  }

  /*
   * HAUPTABLAUF
   */

  async function runAssignment(checkOnly = false) {
    if (running) {
      return;
    }

    running = true;
    cancelled = false;

    const buttons = [
      'nilspe-assign-button',
      'nilspe-personal-check-button'
    ].map(id => document.getElementById(id));

    buttons.forEach(button => {
      if (button) button.disabled = true;
    });

    try {
      const rows = vehicleRows();
      const configuration =
        await loadConfiguration(rows);

      const jobs = rows.map(row => {
        const vehicleType = rowVehicleType(row);

        return {
          row,
          vehicleId: rowVehicleId(row),
          vehicleType,
          crew: rowCrew(row),
          target:
            configuration.targets.get(vehicleType) ?? null
        };
      }).filter(job =>
        job.vehicleId &&
        Number.isInteger(job.vehicleType) &&
        job.target !== null &&
        Number.isInteger(job.target) &&
        job.target >= 0
      );

      if (jobs.length === 0) {
        setProgress(
          'Keine konfigurierten Fahrzeuge gefunden',
          0,
          0,
          'success'
        );
        return;
      }

      let completed = 0;
      let errors = 0;
      let shortages = 0;
      let excess = 0;

      const finalResults = new Map();
      const failedVehicles = new Set();

      const phases = checkOnly
        ? [
            {
              id: 'check',
              label: 'Besatzung prüfen'
            }
          ]
        : [
            {
              id: 'remove',
              label: 'Phase 1/2 – Personal entfernen'
            },
            {
              id: 'assign',
              label: 'Phase 2/2 – Personal zuweisen'
            }
          ];

      const totalSteps =
        jobs.length * phases.length;

      for (const phase of phases) {
        if (cancelled) break;

        setProgress(
          phase.label,
          completed,
          totalSteps
        );

        console.log(
          PREFIX,
          'Starte',
          phase.label
        );

        const phaseJobs = jobs.filter(job =>
          !failedVehicles.has(job.vehicleId)
        );

        await runWithConcurrency(
          phaseJobs,

          async job => {
            try {
              if (cancelled) return;

              const assigned = await adjustVehicle(
                job,
                configuration,
                phase.id
              );

              if (cancelled) return;

              if (
                phase.id === 'assign' ||
                phase.id === 'check'
              ) {
                finalResults.set(
                  job.vehicleId,
                  assigned
                );

                displayCrewResult(
                  job.row,
                  job.target,
                  assigned
                );
              }

            } catch (error) {
              errors++;

              failedVehicles.add(
                job.vehicleId
              );

              console.error(
                PREFIX,
                'Fahrzeug fehlgeschlagen:',
                job.vehicleId,
                error
              );
            } finally {
              completed++;

              setProgress(
                `${phase.label}: ${completed}/${totalSteps}`,
                completed,
                totalSteps,
                errors ? 'warning' : 'info'
              );
            }
          },

          {
            concurrency: 1,
            delay: configuration.vehicleDelay,
            shouldContinue: () => !cancelled
          }
        );

        console.log(
          PREFIX,
          'Abgeschlossen:',
          phase.label
        );
      }

      if (cancelled) {
        setProgress(
          'Abgebrochen',
          completed,
          totalSteps,
          'warning'
        );
        return;
      }

      for (const job of jobs) {
        if (!finalResults.has(job.vehicleId)) {
          continue;
        }

        const assigned =
          finalResults.get(job.vehicleId);

        if (assigned < job.target) {
          shortages++;

          console.warn(
            PREFIX,
            'Nicht genug passendes Personal:',
            job.vehicleId,
            `${assigned}/${job.target}`
          );
        }

        if (assigned > job.target) {
          excess++;
        }
      }

      const checkedVehicles =
        finalResults.size;

      const statusText = checkOnly
        ? 'Prüfung fertig'
        : 'Zuweisung fertig';

      setProgress(
        `${statusText}: ${checkedVehicles} Fahrzeuge, ` +
        `${shortages} unter Soll, ` +
        `${excess} über Soll, ` +
        `${errors} Fehler`,
        totalSteps,
        totalSteps,
        errors || shortages || excess
          ? 'warning'
          : 'success'
      );

      console.log(
        PREFIX,
        'Fertig:',
        {
          vehicles: checkedVehicles,
          shortages,
          excess,
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
        'danger'
      );

    } finally {
      running = false;

      buttons.forEach(button => {
        if (button) button.disabled = false;
      });
    }
  }

  /*
   * ERGEBNIS ANZEIGEN
   */

  function displayCrewResult(row, target, actual) {
    const cell = row.cells?.[4];

    if (!cell) return;

    let badge = cell.querySelector(
      '.nilspe-crew-result'
    );

    if (!badge) {
      badge = document.createElement('span');
      badge.style.marginLeft = '6px';
      cell.append(badge);
    }

    badge.className =
      'nilspe-crew-result label label-' +
      (
        actual < target
          ? 'danger'
          : actual === target
            ? 'success'
            : 'warning'
      );

    badge.textContent =
      'Soll: ' + target +
      ' | Ist: ' + actual;

    badge.title = jobTargetTitle(target);
  }

  function jobTargetTitle(target) {
    return target === 0
      ? 'Soll 0: Sämtliches Personal entfernen'
      : 'Zugewiesenes Personal mit passender Ausbildung';
  }

  /*
   * EINSTELLUNGSBUTTON
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

  /*
   * BUTTONS IN DER LEITSTELLE
   */

  function addButton() {
    const table =
      document.getElementById('vehicle_table');

    if (
      !table ||
      document.getElementById(
        'nilspe-assign-buttons'
      )
    ) {
      return;
    }

    const group = document.createElement('div');

    group.id = 'nilspe-assign-buttons';
    group.className = 'btn-group';
    group.style.display = 'flex';
    group.style.width = 'fit-content';
    group.style.margin = '0';

    const start = document.createElement('button');
    start.id = 'nilspe-assign-button';
    start.type = 'button';
    start.className = 'btn btn-default btn-xs';
    start.textContent = 'Personal zuweisen';

    start.addEventListener('click', () =>
      runAssignment(false)
    );

    const check = document.createElement('button');
    check.id = 'nilspe-personal-check-button';
    check.type = 'button';
    check.className = 'btn btn-default btn-xs';
    check.textContent = 'Besatzung prüfen';

    check.addEventListener('click', () =>
      runAssignment(true)
    );

    group.append(
      check,
      start,
      settingsButton()
    );

    const row = document.createElement('div');
    row.id = 'nilspe-assign-button-row';
    row.style.display = 'flex';
    row.style.width = '100%';
    row.style.margin = '0';
    row.style.padding = '0';
    row.style.lineHeight = '0';

    row.append(group);

    table.parentElement?.insertBefore(
      row,
      table
    );
  }

  /*
   * INITIALISIERUNG
   */

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();

  } else {
    addButton();

    new MutationObserver(
      addButton
    ).observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

})();
