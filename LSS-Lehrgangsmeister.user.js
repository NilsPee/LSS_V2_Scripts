// ==UserScript==
// @name            LSS Lehrgangsmeister
// @namespace       NilsPe.lehrgangsmeister
// @version         1.4.3
// @license         MIT
// @author          NilsPe
// @description     Reduziert die notwendigen Klicks beim Ausbilden grosser Personalmengen.
// @homepageURL     https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL      https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL     https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Lehrgangsmeister.user.js
// @updateURL       https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Lehrgangsmeister.user.js
// @match           https://*.leitstellenspiel.de/buildings/*
// @grant           GM_getValue
// @grant           GM_setValue
// @grant           GM_addStyle
// @grant           unsafeWindow
// @require         https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon            https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at          document-idle
// ==/UserScript==

/* global $ */

(function () {
'use strict';

// EINSTELLUNG: Soll ein Bestätigungsdialog vor dem Ausbilden angezeigt werden?
const SETTING_SHOW_CONFIRM_DIALOG = true; // true: Bestätigungsdialog vor dem Ausbilden anzeigen.
//                                           false: Keinen Bestätigungsdialog anzeigen, sondern direkt ausbilden.
// ENDE DER EINSTELLUNGEN! DA DRUNTER LIEBER NICHTS ÄNDERN!

const pageHeading = document.querySelector('h1[building_type]');
const form = document.querySelector('form[action$="/education"]');

if (!pageHeading || !form) {
    return;
}

const isAllianceSchool =
    document.querySelector('dl > dd > a[href^="/alliances/"]') !== null;
const buildingType = parseInt(
    pageHeading.getAttribute('building_type') ?? '-1'
);
const schoolBuildingId = parseInt(
    unsafeWindow.location.pathname.split('/')[2] ?? '-1'
);

/** @type {HTMLSelectElement} */
const roomsSelection =
    document.querySelector('#building_rooms_use') ??
    document.createElement('select');

if (!roomsSelection.id) {
    roomsSelection.addEventListener(
        'change',
        unsafeWindow.update_personnel_counter_navbar
    );
}

roomsSelection.id ||= 'building_rooms_use';
roomsSelection.name ||= 'building_rooms_use';

// disable selection and show spinner until total available rooms are calculated
roomsSelection.disabled = true;
const spinner = document.createElement('img');
spinner.src = '/images/ajax-loader.gif';
spinner.style.setProperty('height', '1lh');
spinner.style.setProperty('display', 'none');

// optional limit: only consider as many schools as needed for this many rooms
const roomLimitLabel = document.createElement('label');
roomLimitLabel.textContent = '\xa0Maximal benoetigte Raeume laden:\xa0';
const roomLimitInput = document.createElement('input');
roomLimitInput.type = 'number';
roomLimitInput.id = roomLimitLabel.htmlFor = 'jxn_training_room_limit';
roomLimitInput.min = '0';
roomLimitInput.step = '1';
roomLimitInput.placeholder = 'alle';
roomLimitInput.style.setProperty('width', '7em');
roomLimitInput.dataset.storageKey = 'roomLimit';
roomLimitInput.value = GM_getValue(roomLimitInput.dataset.storageKey, '');
roomLimitInput.addEventListener('change', () =>
    GM_setValue(
        roomLimitInput.dataset.storageKey,
        Math.max(0, parseInt(roomLimitInput.value || '0', 10) || 0) || ''
    )
);
const loadSchoolsButton = document.createElement('button');
loadSchoolsButton.type = 'button';
loadSchoolsButton.classList.add('btn', 'btn-xs', 'btn-default');
loadSchoolsButton.textContent = 'Laden';
loadSchoolsButton.style.setProperty('margin-left', '.5em');
roomLimitInput.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    loadSchoolsButton.click();
});
roomLimitLabel.append(roomLimitInput, loadSchoolsButton);
const roomLoadStatus = document.createElement('span');
roomLoadStatus.setAttribute('role', 'status');
roomLoadStatus.style.marginLeft = '8px';
roomLimitLabel.append(roomLoadStatus);
let roomLoadStartedAt = 0;
let roomLoadMetrics = {};
let roomLoadRun = 0;
let roomTaskObserver = null;
let roomMeasurementActive = false;
const roomLongTasks = [];
try {
    if (typeof PerformanceObserver !== 'undefined' &&
        PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        roomTaskObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                if (roomMeasurementActive && entry.startTime >= roomLoadStartedAt) roomLongTasks.push(entry.duration);
            }
        });
        roomTaskObserver.observe({ type: 'longtask' });
    }
} catch (error) { console.debug('[Lehrgangsmeister] Longtask-Messung nicht verfuegbar', error); }
const finishRoomPaintMeasurement = run => {
    // Two frames include a rendering opportunity after the script finished.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (run !== roomLoadRun || schoolsLoading) return;
        for (const entry of roomTaskObserver?.takeRecords() ?? []) {
            if (entry.startTime >= roomLoadStartedAt) roomLongTasks.push(entry.duration);
        }
        const totalMs = performance.now() - roomLoadStartedAt;
        roomMeasurementActive = false;
        roomLoadMetrics.displayWaitMs = Math.max(0, totalMs - roomLoadMetrics.totalJsMs);
        roomLoadMetrics.longestBlockMs = roomLongTasks.reduce((max, duration) => Math.max(max, duration), 0);
        roomLoadStatus.textContent = `Bereit: Daten/Script ${(roomLoadMetrics.totalJsMs / 1000).toFixed(1)} s, ` +
            `Anzeige danach ${(roomLoadMetrics.displayWaitMs / 1000).toFixed(1)} s`;
        roomLoadStatus.title += roomTaskObserver
            ? `; laengste Blockade: ${(roomLoadMetrics.longestBlockMs / 1000).toFixed(1)} s`
            : '; Blockadenmessung in diesem Browser nicht verfuegbar';
        console.info('[Lehrgangsmeister] Raumladen inkl. Darstellung', { ...roomLoadMetrics, totalMs });
    }));
};

// checkbox to (dis-)allow opening empty schools
const allowEmptyLabel = document.createElement('label');
allowEmptyLabel.textContent = '\xa0Leere Klassenzimmer öffnen?';
const allowEmptyCheckbox = document.createElement('input');
allowEmptyCheckbox.type = 'checkbox';
allowEmptyCheckbox.id = allowEmptyLabel.htmlFor = 'allow_empty_schools';
allowEmptyCheckbox.dataset.storageKey = 'allowEmptySchools';
allowEmptyCheckbox.checked = GM_getValue(
    allowEmptyCheckbox.dataset.storageKey,
    false
);
allowEmptyCheckbox.addEventListener('change', () =>
    GM_setValue(
        allowEmptyCheckbox.dataset.storageKey,
        allowEmptyCheckbox.checked
    )
);
allowEmptyLabel.prepend(allowEmptyCheckbox);

const CLASSES_ONLY_MODE = true;
let personnelUiAllowed = false;

// A detached fragment, rather than display:none: unrelated stations should not
// participate in document-wide selectors, observers and style recalculation.
const originalPersonnelStash = document.createDocumentFragment();
const getOriginalPersonnelStash = () => originalPersonnelStash;

const removePersonnelSelectionUi = () => {
    if (!CLASSES_ONLY_MODE || personnelUiAllowed) return;
    parkPersonnelPanels();
};


// checkbox to toggle whether only specific schools should be used
const useSpecificSchoolsLabel = document.createElement('label');
useSpecificSchoolsLabel.textContent = '\xa0Nur spezielle Schulen nutzen?';
const useSpecificSchoolsCheckbox = document.createElement('input');
useSpecificSchoolsCheckbox.type = 'checkbox';
useSpecificSchoolsCheckbox.id = useSpecificSchoolsLabel.htmlFor =
    'use_specific_schools';
useSpecificSchoolsCheckbox.dataset.storageKey = 'useSpecificSchools';
useSpecificSchoolsCheckbox.checked = GM_getValue(
    useSpecificSchoolsCheckbox.dataset.storageKey,
    false
);
useSpecificSchoolsCheckbox.addEventListener('change', () =>
    GM_setValue(
        useSpecificSchoolsCheckbox.dataset.storageKey,
        useSpecificSchoolsCheckbox.checked
    )
);
useSpecificSchoolsLabel.prepend(useSpecificSchoolsCheckbox);

GM_addStyle(`
 label:has(#${useSpecificSchoolsCheckbox.id}:not(:checked)) + select[multiple],
             label:has(#${useSpecificSchoolsCheckbox.id}:not(:checked)) + select[multiple] + .help-block {
                 display: none;
             }`);

const specificSchoolSelection = document.createElement('select');
specificSchoolSelection.classList.add('form-control');
specificSchoolSelection.multiple = true;
specificSchoolSelection.size = 7;

const specificSchoolsHelp = document.createElement('p');
specificSchoolsHelp.classList.add('help-block');
specificSchoolsHelp.textContent =
    'Durch das Drücken von Strg können mehrere Schulen einzeln ausgewählt werden.';

form.querySelector(':scope > h3')?.before(roomsSelection);
roomsSelection.after(
    spinner,
    document.createElement('br'),
    roomLimitLabel,
    ' | ',
    allowEmptyLabel,
    ' | ',
    useSpecificSchoolsLabel,
    specificSchoolSelection,
    specificSchoolsHelp
);

// create a label if none exists
if (roomsSelection.labels.length === 0) {
    const label = document.createElement('label');
    label.htmlFor = roomsSelection.id;
    label.textContent =
        'Wie viele Räume sollen für diese Ausbildung genutzt werden?\xa0';
    roomsSelection.before(label);
}

/** @type {Set<{select: HTMLSelectElement, input: HTMLInputElement}>} */
const schoolingRoomSelections = new Set();

const roomsSelectionClass = 'jxn-training_mouse_protector-rooms_use';
const lastShownOptionClass = 'jxn-training_mouse_protector-last_shown';
const isDurchschloedelingClass =
    'jxn-training_mouse_protector-is-durchschloedeling';

const selectStyle = document.createElement('style');
form?.append(selectStyle);

const updateSelectStyle = () => {
    roomsSelection.disabled = false;
    if (CLASSES_ONLY_MODE) {
        // The legacy multi-course controls do not exist in this mode. Avoid
        // scanning the large personnel form and rewriting its stylesheet.
        const css = `body:has(#${allowEmptyCheckbox.id}:checked) #accordion > .panel,
            form.${isDurchschloedelingClass} #accordion > .panel {
                opacity: 0.5; pointer-events: none;
            }`;
        if (selectStyle.textContent !== css) selectStyle.textContent = css;
        return;
    }

    const remainingRooms =
        parseInt(roomsSelection.lastElementChild.value) -
        Array.from(schoolingRoomSelections.values()).reduce(
            (acc, { select }) => acc + parseInt(select.value),
            0
        );

    form?.querySelectorAll(
        `.${roomsSelectionClass} .${lastShownOptionClass}`
    ).forEach(option => option.classList.remove(lastShownOptionClass));

    schoolingRoomSelections.forEach(({ select }) => {
        select.disabled = !allowEmptyCheckbox.checked;
        const current = parseInt(select.value);
        select
            .querySelector(
                `option[value="${Math.max(remainingRooms + current, current)}"]`
            )
            ?.classList.add(lastShownOptionClass);
    });

    selectStyle.textContent = `
     .${roomsSelectionClass} .${lastShownOptionClass} ~ option {
         display: none;
         pointer-events: none;
     }

     body:has(#${allowEmptyCheckbox.id}:checked) #accordion > .panel,
     form.${isDurchschloedelingClass} #accordion > .panel {
         opacity: 0.5;
         pointer-events: none;
     }
     `.trim();
};

roomsSelection.addEventListener('change', updateSelectStyle);
allowEmptyCheckbox.addEventListener('change', updateSelectStyle);

/**
 * @typedef {Object} Schooling
 * @property {number} id
 * @property {number} education_id
 * @property {string} education
 * @property {string} education_start_time
 * @property {string} education_end_time
 */

/**
 * @typedef {Object} BuildingExtension
 * @property {string} caption
 * @property {boolean} available
 * @property {boolean} enabled
 * @property {number} type_id
 */

