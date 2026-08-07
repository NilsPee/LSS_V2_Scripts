// ==UserScript==
// @name         NilsPe LSS Core
// @namespace    https://github.com/NilsPee/LSS_V2_Scripts
// @version      1.0.13
// @description  Gemeinsamer API-Cache und Einstellungsbaukasten fuer NilsPe Userscripts
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js
// @match        https://*.leitstellenspiel.de/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-start
// ==/UserScript==

'use strict';

const NILSPE_DB_NAME_PREFIX = 'nilspe-lss-cache';
const NILSPE_DB_VERSION = 1;

let nilspeAccountIdPromise = null;

async function getCurrentAccountId() {
  if (!nilspeAccountIdPromise) {
    nilspeAccountIdPromise = (async () => {
      const possiblePageIds = [
        unsafeWindow?.user_id,
        unsafeWindow?.userId,
        unsafeWindow?.current_user_id,
        unsafeWindow?.currentUserId
      ];

      for (const value of possiblePageIds) {
        const id = Number(value);

        if (Number.isInteger(id) && id > 0) {
          return id;
        }
      }

      const response = await fetch('/api/userinfo', {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(
          `Account-ID konnte nicht geladen werden: HTTP ${response.status}`
        );
      }

      const payload = await response.json();
      const data = payload?.result ?? payload;

      const id = Number(
        data?.user_id ??
        data?.id
      );

      if (!Number.isInteger(id) || id <= 0) {
        throw new Error('In /api/userinfo wurde keine gültige Account-ID gefunden.');
      }

      return id;
    })();
  }

  return nilspeAccountIdPromise;
}

async function getAccountDatabaseName() {
  const accountId = await getCurrentAccountId();
  return `${NILSPE_DB_NAME_PREFIX}-${accountId}`;
}
const NILSPE_PAGE_SIZE = 3_000;
const NILSPE_VEHICLE_PAGE_SIZE = 5_000;
const NILSPE_FULL_SYNC_AGE = 24 * 60 * 60 * 1_000;
const NILSPE_SYNC_REVISION = 2;

const NILSPE_STORES = {
  metadata: { keyPath: 'key' },
  buildings: {
    keyPath: 'id',
    indexes: {
      building_type: 'building_type',
      leitstelle_building_id: 'leitstelle_building_id'
    }
  },
  allianceBuildings: {
    keyPath: 'id',
    indexes: { building_type: 'building_type' }
  },
  vehicles: {
    keyPath: 'id',
    indexes: {
      building_id: 'building_id',
      vehicle_type: 'vehicle_type'
    }
  },
  pois: { keyPath: 'id' },
  missions: { keyPath: 'id' },
  buildingTypes: { keyPath: 'id' },
  schoolingTypes: { keyPath: 'id' },
  vehicleTypes: { keyPath: 'id' },
  allianceSchoolings: {
    keyPath: 'id',
    indexes: { building_id: 'building_id' }
  },
  userInfo: {
    keyPath: 'user_id',
    indexes: { user_name: 'user_name' }
  },
  allianceInfo: { keyPath: 'id' },
  allianceUsers: { keyPath: 'id' }
};

async function openDb() {
  const databaseName = await getAccountDatabaseName();
  const lockName = `nilspe-lss-db-open:${databaseName}`;

  const open = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, NILSPE_DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      for (const [name, definition] of Object.entries(NILSPE_STORES)) {
        const store = db.objectStoreNames.contains(name)
          ? event.target.transaction.objectStore(name)
          : db.createObjectStore(name, {
              keyPath: definition.keyPath
            });

        for (
          const [indexName, keyPath]
          of Object.entries(definition.indexes ?? {})
        ) {
          if (!store.indexNames.contains(indexName)) {
            store.createIndex(indexName, keyPath, {
              unique: false
            });
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    request.onblocked = () => reject(
      new Error(
        `IndexedDB-Upgrade für ${databaseName} wird durch einen anderen Tab blockiert.`
      )
    );
  });

  if (navigator.locks?.request) {
    return navigator.locks.request(lockName, open);
  }

  return open();
}

function runTransaction(db, storeNames, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result;

    try {
      result = operation(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function recordsFromPayload(payload, store) {
  if (payload == null) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== 'object') {
    return [];
  }

  if (Object.hasOwn(payload, store.keyPath)) {
    return [payload];
  }

  return Object.entries(payload).map(([key, value]) => {
    if (value == null || typeof value !== 'object') {
      return null;
    }

    if (Object.hasOwn(value, store.keyPath)) {
      return value;
    }

    const numericKey = Number(key);
    return {
      ...value,
      [store.keyPath]: Number.isNaN(numericKey) ? key : numericKey
    };
  }).filter(Boolean);
}

async function putRecords(db, storeName, payload) {
  return runTransaction(db, storeName, 'readwrite', transaction => {
    const store = transaction.objectStore(storeName);

    for (const record of recordsFromPayload(payload, store)) {
      store.put(record);
    }
  });
}

async function replaceRecords(db, storeName, payload) {
  return runTransaction(db, storeName, 'readwrite', transaction => {
    const store = transaction.objectStore(storeName);
    store.clear();

    for (const record of recordsFromPayload(payload, store)) {
      store.put(record);
    }
  });
}

async function getData(db, storageName, key) {
  const transaction = db.transaction(storageName, 'readonly');
  return requestResult(transaction.objectStore(storageName).get(key));
}

async function getAllData(db, storageName) {
  const transaction = db.transaction(storageName, 'readonly');
  return requestResult(transaction.objectStore(storageName).getAll());
}

async function getAllKeys(db, storageName) {
  const transaction = db.transaction(storageName, 'readonly');
  return requestResult(transaction.objectStore(storageName).getAllKeys());
}

async function getCount(db, storageName, query = null) {
  const transaction = db.transaction(storageName, 'readonly');
  return requestResult(transaction.objectStore(storageName).count(query));
}

async function getDataByIndex(db, storageName, indexName, query = null) {
  const transaction = db.transaction(storageName, 'readonly');
  const index = transaction.objectStore(storageName).index(indexName);
  return requestResult(index.getAll(query));
}

async function getCountByIndex(db, storageName, indexName, query = null) {
  const transaction = db.transaction(storageName, 'readonly');
  const index = transaction.objectStore(storageName).index(indexName);
  return requestResult(index.count(query));
}

async function deleteByIndex(db, storageName, indexName, query) {
  return runTransaction(db, storageName, 'readwrite', transaction => {
    const store = transaction.objectStore(storageName);
    const request = store.index(indexName).openKeyCursor(query);

    request.onsuccess = () => {
      const cursor = request.result;

      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  });
}

async function readSyncState(db, storeName) {
  return getData(db, 'metadata', `sync:${storeName}`);
}

async function getSyncState(db, storeName) {
  return readSyncState(db, storeName);
}

async function writeSyncState(db, storeName, state) {
  return putRecords(db, 'metadata', {
    key: `sync:${storeName}`,
    ...state
  });
}

function withQuery(endpoint, parameters) {
  const url = new URL(endpoint, location.origin);

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.href;
}

async function fetchJson(endpoint, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        return await response.json();
      }

      lastError = new Error(`HTTP ${response.status} for ${endpoint}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, attempt * 300));
    }
  }

  console.error('[NilsPe LSS Core] API request failed:', lastError);
  return null;
}

async function fetchJsonPage(endpoint, attempts = 2) {
  let lastError;
  let status = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      status = response.status;

      if (response.ok) {
        return { data: await response.json(), status };
      }

      lastError = new Error(`HTTP ${response.status} for ${endpoint}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, attempt * 1_500));
    }
  }

  console.warn('[NilsPe LSS Core] API page failed:', lastError);
  return { data: null, status };
}

function setPageLimit(endpoint, limit) {
  const url = new URL(endpoint, location.origin);
  url.searchParams.set('limit', String(limit));
  return url.href;
}

function extractResult(response) {
  return response && Object.hasOwn(response, 'result')
    ? response.result
    : response;
}

function payloadRecordCount(payload) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  return payload && typeof payload === 'object'
    ? Object.keys(payload).length
    : 0;
}

