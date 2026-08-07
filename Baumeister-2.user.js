// ==UserScript==
// @name         Baumeister 2.0
// @namespace    bos-ernie.leitstellenspiel.de
// @version      2.3.1
// @license      BSD-3-Clause
// @author       BOS-Ernie & NilsPe
// @description  Mehrere Baupositionen vormerken, benennen und kontrolliert nacheinander bauen.
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Baumeister-2.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Baumeister-2.user.js
// @match        https://*.leitstellenspiel.de/*
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* global building_new_marker, building_new_dragend, L */

(function () {
  "use strict";

  // --- Prefixes (Name-Basis) ---
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
    16: "JVA ",
  };

  // --- Farben fuer Marker + Legende ---
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
    16: "blue",
  };

  // --- Gebaeudekombinationen ---
  const TYPE_COMBOS = {
    "": [],
    "FW + THW + SEG": [0, 9, 12],
    "BePol + Polizei": [11, 6],
    "RDKL x10": [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
  };

  // --- Namens-Suffix + Zaehler ---
  let nameSuffixInput = null;
  let nameCounters = {};
  let startNumberInput = null;
  let padLengthInput = null;
  let gridSizeInput = null;
  let rasterRowsInput = null;
  let rasterColsInput = null;
  let perKey = {};
  const GRID_SIZE_STORAGE_KEY = "lss_gitternetz_size_m";
  const DEFAULT_GRID_SIZE_M = 500;

function parseSuffixRaw() {
  const raw = nameSuffixInput ? nameSuffixInput.value.trim() : "";
  const m = raw.match(/^(.*?)(\d+)$/); // "abcd 02" -> base="abcd", seed="02"
  if (m) return { base: m[1].trim(), seedNum: parseInt(m[2], 10), seedPad: m[2].length };
  return { base: raw, seedNum: null, seedPad: null };
}

function buildingNameFor(type) {
  const { base, seedNum, seedPad } = parseSuffixRaw();
  const key = type + "|" + base;

  // Defaults aus UI (falls gesetzt), sonst 1 bzw. 2
  const defaultStart = Math.max(1, parseInt(startNumberInput?.value ?? "1", 10) || 1);
  const defaultPad = Math.max(1, parseInt(padLengthInput?.value ?? "2", 10) || 2);

  if (!perKey[key]) {
    perKey[key] = {
      count: (seedNum ?? defaultStart) - 1,
      pad:   seedPad ?? defaultPad
    };
  } else {
    // Wenn Nutzer eine groessere Seed eingibt, hochsetzen; Pad ggf. aktualisieren
    if (seedNum !== null && seedNum - 1 > perKey[key].count) perKey[key].count = seedNum - 1;
    if (seedPad !== null) perKey[key].pad = seedPad;
  }

  perKey[key].count++;
  const number = String(perKey[key].count).padStart(perKey[key].pad, "0");
  const prefix = TYPE_PREFIXES[type] || "Gebaeude ";
  return prefix + (base ? base + " " : "") + number;
}

function getGridSizeMeters() {
  const saved = Number(localStorage.getItem(GRID_SIZE_STORAGE_KEY));
  return saved > 0 ? saved : DEFAULT_GRID_SIZE_M;
}


function setGridSizeMeters(value) {
  const size = Math.max(25, Number(value) || DEFAULT_GRID_SIZE_M);
  localStorage.setItem(GRID_SIZE_STORAGE_KEY, String(size));
  if (gridSizeInput) gridSizeInput.value = String(size);
}
function metersToLatDegrees(meters) {
  return meters / 111320;
}

function metersToLngDegrees(meters, lat) {
  return meters / (111320 * Math.cos((lat * Math.PI) / 180));
}

function rasterCount(input, fallback) {
  const value = parseInt(input?.value ?? String(fallback), 10);
  return Math.min(30, Math.max(1, value || fallback));
}

  // --- Hilfsfunktionen fuer Leitstellenwahl ---
  class Coordinate {
    constructor(lat, lon) {
      this.latitude = lat;
      this.longitude = lon;
    }
  }
  let controlCenters = [];
  let controlCentersPromise = null;

  async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function buildingsFromPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  async function getBuildings() {
    const buildings = [];
    const seen = new Set();
    let url = "/api/v2/buildings?limit=5000";

    for (let page = 0; url && page < 25; page++) {
      const payload = await fetchJsonWithTimeout(url);
      for (const building of buildingsFromPayload(payload)) {
        const id = Number(building.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        buildings.push(building);
      }

      url = payload?.paging?.next_page || payload?.next_page || null;
      if (url?.startsWith("https://www.leitstellenspiel.de")) {
        url = url.replace("https://www.leitstellenspiel.de", "");
      }
      if (url?.startsWith("https://polizei.leitstellenspiel.de")) {
        url = url.replace("https://polizei.leitstellenspiel.de", "");
      }
    }

    return buildings;
  }

  async function initControlCenters() {
    try {
      const buildings = await getBuildings();
      controlCenters = buildings.filter((b) => Number(b.building_type) === 7);
      console.info(`Baumeister: ${controlCenters.length} Leitstellen geladen.`);
    } catch (error) {
      controlCenters = [];
      console.warn("Baumeister: Leitstellen konnten nicht geladen werden. UI bleibt aktiv.", error);
    }
  }
  function ensureControlCenters() {
    controlCentersPromise ??= initControlCenters();
    return controlCentersPromise;
  }

  function deg2rad(d) {
    return d * Math.PI / 180;
  }
  function distKm(a, b) {
    const R = 6371,
      dLat = deg2rad(b.latitude - a.latitude),
      dLon = deg2rad(b.longitude - a.longitude);
    const A =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(a.latitude)) *
        Math.cos(deg2rad(b.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  }
  function nearestControlCenterId(coord) {
    let nearestId;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const controlCenter of controlCenters) {
      const distance = distKm(
        coord,
        new Coordinate(controlCenter.latitude, controlCenter.longitude)
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = controlCenter.id;
      }
    }

    return nearestId;
  }

// --- createBuilding wie im Original-Baumeister ---
async function createBuilding() {
  const form = document.getElementById("new_building");
  if (!form) throw new Error("Formular fehlt!");

  const typeVal = document.getElementById("building_building_type")?.value;

  // --- FormData erzeugen ---
  const formData = new FormData(form);
  if (typeVal === "0" || typeVal === "18") {
    formData.set("building[start_vehicle]", "30"); // HLF 20
  }

  // --- Ziel-URL je nach Typ ---
  let url = "/buildings";
  if (typeVal === "16") {
    // Polizeizellen / Verbandszellen
    url = "/alliance_buildings";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-csrf-token": document.querySelector('meta[name="csrf-token"]')?.content,
      "x-requested-with": "XMLHttpRequest"
    },
    body: formData,
    credentials: "include"
  });

  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const alerts = doc.querySelectorAll("span.label-danger");
  if (alerts.length) {
    throw new Error([...alerts].map(a => a.textContent.trim()).join("\n"));
  }
  if (!res.ok) {
    throw new Error("Gebaeude konnte nicht gebaut werden: HTTP " + res.status);
  }
  const m = text.match(/\/buildings\/(\d+)/);
  if (!m) throw new Error("Gebaeude-ID nicht gefunden");
  return m[1];
}





  // --- Queue + Marker + Status/Legende ---
  let planned = [];
  let previewMarkers = [];
  let statusBox = null;
  let legendBox = null;

  function addPreviewMarker(lat, lon, type) {
    if (!window.map) return;
    const color = TYPE_COLORS[type] || "gray";
    const m = L.circleMarker([lat, lon], {
      radius: 6,
      color,
      fillColor: color,
      fillOpacity: 0.7,
    }).addTo(window.map);
    previewMarkers.push(m);
  }
