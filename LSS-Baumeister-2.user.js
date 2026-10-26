// ==UserScript==
// @name         LSS Baumeister 2.0
// @namespace    bos-ernie.leitstellenspiel.de
// @version      2.4.1
// @license      BSD-3-Clause
// @author       BOS-Ernie & NilsPe
// @description  Baupositionen vormerken, Rechteck- und Kreisraster erstellen und nacheinander bauen.
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Baumeister-2.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Baumeister-2.user.js
// @match        https://*.leitstellenspiel.de/*
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* global L, building_new_marker, building_new_dragend */

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
    "RDKL x10": Array(10).fill(20)
  };

  const GRID_SIZE_STORAGE_KEY = "lss_gitternetz_size_m";
  const CIRCLE_COUNT_STORAGE_KEY = "lss_kreis_count";
  const DEFAULT_GRID_SIZE_M = 500;

  let nameSuffixInput = null;
  let startNumberInput = null;
  let padLengthInput = null;
  let gridSizeInput = null;
  let rasterRowsInput = null;
  let rasterColsInput = null;
  let circleCountInput = null;

  let perKey = {};
  let planned = [];
  let previewMarkers = [];
  let statusBox = null;
  let legendBox = null;

  let controlCenters = [];
  let controlCentersPromise = null;

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

  async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
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
        throw new Error(`${url}: ${res.status}`);
      }

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

      url =
        payload?.paging?.next_page ||
        payload?.next_page ||
        null;

      if (url?.startsWith("https://www.leitstellenspiel.de")) {
        url = url.replace(
          "https://www.leitstellenspiel.de",
          ""
        );
      }

      if (url?.startsWith("https://polizei.leitstellenspiel.de")) {
        url = url.replace(
          "https://polizei.leitstellenspiel.de",
          ""
        );
      }
    }

    return buildings;
  }

  async function initControlCenters() {
    try {
      const buildings = await getBuildings();

      controlCenters = buildings.filter(
        b => Number(b.building_type) === 7
      );

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

  function addPreviewMarker(lat, lon, type) {
    if (!window.map) return;

    const color = TYPE_COLORS[type] || "gray";

    const marker = L.circleMarker(
      [lat, lon],
      {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.7
      }
    ).addTo(window.map);

    previewMarkers.push(marker);
  }

  function planAtPosition(
    lat,
    lng,
    type,
    combo,
    leitstelleId
  ) {
    const types =
      combo && TYPE_COMBOS[combo]?.length
        ? TYPE_COMBOS[combo]
        : [type];

    let added = 0;

    for (const buildingType of types) {
      planned.push({
        lat,
        lon: lng,
        type: buildingType,
        leitstelleId,
        name: buildingNameFor(buildingType)
      });

      addPreviewMarker(
        lat,
        lng,
        buildingType
      );

      added++;
    }

    return added;
  }

  // --------------------------------------------------
  // Rechteckiges Gitternetz
  // --------------------------------------------------

  function planRasterFromCurrentMarker() {
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

    const fixedLeitstelleId = document.getElementById(
      "building_leitstelle_building_id"
    )?.value;

    const rows = rasterCount(
      rasterRowsInput,
      10
    );

    const cols = rasterCount(
      rasterColsInput,
      10
    );

    const spacing = getGridSizeMeters();
    const latStep = metersToLatDegrees(spacing);

    let added = 0;

    for (let row = 0; row < rows; row++) {
      const markerLat = lat - row * latStep;

      const lngStep = metersToLngDegrees(
        spacing,
        markerLat
      );

      for (let col = 0; col < cols; col++) {
        const markerLng = lng + col * lngStep;

        const leitstelleId =
          fixedLeitstelleId ||
          nearestControlCenterId(
            new Coordinate(
              markerLat,
              markerLng
            )
          );

        added += planAtPosition(
          markerLat,
          markerLng,
          type,
          combo,
          leitstelleId
        );
      }
    }

    renderStatus(
      `<b>Vorgemerkt:</b> ${planned.length} ` +
      `(+${added} per Raster ${rows}x${cols})`
    );
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

  function planCircleFromCurrentMarker() {
    if (!window.building_new_marker) {
      alert(
        "Marker nicht gefunden - bitte Baumenu oeffnen."
      );
      return;
    }

    const count = Number(
      circleCountInput?.value
    );

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10000
    ) {
      alert(
        "Bitte 1 bis 10.000 Baupositionen eingeben."
      );
      return;
    }

    localStorage.setItem(
      CIRCLE_COUNT_STORAGE_KEY,
      String(count)
    );

    const center =
      window.building_new_marker.getLatLng();

    const type = document.getElementById(
      "building_building_type"
    ).value;

    const combo = document.getElementById(
      "building_combo_type"
    )?.value;

    const fixedLeitstelleId = document.getElementById(
      "building_leitstelle_building_id"
    )?.value;

    const spacing = getGridSizeMeters();
    const offsets = circularGridOffsets(count);

    let added = 0;

    for (const { x, y } of offsets) {
      const markerLat =
        center.lat +
        metersToLatDegrees(y * spacing);

      const markerLng =
        center.lng +
        metersToLngDegrees(
          x * spacing,
          markerLat
        );

      const leitstelleId =
        fixedLeitstelleId ||
        nearestControlCenterId(
          new Coordinate(
            markerLat,
            markerLng
          )
        );

      added += planAtPosition(
        markerLat,
        markerLng,
        type,
        combo,
        leitstelleId
      );
    }

    const maxD =
      Math.sqrt(
        offsets[offsets.length - 1].d2
      ) * spacing / 1000;

    renderStatus(
      `<b>Vorgemerkt:</b> ${planned.length} ` +
      `(+${added} Gebäude an ${count} Kreispositionen, ` +
      `Radius ca. ${maxD.toLocaleString("de-DE", {
        maximumFractionDigits: 2
      })} km)`
    );
  }

  // --------------------------------------------------
  // Status und Zurücksetzen
  // --------------------------------------------------

  function resetPlans() {
    planned = [];

    previewMarkers.forEach(
      marker => window.map?.removeLayer(marker)
    );

    previewMarkers = [];
    perKey = {};

    renderStatus();
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
    if (planned.length === 0) {
      alert("Keine Positionen vorgemerkt!");
      return;
    }

    const total = planned.length;
    let success = 0;

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
            leitstelleId;
        }

        const id = await createBuilding();
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

    resetPlans();
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

    rasterRowsInput.title =
      "Zeilen nach Süden";

    rasterColsInput =
      createNumberInput(10, 1, 30);

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
      "Kreis-Anzahl",
      circleCountInput,
      "custom_circle_count",
      circleCountInput.title
    );

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
      "Raster-Marker setzen",
      "btn btn-warning"
    );

    const circleBtn = makeButton(
      "Kreis-Marker setzen",
      "btn btn-warning"
    );

    const buildBtn = makeButton(
      "Alle Gebaeude bauen",
      "btn btn-success"
    );

    const resetBtn = makeButton(
      "Marker Zuruecksetzen",
      "btn btn-danger"
    );

    btnRow.append(
      planBtn,
      rasterBtn,
      circleBtn,
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
      suffixWrapper,
      startWrapper,
      padWrapper,
      gridWrapper,
      rasterWrapper,
      circleWrapper,
      btnRow,
      statusBox,
      legendBox
    );

    renderStatus();

    // --------------------------------------------------
    // Button-Ereignisse
    // --------------------------------------------------

    planBtn.addEventListener("click", e => {
      e.preventDefault();

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

      planAtPosition(
        lat,
        lng,
        type,
        combo,
        leitstelleId
      );

      renderStatus();
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

    document.addEventListener(
      "keydown",
      e => {
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
      }
    );
  }

  // --------------------------------------------------
  // Initialisierung
  // --------------------------------------------------

  function enhanceBuildWindow() {
    if (
      !document.getElementById("new_building")
    ) {
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