async function fetchAllPages(endpoint, parameters = {}) {
  const pages = [];
  let nextUrl = withQuery(endpoint, parameters);
  const visited = new Set();

  while (nextUrl) {
    if (visited.has(nextUrl)) {
      throw new Error(`Pagination loop detected for ${nextUrl}`);
    }

    visited.add(nextUrl);
    const response = await fetchJson(nextUrl);

    if (!response) {
      return null;
    }

    pages.push(extractResult(response));
    nextUrl = response.paging?.next_page ?? null;
  }

  return pages;
}

function mergePages(pages) {
  if (!pages?.length) {
    return [];
  }

  if (pages.every(Array.isArray)) {
    return pages.flat();
  }

  return Object.assign({}, ...pages.filter(page => page && typeof page === 'object'));
}

async function synchronizeV2(
  db,
  storeName,
  endpoint,
  maxAgeSeconds = 300,
  pageSize = NILSPE_PAGE_SIZE
) {
  const lockName = `nilspe-sync:${storeName}`;
  const sync = async () => {
    const state = await readSyncState(db, storeName);
    const now = Date.now();

    const validState = state?.syncRevision === NILSPE_SYNC_REVISION;

    if (validState && state.complete && !state.inProgress && maxAgeSeconds > 0 &&
        now - state.checkedAt < maxAgeSeconds * 1_000) {
      return false;
    }

    const resuming = Boolean(
      validState && state?.inProgress && state.resumeUrl
    );
    const fullSync = resuming
      ? Boolean(state.syncWasFullSync)
      : !validState || !state?.complete || !state?.fullSyncAt ||
        now - state.fullSyncAt >= NILSPE_FULL_SYNC_AGE;
    const query = { limit: pageSize };
    const syncStartedAt = resuming
      ? state.syncStartedAt
      : new Date(now - 1_000).toISOString();

    if (!fullSync && state?.changedSince) {
      query.from = state.changedSince;
    }

    let activePageSize = resuming ? state.pageSize : pageSize;
    let nextUrl = resuming
      ? setPageLimit(state.resumeUrl, activePageSize)
      : withQuery(endpoint, { ...query, limit: activePageSize });
    const visited = new Set();
    let page = resuming ? state.page : 0;
    let recordCount = resuming ? state.recordCount : 0;

    while (nextUrl) {
      if (visited.has(nextUrl)) {
        throw new Error(`Pagination loop detected for ${nextUrl}`);
      }

      const pageResponse = await fetchJsonPage(nextUrl);

      if (!pageResponse.data) {
        if (storeName === 'vehicles' && activePageSize > 1_000) {
          activePageSize = activePageSize > 2_500 ? 2_500 : 1_000;
          nextUrl = setPageLimit(nextUrl, activePageSize);
          console.info(
            `[NilsPe LSS Core] vehicles: HTTP ${pageResponse.status || 'Fehler'}, ` +
            `wiederhole Cursor mit limit=${activePageSize}`
          );
          globalThis.dispatchEvent(new CustomEvent('nilspe-sync-progress', {
            detail: {
              storeName,
              page,
              recordCount,
              fullSync,
              pageSize: activePageSize,
              retrying: true
            }
          }));
          await new Promise(resolve => setTimeout(resolve, 3_000));
          continue;
        }

        throw new Error(
          `${storeName}: API-Seite konnte nicht geladen werden ` +
          `(HTTP ${pageResponse.status || 'unbekannt'}).`
        );
      }

      visited.add(nextUrl);
      const response = pageResponse.data;
      const records = extractResult(response);
      recordCount += payloadRecordCount(records);

      if (fullSync && page === 0) {
        await replaceRecords(db, storeName, records);
      } else {
        await putRecords(db, storeName, records);
      }

      page++;
      const progress = {
        storeName,
        page,
        recordCount,
        fullSync,
        pageSize: activePageSize
      };
      console.info(
        `[NilsPe LSS Core] ${storeName}: Seite ${page}, ` +
        `${recordCount.toLocaleString('de-DE')} Datensaetze gespeichert`
      );
      globalThis.dispatchEvent(new CustomEvent('nilspe-sync-progress', {
        detail: progress
      }));
      const responseNextUrl = response.paging?.next_page ?? null;
      nextUrl = responseNextUrl
        ? setPageLimit(responseNextUrl, activePageSize)
        : null;

      if (nextUrl) {
        await writeSyncState(db, storeName, {
          inProgress: true,
          complete: false,
          syncRevision: NILSPE_SYNC_REVISION,
          resumeUrl: nextUrl,
          page,
          recordCount,
          pageSize: activePageSize,
          syncStartedAt,
          syncWasFullSync: fullSync,
          checkedAt: 0,
          changedSince: state?.changedSince ?? null,
          fullSyncAt: state?.fullSyncAt ?? null
        });
      }
    }

    const storedRecordCount = await getCount(db, storeName);
    await writeSyncState(db, storeName, {
      inProgress: false,
      resumeUrl: null,
      complete: true,
      syncRevision: NILSPE_SYNC_REVISION,
      checkedAt: Date.now(),
      changedSince: syncStartedAt,
      fullSyncAt: fullSync ? Date.now() : state.fullSyncAt,
      recordCount: storedRecordCount,
      pageSize: activePageSize
    });
    return true;
  };

  if (navigator.locks?.request) {
    return navigator.locks.request(lockName, sync);
  }

  return sync();
}

