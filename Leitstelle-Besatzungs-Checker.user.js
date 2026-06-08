// ==UserScript==
// @name         Leitstelle Besatzungs-Checker
// @namespace    NilsPe.assignment.checker
// @version      1.0.2
// @description  Prueft Soll- und Ist-Besatzung sichtbarer Fahrzeuge inklusive passender Ausbildung
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Besatzungs-Checker.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Besatzungs-Checker.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.9
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_assignment_checker';
  const TARGET_PREFIX = 'nilspe_assign_personal_target_';
  const DELAY_KEY = 'nilspe_assignment_checker_delay';
  const DEFAULT_DELAY = 120;

  const VEHICLE_GROUPS = [
    {
      name: 'Feuerwehr',
      vehicles: [
        [53, 'Dekon-P'], [2, 'DLK 23'], [34, 'ELW 2'], [57, 'FwK'],
        [121, 'GTLF'], [5, 'GW-A'], [27, 'GW-Gefahrgut'],
        [33, 'GW-Hoehenrettung'], [104, 'GW-L1'], [105, 'GW-L2'],
        [114, 'GW-Luefter'], [12, 'GW-Messtechnik'], [138, 'GW-Verpflegung'],
        [139, 'GW-Kueche'], [30, 'HLF 20'], [111, 'NEA50 (FW)'],
        [113, 'NEA200 (FW)'], [14, 'SW 2000']
      ]
    },
    {
      name: 'Rettungsdienst',
      vehicles: [
        [55, 'KdoW-LNA'], [56, 'KdoW-OrgL'], [38, 'KTW'], [29, 'NEF'],
        [74, 'NAW'], [28, 'RTW']
      ]
    },
    {
      name: 'SEG',
      vehicles: [
        [174, 'Anh TeSi'], [133, 'Bt LKW'], [131, 'Bt-Kombi'],
        [59, 'ELW 1 (SEG)'], [132, 'FKH'], [130, 'GW-Bt'],
        [171, 'GW TeSi'], [127, 'GW UAS'], [173, 'MTW TeSi'],
        [175, 'NEA 50']
      ]
    },
    { name: 'Rettungshubschrauber', vehicles: [[31, 'Rettungshubschrauber']] },
    { name: 'Rettungshundestaffel', vehicles: [[91, 'Rettungshundefahrzeug']] },
    {
      name: 'Wasserrettung',
      vehicles: [[63, 'GW-Taucher'], [64, 'GW-Wasserrettung'], [70, 'MZB']]
    },
    {
      name: 'Polizei',
      vehicles: [
        [94, 'DhuFueKw'], [32, 'FuStW'], [103, 'FuStW (DGL)'],
        [52, 'GefKw'], [95, 'Polizeimotorrad'], [98, 'Zivilstreifenwagen']
      ]
    },
    {
      name: 'Bereitschaftspolizei',
      vehicles: [
        [50, 'GruKw'], [51, 'FueKw'], [165, 'LauKW'], [35, 'leBefKw'],
        [72, 'WaWe 10']
      ]
    },
    { name: 'Polizeihubschrauber', vehicles: [[61, 'Polizeihubschrauber']] },
    {
      name: 'THW',
      vehicles: [
        [102, 'Anh 7'], [44, 'Anh DLE'], [146, 'Anh FueLa'], [66, 'Anh MzB'],
        [101, 'Anh SwPu'], [43, 'BrmG R'], [147, 'FmKW'], [39, 'GKW'],
        [100, 'MLW 4'], [45, 'MLW 5'], [40, 'MTW-TZ'], [41, 'MzGW (FGr N)'],
        [109, 'MzGW SB'], [110, 'NEA50 (THW)'], [112, 'NEA200 (THW)'],
        [122, 'LKW 7 Lbw (FGr E)'], [123, 'LKW 7 Lbw (FGr WP)'],
        [42, 'LKW K 9'], [172, 'LKW Technik'], [144, 'FueKW (THW)'],
        [145, 'FueKomKW']
      ]
    }
  ];

  const QUALIFICATION_BY_TYPE = new Map([
    [12, 'gw_messtechnik'], [27, 'gw_gefahrgut'], [29, 'notarzt'],
    [31, 'notarzt'], [33, 'gw_hoehenrettung'], [34, 'elw2'],
    [35, 'police_einsatzleiter'], [40, 'thw_zugtrupp'], [42, 'thw_raumen'],
    [45, 'thw_raumen'], [46, 'wechsellader'], [51, 'police_fukw'],
    [53, 'dekon_p'], [55, 'lna'], [56, 'orgl'], [57, 'fwk'],
    [59, 'seg_elw'], [60, 'seg_gw_san'], [61, 'polizeihubschrauber'],
    [63, 'gw_taucher'], [64, 'gw_wasserrettung'], [69, 'gw_taucher'],
    [72, 'police_wasserwerfer'], [74, 'notarzt'], [75, 'arff'],
    [76, 'rettungstreppe'], [79, 'police_sek'], [80, 'police_sek'],
    [81, 'police_mek'], [82, 'police_mek'], [83, 'werkfeuerwehr'],
    [84, 'werkfeuerwehr'], [85, 'werkfeuerwehr'], [86, 'werkfeuerwehr'],
    [91, 'seg_rescue_dogs'], [93, 'thw_rescue_dogs'], [94, 'k9'],
    [95, 'police_motorcycle'], [98, 'criminal_investigation'],
    [99, 'water_damage_pump'], [100, 'water_damage_pump'],
    [103, 'police_service_group_leader'], [109, 'heavy_rescue'],
    [122, 'thw_energy_supply'], [123, 'water_damage_pump'],
    [125, 'thw_drone'], [126, 'fire_drone'], [127, 'seg_drone'],
    [128, 'fire_drone'], [131, 'care_service'],
    [133, 'care_service_equipment'], [134, 'police_horse'],
    [135, 'police_horse'], [137, 'police_horse'],
    [140, 'fire_care_service'], [144, 'thw_command'], [145, 'thw_command'],
    [147, 'thw_command'], [148, 'thw_command'], [149, 'notarzt'],
    [151, 'mountain_command'], [153, 'seg_rescue_dogs'],
    [158, 'mountain_height_rescue'], [162, 'railway_fire'],
    [163, 'railway_fire'], [164, 'railway_fire'],
    [165, 'police_speaker_operator'],
    [171, 'disaster_response_technology'],
    [172, 'disaster_response_technology'],
    [173, 'disaster_response_technology'],
    [175, 'disaster_response_technology']
  ]);

  const sleep = milliseconds =>
    new Promise(resolve => setTimeout(resolve, milliseconds));

  let running = false;

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Besatzungs-Checker',
      settings: [
        { type: 'header', text: 'Pruefung' },
        {
          type: 'number',
          key: DELAY_KEY,
          label: 'Pause nach einer Fahrzeugpruefung [ms]',
          min: 0,
          max: 5_000,
          default: DEFAULT_DELAY
        }
      ]
    });

    const panel = document.getElementById(SETTINGS_IDENTIFIER);
    const body = panel?.querySelector('.settings-tab-body');

    if (!body || document.getElementById('nilspe-checker-targets')) {
      return;
    }

    const section = document.createElement('section');
    section.id = 'nilspe-checker-targets';
    section.style.marginBottom = '24px';
    const heading = document.createElement('h2');
    heading.textContent = 'Soll-Besatzung je Fahrzeugtyp';
    const hint = document.createElement('p');
    hint.textContent =
      'Die Werte werden gemeinsam mit Leitstelle Assign Personal verwendet. ' +
      '0 bedeutet: Fahrzeugtyp nicht pruefen.';
    section.append(heading, hint);

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

      for (const [type, name] of group.vehicles) {
        const field = document.createElement('label');
        field.style.display = 'block';
        field.style.width = '115px';
        field.style.margin = '0';
        const label = document.createElement('span');
        label.textContent = name;
        label.style.display = 'block';
        label.style.minHeight = '34px';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '50';
        input.className = 'form-control input-sm';
        input.style.width = '80px';
        input.value = String(
          await GM.getValue(`${TARGET_PREFIX}${type}`, 0) || ''
        );
        input.addEventListener('change', async () => {
          const value = Math.max(0, Math.min(50, Number(input.value) || 0));
          input.value = value > 0 ? String(value) : '';
          await GM.setValue(`${TARGET_PREFIX}${type}`, value);
        });
        field.append(label, input);
        row.append(field);
      }

      section.append(wrapper);
    }

    body.prepend(section);
  }

  function vehicleTable() {
    return document.getElementById('vehicle_table');
  }

  function vehicleRows() {
    return Array.from(vehicleTable()?.tBodies?.[0]?.rows ?? []);
  }

  function vehicleId(row) {
    const link = Array.from(row.querySelectorAll('a[href*="/vehicles/"]'))
      .find(element => /\/vehicles\/\d+/.test(element.getAttribute('href') ?? ''));
    return Number(link?.getAttribute('href')?.match(/\/vehicles\/(\d+)/)?.[1]);
  }

  function vehicleType(row) {
    const element = row.querySelector(
      '[vehicle_type_id], [data-vehicle-type-id]'
    );
    return Number(
      element?.getAttribute('vehicle_type_id') ??
      element?.getAttribute('data-vehicle-type-id')
    );
  }

  function crewCell(row) {
    return row.cells?.[4] ?? null;
  }

  async function targetsForVisibleTypes(rows) {
    const types = [...new Set(rows.map(vehicleType).filter(Boolean))];
    const targets = new Map();

    for (const type of types) {
      const target = Number(await GM.getValue(`${TARGET_PREFIX}${type}`, 0));

      if (target > 0) {
        targets.set(type, target);
      }
    }

    return targets;
  }

  async function assignmentDocument(id) {
    const response = await fetch(`/vehicles/${id}/zuweisung`, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });

    if (!response.ok) {
      throw new Error(`Zuweisungsseite HTTP ${response.status}`);
    }

    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }

  function rowMatchesQualification(row, qualification) {
    if (!qualification) {
      const schooling = row.children?.[1]?.textContent.trim().toLowerCase() ?? '';
      return schooling === '' || schooling === '-';
    }

    return (row.dataset.filterableBy ?? '').includes(qualification);
  }

  function qualifiedAssignedCount(documentFromResponse, vehicleTypeId) {
    const qualification = QUALIFICATION_BY_TYPE.get(vehicleTypeId);
    return Array.from(documentFromResponse.querySelectorAll('tr')).filter(row =>
      row.querySelector('a.btn-assigned') &&
      rowMatchesQualification(row, qualification)
    ).length;
  }

  function displayResult(cell, target, actual) {
    cell.textContent = `${target} | ${actual}`;
    cell.title =
      `Soll: ${target}, Ist mit passender Ausbildung: ${actual}`;
    cell.style.fontWeight = 'bold';
    cell.style.color = actual < target
      ? '#d9534f'
      : actual === target
        ? '#5cb85c'
        : '#f0ad4e';
  }

  function ensureProgress() {
    if (document.getElementById('nilspe-checker-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-checker-style';
    style.textContent = `
      #nilspe-checker-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-checker-track {
        display: flex;
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-checker-success {
        width: 0;
        height: 100%;
        background: #5cb85c;
      }
      #nilspe-checker-errors {
        width: 0;
        height: 100%;
        background: #d9534f;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-checker-progress';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-default btn-xs';
    cancel.textContent = 'Abbrechen';
    cancel.addEventListener('click', () => {
      running = false;
      setProgress('Abgebrochen', 0, 0, 0, 'danger');
    });
    const status = document.createElement('span');
    status.id = 'nilspe-checker-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    const track = document.createElement('div');
    track.id = 'nilspe-checker-track';
    const success = document.createElement('div');
    success.id = 'nilspe-checker-success';
    const errors = document.createElement('div');
    errors.id = 'nilspe-checker-errors';
    track.append(success, errors);
    row.append(cancel, status);
    container.append(row, track);
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
    const status = document.getElementById('nilspe-checker-status');
    const success = document.getElementById('nilspe-checker-success');
    const errorBar = document.getElementById('nilspe-checker-errors');
    const safeTotal = Math.max(total, 1);
    status.className = `label label-${type}`;
    status.textContent = message;
    success.style.width = `${(completed - errors) / safeTotal * 100}%`;
    errorBar.style.width = `${errors / safeTotal * 100}%`;
  }

  async function run(button) {
    if (running) {
      return;
    }

    running = true;
    button.disabled = true;

    try {
      const rows = vehicleRows();
      const targets = await targetsForVisibleTypes(rows);
      const jobs = rows.map(row => ({
        row,
        id: vehicleId(row),
        type: vehicleType(row),
        cell: crewCell(row)
      })).filter(job =>
        job.id &&
        job.type &&
        job.cell &&
        targets.has(job.type)
      );

      if (jobs.length === 0) {
        setProgress('Keine konfigurierten Fahrzeuge sichtbar', 0, 0, 0, 'success');
        return;
      }

      const delay = Math.max(
        0,
        Number(await GM.getValue(DELAY_KEY, DEFAULT_DELAY)) || 0
      );
      let completed = 0;
      let errors = 0;

      for (const job of jobs) {
        if (!running) {
          return;
        }

        setProgress(
          `${completed}/${jobs.length} Fahrzeuge geprueft`,
          completed,
          errors,
          jobs.length
        );

        try {
          const documentFromResponse = await assignmentDocument(job.id);
          displayResult(
            job.cell,
            targets.get(job.type),
            qualifiedAssignedCount(documentFromResponse, job.type)
          );
        } catch (error) {
          errors++;
          console.error(
            '[Leitstelle Besatzungs-Checker] Fahrzeug fehlgeschlagen:',
            job.id,
            error
          );
        }

        completed++;
        setProgress(
          `${completed}/${jobs.length} Fahrzeuge geprueft`,
          completed,
          errors,
          jobs.length,
          errors ? 'warning' : 'success'
        );
        await sleep(delay);
      }

      setProgress(
        `Fertig: ${completed - errors} geprueft, ${errors} Fehler`,
        completed,
        errors,
        jobs.length,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[Leitstelle Besatzungs-Checker] Lauf fehlgeschlagen:', error);
      setProgress(`Fehler: ${error.message ?? error}`, 0, 0, 0, 'danger');
    } finally {
      running = false;
      button.disabled = false;
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

  function addButton() {
    const table = vehicleTable();

    if (!table || document.getElementById('nilspe-checker-buttons')) {
      return;
    }

    const group = document.createElement('div');
    group.id = 'nilspe-checker-buttons';
    group.className = 'btn-group';
    group.style.display = 'flex';
    group.style.width = 'fit-content';
    group.style.margin = '0';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-default btn-xs';
    button.textContent = 'Besatzung pruefen';
    button.addEventListener('click', () => run(button));
    group.append(button, settingsButton());

    const row = document.createElement('div');
    row.id = 'nilspe-checker-button-row';
    row.style.display = 'flex';
    row.style.width = '100%';
    row.style.margin = '0';
    row.style.padding = '0';
    row.style.lineHeight = '0';
    row.append(group);
    table.parentElement?.insertBefore(row, table);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
  } else {
    addButton();
    new MutationObserver(addButton).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