/**
 * @typedef {Object} Building
 * @property {number} id
 * @property {string} caption
 * @property {number} building_type
 * @property {number} personal_count
 * @property {string[]} [generates_mission_categories]
 * @property {Schooling[]} [schoolings]
 * @property {BuildingExtension[]} [extensions]
 */

/**
 * @typedef {Object} BuildingType
 * @property {string} caption
 * @property {number[]} [schools]
 */

/**
 * @param {Building} school
 * @returns {number}
 */
const getFreeRooms = school => {
    const total =
        1 +
        (school.extensions?.filter(e => e.available && e.enabled).length ??
            0);
    return total - (school.schoolings?.length ?? 0);
};

/**
 * @param {Building[]} schools
 */
const getUsableSchools = schools => {
    if (!useSpecificSchoolsCheckbox.checked) return schools;
    const selectedSchools = Array.from(
        specificSchoolSelection.selectedOptions
    ).map(option => option.value);
    return schools.filter(({ id }) => selectedSchools.includes(id.toString()));
};

const getRoomLimit = () =>
    Math.max(0, parseInt(roomLimitInput.value || '0', 10) || 0);

/**
 * @param {Building[]} schools
 */
const getLimitedSchools = schools => {
    const limit = getRoomLimit();
    if (!limit) return schools;

    let rooms = 0;
    const limitedSchools = [];
    for (const school of schools) {
        const freeRooms = getFreeRooms(school);
        if (!freeRooms) continue;
        limitedSchools.push(school);
        rooms += freeRooms;
        if (rooms >= limit) break;
    }
    return limitedSchools;
};

const schoolStaffCategories = {
    1: ['fire'],
    3: ['ambulance'],
    8: ['police', 'riot_police', 'criminal_investigation'],
    10: ['thw'],
};

/**
 * @param {Building[]} buildings
 */
const getStaffBuildingCandidates = buildings => {
    const categories = schoolStaffCategories[buildingType];
    if (!categories) return buildings;
    return buildings.filter(building =>
        building.generates_mission_categories?.some(category =>
            categories.includes(category)
        )
    );
};

/**
 * @param {Building[]} schools
 */
const setRoomSelection = schools => {
    const startedAt = performance.now();
    const previousValue = Number(roomsSelection.value) || 1;
    const filteredSchools = getLimitedSchools(getUsableSchools(schools));

    const totalFreeRooms = filteredSchools.reduce(
        (acc, school) => acc + getFreeRooms(school),
        0
    );
    const roomLimit = getRoomLimit();
    const selectableRooms = roomLimit ?
        Math.min(totalFreeRooms, roomLimit)
    :   totalFreeRooms;

    // fill rooms selection with available rooms
    const options = document.createDocumentFragment();

    const zeroOption = document.createElement('option');
    zeroOption.value = '0';
    zeroOption.textContent = '0';
    schoolingRoomSelections.forEach(({ select }) =>
        select.replaceChildren(zeroOption.cloneNode(true))
    );

    for (let i = 1; i <= selectableRooms; i++) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = i.toString();
        options.append(option);
        schoolingRoomSelections.forEach(({ select }) =>
            select.append(option.cloneNode(true))
        );
    }
    if (!selectableRooms) options.append(zeroOption.cloneNode(true));
    roomsSelection.replaceChildren(options);
    roomsSelection.value = String(selectableRooms ? Math.min(previousValue, selectableRooms) : 0);
    // A rebuild with the same value needs no expensive native change handlers.
    if (Number(roomsSelection.value) !== previousValue) {
        roomsSelection.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        updateSelectStyle();
    }
    roomLoadMetrics.dropdownMs = performance.now() - startedAt;
};

const eduField = form.elements.education_select;

const COURSE_FILTER_KEY = 'nilspe_hidden_courses_' + buildingType;
const storedHiddenCourses = GM_getValue(COURSE_FILTER_KEY, []);
const hiddenCourses = new Set(Array.isArray(storedHiddenCourses) ? storedHiddenCourses : []);
const courseFilter = document.createElement('details');
courseFilter.id = 'nilspe-course-filter';
courseFilter.style.margin = '8px 0';
const courseSummary = document.createElement('summary');
courseSummary.textContent = 'Lehrgaenge ein-/ausblenden';
courseFilter.append(courseSummary);
const courseControls = [];
for (const option of Array.from(eduField.options)) {
    if (!option.value) continue;
    const label = document.createElement('label');
    label.style.cssText = 'display:block;font-weight:normal';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !hiddenCourses.has(option.value);
    label.append(input, document.createTextNode(' ' + option.textContent.trim()));
    courseFilter.append(label);
    courseControls.push({ option, input, originallyDisabled: option.disabled });
    input.addEventListener('change', () => {
        if (input.checked) hiddenCourses.delete(option.value);
        else hiddenCourses.add(option.value);
        GM_setValue(COURSE_FILTER_KEY, [...hiddenCourses]);
        applyCourseFilter();
    });
}
function applyCourseFilter() {
    for (const { option, input, originallyDisabled } of courseControls) {
        // Keep the selected course available; never change a training implicitly.
        const selected = option.value === eduField.value;
        input.disabled = selected || originallyDisabled;
        input.checked = selected || !hiddenCourses.has(option.value);
        const hidden = !selected && hiddenCourses.has(option.value);
        option.hidden = hidden;
        option.disabled = originallyDisabled || hidden;
        option.style.display = hidden ? 'none' : '';
    }
}
eduField.after(courseFilter);
eduField.addEventListener('change', applyCourseFilter);
applyCourseFilter();

// One bounded queue shared by visible counters and bulk filtering.
function createCounterQueue(limit) {
    let active = 0;
    const waiting = [];
    const next = () => {
        while (active < limit && waiting.length) {
            const job = waiting.shift();
            active++;
            Promise.resolve().then(job.task).then(job.resolve, job.reject)
                .finally(() => { active--; next(); });
        }
    };
    const enqueue = task => new Promise((resolve, reject) => {
        waiting.push({ task, resolve, reject });
        next();
    });
    enqueue.setLimit = value => {
        limit = Math.max(1, Math.min(10, Math.floor(Number(value) || 3)));
        next();
    };
    return enqueue;
}
const queueCounterRequest = createCounterQueue(3);
const pendingCounterRequests = new Map();
const activeCounterControllers = new Set();
let educationRevision = 0;
const PARTICIPANT_PARALLELISM_KEY = 'nilspe_training_parallelism';
const normalizeParallelism = value => Number.isInteger(Number(value)) &&
    Number(value) >= 1 && Number(value) <= 10 ? Number(value) : 3;
let participantParallelism = normalizeParallelism(GM_getValue(PARTICIPANT_PARALLELISM_KEY, 3));
queueCounterRequest.setLimit(participantParallelism);

const getTrainingDuration = () =>
    parseInt(
        eduField
            .querySelector('option:checked')
            ?.textContent?.match(/(?<=\()\d+(?=\s*.*?\)$)/)?.[0] ?? '0'
    );

const confirmDialogId = 'jxn-training_mouse-protector_confirm-dialog';

// remove modal style added by Traxx
GM_addStyle(`
     #${confirmDialogId} {
     position: fixed;
     padding-top: 0;
     left: 0;
     right: 0;
     top: 0;
     bottom: 0;
     overflow: hidden;
     z-index: 1050;
     }
     #${confirmDialogId} .modal-dialog {
     max-width: 500px;
     }
     #${confirmDialogId} .modal-body {
     height: unset;
     overflow-y: unset;
     }

     #${confirmDialogId} u {
     text-decoration-color: #aaa;
     }

     #${confirmDialogId} .buttons {
     text-align: center;
     margin: -15px;
     margin-top: 15px;
     border-top: 1px solid;
     }

     #${confirmDialogId} .buttons > a {
     width: 50%;
     display: inline-block;
     color: inherit;
     cursor: pointer;
     padding: 15px;
     }

     #${confirmDialogId} .buttons > a:hover {
     background-color: #aaa;
     text-decoration: none;
     }

     #${confirmDialogId} .buttons > a:not(:last-child) {
     border-right: 1px solid;
     }
     `);

/**
 * @param {string} educationName
 * @param {number} staffAmount
 * @param {number} schoolsAmount
 * @param {number} duration
 * @param {number} emptyRooms
 * @param {number} emptySchools
 * @param {number} pricePerSeatPerDay
 * @param {string} openDuration
 * @returns {Promise<boolean>}
 */
const confirmDialog = (
    educationName,
    staffAmount,
    schoolsAmount,
    duration,
    emptyRooms,
    emptySchools,
    pricePerSeatPerDay,
    openDuration
) => {
    const modal = document.createElement('div');
    modal.classList.add('modal', 'fade');
    modal.id = confirmDialogId;

    const dialog = document.createElement('div');
    dialog.classList.add('modal-dialog');
    dialog.style.setProperty('width', 'fit-content');

    const content = document.createElement('div');
    content.classList.add('modal-content');

    const body = document.createElement('div');
    body.classList.add('modal-body');
    body.style.setProperty('overflow', 'auto');
    body.style.setProperty('box-sizing', 'content-box');

    /**
     * @param {number} num
     * @returns {string}
     */
    const str = num => num.toLocaleString('de');

    const trainingP = document.createElement('p');
    trainingP.innerHTML = `Ausbildung: <b>${educationName}</b>`;
    body.append(trainingP);

    if (staffAmount) {
        const staffAmountP = document.createElement('p');
        staffAmountP.innerHTML = `Es werden <b>${str(staffAmount)}&nbsp;Personen</b> in <b>${str(Math.ceil(staffAmount / 10))}&nbsp;Zimmern</b> (<b>${str(schoolsAmount)}&nbsp;Schulen</b>) ausgebildet.`; // <br/>Die Ausbildung dauert <b>${duration}&nbsp;Tage</b>.
        if (pricePerSeatPerDay && isAllianceSchool) {
            staffAmountP.innerHTML += `<br/>Die Kosten betragen <b>${str(pricePerSeatPerDay)}&nbsp;*&nbsp;${str(staffAmount)}&nbsp;*&nbsp;${duration}&nbsp;=&nbsp;<u>${str(pricePerSeatPerDay * staffAmount * duration)}&nbsp;Credits</u></b>.`;
        }
        body.append(staffAmountP);
    }
    if (emptyRooms) {
        const emptyRoomsP = document.createElement('p');
        emptyRoomsP.innerHTML = `Es werden <b>${str(emptyRooms)}&nbsp;leere&nbsp;Zimmer</b> in <b>${str(emptySchools)}&nbsp;Schulen</b> zum Preis von <b>${str(pricePerSeatPerDay)}&nbsp;Credits</b> pro Person pro Tag für die Dauer von <b>${openDuration}</b> im Verband freigegeben.`;
        body.append(emptyRoomsP);
    }

    const buttons = document.createElement('div');
    buttons.classList.add('buttons');
    const abortBtn = document.createElement('a');
    abortBtn.href = '#';
    abortBtn.textContent = 'Abbrechen';
    const confirmBtn = document.createElement('a');
    confirmBtn.textContent = 'Fortfahren';

    buttons.append(abortBtn, confirmBtn);
    body.append(buttons);
    content.append(body);
    dialog.append(content);
    modal.append(dialog);
    document.body.append(modal);

    modal.classList.add('in');
    modal.style.setProperty('display', 'block');

    return new Promise(resolve => {
        abortBtn.addEventListener('click', event => {
            event.preventDefault();
            modal.remove();
            resolve(false);
        });
        confirmBtn.addEventListener('click', event => {
            event.preventDefault();
            modal.remove();
            resolve(true);
        });
    });
};

let abortedDueToMultipleSchools = false;
const multipleSchoolsAlert = `
     ⚠️🚨 𝐀𝐜𝐡𝐭𝐮𝐧𝐠 𝐀𝐜𝐡𝐭𝐮𝐧𝐠. 𝐄𝐢𝐧𝐞 𝐰𝐢𝐜𝐡𝐭𝐢𝐠𝐞 𝐃𝐮𝐫𝐜𝐡𝐬𝐚𝐠𝐞! 🚨⚠️

     Das Script "Ausbildungs-Mausschoner" ist NICHT mit dem Script "MultipleSchools" von Allure149 kompatibel. Bitte deaktiviere das Script "MultipleSchools", um dieses Script hier verwenden zu können.

     Andernfalls kann es zu unerwartetem Verhalten kommen, für dieses übernimmt der Autor dieses Scriptes keine Haftung.

     Viele Grüße
     Euer Tutorial-Polizist mit dem langen Zeigefinger! 👮👆
     `.trim();