async function synchronizeSimple(db, storeName, endpoint, maxAgeSeconds = 300, transform = null) {
  const lockName = `nilspe-sync:${storeName}`;
  const sync = async () => {
    const state = await readSyncState(db, storeName);

    if (state && maxAgeSeconds > 0 &&
        Date.now() - state.checkedAt < maxAgeSeconds * 1_000) {
      return false;
    }

    const response = await fetchJson(endpoint);

    if (!response) {
      return false;
    }

    const rawResult = extractResult(response);
    const result = transform ? transform(rawResult) : rawResult;
    await replaceRecords(db, storeName, result);
    await writeSyncState(db, storeName, {
      checkedAt: Date.now(),
      changedSince: new Date().toISOString(),
      fullSyncAt: Date.now()
    });
    return true;
  };

  if (navigator.locks?.request) {
    return navigator.locks.request(lockName, sync);
  }

  return sync();
}

function updateBuildings(db, maxAge = 300) {
  return synchronizeV2(db, 'buildings', '/api/v2/buildings', maxAge);
}

function updateAllianceBuildings(db, maxAge = 300) {
  return synchronizeV2(db, 'allianceBuildings', '/api/v2/alliance_buildings', maxAge);
}

function updateVehicles(db, maxAge = 300) {
  return synchronizeV2(
    db,
    'vehicles',
    '/api/v2/vehicles',
    maxAge,
    NILSPE_VEHICLE_PAGE_SIZE
  );
}