function planAtPosition(lat, lng, type, combo, leitstelleId) {
  let added = 0;

  if (combo && TYPE_COMBOS[combo]?.length) {
    TYPE_COMBOS[combo].forEach((ct) => {
      planned.push({
        lat,
        lon: lng,
        type: ct,
        leitstelleId,
        name: buildingNameFor(ct),
      });
      addPreviewMarker(lat, lng, ct);
      added++;
    });
  } else {
    planned.push({
      lat,
      lon: lng,
      type,
      leitstelleId,
      name: buildingNameFor(type),
    });
    addPreviewMarker(lat, lng, type);
    added++;
  }

  return added;
}

function planRasterFromCurrentMarker() {
  if (!window.building_new_marker) {
    alert("Marker nicht gefunden - bitte Baumenu oeffnen.");
    return;
  }

  const { lat, lng } = window.building_new_marker.getLatLng();
  const type = document.getElementById("building_building_type").value;
  const combo = document.getElementById("building_combo_type")?.value;
  const fixedLeitstelleId = document.getElementById("building_leitstelle_building_id")?.value;
  const rows = rasterCount(rasterRowsInput, 10);
  const cols = rasterCount(rasterColsInput, 10);
  const gridSizeM = getGridSizeMeters();
  const latStep = metersToLatDegrees(gridSizeM);
  let added = 0;

  for (let row = 0; row < rows; row++) {
    const markerLat = lat - row * latStep;
    const lngStep = metersToLngDegrees(gridSizeM, markerLat);

    for (let col = 0; col < cols; col++) {
      const markerLng = lng + col * lngStep;
      const leitstelleId = fixedLeitstelleId || nearestControlCenterId(new Coordinate(markerLat, markerLng));
      added += planAtPosition(markerLat, markerLng, type, combo, leitstelleId);
    }
  }

  renderStatus(`<b>Vorgemerkt:</b> ${planned.length} (+${added} per Raster ${rows}x${cols})`);
}