let multipleSchoolsChecks = 0;
const checkMultipleSchools = setInterval(() => {
    multipleSchoolsChecks++;

    if (document.querySelector('#multipleClassesSelect')) {
        const pre = document.createElement('pre');
        pre.textContent = multipleSchoolsAlert;
        document.querySelector('#schooling')?.prepend(pre);
        alert(multipleSchoolsAlert);
        abortedDueToMultipleSchools = true;
        clearInterval(checkMultipleSchools);
    } else if (multipleSchoolsChecks >= 15) {
        clearInterval(checkMultipleSchools);
    }
}, 1000);

const normalizeApiResult = data => data?.result ?? data?.data ?? data;
const getApiItems = data => {
    const normalized = normalizeApiResult(data);
    return Array.isArray(normalized) ? normalized : [];
};

const fetchFirstOk = async urls => {
    let lastError;
    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return normalizeApiResult(await res.json());
        } catch (error) {
            lastError = error;
            console.warn(
                `[Ausbildungs-Mausschoner] API fehlgeschlagen: ${url}`,
                error
            );
        }
    }
    throw lastError;
};

const fetchOptionalJson = async url => {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return normalizeApiResult(await res.json());
    } catch (error) {
        console.warn(
            `[Ausbildungs-Mausschoner] optionale API fehlgeschlagen: ${url}`,
            error
        );
        return [];
    }
};

const fetchPaginatedV2 = async path => {
    const limit = 5000;
    const allItems = [];
    const seenUrls = new Set();
    let nextUrl = new URL(path, unsafeWindow.location.origin);
    nextUrl.searchParams.set('limit', limit.toString());

    while (nextUrl) {
        const requestPath = nextUrl.pathname + nextUrl.search;
        if (seenUrls.has(requestPath)) break;
        seenUrls.add(requestPath);

        const res = await fetch(requestPath);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = await res.json();
        const items = getApiItems(data);
        allItems.push(...items);

        const nextPage =
            data?.paging?.next_page ??
            data?.paging?.nextPage ??
            data?.pagination?.next_page ??
            data?.pagination?.nextPage ??
            data?.meta?.next_page ??
            data?.meta?.nextPage ??
            data?.next_page ??
            data?.nextPage ??
            data?.next;
        nextUrl = nextPage ? new URL(nextPage, unsafeWindow.location.origin) : null;
    }

    return allItems;
};

const mergeBuildingsById = (...buildingLists) => {
    const map = new Map();
    buildingLists.flat().forEach(building => {
        if (!building?.id) return;
        map.set(building.id, {
            ...(map.get(building.id) ?? {}),
            ...building,
        });
    });
    return Array.from(map.values());
};

const loadCachedBuildings = async (storeName, update) => {
    const db = await openDb();

    try {
        // Lehrgaenge veraendern die Raumbelegung sofort. Deshalb bei jedem
        // Laden inkrementell nach geaenderten Gebaeuden fragen.
        await update(db, 0);
        return await getAllData(db, storeName);
    } finally {
        db.close();
    }
};

const fetchGameBuildings = () =>
    loadCachedBuildings('buildings', updateBuildings);

const fetchAllianceBuildings = () =>
    loadCachedBuildings('allianceBuildings', updateAllianceBuildings);

const loadSchoolCatalogue = async () => {
    roomLoadStatus.textContent = 'Gebaeudespeicher oeffnen …';
    const openStart = performance.now();
    const db = await openDb();
    roomLoadMetrics.openMs = performance.now() - openStart;
    try {
        roomLoadStatus.textContent = 'Schuldaten aktualisieren …';
        const syncStart = performance.now();
        await (isAllianceSchool ? updateAllianceBuildings : updateBuildings)(db, 0);
        roomLoadMetrics.apiMs = performance.now() - syncStart;
        roomLoadStatus.textContent = 'Passende Schulen aus Speicher lesen …';
        const readStart = performance.now();
        // Read only this school type, not thousands of unrelated stations.
        const schools = await getDataByIndex(db,
            isAllianceSchool ? 'allianceBuildings' : 'buildings',
            'building_type', buildingType);
        roomLoadMetrics.readMs = performance.now() - readStart;
        return schools.toSorted((a, b) => Number(a.id) - Number(b.id));
    } finally {
        db.close();
    }
};
let staffBuildingsPromise = null;
const ensureStaffBuildings = async () => {
    if (!staffBuildingsPromise) {
        staffBuildingsPromise = fetchGameBuildings().then(buildings => {
            currentBuildings = buildings;
            return buildings;
        }).catch(error => { staffBuildingsPromise = null; throw error; });
    }
    return staffBuildingsPromise;
};

const persistSchoolState = async school => {
    const db = await openDb();

    try {
        await putRecords(
            db,
            isAllianceSchool ? 'allianceBuildings' : 'buildings',
            [school]
        );
    } finally {
        db.close();
    }
};

let schoolsLoaded = false;
let schoolsLoading = false;
let schoolSelectionListenersAttached = false;
let submitHandlerAttached = false;
let currentSchools = [];
let currentBuildings = [];
let schoolOptionsSignature = '';
const renderSpecificSchoolOptions = schools => {
    // The list is hidden by default. Build it only when it is actually used.
    if (!useSpecificSchoolsCheckbox.checked) return;
    const entries = schools.map(school => ({ school, free: getFreeRooms(school) }))
        .filter(entry => entry.free > 0);
    const signature = JSON.stringify(entries.map(({ school, free }) =>
        [String(school.id), school.caption, free]));
    if (signature === schoolOptionsSignature) return;
    const selected = new Set(Array.from(specificSchoolSelection.selectedOptions,
        option => option.value));
    const options = document.createDocumentFragment();
    for (const { school, free } of entries) {
        const option = document.createElement('option');
        option.value = String(school.id);
        option.textContent = `${school.caption} (${free} Zimmer frei)`;
        option.selected = selected.has(option.value);
        options.append(option);
    }
    specificSchoolSelection.replaceChildren(options);
    schoolOptionsSignature = signature;
};
let keywordAssignerRendered = false;
let educationCounterScrollListenerAttached = false;
let educationCounterScrollTimeout;

const getSelectedEducationKey = () => eduField.value?.split(':')?.[0];

const normalizeEducationName = value =>
    (value ?? '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

const getSelectedEducationName = () =>
    normalizeEducationName(
        eduField.querySelector('option:checked')?.textContent ?? ''
    );

const getSelectedEducationNumber = () => {
    const selectedOption = eduField.querySelector('option:checked');
    const selectedValue = selectedOption?.value ?? eduField.value ?? '';
    const candidates = [
        selectedValue.split(':')[1],
        selectedValue,
        selectedOption?.dataset?.educationId,
        selectedOption?.getAttribute('data-education-id'),
        selectedOption?.getAttribute('data-id'),
    ];
    const onlyNumber = candidates
        .map(value => value?.match(/\d+/g)?.pop())
        .map(value => parseInt(value ?? '', 10))
        .find(value => !Number.isNaN(value));
    return Number.isNaN(onlyNumber) ? undefined : onlyNumber;
};

const getPersonnelEducationText = checkbox =>
    document
        .getElementById(`school_personal_education_${checkbox.value}`)
        ?.textContent?.trim() ?? '';

const getPersonnelVehicleAssignmentText = checkbox =>
    document
        .getElementById(`school_personal_education_${checkbox.value}`)
        ?.nextElementSibling?.textContent?.trim() ?? '';

const isAlreadyEducatedForSelectedTraining = checkbox => {
    const educationKey = getSelectedEducationKey();
    return !!educationKey && checkbox.getAttribute(educationKey) === 'true';
};

const isPersonnelInSelectedTraining = checkbox => {
    const selectedEducation = getSelectedEducationName();
    const personnelEducation = normalizeEducationName(
        getPersonnelEducationText(checkbox)
    );
    return (
        !!selectedEducation &&
        !!personnelEducation &&
        (selectedEducation === personnelEducation ||
            selectedEducation.includes(personnelEducation) ||
            personnelEducation.includes(selectedEducation))
    );
};

const getEducationCounterSpan = buildingId =>
    document.querySelector(`#personal-select-heading-building-${buildingId}`);

const getCoveredPersonnelCounterFromHeading = buildingId => {
    const span = getEducationCounterSpan(buildingId);
    const datasetCounter =
        (parseInt(span?.dataset.educatedCount ?? '0', 10) || 0) +
        (parseInt(span?.dataset.inTrainingCount ?? '0', 10) || 0);

    if (
        span?.dataset.educationLoaded === eduField.value ||
        span?.dataset.educationCounterKnown === 'true'
    ) {
        return datasetCounter;
    }

    const heading = document.querySelector(
        `.personal-select-heading[building_id="${buildingId}"]`
    );
    if (!heading) return 0;

    return Array.from(heading.querySelectorAll('.label')).reduce(
        (sum, label) => {
            const text = label.textContent?.trim() ?? '';
            if (!/ausgebildete|in Ausbildung/i.test(text)) return sum;
            return sum + (parseInt(text, 10) || 0);
        },
        0
    );
};
const decodeCounterScriptText = script =>
    script
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/\\u00a0|&nbsp;/gi, ' ')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

const parseEducationCountersFromScript = script => {
    const text = decodeCounterScriptText(script);
    const html = script
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const countFromLabels = selector =>
        Math.max(
            0,
            ...Array.from(doc.querySelectorAll(selector)).map(label =>
                parseInt(label.textContent?.match(/\d+/)?.[0] ?? '0', 10) || 0
            )
        );
    const count = patterns => {
        const values = [];
        patterns.forEach(pattern => {
            Array.from(text.matchAll(pattern)).forEach(match => {
                values.push(parseInt(match[1], 10) || 0);
            });
        });
        return values.length ? Math.max(...values) : 0;
    };
    const educatedFromLabels = countFromLabels('.label-success');
    const inTrainingFromLabels = countFromLabels('.label-info');
    return {
        educated:
            educatedFromLabels ||
            count([
                /(\d+)\s+(?:bereits\s+)?ausgebildete(?:\s+Person(?:en)?)?/gi,
                /ausgebildete(?:\s+Person(?:en)?)?\s*:?\s*(\d+)/gi,
                /(\d+)\s+Person(?:en)?\s+ausgebildet/gi,
            ]),
        inTraining:
            inTrainingFromLabels ||
            count([
                /(\d+)\s+(?:Person(?:en)?\s+)?in\s+Ausbildung/gi,
                /in\s+Ausbildung\s*:?\s*(\d+)/gi,
                /(\d+)\s+laufende(?:\s+Ausbildung(?:en)?)?/gi,
            ]),
    };
};

const parseRenderedEducationCounters = span => {
    const count = selector =>
        Math.max(
            0,
            ...Array.from(span?.querySelectorAll(selector) ?? []).map(label =>
                parseInt(label.textContent?.match(/\d+/)?.[0] ?? '0', 10) || 0
            )
        );
    return {
        educated: count('.label-success'),
        inTraining: count('.label-info'),
    };
};

const storeEducationCounterDataset = (buildingId, counters) => {
    const span = getEducationCounterSpan(buildingId);
    if (!span) return;
    span.dataset.educatedCount = (counters.educated || 0).toString();
    span.dataset.inTrainingCount = (counters.inTraining || 0).toString();
};

const loadEducationCounterForBuilding = buildingId => {
    const education = eduField.value;
    const revision = educationRevision;
    const key = revision + ':' + education + ':' + buildingId;
    if (pendingCounterRequests.has(key)) return pendingCounterRequests.get(key);
    const request = queueCounterRequest(() => {
        if (education !== eduField.value || revision !== educationRevision) return 0;
        return fetchEducationCounterForBuilding(buildingId, education, revision);
    }).finally(() => pendingCounterRequests.delete(key));
    pendingCounterRequests.set(key, request);
    return request;
};