function updateVehiclesV2(db, maxAge = 300) {
  return updateVehicles(db, maxAge);
}

function updatePois(db, maxAge = 300) {
  return synchronizeV2(db, 'pois', '/api/v2/pois', maxAge);
}

function updateMissions(db, maxAge = 3_600) {
  return synchronizeSimple(db, 'missions', '/einsaetze.json', maxAge);
}

function updateAllianceSchoolings(db, maxAge = 300) {
  return synchronizeSimple(db, 'allianceSchoolings', '/api/alliance_schoolings', maxAge);
}

function updateUserInfo(db, maxAge = 300) {
  return synchronizeSimple(db, 'userInfo', '/api/userinfo', maxAge);
}

function updateAllianceInfo(db, maxAge = 300) {
  const lockName = 'nilspe-sync:allianceInfo';
  const sync = async () => {
    const state = await readSyncState(db, 'allianceInfo');

    if (state && maxAge > 0 && Date.now() - state.checkedAt < maxAge * 1_000) {
      return false;
    }

    const result = extractResult(await fetchJson('/api/allianceinfo'));

    if (!result || typeof result !== 'object') {
      return false;
    }

    const { users, ...alliance } = result;

    if (Array.isArray(users)) {
      await replaceRecords(db, 'allianceUsers', users);
    }

    await replaceRecords(db, 'allianceInfo', alliance);
    await writeSyncState(db, 'allianceInfo', {
      checkedAt: Date.now(),
      changedSince: new Date().toISOString(),
      fullSyncAt: Date.now()
    });
    return true;
  };

  return navigator.locks?.request
    ? navigator.locks.request(lockName, sync)
    : sync();
}

function currentLocale() {
  return globalThis.I18n?.locale ?? 'de_DE';
}

function updateBuildingTypes(db, maxAge = 3_600) {
  return synchronizeSimple(
    db,
    'buildingTypes',
    `https://api.lss-manager.de/${currentLocale()}/buildings`,
    maxAge
  );
}

