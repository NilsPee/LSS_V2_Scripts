// ==UserScript==
// @name            [LSS] Freigabenzaehler NilsPe
// @version         2.0.1
// @license         MIT
// @author          NilsPe
// @description     Zeigt konfigurierbare Zaehler oberhalb der Einsatzliste.
// @homepageURL     https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL      https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL     https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Own-Alliance-Mission-Count.user.js
// @updateURL       https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Own-Alliance-Mission-Count.user.js
// @match           https://*.leitstellenspiel.de/
// @icon            https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at          document-idle
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           unsafeWindow
// ==/UserScript==

(function () {
'use strict';

const creditLimit = 7499;

const STORAGE_KEY = 'config';

const SELECTORS = {
    SHARED: '.panel-success',
    NOT_SHARED: '.panel:not(.panel-success)',
    ATTENDED: '.glyphicon-user:not(.hidden)',
    NOT_ATTENDED: '.glyphicon-user.hidden',
};

const LISTS = {
    OWN: 'mission_list',
    ALLIANCE: 'mission_list_alliance',
    SIWA_ALLIANCE: 'mission_list_sicherheitswache_alliance',
    EVENT: 'mission_list_alliance_event',
};

/**
 * row: 1 = erste Zeile (Freigaben), 2 = zweite Zeile (VB)
 * @type {Config}
 */
const DEFAULT_CONFIG = [
    // Zeile 1: Freigaben
    { row: 1, text: 'Mögliche Freigaben:' },
    {
        row: 1,
        description: 'Nicht geteilte Einsätze mit über XXXX Credits',
        selector: SELECTORS.NOT_SHARED,
        lists: [LISTS.OWN],
        filter: mission => {
            const ds = mission.getAttribute('data-sortable-by');
            if (!ds) return false;
            try {
                const parsed = JSON.parse(ds.replace(/&quot;/g, '"'));
                return Number(parsed?.average_credits || 0) > creditLimit;
            } catch {
                return false;
            }
        },
    },
    { row: 1, text: ' // ' },
    { row: 1, text: 'Eigene Freigaben:' },
    {
        row: 1,
        description: 'Eigene Freigaben',
        selector: SELECTORS.SHARED,
        lists: [LISTS.OWN],
    },

    // Zeile 2: VB
    { row: 2, text: 'angefahrene VB: ' },
    {
        row: 2,
        description: 'Freigaben des Verbandes mit eigener Beteiligung',
        selector: SELECTORS.ATTENDED,
        lists: [LISTS.ALLIANCE, LISTS.SIWA_ALLIANCE, LISTS.EVENT],
    },
    { row: 2, text: ' // ' },
    { row: 2, text: 'offene VB: ' },
    {
        row: 2,
        description: 'Freigaben des Verbandes ohne eigene Beteiligung',
        selector: SELECTORS.NOT_ATTENDED,
        lists: [LISTS.ALLIANCE, LISTS.SIWA_ALLIANCE, LISTS.EVENT],
    },
];

// --- Konfiguration laden + migrieren (falls alte Einträge keine row haben) ---
/** @type {Config} */
const loaded = GM_getValue(STORAGE_KEY, null);
const counters = Array.isArray(loaded)
    ? loaded.map(entry => {
          if (typeof entry !== 'object' || entry === null) return entry;
          if ('row' in entry) return entry;
          const t = (entry.text || '').toString().toLowerCase();
          const d = (entry.description || '').toString().toLowerCase();
          // Heuristik: VB/Verband -> Zeile 2, sonst Zeile 1
          const row = t.includes('vb') || d.includes('verband') ? 2 : 1;
          return { ...entry, row };
      })
    : DEFAULT_CONFIG;

const debounce = fn => {
    let timeout;
    return (...args) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), 100);
    };
};

// Wrapper für zwei Zeilen
const container = document.createElement('div');
const row1 = document.createElement('div'); // Freigaben
const row2 = document.createElement('div'); // VB
// optional minimale Abstände, falls gewünscht:
// row2.style.marginTop = '2px';

const counterElements = new Set();

/** @param {1|2} row */
function targetRow(row) {
    return row === 2 ? row2 : row1;
}

counters.forEach(entry => {
    const dest = targetRow(entry.row === 2 ? 2 : 1);

    if ('text' in entry) {
        const span = document.createElement('span');
        span.textContent = entry.text;
        if (entry.color) span.style.color = entry.color;
        dest.append(span, ' ');
        return;
    }

    const el = document.createElement('span');
    el.title = entry.description || '';
    if (entry.color) el.style.color = entry.color;
    el.textContent = '⏳️';
    counterElements.add({ element: el, counter: entry });
    dest.append(el, ' ');
});

container.append(row1, row2);
const anchor = document.getElementById('search_input_field_missions');
if (anchor) anchor.before(container);

// --- Update-Funktion: richtige Ebene (.missionSideBarEntry) + Filter + Credit-Summen ---
const update = debounce(() => {
    counterElements.forEach(({ element, counter }) => {
        // alle Missionen in den angegebenen Listen
        let missions = document.querySelectorAll(
            `:where(${(counter.lists || [])
                .map(l => `#${l}`)
                .join(',')}) .missionSideBarEntry:not(.mission_deleted)`
        );

        // nur Missionen behalten, die das Ziel-Element (selector) enthalten
        missions = [...missions].filter(m => m.querySelector(counter.selector));

        // optionaler zusätzlicher Filter (z. B. creditLimit)
        if (typeof counter.filter === 'function') missions = missions.filter(m => counter.filter(m));

        // Anzahl + Credits
        const count = missions.length;
        let credits = 0;
        for (const m of missions) {
            const ds = m.getAttribute('data-sortable-by');
            if (!ds) continue;
            try {
                const parsed = JSON.parse(ds.replace(/&quot;/g, '"'));
                credits += Number(parsed?.average_credits || 0);
            } catch {
                // ignore parse errors
            }
        }

        element.textContent = `${count.toLocaleString()} (${credits.toLocaleString()} Cr)`;
    });
});

// Hooks für Live-Update
const missionMarkerAddOrig = unsafeWindow.missionMarkerAdd;
if (typeof missionMarkerAddOrig === 'function') {
    unsafeWindow.missionMarkerAdd = (...args) => {
        const res = missionMarkerAddOrig(...args);
        update();
        return res;
    };
}

const missionDeleteOrig = unsafeWindow.missionDelete;
if (typeof missionDeleteOrig === 'function') {
    unsafeWindow.missionDelete = (...args) => {
        const res = missionDeleteOrig(...args);
        update();
        return res;
    };
}

// Initiales Update
update();

/**
 * @typedef {Object} CounterConfig
 * @property {1|2} row
 * @property {string} description
 * @property {string} [color]
 * @property {string} selector
 * @property {Array<string>} [lists]
 * @property {(mission: Element) => boolean} [filter]
 */
/**
 * @typedef {Object} Text
 * @property {1|2} row
 * @property {string} text
 * @property {string} [color]
 */
/** @typedef {CounterConfig | Text} Config */
/** @typedef {Array<Config>} Config */
})();