function resetPlans() {
  planned = [];
  previewMarkers.forEach(m => window.map?.removeLayer(m));
  previewMarkers = [];
  nameCounters = {};
  perKey = {}; // NEU
  renderStatus();
}


  function renderLegend() {
    if (!legendBox) return;
    legendBox.innerHTML = "<b>Legende:</b><br>";
    const counts = {};
    planned.forEach((p) => (counts[p.type] = (counts[p.type] || 0) + 1));

    Object.keys(TYPE_COLORS).forEach((t) => {
      const color = TYPE_COLORS[t];
      const name = TYPE_PREFIXES[t] || `Typ ${t}`;
      const count = counts[t] ? ` (${counts[t]})` : "";
      legendBox.innerHTML += `
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:14px;height:14px;background:${color};border:1px solid #000;display:inline-block"></span>
          ${name}${count}
        </div>`;
    });
  }
  function renderStatus(text) {
    if (!statusBox) return;
    statusBox.innerHTML = text || `<b>Vorgemerkt:</b> ${planned.length}`;
    renderLegend();
  }

// Hilfsfunktion fuers Startfahrzeug
function forceStartVehicle(type) {
  let tries = 0;
  const interval = setInterval(() => {
    let sf = null;
    if (Number(type) === 0) {
      sf = document.getElementById("building_start_vehicle_feuerwache");
    }
    if (Number(type) === 18) {
      sf = document.getElementById("building_start_vehicle_feuerwache_kleinwache");
    }
    if (sf) {
      sf.value = 30; // HLF 20
      clearInterval(interval);
    }
    if (++tries > 10) { // nach 10 Versuchen (ca. 1 Sekunde) abbrechen
      clearInterval(interval);
    }
  }, 100);
}