function updateSchoolingTypes(db, maxAge = 3_600) {
  return synchronizeSimple(
    db,
    'schoolingTypes',
    `https://api.lss-manager.de/${currentLocale()}/schoolings`,
    maxAge
  );
}

function updateVehicleTypes(db, maxAge = 3_600) {
  return synchronizeSimple(
    db,
    'vehicleTypes',
    `https://api.lss-manager.de/${currentLocale()}/vehicles`,
    maxAge
  );
}

async function updateBuildingById(db, buildingId, maxAge = 60) {
  const stateName = `building:${buildingId}`;
  const state = await readSyncState(db, stateName);

  if (state && Date.now() - state.checkedAt < maxAge * 1_000) {
    return false;
  }

  const response = await fetchJson(`/api/buildings/${buildingId}`);

  if (!response) {
    return false;
  }

  await putRecords(db, 'buildings', extractResult(response));
  await writeSyncState(db, stateName, { checkedAt: Date.now() });
  return true;
}

function updateVehiclesByBuildingId(db, buildingId, maxAge = 60) {
  return updateVehicles(db, maxAge);
}

function dataNeedsUpdate(db, type, maxAge) {
  return readSyncState(db, type).then(state => {
    return !state || Date.now() - state.checkedAt >= maxAge * 1_000;
  });
}

