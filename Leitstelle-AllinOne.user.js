
// ==UserScript==
// @name         LSS All in One
// @namespace    NilsPe.lss.all.in.one
// @version      0.4.4
// @description  Leitstellenübergreifende Verwaltung mit Vorlagen, API-v2-Cache und Live-Synchronisierungsstatus
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @match        https://*.leitstellenspiel.de/*
// @match        https://leitstellenspiel.de/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';

    const VERSION = '0.4.4';
    const PREFIX = '[LSS All in One]';
    const PAGE_URL = '/settings/index?lss_all_in_one=1';

    const PAGE_SIZE = 100;
    const PREVIEW_BATCH = 100;
    const PREVIEW_DETAIL_LIMIT = 100;
    const MAX_LOG_LINES = 2500;
    const ACTION_DELAY = 350;

    const TABS = [
        ['centers', 'Leitstellen'],
        ['buildings', 'Gebäude'],
        ['extensions', 'Erweiterungen'],
        ['vehicles', 'Fahrzeuge & Personal'],
        ['templates', 'Vorlagen'],
        ['run', 'Ablauf']
    ];

    const CREW_MODES = [
        ['both', 'Zuweisen und entfernen'],
        ['add', 'Nur zuweisen'],
        ['remove', 'Nur entfernen']
    ];

    const STATE_OPTIONS = [
        ['', 'Unverändert'],
        ['on', 'Aktiv'],
        ['off', 'Inaktiv']
    ];

    const BUILDING_NAMES = new Map([
        [0, 'Feuerwache'],
        [1, 'Feuerwehrschule'],
        [2, 'Rettungswache'],
        [3, 'Rettungsschule'],
        [4, 'Krankenhaus'],
        [5, 'Rettungshubschrauber-Station'],
        [6, 'Polizeiwache'],
        [7, 'Leitstelle'],
        [8, 'Polizeischule'],
        [9, 'THW-Ortsverband'],
        [10, 'THW Bundesschule'],
        [11, 'Bereitschaftspolizei'],
        [12, 'Schnelleinsatzgruppe (SEG)'],
        [13, 'Polizeihubschrauberstation'],
        [15, 'Wasserrettung'],
        [16, 'Verbandszellen'],
        [17, 'Polizei-Sondereinheiten'],
        [18, 'Feuerwache (Kleinwache)'],
        [19, 'Polizeiwache (Kleinwache)'],
        [20, 'Rettungswache (Kleinwache)'],
        [21, 'Rettungshundestaffel'],
        [24, 'Reiterstaffel'],
        [25, 'Bergrettung'],
        [26, 'Seenotrettungswache'],
        [27, 'Schule für Seefahrt und Seenotrettung'],
        [28, 'Hubschrauberstation (Seenotrettung)'],
        [29, 'Autobahnpolizei']
    ]);

    const QUALIFICATIONS = new Map([
        [12, 'gw_messtechnik'],
        [27, 'gw_gefahrgut'],
        [29, 'notarzt'],
        [31, 'notarzt'],
        [33, 'gw_hoehenrettung'],
        [34, 'elw2'],
        [35, 'police_einsatzleiter'],
        [40, 'thw_zugtrupp'],
        [42, 'thw_raumen'],
        [45, 'thw_raumen'],
        [46, 'wechsellader'],
        [51, 'police_fukw'],
        [53, 'dekon_p'],
        [55, 'lna'],
        [56, 'orgl'],
        [57, 'fwk'],
        [59, 'seg_elw'],
        [60, 'seg_gw_san'],
        [61, 'polizeihubschrauber'],
        [63, 'gw_taucher'],
        [64, 'gw_wasserrettung'],
        [69, 'gw_taucher'],
        [72, 'police_wasserwerfer'],
        [74, 'notarzt'],
        [75, 'arff'],
        [76, 'rettungstreppe'],
        [79, 'police_sek'],
        [80, 'police_sek'],
        [81, 'police_mek'],
        [82, 'police_mek'],
        [83, 'werkfeuerwehr'],
        [84, 'werkfeuerwehr'],
        [85, 'werkfeuerwehr'],
        [86, 'werkfeuerwehr'],
        [91, 'seg_rescue_dogs'],
        [93, 'thw_rescue_dogs'],
        [94, 'k9'],
        [95, 'police_motorcycle'],
        [98, 'criminal_investigation'],
        [99, 'water_damage_pump'],
        [100, 'water_damage_pump'],
        [103, 'police_service_group_leader'],
        [109, 'heavy_rescue'],
        [122, 'thw_energy_supply'],
        [123, 'water_damage_pump'],
        [125, 'thw_drone'],
        [126, 'fire_drone'],
        [127, 'seg_drone'],
        [128, 'fire_drone'],
        [131, 'care_service'],
        [133, 'care_service_equipment'],
        [134, 'police_horse'],
        [135, 'police_horse'],
        [137, 'police_horse'],
        [140, 'fire_care_service'],
        [144, 'thw_command'],
        [145, 'thw_command'],
        [147, 'thw_command'],
        [148, 'thw_command'],
        [149, 'notarzt'],
        [151, 'mountain_command'],
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

    // ============================================================
    // ERWEITERUNGEN
    // ============================================================

    function numbered(label, ids) {
        return ids.map((value, index) => ({
            value,
            name: `${label} ${index + 1}`
        }));
    }

    const FIRE_EXTENSIONS = [
        { value: 0, name: 'Rettungsdienst' },
        ...numbered(
            'Abrollbehälter',
            [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]
        ),
        { value: 6, name: 'Wasserrettung' },
        { value: 8, name: 'Flughafen' },
        { value: 9, name: 'Großwache' },
        { value: 13, name: 'Werkfeuerwehr' },
        { value: 14, name: 'NEA50' },
        { value: 15, name: 'NEA200' },
        { value: 16, name: 'Lüfter' },
        { value: 18, name: 'Drohnen-Erweiterung' },
        { value: 19, name: 'Verpflegungsdienst' },
        ...numbered(
            'Anhänger-Stellplatz',
            [20, 21, 22, 23, 24]
        ),
        { value: 25, name: 'Bahnrettung' }
    ];

    const POLICE_EXTENSIONS = [
        ...numbered(
            'Zelle',
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        ),
        { value: 10, name: 'Diensthundestaffel' },
        { value: 11, name: 'Kriminalpolizei' },
        { value: 12, name: 'Dienstgruppenleitung' },
        { value: 13, name: 'Motorradstaffel' },
        { value: 14, name: 'Großwache' },
        { value: 15, name: 'Großgewahrsam' }
    ];

    const BEPOL_EXTENSIONS = [
        { value: 0, name: '2. Zug der Hundertschaft' },
        { value: 1, name: '3. Zug der Hundertschaft' },
        {
            value: 2,
            name: 'Sonderfahrzeug: Gefangenenkraftwagen'
        },
        {
            value: 3,
            name: 'Technischer Zug: Wasserwerfer'
        },
        { value: 4, name: 'SEK: 1. Zug' },
        { value: 5, name: 'SEK: 2. Zug' },
        { value: 6, name: 'MEK: 1. Zug' },
        { value: 7, name: 'MEK: 2. Zug' },
        { value: 8, name: 'Diensthundestaffel' },
        { value: 9, name: 'Reiterstaffel' },
        { value: 10, name: 'LauKW' }
    ];

    const THW_EXTENSIONS = [
        '1. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung',
        '1. Technischer Zug: Zugtrupp',
        'Fachgruppe Räumen',
        'Fachgruppe Wassergefahren',
        '2. Technischer Zug - Grundvoraussetzungen',
        '2. Technischer Zug: Fachgruppe Notversorgung/Notinstandsetzung',
        '2. Technischer Zug: Zugtrupp',
        'Fachgruppe Ortung',
        'Fachgruppe Wasserschaden/Pumpen',
        'Fachgruppe schwere Bergung',
        'Fachgruppe Elektroversorgung',
        'Ortsverbands-Mannschaftstransportwagen',
        'Trupp Unbemannte Luftfahrtsysteme',
        'Fachzug Führung und Kommunikation'
    ].map((name, value) => ({ name, value }));

    const HOSPITAL_EXTENSIONS = [
        'Allgemeine Innere',
        'Allgemeine Chirurgie',
        'Gynäkologie',
        'Urologie',
        'Unfallchirurgie',
        'Neurologie',
        'Neurochirurgie',
        'Kardiologie',
        'Kardiochirurgie',
        'Großkrankenhaus'
    ].map((name, value) => ({ name, value }));

    const SEG_EXTENSIONS = [
        'Führung',
        'Sanitätsdienst',
        'Wasserrettungs-Erweiterung',
        'Rettungshundestaffel',
        'SEG Drohne',
        'Betreuungs- und Verpflegungsdienst',
        'Technik und Sicherheit'
    ].map((name, value) => ({ name, value }));

    const EXTENSIONS = new Map([
        [0, FIRE_EXTENSIONS],
        [18, FIRE_EXTENSIONS],
        [2, [{ value: 0, name: 'Großwache' }]],
        [20, [{ value: 0, name: 'Großwache' }]],
        [4, HOSPITAL_EXTENSIONS],
        [6, POLICE_EXTENSIONS],
        [19, POLICE_EXTENSIONS],
        [9, THW_EXTENSIONS],
        [11, BEPOL_EXTENSIONS],
        [12, SEG_EXTENSIONS]
    ]);

    function extensionName(buildingType, type) {
        return (
            EXTENSIONS.get(Number(buildingType)) ?? []
        ).find(item =>
            Number(item.value) === Number(type)
        )?.name ?? `Erweiterung ${type}`;
    }

    // ============================================================
    // HELFER
    // ============================================================

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    const yieldToBrowser = () =>
        new Promise(resolve => setTimeout(resolve, 0));

    const format = value =>
        Number(value).toLocaleString('de-DE');

    function el(tag, className = '', text = '') {
        const result = document.createElement(tag);

        if (className) result.className = className;
        if (text) result.textContent = text;

        return result;
    }

    function button(text, kind = 'default') {
        const result = el(
            'button',
            `btn btn-${kind} aio-button`,
            text
        );

        result.type = 'button';
        return result;
    }

    function input(type = 'text', placeholder = '') {
        const result = el('input', 'form-control');

        result.type = type;
        result.placeholder = placeholder;

        if (type === 'number') {
            result.min = '0';
            result.step = '1';
        }

        return result;
    }

    function select(options = []) {
        const result = el('select', 'form-control');

        for (const [value, name] of options) {
            const option = el('option', '', name);
            option.value = String(value);
            result.append(option);
        }

        return result;
    }

    function field(title, control) {
        const wrapper = el('label', 'aio-field');

        wrapper.append(
            el('span', '', title),
            control
        );

        return wrapper;
    }

    function row(...children) {
        const result = el('div', 'aio-row');
        result.append(...children);
        return result;
    }

    function panel(title, description = '') {
        const result = el('section', 'aio-panel');
        result.append(el('h2', '', title));

        if (description) {
            result.append(
                el('p', 'aio-muted', description)
            );
        }

        return result;
    }

    function numberValue(control) {
        if (!control.checkValidity()) {
            throw new Error(
                'Bitte gültige ganze Zahlen eingeben.'
            );
        }

        return control.value === ''
            ? null
            : Number(control.value);
    }

    function stateValue(control) {
        return control.value === ''
            ? null
            : control.value === 'on';
    }

    function stateOption(value) {
        return value == null
            ? ''
            : value ? 'on' : 'off';
    }

    function csrf() {
        return document.querySelector(
            'meta[name="csrf-token"]'
        )?.content ?? '';
    }

    function extract(value) {
        return value &&
            Object.prototype.hasOwnProperty.call(
                value,
                'result'
            )
            ? value.result
            : value;
    }

    function extensionAt(building, type) {
        if (!Array.isArray(building.extensions)) {
            throw new Error(
                `Erweiterungsbestand von #${building.id} fehlt.`
            );
        }

        return building.extensions.find(
            item => Number(item.type_id) === Number(type)
        );
    }

    function cachedLevel(building) {
        for (const key of [
            'level',
            'building_level',
            'current_level'
        ]) {
            const value = building[key];

            if (
                value != null &&
                value !== '' &&
                Number.isSafeInteger(Number(value))
            ) {
                return Number(value);
            }
        }

        return null;
    }

    function dispatchId(building) {
        return Number(
            building.leitstelle_building_id ??
            building.dispatch_center_id ??
            building.dispatch_center_building_id ??
            0
        );
    }

    // ============================================================
    // SERVERFUNKTIONEN
    // ============================================================

    async function getDocument(url) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(
                `${url}: HTTP ${response.status}`
            );
        }

        return new DOMParser().parseFromString(
            await response.text(),
            'text/html'
        );
    }

    async function getLiveBuilding(id) {
        const response = await fetch(
            `/api/buildings/${id}`,
            {
                credentials: 'same-origin',
                cache: 'no-store'
            }
        );

        if (!response.ok) {
            throw new Error(
                `Gebäude #${id}: HTTP ${response.status}`
            );
        }

        const result = extract(
            await response.json()
        );

        const building = Array.isArray(result)
            ? result.find(item => Number(item.id) === id)
            : result;

        if (Number(building?.id) !== id) {
            throw new Error(
                `Gebäude #${id} konnte nicht bestätigt werden.`
            );
        }

        return building;
    }

    async function confirm(read, matches, label) {
        for (const pause of [0, 500, 1200]) {
            if (pause) await sleep(pause);

            const value = await read();

            if (matches(value)) {
                return value;
            }
        }

        throw new Error(
            `${label} konnte nicht bestätigt werden.`
        );
    }

    async function liveLevel(id) {
        const doc = await getDocument(
            `/buildings/${id}`
        );

        for (const dt of doc.querySelectorAll('dt')) {
            const title = dt.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

            if (
                !/^(ausbaustufe|gebäudestufe|gebaeudestufe|stufe):?$/
                    .test(title)
            ) {
                continue;
            }

            let next = dt.nextElementSibling;

            while (next && next.tagName !== 'DD') {
                if (next.tagName === 'DT') {
                    next = null;
                    break;
                }

                next = next.nextElementSibling;
            }

            const match = next?.textContent
                .trim()
                .match(/^(?:Stufe\s*:?\s*)?(\d+)\b/i);

            if (match) return Number(match[1]);
        }

        for (const dd of doc.querySelectorAll('dd')) {
            const match = dd.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .match(/^Stufe:\s*(\d+)\b/i);

            if (match) return Number(match[1]);
        }

        throw new Error(
            `Ausbaustufe von Gebäude #${id} unbekannt.`
        );
    }

    async function creditPost(url, method = 'get') {
        const token = csrf();

        if (!token) {
            throw new Error('CSRF-Token fehlt.');
        }

        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type':
                    'application/x-www-form-urlencoded; charset=UTF-8',
                'X-CSRF-Token': token,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: new URLSearchParams({
                _method: method,
                authenticity_token: token
            }),
            redirect: 'manual'
        });

        if (
            response.type !== 'opaqueredirect' &&
            response.status !== 0 &&
            !response.ok &&
            ![302, 303].includes(response.status)
        ) {
            throw new Error(
                `Anfrage fehlgeschlagen: HTTP ${response.status}`
            );
        }
    }

    async function extensionOffers(id) {
        const doc = await getDocument(
            `/buildings/${id}`
        );

        const offers = new Map();

        for (const link of doc.querySelectorAll(
            'a[href*="/extension/credits/"]'
        )) {
            const match = link.getAttribute('href')
                ?.match(/\/extension\/credits\/(\d+)/);

            if (match) {
                offers.set(
                    Number(match[1]),
                    link.href
                );
            }
        }

        return offers;
    }

    async function extensionToggleUrl(id, type) {
        const doc = await getDocument(
            `/buildings/${id}`
        );

        for (const link of doc.querySelectorAll(
            'a[href*="/extension_ready/"]'
        )) {
            const match = link.getAttribute('href')
                ?.match(/\/extension_ready\/(\d+)/);

            if (Number(match?.[1]) === type) {
                return link.href;
            }
        }

        throw new Error(
            `Erweiterung ${type}: Umschaltlink fehlt.`
        );
    }

    async function toggleBuilding(id) {
        const doc = await getDocument(
            `/buildings/${id}`
        );

        const link = doc.querySelector(
            `a[href*="/buildings/${id}/active"],` +
            'a[href$="/active"][data-method],' +
            'a.btn[href$="/active"]'
        );

        if (!link?.href) {
            throw new Error(
                `Gebäude #${id}: Umschaltlink fehlt.`
            );
        }

        const response = await fetch(link.href, {
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            throw new Error(
                `Gebäudestatus HTTP ${response.status}`
            );
        }
    }

    async function currentMax(vehicleId) {
        const doc = await getDocument(
            `/vehicles/${vehicleId}/edit`
        );

        const value = doc.querySelector(
            '[name="vehicle[personal_max]"]'
        )?.value;

        if (
            value == null ||
            value === '' ||
            !Number.isInteger(Number(value))
        ) {
            throw new Error(
                `Maximalpersonal #${vehicleId} unbekannt.`
            );
        }

        return Number(value);
    }

    async function setMax(vehicleId, value) {
        const token = csrf();

        if (!token) {
            throw new Error('CSRF-Token fehlt.');
        }

        const response = await fetch(
            `/vehicles/${vehicleId}`,
            {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-CSRF-Token': token,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: new URLSearchParams({
                    _method: 'put',
                    authenticity_token: token,
                    'vehicle[personal_max]': String(value)
                }),
                redirect: 'manual'
            }
        );

        if (
            response.type !== 'opaqueredirect' &&
            response.status !== 0 &&
            !response.ok &&
            ![302, 303].includes(response.status)
        ) {
            throw new Error(
                `Maximalpersonal HTTP ${response.status}`
            );
        }
    }

    async function crewDocument(vehicleId) {
        return getDocument(
            `/vehicles/${vehicleId}/zuweisung`
        );
    }

    function assignedRows(doc) {
        return [
            ...doc.querySelectorAll('tr')
        ].filter(row =>
            row.querySelector('a.btn-assigned')
        );
    }

    function matchesQualification(row, qualification) {
        if (!qualification) {
            const schooling =
                row.children?.[1]?.textContent
                    .trim()
                    .toLowerCase() ?? '';

            return schooling === '' ||
                schooling === '-';
        }

        return (
            row.dataset.filterableBy ?? ''
        ).includes(qualification);
    }

    function suitableCrew(doc, vehicleType) {
        const qualification = QUALIFICATIONS.get(
            Number(vehicleType)
        );

        const assigned = assignedRows(doc).filter(
            row => matchesQualification(
                row,
                qualification
            )
        );

        const available = [
            ...doc.querySelectorAll('tr')
        ].filter(row => {
            const link = row.querySelector(
                'a.btn-success'
            );

            const course =
                row.children?.[2]?.textContent
                    .trim() ?? '';

            return (
                link &&
                matchesQualification(
                    row,
                    qualification
                ) &&
                !course.startsWith('Im Unterricht')
            );
        });

        return { assigned, available };
    }

    async function changeCrew(
        vehicle,
        target,
        phase,
        act,
        check
    ) {
        const adding = phase === 'add';
        const read = () => crewDocument(vehicle.id);

        let doc = await read();

        while (
            adding
                ? assignedRows(doc).length < target
                : assignedRows(doc).length > target
        ) {
            check();

            const crew = suitableCrew(
                doc,
                vehicle.vehicle_type
            );

            const assigned = assignedRows(doc);

            const candidate = adding
                ? crew.available[0]
                : assigned.findLast(
                    row => !crew.assigned.includes(row)
                ) ?? assigned.at(-1);

            const link = candidate?.querySelector(
                adding
                    ? 'a.btn-success'
                    : 'a.btn-assigned'
            );

            if (!link?.href) {
                throw new Error(
                    `Fahrzeug #${vehicle.id}: ` +
                    (adding
                        ? 'Nicht genug geeignetes Personal.'
                        : 'Kein Personal zum Entfernen gefunden.')
                );
            }

            const url = new URL(link.href);

            if (
                url.origin !== location.origin ||
                !url.pathname.startsWith(
                    `/vehicles/${vehicle.id}/`
                )
            ) {
                throw new Error(
                    'Unerwarteter Personal-Zuweisungslink.'
                );
            }

            const expected = assigned.length +
                (adding ? 1 : -1);

            await act(
                `Fahrzeug #${vehicle.id}: Personal ` +
                (adding ? 'zuweisen' : 'entfernen'),
                async () => {
                    const response = await fetch(
                        url.href,
                        {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'X-CSRF-Token': csrf(),
                                'X-Requested-With':
                                    'XMLHttpRequest'
                            }
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            `Personaländerung HTTP ${response.status}`
                        );
                    }
                }
            );

            doc = await confirm(
                read,
                page =>
                    assignedRows(page).length === expected,
                'Personaländerung'
            );
        }
    }

    // ============================================================
    // HAUPTOBERFLÄCHE
    // ============================================================

    async function mount(root) {
        const account = await getCurrentAccountId();

        const templateKey =
            `nilspe.mastermind.templates.${account}`;

        const centersKey =
            `nilspe.allinone.centers.${account}`;

        let templates = await GM.getValue(
            templateKey,
            {}
        );

        if (
            !templates ||
            typeof templates !== 'object' ||
            Array.isArray(templates)
        ) {
            templates = {};
        }

        const storedCenters = await GM.getValue(
            centersKey,
            []
        );

        const db = await openDb();

        let buildings = [];
        let buildingById = new Map();
        let buildingsByType = new Map();
        let centerBuildings = [];

        let vehicleTypes = [];
        let vehicleSnapshot = null;
        let vehiclesByBuilding = new Map();

        const selectedCenters = new Set(
            Array.isArray(storedCenters)
                ? storedCenters.map(Number)
                : []
        );

        const selectedBuildings = new Set();

        let stationPageIndex = 0;
        let centerPageIndex = 0;

        let prepared = null;
        let busy = false;
        let running = false;
        let cancelled = false;

        // ========================================================
        // BEZEICHNUNGEN
        // ========================================================

        function buildingLabel(id) {
            const building = buildingById.get(
                Number(id)
            );

            const name = String(
                building?.caption ??
                building?.name ??
                ''
            ).trim();

            return name
                ? `${name} (${id})`
                : `Gebäude (${id})`;
        }

        // ========================================================
        // PROTOKOLL
        // ========================================================

        const logLines = [];
        let pendingLines = [];
        let flushScheduled = false;

        const logBox = el('pre', 'aio-log');
        logBox.setAttribute('aria-live', 'polite');

        function flushLog() {
            flushScheduled = false;

            if (!pendingLines.length) return;

            logLines.push(...pendingLines);
            pendingLines = [];

            if (logLines.length > MAX_LOG_LINES) {
                logLines.splice(
                    0,
                    logLines.length - MAX_LOG_LINES
                );
            }

            logBox.textContent = logLines.join('\n');
            logBox.scrollTop = logBox.scrollHeight;
        }

        function report(message) {
            const time = new Date()
                .toLocaleTimeString('de-DE');

            pendingLines.push(
                `[${time}] ${message}`
            );

            if (!flushScheduled) {
                flushScheduled = true;
                requestAnimationFrame(flushLog);
            }
        }

        function clearLog() {
            logLines.length = 0;
            pendingLines = [];

            logBox.textContent = '';
            flushScheduled = false;
        }

        // ========================================================
        // LAYOUT
        // ========================================================

        const header = el('header', 'aio-header');
        const brand = el('div', 'aio-brand');

        brand.append(
            el('h1', '', 'LSS All in One'),
            el(
                'p',
                '',
                'Leitstellenübergreifende Verwaltung'
            )
        );

        header.append(
            brand,
            el('span', 'aio-version', `v${VERSION}`)
        );

        const nav = el('div', 'aio-tabs');
        const content = el('div', 'aio-content');
        const footer = el('div', 'aio-footer');

        const status = el(
            'span',
            'aio-status',
            'Initialisierung …'
        );

        const progress = el('div', 'aio-progress');
        const progressFill = el(
            'div',
            'aio-progress-fill'
        );

        progress.append(progressFill);

        const refreshButton = button(
            'API-Daten aktualisieren'
        );

        const previewButton = button(
            'Vorschau erstellen',
            'primary'
        );

        const startButton = button(
            'Ablauf starten',
            'success'
        );

        const stopButton = button(
            'Nach dem laufenden Schritt stoppen',
            'danger'
        );

        startButton.disabled = true;
        stopButton.disabled = true;

        footer.append(
            refreshButton,
            previewButton,
            startButton,
            stopButton,
            status
        );

        // ========================================================
        // NEU: API-LIVE-STATUS
        // ========================================================

        const syncPanel = el(
            'section',
            'aio-sync-panel'
        );

        syncPanel.hidden = true;

        const syncHeading = el(
            'div',
            'aio-sync-heading'
        );

        const syncTitle = el(
            'strong',
            '',
            'API-Synchronisierung'
        );

        const syncPhase = el(
            'span',
            'aio-sync-phase',
            'Initialisierung'
        );

        syncHeading.append(
            syncTitle,
            syncPhase
        );

        const syncGrid = el(
            'div',
            'aio-sync-grid'
        );

        const syncPage = el(
            'strong',
            '',
            '0'
        );

        const syncRecords = el(
            'strong',
            '',
            '0'
        );

        const syncPageSize = el(
            'strong',
            '',
            '0'
        );

        function syncMetric(title, value) {
            const item = el(
                'div',
                'aio-sync-metric'
            );

            item.append(
                el('small', '', title),
                value
            );

            return item;
        }

        syncGrid.append(
            syncMetric('API-Seite', syncPage),
            syncMetric('Datensätze geladen', syncRecords),
            syncMetric('Seitengröße', syncPageSize)
        );

        const syncDescription = el(
            'div',
            'aio-sync-description',
            'Bereite Synchronisierung vor …'
        );

        const syncBar = el(
            'div',
            'aio-sync-bar'
        );

        const syncBarFill = el(
            'div',
            'aio-sync-bar-fill'
        );

        syncBar.append(syncBarFill);

        syncPanel.append(
            syncHeading,
            syncGrid,
            syncDescription,
            syncBar
        );

        root.append(
            header,
            nav,
            syncPanel,
            content,
            footer,
            progress,
            logBox
        );

        /*
         * Die Skriptbasis veröffentlicht:
         *
         * nilspe-sync-progress
         *
         * detail.storeName
         * detail.page
         * detail.recordCount
         * detail.pageSize
         * detail.fullSync
         * detail.retrying
         *
         * Die Gesamtseitenzahl ist nicht bekannt.
         * Deshalb zeigen wir keinen erfundenen
         * Prozentwert an.
         */

        let activeSync = null;
        let lastSyncUpdate = 0;

        const SYNC_NAMES = {
            buildings: 'Gebäude-API v2',
            vehicles: 'Fahrzeug-API v2',
            allianceBuildings: 'Verbandsgebäude-API v2',
            pois: 'POI-API v2'
        };

        function beginSync(storeName) {
            activeSync = storeName;
            lastSyncUpdate = 0;

            syncPanel.hidden = false;

            syncTitle.textContent =
                `${SYNC_NAMES[storeName] ?? storeName} wird synchronisiert`;

            syncPhase.textContent =
                'Daten werden geladen';

            syncPage.textContent = '0';
            syncRecords.textContent = '0';
            syncPageSize.textContent = '–';

            syncDescription.textContent =
                'Warte auf die nächsten API-Datensätze …';

            syncBar.classList.add(
                'aio-sync-indeterminate'
            );

            setStatus(
                `${SYNC_NAMES[storeName] ?? storeName}: Synchronisierung läuft`
            );
        }

        function finishSync(storeName, count = null) {
            if (activeSync !== storeName) {
                return;
            }

            syncTitle.textContent =
                `${SYNC_NAMES[storeName] ?? storeName} geladen`;

            syncPhase.textContent = 'Abgeschlossen';

            if (count != null) {
                syncRecords.textContent = format(
                    count
                );
            }

            syncDescription.textContent =
                'Synchronisierung abgeschlossen. ' +
                'Daten stehen im lokalen Cache zur Verfügung.';

            syncBar.classList.remove(
                'aio-sync-indeterminate'
            );

            syncBarFill.style.width = '100%';

            activeSync = null;
        }

        function syncFailed(storeName, message) {
            if (activeSync !== storeName) {
                return;
            }

            syncPhase.textContent = 'Fehler';

            syncDescription.textContent = message;

            syncBar.classList.remove(
                'aio-sync-indeterminate'
            );

            activeSync = null;
        }

        function onSyncProgress(event) {
            const detail = event.detail ?? {};

            if (
                !activeSync ||
                detail.storeName !== activeSync
            ) {
                return;
            }

            /*
             * Ein Update pro ca. 100 ms reicht
             * für die Oberfläche aus.
             */
            const now = performance.now();

            if (
                now - lastSyncUpdate < 100 &&
                !detail.retrying
            ) {
                return;
            }

            lastSyncUpdate = now;

            syncPage.textContent = format(
                detail.page ?? 0
            );

            syncRecords.textContent = format(
                detail.recordCount ?? 0
            );

            syncPageSize.textContent = format(
                detail.pageSize ?? 0
            );

            if (detail.retrying) {
                syncPhase.textContent =
                    'Wiederholung';

                syncDescription.textContent =
                    'Die API-Anfrage wird mit einer ' +
                    'kleineren Seitengröße wiederholt.';
            } else {
                syncPhase.textContent =
                    detail.fullSync
                        ? 'Vollständige Synchronisierung'
                        : 'Änderungen synchronisieren';

                syncDescription.textContent =
                    `Seite ${format(detail.page ?? 0)} · ` +
                    `${format(detail.recordCount ?? 0)} ` +
                    'Datensätze verarbeitet';
            }

            setStatus(
                `${SYNC_NAMES[activeSync] ?? activeSync}: ` +
                `${format(detail.recordCount ?? 0)} Datensätze`
            );
        }

        window.addEventListener(
            'nilspe-sync-progress',
            onSyncProgress
        );

        // ========================================================
        // TAB-NAVIGATION
        // ========================================================

        const pages = new Map();

        for (const [id, label] of TABS) {
            const tab = button(label);
            tab.dataset.tab = id;

            const page = el('div', 'aio-page');
            page.hidden = true;

            nav.append(tab);
            content.append(page);

            pages.set(id, page);

            tab.addEventListener('click', () => {
                drawSummary();
                showTab(id);
            });
        }

        function showTab(id) {
            for (const [key, page] of pages) {
                page.hidden = key !== id;
            }

            for (const tab of nav.children) {
                tab.classList.toggle(
                    'active',
                    tab.dataset.tab === id
                );
            }
        }

        function setStatus(message) {
            status.textContent = message;
        }

        function setProgress(done, total) {
            progress.hidden = !total;

            progressFill.style.width = total
                ? `${Math.min(
                    100,
                    done / total * 100
                )}%`
                : '0%';
        }

        function invalidate() {
            prepared = null;
            startButton.disabled = true;
        }

        function setBusy(value, isRun = false) {
            busy = value;
            running = isRun;

            previewButton.disabled = value;
            refreshButton.disabled = value;
            startButton.disabled =
                value || !prepared;

            stopButton.disabled = !isRun;

            for (const page of pages.values()) {
                page.querySelectorAll(
                    'input,select,button'
                ).forEach(control => {
                    control.disabled = value;
                });
            }

            if (!value) {
                syncVehicleCountFields();
            }
        }

        // ========================================================
        // CACHE
        // ========================================================

        function rebuildBuildingIndexes() {
            buildingById = new Map();
            buildingsByType = new Map();
            centerBuildings = [];

            for (const building of buildings) {
                const id = Number(building.id);
                const type = Number(
                    building.building_type
                );

                buildingById.set(id, building);

                if (!buildingsByType.has(type)) {
                    buildingsByType.set(type, []);
                }

                buildingsByType.get(type).push(
                    building
                );

                if (type === 7) {
                    centerBuildings.push(building);
                }
            }
        }

        async function loadBuildings(force = false) {
            beginSync('buildings');

            try {
                await updateBuildings(
                    db,
                    force ? 0 : 300
                );

                buildings = await getAllData(
                    db,
                    'buildings'
                );

                buildings.sort(
                    (a, b) =>
                        String(a.caption ?? '')
                            .localeCompare(
                                String(b.caption ?? ''),
                                'de'
                            )
                );

                rebuildBuildingIndexes();

                finishSync(
                    'buildings',
                    buildings.length
                );

            } catch (error) {
                syncFailed(
                    'buildings',
                    error.message
                );

                throw error;
            }
        }

        async function loadVehicles(force = false) {
            if (vehicleSnapshot && !force) {
                return;
            }

            beginSync('vehicles');

            try {
                report(
                    force
                        ? 'Aktualisiere Fahrzeug-API v2 …'
                        : 'Prüfe Fahrzeug-API-v2-Cache …'
                );

                await updateVehiclesV2(
                    db,
                    force ? 0 : 300
                );

                vehicleSnapshot = await getAllData(
                    db,
                    'vehicles'
                );

                vehiclesByBuilding = new Map();

                for (const vehicle of vehicleSnapshot) {
                    const id = Number(
                        vehicle.building_id
                    );

                    if (!vehiclesByBuilding.has(id)) {
                        vehiclesByBuilding.set(
                            id,
                            []
                        );
                    }

                    vehiclesByBuilding.get(id).push(
                        vehicle
                    );
                }

                finishSync(
                    'vehicles',
                    vehicleSnapshot.length
                );

                report(
                    `${format(vehicleSnapshot.length)} ` +
                    'Fahrzeuge im Cache verfügbar.'
                );

            } catch (error) {
                syncFailed(
                    'vehicles',
                    error.message
                );

                throw error;
            }
        }

        function cachedVehicles(id) {
            return vehiclesByBuilding.get(
                Number(id)
            ) ?? [];
        }

        // ========================================================
        // LEITSTELLEN
        // ========================================================

        const centersPage = pages.get('centers');

        centersPage.append(
            panel(
                'Leitstellen auswählen',
                'Eine, mehrere oder alle Leitstellen auswählen. ' +
                'Die Auswahl bleibt gespeichert.'
            )
        );

        const centerSearch = input(
            'search',
            'Leitstellen suchen …'
        );

        const centerAll = button('Alle auswählen');
        const centerNone = button('Alle abwählen');
        const centerCount = el(
            'span',
            'aio-count'
        );

        const centerList = el(
            'div',
            'aio-list'
        );

        const centerPagination = el(
            'div',
            'aio-pagination'
        );

        centersPage.append(
            centerSearch,
            row(
                centerAll,
                centerNone,
                centerCount
            ),
            centerList,
            centerPagination
        );

        function filteredCenters() {
            const query = centerSearch.value
                .trim()
                .toLowerCase();

            if (!query) {
                return centerBuildings;
            }

            return centerBuildings.filter(item =>
                String(item.caption ?? '')
                    .toLowerCase()
                    .includes(query) ||
                String(item.id).includes(query)
            );
        }

        function createPagination(
            container,
            pageIndex,
            total,
            onChange
        ) {
            container.replaceChildren();

            const pagesCount = Math.max(
                1,
                Math.ceil(total / PAGE_SIZE)
            );

            const previous = button('Zurück');
            previous.disabled = pageIndex <= 0;

            const next = button('Weiter');
            next.disabled =
                pageIndex >= pagesCount - 1;

            previous.addEventListener(
                'click',
                () => onChange(
                    Math.max(0, pageIndex - 1)
                )
            );

            next.addEventListener(
                'click',
                () => onChange(
                    Math.min(
                        pagesCount - 1,
                        pageIndex + 1
                    )
                )
            );

            container.append(
                previous,
                el(
                    'span',
                    '',
                    `Seite ${pageIndex + 1} von ${pagesCount}`
                ),
                next
            );
        }

        async function saveCenters() {
            await GM.setValue(
                centersKey,
                [...selectedCenters]
            );
        }

        function drawCenters() {
            const matches = filteredCenters();

            const totalPages = Math.max(
                1,
                Math.ceil(matches.length / PAGE_SIZE)
            );

            centerPageIndex = Math.min(
                centerPageIndex,
                totalPages - 1
            );

            const start =
                centerPageIndex * PAGE_SIZE;

            const visible = matches.slice(
                start,
                start + PAGE_SIZE
            );

            const fragment = document
                .createDocumentFragment();

            for (const center of visible) {
                const label = el(
                    'label',
                    'aio-check-row'
                );

                const checkbox = input('checkbox');
                const id = Number(center.id);

                checkbox.checked =
                    selectedCenters.has(id);

                checkbox.addEventListener(
                    'change',
                    async () => {
                        if (checkbox.checked) {
                            selectedCenters.add(id);
                        } else {
                            selectedCenters.delete(id);
                        }

                        selectedBuildings.clear();
                        stationPageIndex = 0;

                        invalidate();
                        drawCenters();
                        drawStations();

                        try {
                            await saveCenters();
                        } catch (error) {
                            report(
                                'Leitstellenauswahl konnte nicht gespeichert werden: ' +
                                error.message
                            );
                        }
                    }
                );

                label.append(
                    checkbox,
                    el(
                        'span',
                        '',
                        `${center.caption} (${id})`
                    )
                );

                fragment.append(label);
            }

            centerList.replaceChildren(fragment);

            centerCount.textContent =
                `${selectedCenters.size} von ` +
                `${centerBuildings.length} Leitstellen ausgewählt`;

            createPagination(
                centerPagination,
                centerPageIndex,
                matches.length,
                page => {
                    centerPageIndex = page;
                    drawCenters();
                }
            );
        }

        centerSearch.addEventListener(
            'input',
            () => {
                centerPageIndex = 0;
                drawCenters();
            }
        );

        centerAll.addEventListener(
            'click',
            async () => {
                for (const center of filteredCenters()) {
                    selectedCenters.add(
                        Number(center.id)
                    );
                }

                selectedBuildings.clear();
                stationPageIndex = 0;

                invalidate();
                drawCenters();
                drawStations();

                await saveCenters();
            }
        );

        centerNone.addEventListener(
            'click',
            async () => {
                for (const center of filteredCenters()) {
                    selectedCenters.delete(
                        Number(center.id)
                    );
                }

                selectedBuildings.clear();
                stationPageIndex = 0;

                invalidate();
                drawCenters();
                drawStations();

                await saveCenters();
            }
        );

        // ========================================================
        // GEBÄUDE
        // ========================================================

        const buildingsPage = pages.get('buildings');

        buildingsPage.append(
            panel(
                'Gebäude',
                'Gebäudetyp, Ziel-Ausbaustufe und ' +
                'Gebäudestatus festlegen.'
            )
        );

        const buildingType = select([
            ['', 'Gebäudetyp auswählen']
        ]);

        const targetLevel = input(
            'number',
            'Unverändert'
        );

        const buildingState = select(
            STATE_OPTIONS
        );

        const buildingGrid = el(
            'div',
            'aio-grid'
        );

        buildingGrid.append(
            field('Gebäudetyp', buildingType),
            field('Ziel-Ausbaustufe', targetLevel),
            field('Gebäudestatus', buildingState)
        );

        buildingsPage.append(buildingGrid);

        const stationPanel = panel(
            'Wachen auswählen',
            'Maximal 100 Wachen werden gleichzeitig ' +
            'angezeigt. Die Auswahl gilt über alle Seiten.'
        );

        const stationSearch = input(
            'search',
            'Wachen suchen …'
        );

        const stationAll = button(
            'Alle Treffer auswählen'
        );

        const stationNone = button(
            'Treffer abwählen'
        );

        const stationCount = el(
            'span',
            'aio-count'
        );

        const stationList = el(
            'div',
            'aio-list aio-stations'
        );

        const stationPagination = el(
            'div',
            'aio-pagination'
        );

        stationPanel.append(
            stationSearch,
            row(
                stationAll,
                stationNone,
                stationCount
            ),
            stationList,
            stationPagination
        );

        buildingsPage.append(stationPanel);

        function matchingStations() {
            if (!buildingType.value) {
                return [];
            }

            const type = Number(
                buildingType.value
            );

            const source =
                buildingsByType.get(type) ?? [];

            const query = stationSearch.value
                .trim()
                .toLowerCase();

            return source.filter(building =>
                selectedCenters.has(
                    dispatchId(building)
                ) &&
                (
                    !query ||
                    String(building.caption ?? '')
                        .toLowerCase()
                        .includes(query) ||
                    String(building.id).includes(query)
                )
            );
        }

        function drawStations() {
            const matches = matchingStations();

            const totalPages = Math.max(
                1,
                Math.ceil(matches.length / PAGE_SIZE)
            );

            stationPageIndex = Math.min(
                stationPageIndex,
                totalPages - 1
            );

            const start =
                stationPageIndex * PAGE_SIZE;

            const visible = matches.slice(
                start,
                start + PAGE_SIZE
            );

            const fragment = document
                .createDocumentFragment();

            for (const building of visible) {
                const label = el(
                    'label',
                    'aio-check-row'
                );

                const checkbox = input('checkbox');
                const id = Number(building.id);

                checkbox.checked =
                    selectedBuildings.has(id);

                checkbox.addEventListener(
                    'change',
                    () => {
                        if (checkbox.checked) {
                            selectedBuildings.add(id);
                        } else {
                            selectedBuildings.delete(id);
                        }

                        invalidate();

                        updateStationCount(
                            matches.length
                        );
                    }
                );

                label.append(
                    checkbox,
                    el(
                        'span',
                        '',
                        buildingLabel(id)
                    )
                );

                fragment.append(label);
            }

            if (!visible.length) {
                fragment.append(
                    el(
                        'p',
                        'aio-empty',
                        'Keine passenden Wachen gefunden.'
                    )
                );
            }

            stationList.replaceChildren(fragment);

            updateStationCount(matches.length);

            createPagination(
                stationPagination,
                stationPageIndex,
                matches.length,
                page => {
                    stationPageIndex = page;
                    drawStations();
                }
            );
        }

        function updateStationCount(matches) {
            stationCount.textContent =
                `${format(selectedBuildings.size)} ausgewählt · ` +
                `${format(matches)} Treffer`;
        }

        stationSearch.addEventListener(
            'input',
            () => {
                stationPageIndex = 0;
                drawStations();
            }
        );

        stationAll.addEventListener(
            'click',
            () => {
                for (const building of matchingStations()) {
                    selectedBuildings.add(
                        Number(building.id)
                    );
                }

                invalidate();
                drawStations();
            }
        );

        stationNone.addEventListener(
            'click',
            () => {
                for (const building of matchingStations()) {
                    selectedBuildings.delete(
                        Number(building.id)
                    );
                }

                invalidate();
                drawStations();
            }
        );

        buildingType.addEventListener(
            'change',
            () => {
                selectedBuildings.clear();
                stationPageIndex = 0;

                invalidate();
                drawStations();
                drawExtensions();
            }
        );

        // ========================================================
        // ERWEITERUNGEN
        // ========================================================

        const extensionsPage = pages.get(
            'extensions'
        );

        extensionsPage.append(
            panel(
                'Erweiterungen',
                'Fehlende Erweiterungen kaufen und ' +
                'vorhandene Erweiterungen aktivieren oder deaktivieren.'
            )
        );

        const extensionList = el(
            'div',
            'aio-extension-list'
        );

        extensionsPage.append(extensionList);

        function drawExtensions(saved = []) {
            extensionList.replaceChildren();

            if (!buildingType.value) {
                extensionList.append(
                    el(
                        'p',
                        'aio-muted',
                        'Bitte zuerst einen Gebäudetyp auswählen.'
                    )
                );

                return;
            }

            const type = Number(
                buildingType.value
            );

            const options = new Map(
                (EXTENSIONS.get(type) ?? [])
                    .map(item => [
                        Number(item.value),
                        item.name
                    ])
            );

            const sameType =
                buildingsByType.get(type) ?? [];

            for (const building of sameType) {
                for (const extension of (
                    building.extensions ?? []
                )) {
                    const id = Number(
                        extension.type_id
                    );

                    if (
                        Number.isInteger(id) &&
                        !options.has(id)
                    ) {
                        options.set(
                            id,
                            extension.caption ??
                            extensionName(type, id)
                        );
                    }
                }
            }

            for (const item of saved) {
                if (!options.has(Number(item.type))) {
                    options.set(
                        Number(item.type),
                        item.name
                    );
                }
            }

            const fragment = document
                .createDocumentFragment();

            for (
                const [id, name] of
                [...options].sort((a, b) => a[0] - b[0])
            ) {
                const previous = saved.find(
                    item => Number(item.type) === id
                );

                const line = el(
                    'div',
                    'aio-extension'
                );

                line.dataset.type = String(id);

                const buy = input('checkbox');
                buy.checked = Boolean(previous?.buy);

                const buyLabel = el(
                    'label',
                    'aio-checkbox-inline'
                );

                buyLabel.append(
                    buy,
                    el(
                        'span',
                        '',
                        'Bei Bedarf kaufen'
                    )
                );

                const enabled = select(
                    STATE_OPTIONS
                );

                enabled.value = stateOption(
                    previous?.enabled
                );

                line.append(
                    el(
                        'strong',
                        '',
                        `${name} (${id})`
                    ),
                    buyLabel,
                    field('Status', enabled)
                );

                function updateLine() {
                    line.classList.toggle(
                        'aio-selected',
                        buy.checked ||
                        enabled.value !== ''
                    );
                }

                buy.addEventListener(
                    'change',
                    updateLine
                );

                enabled.addEventListener(
                    'change',
                    updateLine
                );

                updateLine();
                fragment.append(line);
            }

            extensionList.append(fragment);

            if (!options.size) {
                extensionList.append(
                    el(
                        'p',
                        'aio-muted',
                        'Für diesen Gebäudetyp sind keine ' +
                        'Erweiterungen bekannt.'
                    )
                );
            }
        }

        // ========================================================
        // FAHRZEUGE & PERSONAL
        // ========================================================

        const vehiclesPage = pages.get('vehicles');

        vehiclesPage.append(
            panel(
                'Fahrzeuge & Personal',
                'Fahrzeugbestand, Maximalpersonal und ' +
                'Zielbesatzung je Fahrzeugtyp.'
            )
        );

        const vehicleList = el(
            'div',
            'aio-vehicle-list'
        );

        const addVehicle = button(
            'Fahrzeugtyp hinzufügen'
        );

        vehiclesPage.append(
            el(
                'p',
                'aio-muted',
                'Leere Werte bleiben unverändert. ' +
                'Der Sollbestand gilt je Wache.'
            ),
            vehicleList,
            addVehicle
        );

        function syncVehicleCountFields() {
            for (const line of vehicleList.children) {
                const selects =
                    line.querySelectorAll('select');

                const count = line.querySelector(
                    'input[type="number"]'
                );

                if (selects[1] && count) {
                    count.disabled =
                        selects[1].value === 'staff';
                }
            }
        }

        function addVehicleRow(saved = {}) {
            const options = [
                ['', 'Fahrzeugtyp wählen'],
                ...vehicleTypes
            ];

            if (
                saved.type != null &&
                !options.some(
                    item => Number(item[0]) ===
                        Number(saved.type)
                )
            ) {
                options.push([
                    saved.type,
                    saved.name ??
                    `Fahrzeugtyp ${saved.type}`
                ]);
            }

            const vehicle = select(options);
            vehicle.value = saved.type ?? '';

            const countMode = select([
                ['fixed', 'Feste Anzahl'],
                ['staff', '1 Fahrzeug je Mitarbeiter']
            ]);

            countMode.value = saved.countByStaff
                ? 'staff'
                : 'fixed';

            const count = input(
                'number',
                'Unverändert'
            );

            count.value = saved.count ?? '';

            const max = input(
                'number',
                'Unverändert'
            );

            max.value = saved.max ?? '';

            const crew = input(
                'number',
                'Unverändert'
            );

            crew.value = saved.crew ?? '';

            const crewMode = select(CREW_MODES);

            crewMode.value = saved.crewMode ??
                (saved.type == null
                    ? 'both'
                    : 'add');

            const remove = button(
                'Entfernen',
                'danger'
            );

            const line = el(
                'div',
                'aio-vehicle'
            );

            line.append(
                field('Fahrzeugtyp', vehicle),
                field('Bestandsmodus', countMode),
                field('Sollbestand', count),
                field('Maximalpersonal', max),
                field('Zielbesatzung', crew),
                field('Personalaktion', crewMode),
                remove
            );

            countMode.addEventListener(
                'change',
                () => {
                    syncVehicleCountFields();
                    invalidate();
                }
            );

            remove.addEventListener(
                'click',
                () => {
                    line.remove();
                    invalidate();
                }
            );

            vehicleList.append(line);
            syncVehicleCountFields();
        }

        addVehicle.addEventListener(
            'click',
            () => {
                addVehicleRow();
                invalidate();
            }
        );

        // ========================================================
        // VORLAGEN
        // ========================================================

        const templatesPage = pages.get(
            'templates'
        );

        templatesPage.append(
            panel(
                'Vorlagenverwaltung',
                'Gespeicherte Vorlagen unabhängig von ' +
                'der Leitstellenauswahl verwenden.'
            )
        );

        const templatePicker = select([
            ['', 'Neue Vorlage']
        ]);

        const templateName = input(
            'text',
            'z. B. BePo-Vollausbau'
        );

        const templateSave = button(
            'Vorlage speichern',
            'success'
        );

        const templateDelete = button(
            'Vorlage löschen',
            'danger'
        );

        const bepolPreset = button(
            'BePo-Verband übernehmen'
        );

        const templateGrid = el(
            'div',
            'aio-grid'
        );

        templateGrid.append(
            field('Gespeicherte Vorlage', templatePicker),
            field('Vorlagenname', templateName)
        );

        templatesPage.append(
            templateGrid,
            row(
                templateSave,
                templateDelete,
                bepolPreset
            )
        );

        function refreshTemplates(selected = '') {
            templatePicker.replaceChildren();

            const empty = el(
                'option',
                '',
                'Neue Vorlage'
            );

            empty.value = '';
            templatePicker.append(empty);

            for (
                const [id, template] of
                Object.entries(templates).sort(
                    (a, b) =>
                        String(a[1].name)
                            .localeCompare(
                                String(b[1].name),
                                'de'
                            )
                )
            ) {
                const option = el(
                    'option',
                    '',
                    template.name
                );

                option.value = id;
                templatePicker.append(option);
            }

            templatePicker.value = selected;
        }

        function readTemplate() {
            if (!buildingType.value) {
                throw new Error(
                    'Bitte einen Gebäudetyp auswählen.'
                );
            }

            const vehicles = [
                ...vehicleList.children
            ].map(line => {
                const [
                    vehicle,
                    mode,
                    crewMode
                ] = line.querySelectorAll('select');

                const [
                    countInput,
                    maxInput,
                    crewInput
                ] = line.querySelectorAll(
                    'input[type="number"]'
                );

                if (!vehicle.value) {
                    throw new Error(
                        'Bitte einen Fahrzeugtyp auswählen.'
                    );
                }

                const count = mode.value === 'staff'
                    ? null
                    : numberValue(countInput);

                const max = numberValue(maxInput);
                const crew = numberValue(crewInput);

                if (
                    max != null &&
                    crew != null &&
                    crew > max
                ) {
                    throw new Error(
                        'Zielbesatzung darf das ' +
                        'Maximalpersonal nicht überschreiten.'
                    );
                }

                return {
                    type: Number(vehicle.value),
                    name:
                        vehicle.selectedOptions[0]
                            .textContent,
                    count,
                    countByStaff:
                        mode.value === 'staff',
                    max,
                    crew,
                    crewMode: crewMode.value
                };
            }).filter(rule =>
                rule.countByStaff ||
                rule.count != null ||
                rule.max != null ||
                rule.crew != null
            );

            if (
                new Set(
                    vehicles.map(item => item.type)
                ).size !== vehicles.length
            ) {
                throw new Error(
                    'Jeder Fahrzeugtyp darf nur ' +
                    'einmal vorkommen.'
                );
            }

            const extensions = [
                ...extensionList.children
            ].filter(line =>
                line.dataset.type != null
            ).map(line => {
                const buy = line.querySelector(
                    'input[type="checkbox"]'
                );

                const enabled = line.querySelector(
                    'select'
                );

                const type = Number(
                    line.dataset.type
                );

                return {
                    type,
                    name: extensionName(
                        buildingType.value,
                        type
                    ),
                    buy: buy.checked,
                    enabled: stateValue(enabled)
                };
            }).filter(rule =>
                rule.buy ||
                rule.enabled != null
            );

            return {
                name: templateName.value.trim(),
                type: Number(buildingType.value),
                level: numberValue(targetLevel),
                enabled: stateValue(buildingState),
                extensions,
                vehicles
            };
        }

        function loadTemplate() {
            const template = templates[
                templatePicker.value
            ];

            templateName.value =
                template?.name ?? '';

            buildingType.value =
                template?.type ?? '';

            targetLevel.value =
                template?.level ?? '';

            buildingState.value = stateOption(
                template?.enabled
            );

            selectedBuildings.clear();
            stationPageIndex = 0;

            vehicleList.replaceChildren();

            for (
                const rule of template?.vehicles ?? []
            ) {
                addVehicleRow(rule);
            }

            drawExtensions(
                template?.extensions ?? []
            );

            drawStations();
            invalidate();
        }

        templatePicker.addEventListener(
            'change',
            loadTemplate
        );

        templateSave.addEventListener(
            'click',
            async () => {
                try {
                    const template = readTemplate();

                    if (!template.name) {
                        throw new Error(
                            'Bitte einen Vorlagennamen eingeben.'
                        );
                    }

                    const id =
                        templatePicker.value ||
                        crypto.randomUUID();

                    const updated = {
                        ...templates,
                        [id]: template
                    };

                    await GM.setValue(
                        templateKey,
                        updated
                    );

                    templates = updated;
                    refreshTemplates(id);

                    report(
                        `Vorlage gespeichert: ${template.name}`
                    );

                } catch (error) {
                    report(
                        `FEHLER: ${error.message}`
                    );
                }
            }
        );

        templateDelete.addEventListener(
            'click',
            async () => {
                const id = templatePicker.value;

                if (
                    !id ||
                    !window.confirm(
                        'Diese Vorlage löschen?'
                    )
                ) {
                    return;
                }

                const updated = { ...templates };
                delete updated[id];

                await GM.setValue(
                    templateKey,
                    updated
                );

                templates = updated;

                refreshTemplates();
                loadTemplate();

                report('Vorlage gelöscht.');
            }
        );

        bepolPreset.addEventListener(
            'click',
            () => {
                templatePicker.value = '';
                loadTemplate();

                buildingType.value = '11';
                templateName.value = 'BePo-Verband';

                addVehicleRow({
                    type: 50,
                    name: 'GruKw',
                    countByStaff: true,
                    max: 1,
                    crewMode: 'both'
                });

                drawExtensions();
                drawStations();
                invalidate();

                showTab('vehicles');
            }
        );

        // ========================================================
        // ABLAUF
        // ========================================================

        const runPage = pages.get('run');

        runPage.append(
            panel(
                'Ablaufsteuerung',
                'Die ausgewählten Wachen werden ' +
                'nacheinander bearbeitet.'
            )
        );

        const summary = el(
            'div',
            'aio-summary'
        );

        runPage.append(
            summary,
            el(
                'p',
                'aio-muted',
                'Vor dem Start wird eine Vorschau erstellt. ' +
                'Käufe erfolgen mit Credits.'
            )
        );

        function drawSummary() {
            summary.replaceChildren();

            const items = [
                ['Leitstellen', selectedCenters.size],
                ['Wachen', selectedBuildings.size],
                [
                    'Gebäudetyp',
                    buildingType.selectedOptions[0]
                        ?.textContent ?? 'Nicht gewählt'
                ],
                [
                    'Vorlage',
                    templateName.value || 'Ohne Namen'
                ]
            ];

            for (const [title, value] of items) {
                const item = el(
                    'div',
                    'aio-summary-item'
                );

                item.append(
                    el('small', '', title),
                    el('strong', '', String(value))
                );

                summary.append(item);
            }
        }

        // ========================================================
        // LOKALE VORSCHAU
        // ========================================================

        function targetCount(rule, building) {
            if (!rule.countByStaff) {
                return rule.count;
            }

            const raw = building.personal_count;
            const count = Number(raw);

            if (
                raw == null ||
                raw === '' ||
                !Number.isSafeInteger(count) ||
                count < 0
            ) {
                throw new Error(
                    `Personalbestand ${buildingLabel(building.id)} unbekannt.`
                );
            }

            return count;
        }

        function describeExtension(building, rule) {
            const extension = extensionAt(
                building,
                rule.type
            );

            const name = extensionName(
                building.building_type,
                rule.type
            );

            if (!extension) {
                return `${name}: Nicht vorhanden · ` +
                    (rule.buy
                        ? 'Kaufen vorgesehen'
                        : 'Kein Kauf vorgesehen');
            }

            const status =
                extension.enabled === true
                    ? 'Vorhanden · Aktiv'
                    : extension.enabled === false
                        ? 'Vorhanden · Inaktiv'
                        : 'Vorhanden · Status unbekannt';

            if (
                rule.enabled == null ||
                rule.enabled === extension.enabled
            ) {
                return `${name}: ${status}`;
            }

            return `${name}: ${status} → ` +
                (rule.enabled
                    ? 'Aktivieren'
                    : 'Deaktivieren');
        }

        function describeVehicle(building, rule) {
            const vehicles = cachedVehicles(
                building.id
            );

            const current = vehicles.filter(
                vehicle =>
                    Number(vehicle.vehicle_type) ===
                    rule.type
            ).length;

            const target = targetCount(
                rule,
                building
            );

            const missing = target == null
                ? 0
                : Math.max(0, target - current);

            const parts = [
                `${rule.name}: ${current} vorhanden`
            ];

            if (target != null) {
                parts.push(
                    `Sollbestand ${target}`
                );

                parts.push(
                    missing
                        ? `${missing} kaufen`
                        : 'Sollbestand erreicht'
                );
            }

            if (rule.max != null) {
                parts.push(
                    `Maximalpersonal ${rule.max}`
                );
            }

            if (rule.crew != null) {
                const mode = CREW_MODES.find(
                    item =>
                        item[0] === rule.crewMode
                )?.[1] ?? 'Nur zuweisen';

                parts.push(
                    `Zielbesatzung ${rule.crew}`
                );

                parts.push(mode);
            }

            return parts.join(' · ');
        }

        function previewLines(building, template) {
            const lines = [
                '',
                buildingLabel(building.id)
            ];

            if (template.level != null) {
                const current = cachedLevel(
                    building
                );

                lines.push(
                    current == null
                        ? `  Ausbaustufe: Soll ${template.level} · Iststufe im Cache nicht verfügbar`
                        : `  Ausbaustufe: ${current} → ${Math.max(current, template.level)}`
                );
            }

            for (const rule of template.extensions) {
                lines.push(
                    '  ' + describeExtension(
                        building,
                        rule
                    )
                );
            }

            for (const rule of template.vehicles) {
                lines.push(
                    '  ' + describeVehicle(
                        building,
                        rule
                    )
                );
            }

            if (template.enabled != null) {
                const current =
                    building.enabled !== false;

                lines.push(
                    '  Gebäudestatus: ' +
                    (current ? 'Aktiv' : 'Inaktiv') +
                    (current !== template.enabled
                        ? ' → ' +
                            (template.enabled
                                ? 'Aktivieren'
                                : 'Deaktivieren')
                        : ' · Unverändert')
                );
            }

            return lines;
        }

        previewButton.addEventListener(
            'click',
            async () => {
                if (busy) return;

                invalidate();
                drawSummary();
                setBusy(true);

                try {
                    const template = readTemplate();
                    const ids = [
                        ...selectedBuildings
                    ];

                    if (!selectedCenters.size) {
                        throw new Error(
                            'Bitte mindestens eine Leitstelle auswählen.'
                        );
                    }

                    if (!ids.length) {
                        throw new Error(
                            'Bitte mindestens eine Wache auswählen.'
                        );
                    }

                    const allowedIds = new Set(
                        (buildingsByType.get(
                            template.type
                        ) ?? []).filter(building =>
                            selectedCenters.has(
                                dispatchId(building)
                            )
                        ).map(building =>
                            Number(building.id)
                        )
                    );

                    if (
                        ids.some(id =>
                            !allowedIds.has(id)
                        )
                    ) {
                        throw new Error(
                            'Die Wachenauswahl passt nicht ' +
                            'zur aktuellen Leitstellenauswahl.'
                        );
                    }

                    clearLog();

                    report(
                        `Vorschau für ${format(ids.length)} Wachen`
                    );

                    report(
                        'Datenquelle: IndexedDB / API v2'
                    );

                    if (template.vehicles.length) {
                        await loadVehicles();
                    }

                    let checked = 0;
                    let errors = 0;
                    let detailed = 0;
                    let buffer = [];

                    setProgress(0, ids.length);

                    for (const id of ids) {
                        try {
                            const building =
                                buildingById.get(
                                    Number(id)
                                );

                            if (!building) {
                                throw new Error(
                                    `${buildingLabel(id)} fehlt im Cache.`
                                );
                            }

                            const lines = previewLines(
                                building,
                                template
                            );

                            if (
                                detailed <
                                PREVIEW_DETAIL_LIMIT
                            ) {
                                buffer.push(...lines);
                                detailed++;
                            }

                        } catch (error) {
                            errors++;

                            buffer.push(
                                `FEHLER bei ${buildingLabel(id)}: ` +
                                error.message
                            );
                        }

                        checked++;

                        if (
                            checked % PREVIEW_BATCH === 0 ||
                            checked === ids.length
                        ) {
                            if (buffer.length) {
                                report(
                                    buffer.join('\n')
                                );

                                buffer = [];
                            }

                            setProgress(
                                checked,
                                ids.length
                            );

                            setStatus(
                                `${format(checked)} / ` +
                                `${format(ids.length)} geprüft`
                            );

                            await yieldToBrowser();
                        }
                    }

                    if (
                        ids.length >
                        PREVIEW_DETAIL_LIMIT
                    ) {
                        report(
                            `\nWeitere ${format(
                                ids.length -
                                PREVIEW_DETAIL_LIMIT
                            )} Wachen ebenfalls geprüft. ` +
                            'Die Detailausgabe ist begrenzt.'
                        );
                    }

                    if (errors) {
                        throw new Error(
                            `${errors} Wachen konnten nicht ` +
                            'vollständig ausgewertet werden.'
                        );
                    }

                    prepared = {
                        template,
                        ids
                    };

                    report(
                        `\nVorschau abgeschlossen: ` +
                        `${format(checked)} Wachen geprüft.`
                    );

                    setStatus(
                        `${format(ids.length)} Wachen bereit`
                    );

                } catch (error) {
                    report(
                        `FEHLER: ${error.message}`
                    );

                    setStatus(
                        'Vorschau fehlgeschlagen'
                    );

                } finally {
                    setBusy(false);
                }
            }
        );

        // ========================================================
        // AUSFÜHRUNG
        // ========================================================

        function check() {
            if (cancelled) {
                throw new Error(
                    'Ablauf nach dem laufenden Schritt angehalten.'
                );
            }
        }

        async function perform(message, operation) {
            check();

            report(`  ${message}`);

            await operation();
            await sleep(ACTION_DELAY);
        }

        /*
         * NEU v0.4.4:
         *
         * Fahrzeugkäufe werden gesammelt geprüft.
         *
         * - Cache vor dem Durchlauf laden
         * - Kaufanfragen einzeln senden
         * - Kauf nicht als bestätigt markieren
         * - Nach dem Durchlauf einmal synchronisieren
         * - Endbestand gegen Sollbestand prüfen
         *
         * Die Implementierung vermeidet eine
         * vollständige API-Synchronisierung nach
         * jeder einzelnen Kaufanfrage.
         */

        const pendingPurchases = new Map();

        function purchaseKey(buildingId, vehicleType) {
            return `${buildingId}:${vehicleType}`;
        }

        function registerPurchase(
            buildingId,
            vehicleType,
            name,
            before,
            expected
        ) {
            const key = purchaseKey(
                buildingId,
                vehicleType
            );

            const entry = pendingPurchases.get(key) ?? {
                buildingId,
                vehicleType,
                name,
                before,
                expected: before,
                requests: 0
            };

            entry.expected = expected;
            entry.requests++;

            pendingPurchases.set(key, entry);
        }

        async function verifyPurchases() {
            if (!pendingPurchases.size) {
                return {
                    checked: 0,
                    confirmed: 0,
                    failed: 0
                };
            }

            report(
                '\nPrüfe die ausstehenden Fahrzeugkäufe …'
            );

            /*
             * Eine gemeinsame vollständige
             * Synchronisierung für alle bisher
             * gesendeten Fahrzeugkäufe.
             */
            await loadVehicles(true);

            let confirmed = 0;
            let failed = 0;

            for (const purchase of pendingPurchases.values()) {
                const vehicles = cachedVehicles(
                    purchase.buildingId
                );

                const actual = vehicles.filter(
                    vehicle =>
                        Number(vehicle.vehicle_type) ===
                        purchase.vehicleType
                ).length;

                const label = buildingLabel(
                    purchase.buildingId
                );

                if (actual >= purchase.expected) {
                    confirmed++;

                    report(
                        `BESTÄTIGT: ${label} · ${purchase.name} · ` +
                        `${purchase.before} → ${actual}`
                    );
                } else {
                    failed++;

                    report(
                        `NICHT BESTÄTIGT: ${label} · ${purchase.name} · ` +
                        `Soll mindestens ${purchase.expected}, ` +
                        `Ist ${actual}`
                    );
                }
            }

            const result = {
                checked: pendingPurchases.size,
                confirmed,
                failed
            };

            pendingPurchases.clear();

            return result;
        }

        async function applyTemplate(id, template) {
            check();

            let building = await getLiveBuilding(id);

            if (
                Number(building.building_type) !==
                template.type
            ) {
                throw new Error(
                    `${buildingLabel(id)}: Gebäudetyp geändert.`
                );
            }

            // ----------------------------------------------------
            // 1. AUSBAUSTUFE
            // ----------------------------------------------------

            if (template.level != null) {
                let level = await liveLevel(id);

                while (level < template.level) {
                    check();

                    const previous = level;
                    const expected = level + 1;

                    await perform(
                        `Ausbaustufe ${expected} kaufen`,
                        () => creditPost(
                            `/buildings/${id}/expand_do/credits` +
                            `?level=${previous}`,
                            'get'
                        )
                    );

                    level = await confirm(
                        () => liveLevel(id),
                        value => value >= expected,
                        'Ausbaustufe'
                    );
                }
            }

            // ----------------------------------------------------
            // 2. ERWEITERUNGEN KAUFEN
            // ----------------------------------------------------

            let pending = template.extensions.filter(
                rule =>
                    rule.buy &&
                    !extensionAt(building, rule.type)
            );

            while (pending.length) {
                check();

                const offers = await extensionOffers(
                    id
                );

                const next = pending.find(
                    item => offers.has(item.type)
                );

                if (!next) {
                    throw new Error(
                        'Erweiterungen derzeit nicht kaufbar: ' +
                        pending.map(
                            item => item.name
                        ).join(', ')
                    );
                }

                await perform(
                    `${next.name} kaufen`,
                    () => creditPost(
                        offers.get(next.type),
                        'post'
                    )
                );

                building = await confirm(
                    () => getLiveBuilding(id),
                    value => Boolean(
                        extensionAt(
                            value,
                            next.type
                        )
                    ),
                    next.name
                );

                pending = pending.filter(
                    item => !extensionAt(
                        building,
                        item.type
                    )
                );
            }

            // ----------------------------------------------------
            // 3. FAHRZEUGE KAUFEN
            // ----------------------------------------------------

            if (template.vehicles.length) {
                if (!vehicleSnapshot) {
                    await loadVehicles();
                }

                /*
                 * Ausgangsbestand ist die vor
                 * diesem Durchlauf geladene
                 * Fahrzeug-Momentaufnahme.
                 */

                const vehicles = cachedVehicles(id);

                for (const rule of template.vehicles) {
                    const target = targetCount(
                        rule,
                        building
                    );

                    if (target == null) {
                        continue;
                    }

                    const initial = vehicles.filter(
                        item =>
                            Number(item.vehicle_type) ===
                            rule.type
                    ).length;

                    const missing = Math.max(
                        0,
                        target - initial
                    );

                    if (!missing) {
                        report(
                            `  ${rule.name}: Sollbestand ${target} erreicht`
                        );

                        continue;
                    }

                    /*
                     * Einzeln kaufen.
                     *
                     * Nur erfolgreich abgeschickte
                     * Anfragen als ausstehende
                     * Käufe vermerken.
                     *
                     * Nicht automatisch nachkaufen,
                     * wenn die Bestätigung unklar ist.
                     */

                    for (let i = 0; i < missing; i++) {
                        check();

                        await perform(
                            `${rule.name} kaufen ` +
                            `(${i + 1}/${missing})`,
                            () => creditPost(
                                `/buildings/${id}/vehicle/` +
                                `${id}/${rule.type}/credits?building=${id}`,
                                'get'
                            )
                        );

                        registerPurchase(
                            id,
                            rule.type,
                            rule.name,
                            initial,
                            initial + i + 1
                        );

                        report(
                            `  ${rule.name}: Kaufanfrage gesendet · ` +
                            'Bestätigung nach dem Durchlauf'
                        );
                    }
                }

                /*
                 * Falls Fahrzeuge gerade gekauft
                 * wurden, ist die bisherige
                 * Momentaufnahme unvollständig.
                 *
                 * Personalzuweisungen für diese
                 * Wache werden deshalb nicht auf
                 * vermeintlich vollständiger
                 * Fahrzeugbasis ausgeführt.
                 */

                const hasNewPurchases = template.vehicles.some(
                    rule =>
                        pendingPurchases.has(
                            purchaseKey(
                                id,
                                rule.type
                            )
                        )
                );

                const hasPersonnelActions =
                    template.vehicles.some(
                        rule =>
                            rule.max != null ||
                            rule.crew != null
                    );

                if (
                    hasNewPurchases &&
                    hasPersonnelActions
                ) {
                    throw new Error(
                        'Fahrzeuge gekauft, aber noch nicht ' +
                        'abschließend bestätigt. ' +
                        'Maximalpersonal und Personalzuweisungen ' +
                        'für diese Wache bitte nach der ' +
                        'Fahrzeugsynchronisierung ausführen.'
                    );
                }

                // ------------------------------------------------
                // 4. MAXIMALPERSONAL / PERSONAL
                // ------------------------------------------------

                if (!hasNewPurchases) {
                    for (const rule of template.vehicles) {
                        const group = vehicles.filter(
                            item =>
                                Number(item.vehicle_type) ===
                                rule.type
                        );

                        for (const vehicle of group) {
                            check();

                            const mode =
                                rule.crewMode ?? 'add';

                            if (
                                rule.crew != null &&
                                mode !== 'add'
                            ) {
                                await changeCrew(
                                    vehicle,
                                    rule.crew,
                                    'remove',
                                    perform,
                                    check
                                );
                            }

                            if (rule.max != null) {
                                const current =
                                    await currentMax(
                                        vehicle.id
                                    );

                                if (current !== rule.max) {
                                    await perform(
                                        `${rule.name}: ` +
                                        `Maximalpersonal ${rule.max}`,
                                        () => setMax(
                                            vehicle.id,
                                            rule.max
                                        )
                                    );

                                    await confirm(
                                        () => currentMax(
                                            vehicle.id
                                        ),
                                        value =>
                                            value === rule.max,
                                        'Maximalpersonal'
                                    );
                                }
                            }

                            if (
                                rule.crew != null &&
                                rule.crew > 0 &&
                                mode !== 'remove'
                            ) {
                                await changeCrew(
                                    vehicle,
                                    rule.crew,
                                    'add',
                                    perform,
                                    check
                                );
                            }
                        }
                    }
                }
            }

            // ----------------------------------------------------
            // 5. ERWEITERUNGEN UMSCHALTEN
            // ----------------------------------------------------

            for (const rule of template.extensions) {
                check();

                if (rule.enabled == null) {
                    continue;
                }

                building = await getLiveBuilding(id);

                const extension = extensionAt(
                    building,
                    rule.type
                );

                if (!extension) {
                    throw new Error(
                        `${rule.name} fehlt.`
                    );
                }

                if (
                    typeof extension.enabled !==
                    'boolean'
                ) {
                    throw new Error(
                        `${rule.name}: Status unbekannt.`
                    );
                }

                if (
                    extension.enabled === rule.enabled
                ) {
                    continue;
                }

                const url = await extensionToggleUrl(
                    id,
                    rule.type
                );

                await perform(
                    `${rule.name} ` +
                    (rule.enabled
                        ? 'aktivieren'
                        : 'deaktivieren'),
                    () => creditPost(
                        url,
                        'post'
                    )
                );

                await confirm(
                    () => getLiveBuilding(id),
                    value => extensionAt(
                        value,
                        rule.type
                    )?.enabled === rule.enabled,
                    rule.name
                );
            }

            // ----------------------------------------------------
            // 6. GEBÄUDESTATUS
            // ----------------------------------------------------

            if (template.enabled != null) {
                building = await getLiveBuilding(id);

                const current =
                    building.enabled !== false;

                if (
                    current !== template.enabled
                ) {
                    await perform(
                        template.enabled
                            ? 'Gebäude aktivieren'
                            : 'Gebäude deaktivieren',
                        () => toggleBuilding(id)
                    );

                    await confirm(
                        () => getLiveBuilding(id),
                        value =>
                            (value.enabled !== false) ===
                            template.enabled,
                        'Gebäudestatus'
                    );
                }
            }
        }

        // ========================================================
        // DURCHLAUF STARTEN
        // ========================================================

        startButton.addEventListener(
            'click',
            async () => {
                if (busy || !prepared) return;

                const snapshot = prepared;

                const accepted = window.confirm(
                    `${snapshot.ids.length} Wachen bearbeiten?\n\n` +
                    `Vorlage: ${snapshot.template.name || '(ohne Namen)'}\n\n` +
                    'Dabei können Credits ausgegeben ' +
                    'und Gebäude, Fahrzeuge sowie ' +
                    'Personal verändert werden.\n\n' +
                    'Jetzt starten?'
                );

                if (!accepted) return;

                invalidate();
                cancelled = false;

                setBusy(true, true);
                showTab('run');

                let completed = 0;
                let failed = 0;
                let verification = null;

                pendingPurchases.clear();

                setProgress(
                    0,
                    snapshot.ids.length
                );

                async function execute() {
                    /*
                     * Einmaliger Fahrzeugbestand
                     * vor den Kaufaktionen.
                     */
                    if (snapshot.template.vehicles.length) {
                        await loadVehicles(true);
                    }

                    for (const id of snapshot.ids) {
                        check();

                        const label = buildingLabel(id);

                        report(
                            `\n--- ${label} ---`
                        );

                        setStatus(
                            `${label} · ` +
                            `${completed + failed + 1}/` +
                            `${snapshot.ids.length}`
                        );

                        try {
                            await applyTemplate(
                                id,
                                snapshot.template
                            );

                            completed++;

                            report(
                                `  ${label}: Bearbeitung abgeschlossen.`
                            );

                        } catch (error) {
                            if (cancelled) {
                                throw error;
                            }

                            failed++;

                            report(
                                `  FEHLER bei ${label}: ` +
                                error.message
                            );
                        }

                        setProgress(
                            completed + failed,
                            snapshot.ids.length
                        );

                        await yieldToBrowser();
                    }
                }

                try {
                    if (!navigator.locks?.request) {
                        throw new Error(
                            'Browser unterstützt keine Sperre ' +
                            'gegen parallele Durchläufe.'
                        );
                    }

                    await navigator.locks.request(
                        `nilspe.mastermind.${account}`,
                        { ifAvailable: true },
                        async lock => {
                            if (!lock) {
                                throw new Error(
                                    'Ein anderer Mastermind- oder ' +
                                    'All-in-One-Durchlauf ist aktiv.'
                                );
                            }

                            try {
                                await execute();
                            } finally {
                                /*
                                 * Auch bei einem Abbruch
                                 * gesendete Kaufanfragen prüfen.
                                 */
                                if (pendingPurchases.size) {
                                    try {
                                        verification =
                                            await verifyPurchases();
                                    } catch (error) {
                                        report(
                                            'FEHLER bei der abschließenden ' +
                                            'Fahrzeugprüfung: ' +
                                            error.message
                                        );
                                    }
                                }
                            }
                        }
                    );

                    report(
                        `\nAblauf beendet: ` +
                        `${completed} Wachen bearbeitet, ` +
                        `${failed} Fehler.`
                    );

                    if (verification) {
                        report(
                            'Fahrzeugkäufe: ' +
                            `${verification.confirmed} bestätigt, ` +
                            `${verification.failed} nicht bestätigt.`
                        );
                    }

                    setStatus(
                        verification?.failed
                            ? 'Abgeschlossen mit Prüfabweichungen'
                            : 'Abgeschlossen'
                    );

                } catch (error) {
                    report(error.message);

                    setStatus(
                        cancelled
                            ? 'Angehalten'
                            : 'Fehler'
                    );

                } finally {
                    cancelled = false;
                    setBusy(false);
                }
            }
        );

        stopButton.addEventListener(
            'click',
            () => {
                if (!running) return;

                cancelled = true;
                stopButton.disabled = true;

                report(
                    'Abbruch angefordert. ' +
                    'Der laufende Schritt wird beendet.'
                );
            }
        );

        // ========================================================
        // MANUELLE API-AKTUALISIERUNG
        // ========================================================

        refreshButton.addEventListener(
            'click',
            async () => {
                if (busy) return;

                invalidate();
                setBusy(true);

                try {
                    report(
                        'Aktualisiere Gebäude-API v2 …'
                    );

                    await loadBuildings(true);

                    if (vehicleSnapshot) {
                        await loadVehicles(true);
                    }

                    drawCenters();
                    drawStations();
                    drawExtensions();
                    drawSummary();

                    report(
                        `${format(buildings.length)} Gebäude ` +
                        'im Cache aktualisiert.'
                    );

                    setStatus('Daten aktuell');

                } catch (error) {
                    report(
                        `FEHLER: ${error.message}`
                    );

                    setStatus(
                        'Aktualisierung fehlgeschlagen'
                    );

                } finally {
                    setBusy(false);
                }
            }
        );

        // ========================================================
        // ÄNDERUNGEN ERKENNEN
        // ========================================================

        for (const page of pages.values()) {
            page.addEventListener(
                'input',
                event => {
                    if (
                        event.target !== stationSearch &&
                        event.target !== centerSearch
                    ) {
                        invalidate();
                    }
                }
            );

            page.addEventListener(
                'change',
                () => {
                    invalidate();
                    drawSummary();
                }
            );
        }

        // ========================================================
        // INITIALISIERUNG
        // ========================================================

        setBusy(true);
        showTab('centers');

        report(
            'Lade Gebäude-API-v2-Cache …'
        );

        try {
            await Promise.all([
                loadBuildings(),
                updateVehicleTypes(db),
                updateBuildingTypes(db)
            ]);

            const [
                vehicleData,
                typeData
            ] = await Promise.all([
                getAllData(db, 'vehicleTypes'),
                getAllData(db, 'buildingTypes')
            ]);

            vehicleTypes = vehicleData.map(item => [
                Number(item.id),
                item.caption ||
                    `Fahrzeugtyp ${item.id}`
            ]).sort(
                (a, b) =>
                    String(a[1]).localeCompare(
                        String(b[1]),
                        'de'
                    )
            );

            const types = new Map(
                typeData.map(item => [
                    Number(item.id),
                    item.caption ??
                        BUILDING_NAMES.get(Number(item.id)) ??
                        `Gebäudetyp ${item.id}`
                ])
            );

            for (const [id, name] of BUILDING_NAMES) {
                if (!types.has(id)) {
                    types.set(id, name);
                }
            }

            for (const type of buildingsByType.keys()) {
                if (!types.has(type)) {
                    types.set(
                        type,
                        `Gebäudetyp ${type}`
                    );
                }
            }

            for (
                const [id, name] of
                [...types]
                    .filter(([id]) => id !== 7)
                    .sort(
                        (a, b) =>
                            String(a[1]).localeCompare(
                                String(b[1]),
                                'de'
                            )
                    )
            ) {
                const option = el(
                    'option',
                    '',
                    name
                );

                option.value = String(id);
                buildingType.append(option);
            }

            const validCenters = new Set(
                centerBuildings.map(
                    item => Number(item.id)
                )
            );

            for (const id of [...selectedCenters]) {
                if (!validCenters.has(id)) {
                    selectedCenters.delete(id);
                }
            }

            const initialId = Number(
                new URLSearchParams(
                    location.search
                ).get('building')
            );

            if (
                validCenters.has(initialId) &&
                !selectedCenters.size
            ) {
                selectedCenters.add(initialId);
            }

            refreshTemplates();
            drawCenters();
            drawStations();
            drawExtensions();
            drawSummary();

            clearLog();

            report(
                `${format(buildings.length)} Gebäude geladen.`
            );

            report(
                `${format(centerBuildings.length)} Leitstellen verfügbar.`
            );

            report(
                'Gebäudeindex und Typenindex aufgebaut.'
            );

            report(
                `Listenansicht auf ${PAGE_SIZE} Einträge begrenzt.`
            );

            report(
                'Bereit. Vorschau verwendet den lokalen API-v2-Cache.'
            );

            setStatus('Bereit');
            setProgress(0, 0);

        } catch (error) {
            report(
                `Initialisierung fehlgeschlagen: ${error.message}`
            );

            setStatus('Fehler');

        } finally {
            setBusy(false);
        }
    }

    // ============================================================
    // DESIGN
    // ============================================================

    function addStyles() {
        const style = el('style');
        style.id = 'nilspe-aio-styles';

        style.textContent = `
            #nilspe-all-in-one {
                max-width: 1440px;
                margin: 0 auto;
                padding: 22px;
                color: inherit;
            }

            #nilspe-all-in-one * {
                box-sizing: border-box;
            }

            #nilspe-all-in-one .aio-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                margin-bottom: 18px;
            }

            #nilspe-all-in-one h1 {
                font-size: 28px;
                font-weight: 400;
                margin: 0;
            }

            #nilspe-all-in-one .aio-brand p {
                margin: 5px 0 0;
                opacity: .7;
            }

            #nilspe-all-in-one .aio-version {
                padding: 5px 10px;
                border: 1px solid #8885;
                border-radius: 4px;
                font-size: 12px;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                padding-bottom: 10px;
                border-bottom: 1px solid #8885;
                margin-bottom: 18px;
            }

            #nilspe-all-in-one .aio-tabs button {
                padding: 9px 14px;
                background: #8881;
                border: 1px solid #8884;
                border-radius: 4px;
                font-weight: normal;
                color: inherit;
            }

            #nilspe-all-in-one .aio-tabs button.active {
                background: #337ab7;
                border-color: #337ab7;
                color: #fff;
            }

            #nilspe-all-in-one .aio-panel {
                padding: 16px;
                border: 1px solid #8885;
                border-radius: 6px;
                margin-bottom: 15px;
            }

            #nilspe-all-in-one .aio-panel h2 {
                font-size: 21px;
                font-weight: 400;
                margin: 0 0 8px;
            }

            #nilspe-all-in-one .aio-muted {
                opacity: .75;
                font-size: 13px;
            }

            #nilspe-all-in-one .aio-grid {
                display: grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(190px, 1fr));
                gap: 12px;
                margin-bottom: 16px;
            }

            #nilspe-all-in-one .aio-field {
                display: flex;
                flex-direction: column;
                gap: 5px;
                min-width: 0;
                margin: 0;
                font-weight: normal;
            }

            #nilspe-all-in-one .aio-field > span {
                font-size: 13px;
                font-weight: 500;
            }

            #nilspe-all-in-one .aio-field input,
            #nilspe-all-in-one .aio-field select {
                height: 34px;
                color: #333;
            }

            #nilspe-all-in-one .aio-row {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                margin: 12px 0;
            }

            #nilspe-all-in-one .aio-button {
                margin: 0;
            }

            #nilspe-all-in-one .aio-list {
                border: 1px solid #8885;
                border-radius: 5px;
                max-height: 360px;
                overflow-y: auto;
                margin: 10px 0;
            }

            #nilspe-all-in-one .aio-check-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 9px 12px;
                margin: 0;
                border-bottom: 1px solid #8883;
                background: #8881;
                font-weight: normal;
                cursor: pointer;
            }

            #nilspe-all-in-one .aio-check-row:nth-child(even) {
                background: #8882;
            }

            #nilspe-all-in-one .aio-check-row:hover {
                background: rgba(92,184,92,.10);
            }

            #nilspe-all-in-one .aio-check-row input {
                margin: 0;
                width: 15px;
                height: 15px;
            }

            #nilspe-all-in-one .aio-empty {
                padding: 12px;
                opacity: .7;
            }

            #nilspe-all-in-one .aio-count {
                font-size: 12px;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-pagination {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                margin: 10px 0 18px;
                font-size: 12px;
            }

            #nilspe-all-in-one .aio-pagination button {
                padding: 5px 12px;
                font-size: 12px;
            }

            #nilspe-all-in-one .aio-extension {
                display: grid;
                grid-template-columns:
                    minmax(180px, 1fr)
                    minmax(165px, auto)
                    minmax(150px, 180px);
                gap: 12px;
                align-items: center;
                padding: 10px 12px;
                border: 1px solid #8885;
                border-radius: 4px;
                background: #8881;
                margin-bottom: 5px;
            }

            #nilspe-all-in-one .aio-extension.aio-selected {
                border-color: rgba(92,184,92,.4);
                background: rgba(92,184,92,.08);
            }

            #nilspe-all-in-one .aio-extension strong {
                font-weight: 500;
            }

            #nilspe-all-in-one .aio-checkbox-inline {
                display: flex;
                align-items: center;
                gap: 7px;
                margin: 0;
                font-weight: normal;
            }

            #nilspe-all-in-one .aio-checkbox-inline input {
                margin: 0;
            }

            #nilspe-all-in-one .aio-vehicle {
                display: grid;
                grid-template-columns:
                    minmax(160px, 1.6fr)
                    minmax(140px, 1fr)
                    repeat(3, minmax(95px, .75fr))
                    minmax(145px, 1.1fr)
                    auto;
                gap: 9px;
                align-items: end;
                padding: 12px;
                margin-bottom: 8px;
                border: 1px solid rgba(92,184,92,.30);
                border-radius: 4px;
                background: rgba(92,184,92,.07);
            }

            #nilspe-all-in-one .aio-summary {
                display: grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(160px, 1fr));
                gap: 10px;
            }

            #nilspe-all-in-one .aio-summary-item {
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding: 14px;
                border: 1px solid #8885;
                border-radius: 5px;
                background: #8881;
            }

            #nilspe-all-in-one .aio-summary-item small {
                opacity: .7;
            }

            #nilspe-all-in-one .aio-summary-item strong {
                font-size: 17px;
                font-weight: 500;
            }

            #nilspe-all-in-one .aio-footer {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                padding: 15px;
                border: 1px solid #8885;
                border-radius: 5px;
                margin-top: 20px;
            }

            #nilspe-all-in-one .aio-status {
                margin-left: auto;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-progress {
                height: 8px;
                width: 100%;
                margin-top: 12px;
                border-radius: 4px;
                background: #8883;
                overflow: hidden;
            }

            #nilspe-all-in-one .aio-progress[hidden] {
                display: none;
            }

            #nilspe-all-in-one .aio-progress-fill {
                width: 0;
                height: 100%;
                background: #5cb85c;
                transition: width .1s linear;
            }

            #nilspe-all-in-one .aio-log {
                width: 100%;
                min-height: 160px;
                max-height: 370px;
                overflow: auto;
                white-space: pre-wrap;
                word-break: break-word;
                margin-top: 14px;
                padding: 15px;
                border: 1px solid #8885;
                border-radius: 5px;
                background: #8881;
                color: inherit;
                font-family: Consolas, monospace;
                font-size: 12px;
                line-height: 1.6;
            }

            /* =========================================
               NEU: LIVE-SYNCHRONISIERUNGSSTATUS
               ========================================= */

            #nilspe-all-in-one .aio-sync-panel {
                padding: 15px 18px;
                margin-bottom: 18px;
                border: 1px solid #8885;
                border-radius: 6px;
                background: #8881;
            }

            #nilspe-all-in-one .aio-sync-panel[hidden] {
                display: none;
            }

            #nilspe-all-in-one .aio-sync-heading {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 14px;
            }

            #nilspe-all-in-one .aio-sync-heading strong {
                font-weight: 500;
                font-size: 15px;
            }

            #nilspe-all-in-one .aio-sync-phase {
                font-size: 12px;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-sync-grid {
                display: grid;
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
                gap: 12px;
                margin-bottom: 12px;
            }

            #nilspe-all-in-one .aio-sync-metric {
                display: flex;
                flex-direction: column;
                gap: 5px;
                padding: 10px 12px;
                border: 1px solid #8884;
                border-radius: 4px;
                background: #8881;
            }

            #nilspe-all-in-one .aio-sync-metric small {
                opacity: .7;
                font-size: 11px;
            }

            #nilspe-all-in-one .aio-sync-metric strong {
                font-size: 18px;
                font-weight: 500;
            }

            #nilspe-all-in-one .aio-sync-description {
                font-size: 12px;
                opacity: .8;
                margin-bottom: 10px;
            }

            #nilspe-all-in-one .aio-sync-bar {
                position: relative;
                height: 6px;
                overflow: hidden;
                border-radius: 4px;
                background: #8883;
            }

            #nilspe-all-in-one .aio-sync-bar-fill {
                height: 100%;
                width: 0;
                background: #337ab7;
                transition: width .2s;
            }

            #nilspe-all-in-one
            .aio-sync-bar.aio-sync-indeterminate
            .aio-sync-bar-fill {
                position: absolute;
                width: 30%;
                animation: aio-sync-moving 1.6s
                    ease-in-out infinite alternate;
            }

            @keyframes aio-sync-moving {
                from {
                    left: 0;
                }

                to {
                    left: 70%;
                }
            }

            @media (max-width: 1050px) {
                #nilspe-all-in-one .aio-vehicle {
                    grid-template-columns:
                        repeat(3, minmax(140px, 1fr));
                }
            }

            @media (max-width: 720px) {
                #nilspe-all-in-one {
                    padding: 12px;
                }

                #nilspe-all-in-one .aio-extension {
                    grid-template-columns: 1fr;
                }

                #nilspe-all-in-one .aio-vehicle {
                    grid-template-columns: 1fr 1fr;
                }

                #nilspe-all-in-one .aio-sync-grid {
                    grid-template-columns: 1fr;
                }

                #nilspe-all-in-one .aio-status {
                    margin-left: 0;
                }
            }
        `;

        document.head.append(style);
    }

    // ============================================================
    // START
    // ============================================================

    const params = new URLSearchParams(
        location.search
    );

    if (
        location.pathname === '/settings/index' &&
        params.has('lss_all_in_one')
    ) {
        document.title =
            'LSS All in One · Leitstellenspiel';

        addStyles();

        const root = el('main');
        root.id = 'nilspe-all-in-one';

        document.body.replaceChildren(root);

        try {
            await mount(root);
        } catch (error) {
            console.error(PREFIX, error);

            root.append(
                el(
                    'p',
                    'alert alert-danger',
                    `Start fehlgeschlagen: ${error.message}`
                )
            );
        }

    } else {
        const buildingId = location.pathname.match(
            /^\/buildings\/(\d+)\/?$/
        )?.[1];

        if (
            location.pathname === '/' ||
            buildingId
        ) {
            const link = el(
                'a',
                'btn btn-default',
                'LSS All in One'
            );

            link.href =
                PAGE_URL +
                (buildingId
                    ? `&building=${buildingId}`
                    : '');

            link.target = '_blank';
            link.rel = 'noopener';

            const heading = buildingId
                ? document.querySelector(
                    'h1[building_type]'
                )
                : null;

            if (heading) {
                heading.after(link);
            } else {
                link.style.cssText =
                    'position:fixed;right:12px;bottom:12px;z-index:1050';

                document.body.append(link);
            }
        }
    }

    console.log(
        PREFIX,
        `Version ${VERSION} geladen`
    );
})();