const fetchCounterScript = async (url, timeoutMs = 15000) => {
    const controller = new AbortController();
    activeCounterControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return await response.text();
    } finally {
        clearTimeout(timeout);
        activeCounterControllers.delete(controller);
    }
};

const fetchEducationCounterForBuilding = async (buildingId, education, revision) => {
    const onlyNumber = getSelectedEducationNumber();
    const span = getEducationCounterSpan(buildingId);
    if (!span) return 0;
    if (onlyNumber == null) {
        delete span.dataset.educationCounterKnown;
        span.dataset.educationCounterFailed = 'true';
        return 0;
    }
    if (span.dataset.educationLoaded === eduField.value) {
        return getCoveredPersonnelCounterFromHeading(buildingId);
    }
    try {
        const script = await fetchCounterScript(
            `/buildings/${schoolBuildingId}/schoolingEducationCheck?education=${onlyNumber}&only_building_id=${buildingId}`
        );
        if (education !== eduField.value || revision !== educationRevision) return 0;
        let parsedCounters;
        try {
            // The game returns JavaScript which renders the exact counters.
            unsafeWindow.eval(script);
            parsedCounters = parseRenderedEducationCounters(span);
        } catch (executionError) {
            console.warn(
                'Lehrgangsmeister: Schulungszaehler konnte nicht direkt ausgefuehrt werden.',
                executionError
            );
            parsedCounters = parseEducationCountersFromScript(script);
        }
        span.dataset.educationLoaded = education;
        span.dataset.educatedCount = (parsedCounters.educated || 0).toString();
        span.dataset.inTrainingCount = (parsedCounters.inTraining || 0).toString();
        storeEducationCounterDataset(buildingId, parsedCounters);
        delete span.dataset.educationCounterFailed;

        span.dataset.educationCounterKnown = 'true';
    } catch (error) {
        if (education !== eduField.value || revision !== educationRevision) return 0;
        delete span.dataset.educationLoaded;
        span.dataset.educationCounterKnown = 'true';
        span.dataset.educationCounterFailed = 'true';
        console.error(error);
    }
    return getCoveredPersonnelCounterFromHeading(buildingId);
};

const loadVisibleEducationCounters = () => {
    document
        .querySelectorAll('.personal-select-heading-building')
        .forEach(span => {
            if (span.dataset.educationLoaded === eduField.value) return;
            // Hidden panels have a zero rectangle; that does not make them visible.
            if (span.getClientRects().length === 0) return;
            const rect = span.getBoundingClientRect();
            const viewportHeight =
                unsafeWindow.innerHeight ||
                document.documentElement.clientHeight;
            if (rect.bottom < 0 || rect.top > viewportHeight) return;
            loadEducationCounterForBuilding(
                span.getAttribute('building_id')
            ).catch(console.error);
        });
};

const queueVisibleEducationCounters = () => {
    if (educationCounterScrollTimeout) {
        clearTimeout(educationCounterScrollTimeout);
    }
    educationCounterScrollTimeout = setTimeout(
        loadVisibleEducationCounters,
        100
    );
};

const ensureEducationCounterScrollListener = () => {
    if (educationCounterScrollListenerAttached) return;
    educationCounterScrollListenerAttached = true;
    document
        .querySelector('#iframe-inside-container')
        ?.addEventListener('scroll', queueVisibleEducationCounters);
    unsafeWindow.addEventListener('scroll', queueVisibleEducationCounters);
    eduField.addEventListener('change', () => {
        educationRevision++;
        prefetchedPersonnelHtml.clear();
        document
            .querySelectorAll('.personal-select-heading-building')
            .forEach(span => {
                delete span.dataset.educationLoaded;
                delete span.dataset.educatedCount;
                delete span.dataset.inTrainingCount;
                delete span.dataset.educationCounterKnown;
                delete span.dataset.educationCounterFailed;
            });
        document.querySelectorAll('[data-nilspe-hidden-at-target]').forEach(panel => {
            panel.style.removeProperty('display');
            delete panel.dataset.nilspeHiddenAtTarget;
        });
        queueVisibleEducationCounters();
    });
};

const countCoveredPersonnelForBuilding = buildingId => {
    const span = getEducationCounterSpan(buildingId);
    const headingCounter = getCoveredPersonnelCounterFromHeading(buildingId);
    const personnelCounter = Array.from(
        getPersonnelCheckboxes(buildingId)
    ).filter(
        checkbox =>
            isAlreadyEducatedForSelectedTraining(checkbox) ||
            isPersonnelInSelectedTraining(checkbox)
    ).length;

    if (
        span?.dataset.educationLoaded === eduField.value ||
        span?.dataset.educationCounterKnown === 'true'
    ) {
        return Math.max(headingCounter, personnelCounter);
    }

    return Math.max(headingCounter, personnelCounter);
};
const isPersonnelSelectableForTraining = checkbox =>
    !checkbox.disabled &&
    !isAlreadyEducatedForSelectedTraining(checkbox) &&
    !isPersonnelInSelectedTraining(checkbox) &&
    getPersonnelEducationText(checkbox) === '';

const disableAlreadyEducatedPersonnel = (scope = document) => {
    const educationKey = getSelectedEducationKey();
    if (!educationKey) return;
    scope
        .querySelectorAll('.schooling_checkbox[data-jxn-disabled-education]')
        .forEach(checkbox => {
            checkbox.disabled = false;
            checkbox.removeAttribute('data-jxn-disabled-education');
        });
    scope
        .querySelectorAll(`.schooling_checkbox[${educationKey}="true"]`)
        .forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = true;
            checkbox.setAttribute('data-jxn-disabled-education', 'true');
        });
};

const updateSchoolingFree = () => {
    const selected = document.querySelectorAll(
        '.schooling_checkbox:checked'
    ).length;
    const max = 10 * parseInt(roomsSelection.value || '0', 10);
    const free = Math.max(0, max - selected);
    const freeSpan = document.querySelector('#schooling_free');
    if (freeSpan) freeSpan.textContent = free.toString();
    unsafeWindow.update_costs?.();
};

const getPersonnelBody = buildingId =>
    getPersonnelHeading(buildingId)?.closest('.panel')?.querySelector('.panel-body') ?? null;
const getPersonnelCheckboxes = buildingId =>
    Array.from(getPersonnelBody(buildingId)?.querySelectorAll('.schooling_checkbox') ?? []);
const countSelectedPersonnelForBuilding = buildingId =>
    getPersonnelCheckboxes(buildingId).filter(checkbox => checkbox.checked).length;

// Keep unselected personnel in memory, rather than accumulating hundreds of
// hidden table rows per processed station in the active school form.
const parkedPersonnelRows = new Map();
const withDetachedPersonnelBody = (body, task) => {
    const parent = body.parentNode;
    const next = body.nextSibling;
    if (parent) parent.removeChild(body);
    try { task(); }
    finally { if (parent) parent.insertBefore(body, next); }
};
const restorePersonnelRows = buildingId => {
    const entry = parkedPersonnelRows.get(String(buildingId));
    if (!entry) return;
    withDetachedPersonnelBody(entry.body, () => {
        for (const group of entry.groups) {
            const fragment = document.createDocumentFragment();
            group.nodes.forEach(node => fragment.append(node));
            group.parent.replaceChildren(fragment);
        }
    });
    parkedPersonnelRows.delete(String(buildingId));
    disableAlreadyEducatedPersonnel(entry.body);
};
const compactPersonnelRows = buildingId => {
    if (parkedPersonnelRows.has(String(buildingId))) return;
    const body = getPersonnelBody(buildingId);
    if (!body) return;
    const rowsToPark = new Set(getPersonnelCheckboxes(buildingId)
        .filter(checkbox => !checkbox.checked)
        .map(checkbox => checkbox.closest('tr'))
        .filter(row => row && !row.querySelector('.schooling_checkbox:checked')));
    if (!rowsToPark.size) return;
    const parents = new Set(Array.from(rowsToPark, row => row.parentNode));
    const groups = Array.from(parents, parent => ({ parent, nodes: Array.from(parent.childNodes) }));
    const stash = document.createDocumentFragment();
    withDetachedPersonnelBody(body, () => {
        rowsToPark.forEach(row => stash.append(row));
    });
    parkedPersonnelRows.set(String(buildingId), { body, groups, stash });
};

const updateSelectionCounter = buildingId => {
    const heading = getPersonnelHeading(buildingId);
    if (!heading) return;

    let counter = heading.querySelector('.jxn-selected-personnel-counter');
    if (!counter) {
        counter = document.createElement('span');
        counter.classList.add(
            'label',
            'label-primary',
            'jxn-selected-personnel-counter'
        );
        counter.style.setProperty('margin-right', '.5em');
        heading.querySelector('.pull-right')?.prepend(counter);
    }
    counter.textContent = `${countSelectedPersonnelForBuilding(buildingId)} ausgewählt`;
};

const getMatchingStaffBuildings = filter => {
    const buildingsWithStaff = currentBuildings.filter(
        ({ personal_count }) => personal_count > 0
    );
    const matchesFilter = building =>
        building.caption.toLowerCase().includes(filter.toLowerCase());
    const categoryMatches =
        getStaffBuildingCandidates(buildingsWithStaff).filter(matchesFilter);
    const matches =
        categoryMatches.length ?
            categoryMatches
        :   buildingsWithStaff.filter(matchesFilter);
    return matches.toSorted((a, b) => a.caption.localeCompare(b.caption));
};

const ensurePersonnelWrapper = () => {
    personnelUiAllowed = true;
    const assigner = document.querySelector('#jxn_keyword_assigner');
    let heading = document.querySelector('#jxn_keyword_personnel_heading');
    let accordion = document.querySelector('#accordion');
    if (heading && accordion) {
        assigner?.after(heading, accordion);
        return accordion;
    }

    if (!heading) {
        heading = document.createElement('h3');
        heading.id = 'jxn_keyword_personnel_heading';
        heading.textContent = 'Personal auswählen';
    }
    if (!accordion) {
        accordion = document.createElement('div');
        accordion.id = 'accordion';
    }
    if (assigner) {
        assigner.after(heading, accordion);
    } else {
        document.querySelector('#alliance_cost')?.after(heading, accordion);
    }
    return accordion;
};

const personnelHeadingIndex = new Map();
let personnelHeadingIndexReady = false;
const parkPersonnelPanels = () => {
    const accordion = document.querySelector('#accordion');
    const parent = accordion?.parentNode;
    if (!parent) return;
    const next = accordion.nextSibling;
    // Detach the container once. Moving thousands of children while it is
    // connected would itself trigger document-wide observers thousands of times.
    parent.removeChild(accordion);
    try {
        accordion.querySelectorAll('.personal-select-heading[building_id]').forEach(heading => {
            personnelHeadingIndex.set(String(heading.getAttribute('building_id')), heading);
            const panel = heading.closest('.panel');
            if (!panel || panel.querySelector('.schooling_checkbox:checked')) return;
            originalPersonnelStash.append(panel);
        });
        personnelHeadingIndexReady = true;
    } finally {
        parent.insertBefore(accordion, next);
    }
};
const restorePersonnelPanels = () => {
    const accordion = ensurePersonnelWrapper();
    const parent = accordion.parentNode;
    const next = accordion.nextSibling;
    parent.removeChild(accordion);
    try {
        for (const panel of Array.from(originalPersonnelStash.children)) {
            panel.style.removeProperty('display');
            accordion.append(panel);
        }
    } finally {
        parent.insertBefore(accordion, next);
    }
};
const getPersonnelHeading = buildingId => {
    if (!personnelHeadingIndexReady) {
        document.querySelectorAll('.personal-select-heading[building_id]').forEach(heading => {
            personnelHeadingIndex.set(heading.getAttribute('building_id'), heading);
        });
        personnelHeadingIndexReady = true;
    }
    const key = String(buildingId);
    const known = personnelHeadingIndex.get(key);
    if (known) return known;
    const heading = document.querySelector(`.personal-select-heading[building_id="${key}"]`);
    if (heading) personnelHeadingIndex.set(key, heading);
    return heading;
};