// --- Bau-Queue ---
async function buildQueue() {
  if (planned.length === 0) {
    alert("Keine Positionen vorgemerkt!");
    return;
  }
  const total = planned.length;
  let success = 0;

  for (let i = 0; i < total; i++) {
    const { lat, lon, type, leitstelleId, name } = planned[i];
    try {
      // Marker & Dragend
      if (window.building_new_marker) {
        building_new_marker.setLatLng([lat, lon]);
        if (typeof building_new_dragend === "function") building_new_dragend();
      }

      // Typ waehlen
      const sel = document.getElementById("building_building_type");
      if (sel) {
        for (let j = 0; j < sel.options.length; j++) {
          if (sel.options[j].value === String(type)) {
            sel.selectedIndex = j;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      }

      // Startfahrzeug ggf. setzen (robust mit Retry)
      forceStartVehicle(type);

      // Name & Leitstelle setzen
      const nameInput = document.getElementById("building_name");
      if (nameInput) nameInput.value = name;
      const leitstelleInput = document.getElementById("building_leitstelle_building_id");
      if (leitstelleInput) leitstelleInput.value = leitstelleId;

      // Bau absenden
      const id = await createBuilding();
      success++;
      renderStatus(`<b>Gebaut:</b> ${success}/${total} (ID ${id})`);

      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.error("Fehler:", e);
      renderStatus(`<b>Fehler bei Gebaeude ${i + 1}</b>`);
    }
  }

  alert(`Fertig. Erfolgreich gebaut: ${success}/${total}`);
  resetPlans();
}


  // --- Buttons + UI ---
  function addComboDropdown() {
    const typeDropdown = document.getElementById("building_building_type");
    if (!typeDropdown) return;
    if (document.getElementById("building_combo_type")) return;

    const comboSelect = document.createElement("select");
    comboSelect.id = "building_combo_type";
    comboSelect.className = "select required form-control";
    comboSelect.style.marginTop = "5px";

    for (const label in TYPE_COMBOS) {
      const opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label || "-- Keine Kombination --";
      comboSelect.appendChild(opt);
    }
    typeDropdown.parentElement.appendChild(comboSelect);
  }

function addButtons() {
  const host = document.getElementById("detail_16")?.parentElement;
  if (!host) return;
  if (document.getElementById("multi-build-plan-btn")) return;

  // --- Name-Feld ausblenden ---
  const nameInput = document.getElementById("building_name");
  if (nameInput) nameInput.style.display = "none";
  const nameLabel = document.querySelector("label[for='building_name']");
  if (nameLabel) nameLabel.style.display = "none";

// --- Eingabefeld fuer Namens-Suffix im gleichen Design (Label links, Input rechts) ---
const suffixWrapper = document.createElement("div");
suffixWrapper.className = "form-group"; // gleiche Gruppe wie Adresse etc.
suffixWrapper.style.display = "flex";
suffixWrapper.style.alignItems = "center";

const suffixLabel = document.createElement("label");
suffixLabel.setAttribute("for", "custom_name_suffix");
suffixLabel.className = "control-label";
suffixLabel.style.width = "120px"; // gleiche Breite wie andere Labels
suffixLabel.style.marginBottom = "0";
suffixLabel.textContent = "Namens-Suffix";

nameSuffixInput = document.createElement("input");
nameSuffixInput.type = "text";
nameSuffixInput.id = "custom_name_suffix";
nameSuffixInput.className = "form-control";
nameSuffixInput.style.flex = "1"; // Input nimmt Restbreite

suffixWrapper.append(suffixLabel, nameSuffixInput);

// --- Startnummer ---
const startWrapper = document.createElement("div");
startWrapper.className = "form-group";
startWrapper.style.display = "flex";
startWrapper.style.alignItems = "center";
startWrapper.style.marginTop = "4px";

const startLabel = document.createElement("label");
startLabel.setAttribute("for", "custom_start_number");
startLabel.className = "control-label";
startLabel.style.width = "120px";
startLabel.style.marginBottom = "0";
startLabel.textContent = "Startnummer";

startNumberInput = document.createElement("input");
startNumberInput.type = "number";
startNumberInput.id = "custom_start_number";
startNumberInput.className = "form-control";
startNumberInput.style.flex = "1";
startNumberInput.min = "0";
startNumberInput.value = "1"; // Default: beginnt bei 1

startWrapper.append(startLabel, startNumberInput);
host.append(startWrapper);

// --- Pad-Laenge ---
const padWrapper = document.createElement("div");
padWrapper.className = "form-group";
padWrapper.style.display = "flex";
padWrapper.style.alignItems = "center";
padWrapper.style.marginTop = "4px";

const padLabel = document.createElement("label");
padLabel.setAttribute("for", "custom_pad_length");
padLabel.className = "control-label";
padLabel.style.width = "120px";
padLabel.style.marginBottom = "0";
padLabel.textContent = "Nummerierung 1|01|001";

padLengthInput = document.createElement("input");
padLengthInput.type = "number";
padLengthInput.id = "custom_pad_length";
padLengthInput.className = "form-control";
padLengthInput.style.flex = "1";
padLengthInput.min = "1";
padLengthInput.value = "2"; // Default: 2 -> 01, 02, ...

padWrapper.append(padLabel, padLengthInput);
host.append(padWrapper);
// --- Gitternetz-Abstand fuer Raster ---
const gridWrapper = document.createElement("div");
gridWrapper.className = "form-group";
gridWrapper.style.display = "flex";
gridWrapper.style.alignItems = "center";
gridWrapper.style.marginTop = "4px";

const gridLabel = document.createElement("label");
gridLabel.setAttribute("for", "custom_grid_size");
gridLabel.className = "control-label";
gridLabel.style.width = "120px";
gridLabel.style.marginBottom = "0";
gridLabel.textContent = "Gitternetz";

gridSizeInput = document.createElement("select");
gridSizeInput.id = "custom_grid_size";
gridSizeInput.className = "form-control";
gridSizeInput.style.flex = "1";

[
  [100, "100 m"],
  [250, "250 m"],
  [500, "500 m"],
  [1000, "1 km"],
  [2000, "2 km"],
  [5000, "5 km"],
].forEach(([value, label]) => {
  const option = document.createElement("option");
  option.value = String(value);
  option.textContent = label;
  gridSizeInput.appendChild(option);
});

gridSizeInput.value = String(getGridSizeMeters());
gridSizeInput.addEventListener("change", () => setGridSizeMeters(gridSizeInput.value));
gridWrapper.append(gridLabel, gridSizeInput);
// --- Raster-Groesse ---
const rasterWrapper = document.createElement("div");
rasterWrapper.className = "form-group";
rasterWrapper.style.display = "flex";
rasterWrapper.style.alignItems = "center";
rasterWrapper.style.marginTop = "4px";

const rasterLabel = document.createElement("label");
rasterLabel.className = "control-label";
rasterLabel.style.width = "120px";
rasterLabel.style.marginBottom = "0";
rasterLabel.textContent = "Raster Marker";

const rasterInputs = document.createElement("div");
rasterInputs.style.display = "flex";
rasterInputs.style.gap = "6px";
rasterInputs.style.flex = "1";

rasterRowsInput = document.createElement("input");
rasterRowsInput.type = "number";
rasterRowsInput.id = "custom_raster_rows";
rasterRowsInput.className = "form-control";
rasterRowsInput.min = "1";
rasterRowsInput.max = "30";
rasterRowsInput.value = "10";
rasterRowsInput.title = "Zeilen, laufen vom Startpunkt nach Sueden";

rasterColsInput = document.createElement("input");
rasterColsInput.type = "number";
rasterColsInput.id = "custom_raster_cols";
rasterColsInput.className = "form-control";
rasterColsInput.min = "1";
rasterColsInput.max = "30";
rasterColsInput.value = "10";
rasterColsInput.title = "Spalten, laufen vom Startpunkt nach Osten";

rasterInputs.append(rasterRowsInput, rasterColsInput);
rasterWrapper.append(rasterLabel, rasterInputs);

  // --- Buttons in einer Reihe ---
  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "6px";
  btnRow.style.marginBottom = "6px";

  const planBtn = document.createElement("button");
  planBtn.id = "multi-build-plan-btn";
  planBtn.className = "btn btn-info";
  planBtn.textContent = "Marker setzen";
  planBtn.type = "button";

  const buildBtn = document.createElement("button");
  buildBtn.className = "btn btn-success";
  buildBtn.textContent = "Alle Gebaeude bauen";
  buildBtn.type = "button";

  const resetBtn = document.createElement("button");
  resetBtn.className = "btn btn-danger";
  resetBtn.textContent = "Marker Zuruecksetzen";
  resetBtn.type = "button";
  const rasterBtn = document.createElement("button");
  rasterBtn.className = "btn btn-warning";
  rasterBtn.textContent = "Raster-Marker setzen";
  rasterBtn.type = "button";

  btnRow.append(planBtn, rasterBtn, buildBtn, resetBtn);

  // --- Status & Legende ---
  statusBox = document.createElement("div");
  statusBox.style.marginTop = "8px";
  statusBox.style.color = "#fff";

  legendBox = document.createElement("div");
  legendBox.style.marginTop = "6px";
  legendBox.style.color = "#fff";

  // --- Alles ins Host einfuegen ---
  host.append(suffixWrapper, gridWrapper, rasterWrapper, btnRow, statusBox, legendBox);
  renderStatus();

  // --- Button Events ---
  planBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!window.building_new_marker) {
      alert("Marker nicht gefunden - bitte Baumenu oeffnen.");
      return;
    }
    const { lat, lng } = window.building_new_marker.getLatLng();
    const type = document.getElementById("building_building_type").value;
    const combo = document.getElementById("building_combo_type")?.value;
    const leitstelleId =
      document.getElementById("building_leitstelle_building_id")?.value ||
      nearestControlCenterId(new Coordinate(lat, lng));

    if (combo && TYPE_COMBOS[combo]?.length) {
      TYPE_COMBOS[combo].forEach((ct) => {
        planned.push({
          lat,
          lon: lng,
          type: ct,
          leitstelleId,
          name: buildingNameFor(ct),
        });
        addPreviewMarker(lat, lng, ct);
      });
    } else {
      planned.push({
        lat,
        lon: lng,
        type,
        leitstelleId,
        name: buildingNameFor(type),
      });
      addPreviewMarker(lat, lng, type);
    }
    renderStatus();
  });

  rasterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    planRasterFromCurrentMarker();
  });

  buildBtn.addEventListener("click", (e) => {
    e.preventDefault();
    buildQueue();
  });
  resetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    resetPlans();
  });

  // --- Hotkeys ---
  document.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key.toLowerCase() === "v" && !e.repeat) planBtn.click();
    if (e.key.toLowerCase() === "s" && !e.repeat) buildBtn.click();
  });
}



  function enhanceBuildWindow() {
    if (!document.getElementById("new_building")) return;
    void ensureControlCenters();
    addComboDropdown();
    addButtons();
  }

  function main() {
    enhanceBuildWindow();

    const observer = new MutationObserver(() => {
      enhanceBuildWindow();
    });

    observer.observe(document.getElementById("buildings") || document.body, {
      childList: true,
      subtree: true,
    });
  }

  main();
})();
