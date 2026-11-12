// ==UserScript==
// @name         LSS Baumeister 2.0
// @namespace    nilspe.baumeister.2.0
// @version      2.12.0
// @license      MIT
// @author       NilsPe
// @description  Baupositionen planen, bearbeiten und speichern; Raster, Kreis und Polygon mit Bestand und Ausschlussflaechen.
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Baumeister-2.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Baumeister-2.user.js
// @match        https://*.leitstellenspiel.de/*
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// @require      https://unpkg.com/earcut@2.2.4/dist/earcut.min.js
// @require      https://unpkg.com/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js
// @grant        none
// ==/UserScript==

/* global L, earcut, polygonClipping, building_new_marker, building_new_dragend */

(function () {
  "use strict";

  const TYPE_PREFIXES = {
    0: "Feuerwache ",
    2: "Rettungswache ",
    4: "Krankenhaus ",
    6: "Polizeiwache ",
    7: "Leitstelle ",
    9: "THW-Ortsverband ",
    11: "Bepol ",
    12: "SEG ",
    13: "Polizeihubschrauber ",
    15: "Wasserrettung ",
    16: "JVA "
  };

  const TYPE_COLORS = {
    0: "red",
    2: "green",
    4: "magenta",
    6: "blue",
    7: "darkgray",
    9: "brown",
    11: "purple",
    12: "orange",
    13: "teal",
    15: "cyan",
    16: "blue"
  };

  const TYPE_COMBOS = {
    "": [],
    "FW + THW + SEG": [0, 9, 12],
    "BePol + Polizei": [11, 6],
    "FW + RD": [0, 2],
    "RDKL x10": Array(10).fill(20)
  };

  const GRID_SIZE_STORAGE_KEY = "lss_gitternetz_size_m";
  const CIRCLE_COUNT_STORAGE_KEY = "lss_kreis_count";
  const POLYGON_COUNT_STORAGE_KEY = "lss_polygon_count";
  const POLYGON_COUNT_MODE_STORAGE_KEY = "lss_polygon_count_mode";
  const DEFAULT_GRID_SIZE_M = 500;
  const SAVED_PLANS_STORAGE_KEY = "lss_baumeister_saved_plans_v1";
  const BUILD_TAB_STORAGE_KEY = "lss_baumeister_build_tab";

  let nameSuffixInput = null;
  let startNumberInput = null;
  let padLengthInput = null;
  let gridSizeInput = null;
  let rasterRowsInput = null;
  let rasterColsInput = null;
  let rasterTargetInput = null;
  let rasterExpandInput = null;
  let circleCountInput = null;
  let circleModeInput = null;
  let rectangleAnchorInput = null;
  let polygonCountInput = null;
  let polygonExistingInput = null;
  let polygonCountModeInput = null;
  let polygonMinDistanceInput = null;
  let polygonAreas = [];
  let polygonTargets = [];
  let polygonAreaSelect = null;
  let polygonTargetInput = null;
  let polygonModeInput = null;
  let polygonSpacingInput = null;
  let polygonDraft = null;
  let polygonLayer = null;
  let polygonMap = null;
  let polygonDrawingCleanup = null;
  let polygonBusy = false;
  let polygonRun = 0;
  let polygonUI = null;
  let exclusionPolygons = [];
  let drawingKind = "area";
  let exclusionSelect = null;
  let exclusionDeleteButton = null;
  let savedPlanNameInput = null;
  let savedPlanSelect = null;
  let planningHistory = [];
  let nextPlanId = 1;
  let nextSiteId = 1;
  let buildingBusy = false;
  let planHotkeyHandler = null;
  let planningPreview = null;
  let planningPreviewLayer = null;
  let planningPreviewMap = null;
  let planningPreviewHandles = [];

  let perKey = {};
  let planned = [];
  let previewMarkers = [];
  let statusBox = null;
  let legendBox = null;

  let controlCenters = [];
  let controlCentersPromise = null;
  let buildingsSnapshot = null;
  let buildingsLoadedAt = 0;
  let buildingsPromise = null;
  let buildingsRevision = 0;

  // --------------------------------------------------
  // Namensvergabe
  // --------------------------------------------------

  function parseSuffixRaw() {
    const raw = nameSuffixInput?.value.trim() || "";
    const match = raw.match(/^(.*?)(\d+)$/);

    if (match) {
      return {
        base: match[1].trim(),
        seedNum: parseInt(match[2], 10),
        seedPad: match[2].length
      };
    }

    return {
      base: raw,
      seedNum: null,
      seedPad: null
    };
  }

  function buildingNameFor(type) {
    const { base, seedNum, seedPad } = parseSuffixRaw();
    const key = type + "|" + base;

    const defaultStart = Math.max(
      1,
      parseInt(startNumberInput?.value ?? "1", 10) || 1
    );

    const defaultPad = Math.max(
      1,
      parseInt(padLengthInput?.value ?? "2", 10) || 2
    );

    if (!perKey[key]) {
      perKey[key] = {
        count: (seedNum ?? defaultStart) - 1,
        pad: seedPad ?? defaultPad
      };
    } else {
      if (
        seedNum !== null &&
        seedNum - 1 > perKey[key].count
      ) {
        perKey[key].count = seedNum - 1;
      }

      if (seedPad !== null) {
        perKey[key].pad = seedPad;
      }
    }

    perKey[key].count++;

    const number = String(perKey[key].count)
      .padStart(perKey[key].pad, "0");

    const prefix = TYPE_PREFIXES[type] || "Gebaeude ";

    return prefix + (base ? base + " " : "") + number;
  }

  // --------------------------------------------------
  // Abstände und Koordinaten
  // --------------------------------------------------

  function getGridSizeMeters() {
    const saved = Number(
      localStorage.getItem(GRID_SIZE_STORAGE_KEY)
    );

    return saved > 0 ? saved : DEFAULT_GRID_SIZE_M;
  }

  function setGridSizeMeters(value) {
    const size = Math.max(
      25,
      Number(value) || DEFAULT_GRID_SIZE_M
    );

    localStorage.setItem(
      GRID_SIZE_STORAGE_KEY,
      String(size)
    );

    if (gridSizeInput) {
      gridSizeInput.value = String(size);
    }
  }

  function metersToLatDegrees(meters) {
    return meters / 111320;
  }

  function metersToLngDegrees(meters, lat) {
    return meters / (
      111320 * Math.cos(lat * Math.PI / 180)
    );
  }

  function rasterCount(input, fallback) {
    const value = parseInt(
      input?.value ?? String(fallback),
      10
    );

    return Math.min(
      30,
      Math.max(1, value || fallback)
    );
  }

  class Coordinate {
    constructor(lat, lon) {
      this.latitude = lat;
      this.longitude = lon;
    }
  }

  // --------------------------------------------------
  // Leitstellen laden und zuordnen
  // --------------------------------------------------

  const BUILDING_PAGE_TIMEOUT_MS = 30000;

  async function fetchJsonWithTimeout(url, timeoutMs = BUILDING_PAGE_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal
      });

      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        error.retryable = [408, 429, 500, 502, 503, 504].includes(res.status);
        const retryAfter = res.headers?.get("Retry-After");
        if (retryAfter) {
          const delay = /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
          if (Number.isFinite(delay)) error.retryAfterMs = Math.max(0, delay);
        }
        throw error;
      }

      return await res.json();
    } catch (error) {
      if (controller.signal.aborted) {
        throw Object.assign(new Error(`Zeitlimit von ${timeoutMs / 1000} Sekunden ueberschritten`), { retryable: true });
      }
      if (["TypeError", "AbortError", "NetworkError"].includes(error.name)) {
        throw Object.assign(new Error("Netzwerkverbindung beim Laden unterbrochen"), { retryable: true });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchBuildingPage(url, page) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchJsonWithTimeout(url);
      } catch (error) {
        const delay = Math.max(1000, error.retryAfterMs || 0);
        if (!error.retryable || attempt > 0 || delay > BUILDING_PAGE_TIMEOUT_MS) {
          throw new Error(`Gebaeude-API, Seite ${page}: ${error.message}. Bitte erneut versuchen.`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  function buildingsFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.data)) return payload.data;
    throw new Error("Unerwartete Antwort der Gebaeude-API.");
  }

  async function loadAllBuildings() {
    const buildings = [];
    const seen = new Set();
    const visitedPages = new Set();

    let url = "/api/v2/buildings?limit=2000";

    while (url) {
      const pageUrl = new URL(url, window.location.origin);
      if (!/(^|\.)leitstellenspiel\.de$/.test(pageUrl.hostname) ||
        pageUrl.pathname !== "/api/v2/buildings") {
        throw new Error("Ungueltiger Folgelink der Gebaeude-API.");
      }
      url = pageUrl.pathname + pageUrl.search;
      if (visitedPages.has(url)) throw new Error("Wiederholte Seite der Gebaeude-API.");
      visitedPages.add(url);
      const payload = await fetchBuildingPage(url, visitedPages.size);

      for (const building of buildingsFromPayload(payload)) {
        const id = Number(building.id);

        if (!id || seen.has(id)) continue;

        seen.add(id);
        buildings.push(building);
      }

      url =
        payload?.paging?.next_page ||
        payload?.next_page ||
        null;

    }

    return buildings;
  }

  async function getBuildings() {
    if (buildingsSnapshot && Date.now() - buildingsLoadedAt < 60000) return buildingsSnapshot;
    if (!buildingsPromise) {
      const revision = buildingsRevision;
      const request = loadAllBuildings().then(buildings => {
        if (revision === buildingsRevision) {
          buildingsSnapshot = buildings;
          buildingsLoadedAt = Date.now();
          controlCenters = buildings.filter(b => Number(b.building_type) === 7);
        }
        return buildings;
      }).finally(() => { if (buildingsPromise === request) buildingsPromise = null; });
      buildingsPromise = request;
    }
    return buildingsPromise;
  }

  async function initControlCenters() {
    try {
      await getBuildings();

      console.info(
        `Baumeister: ${controlCenters.length} Leitstellen geladen.`
      );
    } catch (error) {
      controlCenters = [];

      console.warn(
        "Baumeister: Leitstellen konnten nicht geladen werden.",
        error
      );
    }
  }

  function ensureControlCenters() {
    controlCentersPromise ??= initControlCenters();
    return controlCentersPromise;
  }

  function deg2rad(value) {
    return value * Math.PI / 180;
  }

  function distKm(a, b) {
    const R = 6371;

    const dLat = deg2rad(
      b.latitude - a.latitude
    );

    const dLon = deg2rad(
      b.longitude - a.longitude
    );

    const A =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(a.latitude)) *
      Math.cos(deg2rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(
      Math.sqrt(A),
      Math.sqrt(1 - A)
    );
  }

  function nearestControlCenterId(coord) {
    let nearestId;
    let nearestDistance = Infinity;

    for (const controlCenter of controlCenters) {
      const distance = distKm(
        coord,
        new Coordinate(
          controlCenter.latitude,
          controlCenter.longitude
        )
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = controlCenter.id;
      }
    }

    return nearestId;
  }

  // --------------------------------------------------
  // Gebäude erstellen
  // --------------------------------------------------

  async function createBuilding() {
    const form = document.getElementById("new_building");

    if (!form) {
      throw new Error("Formular fehlt!");
    }

    const typeVal = document.getElementById(
      "building_building_type"
    )?.value;

    const formData = new FormData(form);

    if (typeVal === "0" || typeVal === "18") {
      formData.set(
        "building[start_vehicle]",
        "30"
      );
    }

    const url = typeVal === "16"
      ? "/alliance_buildings"
      : "/buildings";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-csrf-token": document.querySelector(
          'meta[name="csrf-token"]'
        )?.content,
        "x-requested-with": "XMLHttpRequest"
      },
      body: formData,
      credentials: "include"
    });

    const text = await res.text();

    const doc = new DOMParser().parseFromString(
      text,
      "text/html"
    );

    const alerts = doc.querySelectorAll(
      "span.label-danger"
    );

    if (alerts.length) {
      throw new Error(
        [...alerts]
          .map(a => a.textContent.trim())
          .join("\n")
      );
    }

    if (!res.ok) {
      throw new Error(
        "Gebaeude konnte nicht gebaut werden: HTTP " +
        res.status
      );
    }

    const match = text.match(/\/buildings\/(\d+)/);

    if (!match) {
      throw new Error("Gebaeude-ID nicht gefunden");
    }

    return match[1];
  }

  // --------------------------------------------------
  // Vorschau und Baupositionen
  // --------------------------------------------------

  function clonePlanData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function recordPlanningChange() {
    planningHistory.push(capturePlanState());
    if (planningHistory.length > 20) planningHistory.shift();
  }

  function rebuildPreviewMarkers() {
    previewMarkers.forEach(marker => window.map?.removeLayer(marker));
    previewMarkers = [];
    const seen = new Set();
    for (const item of planned) {
      item.id ??= nextPlanId++;
      item.siteId ??= nextSiteId++;
      if (seen.has(item.siteId)) continue;
      seen.add(item.siteId);
      addPreviewMarker(item);
    }
    updatePolygonUI();
  }

  function exclusionContains(point) {
    return exclusionPolygons.some(vertices => {
      const geometry = polygonGeometry(vertices);
      return geometry.contains(geometry.toXY(point));
    });
  }

  function movePlannedSite(siteId, point) {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null) return false;
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) >= 85 || Math.abs(point.lng) > 180 || exclusionContains(point)) {
      alert("Diese Position liegt ausserhalb gueltiger Koordinaten oder in einer Ausschlussflaeche.");
      return false;
    }
    const items = planned.filter(item => item.siteId === siteId);
    if (!items.length) return false;
    recordPlanningChange();
    for (const item of items) {
      item.lat = point.lat;
      item.lon = point.lng;
      if (item.autoLeitstelle) item.leitstelleId = nearestControlCenterId(new Coordinate(point.lat, point.lng));
    }
    renderStatus();
    return true;
  }

  function removePlannedItems(siteId, itemId = null) {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null) return;
    recordPlanningChange();
    planned = planned.filter(item => item.siteId !== siteId || (itemId !== null && item.id !== itemId));
    rebuildPreviewMarkers();
    renderStatus();
  }

  function addPreviewMarker(item) {
    if (!window.map) return;
    const color = TYPE_COLORS[item.type] || "gray";
    const marker = L.marker([item.lat, item.lon], {
      draggable: !buildingBusy,
      icon: L.divIcon({
        className: "lss-bm-preview",
        html: '<span style="display:block;width:14px;height:14px;border:2px solid ' + color +
          ';background:' + color + ';border-radius:50%;box-shadow:0 0 0 1px white;opacity:.85"></span>',
        iconSize: [14, 14], iconAnchor: [7, 7]
      }),
      zIndexOffset: 500
    }).addTo(window.map);
    marker.getElement().dataset.siteId = String(item.siteId);
    marker.bindPopup(() => {
      const host = document.createElement("div");
      host.style.overflowWrap = "anywhere";
      const items = planned.filter(p => p.siteId === item.siteId);
      for (const entry of items) {
        const row = document.createElement("div");
        row.style.marginBottom = "6px";
        const name = document.createElement("span");
        name.textContent = entry.name + " ";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-danger btn-xs";
        remove.textContent = "Entfernen";
        remove.title = "Dieses Gebaeude aus der Planung entfernen";
        remove.addEventListener("click", () => removePlannedItems(item.siteId, entry.id));
        row.append(name, remove);
        host.append(row);
      }
      if (items.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-danger btn-xs";
        remove.textContent = "Ganze Position entfernen";
        remove.addEventListener("click", () => removePlannedItems(item.siteId));
        host.append(remove);
      }
      L.DomEvent.disableClickPropagation(host);
      return host;
    });
    marker.on("dragend", () => {
      const point = marker.getLatLng();
      if (!movePlannedSite(item.siteId, point)) marker.setLatLng([item.lat, item.lon]);
    });
    previewMarkers.push(marker);
  }

  function undoLastPlanning() {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null || !planningHistory.length) return;
    const previous = planningHistory.pop();
    applyPlanState(previous, false, false);
  }

  function planAtPosition(lat, lng, type, combo, leitstelleId) {
    const types = combo && TYPE_COMBOS[combo]?.length ? TYPE_COMBOS[combo] : [type];
    const siteId = nextSiteId++;
    let first;
    for (const buildingType of types) {
      const item = {
        id: nextPlanId++, siteId, lat, lon: lng, type: buildingType, leitstelleId,
        autoLeitstelle: !document.getElementById("building_leitstelle_building_id")?.value,
        name: buildingNameFor(buildingType)
      };
      planned.push(item);
      first ??= item;
    }
    addPreviewMarker(first);
    return types.length;
  }

  function commitPositions(positions, type, combo, fixedLeitstelleId) {
    recordPlanningChange();
    let added = 0;
    for (const { lat, lng } of positions) {
      const leitstelleId = fixedLeitstelleId || nearestControlCenterId(new Coordinate(lat, lng));
      added += planAtPosition(lat, lng, type, combo, leitstelleId);
    }
    updatePolygonUI();
    return added;
  }

  // --------------------------------------------------
  // Rechteckiges Gitternetz
  // --------------------------------------------------

  function planningSettings() {
    const type = document.getElementById("building_building_type")?.value;
    if (type === undefined || type === "") throw new Error("Bitte einen Gebaeudetyp auswaehlen.");
    const combo = document.getElementById("building_combo_type")?.value;
    const rawDistance = polygonMinDistanceInput?.value?.trim() || "";
    const distance = rawDistance === "" ? null : Number(rawDistance);
    if (distance !== null && (!Number.isFinite(distance) || distance < 0)) {
      throw new Error("Bitte einen gueltigen Bestandsabstand eingeben.");
    }
    return {
      type, combo,
      fixedLeitstelleId: document.getElementById("building_leitstelle_building_id")?.value,
      existingMode: polygonExistingInput?.value || "off",
      countMode: polygonCountModeInput?.value || "new",
      distance,
      selectedTypes: new Set((TYPE_COMBOS[combo]?.length ? TYPE_COMBOS[combo] : [type]).map(Number))
    };
  }

  function planningCalculation(count, occupied, newCount, mode) {
    return mode === "total"
      ? `Soll ${count} gesamt - ${occupied} Bestand/Planung = ${newCount} neue Positionen`
      : `Soll ${count} zusaetzlich = ${newCount} neue Positionen`;
  }

  function gridPoint(anchor, row, col, spacing) {
    const lat = anchor.lat - metersToLatDegrees(row * spacing);
    return { lat, lng: anchor.lng + metersToLngDegrees(col * spacing, lat) };
  }

  function gridCandidates(shape, anchor, rows, cols, capacity, spacing, extend) {
    if (shape === "raster") {
      const factor = Math.sqrt(capacity / (rows * cols));
      const height = Math.max(rows, Math.ceil(rows * factor));
      const width = Math.max(cols, Math.ceil(cols * factor));
      const positions = [];
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
        positions.push(gridPoint(anchor, row, col, spacing));
      }
      const outline = [[-.5, -.5], [-.5, width - .5], [height - .5, width - .5], [height - .5, -.5]]
        .map(([row, col]) => gridPoint(anchor, row, col, spacing));
      return { positions, outline, northSouth: height * spacing, westEast: width * spacing,
        detail: height + "x" + width };
    }
    let positions;
    let center;
    let radius;
    if (extend) {
      const offsets = rectangleExtensionOffsets(rows, cols, rows * cols + capacity);
      positions = offsets.map(p => gridPoint(anchor, p.row, p.col, spacing));
      center = gridPoint(anchor, (rows - 1) / 2, (cols - 1) / 2, spacing);
      radius = (Math.max(Math.sqrt(offsets.at(-1).d2), Math.hypot((rows - 1) / 2, (cols - 1) / 2)) + .5) * spacing;
    } else {
      const offsets = circularGridOffsets(capacity);
      positions = offsets.map(p => gridPoint(anchor, -p.y, p.x, spacing));
      center = anchor;
      radius = (Math.sqrt(offsets.at(-1).d2) + .5) * spacing;
    }
    const outline = Array.from({ length: 96 }, (_, i) => {
      const angle = i * 2 * Math.PI / 96;
      const lat = center.lat + metersToLatDegrees(Math.sin(angle) * radius);
      return { lat, lng: center.lng + metersToLngDegrees(Math.cos(angle) * radius, lat) };
    });
    return { positions, outline, center, diameter: 2 * radius, detail: "Radius ca. " + (radius / 1000).toFixed(2) + " km" };
  }

  function evenlySelectGrid(points, count) {
    if (points.length === count) return points;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of points) {
      minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    }
    const spread = value => {
      value = (value | (value << 8)) & 0x00ff00ff;
      value = (value | (value << 4)) & 0x0f0f0f0f;
      value = (value | (value << 2)) & 0x33333333;
      return (value | (value << 1)) & 0x55555555;
    };
    const ordered = points.map(p => ({
      point: p,
      order: (spread(Math.round((p.lng - minLng) / (maxLng - minLng || 1) * 65535)) |
        (spread(Math.round((p.lat - minLat) / (maxLat - minLat || 1) * 65535)) << 1)) >>> 0
    })).sort((a, b) => a.order - b.order);
    return Array.from({ length: count }, (_, i) => ordered[Math.floor((i + .5) * ordered.length / count)].point);
  }

  async function calculateGridPreview(preview, run) {
    const { shape, settings, count, exclusions } = preview;
    const { rows, cols, spacing, extend, centerAnchor, allowExpansion } = preview.gridSettings;
    const anchor = { ...preview.anchor };
    if (extend && centerAnchor) {
      anchor.lat += metersToLatDegrees((rows - 1) / 2 * spacing);
      anchor.lng -= metersToLngDegrees((cols - 1) / 2 * spacing, preview.anchor.lat);
    }
    const virtual = [];
    if (extend) for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const p = gridPoint(anchor, row, col, spacing);
      virtual.push({ lat: p.lat, lon: p.lng, type: settings.type });
    }
    let capacity = shape === "raster" ? rows * cols : Math.max(1,
      extend && settings.countMode === "total" ? count - rows * cols : count);
    const initial = gridCandidates(shape, anchor, rows, cols, capacity, spacing, extend);
    setPreviewFootprint(preview, initial);
    const buildings = await previewBuildings(settings);
    if (run !== polygonRun) return null;
    for (let attempt = 0; attempt < 24; attempt++) {
      if (run !== polygonRun) return null;
      const grid = attempt === 0 ? initial : gridCandidates(shape, anchor, rows, cols, capacity, spacing, extend);
      let geometry;
      try { geometry = polygonGeometry(grid.outline, exclusions); }
      catch (error) {
        if (!allowExpansion || !error.message.startsWith("Keine ausreichend")) throw error;
      }
      if (geometry) {
        preview.outline = grid.outline;
        preview.center = grid.center;
        preview.measurements = footprintMeasurements(preview, { grid, geometry, positions: [] });
        const queued = (settings.existingMode === "off" ? [] : planned).concat(virtual);
        const occupied = polygonOccupiedSites(geometry, buildings, queued, settings.selectedTypes,
          extend && settings.existingMode === "off" ? "selected" : settings.existingMode);
        const occupiedCount = occupied.filter(p => geometry.contains(geometry.toXY(p))).length;
        const newCount = settings.countMode === "total" ? Math.max(0, count - occupiedCount) : count;
        if (!newCount) return { grid, geometry, positions: [], occupiedCount };
        const nearest = nearestPointIndex(occupied.map(geometry.toXY));
        const minimum = Math.max(1, settings.distance ?? spacing * .45);
        const free = grid.positions.filter(p => {
          const xy = geometry.toXY(p);
          return geometry.contains(xy) && nearest(xy) >= minimum * minimum;
        });
        if (free.length >= newCount) {
          return { grid, geometry, positions: evenlySelectGrid(free, newCount), occupiedCount };
        }
        if (!allowExpansion) throw new Error(`Nur ${free.length} freie Rasterplaetze fuer ${newCount} neue Positionen. Bitte Raster vergroessern oder Raster-Erweiterung aktivieren.`);
      }
      if (capacity >= 150000) throw new Error("Nicht genug freie Rasterplaetze gefunden. Bitte Abstand oder Ausschluesse anpassen.");
      capacity = Math.min(150000, Math.max(capacity + 1, Math.ceil(capacity * 1.5)));
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    throw new Error("Nicht genug freie Positionen gefunden.");
  }

  function planRasterFromCurrentMarker() {
    return openPlanningPreview("raster");
  }

  // --------------------------------------------------
  // Kreisförmiges Gitternetz
  // --------------------------------------------------

  function circularGridOffsets(count) {
    const range =
      Math.ceil(Math.sqrt(count / Math.PI)) + 3;

    const points = [];

    for (let y = -range; y <= range; y++) {
      for (let x = -range; x <= range; x++) {
        points.push({
          x,
          y,
          d2: x * x + y * y
        });
      }
    }

    points.sort(
      (a, b) =>
        a.d2 - b.d2 ||
        a.y - b.y ||
        a.x - b.x
    );

    const cutoff = points[count - 1].d2;

    const inside = points.filter(
      p => p.d2 < cutoff
    );

    const boundary = points.filter(
      p => p.d2 === cutoff
    );

    const needed = count - inside.length;

    boundary.sort(
      (a, b) =>
        Math.atan2(a.y, a.x) -
        Math.atan2(b.y, b.x)
    );

    const selected = [];

    if (needed >= boundary.length) {
      selected.push(...boundary);
    } else {
      const used = new Set();

      for (
        let i = 0;
        i < Math.floor(needed / 2);
        i++
      ) {
        const index = Math.floor(
          i * boundary.length / needed
        );

        for (const j of [
          index,
          (index + boundary.length / 2) %
            boundary.length
        ]) {
          if (!used.has(j)) {
            used.add(j);
            selected.push(boundary[j]);
          }
        }
      }

      if (selected.length < needed) {
        const candidate = boundary.find(
          p => !selected.includes(p)
        );

        if (candidate) {
          selected.push(candidate);
        }
      }
    }

    return [...inside, ...selected].sort(
      (a, b) =>
        a.d2 - b.d2 ||
        a.y - b.y ||
        a.x - b.x
    );
  }

  // Coordinates use the old rectangle's northwest marker as row/column zero.
  function rectangleExtensionOffsets(rows, cols, targetCount) {
    const missing = targetCount - rows * cols;
    if (missing <= 0) return [];

    const centerRow = (rows - 1) / 2;
    const centerCol = (cols - 1) / 2;
    let range = Math.ceil(Math.sqrt(targetCount / Math.PI)) +
      Math.max(rows, cols);

    // Expand until the search square contains every point within the cutoff.
    while (true) {
      const points = [];
      for (let row = -range; row < rows + range; row++) {
        for (let col = -range; col < cols + range; col++) {
          if (row >= 0 && row < rows && col >= 0 && col < cols) continue;
          const x = col - centerCol;
          const y = row - centerRow;
          points.push({ row, col, d2: x * x + y * y, angle: Math.atan2(y, x) });
        }
      }

      points.sort((a, b) => a.d2 - b.d2 || a.angle - b.angle);
      const cutoff = points[missing - 1]?.d2;
      const outsideDistance = Math.min(
        range + 1 + centerRow,
        range + 1 + centerCol
      );
      if (cutoff === undefined || cutoff >= outsideDistance ** 2) {
        range *= 2;
        continue;
      }

      const inside = points.filter(point => point.d2 < cutoff);
      const boundary = points.filter(point => point.d2 === cutoff);
      const needed = missing - inside.length;

      // Spread a partially filled outer ring evenly around the old area.
      for (let i = 0; i < needed; i++) {
        inside.push(boundary[Math.floor(i * boundary.length / needed)]);
      }
      return inside;
    }
  }

  function planCircleFromCurrentMarker() {
    return openPlanningPreview("circle");
  }

  // --------------------------------------------------
  // Polygon-Geometrie und gleichmaessige Verteilung
  // --------------------------------------------------

  function polygonGeometry(vertices, exclusions = []) {
    const rings = Array.isArray(vertices[0]) ? vertices : [vertices];
    if (rings.some(ring => ring.length < 3 || ring.length > 200)) {
      throw new Error("Bitte 3 bis 200 Eckpunkte setzen.");
    }
    const allVertices = rings.flat();
    if (!allVertices.every(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
      Math.abs(p.lat) < 85 && Math.abs(p.lng) <= 180)) {
      throw new Error("Das Polygon enthaelt ungueltige Koordinaten.");
    }
    const origin = allVertices[0];
    const referenceLat = allVertices.reduce((sum, p) => sum + p.lat, 0) / allVertices.length;
    const lngScale = 111320 * Math.cos(referenceLat * Math.PI / 180);
    const toXY = p => ({
      x: (p.lng - origin.lng) * lngScale,
      y: (p.lat - origin.lat) * 111320
    });
    const projectedRings = rings.map(ring => ring.map(toXY));
    const allPoints = projectedRings.flat();
    const longitudes = allVertices.map(p => p.lng);
    if (Math.max(...longitudes) - Math.min(...longitudes) > 180) {
      throw new Error("Bitte ein Gebiet ohne Ueberquerung der Datumsgrenze zeichnen.");
    }

    const cross = (a, b, c) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-7 &&
      p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7 &&
      p.y >= Math.min(a.y, b.y) - 1e-7 && p.y <= Math.max(a.y, b.y) + 1e-7;

    for (const points of projectedRings) for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      for (let j = i + 1; j < points.length; j++) {
        if (Math.hypot(a.x - points[j].x, a.y - points[j].y) < 0.001) {
          throw new Error("Eckpunkte duerfen nicht doppelt gesetzt werden.");
        }
      }
      const previous = points[(i + points.length - 1) % points.length];
      if (Math.abs(cross(previous, a, b)) < 1e-7 &&
        (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > 0) {
        throw new Error("Polygon-Kanten duerfen nicht aufeinander zuruecklaufen.");
      }
      for (let j = i + 1; j < points.length; j++) {
        if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
        const c = points[j];
        const d = points[(j + 1) % points.length];
        if ((cross(a, b, c) * cross(a, b, d) < 0 &&
          cross(c, d, a) * cross(c, d, b) < 0) ||
          onSegment(a, b, c) || onSegment(a, b, d) ||
          onSegment(c, d, a) || onSegment(c, d, b)) {
          throw new Error("Die Polygon-Kanten duerfen sich nicht kreuzen oder beruehren.");
        }
      }
    }

    if (typeof earcut !== "function") {
      throw new Error("Polygon-Bibliothek fehlt. Bitte das Userscript neu installieren.");
    }
    const excludedGeometries = exclusions.map(ring => polygonGeometry(ring));
    let parts = projectedRings.map(ring => [ring.map(p => [p.x, p.y])]);
    if (parts.length > 1 || exclusions.length) {
      if (typeof polygonClipping === "undefined") throw new Error("Bibliothek fuer Ausschlussflaechen fehlt. Bitte das Script komplett aktualisieren.");
      if (parts.length > 1) parts = polygonClipping.union(parts);
      if (exclusions.length) parts = polygonClipping.difference(parts, ...exclusions.map(ring => [ring.map(p => {
        const { x, y } = toXY(p);
        return [x, y];
      })]));
    }
    const triangles = [];
    let area = 0;
    for (const part of parts) {
      const { vertices: flat, holes, dimensions } = earcut.flatten(part);
      const indices = earcut(flat, holes, dimensions);
      if (earcut.deviation(flat, holes, dimensions, indices) > 1e-7) {
        throw new Error("Die freie Polygonflaeche konnte nicht berechnet werden.");
      }
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = indices.slice(i, i + 3).map(index => ({ x: flat[index * 2], y: flat[index * 2 + 1] }));
        const size = Math.abs(cross(a, b, c)) / 2;
        if (size <= 1e-10) continue;
        area += size;
        triangles.push({ a, b, c, cumulative: area });
      }
    }
    if (area < 0.01) {
      throw new Error("Keine ausreichend grosse freie Flaeche. Bitte Polygon und Ausschluesse pruefen.");
    }
    const boundsOf = points => ({
        minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y))
    });
    const regionBounds = projectedRings.map(boundsOf);
    const inRing = (p, points, { minX, maxX, minY, maxY }) => {
        if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[i];
          const b = points[j];
          if (onSegment(a, b, p)) return true;
          if ((a.y > p.y) !== (b.y > p.y) &&
            p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    };
    const toLatLng = p => ({ lat: origin.lat + p.y / 111320, lng: origin.lng + p.x / lngScale });
    return {
      area, triangles, bounds: boundsOf(allPoints), toXY, toLatLng,
      contains: p => {
        if (!projectedRings.some((ring, i) => inRing(p, ring, regionBounds[i]))) return false;
        if (!excludedGeometries.length) return true;
        const latLng = toLatLng(p);
        return !excludedGeometries.some(g => g.contains(g.toXY(latLng)));
      },
    };
  }

  function polygonOccupiedSites(geometry, buildings, queued, selectedTypes, mode) {
    if (mode === "off") return [];
    const sites = [];
    const cells = new Map();
    const add = (lat, lng) => {
      if (lat == null || lng == null || lat === "" || lng === "") return;
      lat = Number(lat);
      lng = Number(lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const point = geometry.toXY({ lat, lng });
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      // Buildings of a combination at the same site count as one position.
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if ((cells.get(`${x + dx},${y + dy}`) || []).some(p =>
            Math.hypot(p.x - point.x, p.y - point.y) < 1)) return;
        }
      }
      const key = `${x},${y}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(point);
      sites.push({ lat, lng });
    };
    for (const building of buildings) {
      if (mode === "all" || selectedTypes.has(Number(building.building_type))) {
        add(building.latitude, building.longitude);
      }
    }
    for (const item of queued) {
      if (mode === "all" || selectedTypes.has(Number(item.type))) add(item.lat, item.lon);
    }
    return sites;
  }

  // Fixed buildings are queried many times; a balanced spatial tree keeps
  // nearest-building lookups fast even with large accounts.
  function nearestPointIndex(points) {
    const build = (items, axis = 0) => {
      if (!items.length) return null;
      const key = axis ? "y" : "x";
      items.sort((a, b) => a[key] - b[key]);
      const middle = items.length >> 1;
      return {
        point: items[middle], key,
        left: build(items.slice(0, middle), 1 - axis),
        right: build(items.slice(middle + 1), 1 - axis)
      };
    };
    const root = build([...points]);
    return (point, excludePoint = null) => {
      let best = Infinity;
      const visit = node => {
        if (!node) return;
        if (node.point !== excludePoint) {
          best = Math.min(best, (point.x - node.point.x) ** 2 + (point.y - node.point.y) ** 2);
        }
        const difference = point[node.key] - node.point[node.key];
        visit(difference <= 0 ? node.left : node.right);
        if (difference ** 2 < best) visit(difference <= 0 ? node.right : node.left);
      };
      visit(root);
      return best;
    };
  }

  function radicalInverse(index, base) {
    let result = 0;
    let fraction = 1 / base;
    while (index > 0) {
      result += (index % base) * fraction;
      index = Math.floor(index / base);
      fraction /= base;
    }
    return result;
  }

  async function polygonPositions(vertices, count, options = {}) {
    if (!Number.isInteger(count) || count < 1 || count > 10000) {
      throw new Error("Bitte 1 bis 10.000 Polygon-Positionen eingeben.");
    }
    const geometry = polygonGeometry(vertices, options.exclusions || []);
    const { area, triangles, toLatLng, toXY, contains, bounds } = geometry;
    const occupied = (options.occupied || []).map(toXY).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const existingCount = occupied.filter(contains).length;
    const automaticDistance = 0.5 * Math.sqrt(area / (count + existingCount));
    const requestedDistance = options.minExistingDistance ?? automaticDistance;
    if (!Number.isFinite(requestedDistance) || requestedDistance < 0) {
      throw new Error("Bitte einen gueltigen Bestandsabstand in Metern eingeben.");
    }
    const existingDistance = Math.max(1, requestedDistance);
    const margin = Math.max(existingDistance, 2 * Math.sqrt(area / count));
    const nearby = occupied.filter(p => p.x >= bounds.minX - margin && p.x <= bounds.maxX + margin &&
      p.y >= bounds.minY - margin && p.y <= bounds.maxY + margin);
    const nearestExisting = nearestPointIndex(nearby);
    const checkCancelled = () => {
      if (options.cancelled?.()) throw new Error("Berechnung abgebrochen.");
    };
    const pause = () => new Promise(resolve => setTimeout(resolve, 0));
    checkCancelled();
    await pause();
    checkCancelled();

    // Area-weighted triangle samples also cover narrow and concave polygons.
    const candidates = [];
    const unique = new Set();
    const add = p => {
      const existingD2 = nearestExisting(p);
      if (existingD2 < existingDistance ** 2) return;
      const key = `${p.x},${p.y}`;
      if (!unique.has(key)) {
        unique.add(key);
        candidates.push({ ...p, existingD2 });
      }
    };
    for (const { a, b, c } of triangles) {
      add({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 });
    }
    const sampleCount = Math.max(256, count * 12);
    for (let i = 1; i <= sampleCount; i++) {
      const target = radicalInverse(i, 5) * area;
      let low = 0;
      let high = triangles.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (triangles[mid].cumulative < target) low = mid + 1;
        else high = mid;
      }
      const { a, b, c } = triangles[low];
      const u = Math.sqrt(radicalInverse(i, 2));
      const v = radicalInverse(i, 3);
      add({
        x: (1 - u) * a.x + u * (1 - v) * b.x + u * v * c.x,
        y: (1 - u) * a.y + u * (1 - v) * b.y + u * v * c.y
      });
    }
    if (candidates.length < count) {
      throw new Error("Zu wenig freie Flaeche mit diesem Bestandsabstand. Bitte den Abstand oder die Anzahl verringern.");
    }

    // Pick the candidate furthest from existing picks. A spatial hash and a
    // decrease-key heap avoid an all-pairs scan for every new position.
    const cellSize = Math.sqrt(area / (count + existingCount));
    const buckets = new Map();
    let centerX = 0;
    let centerY = 0;
    let previousArea = 0;
    for (const { a, b, c, cumulative } of triangles) {
      const weight = (cumulative - previousArea) / area;
      centerX += weight * (a.x + b.x + c.x) / 3;
      centerY += weight * (a.y + b.y + c.y) / 3;
      previousArea = cumulative;
    }
    let first = 0;
    let bestCenterDistance = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const p = candidates[i];
      const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
      const d2 = (p.x - centerX) ** 2 + (p.y - centerY) ** 2;
      if (d2 < bestCenterDistance) { first = i; bestCenterDistance = d2; }
    }
    const distances = new Float64Array(candidates.length);
    const heap = [];
    const locations = new Int32Array(candidates.length).fill(-1);
    const seed = candidates[first];
    for (let i = 0; i < candidates.length; i++) {
      if (!nearby.length && i === first) continue;
      distances[i] = nearby.length ? candidates[i].existingD2
        : (candidates[i].x - seed.x) ** 2 + (candidates[i].y - seed.y) ** 2;
      locations[i] = heap.length;
      heap.push(i);
    }
    const swap = (a, b) => {
      [heap[a], heap[b]] = [heap[b], heap[a]];
      locations[heap[a]] = a;
      locations[heap[b]] = b;
    };
    const down = start => {
      let i = start;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && distances[heap[child + 1]] > distances[heap[child]]) child++;
        if (distances[heap[i]] >= distances[heap[child]]) break;
        swap(i, child);
        i = child;
      }
    };
    for (let i = (heap.length >> 1) - 1; i >= 0; i--) down(i);
    const selected = nearby.length ? [] : [seed];
    let minSpacing = Infinity;
    let lastYield = Date.now();
    while (selected.length < count) {
      checkCancelled();
      const index = heap[0];
      const radius2 = distances[index];
      minSpacing = Math.min(minSpacing, Math.sqrt(radius2));
      const last = heap.pop();
      locations[index] = -1;
      if (heap.length) {
        heap[0] = last;
        locations[last] = 0;
        down(0);
      }
      const p = candidates[index];
      selected.push(p);
      const update = i => {
        if (locations[i] < 0) return;
        const d2 = (candidates[i].x - p.x) ** 2 + (candidates[i].y - p.y) ** 2;
        if (d2 < distances[i]) {
          distances[i] = d2;
          down(locations[i]);
        }
      };
      const radius = Math.sqrt(radius2);
      const left = Math.floor((p.x - radius) / cellSize);
      const right = Math.floor((p.x + radius) / cellSize);
      const bottom = Math.floor((p.y - radius) / cellSize);
      const top = Math.floor((p.y + radius) / cellSize);
      if ((right - left + 1) * (top - bottom + 1) > candidates.length) {
        for (let i = 0; i < candidates.length; i++) update(i);
      } else {
        for (let x = left; x <= right; x++) {
          for (let y = bottom; y <= top; y++) {
            for (const i of buckets.get(`${x},${y}`) || []) update(i);
          }
        }
      }
      if (Date.now() - lastYield > 16) {
        options.progress?.(selected.length, count);
        await pause();
        checkCancelled();
        lastYield = Date.now();
      }
    }
    checkCancelled();
    return { positions: selected.map(toLatLng), minSpacing, area, existingCount, existingDistance };
  }

  // --------------------------------------------------
  // Polygon auf der Karte zeichnen
  // --------------------------------------------------

  function updatePolygonUI() {
    if (!polygonUI) return;
    const drawing = polygonDraft !== null;
    const locked = polygonBusy || buildingBusy || !!planningPreview;
    polygonUI.draw.disabled = locked || drawing || polygonAreas.length >= 30;
    polygonUI.draw.textContent = polygonAreas.length ? "Gebiet hinzufuegen" : "Polygon zeichnen";
    polygonUI.plan.disabled = locked || drawing || !polygonAreas.length;
    polygonUI.clear.disabled = locked || drawing || !polygonAreas.length;
    polygonUI.clear.textContent = polygonAreas.length > 1 ? "Gebiet loeschen" : "Polygon loeschen";
    if (polygonAreaSelect) polygonAreaSelect.disabled = locked || drawing;
    if (polygonModeInput) {
      const fixedSpacing = polygonModeInput.value === "spacing";
      const individual = polygonModeInput.value === "individual";
      polygonUI.polygonCountWrapper.style.display = fixedSpacing || individual ? "none" : "flex";
      polygonUI.polygonSpacingWrapper.style.display = fixedSpacing ? "flex" : "none";
      polygonUI.polygonTargetWrapper.style.display = individual && polygonAreas.length ? "flex" : "none";
      polygonTargetInput.disabled = locked || drawing || !polygonAreas.length;
      polygonModeInput.disabled = locked || drawing;
      polygonSpacingInput.disabled = locked || drawing;
    }
    polygonUI.editRow.style.display = drawing ? "flex" : "none";
    polygonUI.undo.disabled = !polygonDraft?.length;
    polygonUI.finish.disabled = !polygonDraft || polygonDraft.length < 3;
    polygonCountInput.disabled = locked;
    if (polygonExistingInput) polygonExistingInput.disabled = locked;
    if (polygonCountModeInput) polygonCountModeInput.disabled = locked;
    if (polygonMinDistanceInput) polygonMinDistanceInput.disabled = locked || polygonExistingInput.value === "off";
    for (const button of polygonUI.otherButtons) button.disabled = drawing || locked;
    for (const tab of polygonUI.tabs || []) tab.disabled = drawing || locked;
    if (polygonUI.undoPlanning) polygonUI.undoPlanning.disabled = locked || drawing || !planningHistory.length;
    if (polygonUI.drawExclusion) polygonUI.drawExclusion.disabled = locked || drawing;
    if (exclusionDeleteButton) exclusionDeleteButton.disabled = locked || drawing || !exclusionPolygons.length;
    if (exclusionSelect) exclusionSelect.disabled = locked || drawing;
    for (const button of polygonUI.savedButtons || []) button.disabled = locked || drawing;
    if (polygonUI.reset) polygonUI.reset.disabled = buildingBusy;
    if (polygonUI.previewPanel) {
      polygonUI.previewPanel.hidden = !planningPreview;
      polygonUI.previewAccept.disabled = polygonBusy || !!planningPreview?.dragging || !planningPreview?.result?.positions.length;
    }
    for (const handle of planningPreviewHandles) {
      if (polygonBusy || buildingBusy) handle.dragging?.disable();
      else handle.dragging?.enable();
    }
    for (const marker of previewMarkers) {
      if (locked || drawing) marker.dragging?.disable();
      else marker.dragging?.enable();
    }
  }

  function renderPolygonShape() {
    if (polygonLayer && polygonMap) polygonMap.removeLayer(polygonLayer);
    polygonLayer = null;
    polygonMap = window.map;
    if (!polygonMap) return;
    polygonLayer = L.layerGroup().addTo(polygonMap);
    const draw = (vertices, excluded, draft = false, selected = false) => {
      if (!vertices.length) return;
      const coordinates = vertices.map(p => [p.lat, p.lng]);
      const options = { color: excluded ? "#d9534f" : "#00b8d9", weight: selected ? 4 : 2, interactive: false };
      if (vertices.length >= 3) {
        L.polygon(coordinates, { ...options, fillOpacity: excluded ? 0.18 : 0.06 }).addTo(polygonLayer);
      } else if (vertices.length === 2) {
        L.polyline(coordinates, options).addTo(polygonLayer);
      }
      if (draft) for (const point of coordinates) {
        L.circleMarker(point, { ...options, radius: 4, fillOpacity: 1 }).addTo(polygonLayer);
      }
    };
    if (planningPreview?.shape !== "polygon") {
      polygonAreas.forEach((vertices, i) => draw(vertices, false, false,
        polygonAreas.length > 1 && i === Number(polygonAreaSelect?.value)));
      if (polygonDraft !== null && drawingKind === "area") draw(polygonDraft, false, true);
    }
    exclusionPolygons.forEach(vertices => draw(vertices, true));
    if (polygonDraft !== null && drawingKind === "exclude") draw(polygonDraft, true, true);
  }

  function refreshPolygonAreaList(selected = Number(polygonAreaSelect?.value)) {
    if (!polygonAreaSelect) return;
    polygonAreaSelect.replaceChildren();
    polygonAreas.forEach((vertices, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = polygonAreaLabel(index, vertices);
      polygonAreaSelect.append(option);
    });
    if (polygonAreas.length) polygonAreaSelect.value = String(Math.min(selected || 0, polygonAreas.length - 1));
    polygonUI.polygonAreaWrapper.style.display = polygonAreas.length < 2 ? "none" : "flex";
    showSelectedPolygonTarget();
  }

  function polygonAreaLabel(index, vertices) {
    const target = polygonTargets[index];
    return polygonModeInput?.value === "individual"
      ? `Gebiet ${index + 1} | Soll: ${target ?? "-"}`
      : `Gebiet ${index + 1} (${vertices.length} Ecken)`;
  }

  function showSelectedPolygonTarget() {
    if (polygonTargetInput) polygonTargetInput.value = polygonTargets[Number(polygonAreaSelect?.value)] ?? "";
  }

  function refreshExclusionList() {
    if (!exclusionSelect) return;
    const value = exclusionSelect.value;
    exclusionSelect.replaceChildren();
    exclusionPolygons.forEach((ring, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = "Ausschluss " + (i + 1) + " (" + ring.length + " Ecken)";
      exclusionSelect.append(option);
    });
    if (!exclusionPolygons.length) {
      const option = document.createElement("option");
      option.textContent = "Keine Ausschlussflaeche";
      option.value = "";
      exclusionSelect.append(option);
    } else if (Number(value) < exclusionPolygons.length) exclusionSelect.value = value;
    updatePolygonUI();
  }

  function removeSelectedExclusion() {
    if (polygonBusy || buildingBusy || polygonDraft !== null || !exclusionPolygons.length) return;
    recordPlanningChange();
    exclusionPolygons.splice(Number(exclusionSelect.value), 1);
    refreshExclusionList();
    renderPolygonShape();
    renderStatus();
  }

  function endPolygonDrawing() {
    polygonDrawingCleanup?.();
    polygonDrawingCleanup = null;
    polygonDraft = null;
    renderPolygonShape();
    updatePolygonUI();
  }

  function finishPolygonDrawing() {
    if (!polygonDraft) return;
    try {
      polygonGeometry(polygonDraft);
      if (drawingKind === "exclude" && exclusionPolygons.length >= 30) throw new Error("Maximal 30 Ausschlussflaechen pro Planung.");
      if (drawingKind === "area" && polygonAreas.length >= 30) throw new Error("Maximal 30 Baugebiete pro Planung.");
      recordPlanningChange();
      if (drawingKind === "exclude") {
        const geometry = polygonGeometry(polygonDraft);
        exclusionPolygons.push(polygonDraft.map(p => ({ ...p })));
        planned = planned.filter(item => !geometry.contains(geometry.toXY({ lat: item.lat, lng: item.lon })));
        rebuildPreviewMarkers();
      } else {
        polygonAreas.push(clonePlanData(polygonDraft));
        polygonTargets.push(null);
        refreshPolygonAreaList(polygonAreas.length - 1);
      }
      endPolygonDrawing();
      refreshExclusionList();
      renderStatus(`<b>Baugebiete:</b> ${polygonAreas.length}, ${exclusionPolygons.length} Ausschlussflaechen. <b>Vorgemerkt:</b> ${planned.length}`);
    } catch (error) {
      alert(error.message);
    }
  }

  function undoPolygonVertex() {
    if (!polygonDraft) return;
    polygonDraft.pop();
    renderPolygonShape();
    updatePolygonUI();
  }

  function startPolygonDrawing(kind = "area") {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null) return;
    drawingKind = kind === "exclude" ? "exclude" : "area";
    const map = window.map;
    if (!map || typeof L === "undefined") {
      alert("Karte nicht gefunden.");
      return;
    }
    const container = map.getContainer();
    const cursor = container.style.cursor;
    const doubleClickEnabled = map.doubleClickZoom?.enabled();
    map.doubleClickZoom?.disable();
    container.style.cursor = "crosshair";
    polygonDraft = [];
    let pointerStart = null;
    let dragged = false;
    const pointerdown = event => {
      pointerStart = { x: event.clientX, y: event.clientY };
      dragged = false;
    };
    const pointermove = event => {
      if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) {
        dragged = true;
      }
    };
    const click = event => {
      if (event.button !== 0 || event.target.closest?.(".leaflet-control")) return;
      event.preventDefault();
      event.stopPropagation();
      // A double-click's second click must not create a duplicate vertex.
      if (event.detail > 1 || dragged) return;
      if (polygonDraft.length >= 200) {
        alert("Maximal 200 Eckpunkte pro Polygon.");
        return;
      }
      const point = map.mouseEventToLatLng(event);
      polygonDraft.push({ lat: point.lat, lng: point.lng });
      renderPolygonShape();
      updatePolygonUI();
    };
    const doubleClick = event => { event.preventDefault(); event.stopPropagation(); };
    const keydown = event => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable) return;
      if (!["Escape", "Enter", "Backspace"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") endPolygonDrawing();
      if (event.key === "Enter") finishPolygonDrawing();
      if (event.key === "Backspace") undoPolygonVertex();
    };
    container.addEventListener("click", click, true);
    container.addEventListener("dblclick", doubleClick, true);
    container.addEventListener("pointerdown", pointerdown, true);
    document.addEventListener("pointermove", pointermove, true);
    document.addEventListener("keydown", keydown, true);
    polygonDrawingCleanup = () => {
      container.removeEventListener("click", click, true);
      container.removeEventListener("dblclick", doubleClick, true);
      container.removeEventListener("pointerdown", pointerdown, true);
      document.removeEventListener("pointermove", pointermove, true);
      document.removeEventListener("keydown", keydown, true);
      container.style.cursor = cursor;
      if (doubleClickEnabled) map.doubleClickZoom.enable();
    };
    renderPolygonShape();
    updatePolygonUI();
  }

  function cancelPolygonCalculation() {
    if (planningPreview) {
      discardPlanningPreview();
      return;
    }
    polygonRun++;
    polygonBusy = false;
    updatePolygonUI();
  }

  function clearPolygon() {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null || !polygonAreas.length) return;
    recordPlanningChange();
    const index = Number(polygonAreaSelect?.value || 0);
    polygonAreas.splice(index, 1);
    polygonTargets.splice(index, 1);
    refreshPolygonAreaList();
    endPolygonDrawing();
    renderStatus();
  }

  async function previewBuildings(settings) {
    if (settings.existingMode === "off") return [];
    try { return await getBuildings(); }
    catch (error) { throw new Error("Bestand konnte nicht geladen werden: " + error.message); }
  }

  async function spacedPolygonPositions(areas, exclusions, occupied, spacing, existingDistance, cancelled) {
    const positions = [];
    const rowStep = spacing * Math.sqrt(3) / 2;
    let examined = 0;
    for (const area of areas) {
      if (cancelled()) return [];
      let geometry;
      try { geometry = polygonGeometry(area, exclusions); }
      catch (error) {
        if (error.message.startsWith("Keine ausreichend grosse freie Flaeche")) continue;
        throw error;
      }
      const { minX, maxX, minY, maxY } = geometry.bounds;
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      const nearby = (points, margin) => points.map(geometry.toXY).filter(p =>
        p.x >= minX - margin && p.x <= maxX + margin && p.y >= minY - margin && p.y <= maxY + margin);
      const minimum = Math.max(1, existingDistance);
      const nearestExisting = nearestPointIndex(nearby(occupied, minimum));
      const nearestOtherArea = nearestPointIndex(nearby(positions, spacing));
      const add = point => {
        if (nearestExisting(point) < minimum ** 2 || nearestOtherArea(point) < (spacing - .001) ** 2) return;
        positions.push(geometry.toLatLng(point));
        if (positions.length > 10000) throw new Error("Mehr als 10.000 Positionen. Bitte Wachenabstand vergroessern.");
      };
      let hasLatticePoint = false;
      const firstRow = Math.ceil((minY - midY) / rowStep);
      const lastRow = Math.floor((maxY - midY) / rowStep);
      for (let row = firstRow; row <= lastRow; row++) {
        // Stagger rows so all six nearest lattice neighbours have the same spacing.
        const xOffset = midX + (Math.abs(row) % 2) * spacing / 2;
        const firstCol = Math.ceil((minX - xOffset) / spacing);
        const lastCol = Math.floor((maxX - xOffset) / spacing);
        for (let col = firstCol; col <= lastCol; col++) {
          if (++examined > 250000) throw new Error("Zu viele Rasterpunkte. Bitte Wachenabstand vergroessern.");
          const point = { x: xOffset + col * spacing, y: midY + row * rowStep };
          if (geometry.contains(point)) {
            hasLatticePoint = true;
            add(point);
          }
          if (examined % 2000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
            if (cancelled()) return [];
          }
        }
      }
      if (!hasLatticePoint) {
        // A small or narrow area can fit one site between the lattice rows.
        let previous = 0;
        let largest = null;
        let size = 0;
        for (const triangle of geometry.triangles) {
          if (triangle.cumulative - previous > size) {
            size = triangle.cumulative - previous;
            largest = triangle;
          }
          previous = triangle.cumulative;
        }
        const { a, b, c } = largest;
        add({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 });
      }
    }
    return positions;
  }

  async function calculatePolygonPreview(preview, run) {
    const { areas, exclusions, settings, count, spacing, targets } = preview;
    const geometry = polygonGeometry(areas, exclusions);
    if (targets) {
      const rings = areas.map(ring => [ring.map(p => [p.lng, p.lat])]);
      for (let i = 0; i < rings.length; i++) for (let j = 0; j < i; j++) {
        if (polygonClipping.intersection(rings[i], rings[j]).length) {
          throw new Error(`Gebiet ${j + 1} und ${i + 1} ueberlappen. Bitte die Grenzen fuer einzelne Sollzahlen trennen.`);
        }
      }
    }
    preview.measurements = footprintMeasurements(preview, { geometry, positions: [] });
    showPreviewMeasurements(preview);
    const buildings = await previewBuildings(settings);
    if (run !== polygonRun) return null;
    const occupied = polygonOccupiedSites(geometry, buildings, planned, settings.selectedTypes, settings.existingMode);
    const occupiedCount = occupied.filter(p => geometry.contains(geometry.toXY(p))).length;
    if (spacing) {
      const positions = await spacedPolygonPositions(areas, exclusions, occupied, spacing,
        settings.distance ?? spacing, () => run !== polygonRun);
      return { geometry, positions, occupiedCount };
    }
    if (targets) {
      const assigned = new Set();
      const positions = [];
      const areaCounts = [];
      for (const [index, area] of areas.entries()) {
        try {
          preview.progress = `Gebiet ${index + 1} von ${areas.length} wird berechnet ...`;
          showPreviewMeasurements(preview);
          const local = polygonGeometry(area, exclusions);
          const existing = occupied.filter(p => !assigned.has(p) && local.contains(local.toXY(p)));
          existing.forEach(p => assigned.add(p));
          const target = targets[index];
          const newCount = settings.countMode === "total" ? Math.max(0, target - existing.length) : target;
          if (positions.length + newCount > 10000) throw new Error("Insgesamt sind maximal 10.000 neue Positionen pro Vorschau moeglich.");
          if (newCount) {
            const result = await polygonPositions(area, newCount, {
              occupied: occupied.concat(positions), minExistingDistance: settings.distance, exclusions,
              cancelled: () => run !== polygonRun
            });
            if (run !== polygonRun) return null;
            positions.push(...result.positions);
          }
          areaCounts.push({ target, occupied: existing.length, newCount });
        } catch (error) {
          throw new Error(`Gebiet ${index + 1}: ${error.message}`);
        }
      }
      return { geometry, positions, occupiedCount, areaCounts };
    }
    const newCount = settings.countMode === "total" ? Math.max(0, count - occupiedCount) : count;
    if (!newCount) return { geometry, positions: [], occupiedCount };
    const { positions } = await polygonPositions(areas, newCount, {
      occupied, minExistingDistance: settings.distance, exclusions,
      cancelled: () => run !== polygonRun,
      progress: (done, total) => {
        if (polygonUI?.previewSummary && run === polygonRun) {
          preview.progress = `${done}/${total} Positionen berechnet ...`;
          showPreviewMeasurements(preview);
        }
      }
    });
    return { geometry, positions, occupiedCount };
  }

  function meanNearestSpacing(positions, geometry) {
    if (positions.length < 2) return null;
    const points = positions.map(geometry.toXY);
    const nearest = nearestPointIndex(points);
    return points.reduce((sum, point) => sum + Math.sqrt(nearest(point, point)), 0) / points.length;
  }

  function footprintMeasurements(preview, result) {
    const { geometry, positions, grid } = result;
    const { bounds } = geometry;
    const grossArea = preview.exclusions.length ? polygonGeometry(preview.areas || preview.outline).area : geometry.area;
    return {
      northSouth: grid?.northSouth ?? bounds.maxY - bounds.minY,
      westEast: grid?.westEast ?? bounds.maxX - bounds.minX,
      diameter: grid?.diameter,
      area: grossArea,
      usableArea: geometry.area,
      averageSpacing: preview.shape === "raster" ? null : meanNearestSpacing(positions, geometry)
    };
  }

  const PREVIEW_NAMES = { raster: "Raster", circle: "Kreis", polygon: "Polygon" };

  function previewCalculation(preview, occupiedCount, newCount) {
    if (preview.targets) return `${newCount} neue Positionen in ${preview.areas.length} Baugebieten.`;
    if (preview.spacing) {
      return `Wachenabstand: ${preview.spacing.toLocaleString("de-DE")} m | ${newCount} neue Positionen, ${occupiedCount} Bestand/Planung`;
    }
    return newCount
      ? planningCalculation(preview.count, occupiedCount, newCount, preview.settings.countMode)
      : `Ziel ${preview.count} bereits erreicht (${occupiedCount} Bestands-/Planpositionen).`;
  }

  function showPreviewMeasurements(preview) {
    if (!polygonUI?.previewSummary) return;
    const summary = polygonUI.previewSummary;
    summary.replaceChildren();
    const addLine = text => {
      const row = document.createElement("div");
      row.textContent = text;
      summary.append(row);
    };
    const title = document.createElement("strong");
    title.textContent = PREVIEW_NAMES[preview.shape] + "-Vorschau";
    summary.append(title);
    if (preview.areas?.length > 1) addLine(`${preview.areas.length} Baugebiete`);
    if (preview.dragging) {
      addLine("Position wird angepasst ...");
      return;
    }
    const m = preview.result?.measurements || preview.measurements;
    const number = value => value.toLocaleString("de-DE", { maximumFractionDigits: value < .1 ? 4 : 2 });
    const km = metres => number(metres / 1000) + " km";
    const km2 = area => number(area / 1000000) + " km\u00b2";
    if (m) {
      if (preview.shape === "raster") {
        addLine(`Kanten: ${km(m.northSouth)} (N/S) x ${km(m.westEast)} (W/O)`);
      } else if (preview.shape === "circle") {
        addLine("Durchmesser: " + km(m.diameter));
      } else {
        addLine("Nord/Sued: " + km(m.northSouth) + " | West/Ost: " + km(m.westEast));
      }
      addLine("Flaeche: " + km2(m.area) +
        (m.area - m.usableArea > .01 ? " (nutzbar: " + km2(m.usableArea) + ")" : ""));
    }
    if (!preview.result) {
      addLine(preview.error || preview.progress || "Positionen werden berechnet ...");
      return;
    }
    const { positions, occupiedCount } = preview.result;
    if (preview.shape !== "raster") {
      addLine("Mittlerer Nachbarabstand: " + (m.averageSpacing === null ? "-" : km(m.averageSpacing)));
    }
    addLine(previewCalculation(preview, occupiedCount, positions.length));
    if (preview.result.areaCounts) {
      const breakdown = document.createElement("div");
      Object.assign(breakdown.style, { maxHeight: "132px", overflowY: "auto" });
      preview.result.areaCounts.forEach(({ target, occupied, newCount }, index) => {
        const line = document.createElement("div");
        line.textContent = `Gebiet ${index + 1}: ${planningCalculation(target, occupied, newCount, preview.settings.countMode)}`;
        breakdown.append(line);
      });
      summary.append(breakdown);
    }
  }

  function removePlanningPreviewLayer() {
    if (planningPreviewLayer && planningPreviewMap) planningPreviewMap.removeLayer(planningPreviewLayer);
    planningPreviewLayer = null;
    planningPreviewMap = null;
    planningPreviewHandles = [];
  }

  function renderPlanningPreview(preview) {
    removePlanningPreviewLayer();
    const map = window.map;
    if (!map || !preview.outline?.length || typeof L === "undefined") return;
    planningPreviewMap = map;
    planningPreviewLayer = L.layerGroup().addTo(map);
    const color = preview.error ? "#d9534f" : "#007f94";
    const outlines = (preview.areas || [preview.outline]).map(ring => L.polygon(ring, {
      color, weight: 2, dashArray: "6 4", fillOpacity: .08, interactive: false
    }).addTo(planningPreviewLayer));
    const dots = L.layerGroup().addTo(planningPreviewLayer);
    if (preview.result?.positions.length) {
      const renderer = L.canvas?.({ padding: .2 });
      if (renderer) renderer.addTo(planningPreviewLayer);
      for (const point of preview.result.positions) {
        L.circleMarker(point, { renderer, radius: 3, stroke: false,
          fillColor: color, fillOpacity: .65, interactive: false }).addTo(dots);
      }
    }
    const editableCorners = preview.shape === "polygon";
    const handles = editableCorners
      ? preview.areas.flatMap((ring, area) => ring.map((point, index) => ({ point, area, index })))
      : [{ point: preview.center || outlines[0].getBounds().getCenter(), area: 0, index: 0 }];
    handles.forEach(({ point, area, index }) => {
      const outline = outlines[area];
      const title = editableCorners ? `Gebiet ${area + 1}: Eckpunkt ${index + 1} verschieben` : PREVIEW_NAMES[preview.shape] + " verschieben";
      const size = editableCorners ? 14 : 26;
      const handle = L.marker(point, {
        draggable: !polygonBusy, title, alt: title, zIndexOffset: 2000,
        icon: L.divIcon({
          className: editableCorners ? "lss-bm-preview-corner" : "lss-bm-preview-move",
          iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: '<div style="display:grid;place-items:center;width:100%;height:100%;box-sizing:border-box;' +
            'border:2px solid white;border-radius:50%;background:#007f94;color:white;box-shadow:0 0 0 1px #007f94">' +
            (editableCorners ? "" : "&#10021;") + "</div>"
        })
      }).addTo(planningPreviewLayer);
      planningPreviewHandles.push(handle);
      const baseOutline = preview.outline;
      const offset = () => {
        const next = handle.getLatLng();
        return { lat: next.lat - point.lat, lng: next.lng - point.lng };
      };
      handle.on("dragstart", () => {
        preview.dragging = true;
        preview.result = null;
        preview.error = null;
        dots.clearLayers();
        showPreviewMeasurements(preview);
        updatePolygonUI();
      });
      handle.on("drag", () => {
        if (editableCorners) {
          const next = handle.getLatLng();
          preview.areas[area][index] = { lat: next.lat, lng: next.lng };
          outline.setLatLngs(preview.areas[area]);
        } else {
          const delta = offset();
          outline.setLatLngs(baseOutline.map(p => [p.lat + delta.lat, p.lng + delta.lng]));
        }
      });
      handle.on("dragend", () => {
        if (planningPreview !== preview) return;
        preview.dragging = false;
        if (editableCorners) {
          const next = handle.getLatLng();
          preview.areas[area][index] = { lat: next.lat, lng: next.lng };
          preview.outline = preview.areas.flat();
        } else {
          const delta = offset();
          preview.anchor = { lat: preview.anchor.lat + delta.lat, lng: preview.anchor.lng + delta.lng };
          preview.outline = baseOutline.map(p => ({ lat: p.lat + delta.lat, lng: p.lng + delta.lng }));
          preview.center = handle.getLatLng();
        }
        void refreshPlanningPreview(preview);
      });
    });
  }

  function setPreviewFootprint(preview, grid) {
    preview.outline = grid.outline;
    preview.center = grid.center;
    renderPlanningPreview(preview);
  }

  function framePlanningPreview(preview) {
    const map = window.map;
    if (preview.framed || !map || !preview.measurements || !preview.outline?.length) return;
    preview.framed = true;
    const bounds = L.latLngBounds(preview.outline);
    const nw = map.latLngToContainerPoint(bounds.getNorthWest());
    const se = map.latLngToContainerPoint(bounds.getSouthEast());
    // Zoom once if the footprint would be covered by the move handle or cut off.
    if (Math.max(se.x - nw.x, se.y - nw.y) < 90 || !map.getBounds().contains(bounds)) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17, animate: false });
    }
  }

  async function refreshPlanningPreview(preview) {
    if (planningPreview !== preview) return;
    const run = ++polygonRun;
    preview.error = null;
    preview.result = null;
    preview.measurements = null;
    preview.progress = null;
    polygonBusy = true;
    updatePolygonUI();
    showPreviewMeasurements(preview);
    try {
      const result = await (preview.shape === "polygon" ? calculatePolygonPreview(preview, run)
        : calculateGridPreview(preview, run));
      if (run !== polygonRun || !result) return;
      if (result.grid) {
        preview.outline = result.grid.outline;
        preview.center = result.grid.center;
      }
      result.measurements = footprintMeasurements(preview, result);
      preview.result = result;
    } catch (error) {
      if (run === polygonRun) preview.error = error.message;
    } finally {
      if (run === polygonRun) {
        polygonBusy = false;
        renderPlanningPreview(preview);
        framePlanningPreview(preview);
        showPreviewMeasurements(preview);
        updatePolygonUI();
        if (!preview.panelFramed) {
          preview.panelFramed = true;
          polygonUI?.previewPanel.scrollIntoView({ block: "nearest" });
        }
      }
    }
  }

  function openPlanningPreview(shape) {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null) return;
    try {
      const settings = planningSettings();
      const preview = { shape, settings, exclusions: clonePlanData(exclusionPolygons), lockedFields: new Map() };
      if (shape === "polygon") {
        preview.areas = clonePlanData(polygonAreas);
        if (!preview.areas.length) throw new Error("Bitte zuerst ein Polygon zeichnen.");
        preview.outline = preview.areas.flat();
        preview.count = Number(polygonCountInput.value);
        if (polygonModeInput?.value === "spacing") {
          preview.spacing = Number(polygonSpacingInput.value || getGridSizeMeters());
          if (!Number.isInteger(preview.spacing) || preview.spacing < 25 || preview.spacing > 50000) {
            throw new Error("Bitte 25 bis 50.000 m Wachenabstand eingeben.");
          }
        } else if (polygonModeInput?.value === "individual") {
          preview.targets = preview.areas.map((_, index) => {
            const value = polygonTargets[index];
            if (!Number.isInteger(value) || value < 1 || value > 10000) {
              throw new Error(`Bitte fuer Gebiet ${index + 1} eine Sollzahl von 1 bis 10.000 eingeben.`);
            }
            return value;
          });
        }
      } else {
        const anchor = window.building_new_marker?.getLatLng();
        if (!anchor) throw new Error("Marker nicht gefunden - bitte Baumenu oeffnen.");
        preview.anchor = { lat: anchor.lat, lng: anchor.lng };
        const rows = Number(rasterRowsInput?.value || 10);
        const cols = Number(rasterColsInput?.value || 10);
        if (![rows, cols].every(v => Number.isInteger(v) && v >= 1 && v <= 30)) {
          throw new Error("Bitte Zeilen und Spalten von 1 bis 30 eingeben.");
        }
        const spacing = getGridSizeMeters();
        if (!Number.isFinite(spacing) || spacing < 25) throw new Error("Bitte einen gueltigen Gitternetz-Abstand waehlen.");
        preview.gridSettings = { rows, cols, spacing,
          extend: shape === "circle" && circleModeInput?.value === "extend",
          centerAnchor: rectangleAnchorInput?.value === "center",
          allowExpansion: shape !== "raster" || !!rasterExpandInput?.checked };
        preview.count = shape === "raster" ? Number(rasterTargetInput?.value || rows * cols) : Number(circleCountInput?.value);
      }
      if (!preview.spacing && !preview.targets && (!Number.isInteger(preview.count) || preview.count < 1 || preview.count > 10000)) {
        throw new Error("Bitte 1 bis 10.000 Sollpositionen eingeben.");
      }
      planningPreview = preview;
      for (const id of SAVED_FIELD_IDS) {
        const field = document.getElementById(id);
        if (field) {
          preview.lockedFields.set(field, field.disabled);
          field.disabled = true;
        }
      }
      if (shape === "polygon") renderPolygonShape();
      const pending = refreshPlanningPreview(preview);
      if (shape === "polygon" && polygonBusy) renderPlanningPreview(preview);
      polygonUI?.previewPanel.scrollIntoView({ block: "nearest" });
      return pending;
    } catch (error) {
      if (planningPreview) discardPlanningPreview();
      alert(error.message);
    }
  }

  function discardPlanningPreview() {
    const preview = planningPreview;
    if (!preview) return;
    planningPreview = null;
    polygonRun++;
    polygonBusy = false;
    for (const [field, disabled] of preview.lockedFields) field.disabled = disabled;
    removePlanningPreviewLayer();
    if (preview.shape === "polygon") renderPolygonShape();
    updatePolygonUI();
  }

  function acceptPlanningPreview() {
    const preview = planningPreview;
    if (!preview?.result?.positions.length || preview.dragging || polygonBusy || buildingBusy) return false;
    const { positions, occupiedCount, grid } = preview.result;
    const { type, combo, fixedLeitstelleId } = preview.settings;
    const added = commitPositions(positions, type, combo, fixedLeitstelleId);
    if (preview.shape === "polygon") {
      polygonAreas = preview.areas;
      refreshPolygonAreaList();
      if (!preview.spacing && !preview.targets) localStorage.setItem(POLYGON_COUNT_STORAGE_KEY, String(preview.count));
    } else {
      window.building_new_marker?.setLatLng?.(preview.anchor);
      if (preview.shape === "circle") localStorage.setItem(CIRCLE_COUNT_STORAGE_KEY, String(preview.count));
    }
    discardPlanningPreview();
    renderStatus(`<b>Vorgemerkt:</b> ${planned.length} (+${added} Gebaeude an ${positions.length} ${PREVIEW_NAMES[preview.shape]}-Positionen${grid ? ", " + grid.detail : ""})<br>` +
      previewCalculation(preview, occupiedCount, positions.length));
    return true;
  }

  function planPolygon() {
    return openPlanningPreview("polygon");
  }

  // --------------------------------------------------
  // Planungen speichern, laden und zwischen Rechnern mitnehmen
  // --------------------------------------------------

  const SAVED_FIELD_IDS = [
    "building_building_type", "building_combo_type", "building_leitstelle_building_id",
    "custom_name_suffix", "custom_start_number", "custom_pad_length", "custom_grid_size",
    "custom_raster_rows", "custom_raster_cols", "custom_raster_target", "custom_raster_expand",
    "custom_circle_count", "custom_circle_mode", "custom_rectangle_anchor",
    "custom_polygon_count", "custom_polygon_count_mode", "custom_polygon_existing", "custom_polygon_distance",
    "custom_polygon_mode", "custom_polygon_spacing"
  ];

  function capturePlanState() {
    const settings = {};
    for (const id of SAVED_FIELD_IDS) {
      const field = document.getElementById(id);
      if (field) settings[id] = field.type === "checkbox" ? field.checked : field.value;
    }
    const anchor = window.building_new_marker?.getLatLng();
    return {
      format: "lss-baumeister-plan", version: 2, savedAt: new Date().toISOString(),
      settings, anchor: anchor ? { lat: anchor.lat, lng: anchor.lng } : null,
      polygons: clonePlanData(polygonAreas), exclusions: clonePlanData(exclusionPolygons),
      polygonTargets: polygonAreas.map((_, index) => polygonTargets[index] ?? null),
      planned: clonePlanData(planned), counters: clonePlanData(perKey)
    };
  }

  function validatePlanState(raw) {
    if (!raw || raw.format !== "lss-baumeister-plan" || ![1, 2].includes(raw.version) ||
      !Array.isArray(raw.planned) || raw.planned.length > 100000 ||
      !Array.isArray(raw.exclusions) || raw.exclusions.length > 30) {
      throw new Error("Ungueltige oder nicht unterstuetzte Planungsdatei.");
    }
    const areas = raw.version === 1 && Array.isArray(raw.polygon)
      ? (raw.polygon.length ? [raw.polygon] : []) : raw.polygons;
    if (!Array.isArray(areas) || areas.length > 30) throw new Error("Ungueltige Baugebiete in der Planung.");
    const targets = raw.polygonTargets ?? areas.map(() => null);
    if (!Array.isArray(targets) || targets.length !== areas.length ||
      !targets.every(value => value === null || (Number.isInteger(value) && value >= 1 && value <= 10000))) {
      throw new Error("Ungueltige Sollzahlen fuer die Baugebiete.");
    }
    const coordinate = p => {
      if (!p || typeof p.lat !== "number" || typeof p.lng !== "number" ||
        !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) >= 85 || Math.abs(p.lng) > 180) {
        throw new Error("Die Planung enthaelt ungueltige Koordinaten.");
      }
      return { lat: p.lat, lng: p.lng };
    };
    const ring = vertices => {
      if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 200) throw new Error("Ungueltige Gebietsgrenze.");
      const points = vertices.map(coordinate);
      polygonGeometry(points);
      return points;
    };
    const polygons = areas.map(ring);
    const exclusions = raw.exclusions.map(ring);
    const entries = raw.planned.map((item, index) => {
      const p = coordinate({ lat: item.lat, lng: item.lon });
      if (!Number.isInteger(Number(item.type)) || Number(item.type) < 0 || Number(item.type) > 2000 ||
        typeof item.name !== "string" || item.name.length > 500) throw new Error("Ungueltiger Gebaeudeeintrag.");
      return {
        lat: p.lat, lon: p.lng, type: Number(item.type), name: item.name,
        siteId: String(item.siteId ?? index) + ":" + p.lat + ":" + p.lng,
        autoLeitstelle: !!item.autoLeitstelle,
        leitstelleId: typeof item.leitstelleId === "number" || typeof item.leitstelleId === "string" ? item.leitstelleId : undefined
      };
    });
    const excludedGeometries = exclusions.map(vertices => polygonGeometry(vertices));
    if (entries.some(item => excludedGeometries.some(g => g.contains(g.toXY({ lat: item.lat, lng: item.lon }))))) {
      throw new Error("Die Planung enthaelt Positionen innerhalb einer Ausschlussflaeche.");
    }
    const settings = raw.version === 1 ? { custom_polygon_mode: "count", custom_polygon_spacing: "" } : {};
    const numeric = {
      custom_start_number: [0, 1e9], custom_pad_length: [1, 20], custom_grid_size: [25, 50000],
      custom_raster_rows: [1, 30], custom_raster_cols: [1, 30], custom_raster_target: [1, 10000],
      custom_circle_count: [1, 10000], custom_polygon_count: [1, 10000], custom_polygon_distance: [0, 1e7],
      custom_polygon_spacing: [25, 50000]
    };
    for (const id of SAVED_FIELD_IDS) {
      const value = raw.settings?.[id];
      if (value === undefined) continue;
      if (id === "custom_raster_expand") {
        if (typeof value !== "boolean") throw new Error("Ungueltige Raster-Einstellung.");
      } else if (typeof value !== "string" || value.length > 1000) throw new Error("Ungueltige Planungseinstellung.");
      const optionalEmpty = value === "" && (["custom_polygon_distance", "custom_polygon_spacing"].includes(id) ||
        (id === "custom_polygon_count" && ["spacing", "individual"].includes(raw.settings?.custom_polygon_mode)));
      if (numeric[id] && !optionalEmpty) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < numeric[id][0] || number > numeric[id][1] ||
          (id !== "custom_polygon_distance" && !Number.isInteger(number))) throw new Error("Ungueltiger Zahlenwert in der Planung.");
      }
      settings[id] = value;
    }
    const counters = Object.create(null);
    for (const [key, value] of Object.entries(raw.counters || {})) {
      if (key.length > 1100 || !value || !Number.isInteger(value.count) || value.count < 0 || value.count > 1e9 ||
        !Number.isInteger(value.pad) || value.pad < 1 || value.pad > 20) throw new Error("Ungueltige Namenszaehler.");
      counters[key] = { count: value.count, pad: value.pad };
    }
    return { polygons, targets: [...targets], exclusions, entries, settings, counters, anchor: raw.anchor ? coordinate(raw.anchor) : null };
  }

  function applyPlanState(raw, record = true, fitView = true) {
    if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null) throw new Error("Bitte die laufende Bearbeitung zuerst abschliessen.");
    const next = validatePlanState(raw);
    if (record) recordPlanningChange();
    const sites = new Map();
    planned = next.entries.map(item => {
      if (!sites.has(item.siteId)) sites.set(item.siteId, nextSiteId++);
      return { ...item, id: nextPlanId++, siteId: sites.get(item.siteId) };
    });
    perKey = next.counters;
    polygonAreas = next.polygons;
    polygonTargets = next.targets;
    exclusionPolygons = next.exclusions;
    for (const [id, value] of Object.entries(next.settings)) {
      const field = document.getElementById(id);
      if (!field) continue;
      if (field.type === "checkbox") field.checked = value;
      else if (field.tagName !== "SELECT" || [...field.options].some(option => option.value === value)) field.value = value;
    }
    for (const id of ["custom_grid_size", "custom_circle_mode", "custom_polygon_count_mode", "custom_raster_target"]) {
      document.getElementById(id)?.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const centerSelect = document.getElementById("building_leitstelle_building_id");
    const allowedCenters = new Set([...(centerSelect?.options || [])].map(option => option.value));
    for (const item of planned) if (centerSelect?.options && item.leitstelleId != null && !allowedCenters.has(String(item.leitstelleId))) {
      item.autoLeitstelle = true;
      item.leitstelleId = nearestControlCenterId(new Coordinate(item.lat, item.lon));
    }
    if (next.anchor) window.building_new_marker?.setLatLng(next.anchor);
    rebuildPreviewMarkers();
    refreshPolygonAreaList(0);
    renderPolygonShape();
    refreshExclusionList();
    const coordinates = polygonAreas.flat().concat(planned.map(p => ({ lat: p.lat, lng: p.lon })));
    if (fitView && coordinates.length && window.map && typeof L !== "undefined") {
      window.map.fitBounds(L.latLngBounds(coordinates), { padding: [24, 24], maxZoom: 14 });
    }
    renderStatus(`<b>Planung geladen:</b> ${planned.length} Gebaeude, ${exclusionPolygons.length} Ausschlussflaechen.`);
  }

  function readSavedPlans() {
    try {
      const value = JSON.parse(localStorage.getItem(SAVED_PLANS_STORAGE_KEY) || "[]");
      if (!Array.isArray(value)) throw new Error("Ungueltiger Planungsspeicher.");
      return value.filter(entry => typeof entry.name === "string" && entry.state);
    } catch (error) {
      console.warn("Baumeister: Gespeicherte Planungen konnten nicht gelesen werden.", error);
      return [];
    }
  }

  function refreshSavedPlanList(selected = savedPlanSelect?.value) {
    if (!savedPlanSelect) return;
    savedPlanSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Planung auswaehlen";
    savedPlanSelect.append(placeholder);
    for (const entry of readSavedPlans()) {
      const option = document.createElement("option");
      option.value = entry.name;
      option.textContent = entry.name;
      savedPlanSelect.append(option);
    }
    savedPlanSelect.value = selected || "";
  }

  function saveNamedPlan() {
    if (polygonBusy || buildingBusy || polygonDraft !== null) return;
    try {
      const name = savedPlanNameInput.value.trim();
      if (!name || name.length > 80) throw new Error("Bitte einen Planungsnamen mit 1 bis 80 Zeichen eingeben.");
      const state = capturePlanState();
      validatePlanState(state);
      const entries = readSavedPlans().filter(entry => entry.name !== name);
      entries.push({ name, state });
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(entries));
      refreshSavedPlanList(name);
      renderStatus("<b>Planung gespeichert.</b>");
    } catch (error) { alert("Speichern fehlgeschlagen: " + error.message); }
  }

  function loadNamedPlan() {
    try {
      const entry = readSavedPlans().find(item => item.name === savedPlanSelect.value);
      if (!entry) throw new Error("Bitte eine gespeicherte Planung auswaehlen.");
      applyPlanState(entry.state);
      savedPlanNameInput.value = entry.name;
    } catch (error) { alert(error.message); }
  }

  function deleteNamedPlan() {
    if (polygonBusy || buildingBusy || polygonDraft !== null || !savedPlanSelect.value) return;
    try {
      const entries = readSavedPlans().filter(item => item.name !== savedPlanSelect.value);
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(entries));
      refreshSavedPlanList();
    } catch (error) { alert("Loeschen fehlgeschlagen: " + error.message); }
  }

  function exportPlan() {
    if (polygonBusy || buildingBusy || polygonDraft !== null) return;
    try {
      const state = capturePlanState();
      validatePlanState(state);
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = (savedPlanNameInput.value.trim() || "Baumeister-Planung").replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { alert(error.message); }
  }

  async function importPlanFile(file) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Planungsdateien duerfen maximal 20 MB gross sein.");
      applyPlanState(JSON.parse(await file.text()));
    } catch (error) { alert("Import fehlgeschlagen: " + error.message); }
  }

  // --------------------------------------------------
  // Status und Zurücksetzen
  // --------------------------------------------------

  function resetPlans(record = true) {
    if (buildingBusy) return;
    if (record && planned.length) recordPlanningChange();
    cancelPolygonCalculation();
    if (polygonDraft !== null) endPolygonDrawing();
    planned = [];

    previewMarkers.forEach(
      marker => window.map?.removeLayer(marker)
    );

    previewMarkers = [];
    perKey = {};

    renderStatus();
    updatePolygonUI();
  }

  function renderLegend() {
    if (!legendBox) return;

    legendBox.innerHTML = "<b>Legende:</b><br>";

    const counts = {};

    planned.forEach(p => {
      counts[p.type] =
        (counts[p.type] || 0) + 1;
    });

    Object.keys(TYPE_COLORS).forEach(type => {
      const color = TYPE_COLORS[type];
      const name =
        TYPE_PREFIXES[type] || `Typ ${type}`;

      const count = counts[type]
        ? ` (${counts[type]})`
        : "";

      legendBox.innerHTML += `
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="
            width:14px;
            height:14px;
            background:${color};
            border:1px solid #000;
            display:inline-block;
          "></span>
          ${name}${count}
        </div>`;
    });
  }

  function renderStatus(message) {
    if (!statusBox) return;

    statusBox.innerHTML =
      message ||
      `<b>Vorgemerkt:</b> ${planned.length}`;

    renderLegend();
  }

  // --------------------------------------------------
  // Startfahrzeug und Bau-Queue
  // --------------------------------------------------

  function forceStartVehicle(type) {
    let tries = 0;

    const interval = setInterval(() => {
      let field = null;

      if (Number(type) === 0) {
        field = document.getElementById(
          "building_start_vehicle_feuerwache"
        );
      }

      if (Number(type) === 18) {
        field = document.getElementById(
          "building_start_vehicle_feuerwache_kleinwache"
        );
      }

      if (field) {
        field.value = 30;
        clearInterval(interval);
      }

      if (++tries > 10) {
        clearInterval(interval);
      }
    }, 100);
  }

  async function buildQueue() {
    if (planningPreview || buildingBusy || polygonBusy || polygonDraft !== null) return;
    if (planned.length === 0) {
      alert("Keine Positionen vorgemerkt!");
      return;
    }

    const total = planned.length;
    let success = 0;
    buildingBusy = true;
    planningHistory = [];
    updatePolygonUI();

    for (let i = 0; i < total; i++) {
      const {
        lat,
        lon,
        type,
        leitstelleId,
        name
      } = planned[i];

      try {
        if (window.building_new_marker) {
          building_new_marker.setLatLng([
            lat,
            lon
          ]);

          if (
            typeof building_new_dragend ===
            "function"
          ) {
            building_new_dragend();
          }
        }

        const select = document.getElementById(
          "building_building_type"
        );

        if (!select || ![...select.options].some(option => option.value === String(type))) {
          throw new Error("Dieser Gebaeudetyp ist im aktuellen Account nicht verfuegbar.");
        }
        if (select) {
          for (
            let j = 0;
            j < select.options.length;
            j++
          ) {
            if (
              select.options[j].value ===
              String(type)
            ) {
              select.selectedIndex = j;

              select.dispatchEvent(
                new Event("change", {
                  bubbles: true
                })
              );

              break;
            }
          }
        }

        forceStartVehicle(type);

        const nameInput = document.getElementById(
          "building_name"
        );

        if (nameInput) {
          nameInput.value = name;
        }

        const leitstelleInput =
          document.getElementById(
            "building_leitstelle_building_id"
          );

        if (leitstelleInput) {
          leitstelleInput.value =
            leitstelleId ?? "";
        }

        const id = await createBuilding();
        buildingsRevision++;
        buildingsSnapshot = null;
        buildingsPromise = null;
        success++;

        renderStatus(
          `<b>Gebaut:</b> ${success}/${total} ` +
          `(ID ${id})`
        );

        await new Promise(
          resolve => setTimeout(resolve, 400)
        );
      } catch (error) {
        console.error(
          "Baumeister: Fehler:",
          error
        );

        renderStatus(
          `<b>Fehler bei Gebäude ${i + 1}</b>`
        );
      }
    }

    alert(
      `Fertig. Erfolgreich gebaut: ${success}/${total}`
    );

    buildingBusy = false;
    resetPlans(false);
  }

  // --------------------------------------------------
  // Gebäudekombinationen
  // --------------------------------------------------

  function addComboDropdown() {
    const typeDropdown = document.getElementById(
      "building_building_type"
    );

    if (!typeDropdown) return;

    if (
      document.getElementById(
        "building_combo_type"
      )
    ) {
      return;
    }

    const comboSelect =
      document.createElement("select");

    comboSelect.id = "building_combo_type";
    comboSelect.className =
      "select required form-control";

    comboSelect.style.marginTop = "5px";

    for (const label in TYPE_COMBOS) {
      const option =
        document.createElement("option");

      option.value = label;
      option.textContent =
        label || "-- Keine Kombination --";

      comboSelect.appendChild(option);
    }

    typeDropdown.parentElement.appendChild(
      comboSelect
    );
  }

  // --------------------------------------------------
  // Benutzeroberfläche
  // --------------------------------------------------

  function addButtons() {
    const host = document.getElementById(
      "detail_16"
    )?.parentElement;

    if (!host) return;

    if (
      document.getElementById(
        "multi-build-plan-btn"
      )
    ) {
      return;
    }

    const nameInput = document.getElementById(
      "building_name"
    );

    if (nameInput) {
      nameInput.style.display = "none";
    }

    const nameLabel = document.querySelector(
      'label[for="building_name"]'
    );

    if (nameLabel) {
      nameLabel.style.display = "none";
    }

    // Einheitliches Layout aller Eingabefelder.
    // Labels haben eine feste Breite und schrumpfen nicht.

    function createField(
      labelText,
      input,
      id,
      tooltip = ""
    ) {
      const wrapper =
        document.createElement("div");

      wrapper.className = "form-group";

      Object.assign(wrapper.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        marginTop: "4px",
        marginBottom: "8px",
        boxSizing: "border-box"
      });

      const label =
        document.createElement("label");

      label.className = "control-label";
      label.htmlFor = id;
      label.textContent = labelText;

      if (tooltip) {
        label.title = tooltip;
      }

      Object.assign(label.style, {
        flex: "0 0 112px",
        width: "112px",
        minWidth: "112px",
        maxWidth: "112px",
        marginBottom: "0",
        whiteSpace: "nowrap"
      });

      input.id = id;

      Object.assign(input.style, {
        flex: "1 1 0",
        minWidth: "0",
        width: "100%",
        boxSizing: "border-box"
      });

      wrapper.append(label, input);

      return wrapper;
    }

    function createNumberInput(
      value,
      min,
      max
    ) {
      const input =
        document.createElement("input");

      input.type = "number";
      input.className = "form-control";
      input.value = String(value);
      input.min = String(min);

      if (max != null) {
        input.max = String(max);
      }

      return input;
    }

    // Namens-Suffix

    nameSuffixInput =
      document.createElement("input");

    nameSuffixInput.type = "text";
    nameSuffixInput.className = "form-control";

    const suffixWrapper = createField(
      "Namens-Suffix",
      nameSuffixInput,
      "custom_name_suffix"
    );

    // Startnummer

    startNumberInput =
      createNumberInput(1, 0);

    const startWrapper = createField(
      "Startnummer",
      startNumberInput,
      "custom_start_number"
    );

    // Nummerierung

    padLengthInput =
      createNumberInput(2, 1);

    padLengthInput.title =
      "1 = 1, 2 = 01, 3 = 001";

    const padWrapper = createField(
      "Nummerierung",
      padLengthInput,
      "custom_pad_length",
      padLengthInput.title
    );

    // Gitternetz-Abstand

    gridSizeInput =
      document.createElement("select");

    gridSizeInput.className = "form-control";

    [
      [100, "100 m"],
      [250, "250 m"],
      [500, "500 m"],
      [1000, "1 km"],
      [2000, "2 km"],
      [3000, "3 km"],
      [4000, "4 km"],
      [5000, "5 km"]
    ].forEach(([value, text]) => {
      const option =
        document.createElement("option");

      option.value = String(value);
      option.textContent = text;

      gridSizeInput.appendChild(option);
    });

    gridSizeInput.value =
      String(getGridSizeMeters());

    gridSizeInput.addEventListener(
      "change",
      () => setGridSizeMeters(
        gridSizeInput.value
      )
    );

    const gridWrapper = createField(
      "Gitternetz",
      gridSizeInput,
      "custom_grid_size"
    );

    // Rechteck-Raster

    const rasterInputs =
      document.createElement("div");

    Object.assign(rasterInputs.style, {
      display: "flex",
      gap: "6px",
      flex: "1 1 0",
      minWidth: "0",
      width: "100%"
    });

    rasterRowsInput =
      createNumberInput(10, 1, 30);
    rasterRowsInput.id = "custom_raster_rows";

    rasterRowsInput.title =
      "Zeilen nach Süden";

    rasterColsInput =
      createNumberInput(10, 1, 30);
    rasterColsInput.id = "custom_raster_cols";

    rasterColsInput.title =
      "Spalten nach Osten";

    for (const input of [
      rasterRowsInput,
      rasterColsInput
    ]) {
      Object.assign(input.style, {
        width: "50%",
        minWidth: "0",
        flex: "1 1 0"
      });
    }

    rasterInputs.append(
      rasterRowsInput,
      rasterColsInput
    );

    const rasterWrapper = createField(
      "Raster Marker",
      rasterInputs,
      "custom_raster_inputs"
    );
    rasterTargetInput = createNumberInput(100, 1, 10000);
    const rasterTargetWrapper = createField("Raster-Soll", rasterTargetInput, "custom_raster_target");
    let previousRasterSize = 100;
    const updateRasterSize = () => {
      const size = Number(rasterRowsInput.value) * Number(rasterColsInput.value);
      if (Number(rasterTargetInput.value) === previousRasterSize) rasterTargetInput.value = String(size);
      previousRasterSize = size;
    };
    rasterRowsInput.addEventListener("change", updateRasterSize);
    rasterColsInput.addEventListener("change", updateRasterSize);
    rasterTargetInput.addEventListener("change", () => {
      previousRasterSize = Number(rasterRowsInput.value) * Number(rasterColsInput.value);
    });
    rasterExpandInput = document.createElement("input");
    rasterExpandInput.type = "checkbox";
    const rasterExpandWrapper = createField("Raster erweitern", rasterExpandInput, "custom_raster_expand",
      "Bei Platzmangel das Raster ab dem Startpunkt nach Osten und Sueden erweitern");
    Object.assign(rasterExpandInput.style, { width: "auto", flex: "0 0 auto" });

    // Kreis-Sollanzahl

    circleCountInput = createNumberInput(
      localStorage.getItem(
        CIRCLE_COUNT_STORAGE_KEY
      ) || 144,
      1,
      10000
    );

    circleCountInput.step = "1";

    circleCountInput.title =
      "Positionen pro Gebäudeart; Kombinationen werden je Position komplett gebaut";

    const circleWrapper = createField(
      "Kreis-Soll",
      circleCountInput,
      "custom_circle_count",
      circleCountInput.title
    );

    circleModeInput = document.createElement("select");
    circleModeInput.className = "form-control";
    for (const [value, text] of [
      ["new", "Neuen Kreis planen"],
      ["extend", "Vorhandenes Rechteck ergaenzen"]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      circleModeInput.appendChild(option);
    }
    const circleModeWrapper = createField(
      "Kreis-Modus", circleModeInput, "custom_circle_mode"
    );

    rectangleAnchorInput = document.createElement("select");
    rectangleAnchorInput.className = "form-control";
    for (const [value, text] of [
      ["northwest", "Obere linke Wache (Nordwest)"],
      ["center", "Mittelpunkt des Altgebiets"]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      rectangleAnchorInput.appendChild(option);
    }
    const rectangleAnchorWrapper = createField(
      "Bau-Marker", rectangleAnchorInput, "custom_rectangle_anchor"
    );
    rectangleAnchorWrapper.hidden = true;
    rectangleAnchorWrapper.style.display = "none";

    // Buttons

    const btnRow =
      document.createElement("div");

    Object.assign(btnRow.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      marginBottom: "6px"
    });

    function makeButton(
      text,
      cssClass,
      id
    ) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = cssClass;
      button.textContent = text;

      if (id) {
        button.id = id;
      }

      return button;
    }

    const planBtn = makeButton(
      "Marker setzen",
      "btn btn-info",
      "multi-build-plan-btn"
    );

    const rasterBtn = makeButton(
      "Raster-Vorschau",
      "btn btn-warning"
    );

    const circleBtn = makeButton(
      "Kreis-Vorschau",
      "btn btn-warning"
    );

    const circleDimensions = document.createElement("div");
    let selectedTab = "circle";
    const updateCircleMode = () => {
      const extending = circleModeInput.value === "extend";
      rasterWrapper.querySelector("label").textContent = selectedTab === "circle" ? "Altgebiet Z/S" : "Raster Z/S";
      circleWrapper.querySelector("label").textContent = "Kreis-Soll";
      circleCountInput.title = extending
        ? "Sollzahl gemaess gemeinsamem Anzahl-Modus; das Altgebiet wird ausgespart"
        : "Positionen pro Gebaeudeart; Kombinationen werden je Position komplett gebaut";
      circleWrapper.querySelector("label").title = circleCountInput.title;
      rectangleAnchorWrapper.hidden = !extending;
      rectangleAnchorWrapper.style.display = extending ? "flex" : "none";
      circleDimensions.hidden = !extending;
      circleBtn.textContent = extending
        ? "Altgebiet-Vorschau" : "Kreis-Vorschau";
    };
    circleModeInput.addEventListener("change", updateCircleMode);

    const buildBtn = makeButton(
      "Alle Gebaeude bauen",
      "btn btn-success"
    );

    const resetBtn = makeButton(
      "Marker Zuruecksetzen",
      "btn btn-danger"
    );
    const undoPlanningBtn = makeButton("Rueckgaengig", "btn btn-default", "baumeister-undo");
    undoPlanningBtn.title = "Letzte Planung oder Markerbearbeitung rueckgaengig machen";
    undoPlanningBtn.addEventListener("click", undoLastPlanning);

    polygonCountInput = createNumberInput(
      localStorage.getItem(POLYGON_COUNT_STORAGE_KEY) || 200, 1, 10000
    );
    polygonCountInput.step = "1";
    const polygonCountWrapper = createField(
      "Polygon-Soll", polygonCountInput, "custom_polygon_count",
      "Gewuenschte Anzahl gemaess Anzahl-Modus; Kombinationen zaehlen je Standort als eine Position"
    );
    polygonModeInput = document.createElement("select");
    polygonModeInput.className = "form-control";
    for (const [value, text] of [["count", "Gemeinsame Sollzahl"], ["spacing", "Fester Wachenabstand"], ["individual", "Sollzahl je Gebiet"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      polygonModeInput.append(option);
    }
    polygonModeInput.addEventListener("change", () => {
      refreshPolygonAreaList();
      updatePolygonUI();
    });
    const polygonModeWrapper = createField("Polygon-Modus", polygonModeInput, "custom_polygon_mode");
    polygonSpacingInput = createNumberInput("", 25, 50000);
    polygonSpacingInput.placeholder = "Gitternetz-Abstand";
    const polygonSpacingWrapper = createField("Wachenabst. m", polygonSpacingInput, "custom_polygon_spacing",
      "Einheitlicher Abstand in allen Baugebieten; leer = Gitternetz-Abstand");
    polygonAreaSelect = document.createElement("select");
    polygonAreaSelect.className = "form-control";
    polygonAreaSelect.addEventListener("change", () => {
      showSelectedPolygonTarget();
      renderPolygonShape();
    });
    const polygonAreaWrapper = createField("Baugebiete", polygonAreaSelect, "custom_polygon_area");
    polygonTargetInput = createNumberInput("", 1, 10000);
    polygonTargetInput.addEventListener("input", () => {
      const index = Number(polygonAreaSelect.value);
      if (!polygonAreas[index]) return;
      polygonTargets[index] = polygonTargetInput.value === "" ? null : Number(polygonTargetInput.value);
      polygonAreaSelect.options[index].textContent = polygonAreaLabel(index, polygonAreas[index]);
    });
    const polygonTargetWrapper = createField("Gebiet-Soll", polygonTargetInput, "custom_polygon_area_target",
      "Sollzahl fuer das ausgewaehlte Gebiet; der Anzahl-Modus gilt je Gebiet");
    polygonExistingInput = document.createElement("select");
    polygonExistingInput.className = "form-control";
    for (const [value, text] of [
      ["selected", "Typ / Kombi"],
      ["all", "Alle eigenen Gebaeude"],
      ["off", "Ignorieren"]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      polygonExistingInput.appendChild(option);
    }
    const polygonExistingWrapper = createField(
      "Bestand", polygonExistingInput, "custom_polygon_existing"
    );
    polygonExistingInput.addEventListener("change", updatePolygonUI);
    polygonCountModeInput = document.createElement("select");
    polygonCountModeInput.className = "form-control";
    for (const [value, text] of [["new", "Zusaetzlich bauen"], ["total", "Gesamt auffuellen"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      polygonCountModeInput.appendChild(option);
    }
    const polygonCountModeWrapper = createField(
      "Anzahl-Modus", polygonCountModeInput, "custom_polygon_count_mode"
    );
    polygonCountModeInput.value = localStorage.getItem(POLYGON_COUNT_MODE_STORAGE_KEY) === "total" ? "total" : "new";
    const updateCountMode = () => {
      const total = polygonCountModeInput.value === "total";
      polygonCountModeInput.title = total
        ? "Bestand wird abgezogen: 144 vorhanden, Soll 200 = 56 neue Positionen"
        : "Bestand wird nicht abgezogen: 144 vorhanden, Soll 200 = 200 neue Positionen";
      polygonCountInput.title = polygonCountModeInput.title;
    };
    polygonCountModeInput.addEventListener("change", () => {
      localStorage.setItem(POLYGON_COUNT_MODE_STORAGE_KEY, polygonCountModeInput.value);
      updateCountMode();
    });
    updateCountMode();
    polygonMinDistanceInput = createNumberInput("", 0);
    polygonMinDistanceInput.placeholder = "Automatisch";
    polygonMinDistanceInput.step = "any";
    const polygonDistanceWrapper = createField(
      "Bestandsabst. m", polygonMinDistanceInput, "custom_polygon_distance",
      "Mindestabstand neuer Positionen zu Bestand und vorgemerkten Positionen in Metern; leer = automatisch"
    );
    const polygonRow = document.createElement("div");
    const polygonEditRow = document.createElement("div");
    for (const row of [polygonRow, polygonEditRow]) {
      Object.assign(row.style, {
        display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px"
      });
    }
    const polygonDrawBtn = makeButton("Polygon zeichnen", "btn btn-info", "baumeister-polygon-draw");
    const polygonPlanBtn = makeButton("Polygon-Vorschau", "btn btn-warning", "baumeister-polygon-plan");
    const polygonClearBtn = makeButton("Polygon loeschen", "btn btn-default", "baumeister-polygon-clear");
    const polygonUndoBtn = makeButton("Punkt zurueck", "btn btn-default", "baumeister-polygon-undo");
    const polygonFinishBtn = makeButton("Abschliessen", "btn btn-info", "baumeister-polygon-finish");
    const polygonCancelBtn = makeButton("Abbrechen", "btn btn-default", "baumeister-polygon-cancel");
    polygonRow.append(polygonDrawBtn, polygonPlanBtn, polygonClearBtn);
    polygonEditRow.append(polygonUndoBtn, polygonFinishBtn, polygonCancelBtn);
    polygonDrawBtn.addEventListener("click", () => startPolygonDrawing("area"));
    polygonPlanBtn.addEventListener("click", () => void planPolygon());
    polygonClearBtn.addEventListener("click", clearPolygon);
    polygonUndoBtn.addEventListener("click", undoPolygonVertex);
    polygonFinishBtn.addEventListener("click", finishPolygonDrawing);
    polygonCancelBtn.addEventListener("click", endPolygonDrawing);

    const previewPanel = document.createElement("div");
    previewPanel.id = "baumeister-shape-preview";
    previewPanel.hidden = true;
    Object.assign(previewPanel.style, { margin: "8px 0", padding: "8px 0", borderTop: "1px solid #777" });
    const previewSummary = document.createElement("div");
    previewSummary.style.marginBottom = "6px";
    previewSummary.setAttribute("aria-live", "polite");
    const previewActions = document.createElement("div");
    Object.assign(previewActions.style, { display: "flex", flexWrap: "wrap", gap: "6px" });
    const previewAccept = makeButton("Marker uebernehmen", "btn btn-success", "baumeister-preview-accept");
    const previewCancel = makeButton("Vorschau abbrechen", "btn btn-default", "baumeister-preview-cancel");
    previewAccept.addEventListener("click", acceptPlanningPreview);
    previewCancel.addEventListener("click", discardPlanningPreview);
    previewActions.append(previewAccept, previewCancel);
    previewPanel.append(previewSummary, previewActions);

    const exclusionSection = document.createElement("details");
    const exclusionSummary = document.createElement("summary");
    exclusionSummary.textContent = "Ausschlussflaechen";
    exclusionSection.append(exclusionSummary);
    exclusionSelect = document.createElement("select");
    exclusionSelect.id = "custom_exclusion_select";
    exclusionSelect.className = "form-control";
    exclusionSection.append(createField("Ausschluss", exclusionSelect, "custom_exclusion_select"));
    const exclusionDrawButton = makeButton("Ausschluss zeichnen", "btn btn-info", "baumeister-exclusion-draw");
    exclusionDeleteButton = makeButton("Ausschluss entfernen", "btn btn-default", "baumeister-exclusion-delete");
    exclusionDrawButton.addEventListener("click", () => startPolygonDrawing("exclude"));
    exclusionDeleteButton.addEventListener("click", removeSelectedExclusion);
    const exclusionRow = document.createElement("div");
    Object.assign(exclusionRow.style, { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" });
    exclusionRow.append(exclusionDrawButton, exclusionDeleteButton);
    exclusionSection.append(exclusionRow);

    const savedSection = document.createElement("details");
    const savedSummary = document.createElement("summary");
    savedSummary.textContent = "Planungen speichern / laden";
    savedSection.append(savedSummary);
    savedPlanNameInput = document.createElement("input");
    savedPlanNameInput.type = "text";
    savedPlanNameInput.maxLength = 80;
    savedPlanNameInput.className = "form-control";
    savedPlanSelect = document.createElement("select");
    savedPlanSelect.className = "form-control";
    savedPlanSelect.addEventListener("change", () => { savedPlanNameInput.value = savedPlanSelect.value; });
    savedSection.append(createField("Planungsname", savedPlanNameInput, "custom_saved_plan_name"),
      createField("Gespeichert", savedPlanSelect, "custom_saved_plan_select"));
    const saveButton = makeButton("Speichern", "btn btn-info", "baumeister-save");
    const loadButton = makeButton("Laden", "btn btn-default", "baumeister-load");
    const deleteButton = makeButton("Loeschen", "btn btn-default", "baumeister-delete-save");
    const exportButton = makeButton("JSON exportieren", "btn btn-default", "baumeister-export");
    const importButton = makeButton("JSON importieren", "btn btn-default", "baumeister-import");
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.id = "baumeister-import-file";
    importInput.accept = ".json,application/json";
    importInput.hidden = true;
    importInput.addEventListener("change", async () => {
      await importPlanFile(importInput.files?.[0]);
      importInput.value = "";
    });
    saveButton.addEventListener("click", saveNamedPlan);
    loadButton.addEventListener("click", loadNamedPlan);
    deleteButton.addEventListener("click", deleteNamedPlan);
    exportButton.addEventListener("click", exportPlan);
    importButton.addEventListener("click", () => importInput.click());
    const savedRow = document.createElement("div");
    Object.assign(savedRow.style, { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" });
    savedRow.append(saveButton, loadButton, deleteButton, exportButton, importButton, importInput);
    savedSection.append(savedRow);

    const tabList = document.createElement("div");
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", "Bauform");
    Object.assign(tabList.style, { display: "flex", gap: "4px", margin: "10px 0 8px" });
    const tabNames = [["circle", "Kreis"], ["raster", "Raster"], ["polygon", "Polygon"]];
    const tabs = new Map();
    const panels = new Map();
    for (const [key, label] of tabNames) {
      const tab = makeButton(label, "btn btn-default", `baumeister-tab-${key}`);
      tab.style.flex = "1 1 0";
      tab.style.minWidth = "0";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", `baumeister-panel-${key}`);
      const panel = document.createElement("div");
      panel.id = `baumeister-panel-${key}`;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      tabs.set(key, tab);
      panels.set(key, panel);
      tabList.append(tab);
      tab.addEventListener("click", () => selectBuildTab(key));
      tab.addEventListener("keydown", event => {
        const index = tabNames.findIndex(([name]) => name === key);
        const next = { ArrowLeft: (index + 2) % 3, ArrowRight: (index + 1) % 3, Home: 0, End: 2 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const nextKey = tabNames[next][0];
        selectBuildTab(nextKey);
        tabs.get(nextKey).focus();
      });
    }
    const rasterDimensions = document.createElement("div");
    panels.get("circle").append(circleModeWrapper, circleDimensions, rectangleAnchorWrapper, circleWrapper, circleBtn);
    panels.get("raster").append(rasterDimensions, rasterTargetWrapper, rasterExpandWrapper, rasterBtn);
    panels.get("polygon").append(polygonModeWrapper, polygonCountWrapper, polygonSpacingWrapper,
      polygonAreaWrapper, polygonTargetWrapper, polygonRow);

    function selectBuildTab(key, remember = true) {
      selectedTab = tabs.has(key) ? key : "circle";
      // Raster and old-area extension use the same input elements and saved values.
      (selectedTab === "circle" ? circleDimensions : rasterDimensions).append(rasterWrapper);
      for (const [name, tab] of tabs) {
        const active = name === selectedTab;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        tab.className = active ? "btn btn-info" : "btn btn-default";
        panels.get(name).hidden = !active;
      }
      updateCircleMode();
      if (remember) localStorage.setItem(BUILD_TAB_STORAGE_KEY, selectedTab);
    }

    const namingSection = document.createElement("details");
    const namingSummary = document.createElement("summary");
    namingSummary.textContent = "Benennung";
    namingSection.append(namingSummary, suffixWrapper, startWrapper, padWrapper);

    polygonUI = {
      draw: polygonDrawBtn, plan: polygonPlanBtn, clear: polygonClearBtn,
      undo: polygonUndoBtn, finish: polygonFinishBtn, editRow: polygonEditRow,
      otherButtons: [planBtn, rasterBtn, circleBtn, buildBtn],
      undoPlanning: undoPlanningBtn, drawExclusion: exclusionDrawButton, reset: resetBtn,
      previewPanel, previewSummary, previewAccept,
      polygonCountWrapper, polygonSpacingWrapper, polygonAreaWrapper, polygonTargetWrapper,
      tabs: [...tabs.values()],
      savedButtons: [saveButton, loadButton, deleteButton, exportButton, importButton]
    };
    refreshPolygonAreaList();
    refreshExclusionList();
    refreshSavedPlanList();
    selectBuildTab(localStorage.getItem(BUILD_TAB_STORAGE_KEY), false);
    updatePolygonUI();

    btnRow.append(
      planBtn,
      undoPlanningBtn,
      buildBtn,
      resetBtn
    );

    // Status und Legende

    statusBox =
      document.createElement("div");

    statusBox.style.marginTop = "8px";
    statusBox.style.color = "#fff";

    legendBox =
      document.createElement("div");

    legendBox.style.marginTop = "6px";
    legendBox.style.color = "#fff";

    // Alle Felder in der richtigen Reihenfolge

    host.append(
      gridWrapper,
      polygonCountModeWrapper,
      polygonExistingWrapper,
      polygonDistanceWrapper,
      namingSection,
      tabList,
      ...panels.values(),
      polygonEditRow,
      previewPanel,
      btnRow,
      exclusionSection,
      savedSection,
      statusBox,
      legendBox
    );

    renderStatus();

    // --------------------------------------------------
    // Button-Ereignisse
    // --------------------------------------------------

    planBtn.addEventListener("click", e => {
      e.preventDefault();
      if (planningPreview || polygonBusy || buildingBusy || polygonDraft !== null) return;

      if (!window.building_new_marker) {
        alert(
          "Marker nicht gefunden - bitte Baumenu oeffnen."
        );
        return;
      }

      const { lat, lng } =
        window.building_new_marker.getLatLng();

      const type = document.getElementById(
        "building_building_type"
      ).value;

      const combo = document.getElementById(
        "building_combo_type"
      )?.value;

      const leitstelleId =
        document.getElementById(
          "building_leitstelle_building_id"
        )?.value ||
        nearestControlCenterId(
          new Coordinate(lat, lng)
        );

      if (exclusionContains({ lat, lng })) {
        alert("Diese Position liegt in einer Ausschlussflaeche.");
        return;
      }
      recordPlanningChange();
      planAtPosition(
        lat,
        lng,
        type,
        combo,
        leitstelleId
      );

      renderStatus();
      updatePolygonUI();
    });

    rasterBtn.addEventListener(
      "click",
      e => {
        e.preventDefault();
        planRasterFromCurrentMarker();
      }
    );

    circleBtn.addEventListener(
      "click",
      e => {
        e.preventDefault();
        planCircleFromCurrentMarker();
      }
    );

    buildBtn.addEventListener(
      "click",
      e => {
        e.preventDefault();
        buildQueue();
      }
    );

    resetBtn.addEventListener(
      "click",
      e => {
        e.preventDefault();
        resetPlans();
      }
    );

    // Hotkeys

    if (planHotkeyHandler) document.removeEventListener("keydown", planHotkeyHandler);
    planHotkeyHandler = e => {
        if (planningPreview) {
          if (e.key === "Escape") { e.preventDefault(); discardPlanningPreview(); }
          return;
        }
        if (polygonDraft !== null || polygonBusy || buildingBusy) return;
        if (
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            e.target.tagName
          )
        ) {
          return;
        }

        if (
          e.key.toLowerCase() === "v" &&
          !e.repeat
        ) {
          planBtn.click();
        }

        if (
          e.key.toLowerCase() === "s" &&
          !e.repeat
        ) {
          buildBtn.click();
        }
    };
    document.addEventListener("keydown", planHotkeyHandler);
  }

  // --------------------------------------------------
  // Initialisierung
  // --------------------------------------------------

  function enhanceBuildWindow() {
    if (
      !document.getElementById("new_building")
    ) {
      if (polygonDraft !== null) endPolygonDrawing();
      if (planningPreview || polygonBusy) cancelPolygonCalculation();
      if (planHotkeyHandler) document.removeEventListener("keydown", planHotkeyHandler);
      planHotkeyHandler = null;
      return;
    }

    void ensureControlCenters();

    addComboDropdown();
    addButtons();
  }

  function main() {
    enhanceBuildWindow();

    const observer = new MutationObserver(
      () => enhanceBuildWindow()
    );

    observer.observe(
      document.getElementById("buildings") ||
        document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  main();
})();