const renderBuildingPanel = building => {
    const accordion = ensurePersonnelWrapper();
    const existing = getPersonnelHeading(building.id);
    const existingPanel = existing?.closest('.panel');
    if (existingPanel) {
        if (!existingPanel.isConnected || existingPanel.closest('#jxn_original_personnel_stash')) {
            accordion.append(existingPanel);
        }
        existingPanel.style.removeProperty('display');
        updateSelectionCounter(building.id);
        return existingPanel;
    }

    const buildingDiv = document.createElement('div');
    buildingDiv.classList.add('panel', 'panel-default');

    const heading = document.createElement('div');
    heading.classList.add('panel-heading', 'personal-select-heading');
    heading.setAttribute('building_id', building.id.toString());
    personnelHeadingIndex.set(String(building.id), heading);
    heading.setAttribute(
        'href',
        `/buildings/${building.id}/schooling_personal_select`
    );
    heading.textContent = building.caption;

    const headingRight = document.createElement('div');
    headingRight.classList.add('pull-right');
    const currentLabel = document.createElement('span');
    currentLabel.classList.add('label', 'label-default');
    currentLabel.textContent = `${building.personal_count}\xa0Angestellte`;
    const selectedLabel = document.createElement('span');
    selectedLabel.classList.add(
        'label',
        'label-primary',
        'jxn-selected-personnel-counter'
    );
    selectedLabel.style.setProperty('margin-right', '.5em');
    selectedLabel.textContent = '0 ausgewählt';
    const educationCounter = document.createElement('span');
    educationCounter.id = `personal-select-heading-building-${building.id}`;
    educationCounter.classList.add('personal-select-heading-building');
    educationCounter.setAttribute('building_id', building.id.toString());
    educationCounter.style.setProperty('margin-right', '.5em');
    headingRight.append(selectedLabel);
    headingRight.append(educationCounter);
    headingRight.append(currentLabel);
    heading.append(headingRight);

    const body = document.createElement('div');
    body.classList.add('panel-body', 'hidden');
    body.setAttribute('building_id', building.id.toString());
    const loadingImg = document.createElement('img');
    loadingImg.classList.add('ajaxLoader');
    loadingImg.src = '/images/ajax-loader.gif';
    body.append(loadingImg);

    buildingDiv.append(heading, body);
    accordion.append(buildingDiv);
    return buildingDiv;
};

const clearRenderedBuildingPanels = () => {
    document.querySelectorAll('.schooling_checkbox:checked').forEach(
        checkbox => (checkbox.checked = false)
    );
    parkPersonnelPanels();
    updateSchoolingFree();
};

const prefetchedPersonnelHtml = new Map();
let participantTimings = null;
const requestPersonnelHtml = (buildingId, href, revision = educationRevision) => {
    const key = revision + ':' + buildingId;
    if (!prefetchedPersonnelHtml.has(key)) {
        const request = queueCounterRequest(async () => {
            if (revision !== educationRevision) throw new Error('Auswahl abgebrochen.');
            return fetchCounterScript(href);
        }).then(html => ({ html }), error => ({ error }));
        prefetchedPersonnelHtml.set(key, request);
    }
    return prefetchedPersonnelHtml.get(key);
};
const prepareTrainingBuilding = async (buildingId, desired) => {
    const revision = educationRevision;
    await loadEducationCounterForBuilding(buildingId);
    if (revision !== educationRevision) return;
    const span = getEducationCounterSpan(buildingId);
    if (span?.dataset.educationLoaded === eduField.value &&
        span.dataset.educationCounterFailed !== 'true' &&
        countCoveredPersonnelForBuilding(buildingId) >= desired) return;
    const heading = getPersonnelHeading(buildingId);
    const body = getPersonnelBody(buildingId);
    const href = heading?.getAttribute('href');
    if (!href || !body) return;
    if (unsafeWindow.loadedBuildings?.includes(href) &&
        (parkedPersonnelRows.has(String(buildingId)) || body.querySelector('.schooling_checkbox'))) return;
    // Prefetch text only. The response is inserted and its scripts run only
    // when the sequential selection actually reaches this station.
    await requestPersonnelHtml(buildingId, href, revision);
};

const loadPersonnelForBuilding = async buildingId => {
    const revision = educationRevision;
    restorePersonnelRows(buildingId);
    const panelBody = getPersonnelBody(buildingId);
    const heading = getPersonnelHeading(buildingId);
    if (!panelBody || !heading) return;
    const href = heading.getAttribute('href');
    unsafeWindow.loadedBuildings ??= [];

    const prepareCheckboxes = () => {
        panelBody.querySelectorAll('.schooling_checkbox').forEach(checkbox => {
            if (checkbox.getAttribute('building_id') !== String(buildingId)) {
                checkbox.setAttribute('building_id', String(buildingId));
            }
        });
        if (!panelBody.dataset.jxnSelectionListener) {
            panelBody.dataset.jxnSelectionListener = 'true';
            panelBody.addEventListener('change', event => {
                if (!event.target?.matches?.('.schooling_checkbox')) return;
                updateSelectionCounter(buildingId);
                updateSchoolingFree();
            });
        }
    };

    const hasPersonnelCheckboxes = () =>
        panelBody.querySelector('.schooling_checkbox') !== null;

    if (!unsafeWindow.loadedBuildings.includes(href) || !hasPersonnelCheckboxes()) {
        const waitStartedAt = performance.now();
        const response = await requestPersonnelHtml(buildingId, href, revision);
        prefetchedPersonnelHtml.delete(revision + ':' + buildingId);
        if (participantTimings) participantTimings.htmlWaitMs += performance.now() - waitStartedAt;
        if (revision !== educationRevision) throw new Error('Auswahl abgebrochen.');
        if (response.error) throw response.error;
        const html = response.html;
        const renderStartedAt = performance.now();
        $(panelBody).html(html);
        prepareCheckboxes();
        disableAlreadyEducatedPersonnel(panelBody);
        if (participantTimings) participantTimings.htmlApplyMs += performance.now() - renderStartedAt;
        if (!unsafeWindow.loadedBuildings.includes(href)) {
            unsafeWindow.loadedBuildings.push(href);
        }
    } else {
        prepareCheckboxes();
        disableAlreadyEducatedPersonnel(panelBody);
    }
    updateSelectionCounter(buildingId);
};

const selectPersonnelForBuilding = async (buildingId, desiredTotal) => {
    const revision = educationRevision;
    await loadEducationCounterForBuilding(buildingId);
    if (revision !== educationRevision) throw new Error('Auswahl abgebrochen.');
    const desired = Math.max(0, parseInt(desiredTotal, 10) || 0);
    const span = getEducationCounterSpan(buildingId);
    const known = span?.dataset.educationLoaded === eduField.value &&
        span.dataset.educationCounterFailed !== 'true';
    const coveredBeforeLoad = countCoveredPersonnelForBuilding(buildingId);
    if (known && coveredBeforeLoad >= desired) {
        return { found: 0, enabled: 0, selected: countSelectedPersonnelForBuilding(buildingId),
            covered: coveredBeforeLoad, desired };
    }
    await loadPersonnelForBuilding(buildingId);
    if (revision !== educationRevision) throw new Error('Auswahl abgebrochen.');
    const covered = countCoveredPersonnelForBuilding(buildingId);
    let remaining = Math.max(0, desired - covered);
    const max = 10 * parseInt(roomsSelection.value || '0', 10);
    const allCheckboxes = getPersonnelCheckboxes(buildingId);
    allCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    const checkboxes = allCheckboxes.filter(checkbox => !checkbox.disabled);
    let selectedTotal = document.querySelectorAll('.schooling_checkbox:checked').length;
    const selectFrom = (candidates, strict = true) => {
        for (const checkbox of candidates) {
            if (remaining <= 0) {
                break;
            }
            if (selectedTotal >= max) break;
            const isFree = strict ?
                isPersonnelSelectableForTraining(checkbox)
            :   !checkbox.checked &&
                !checkbox.disabled &&
                !isAlreadyEducatedForSelectedTraining(checkbox) &&
                !isPersonnelInSelectedTraining(checkbox) &&
                getPersonnelEducationText(checkbox) === '';
            if (isFree) {
                checkbox.checked = true;
                remaining--;
                selectedTotal++;
            }
        }
    };
    selectFrom(checkboxes, true);
    if (remaining > 0) {
        selectFrom(checkboxes, false);
    }
    updateSelectionCounter(buildingId);
    updateSchoolingFree();
    compactPersonnelRows(buildingId);
    return {
        found: allCheckboxes.length,
        enabled: checkboxes.length,
        selected: countSelectedPersonnelForBuilding(buildingId),
        covered,
        desired,
    };
};

async function processTrainingBuildings(buildings, capacity, hooks) {
    let processed = 0;
    for (let index = 0; index < buildings.length; index++) {
        const building = buildings[index];
        if (hooks.cancelled()) throw new Error('Auswahl abgebrochen.');
        if (!hooks.hasSpace()) break;
        const lookahead = Math.max(1, Math.min(10, Number(hooks.lookahead) || 3));
        hooks.prepare?.(buildings.slice(index, index + lookahead));
        hooks.progress(building, processed, buildings.length);
        const result = await hooks.select(building.id, capacity);
        if (hooks.cancelled()) throw new Error('Auswahl abgebrochen.');
        hooks.result(building, result);
        processed++;
    }
    return processed;
}