async function runWithConcurrency(
  items,
  worker,
  {
    concurrency = 3,
    delay = 0,
    shouldContinue = () => true
  } = {}
) {
  const queue = Array.from(items);
  const workerCount = Math.min(
    Math.max(1, Math.floor(Number(concurrency)) || 1),
    queue.length
  );
  const pause = Math.max(0, Number(delay) || 0);
  let nextIndex = 0;
  let nextStartAt = Date.now();

  async function waitForStartSlot() {
    if (pause <= 0) {
      return;
    }

    const scheduledAt = nextStartAt;
    nextStartAt = Math.max(nextStartAt, Date.now()) + pause;
    const wait = scheduledAt - Date.now();

    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }

  async function runWorker() {
    while (shouldContinue()) {
      const index = nextIndex++;

      if (index >= queue.length) {
        return;
      }

      await waitForStartSlot();

      if (!shouldContinue()) {
        return;
      }

      await worker(queue[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
}

async function waitForSettingsDom(timeoutMs = 15_000) {
  const ready = () =>
    document.getElementById('tabs') &&
    document.getElementById('settings-tabs');

  if (ready()) {
    return true;
  }

  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (ready()) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(true);
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  });
}

function createSettingsPane(identifier, title) {
  const tabs = document.getElementById('tabs');
  const tabContent = document.getElementById('settings-tabs');
  const escapedIdentifier = CSS.escape(identifier);
  let anchor = tabs.querySelector(`a[href="#${escapedIdentifier}"]`);
  let body = document.querySelector(`#${escapedIdentifier} .settings-tab-body`);

  if (!anchor) {
    const item = document.createElement('li');
    item.className = 'settings';
    item.role = 'presentation';

    anchor = document.createElement('a');
    anchor.href = `#${identifier}`;
    anchor.role = 'tab';
    anchor.dataset.toggle = 'tab';
    anchor.ariaControls = identifier;
    anchor.textContent = title;
    item.append(anchor);
    tabs.append(item);
  }

  if (!body) {
    const pane = document.createElement('div');
    pane.id = identifier;
    pane.className = 'tab-pane';
    pane.role = 'tabpanel';

    const settings = document.createElement('div');
    settings.className = 'settings';
    body = document.createElement('div');
    body.className = 'settings-tab-body';
    settings.append(body);
    pane.append(settings);
    tabContent.append(pane);
  }

  return { anchor, body };
}

function addInfoText(parent, text) {
  if (!text) {
    return;
  }

  const info = document.createElement('span');
  info.className = 'text-muted';
  info.textContent = text;
  parent.append(info);
}

function settingInputId(option, index) {
  return `nilspe_setting_${option.key}_${index}`;
}

async function addBasicInput(body, option, index, type) {
  const group = document.createElement('div');
  group.className = 'form-group';
  const column = document.createElement('div');
  column.className = 'col-sm-6';
  const id = settingInputId(option, index);
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = option.label;
  const input = document.createElement('input');
  input.id = id;
  input.className = 'form-control';
  input.type = type;
  input.placeholder = option.placeholder ?? '';
  input.value = await GM.getValue(option.key, option.default ?? '');

  if (option.min !== undefined) {
    input.min = String(option.min);
  }

  if (option.max !== undefined) {
    input.max = String(option.max);
  }

  input.addEventListener('change', () => {
    const value = type === 'number' && input.value !== ''
      ? Number(input.value)
      : input.value;
    GM.setValue(option.key, value);
  });

  column.append(label, input);
  addInfoText(column, option.info);
  group.append(column);
  body.append(group);
}

async function addCheckboxInput(body, option, index) {
  const id = settingInputId(option, index);
  const label = document.createElement('label');
  label.className = 'check-box-label';
  label.htmlFor = id;
  const input = document.createElement('input');
  input.id = id;
  input.type = 'checkbox';
  input.className = 'form-check-input';
  input.checked = await GM.getValue(option.key, option.default ?? false);
  input.addEventListener('change', () => GM.setValue(option.key, input.checked));
  label.append(input, ` ${option.label}`);
  body.append(label, document.createElement('br'));
}

function parseStoredJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hotkeyLabel(config) {
  if (!config) {
    return '';
  }

  return [
    config.ctrlKey ? 'STRG' : '',
    config.altKey ? 'ALT' : '',
    config.metaKey ? 'META' : '',
    config.shiftKey ? 'UMSCHALT' : '',
    config.key ?? ''
  ].filter(Boolean).join(' + ');
}

async function addHotkeyInput(body, option, index) {
  const group = document.createElement('div');
  group.className = 'form-group';
  const column = document.createElement('div');
  column.className = 'col-sm-6';
  const id = settingInputId(option, index);
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = option.label;
  const input = document.createElement('input');
  input.id = id;
  input.className = 'form-control';
  input.type = 'text';
  input.readOnly = true;
  const stored = await GM.getValue(option.key, JSON.stringify(option.default ?? null));
  input.value = hotkeyLabel(parseStoredJson(stored, option.default ?? null));

  input.addEventListener('keydown', async event => {
    event.preventDefault();

    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      return;
    }

    const config = {
      key: event.key.toUpperCase(),
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    };
    input.value = hotkeyLabel(config);
    await GM.setValue(option.key, JSON.stringify(config));
    input.blur();
  });

  column.append(label, input);
  addInfoText(column, option.info);
  group.append(column);
  body.append(group);
}

const nilspeOptionListCache = new Map();

async function loadOptionListFor(selectType) {
  if (!selectType) {
    return [];
  }

  const db = await openDb();

  try {
    if (selectType === 'vehicle_types') {
      await updateVehicleTypes(db);
      return (await getAllData(db, 'vehicleTypes'))
        .map(item => ({ name: item.caption, value: item.id }));
    }

    if (selectType === 'building_types') {
      await updateBuildingTypes(db);
      return (await getAllData(db, 'buildingTypes'))
        .map(item => ({ name: item.caption, value: item.id }));
    }

    if (selectType.startsWith('missions')) {
      await updateMissions(db);
      const missions = await getAllData(db, 'missions');
      const unique = new Map();

      for (const mission of missions) {
        const isGuard = Boolean(mission.additional?.duration);
        const isAlliance = Boolean(mission.additional?.only_alliance_mission);

        if (selectType === 'missions_normal' && (isGuard || isAlliance)) {
          continue;
        }

        if (selectType === 'missions_sw' && !isGuard) {
          continue;
        }

        if (!unique.has(mission.base_mission_id)) {
          unique.set(mission.base_mission_id, {
            name: `${mission.name} (ID: ${mission.base_mission_id})`,
            value: mission.base_mission_id
          });
        }
      }

      return [...unique.values()];
    }

    await updateBuildings(db);

    const buildingTypesBySelect = {
      dispatch_centers: [7],
      bepo_buildings: [11],
      bepo_personnel_generating_buildings: [6, 11],
      police_buildings: [6, 19],
      police_personnel_generating_buildings: [6, 11, 19]
    };
    const buildingTypes = buildingTypesBySelect[selectType];
    let buildings;

    if (buildingTypes) {
      buildings = (
        await Promise.all(
          buildingTypes.map(buildingType =>
            getDataByIndex(db, 'buildings', 'building_type', buildingType)
          )
        )
      ).flat();
    } else {
      buildings = await getAllData(db, 'buildings');
    }

    if (selectType === 'mission_generating_buildings') {
      buildings = buildings.filter(building =>
        building.generates_mission_categories?.length
      );
    }

    return buildings.map(building => ({
      name: building.caption,
      value: building.id
    }));
  } finally {
    db.close();
  }
}

async function optionListFor(selectType) {
  if (!selectType) {
    return [];
  }

  if (!nilspeOptionListCache.has(selectType)) {
    const request = loadOptionListFor(selectType).catch(error => {
      nilspeOptionListCache.delete(selectType);
      throw error;
    });
    nilspeOptionListCache.set(selectType, request);
  }

  return nilspeOptionListCache.get(selectType);
}

async function addSelectInput(body, option, index) {
  const container = document.createElement('div');
  const group = document.createElement('div');
  group.className = 'form-group';
  const column = document.createElement('div');
  column.className = 'col-sm-6';
  const id = settingInputId(option, index);
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = option.label;
  const select = document.createElement('select');
  select.id = id;
  select.className = 'selectpicker select form-control';
  select.multiple = option.multiple ?? false;
  select.title = option.title ?? '';
  select.dataset.liveSearch = 'true';
  select.dataset.actionsBox = 'true';
  select.dataset.container = 'body';

  const options = option.options ?? await optionListFor(option.selectType);
  const stored = parseStoredJson(await GM.getValue(option.key, '[]'), []);
  const storedValues = Array.isArray(stored) ? stored : [stored];
  const storedValueSet = new Set(storedValues.map(String));

  for (const item of options) {
    const element = document.createElement('option');
    element.value = String(item.value);
    element.dataset.value = JSON.stringify(item.value);
    element.textContent = item.name;
    element.disabled = item.disabled ?? false;
    element.selected = storedValueSet.has(String(item.value));
    select.append(element);
  }

  const saveSelection = () => {
    const values = [...select.selectedOptions].map(element =>
      parseStoredJson(element.dataset.value, element.value)
    );
    return GM.setValue(option.key, JSON.stringify(values));
  };

  select.addEventListener('change', saveSelection);

  column.append(label, select);
  addInfoText(column, option.info);
  group.append(column);
  container.append(group);
  body.append(container);

  const pageJQuery = typeof unsafeWindow !== 'undefined'
    ? unsafeWindow.$
    : globalThis.$;
  const picker = typeof pageJQuery === 'function'
    ? pageJQuery(select)
    : null;

  if (picker && typeof picker.selectpicker === 'function') {
    container.className = 'select-container';
    picker.selectpicker();
    picker.on('changed.bs.select', saveSelection);
  } else {
    select.className = 'form-control';

    if (select.multiple) {
      select.size = Math.min(Math.max(options.length, 4), 10);
    }
  }
}

async function addOptions(configuration) {
  if (!await waitForSettingsDom()) {
    console.error('[NilsPe LSS Core] Settings DOM was not found.');
    return;
  }

  const { anchor, body } = createSettingsPane(
    configuration.identifier,
    configuration.title
  );
  let renderPromise = null;

  const render = () => {
    if (renderPromise) {
      return renderPromise;
    }

    renderPromise = (async () => {
      body.replaceChildren();

      for (const [index, option] of configuration.settings.entries()) {
        if (option.type === 'header') {
          const tag = /^h[1-6]$/.test(option.header) ? option.header : 'h2';
          const heading = document.createElement(tag);
          heading.textContent = option.text;
          body.append(heading);
        } else if (option.type === 'checkbox') {
          await addCheckboxInput(body, option, index);
        } else if (option.type === 'select') {
          await addSelectInput(body, option, index);
        } else if (option.type === 'hotkey') {
          await addHotkeyInput(body, option, index);
        } else if (['text', 'number', 'time'].includes(option.type)) {
          await addBasicInput(body, option, index, option.type);
        }
      }
    })().catch(error => {
      renderPromise = null;
      console.error(
        `[NilsPe LSS Core] Einstellungen ${configuration.identifier} konnten nicht geladen werden:`,
        error
      );
      throw error;
    });

    return renderPromise;
  };

  anchor.addEventListener('click', () => {
    void render().catch(() => {});
  });

  if (location.hash === `#${configuration.identifier}`) {
    await render();
    anchor.click();
  }
}


