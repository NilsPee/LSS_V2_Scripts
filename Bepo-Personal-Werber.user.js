// ==UserScript==
// @name         BePo-Personal-Werber
// @namespace    NilsPe.bepo.personnel
// @version      1.0.11
// @description  Verteilt unausgebildetes Personal aus Polizei- und BePo-Wachen auf BePo-Zielwachen
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/BePo-Personal-Werber.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/BePo-Personal-Werber.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.12
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_bepo_personnel';

  let RUN_LOCK_KEY = null;
  let SESSION_RUN_KEY = null;

  const KEYS = {
    targetPersonnel: 'nilspe_bepo_target_personnel',
    policeReserve: 'nilspe_bepo_police_reserve',
    bepoReserve: 'nilspe_bepo_bepo_reserve',
    excludedTargets: 'nilspe_bepo_excluded_targets',
    excludedSources: 'nilspe_bepo_excluded_sources',
    excludedDispatchCenters: 'nilspe_bepo_excluded_dispatch_centers',
    limitedDispatchCenters: 'nilspe_bepo_limited_dispatch_centers',
    requestDelay: 'nilspe_bepo_request_delay'
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function initializeAccountKeys() {
    if (RUN_LOCK_KEY && SESSION_RUN_KEY) {
      return;
    }

    const accountId = await getCurrentAccountId();

    RUN_LOCK_KEY = `nilspe_bepo_personnel_running_${accountId}`;
    SESSION_RUN_KEY = `nilspe_bepo_personnel_session_${accountId}`;
  }

  function parseJson(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  async function storedArray(key) {
    const value = await GM.getValue(key, '[]');
    const parsed = parseJson(value, []);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
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
      personal_count: Number(building.personal_count ?? 0),
      leitstelle_building_id:
        dispatchCenterId == null ? null : Number(dispatchCenterId),
      caption: building.caption || building.name || `Gebaeude ${building.id}`
    };
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      const warning = document.createElement('div');
      warning.className = 'alert alert-danger';
      warning.textContent = 'BePo-Personal-Werber: NilsPe-Skriptbasis fehlt.';
      (document.querySelector('.container') ?? document.body).prepend(warning);
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'BePo-Personal',
      settings: [
        { type: 'header', text: 'Allgemeine Einstellungen' },
        {
          type: 'number',
          key: KEYS.targetPersonnel,
          label: 'Zielpersonal der BePo-Wachen',
          min: 0,
          max: 400,
          default: 0
        },
        {
          type: 'number',
          key: KEYS.policeReserve,
          label: 'Mindestpersonal auf Polizeiwachen',
          min: 2,
          max: 400,
          default: 36
        },
        {
          type: 'number',
          key: KEYS.bepoReserve,
          label: 'Mindestpersonal auf BePo-Wachen',
          min: 0,
          max: 400,
          default: 244
        },
        {
          type: 'number',
          key: KEYS.requestDelay,
          label: 'Pause zwischen Anfragen [ms]',
          min: 0,
          max: 5_000,
          default: 100
        },
        {
          type: 'select',
          selectType: 'bepo_buildings',
          key: KEYS.excludedTargets,
          label: 'BePo-Wachen, die nicht aufgefuellt werden',
          title: 'Zielwachen ausschliessen',
          multiple: true
        },
        {
          type: 'select',
          selectType: 'bepo_personnel_generating_buildings',
          key: KEYS.excludedSources,
          label: 'Wachen, von denen kein Personal genommen wird',
          title: 'Quellwachen ausschliessen',
          multiple: true
        },
        {
          type: 'select',
          selectType: 'dispatch_centers',
          key: KEYS.excludedDispatchCenters,
          label: 'Quell-Leitstellen ausschliessen',
          title: 'Leitstellen ausschliessen',
          multiple: true
        },
        {
          type: 'select',
          selectType: 'dispatch_centers',
          key: KEYS.limitedDispatchCenters,
          label: 'Quellen auf diese Leitstellen begrenzen',
          title: 'Erlaubte Leitstellen',
          multiple: true
        }
      ]
    });
  }

  function currentBuildingId() {
    const match = location.pathname.match(/^\/buildings\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function currentBuildingType() {
    return Number(
      document.querySelector('h1[building_type]')?.getAttribute('building_type')
    );
  }

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
  }

  function ensureProgressUi() {
    if (document.getElementById('nilspe-bepo-progress')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nilspe-bepo-style';
    style.textContent = `
      #nilspe-bepo-progress {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483000;
        padding: 7px 12px;
        border-top: 1px solid #ddd;
        background: #f8f8f8;
      }
      #nilspe-bepo-track {
        height: 12px;
        margin-top: 5px;
        overflow: hidden;
        border-radius: 4px;
        background: #ddd;
      }
      #nilspe-bepo-fill {
        height: 100%;
        width: 0;
        background: #5cb85c;
      }
    `;
    document.head.append(style);

    const container = document.createElement('div');
    container.id = 'nilspe-bepo-progress';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    const stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'btn btn-default btn-xs';
    stopButton.textContent = 'Abbrechen';
    stopButton.addEventListener('click', stopRun);
    const status = document.createElement('span');
    status.id = 'nilspe-bepo-status';
    status.className = 'label label-info';
    status.textContent = 'Bereit';
    row.append(stopButton, status);
    const track = document.createElement('div');
    track.id = 'nilspe-bepo-track';
    const fill = document.createElement('div');
    fill.id = 'nilspe-bepo-fill';
    track.append(fill);
    container.append(row, track);
    document.body.append(container);
  }

  function setProgress(message, completed = 0, total = 0, type = 'info') {
    ensureProgressUi();
    const status = document.getElementById('nilspe-bepo-status');
    const fill = document.getElementById('nilspe-bepo-fill');
    status.className = `label label-${type}`;
    status.textContent = message;
    fill.style.width = total > 0 ? `${completed / total * 100}%` : '0%';
  }

  async function stopRun(message = 'Abgebrochen', type = 'danger') {
    if (SESSION_RUN_KEY) {
      sessionStorage.removeItem(SESSION_RUN_KEY);
    }

    if (RUN_LOCK_KEY) {
      await GM.deleteValue(RUN_LOCK_KEY);
    }

    setProgress(message, 0, 0, type);
  }

  function runIsActive() {
    return SESSION_RUN_KEY !== null &&
      sessionStorage.getItem(SESSION_RUN_KEY) === 'true';
  }

  async function acquireRunLock() {
    await initializeAccountKeys();

    const globalLock = await GM.getValue(RUN_LOCK_KEY, false);

    if (globalLock && !runIsActive()) {
      console.warn(
        '[BePo-Personal-Werber] Verwaister Run-Lock gefunden und entfernt.'
      );
      await GM.deleteValue(RUN_LOCK_KEY);
    }

    if (runIsActive()) {
      return false;
    }

    sessionStorage.setItem(SESSION_RUN_KEY, 'true');
    await GM.setValue(RUN_LOCK_KEY, true);
    return true;
  }

  async function loadBuildings() {
    const db = await openDb();

    try {
      await updateBuildings(db, 60);
      return (await getAllData(db, 'buildings'))
        .map(normalizeBuilding)
        .filter(building => [6, 11].includes(building.building_type));
    } finally {
      db.close();
    }
  }

  async function loadConfiguration() {
    const numberValue = async (key, fallback) => {
      const value = Number(await GM.getValue(key, fallback));
      return Number.isFinite(value) ? value : fallback;
    };

    return {
      targetPersonnel: await numberValue(KEYS.targetPersonnel, 0),
      policeReserve: Math.max(await numberValue(KEYS.policeReserve, 36), 2),
      bepoReserve: Math.max(await numberValue(KEYS.bepoReserve, 244), 0),
      requestDelay: Math.max(await numberValue(KEYS.requestDelay, 100), 0),
      excludedTargets: new Set(await storedArray(KEYS.excludedTargets)),
      excludedSources: new Set(await storedArray(KEYS.excludedSources)),
      excludedDispatchCenters: new Set(
        await storedArray(KEYS.excludedDispatchCenters)
      ),
      limitedDispatchCenters: new Set(
        await storedArray(KEYS.limitedDispatchCenters)
      )
    };
  }

  function selectTargets(buildings, configuration, context) {
    return buildings
      .filter(building => building.building_type === 11)
      .filter(building => !configuration.excludedTargets.has(building.id))
      .filter(building => {
        if (context.buildingId !== null) {
          return building.id === context.buildingId;
        }

        return building.leitstelle_building_id === context.dispatchCenterId;
      })
      .map(building => ({
        ...building,
        needed: Math.max(
          configuration.targetPersonnel - building.personal_count,
          0
        )
      }))
      .filter(building => building.needed > 0)
      .sort((a, b) => a.id - b.id);
  }

  function selectSources(buildings, configuration) {
    const limited = configuration.limitedDispatchCenters.size > 0;

    return buildings
      .filter(building => !configuration.excludedSources.has(building.id))
      .filter(building =>
        !configuration.excludedDispatchCenters.has(
          building.leitstelle_building_id
        )
      )
      .filter(building =>
        !limited ||
        configuration.limitedDispatchCenters.has(
          building.leitstelle_building_id
        )
      )
      .map(building => {
        const reserve = building.building_type === 11
          ? configuration.bepoReserve
          : configuration.policeReserve;
        return {
          ...building,
          reserve,
          available: Math.max(building.personal_count - reserve, 0)
        };
      })
      .filter(building => building.available > 0)
      .sort((a, b) => b.available - a.available || a.id - b.id);
  }

  function untrainedPersonnelIds(documentFromResponse, sourceBuildingId) {
    const table =
      documentFromResponse.getElementById(`personal_table_${sourceBuildingId}`) ??
      documentFromResponse.querySelector('table');

    if (!table) {
      return [];
    }

    const personnelIds = [];

    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = row.querySelectorAll('td');
      const input = cells[0]?.querySelector('input[value]');
      const schooling = cells[2]?.textContent.trim() ?? '';
      const course = cells[3]?.textContent.trim() ?? '';

      if (input && schooling === '' && course === '') {
        personnelIds.push(input.value);
      }
    }

    return personnelIds;
  }

  function personnelCountFromDocument(documentFromResponse, buildingId) {
    const table =
      documentFromResponse.getElementById(`personal_table_${buildingId}`) ??
      documentFromResponse.querySelector('table');

    return table?.querySelectorAll('tbody tr input[value]').length ?? null;
  }

  async function livePersonnelCount(buildingId) {
    const response = await fetch(
      `/buildings/${buildingId}/schooling_personal_select`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken()
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Personalzaehlung HTTP ${response.status}`);
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    return personnelCountFromDocument(documentFromResponse, buildingId);
  }

  async function refreshTargetNeed(target, configuration) {
    try {
      const liveCount = await livePersonnelCount(target.id);

      if (Number.isInteger(liveCount)) {
        target.personal_count = Math.max(target.personal_count, liveCount);
        target.needed = Math.max(
          configuration.targetPersonnel - target.personal_count,
          0
        );
      }
    } catch (error) {
      console.warn(
        '[BePo-Personal-Werber] Ziel-Personalzaehlung fehlgeschlagen:',
        target.id,
        error
      );
    }

    return target.needed;
  }
  async function availablePersonnelIds(sourceBuilding, maximum) {
    const response = await fetch(
      `/buildings/${sourceBuilding.id}/schooling_personal_select`,
      {
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-Token': csrfToken()
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `${sourceBuilding.caption}: Personalabfrage HTTP ${response.status}`
      );
    }

    const documentFromResponse = new DOMParser().parseFromString(
      await response.text(),
      'text/html'
    );
    const livePersonnel = personnelCountFromDocument(
      documentFromResponse,
      sourceBuilding.id
    );
    const liveAvailable = Number.isInteger(livePersonnel)
      ? Math.max(livePersonnel - sourceBuilding.reserve, 0)
      : sourceBuilding.available;
    const allowed = Math.min(
      maximum,
      sourceBuilding.available,
      liveAvailable
    );

    if (allowed <= 0) {
      return [];
    }

    return untrainedPersonnelIds(documentFromResponse, sourceBuilding.id)
      .slice(0, allowed);
  }

  async function adoptPersonnel(targetBuildingId, personnelIds) {
    const token = csrfToken();

    if (!token) {
      throw new Error('CSRF-Token wurde nicht gefunden.');
    }

    const form = new URLSearchParams();
    form.append('utf8', 'âœ“');
    form.append('authenticity_token', token);

    for (const personnelId of personnelIds) {
      form.append('personal_ids[]', personnelId);
    }

    form.append('commit', 'Personal Ã¼bernehmen');
    const response = await fetch(`/buildings/${targetBuildingId}/adopt`, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
      redirect: 'manual'
    });

    if (response.status >= 400) {
      throw new Error(`Personaluebernahme HTTP ${response.status}`);
    }
  }

  async function fillTarget(target, sources, requestDelay) {
    const selectedPersonnel = [];

    for (const source of sources) {
      if (!runIsActive() || selectedPersonnel.length >= target.needed) {
        break;
      }

      if (source.available <= 0 || source.id === target.id) {
        continue;
      }

      try {
        const ids = await availablePersonnelIds(
          source,
          target.needed - selectedPersonnel.length
        );
        selectedPersonnel.push(...ids);
        source.available -= ids.length;

        if (ids.length === 0) {
          source.available = 0;
          continue;
        }

        if (selectedPersonnel.length >= target.needed) {
          break;
        }
      } catch (error) {
        console.warn('[BePo-Personal-Werber] Quelle uebersprungen:', error);
      }

      if (requestDelay > 0) {
        await sleep(requestDelay);
      }
    }

    if (selectedPersonnel.length === 0) {
      return 0;
    }

    await adoptPersonnel(target.id, selectedPersonnel);
    return selectedPersonnel.length;
  }

  async function runRecruiter() {
    try {
      if (!await acquireRunLock()) {
        setProgress('Personalwerber laeuft bereits.', 0, 0, 'warning');
        return;
      }

      setProgress('Gebaeude werden geladen...');
      const configuration = await loadConfiguration();

      if (configuration.targetPersonnel <= 0) {
        throw new Error('Das Zielpersonal ist nicht groesser als 0.');
      }

      const buildings = await loadBuildings();
      const type = currentBuildingType();
      const id = currentBuildingId();
      const context = {
        buildingId: type === 11 ? id : null,
        dispatchCenterId: type === 7 ? id : null
      };
      let targets = selectTargets(buildings, configuration, context);
      const sources = selectSources(buildings, configuration);


      if (targets.length === 0) {
        await stopRun('Keine BePo-Wache muss aufgefuellt werden', 'success');
        return;
      }

      if (sources.length === 0) {
        throw new Error('Kein Personal oberhalb der eingestellten Reserven.');
      }

      let completed = 0;
      let errors = 0;
      let transferred = 0;

      for (const target of targets) {
        if (!runIsActive()) {
          return;
        }

        setProgress(
          `${completed}/${targets.length}: ${target.caption}`,
          completed,
          targets.length
        );

        try {
          await refreshTargetNeed(target, configuration);

          if (target.needed <= 0) {
            completed++;
            setProgress(
              `${completed}/${targets.length} Wachen, ${transferred} Personen`,
              completed,
              targets.length,
              errors ? 'warning' : 'success'
            );
            continue;
          }

          transferred += await fillTarget(
            target,
            sources,
            configuration.requestDelay
          );
        } catch (error) {
          errors++;
          console.error(
            '[BePo-Personal-Werber] Zielwache fehlgeschlagen:',
            target.id,
            error
          );
        }

        completed++;
        setProgress(
          `${completed}/${targets.length} Wachen, ${transferred} Personen`,
          completed,
          targets.length,
          errors ? 'warning' : 'success'
        );
      }

      await stopRun(
        `Fertig: ${transferred} Personen uebernommen, ${errors} Fehler`,
        errors ? 'warning' : 'success'
      );
    } catch (error) {
      console.error('[BePo-Personal-Werber] Lauf fehlgeschlagen:', error);
      await stopRun(`Fehler: ${error.message ?? error}`, 'danger');
    }
  }

  function settingsButton() {
    const button = document.createElement('a');
    button.className = 'btn btn-default btn-xs';
    button.href = `/settings/index#${SETTINGS_IDENTIFIER}`;
    button.target = '_blank';
    const icon = document.createElement('span');
    icon.className = 'glyphicon glyphicon-cog';
    icon.title = 'Einstellungen';
    button.append(icon);
    return button;
  }

  function addBuildingButtons() {
    const details = document.querySelector('.building-title ~ dl.dl-horizontal');

    if (!details || document.getElementById('nilspe-bepo-buttons')) {
      return;
    }

    const term = document.createElement('dt');
    const strong = document.createElement('strong');
    strong.textContent = 'Personal werben:';
    term.append(strong);
    const description = document.createElement('dd');
    const group = document.createElement('div');
    group.id = 'nilspe-bepo-buttons';
    group.className = 'btn-group';
    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'btn btn-default btn-xs';
    startButton.textContent = 'BePo-Personal werben';
    startButton.addEventListener('click', runRecruiter);
    group.append(startButton, settingsButton());
    description.append(group);
    details.append(term, description);
  }

  if (location.pathname.startsWith('/settings/index')) {
    await createSettings();
    return;
  }

  const buildingType = currentBuildingType();

  if (![7, 11].includes(buildingType)) {
    return;
  }

  window.addEventListener('pagehide', () => {
    if (runIsActive()) {
      sessionStorage.removeItem(SESSION_RUN_KEY);
      GM.deleteValue(RUN_LOCK_KEY);
    }
  });

  addBuildingButtons();
})();