const renderKeywordAssigner = () => {
    if (keywordAssignerRendered) return;
    keywordAssignerRendered = true;
    const container = document.createElement('div');
    container.id = 'jxn_keyword_assigner';
    container.className = 'alert alert-info';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';
    container.style.flexWrap = 'wrap';
    container.innerHTML = `
      <strong>Wachen per Stichwort:</strong>
      <input id="jxn_keyword_filter" class="form-control input-sm" style="width:180px" placeholder="Name enthaelt...">
      <input id="jxn_keyword_capacity" class="form-control input-sm" style="width:90px" type="number" min="1" value="1">
      <button type="button" id="jxn_keyword_load" class="btn btn-default btn-sm">Wachen laden</button>
      <button type="button" id="jxn_keyword_add" class="btn btn-default btn-sm">Hinzufuegen</button>
      <button type="button" id="jxn_keyword_select" class="btn btn-success btn-sm">Auswaehlen</button>
      <label style="display:flex;align-items:center;gap:4px;margin:0;font-weight:normal">
        Parallel laden:
        <select id="nilspe_training_parallelism" class="form-control input-sm" style="width:65px">
          ${Array.from({ length: 10 }, (_, index) =>
              `<option value="${index + 1}">${index + 1}</option>`).join('')}
        </select>
      </label>
      <span id="jxn_keyword_status" class="help-block" style="margin:0"></span>
    `;
    const existingHeading = document.querySelector(
        '#jxn_keyword_personnel_heading'
    );
    const existingAccordion = document.querySelector('#accordion');
    if (existingHeading) {
        existingHeading.before(container);
    } else {
        document.querySelector('#alliance_cost')?.after(container);
    }
    if (existingHeading && existingAccordion) {
        container.after(existingHeading, existingAccordion);
    }

    const filterInput = container.querySelector('#jxn_keyword_filter');
    const capacityInput = container.querySelector('#jxn_keyword_capacity');
    const parallelismInput = container.querySelector('#nilspe_training_parallelism');
    parallelismInput.value = String(participantParallelism);
    parallelismInput.addEventListener('change', () => {
        participantParallelism = normalizeParallelism(parallelismInput.value);
        parallelismInput.value = String(participantParallelism);
        queueCounterRequest.setLimit(participantParallelism);
        GM_setValue(PARTICIPANT_PARALLELISM_KEY, participantParallelism);
    });
    const targetKey = 'nilspe_training_target_' + buildingType;
    capacityInput.value = String(Math.max(1, Number(GM_getValue(targetKey, 1)) || 1));
    capacityInput.addEventListener('change', () =>
        GM_setValue(targetKey, Math.max(1, Number(capacityInput.value) || 1)));
    const hideLabel = document.createElement('label');
    hideLabel.style.cssText = 'display:flex;align-items:center;gap:4px;margin:0';
    const hideAtTarget = document.createElement('input');
    hideAtTarget.type = 'checkbox';
    const hideKey = 'nilspe_hide_trained_' + buildingType;
    hideAtTarget.checked = GM_getValue(hideKey, true) !== false;
    hideAtTarget.addEventListener('change', () => GM_setValue(hideKey, hideAtTarget.checked));
    hideLabel.append(hideAtTarget, document.createTextNode('Ausreichend ausgebildete Wachen ausblenden'));
    container.append(hideLabel);
    const status = container.querySelector('#jxn_keyword_status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const cancelAction = document.createElement('button');
    cancelAction.type = 'button';
    cancelAction.className = 'btn btn-default btn-sm';
    cancelAction.textContent = 'Abbrechen';
    cancelAction.disabled = true;
    container.append(cancelAction);
    const showAll = document.createElement('button');
    showAll.type = 'button';
    showAll.className = 'btn btn-default btn-sm';
    showAll.textContent = 'Alle Wachen anzeigen';
    showAll.addEventListener('click', () => {
        restorePersonnelPanels();
        status.textContent = 'Originale Wachenliste eingeblendet. Stichwort-Auswaehlen bleibt auf deine geladenen Treffer begrenzt.';
    });
    container.append(showAll);
    let keywordCancelled = false;
    let lastCounterFailures = 0;
    cancelAction.addEventListener('click', () => {
        keywordCancelled = true;
        educationRevision++;
        prefetchedPersonnelHtml.clear();
        for (const controller of activeCounterControllers) controller.abort();
        cancelAction.disabled = true;
        status.textContent = 'Wird abgebrochen …';
    });
    const getDesiredCapacity = () =>
        Math.max(0, parseInt(capacityInput.value || '0', 10) || 0);
    const hideBuildingsAtTarget = async buildings => {
        const desired = getDesiredCapacity();
        if (!desired) return buildings;

        const education = eduField.value;
        const revision = educationRevision;
        lastCounterFailures = 0;
        // Visibility only uses already known counters. Never preflight all matches.
        if (education !== eduField.value || revision !== educationRevision) {
            throw new Error('Lehrgang wurde waehrend des Ladens gewechselt. Bitte erneut laden.');
        }
        const remainingBuildings = [];
        for (const building of buildings) {
            const span = getEducationCounterSpan(building.id);
            const covered = countCoveredPersonnelForBuilding(building.id);
            const panel = document.querySelector(
                `.personal-select-heading[building_id="${building.id}"]`
            )?.closest('.panel');
            // Unknown counts are never a reason to hide a station.
            const known = span?.dataset.educationLoaded === education &&
                span.dataset.educationCounterFailed !== 'true';
            if (hideAtTarget.checked && span?.dataset.educationCounterFailed === 'true') lastCounterFailures++;
            if (hideAtTarget.checked && known && covered >= desired) {
                panel?.style.setProperty('display', 'none');
                if (panel) panel.dataset.nilspeHiddenAtTarget = 'true';
            } else {
                panel?.style.removeProperty('display');
                if (panel) delete panel.dataset.nilspeHiddenAtTarget;
                remainingBuildings.push(building);
            }
        }
        status.textContent = `${remainingBuildings.length} von ${buildings.length} Wachen offen` +
            (lastCounterFailures ? ` – ${lastCounterFailures} Ausbildungsstaende unbekannt (weiter sichtbar)` : '');
        return remainingBuildings;
    };
    const loadedKeywordBuildings = new Map();
    const loadMatching = async ({ append = false } = {}) => {
        const startedAt = performance.now();
        const filter = filterInput.value.trim();
        if (!filter) {
            status.textContent = 'Bitte erst ein Stichwort eingeben.';
            filterInput.focus();
            return [];
        }
        status.textContent = 'Wachendaten fuer Stichwortsuche laden …';
        await ensureStaffBuildings();
        if (keywordCancelled) throw new Error('Laden abgebrochen.');
        if (!append) {
            loadedKeywordBuildings.clear();
            clearRenderedBuildingPanels();
        }
        const buildings = getMatchingStaffBuildings(filterInput.value);
        buildings.forEach(building => loadedKeywordBuildings.set(String(building.id), building));
        for (let index = 0; index < buildings.length; index++) {
            if (keywordCancelled) throw new Error('Laden abgebrochen.');
            renderBuildingPanel(buildings[index]);
            if ((index + 1) % 100 === 0) {
                status.textContent = `${index + 1} / ${buildings.length} Treffer anzeigen …`;
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        ensureEducationCounterScrollListener();
        const remainingBuildings = await hideBuildingsAtTarget(buildings);
        status.textContent = buildings.length ?
            `${remainingBuildings.length.toLocaleString('de')} von ${buildings.length.toLocaleString('de')} Wachen angezeigt – Ausbildungspruefung bei Auswaehlen` +
                (lastCounterFailures ? ` – ${lastCounterFailures} Ausbildungsstaende unbekannt (weiter sichtbar)` : '')
        :   'Keine Wachen zum Stichwort gefunden.';
        status.textContent += ` (${((performance.now() - startedAt) / 1000).toFixed(1)} s)`;
        document.dispatchEvent(
            new CustomEvent('lehrgangszuweiser:render-personnel-selectors')
        );
        return remainingBuildings;
    };
    // Only the explicit keyword selection belongs to this action. The game may
    // keep thousands of unrelated station panels hidden in the same document.
    const getRenderedBuildings = () => Array.from(loadedKeywordBuildings.values());
    let keywordBusy = false;
    const runKeywordAction = async task => {
        if (keywordBusy) return;
        keywordBusy = true;
        keywordCancelled = false;
        cancelAction.disabled = false;
        status.textContent = 'Wachen werden geladen …';
        const controls = Array.from(container.querySelectorAll('input, button, select'))
            .filter(control => control !== cancelAction);
        controls.forEach(control => { control.disabled = true; });
        const educationWasDisabled = eduField.disabled;
        eduField.disabled = true;
        try {
            await task();
        } catch (error) {
            console.error('[Lehrgangsmeister]', error);
            status.textContent = keywordCancelled ? 'Abgebrochen.' : 'Fehler: ' + (error.message ?? error);
        } finally {
            keywordBusy = false;
            prefetchedPersonnelHtml.clear();
            participantTimings = null;
            cancelAction.disabled = true;
            if (keywordCancelled) status.textContent = 'Abgebrochen.';
            controls.forEach(control => { control.disabled = false; });
            eduField.disabled = educationWasDisabled;
        }
    };
    form.addEventListener('submit', event => {
        if (!keywordBusy) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        alert('Bitte warten, bis die Wachenauswahl abgeschlossen ist.');
    }, true);
    hideAtTarget.addEventListener('change', () => {
        void runKeywordAction(() => hideBuildingsAtTarget(getRenderedBuildings()));
    });
    container.querySelector('#jxn_keyword_load').addEventListener('click', () => {
        void runKeywordAction(() => loadMatching({ append: false }));
    });
    container.querySelector('#jxn_keyword_add').addEventListener('click', () => {
        void runKeywordAction(() => loadMatching({ append: true }));
    });
    container
        .querySelector('#jxn_keyword_select')
        .addEventListener('click', () => {
            void runKeywordAction(async () => {
            const buildings = getRenderedBuildings();
            if (!buildings.length) {
                status.textContent = 'Keine offenen Wachen zum Auswaehlen.';
                return;
            }
            const capacity = getDesiredCapacity() || 1;
            const startedAt = performance.now();
            participantTimings = { htmlWaitMs: 0, htmlApplyMs: 0 };
            const processed = await processTrainingBuildings(buildings, capacity, {
                lookahead: participantParallelism,
                cancelled: () => keywordCancelled,
                hasSpace: () => document.querySelectorAll('.schooling_checkbox:checked').length <
                    10 * parseInt(roomsSelection.value || '0', 10),
                progress: (building, count, total) => {
                    status.textContent = `${count + 1} / ${total}: ${building.caption} pruefen und auswaehlen …`;
                },
                select: selectPersonnelForBuilding,
                prepare: upcoming => {
                    // Counter and HTML preparation share the configured request
                    // limit. Selection stays strictly sequential.
                    for (const building of upcoming) {
                        void prepareTrainingBuilding(building.id, capacity).catch(console.error);
                    }
                },
                result: (building, result) => {
                    const panel = document.querySelector(
                        `.personal-select-heading[building_id="${building.id}"]`
                    )?.closest('.panel');
                    if (hideAtTarget.checked && result.covered >= capacity && !result.selected) {
                        panel?.style.setProperty('display', 'none');
                        if (panel) panel.dataset.nilspeHiddenAtTarget = 'true';
                    }
                }
            });
            status.textContent = `${processed.toLocaleString('de')} von ${buildings.length} Wachen verarbeitet ` +
                `(${((performance.now() - startedAt) / 1000).toFixed(1)} s, ${participantParallelism} parallel)`;
            status.title = `Warten auf Personallisten: ${(participantTimings.htmlWaitMs / 1000).toFixed(1)} s; ` +
                `Personaltabellen einsetzen: ${(participantTimings.htmlApplyMs / 1000).toFixed(1)} s`;
            console.info('[Lehrgangsmeister] Teilnehmerauswahl', { ...participantTimings,
                totalMs: performance.now() - startedAt, processed });
            });
        });
};

form?.addEventListener('submit', event => {
    if (schoolsLoaded) return;
    event.preventDefault();
    alert('Bitte zuerst die maximale Raumzahl eingeben und die Schulen laden.');
});

const loadSchools = () =>
    new Promise((resolve, reject) => {
    // only continue if we're in a school and the school has free classrooms
    if (form) resolve();
    else reject();
})
    .then(loadSchoolCatalogue)
    .then(schools => ({ buildings: currentBuildings, schools }))
    .then(({ buildings, schools }) => {
        currentBuildings = buildings;
        currentSchools = schools;
        roomLoadStatus.textContent = 'Raumauswahl aufbauen …';
        const listStart = performance.now();
        renderSpecificSchoolOptions(schools);
        roomLoadMetrics.schoolListMs = performance.now() - listStart;
        setRoomSelection(schools);
        renderKeywordAssigner();

        if (!schoolSelectionListenersAttached) {
            useSpecificSchoolsCheckbox.addEventListener('change', () => {
                renderSpecificSchoolOptions(currentSchools);
                setRoomSelection(currentSchools);
            });
            roomLimitInput.addEventListener('change', () =>
                setRoomSelection(currentSchools)
            );

            let updateTimeout;
            specificSchoolSelection.addEventListener('change', () => {
                if (updateTimeout) clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => setRoomSelection(currentSchools), 500);
            });
            schoolSelectionListenersAttached = true;
        }

        return { buildings, schools };
    })
    .then(({ buildings, schools }) => {
        if (CLASSES_ONLY_MODE) return schools;

        // building and staff selection already exists -> no need to manually add it
        if (document.querySelector('.personal-select-heading')) return schools;

        unsafeWindow.loadedBuildings = [];

        // create the field where buildings are put into
        const staffSelectHeading = document.createElement('h3');
        staffSelectHeading.textContent = 'Personal auswählen';
        const accordion = document.createElement('div');
        accordion.id = 'accordion';
        const staffBuildings = getStaffBuildingCandidates(
            buildings.filter(({ personal_count }) => personal_count > 0)
        ).toSorted(
                (a, b) =>
                    (b.personal_count ?? 0) - (a.personal_count ?? 0) ||
                    a.caption.localeCompare(b.caption)
            );
        const limitedStaffBuildings =
            getLimitedStaffBuildings(staffBuildings).toSorted((a, b) =>
                a.caption.localeCompare(b.caption)
            );
        const staffLimitHelp = document.createElement('p');
        staffLimitHelp.classList.add('help-block');
        staffLimitHelp.textContent = `${limitedStaffBuildings.length.toLocaleString('de')} von ${staffBuildings.length.toLocaleString('de')} Gebaeuden fuer die Personalauswahl geladen.`;
        limitedStaffBuildings
            .forEach(building => {
                const buildingDiv = document.createElement('div');
                buildingDiv.classList.add('panel', 'panel-default');

                const heading = document.createElement('div');
                heading.classList.add(
                    'panel-heading',
                    'personal-select-heading'
                );
                heading.setAttribute('building_id', building.id.toString());
                heading.setAttribute(
                    'href',
                    `/buildings/${building.id}/schooling_personal_select`
                );
                heading.textContent = building.caption;
                const headingRight = document.createElement('div');
                headingRight.classList.add('pull-right');
                const selectSpan = document.createElement('span');
                selectSpan.id = `personal-select-heading-building-${building.id}`;
                selectSpan.classList.add('personal-select-heading-building');
                selectSpan.setAttribute('building_id', building.id.toString());
                const currentLabel = document.createElement('span');
                currentLabel.classList.add('label', 'label-default');
                currentLabel.textContent = `${building.personal_count}\xa0Angestellte`;

                const body = document.createElement('div');
                body.classList.add('panel-body', 'hidden');
                body.setAttribute('building_id', building.id.toString());
                const loadingImg = document.createElement('img');
                loadingImg.classList.add('ajaxLoader');
                loadingImg.src = '/images/ajax-loader.gif';

                new MutationObserver((list, observer) => {
                    if (
                        list.some(records =>
                            Array.from(records.addedNodes).some(
                                el => el instanceof HTMLTableElement
                            )
                        )
                    ) {
                        observer.disconnect();
                        unsafeWindow.schooling_disable(
                            unsafeWindow.getSelectedEducationKey()
                        );
                    }
                }).observe(body, { childList: true });

                headingRight.append(selectSpan, currentLabel);
                heading.append(headingRight);
                body.append(loadingImg);
                buildingDiv.append(heading, body);
                accordion.append(buildingDiv);
            });

        document
            .querySelector('#alliance_cost')
            ?.after(staffSelectHeading, staffLimitHelp, accordion);

        const educationCosts = document.createElement('span');
        educationCosts.classList.add('label', 'label-success');
        educationCosts.textContent = '0\xa0Credits';
        document
            .querySelector('#schooling_free')
            ?.after(' Gesamtkosten:\xa0', educationCosts);

        // add functions to imitate the behaviour of own schools
        // fetch amount of educated staff
        let scrollTimeout;
        const loadVisibleEducatedCounters = () =>
            document
                .querySelectorAll(
                    '.personal-select-heading-building:not([data-education-loaded])'
                )
                .forEach(building => {
                    const rect = building.getBoundingClientRect();
                    // this building is not visible => do not load it
                    if (
                        rect.top <= 0 ||
                        rect.bottom >=
                            (unsafeWindow.innerHeight ||
                                document.documentElement.clientHeight)
                    ) {
                        return;
                    }
                    const buildingId = building.getAttribute('building_id');
                    const onlyNumber = parseInt(
                        eduField.value.split(':')[1],
                        10
                    );

                    fetch(
                        `/buildings/${schoolBuildingId}/schoolingEducationCheck?education=${onlyNumber}&only_building_id=${buildingId}`
                    )
                        .then(res =>
                            res.ok ? res.text() : Promise.reject(res)
                        )
                        .then(res => {
                            building.dataset.educationLoaded = 'true';
                            // the game uses eval and sends JS as response text 🥴
                            // eslint-disable-next-line no-eval
                            eval(res);
                        })
                        .catch(console.error);
                });
        const scrollEvent = () => {
            // if no education is selected, abort
            if (!eduField.value) return;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(loadVisibleEducatedCounters, 100);
        };
        document
            .querySelector('#iframe-inside-container')
            ?.addEventListener('scroll', scrollEvent);
        unsafeWindow.addEventListener('scroll', scrollEvent);

        // create the `schooling_disable` function
        unsafeWindow.schooling_disable ??= educationKey => {
            document
                .querySelectorAll('.schooling_checkbox:disabled')
                .forEach(checkbox => (checkbox.disabled = false));

            document
                .querySelectorAll(`.schooling_checkbox[${educationKey}="true"]`)
                .forEach(checkbox => {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                });
        };
        // create the `schooling_check_educated_counter` function
        unsafeWindow.schooling_check_educated_counter ??= () => {
            document
                .querySelectorAll('.personal-select-heading-building')
                .forEach(span => {
                    delete span.dataset.educationLoaded;
                });
            loadVisibleEducatedCounters();
        };
        // create the `free_space_for_personnel_selection` function
        unsafeWindow.free_space_for_personnel_selection ??= () => {
            return 10 * parseInt(roomsSelection.value);
        };
        // create the `is_free_place_available` function
        unsafeWindow.is_free_place_available ??= () =>
            parseInt(
                document.querySelector('#schooling_free')?.textContent ?? '0'
            ) > 0;
        // create the `update_personnel_counter_navbar` function
        unsafeWindow.update_personnel_counter_navbar ??= () => {
            const max = unsafeWindow.free_space_for_personnel_selection();
            const selected = document.querySelectorAll(
                '.schooling_checkbox:checked'
            ).length;
            const free = max - selected;
            const freeSpan = document.querySelector('#schooling_free');
            if (freeSpan) {
                freeSpan.textContent = free.toString();
            }
            const duration = getTrainingDuration();
            educationCosts.textContent = `${(selected * parseInt(form['alliance[cost]'].value ?? '0') * duration).toLocaleString()}\xa0Credits`;
        };
        unsafeWindow.update_personnel_counter_navbar();
        // create the `selectAvailable` function
        unsafeWindow.selectAvailable ??= (buildingId, withoutEducation) => {
            const free = parseInt(
                document.querySelector('#schooling_free')?.textContent ?? '0'
            );
            Array.from(
                document.querySelectorAll(
                    `#personal_table_${buildingId} .schooling_checkbox:not(:disabled):not(:checked)`
                )
            )
                .filter(checkbox => {
                    if (!withoutEducation) return true;
                    return (
                        (document
                            .querySelector(
                                `#school_personal_education_${checkbox.value}`
                            )
                            ?.textContent?.trim() ?? '') === ''
                    );
                })
                .slice(0, free)
                .forEach(checkbox => (checkbox.checked = true));
            unsafeWindow.update_personnel_counter_navbar();
        };
        unsafeWindow.update_schooling_free ??= () => {};
        unsafeWindow.update_costs =
            unsafeWindow.update_personnel_counter_navbar;

        unsafeWindow.getSelectedEducation ??= () => {
            const selectedOption = $('#education_select');
            // todo update when changed to dropdown
            const selectedValue = selectedOption.val();
            if (!selectedValue) {
                return [];
            }
            const valueSplit = selectedValue.split(':');
            if (valueSplit.length !== 2) {
                return [];
            }
            return valueSplit;
        };

        unsafeWindow.getSelectedEducationKey ??= () => {
            const educationKey = getSelectedEducation();
            if (educationKey.length !== 2) {
                return undefined;
            }
            return educationKey[0];
        };

        unsafeWindow.getSelectedEducationValue ??= () => {
            const educationKey = getSelectedEducation();
            if (educationKey.length !== 2) {
                return undefined;
            }
            return educationKey[1];
        };

        // open a building when clicking on the heading
        document.addEventListener('click', e => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const heading = target.closest('.personal-select-heading');
            if (!heading) return;

            // prevent incompatibility with Lehrgangszuweiser by BOS-Ernie
            if (
                heading.querySelector(
                    '.schooling-personnel-select-button, .schooling-personnel-reset-button'
                )
            ) {
                return;
            }

            const body = heading.nextElementSibling;
            body.classList.toggle('hidden');

            // has not been loaded yet
            // that may not be executed if other scripts do that too
            if (heading.matches(':has( + .panel-body .ajaxLoader)')) {
                const href = heading.getAttribute('href');
                unsafeWindow.loadedBuildings.push(href);
                fetch(href)
                    .then(res => res.text())
                    .then(html => {
                        // ohhh how secure dear game devs 🎶
                        // we need to use jQuery html here to execute the JS inside
                        $(body).html(html);
                        unsafeWindow.schooling_disable(
                            unsafeWindow.getSelectedEducationKey()
                        );
                    });
            }
        });

        // detect clicks on staff selectors
        document.addEventListener('click', e => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;

            const selectAvailable = target.closest(
                '.schooling_select_available'
            );
            const selectAvailableWithoutEducation = target.closest(
                '.schooling_select_available_without_education'
            );
            const btn = selectAvailable || selectAvailableWithoutEducation;
            if (!btn) return;

            e.preventDefault();
            btn.disabled = true;
            unsafeWindow.selectAvailable(
                btn.getAttribute('building_id'),
                !!selectAvailableWithoutEducation
            );
            btn.disabled = false;
        });

        // update the total costs when price per day per staff changes
        document
            .querySelector('#alliance_cost')
            ?.addEventListener('change', unsafeWindow.update_costs);

        document.dispatchEvent(
            new CustomEvent('lehrgangszuweiser:render-personnel-selectors')
        );
        document.dispatchEvent(
            new CustomEvent('ausbildungs-mausschoner:buildings-appended')
        );

        return schools;
    })
    .then(schools => {
        const authToken =
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        // replace the submit buttons
        // 1. find out which school will be filled with how much staff
        // 2. if own school: send request to create training for each school
        // 3. if alliance school: for each school create trainings and fill them
        const schoolNameMap = new Map();
        const getRooms = () => {
            /** @type {string[][]} */
            const allRooms = [];

            if (CLASSES_ONLY_MODE) {
                const roomCount = parseInt(roomsSelection.value || '0');
                const allStaff = Array.from(
                    document.querySelectorAll('.schooling_checkbox:checked')
                ).map(checkbox => checkbox.value);
                const roomsToOpen =
                    allowEmptyCheckbox.checked ?
                        roomCount
                    :   Math.ceil(allStaff.length / 10);
                for (let i = 0; i < roomsToOpen; i++) {
                    const room = allStaff.slice(i * 10, i * 10 + 10);
                    if (allowEmptyCheckbox.checked || room.length) {
                        allRooms.push(room);
                    }
                }

                const firstSelected = Array.from(schoolingRoomSelections).find(
                    ({ select }) => select.value !== '0'
                );
                if (firstSelected) {
                    firstSelected.input.click();
                    eduField.value = firstSelected.input.value;
                }

                return allRooms;
            } else if (allowEmptyCheckbox.checked) {
                const roomCount = parseInt(roomsSelection.value || '0');
                for (let i = 0; i < roomCount; i++) {
                    allRooms.push([]);
                }

                const firstSelected = Array.from(schoolingRoomSelections).find(
                    ({ select }) => select.value !== '0'
                );
                if (firstSelected) {
                    firstSelected.input.click();
                    eduField.value = firstSelected.input.value;
                }

                return allRooms;
            } else {
                const firstNonEmpty = Array.from(schoolingRoomSelections).find(
                    ({ select }) => select.value !== '0'
                );
                if (allowEmptyCheckbox.checked && firstNonEmpty) {
                    for (
                        let i = 0;
                        i < parseInt(firstNonEmpty.select.value);
                        i++
                    ) {
                        allRooms.push([]);
                    }
                    firstNonEmpty.input.click();
                    eduField.value = firstNonEmpty.input.value;
                    return allRooms;
                }

                /** @type {string[]} */
                const allStaff = Array.from(
                    document.querySelectorAll('.schooling_checkbox:checked')
                ).map(checkbox => checkbox.value);
                // slice staff into rooms of 10 peeps each
                for (let i = 0; i < allStaff.length; i += 10) {
                    allRooms.push(allStaff.slice(i, i + 10));
                }
                return allRooms;
            }
        };
        /**
         * @param {string[][]} rooms
         * @returns {Record<number, string[][]>}
         */
        const assignRoomsToSchools = rooms => {
            const roomsBySchool = {};
            for (const school of getLimitedSchools(getUsableSchools(schools))) {
                schoolNameMap.set(school.id.toString(), school.caption);
                const freeRooms = getFreeRooms(school);
                if (!freeRooms) continue;
                roomsBySchool[school.id] = rooms.splice(0, freeRooms);
                if (!rooms.length) break;
            }
            return roomsBySchool;
        };

        /**
         * @param {number|string} schoolId
         * @param {string[]} staff
         * @param {number} rooms
         * @param {string} education
         * @param {string} duration
         * @param {string} cost
         * @returns {Promise<Response>}
         */
        const openSchool = (
            schoolId,
            staff,
            rooms,
            education,
            duration,
            cost
        ) => {
            const schoolUrl = new URL(
                `/buildings/${schoolId}`,
                unsafeWindow.location.href
            );
            schoolUrl.searchParams.set('utf8', '✓');
            schoolUrl.searchParams.set('authenticity_token', authToken);
            schoolUrl.searchParams.set('education_select', education);
            schoolUrl.searchParams.set('alliance[duration]', duration);
            schoolUrl.searchParams.set('alliance[cost]', cost);
            schoolUrl.searchParams.set('building_rooms_use', rooms.toString());
            staff.forEach(id =>
                schoolUrl.searchParams.append('personal_ids[]', id)
            );
            schoolUrl.searchParams.set('commit', 'Ausbilden');
            return fetch(`/buildings/${schoolId}/education`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                referrer: schoolUrl.href.replace(/\?.*$/, ''),
                body: schoolUrl.search.replace(/^\?/, ''),
                method: 'POST',
                mode: 'cors',
            }).then(async response => {
                if (!response.ok) {
                    throw new Error(
                        `${response.status} ${response.statusText}`
                    );
                }

                const school = schools.find(
                    s => s.id.toString() === schoolId.toString()
                );
                if (school) {
                    school.schoolings ??= [];
                    for (let i = 0; i < rooms; i++) {
                        school.schoolings.push(undefined);
                    }
                    await persistSchoolState(school);
                }

                return response;
            });
        };

        /**
         * @param {number|string} schoolingId
         * @param {string[]} staff
         * @returns {Promise<Response>}
         */
        const fillRoom = (schoolingId, staff) => {
            const schoolingUrl = new URL(
                `/schoolings/${schoolingId}`,
                unsafeWindow.location.href
            );
            schoolingUrl.searchParams.set('utf8', '✓');
            schoolingUrl.searchParams.set('authenticity_token', authToken);
            staff.forEach(id =>
                schoolingUrl.searchParams.append('personal_ids[]', id)
            );
            schoolingUrl.searchParams.set('commit', 'Ausbilden');
            return fetch(`/schoolings/${schoolingId}/education`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                referrer: schoolingUrl.href.replace(/\?.*$/, ''),
                body: schoolingUrl.search.replace(/^\?/, ''),
                method: 'POST',
                mode: 'cors',
            }).catch(e => console.error(e));
        };

        const reqOr100ms = req =>
            Promise.all([req, new Promise(r => setTimeout(r, 100))])
                .then(([res]) => res)
                .catch(e => {
                    console.error(e);
                });

        const progressStyle = document.createElement('style');
        document.head.append(progressStyle);
        const setProgressStyle = staff => {
            const staffSelector = staff.map(s => `[value="${s}"]`).join(', ');
            progressStyle.textContent = `
             .panel:has(~ .panel .panel-body .schooling_checkbox:where(${staffSelector})) .panel-heading::before {
                 content: "✅";
                 text-align: center;
                 border-radius: .25em;
                 margin-right: 1em;
             }

             .panel-heading:has(+ .panel-body .schooling_checkbox:where(${staffSelector}))::before {
                 content: "⏳️";
                 text-align: center;
                 border-radius: .25em;
                 margin-right: 1em;
             }
             `;
        };

        const doTheDurchschloedeln = async () => {
            if (abortedDueToMultipleSchools) return alert(multipleSchoolsAlert);

            const roomPlan = assignRoomsToSchools(getRooms());
            const totalSchools = Object.keys(roomPlan).length;
            let totalStaff = 0;
            let filledSchools = 0;
            let emptyRooms = 0;
            let emptySchools = 0;
            for (const rooms of Object.values(roomPlan)) {
                const staff = rooms.flat().length;
                totalStaff += staff;

                if (staff) filledSchools++;

                const emptyRoomsInSchool = rooms.length - Math.ceil(staff / 10);
                emptyRooms += emptyRoomsInSchool;
                if (emptyRoomsInSchool) emptySchools++;
            }

            const education = eduField.value;
            const duration = form['alliance[duration]'].value;
            const cost = form['alliance[cost]'].value;

            if (
                SETTING_SHOW_CONFIRM_DIALOG &&
                !(await confirmDialog(
                    document
                        .querySelector(
                            `select[name="education_select"] option:checked`
                        )
                        ?.textContent?.trim() ?? '',
                    totalStaff,
                    filledSchools,
                    getTrainingDuration(),
                    emptyRooms,
                    emptySchools,
                    parseInt(cost),
                    document
                        .querySelector(
                            `#alliance_duration option[value="${duration}"]`
                        )
                        ?.textContent?.trim() ?? ''
                ))
            ) {
                return;
            }

            // disable all form elements and submission fields to prevent edits and double submissions
            form.querySelectorAll('input, select').forEach(
                input => (input.disabled = true)
            );
            form.classList.add(isDurchschloedelingClass);

            const currentStateSpan = document.createElement('span');
            currentStateSpan.classList.add('label', 'label-warning');
            currentStateSpan.style.setProperty('font-size', '14px');
            currentStateSpan.textContent = `0/${totalSchools.toLocaleString()} Schulen verarbeitet`;
            const progressWrapper = document.createElement('div');
            progressWrapper.classList.add('progress');
            progressWrapper.style.setProperty('margin-bottom', '0');
            progressWrapper.style.setProperty('width', '50%');
            const progressBar = document.createElement('div');
            progressBar.classList.add(
                'progress-bar',
                'progress-bar-striped',
                'active'
            );
            progressBar.style.setProperty('width', '0%');
            progressWrapper.append(progressBar);

            document
                .querySelector(
                    '.navbar.navbar-fixed-bottom div:has(> input[type=submit])'
                )
                .after(currentStateSpan, progressWrapper);

            const start = Date.now();
            let progress = 0;

            const doProgress = schoolId => {
                progress++;

                currentStateSpan.textContent = `${progress.toLocaleString()}/${totalSchools.toLocaleString()} Schulen verarbeitet [${schoolNameMap.get(schoolId)}]`;
                const percentage = progress / totalSchools;
                progressBar.style.setProperty('width', `${percentage * 100}%`);
                const elapsed = Date.now() - start;
                const remaining =
                    (elapsed / progress) * (totalSchools - progress);
                const endDate = new Date(Date.now() + remaining);
                progressBar.textContent = [
                    `${percentage.toLocaleString('de', { style: 'percent' })}`,
                    `${Math.ceil(remaining / 1000).toLocaleString('de')}\xa0s`,
                    `ETA: ${endDate.toLocaleTimeString('de')}`,
                ].join(' / ');
            };

            if (!Object.keys(roomPlan).length) return;
            if (isAllianceSchool) {
                for (const [schoolId, staff] of Object.entries(roomPlan)) {
                    const staffForSchool = staff.flat();
                    /** @type {Response} */
                    const res = await reqOr100ms(
                        openSchool(
                            schoolId,
                            [],
                            staff.length,
                            education,
                            duration,
                            cost
                        )
                    );
                    /** @type {number[]} */
                    const schoolingIds = [];
                    if (res.url.includes('/schoolings/')) {
                        schoolingIds.push(
                            parseInt(new URL(res.url).pathname.split('/')[2])
                        );
                    } else {
                        const schoolDoc = await res
                            .text()
                            .then(html =>
                                new DOMParser().parseFromString(
                                    html,
                                    'text/html'
                                )
                            );
                        schoolingIds.push(
                            ...Array.from(
                                schoolDoc.querySelectorAll(
                                    'td:has(.label-warning) + td[sortvalue="10"] + td span[id^="education_schooling_"]'
                                )
                            )
                                .map(span =>
                                    parseInt(
                                        span.id.split('_').pop()?.toString() ??
                                            '-1'
                                    )
                                )
                                .toSorted((a, b) => b - a)
                        );
                    }
                    let roomNum = 0;

                    await runWithConcurrency(
                        staff,
                        async room => {
                            if (!room.length) return;
                            await reqOr100ms(
                                fillRoom(schoolingIds.shift(), room)
                            );
                            roomNum++;
                            progressBar.style.setProperty(
                                'width',
                                ((progress + roomNum / staff.length) /
                                    totalSchools * 100) + '%'
                            );
                        },
                        { concurrency: 3, delay: 100 }
                    );

                    doProgress(schoolId, staffForSchool.length);
                }
            } else {
                // this is an own school
                for (const [schoolId, staff] of Object.entries(roomPlan)) {
                    const staffForSchool = staff.flat();
                    // setProgressStyle(staffForSchool);
                    await reqOr100ms(
                        openSchool(
                            schoolId,
                            staffForSchool,
                            staff.length,
                            education,
                            duration,
                            cost
                        )
                    );
                    doProgress(schoolId, staffForSchool.length);
                }
            }

            currentStateSpan.classList.replace(
                'label-warning',
                'label-success'
            );
            currentStateSpan.textContent = `${totalSchools.toLocaleString()} Schulen erfolgreich gefüllt! 😊`;

            setTimeout(() => {
                const nonEmpties = Array.from(schoolingRoomSelections).filter(
                    ({ select }) => select.value !== '0'
                );
                const firstEmpty = nonEmpties.shift();
                if (firstEmpty) firstEmpty.select.value = '0';
                if (allowEmptyCheckbox.checked && nonEmpties.length) {
                    currentStateSpan.remove();
                    progressWrapper.remove();
                    doTheDurchschloedeln();
                } else {
                    window.location.reload();
                }
            }, 2000);
        };

        if (!submitHandlerAttached) {
            form.addEventListener('submit', async e => {
                e.preventDefault();

                await doTheDurchschloedeln();
            });
            submitHandlerAttached = true;
        }
    })
    .then(result => {
        schoolsLoaded = true;
        return result;
    })
    .finally(() => {
        spinner.style.setProperty('display', 'none');
        schoolsLoading = false;
        loadSchoolsButton.disabled = false;
        if (schoolsLoaded) {
            loadSchoolsButton.textContent = 'Neu laden';
            removePersonnelSelectionUi();
            updateSelectStyle();
            const total = performance.now() - roomLoadStartedAt;
            roomLoadMetrics.totalJsMs = total;
            roomLoadStatus.textContent = `Daten bereit (${(total / 1000).toFixed(1)} s), Anzeige messen …`;
            roomLoadStatus.title = `Speicher oeffnen: ${(roomLoadMetrics.openMs / 1000).toFixed(2)} s; ` +
                `Aktualisierung inkl. Warten/Speichern: ${(roomLoadMetrics.apiMs / 1000).toFixed(2)} s; ` +
                `Schulen lesen: ${(roomLoadMetrics.readMs / 1000).toFixed(2)} s; ` +
                `Schulliste: ${(roomLoadMetrics.schoolListMs / 1000).toFixed(2)} s; ` +
                `Dropdown: ${(roomLoadMetrics.dropdownMs / 1000).toFixed(2)} s`;
            console.info('[Lehrgangsmeister] Raeume laden', { ...roomLoadMetrics, totalMs: total });
            finishRoomPaintMeasurement(roomLoadRun);
        } else {
            loadSchoolsButton.textContent = 'Laden';
            roomsSelection.disabled = true;
            roomLoadStatus.textContent = 'Laden fehlgeschlagen';
        }
    });

// Park the original full list before the first room load, not after it.
removePersonnelSelectionUi();
document.addEventListener('click', event => {
    const heading = event.target?.closest?.('.personal-select-heading[building_id]');
    if (heading) restorePersonnelRows(heading.getAttribute('building_id'));
}, true);

loadSchoolsButton.addEventListener('click', () => {
    if (schoolsLoading) return;
    if (!getRoomLimit()) {
        alert('Bitte zuerst eine maximale Raumzahl groesser 0 eingeben.');
        roomLimitInput.focus();
        return;
    }
    schoolsLoading = true;
    roomLoadRun++;
    roomMeasurementActive = true;
    roomLongTasks.length = 0;
    roomTaskObserver?.takeRecords();
    roomLoadStartedAt = performance.now();
    roomLoadMetrics = {};
    roomsSelection.disabled = true;
    schoolsLoaded = false;
    loadSchoolsButton.disabled = true;
    loadSchoolsButton.textContent = 'Lade...';
    GM_setValue(roomLimitInput.dataset.storageKey, getRoomLimit());
    spinner.style.removeProperty('display');
    loadSchools().catch(error => {
        console.error(error);
        alert('Die Schulen konnten nicht geladen werden. Details stehen in der Browser-Konsole.');
    });
});
})();
