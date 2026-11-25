
 // ==UserScript==
 // @name         LSS All in One
 // @namespace    NilsPe.lss.all.in.one
 // @version      0.5.10
 // @description  Leitstellen-Werkzeuge und Soll-Ist-Ausführungsplan mit getrennten Fortschrittsphasen
 // @author       NilsPe
 // @match        https://*.leitstellenspiel.de/*
 // @match        https://leitstellenspiel.de/*
 // @grant        GM.getValue
 // @grant        GM.setValue
 // @grant        unsafeWindow
 // @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
 // @run-at       document-idle
 // ==/UserScript==

(async function () {
    'use strict';

    const VERSION = '0.5.10';
    const PAGE_URL = '/settings/index?lss_all_in_one=1';

    const PAGE_SIZE = 100;
    const PREVIEW_BATCH = 100;
    const DETAIL_LIMIT = 100;
    const LOG_LIMIT = 2500;

    const ACTION_DELAY = 100;
    const BUILDING_DELAY = 20;
    const CONFIRM_DELAYS = [0, 300, 500];

    const PLAN_MAX_AGE = 5 * 60 * 1000;

    const TAB_GROUPS = [
        {
            id: 'centers', title: 'Leitstellen',
            tabs: [
                ['centers', 'Auswahl & Einstellungen'],
                ['sharing', 'Freigaben']
            ]
        },
        {
            id: 'buildings', title: 'Wachen',
            tabs: [
                ['buildings', 'Auswahl & Ausbau'],
                ['buildingTools', 'Wachen-Aktionen'],
                ['extensions', 'Erweiterungen']
            ]
        },
        {
            id: 'vehicles', title: 'Fahrzeuge',
            tabs: [
                ['vehicles', 'Kauf & Personal'],
                ['vehicleTools', 'Fahrzeug-Aktionen'],
                ['trailers', 'Anhänger']
            ]
        },
        {
            id: 'personnel', title: 'Personal',
            tabs: [['recruiters', 'Personal verschieben']]
        },
        {
            id: 'plan', title: 'Planung',
            tabs: [
                ['templates', 'Vorlagen'],
                ['run', 'Ablauf']
            ]
        }
    ];

    const CREW_MODES = [
        ['both', 'Zuweisen und entfernen'],
        ['add', 'Nur zuweisen'],
        ['remove', 'Nur entfernen']
    ];

    const STATES = [
        ['', 'Unverändert'],
        ['on', 'Aktiv'],
        ['off', 'Inaktiv']
    ];

    const FALLBACK_BUILDINGS = new Map([
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
        [12, 'Schnelleinsatzgruppe'],
        [13, 'Polizeihubschrauberstation'],
        [15, 'Wasserrettung'],
        [18, 'Feuerwache (Kleinwache)'],
        [19, 'Polizeiwache (Kleinwache)'],
        [20, 'Rettungswache (Kleinwache)'],
        [21, 'Rettungshundestaffel'],
        [24, 'Reiterstaffel'],
        [25, 'Bergrettung'],
        [26, 'Seenotrettungswache'],
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

    function numbered(label, ids) {
        return ids.map((value, index) => ({
            value,
            name: `${label} ${index + 1}`
        }));
    }

    const FIRE_EXTENSIONS = [
        { value: 0, name: 'Rettungsdienst' },
        ...numbered('Abrollbehälter', [
            1, 2, 3, 4, 5, 7, 10, 11, 12, 17
        ]),
        { value: 6, name: 'Wasserrettung' },
        { value: 8, name: 'Flughafen' },
        { value: 9, name: 'Großwache' },
        { value: 13, name: 'Werkfeuerwehr' },
        { value: 14, name: 'NEA50' },
        { value: 15, name: 'NEA200' },
        { value: 16, name: 'Lüfter' },
        { value: 18, name: 'Drohne' },
        { value: 19, name: 'Verpflegungsdienst' },
        ...numbered('Anhänger-Stellplatz', [
            20, 21, 22, 23, 24
        ]),
        { value: 25, name: 'Bahnrettung' }
    ];

    const POLICE_EXTENSIONS = [
        ...numbered('Zelle', [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9
        ]),
        { value: 10, name: 'Diensthundestaffel' },
        { value: 11, name: 'Kriminalpolizei' },
        { value: 12, name: 'Dienstgruppenleitung' },
        { value: 13, name: 'Motorradstaffel' },
        { value: 14, name: 'Großwache' },
        { value: 15, name: 'Großgewahrsam' }
    ];

    const BEPOL_EXTENSIONS = [
        '2. Zug der Hundertschaft',
        '3. Zug der Hundertschaft',
        'Gefangenenkraftwagen',
        'Wasserwerfer',
        'SEK: 1. Zug',
        'SEK: 2. Zug',
        'MEK: 1. Zug',
        'MEK: 2. Zug',
        'Diensthundestaffel',
        'Reiterstaffel',
        'LauKW'
    ].map((name, value) => ({ name, value }));

    const THW_EXTENSIONS = [
        'Fachgruppe Notversorgung',
        'Zugtrupp',
        'Fachgruppe Räumen',
        'Fachgruppe Wassergefahren',
        '2. Technischer Zug',
        '2. Zug: Notversorgung',
        '2. Zug: Zugtrupp',
        'Fachgruppe Ortung',
        'Fachgruppe Wasserschaden/Pumpen',
        'Fachgruppe schwere Bergung',
        'Fachgruppe Elektroversorgung',
        'Mannschaftstransportwagen',
        'Unbemannte Luftfahrtsysteme',
        'Führung und Kommunikation'
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
        'Wasserrettung',
        'Rettungshundestaffel',
        'Drohne',
        'Betreuung und Verpflegung',
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

    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    const yieldUI = () =>
        new Promise(resolve => setTimeout(resolve, 0));

    const fmt = number =>
        Number(number).toLocaleString('de-DE');

    function el(tag, cls = '', text = '') {
        const node = document.createElement(tag);

        if (cls) node.className = cls;
        if (text) node.textContent = text;

        return node;
    }

    function button(text, color = 'default') {
        const node = el(
            'button',
            `btn btn-${color} aio-btn`,
            text
        );

        node.type = 'button';
        return node;
    }

    function input(type = 'text', placeholder = '') {
        const node = el('input', 'form-control');

        node.type = type;
        node.placeholder = placeholder;

        if (type === 'number') {
            node.min = '0';
            node.step = '1';
        }

        return node;
    }

    function select(options) {
        const node = el('select', 'form-control');

        for (const [value, label] of options) {
            const option = el('option', '', label);
            option.value = String(value);
            node.append(option);
        }

        return node;
    }

    function field(label, control) {
        const node = el('label', 'aio-field');

        node.append(
            el('span', '', label),
            control
        );

        return node;
    }

    function panel(title, subtitle = '') {
        const node = el('section', 'aio-panel');
        node.append(el('h2', '', title));

        if (subtitle) {
            node.append(
                el('p', 'aio-muted', subtitle)
            );
        }

        return node;
    }

    function row(...nodes) {
        const node = el('div', 'aio-row');
        node.append(...nodes);
        return node;
    }

    function numeric(control) {
        if (!control.checkValidity()) {
            throw new Error('Ungültige Zahl.');
        }

        return control.value === ''
            ? null
            : Number(control.value);
    }

    function stateFrom(control) {
        return control.value === ''
            ? null
            : control.value === 'on';
    }

    function stateTo(value) {
        return value == null
            ? ''
            : value ? 'on' : 'off';
    }

    function csrf() {
        return document.querySelector(
            'meta[name="csrf-token"]'
        )?.content ?? '';
    }

    function extName(type, id) {
        return (
            EXTENSIONS.get(Number(type)) ?? []
        ).find(item =>
            Number(item.value) === Number(id)
        )?.name ?? `Erweiterung ${id}`;
    }

    function extension(building, type) {
        return (Array.isArray(building?.extensions)
            ? building.extensions : []).find(
            item => item.type_id != null &&
                Number(item.type_id) === Number(type)
        );
    }

    function levelOf(building) {
        for (const key of [
            'level',
            'building_level',
            'current_level'
        ]) {
            const value = building?.[key];

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

    function centerId(building) {
        return Number(
            building.leitstelle_building_id ??
            building.dispatch_center_id ??
            building.dispatch_center_building_id ??
            0
        );
    }

    function knownNumber(object, keys) {
        for (const key of keys) {
            const value = object?.[key];

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



    function vehicleMax(vehicle) {
        const override = knownNumber(vehicle, [
            'max_personnel_override'
        ]);

        if (override != null) {
            return override;
        }

        return knownNumber(vehicle, [
            'custom_personal_max',
            'personal_max',
            'personnel_max',
            'max_personal'
        ]);
    }

    function vehicleCrew(vehicle) {
        return knownNumber(vehicle, [
            'personal_count',
            'personnel_count',
            'assigned_personnel_count'
        ]);
    }

    function vehicleType(vehicle) {
        return Number(vehicle.vehicle_type);
    }

    function purchaseKey(id, type) {
        return `${id}:${type}`;
    }

    async function fetchPage(url) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(
                `${url}: HTTP ${response.status}`
            );
        }

        const doc = new DOMParser().parseFromString(
            await response.text(),
            'text/html'
        );

        if (doc.querySelector('input[type="password"]')) {
            throw new Error('Anmeldung erforderlich.');
        }

        return doc;
    }

    async function postCredit(url, method = 'get') {
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

        if (response.status >= 400) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }
    }

    async function liveBuilding(id) {
        const response = await fetch(
            `/api/buildings/${id}`,
            {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Gebäude ${id}: HTTP ${response.status}`
            );
        }

        const payload = await response.json();
        const result = payload?.result ?? payload;

        const building = Array.isArray(result)
            ? result.find(
                item => Number(item.id) === Number(id)
            )
            : result;

        if (Number(building?.id) !== Number(id)) {
            throw new Error(
                `Gebäude ${id} nicht bestätigt.`
            );
        }

        return building;
    }

    async function confirmChange(read, test, label) {
        for (const delay of CONFIRM_DELAYS) {
            if (delay) await sleep(delay);

            const value = await read();

            if (test(value)) {
                return value;
            }
        }

        throw new Error(
            `${label}: Änderung nicht bestätigt.`
        );
    }

    async function liveLevel(id) {
        const doc = await fetchPage(
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

            let dd = dt.nextElementSibling;

            while (dd && dd.tagName !== 'DD') {
                if (dd.tagName === 'DT') {
                    dd = null;
                    break;
                }

                dd = dd.nextElementSibling;
            }

            const match = dd?.textContent
                .trim()
                .match(/^(?:Stufe\s*:?\s*)?(\d+)\b/i);

            if (match) {
                return Number(match[1]);
            }
        }

        for (const dd of doc.querySelectorAll('dd')) {
            const match = dd.textContent
                .replace(/\s+/g, ' ')
                .trim()
                .match(/^Stufe:\s*(\d+)/i);

            if (match) {
                return Number(match[1]);
            }
        }

        throw new Error(
            `Ausbaustufe von Gebäude ${id} nicht lesbar.`
        );
    }

    async function extensionOffers(id) {
        const doc = await fetchPage(
            `/buildings/${id}`
        );

        const offers = new Map();

        for (const link of doc.querySelectorAll(
            'a[href*="/extension/credits/"]'
        )) {
            const match = link.href.match(
                /\/extension\/credits\/(\d+)/
            );

            if (match) {
                offers.set(Number(match[1]), link.href);
            }
        }

        return offers;
    }

    async function extensionToggleUrl(id, type) {
        const doc = await fetchPage(
            `/buildings/${id}`
        );

        for (const link of doc.querySelectorAll(
            'a[href*="/extension_ready/"]'
        )) {
            const match = link.href.match(
                /\/extension_ready\/(\d+)/
            );

            if (
                Number(match?.[1]) === Number(type)
            ) {
                return link.href;
            }
        }

        throw new Error(
            `Umschaltlink für Erweiterung ${type} fehlt.`
        );
    }

    async function toggleBuilding(id) {
        const doc = await fetchPage(
            `/buildings/${id}`
        );

        const link = doc.querySelector(
            `a[href*="/buildings/${id}/active"],` +
            'a[href$="/active"][data-method],' +
            'a.btn[href$="/active"]'
        );

        if (!link?.href) {
            throw new Error(
                `Gebäudestatus ${id}: Link fehlt.`
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

    // ====================================================
    // FAHRZEUG-MASSENKAUF
    // ====================================================

    async function availablePurchase(buildingId, type) {
        const doc = await fetchPage(
            `/buildings/${buildingId}/vehicles/new`
        );

        const expected =
            `/vehicle/${buildingId}/${type}/credits`;

        const link = [
            ...doc.querySelectorAll(
                'section.purchase a[href]'
            )
        ].find(item =>
            new URL(item.href).pathname.endsWith(expected)
        );

        if (
            !link ||
            link.getAttribute('aria-disabled') === 'true' ||
            link.classList.contains('disabled')
        ) {
            return 0;
        }

        const section = link.closest('section.purchase');

        const quantityInput = section?.querySelector(
            'input.quantity-input'
        );

        if (!quantityInput) {
            return 1;
        }

        const maximum = Number(
            section.dataset.max ??
            quantityInput.max
        );

        return (
            Number.isInteger(maximum) &&
            maximum > 0
        )
            ? maximum
            : 0;
    }

    async function buyVehicle(buildingId, type, quantity) {
        if (
            !Number.isSafeInteger(quantity) ||
            quantity < 1
        ) {
            throw new Error('Ungültige Kaufmenge.');
        }

        const url =
            `/buildings/${buildingId}/vehicle/` +
            `${buildingId}/${type}/credits` +
            `?building=${buildingId}` +
            (
                quantity > 1
                    ? `&quantity=${quantity}`
                    : ''
            );

        await postCredit(url, 'get');
    }

    // ====================================================
    // MAXIMALPERSONAL
    // ====================================================

    async function readMax(id) {
        const doc = await fetchPage(
            `/vehicles/${id}/edit`
        );

        const value = doc.querySelector(
            '[name="vehicle[personal_max]"]'
        )?.value;

        if (
            value == null ||
            value === '' ||
            !Number.isSafeInteger(Number(value))
        ) {
            throw new Error(
                `Maximalpersonal Fahrzeug ${id} nicht lesbar.`
            );
        }

        return Number(value);
    }

    async function writeMax(id, value) {
        const token = csrf();

        if (!token) {
            throw new Error('CSRF-Token fehlt.');
        }

        const response = await fetch(
            `/vehicles/${id}`,
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

        if (response.status >= 400) {
            throw new Error(
                `Maximalpersonal HTTP ${response.status}`
            );
        }
    }

    // ====================================================
    // PERSONALZUWEISUNG
    // ====================================================

    async function assignmentDoc(id) {
        return fetchPage(
            `/vehicles/${id}/zuweisung`
        );
    }

    function assignedRows(doc) {
        return [...doc.querySelectorAll('tr')].filter(
            row => row.querySelector('a.btn-assigned')
        );
    }

    function qualifies(row, qualification) {
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

    async function changeCrew(
        vehicle,
        target,
        mode,
        act,
        check
    ) {
        let doc = await assignmentDoc(vehicle.id);

        while (true) {
            check();

            const assigned = assignedRows(doc);
            const current = assigned.length;

            if (current === target) {
                return;
            }

            const adding = current < target;

            if (
                (adding && mode === 'remove') ||
                (!adding && mode === 'add')
            ) {
                return;
            }

            const qualification =
                QUALIFICATIONS.get(Number(vehicle.vehicle_type));

            const available = [
                ...doc.querySelectorAll('tr')
            ].filter(row => {
                const action = row.querySelector(
                    'a.btn-success'
                );

                const course =
                    row.children?.[2]?.textContent
                        .trim() ?? '';

                return (
                    action &&
                    qualifies(row, qualification) &&
                    !course.startsWith('Im Unterricht')
                );
            });

            const suitableAssigned = assigned.filter(
                row => qualifies(row, qualification)
            );

            const candidate = adding
                ? available[0]
                : assigned.findLast(
                    row => !suitableAssigned.includes(row)
                ) ?? assigned.at(-1);

            const link = candidate?.querySelector(
                adding
                    ? 'a.btn-success'
                    : 'a.btn-assigned'
            );

            if (!link?.href) {
                throw new Error(
                    `Fahrzeug ${vehicle.id}: ` +
                    'Kein geeignetes Personal verfügbar.'
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
                    'Unerwarteter Personal-Link.'
                );
            }

            const expected =
                current + (adding ? 1 : -1);

            await act(
                `Fahrzeug ${vehicle.id}: ` +
                (
                    adding
                        ? 'Personal zuweisen'
                        : 'Personal entfernen'
                ),
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
                            `Personal HTTP ${response.status}`
                        );
                    }
                }
            );

            doc = await confirmChange(
                () => assignmentDoc(vehicle.id),
                value =>
                    assignedRows(value).length === expected,
                'Personaländerung'
            );
        }
    }

    // ====================================================
    // HAUPTOBERFLÄCHE
    // ====================================================

    async function mount(root) {
        const account = await getCurrentAccountId();

        const templatesKey =
            `nilspe.mastermind.templates.${account}`;

        const centersKey =
            `nilspe.allinone.centers.${account}`;

        const toolsTargetKey =
            `nilspe.allinone.targetCenter.${account}`;

        const toolsPreferencesKey =
            `nilspe.allinone.tools.${account}`;

        const storedToolTarget =
            String(await GM.getValue(toolsTargetKey, ''));

        let templates =
            await GM.getValue(templatesKey, {});

        if (
            !templates ||
            typeof templates !== 'object' ||
            Array.isArray(templates)
        ) {
            templates = {};
        }

        const storedCenters =
            await GM.getValue(centersKey, []);

        const selectedCenters = new Set(
            Array.isArray(storedCenters)
                ? storedCenters.map(Number)
                : []
        );

        const selectedBuildings = new Set();
        const db = await openDb();

        let buildings = [];
        let vehicles = [];

        let buildingById = new Map();
        let buildingsByType = new Map();
        let vehiclesByBuilding = new Map();

        let centers = [];
        let vehicleTypes = [];

        let vehicleLoaded = false;
        let prepared = null;

        let busy = false;
        let running = false;
        let cancelled = false;

        let stationPageIndex = 0;

        const logs = [];
        let pendingLogs = [];
        let logScheduled = false;

        const logView = el('pre', 'aio-log');

        function flushLog() {
            logScheduled = false;

            if (!pendingLogs.length) {
                return;
            }

            logs.push(...pendingLogs);
            pendingLogs = [];

            if (logs.length > LOG_LIMIT) {
                logs.splice(
                    0,
                    logs.length - LOG_LIMIT
                );
            }

            logView.textContent = logs.join('\n');
            logView.scrollTop = logView.scrollHeight;
        }

        function log(message) {
            const time = new Date()
                .toLocaleTimeString('de-DE');

            pendingLogs.push(
                `[${time}] ${message}`
            );

            if (!logScheduled) {
                logScheduled = true;
                requestAnimationFrame(flushLog);
            }
        }

        function clearLog() {
            logs.length = 0;
            pendingLogs = [];
            logView.textContent = '';
        }

        function buildingLabel(id) {
            const building =
                buildingById.get(Number(id));

            return (
                `${building?.caption ?? 'Gebäude'} (${id})`
            );
        }

        // =================================================
        // LAYOUT
        // =================================================

        const header = el('header', 'aio-header');
        const brand = el('div');

        brand.append(
            el('h1', '', 'LSS All in One'),
            el(
                'p',
                'aio-muted',
                'Leitstellenübergreifende Verwaltung'
            )
        );

        header.append(
            brand,
            el('span', 'aio-version', `v${VERSION}`)
        );

        const nav = el('div', 'aio-tabs');
        const primaryNav = el('div', 'aio-tab-primary');
        const secondaryNav = el('div', 'aio-tab-secondary');
        nav.append(primaryNav, secondaryNav);
        const content = el('div', 'aio-content');
        const apiDashboard = el('div', 'aio-api-dashboard');
        const footer = el('div', 'aio-footer');

        const status = el(
            'span',
            'aio-status',
            'Initialisierung …'
        );

        const refreshAll = button(
            'Gebäude komplett + Fahrzeuge aktualisieren',
            'primary'
        );

        const refreshBuildings = button(
            'Gebäude-API vollständig aktualisieren'
        );

        const refreshVehicles = button(
            'Fahrzeug-API aktualisieren'
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
            'Ablauf stoppen',
            'danger'
        );

        startButton.disabled = true;
        stopButton.disabled = true;

        const apiActions = el(
            'div',
            'aio-api-actions'
        );

        apiActions.append(
            refreshAll,
            refreshBuildings,
            refreshVehicles
        );

        footer.append(
            apiActions,
            previewButton,
            startButton,
            stopButton,
            status
        );

        // =================================================
        // FORTSCHRITT JE TATSÄCHLICHER AKTION
        // =================================================

        const phaseProgress = el(
            'div',
            'aio-phase-progress'
        );

        const PHASES = [
            {
                id: 'level',
                title: 'Gebäudestufen',
                unit: 'Wachen'
            },
            {
                id: 'extensions',
                title: 'Erweiterungen',
                unit: 'Wachen'
            },
            {
                id: 'state',
                title: 'Wachenstatus',
                unit: 'Wachen'
            },
            {
                id: 'vehicle',
                title: 'Fahrzeuge kaufen',
                unit: 'Wachen'
            },
            {
                id: 'max',
                title: 'Maximalpersonal',
                unit: 'Fahrzeuge'
            },
            {
                id: 'crew',
                title: 'Personalzuweisung',
                unit: 'Fahrzeuge'
            }
        ];

        function createPhaseCard(config) {
            const card = el(
                'section',
                'aio-phase-card'
            );

            card.dataset.phase = config.id;

            const heading = el(
                'div',
                'aio-phase-heading'
            );

            const title = el(
                'strong',
                '',
                config.title
            );

            const state = el(
                'span',
                'aio-phase-state',
                'Ausstehend'
            );

            heading.append(title, state);

            const track = el(
                'div',
                'aio-phase-track'
            );

            const fill = el(
                'div',
                'aio-phase-fill'
            );

            track.append(fill);

            const details = el(
                'div',
                'aio-phase-detail-row'
            );

            const current = el(
                'span',
                'aio-phase-current',
                'Noch nicht gestartet'
            );

            const count = el(
                'span',
                'aio-phase-count',
                `0 / 0 ${config.unit}`
            );

            const eta = el('span', 'aio-phase-eta');

            details.append(current, eta, count);

            card.append(
                heading,
                track,
                details
            );

            return {
                card,
                title,
                state,
                fill,
                current,
                eta,
                count,
                unit: config.unit,
                done: 0,
                total: 0,
                errors: 0,
                startedAt: 0,
                status: 'pending'
            };
        }

        const progressCards = {};

        for (const config of PHASES) {
            const card = createPhaseCard(config);
            progressCards[config.id] = card;
            phaseProgress.append(card.card);
        }

        function showPhaseCards(ids) {
            const active = new Set(ids);
            let number = 0;
            phaseProgress.hidden = active.size === 0;

            for (const config of PHASES) {
                const item = progressCards[config.id];
                item.card.hidden = !active.has(config.id);

                if (!item.card.hidden) {
                    item.title.textContent =
                        `Phase ${++number} – ${config.title}`;
                }
            }
        }

        function paintPhase(id) {
            const item = progressCards[id];

            const percent = item.total > 0
                ? Math.min(
                    100,
                    item.done / item.total * 100
                )
                : (
                    item.status === 'done' ||
                    item.status === 'skipped'
                )
                    ? 100
                    : 0;

            item.fill.style.width = `${percent}%`;

            item.count.textContent =
                `${fmt(item.done)} / ${fmt(item.total)} ` +
                item.unit;

            item.state.className =
                'aio-phase-state ' +
                item.status;

            const labels = {
                pending: 'Ausstehend',
                running: 'In Bearbeitung',
                done: 'Abgeschlossen',
                warning: 'Mit Fehlern',
                stopped: 'Angehalten',
                skipped: 'Keine Änderungen erforderlich'
            };

            item.state.textContent =
                labels[item.status] ??
                item.status;

            if (item.status === 'running') {
                if (item.done > 0 && item.done < item.total) {
                    const elapsed = performance.now() - item.startedAt;
                    const remaining = elapsed / item.done *
                        (item.total - item.done);
                    const seconds = Math.ceil(remaining / 1000);
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor(seconds % 3600 / 60);
                    const rest = seconds % 60;

                    item.eta.textContent = hours
                        ? `Rest ca. ${hours} h ${minutes} min`
                        : minutes
                            ? `Rest ca. ${minutes} min ${rest} s`
                            : `Rest ca. ${rest} s`;
                } else {
                    item.eta.textContent = item.done
                        ? '' : 'Restzeit wird ermittelt';
                }
            } else {
                item.eta.textContent = '';
            }
        }

        function resetPhases() {
            for (const config of PHASES) {
                const item = progressCards[config.id];

                item.done = 0;
                item.total = 0;
                item.errors = 0;
                item.startedAt = 0;
                item.status = 'pending';

                item.current.textContent =
                    'Noch nicht gestartet';

                paintPhase(config.id);
            }
        }

        function previewPhase(id, total, detail) {
            const item = progressCards[id];

            item.done = 0;
            item.total = total;
            item.errors = 0;
            item.startedAt = 0;

            item.status =
                total === 0
                    ? 'skipped'
                    : 'pending';

            item.current.textContent =
                total === 0
                    ? 'Keine Änderungen erforderlich'
                    : detail;

            paintPhase(id);
        }

        function beginPhase(id, total) {
            const item = progressCards[id];

            item.done = 0;
            item.total = total;
            item.errors = 0;
            item.startedAt = performance.now();

            item.status =
                total > 0
                    ? 'running'
                    : 'skipped';

            item.current.textContent =
                total > 0
                    ? 'Bearbeitung gestartet'
                    : 'Keine Änderungen erforderlich';

            paintPhase(id);
        }

        function updatePhase(
            id,
            done,
            detail,
            error = false
        ) {
            const item = progressCards[id];

            item.done = Math.min(
                item.total,
                Math.max(0, done)
            );

            if (error) {
                item.errors++;
            }

            if (detail) {
                item.current.textContent = detail;
            }

            paintPhase(id);
        }

        function finishPhase(id, stopped = false) {
            const item = progressCards[id];

            if (stopped) {
                item.status = 'stopped';
            } else if (!item.total) {
                item.status = 'skipped';
            } else if (item.errors) {
                item.status = 'warning';
            } else {
                item.status = 'done';
            }

            if (!stopped) {
                item.done = item.total;
            }

            if (item.status === 'done') {
                item.current.textContent =
                    'Alle Aufgaben abgeschlossen';
            }

            if (item.status === 'skipped') {
                item.current.textContent =
                    'Keine Änderungen erforderlich';
            }

            if (item.errors) {
                item.current.textContent =
                    `${item.errors} Fehler · Details im Protokoll`;
            }

            paintPhase(id);
        }

        resetPhases();
        showPhaseCards([]);

        const previewProgress = el(
            'div',
            'aio-preview-progress'
        );

        const previewFill = el(
            'div',
            'aio-preview-fill'
        );

        previewProgress.append(previewFill);
        previewProgress.hidden = true;

        function setPreviewProgress(done, total) {
            previewProgress.hidden = !total;

            previewFill.style.width =
                total
                    ? `${Math.min(100, done / total * 100)}%`
                    : '0%';
        }

        // =================================================
        // API-ANZEIGEN
        // =================================================

        function makeApiCard(title) {
            const card = el(
                'section',
                'aio-api-card'
            );

            const heading = el(
                'div',
                'aio-api-heading'
            );

            const badge = el(
                'span',
                'aio-api-badge',
                'Nicht geladen'
            );

            const count = el(
                'strong',
                'aio-api-count',
                '–'
            );

            const pageNumber = el('span', '', '–');
            const pageSize = el('span', '', '–');

            const detail = el(
                'p',
                'aio-muted',
                'Noch keine Synchronisierung.'
            );

            const bar = el('div', 'aio-api-bar');
            const fill = el('div', 'aio-api-fill');

            heading.append(
                el('strong', '', title),
                badge
            );

            bar.append(fill);

            const metrics = el(
                'div',
                'aio-api-metrics'
            );

            for (const [label, value] of [
                ['Datensätze', count],
                ['API-Seite', pageNumber],
                ['Seitengröße', pageSize]
            ]) {
                const item = el('div');

                item.append(
                    el('small', '', label),
                    value
                );

                metrics.append(item);
            }

            card.append(
                heading,
                metrics,
                detail,
                bar
            );

            return {
                card,
                badge,
                count,
                pageNumber,
                pageSize,
                detail,
                bar,
                fill,
                syncing: false
            };
        }

        const apiCards = {
            buildings: makeApiCard('Gebäude-API v2'),
            vehicles: makeApiCard('Fahrzeug-API v2')
        };

        apiDashboard.append(
            apiCards.buildings.card,
            apiCards.vehicles.card
        );

        root.append(
            header,
            nav,
            apiDashboard,
            content,
            phaseProgress,
            footer,
            previewProgress,
            logView
        );

        // =================================================
        // NAVIGATION
        // =================================================

        const pages = new Map();
        const lastTabByGroup = new Map();

        for (const group of TAB_GROUPS) {
            const primary = button(group.title);
            primary.dataset.group = group.id;
            primaryNav.append(primary);
            primary.onclick = () => showTab(
                lastTabByGroup.get(group.id) ?? group.tabs[0][0]
            );

            const subNav = el('div', 'aio-tab-group');
            subNav.dataset.group = group.id;
            secondaryNav.append(subNav);

            for (const [id, title] of group.tabs) {
                const tab = button(title);
                tab.dataset.tab = id;
                subNav.append(tab);

                const pageNode = el('div', 'aio-page');
                pageNode.hidden = true;
                content.append(pageNode);
                pages.set(id, pageNode);

                tab.onclick = () => showTab(id);
            }
        }

        function showTab(id) {
            const group = TAB_GROUPS.find(item =>
                item.tabs.some(([tabId]) => tabId === id)
            );

            if (!group) {
                return;
            }

            lastTabByGroup.set(group.id, id);

            for (const [key, node] of pages) {
                node.hidden = key !== id;
            }

            for (const node of primaryNav.children) {
                node.classList.toggle(
                    'active',
                    node.dataset.group === group.id
                );
            }

            for (const subNav of secondaryNav.children) {
                subNav.hidden = subNav.dataset.group !== group.id;

                for (const node of subNav.children) {
                    node.classList.toggle(
                        'active',
                        node.dataset.tab === id
                    );
                }
            }

            drawSummary();
        }

        function setStatus(message) {
            status.textContent = message;
        }

        function invalidate() {
            prepared = null;
            startButton.disabled = true;

            if (!running) {
                showPhaseCards([]);
            }
        }

        function setBusy(value, isRun = false) {
            busy = value;
            running = isRun;

            for (const node of [
                refreshAll,
                refreshBuildings,
                refreshVehicles,
                previewButton
            ]) {
                node.disabled = value;
            }

            startButton.disabled =
                value || !prepared;

            stopButton.disabled =
                !isRun || cancelled;

            for (const pageNode of pages.values()) {
                pageNode.querySelectorAll(
                    'input,select,button'
                ).forEach(node => {
                    node.disabled = value;
                });
            }

            toolsMoveRun.disabled = value ||
                !toolsSnapshot?.startsWith('{"kind":"move"');
            toolsRenameRun.disabled = value ||
                !toolsSnapshot?.startsWith('{"kind":"rename"');
            toolsStaffRun.disabled = value ||
                !toolsSnapshot?.startsWith('{"kind":"staff"');
            toolsActivateRun.disabled = value ||
                !toolsSnapshot?.startsWith('{"kind":"activate"');
            toolsDeactivateRun.disabled = value ||
                !toolsSnapshot?.startsWith('{"kind":"deactivate"');
            toolsDeleteRun.disabled = value ||
                !toolsSnapshot?.startsWith('{"kind":"delete"');
            vehicleDeleteRun.disabled = value || !vehicleDeleteSnapshot;
            vehicleStatusRun.disabled = value || !vehicleStatusSnapshot;
            trailerRun.disabled = value || !trailerSnapshot;
            recruitRun.disabled = value || !recruitSnapshot;
            shareRun.disabled = value || !shareSnapshot;
            recruitEducation.disabled = value ||
                recruitMode.value !== 'trained';
            quickDisabled.disabled = value || !quickForm;
            quickOwnMissions.disabled = value || !quickForm;
            quickSave.disabled = value || !quickForm;
        }

        function syncBegin(store) {
            const card = apiCards[store];

            card.syncing = true;
            card.badge.textContent =
                'Synchronisierung läuft';

            card.badge.className =
                'aio-api-badge running';

            card.detail.textContent =
                'API-Daten werden geprüft …';

            card.bar.classList.add('running');

            setStatus(
                `${store}: Synchronisierung läuft`
            );
        }

        function syncDone(store, count, changed) {
            const card = apiCards[store];

            card.syncing = false;
            card.count.textContent = fmt(count);

            card.badge.textContent =
                changed
                    ? 'Synchronisiert'
                    : 'Cache geladen';

            card.badge.className =
                'aio-api-badge success';

            card.detail.textContent =
                changed
                    ? 'API-v2-Abgleich abgeschlossen.'
                    : 'Gespeicherte Daten übernommen.';

            card.bar.classList.remove('running');
            card.fill.style.width = '100%';
        }

        function syncFail(store, error) {
            const card = apiCards[store];

            card.syncing = false;
            card.badge.textContent = 'Fehler';
            card.badge.className =
                'aio-api-badge error';

            card.detail.textContent =
                error.message;

            card.bar.classList.remove('running');
        }

        window.addEventListener(
            'nilspe-sync-progress',
            event => {
                const data = event.detail ?? {};
                const card = apiCards[data.storeName];

                if (!card?.syncing) return;

                card.pageNumber.textContent =
                    fmt(data.page ?? 0);

                card.count.textContent =
                    fmt(data.recordCount ?? 0);

                card.pageSize.textContent =
                    fmt(data.pageSize ?? 0);

                card.detail.textContent =
                    data.retrying
                        ? 'API-Anfrage wird wiederholt.'
                        : data.fullSync
                            ? 'Vollständiger API-Abruf'
                            : 'API-Änderungen laden';
            }
        );

        // =================================================
        // INDEXEDDB
        // =================================================

        function rebuildBuildings() {
            buildingById = new Map();
            buildingsByType = new Map();
            centers = [];

            for (const building of buildings) {
                const id = Number(building.id);
                const type = Number(building.building_type);

                buildingById.set(id, building);

                if (!buildingsByType.has(type)) {
                    buildingsByType.set(type, []);
                }

                buildingsByType.get(type).push(building);

                if (type === 7) {
                    centers.push(building);
                }
            }
        }

        function rebuildVehicles() {
            vehiclesByBuilding = new Map();

            for (const vehicle of vehicles) {
                const id = Number(vehicle.building_id);

                if (!vehiclesByBuilding.has(id)) {
                    vehiclesByBuilding.set(id, []);
                }

                vehiclesByBuilding.get(id).push(vehicle);
            }
        }

        async function loadBuildings(force = false) {
            syncBegin('buildings');

            try {
                const changed = await updateBuildings(
                    db,
                    force ? 0 : 300
                );

                buildings = await getAllData(
                    db,
                    'buildings'
                );

                buildings.sort((a, b) =>
                    String(a.caption ?? '').localeCompare(
                        String(b.caption ?? ''),
                        'de'
                    )
                );

                rebuildBuildings();

                syncDone(
                    'buildings',
                    buildings.length,
                    changed
                );

                return buildings.length;
            } catch (error) {
                syncFail('buildings', error);
                throw error;
            }
        }

        async function loadVehicles(force = false) {
            if (vehicleLoaded && !force) {
                return vehicles.length;
            }

            syncBegin('vehicles');

            try {
                const changed = await updateVehiclesV2(
                    db,
                    force ? 0 : 300
                );

                vehicles = await getAllData(
                    db,
                    'vehicles'
                );

                rebuildVehicles();
                vehicleLoaded = true;

                syncDone(
                    'vehicles',
                    vehicles.length,
                    changed
                );

                return vehicles.length;
            } catch (error) {
                syncFail('vehicles', error);
                throw error;
            }
        }

        function vehiclesAt(id) {
            return vehiclesByBuilding.get(
                Number(id)
            ) ?? [];
        }

        function vehiclesOf(id, type) {
            return vehiclesAt(id).filter(
                vehicle =>
                    vehicleType(vehicle) === Number(type)
            );
        }

        // =================================================
        // LEITSTELLEN
        // =================================================

        const centersPage = pages.get('centers');

        centersPage.append(panel(
            'Leitstellen auswählen',
            'Die Auswahl bleibt gespeichert.'
        ));

        const centerSearch = input(
            'search',
            'Leitstellen suchen …'
        );

        const centerAll = button('Alle auswählen');
        const centerNone = button('Alle abwählen');

        const centerCount = el(
            'span',
            'aio-muted'
        );

        const centerList = el(
            'div',
            'aio-list aio-center-list'
        );

        centersPage.append(
            centerSearch,
            row(
                centerAll,
                centerNone,
                centerCount
            ),
            centerList
        );

        function paginate(
            container,
            index,
            total,
            update
        ) {
            container.replaceChildren();

            const pagesTotal = Math.max(
                1,
                Math.ceil(total / PAGE_SIZE)
            );

            const previous = button('Zurück');
            const next = button('Weiter');

            previous.disabled = index === 0;
            next.disabled = index >= pagesTotal - 1;

            previous.onclick = () =>
                update(index - 1);

            next.onclick = () =>
                update(index + 1);

            container.append(
                previous,
                el(
                    'span',
                    '',
                    `Seite ${index + 1} von ${pagesTotal}`
                ),
                next
            );
        }

        function filteredCenters() {
            const search = centerSearch.value
                .trim()
                .toLowerCase();

            return centers.filter(item =>
                !search ||
                String(item.caption ?? '')
                    .toLowerCase()
                    .includes(search) ||
                String(item.id).includes(search)
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

            const fragment =
                document.createDocumentFragment();

            for (const center of matches) {
                const id = Number(center.id);
                const label = el('label', 'aio-check');
                const checkbox = input('checkbox');

                checkbox.checked =
                    selectedCenters.has(id);

                checkbox.onchange = async () => {
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

                    await saveCenters();
                };

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
                `${centers.length} ausgewählt`;

        }

        centerSearch.oninput = drawCenters;

        centerAll.onclick = async () => {
            for (const center of filteredCenters()) {
                selectedCenters.add(Number(center.id));
            }

            selectedBuildings.clear();

            invalidate();
            drawCenters();
            drawStations();

            await saveCenters();
        };

        centerNone.onclick = async () => {
            for (const center of filteredCenters()) {
                selectedCenters.delete(Number(center.id));
            }

            selectedBuildings.clear();

            invalidate();
            drawCenters();
            drawStations();

            await saveCenters();
        };

        const quickCenter = select([['', 'Leitstelle wählen']]);
        const quickLoad = button('Einstellungen laden');
        const quickDisabled = input('checkbox');
        const quickOwnMissions = input('checkbox');
        const quickSave = button('Leitstelle speichern', 'primary');
        const quickStatus = el('p', '', 'Leitstelle auswählen und laden.');
        let quickForm = null;

        centersPage.append(
            panel('Leitstelle Quick Settings',
                'Deaktivierung und eigener Einsatzbereich einer Leitstelle.'
            ),
            row(field('Leitstelle', quickCenter), quickLoad),
            row(
                field('Leitstelle deaktivieren', quickDisabled),
                field('Eigener Einsatzbereich', quickOwnMissions),
                quickSave
            ),
            quickStatus
        );

        quickDisabled.disabled = true;
        quickOwnMissions.disabled = true;
        quickSave.disabled = true;

        quickCenter.onchange = () => {
            quickForm = null;
            quickDisabled.disabled = true;
            quickOwnMissions.disabled = true;
            quickSave.disabled = true;
            quickStatus.textContent = 'Einstellungen neu laden.';
        };

        quickLoad.onclick = async () => {
            const id = Number(quickCenter.value);

            if (!id || !centers.some(center => Number(center.id) === id)) {
                quickStatus.textContent = 'Leitstelle auswählen.';
                return;
            }

            quickLoad.disabled = true;
            quickStatus.textContent = 'Einstellungen werden geladen …';

            try {
                const doc = await fetchPage(`/buildings/${id}/edit`);
                const form = [...doc.forms].find(node =>
                    node.querySelector('[name="building[active]"]') &&
                    node.querySelector(
                        '[name="building[generate_own_missions]"]'
                    )
                );

                if (!form) {
                    throw new Error('Einstellungsformular nicht gefunden.');
                }

                quickForm = form;
                quickDisabled.checked = form.querySelector(
                    '[name="building[active]"]'
                ).checked;
                quickOwnMissions.checked = form.querySelector(
                    '[name="building[generate_own_missions]"]'
                ).checked;
                quickDisabled.disabled = false;
                quickOwnMissions.disabled = false;
                quickSave.disabled = false;
                quickStatus.textContent = 'Einstellungen geladen.';
            } catch (error) {
                quickForm = null;
                quickStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                quickLoad.disabled = false;
            }
        };

        quickSave.onclick = async () => {
            if (!quickForm) {
                return;
            }

            quickSave.disabled = true;
            quickStatus.textContent = 'Einstellungen werden gespeichert …';

            try {
                quickForm.querySelector(
                    '[name="building[active]"]'
                ).checked = quickDisabled.checked;
                quickForm.querySelector(
                    '[name="building[generate_own_missions]"]'
                ).checked = quickOwnMissions.checked;
                const action = new URL(
                    quickForm.getAttribute('action') ||
                        `/buildings/${quickCenter.value}`,
                    location.origin
                );
                const response = await fetch(action.href, {
                    method: (quickForm.getAttribute('method') || 'post')
                        .toUpperCase(),
                    credentials: 'same-origin',
                    body: new FormData(quickForm),
                    headers: { Accept: 'text/html' }
                });

                if (!response.ok) {
                    throw new Error(`Speichern HTTP ${response.status}`);
                }

                quickStatus.textContent = 'Gespeichert.';
                await loadBuildings(true);
                drawCenters();
                quickForm = null;
                quickDisabled.disabled = true;
                quickOwnMissions.disabled = true;
            } catch (error) {
                quickStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                quickSave.disabled = !quickForm;
            }
        };

        // =================================================
        // GEBÄUDE
        // =================================================

        const buildingsPage = pages.get('buildings');

        buildingsPage.append(panel(
            'Gebäude',
            'Gebäudetyp, Ausbaustufe und Status.'
        ));

        const buildingType = select([
            ['', 'Gebäudetyp auswählen']
        ]);

        const targetLevel = input(
            'number',
            'Unverändert'
        );

        const buildingState = select(STATES);

        buildingsPage.append(
            row(
                field('Gebäudetyp', buildingType),
                field('Ziel-Ausbaustufe', targetLevel),
                field('Gebäudestatus', buildingState)
            )
        );

        const stationPanel = panel(
            'Wachen auswählen',
            'Jeweils 100 Wachen werden angezeigt.'
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
            'aio-muted'
        );

        const stationList = el(
            'div',
            'aio-list'
        );

        const stationPager = el(
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
            stationPager
        );

        buildingsPage.append(stationPanel);

        function matchingStations() {
            if (!buildingType.value) {
                return [];
            }

            const search = stationSearch.value
                .trim()
                .toLowerCase();

            return (
                buildingsByType.get(
                    Number(buildingType.value)
                ) ?? []
            ).filter(building =>
                selectedCenters.has(
                    centerId(building)
                ) &&
                (
                    !search ||
                    String(building.caption ?? '')
                        .toLowerCase()
                        .includes(search) ||
                    String(building.id).includes(search)
                )
            );
        }

        function drawStations() {
            const matches = matchingStations();

            stationPageIndex = Math.min(
                stationPageIndex,
                Math.max(
                    0,
                    Math.ceil(
                        matches.length / PAGE_SIZE
                    ) - 1
                )
            );

            const visible = matches.slice(
                stationPageIndex * PAGE_SIZE,
                (stationPageIndex + 1) * PAGE_SIZE
            );

            const fragment =
                document.createDocumentFragment();

            for (const building of visible) {
                const id = Number(building.id);
                const label = el('label', 'aio-check');
                const checkbox = input('checkbox');

                checkbox.checked =
                    selectedBuildings.has(id);

                checkbox.onchange = () => {
                    if (checkbox.checked) {
                        selectedBuildings.add(id);
                    } else {
                        selectedBuildings.delete(id);
                    }

                    invalidate();

                    stationCount.textContent =
                        `${fmt(selectedBuildings.size)} ausgewählt · ` +
                        `${fmt(matches.length)} Treffer`;
                };

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

            stationList.replaceChildren(fragment);

            stationCount.textContent =
                `${fmt(selectedBuildings.size)} ausgewählt · ` +
                `${fmt(matches.length)} Treffer`;

            paginate(
                stationPager,
                stationPageIndex,
                matches.length,
                index => {
                    stationPageIndex = index;
                    drawStations();
                }
            );
        }

        stationSearch.oninput = () => {
            stationPageIndex = 0;
            drawStations();
        };

        stationAll.onclick = () => {
            for (const item of matchingStations()) {
                selectedBuildings.add(Number(item.id));
            }

            invalidate();
            drawStations();
        };

        stationNone.onclick = () => {
            for (const item of matchingStations()) {
                selectedBuildings.delete(Number(item.id));
            }

            invalidate();
            drawStations();
        };

        buildingType.onchange = () => {
            selectedBuildings.clear();
            stationPageIndex = 0;

            invalidate();
            drawStations();
            drawExtensions();
        };

        // =================================================
        // ERWEITERUNGEN
        // =================================================

        const extensionsPage = pages.get('extensions');

        extensionsPage.append(panel(
            'Erweiterungen',
            'Fehlende Erweiterungen kaufen oder Status ändern.'
        ));

        const extensionList = el('div');
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

            const type = Number(buildingType.value);
            const choices = new Map();

            for (const item of EXTENSIONS.get(type) ?? []) {
                choices.set(
                    Number(item.value),
                    item.name
                );
            }

            for (
                const building
                of buildingsByType.get(type) ?? []
            ) {
                for (
                    const item
                    of building.extensions ?? []
                ) {
                    const id = Number(item.type_id);

                    if (!choices.has(id)) {
                        choices.set(
                            id,
                            item.caption ?? extName(type, id)
                        );
                    }
                }
            }

            for (const rule of saved) {
                const id = Number(rule.type);

                if (!choices.has(id)) {
                    choices.set(
                        id,
                        rule.name ?? extName(type, id)
                    );
                }
            }

            const fragment =
                document.createDocumentFragment();

            for (const [id, name] of [...choices].sort(
                (a, b) => a[0] - b[0]
            )) {
                const old = saved.find(
                    item => Number(item.type) === id
                );

                const line = el(
                    'div',
                    'aio-extension'
                );

                line.dataset.type = id;

                const buy = input('checkbox');
                buy.checked = Boolean(old?.buy);

                const buyLabel = el(
                    'label',
                    'aio-inline'
                );

                buyLabel.append(
                    buy,
                    el(
                        'span',
                        '',
                        'Bei Bedarf kaufen'
                    )
                );

                const enabled = select(STATES);
                enabled.value = stateTo(old?.enabled);

                line.append(
                    el(
                        'strong',
                        '',
                        `${name} (${id})`
                    ),
                    buyLabel,
                    field('Status', enabled)
                );

                fragment.append(line);
            }

            extensionList.append(fragment);
        }

        // =================================================
        // FAHRZEUGE & PERSONAL
        // =================================================

        const vehiclesPage = pages.get('vehicles');

        vehiclesPage.append(panel(
            'Fahrzeuge & Personal',
            'Feste Anzahl pro Wache. Leere Felder bleiben unverändert.'
        ));

        const vehicleList = el('div');
        const addVehicle = button(
            'Fahrzeugtyp hinzufügen'
        );

        vehiclesPage.append(
            vehicleList,
            addVehicle
        );

        function addVehicleRow(saved = {}) {
            const options = [
                ['', 'Fahrzeugtyp wählen'],
                ...vehicleTypes
            ];

            if (
                saved.type != null &&
                !options.some(
                    item =>
                        Number(item[0]) === Number(saved.type)
                )
            ) {
                options.push([
                    saved.type,
                    saved.name ?? `Fahrzeug ${saved.type}`
                ]);
            }

            const type = select(options);
            type.value = saved.type ?? '';

            const count = input(
                'number',
                'Unverändert'
            );

            count.value =
                saved.countByStaff === true
                    ? ''
                    : saved.count ?? '';

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

            const mode = select(CREW_MODES);
            mode.value = saved.crewMode ?? 'add';

            const remove = button(
                'Entfernen',
                'danger'
            );

            const line = el(
                'div',
                'aio-vehicle'
            );

            line.append(
                field('Fahrzeugtyp', type),
                field('Sollbestand', count),
                field('Maximalpersonal', max),
                field('Zielbesatzung', crew),
                field('Personalaktion', mode),
                remove
            );

            remove.onclick = () => {
                line.remove();
                invalidate();
            };

            vehicleList.append(line);
        }

        addVehicle.onclick = () => {
            addVehicleRow();
            invalidate();
        };

        // =================================================
        // VORLAGEN
        // =================================================

        const templatesPage = pages.get('templates');

        templatesPage.append(panel(
            'Vorlagenverwaltung',
            'Konfigurationen speichern und wiederverwenden.'
        ));

        const templatePicker = select([
            ['', 'Neue Vorlage']
        ]);

        const templateName = input(
            'text',
            'Vorlagenname'
        );

        const saveTemplateButton = button(
            'Vorlage speichern',
            'success'
        );

        const deleteTemplateButton = button(
            'Vorlage löschen',
            'danger'
        );

        const bepolPreset = button(
            'BePo-Verband übernehmen'
        );

        templatesPage.append(
            row(
                field('Vorlage', templatePicker),
                field('Name', templateName)
            ),
            row(
                saveTemplateButton,
                deleteTemplateButton,
                bepolPreset
            )
        );

        function refreshTemplatePicker(chosen = '') {
            templatePicker.replaceChildren();

            const blank = el(
                'option',
                '',
                'Neue Vorlage'
            );

            blank.value = '';
            templatePicker.append(blank);

            for (
                const [id, template]
                of Object.entries(templates).sort(
                    (a, b) =>
                        String(a[1].name).localeCompare(
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

            templatePicker.value = chosen;
        }

        function readTemplate() {
            if (!buildingType.value) {
                throw new Error(
                    'Bitte Gebäudetyp auswählen.'
                );
            }

            const vehicleRules = [
                ...vehicleList.children
            ].map(line => {
                const [type, mode] =
                    line.querySelectorAll('select');

                const [
                    countInput,
                    maxInput,
                    crewInput
                ] = line.querySelectorAll(
                    'input[type="number"]'
                );

                if (!type.value) {
                    throw new Error(
                        'Fahrzeugtyp fehlt in einer Zeile.'
                    );
                }

                const count = numeric(countInput);
                const max = numeric(maxInput);
                const crew = numeric(crewInput);

                if (
                    max != null &&
                    crew != null &&
                    crew > max
                ) {
                    throw new Error(
                        'Zielbesatzung größer als Maximalpersonal.'
                    );
                }

                return {
                    type: Number(type.value),
                    name:
                        type.selectedOptions[0].textContent,
                    count,
                    max,
                    crew,
                    crewMode: mode.value
                };
            }).filter(item =>
                item.count != null ||
                item.max != null ||
                item.crew != null
            );

            if (
                new Set(
                    vehicleRules.map(item => item.type)
                ).size !== vehicleRules.length
            ) {
                throw new Error(
                    'Doppelter Fahrzeugtyp.'
                );
            }

            const extensionRules = [
                ...extensionList.children
            ].filter(node =>
                node.dataset.type != null
            ).map(node => {
                const buy = node.querySelector(
                    'input[type="checkbox"]'
                );

                const enabled =
                    node.querySelector('select');

                const type = Number(
                    node.dataset.type
                );

                return {
                    type,
                    name: extName(
                        buildingType.value,
                        type
                    ),
                    buy: buy.checked,
                    enabled: stateFrom(enabled)
                };
            }).filter(item =>
                item.buy ||
                item.enabled != null
            );

            return {
                name: templateName.value.trim(),
                type: Number(buildingType.value),
                level: numeric(targetLevel),
                enabled: stateFrom(buildingState),
                extensions: extensionRules,
                vehicles: vehicleRules
            };
        }

        function loadTemplate() {
            const template =
                templates[templatePicker.value];

            templateName.value =
                template?.name ?? '';

            buildingType.value =
                template?.type ?? '';

            targetLevel.value =
                template?.level ?? '';

            buildingState.value =
                stateTo(template?.enabled);

            selectedBuildings.clear();
            stationPageIndex = 0;

            vehicleList.replaceChildren();

            for (
                const rule
                of template?.vehicles ?? []
            ) {
                addVehicleRow(rule);
            }

            drawExtensions(
                template?.extensions ?? []
            );

            drawStations();
            invalidate();
        }

        templatePicker.onchange = loadTemplate;

        saveTemplateButton.onclick = async () => {
            try {
                const template = readTemplate();

                if (!template.name) {
                    throw new Error(
                        'Vorlagenname fehlt.'
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
                    templatesKey,
                    updated
                );

                templates = updated;
                refreshTemplatePicker(id);

                log(
                    `Vorlage gespeichert: ${template.name}`
                );
            } catch (error) {
                log(
                    `FEHLER: ${error.message}`
                );
            }
        };

        deleteTemplateButton.onclick = async () => {
            const id = templatePicker.value;

            if (
                !id ||
                !window.confirm('Vorlage löschen?')
            ) {
                return;
            }

            const updated = {
                ...templates
            };

            delete updated[id];

            await GM.setValue(
                templatesKey,
                updated
            );

            templates = updated;

            refreshTemplatePicker();
            loadTemplate();

            log('Vorlage gelöscht.');
        };

        bepolPreset.onclick = () => {
            templatePicker.value = '';
            loadTemplate();

            buildingType.value = '11';
            templateName.value = 'BePo-Verband';

            addVehicleRow({
                type: 50,
                name: 'GruKw',
                count: null,
                max: 1,
                crewMode: 'both'
            });

            drawExtensions();
            drawStations();

            invalidate();
            showTab('vehicles');
        };

        // =================================================
        // ABLAUFANZEIGE
        // =================================================

        const runPage = pages.get('run');

        runPage.append(panel(
            'Ablaufsteuerung',
            'Die Vorschau zeigt nur Arbeitsschritte mit offenen Aufgaben.'
        ));

        const summary = el(
            'div',
            'aio-summary'
        );

        const phaseText = el(
            'p',
            'aio-phase',
            'Bereit'
        );

        const planText = el(
            'p',
            'aio-muted'
        );

        runPage.append(
            summary,
            phaseText,
            planText
        );

        function drawSummary() {
            summary.replaceChildren();

            for (
                const [label, value]
                of [
                    ['Leitstellen', selectedCenters.size],
                    ['Wachen', selectedBuildings.size],
                    [
                        'Gebäudetyp',
                        buildingType.selectedOptions[0]
                            ?.textContent ??
                            'Nicht gewählt'
                    ],
                    [
                        'Vorlage',
                        templateName.value ||
                            'Ohne Namen'
                    ]
                ]
            ) {
                const item = el(
                    'div',
                    'aio-summary-item'
                );

                item.append(
                    el('small', '', label),
                    el(
                        'strong',
                        '',
                        String(value)
                    )
                );

                summary.append(item);
            }
        }

        function setPhase(message) {
            phaseText.textContent = message;
            setStatus(message);
        }

        // =================================================
        // SOLL-IST-ARBEITSPLAN
        // =================================================

        function needsCrew(current, target, mode) {
            if (current == null) {
                return true;
            }

            if (mode === 'add') {
                return current < target;
            }

            if (mode === 'remove') {
                return current > target;
            }

            return current !== target;
        }

        function personalTask(
            vehicle,
            rule,
            buildingId,
            isNew = false
        ) {
            const maxCurrent = vehicleMax(vehicle);
            const crewCurrent = vehicleCrew(vehicle);

            const maxNeeded =
                rule.max != null &&
                (
                    maxCurrent == null ||
                    maxCurrent !== rule.max
                );

            const crewNeeded =
                rule.crew != null &&
                needsCrew(
                    crewCurrent,
                    rule.crew,
                    rule.crewMode ?? 'add'
                );

            if (!maxNeeded && !crewNeeded) {
                return null;
            }

            return {
                buildingId,
                vehicleId: Number(vehicle.id),
                vehicleType: rule.type,
                name: rule.name,
                maxTarget: rule.max,
                crewTarget: rule.crew,
                crewMode: rule.crewMode ?? 'add',
                maxNeeded,
                crewNeeded,
                maxUnknown: maxCurrent == null,
                crewUnknown: crewCurrent == null,
                isNew
            };
        }

        /* Personal allein erzeugt keine Gebäude- oder Kaufphase. */

        function hasPhaseOneWork(job) {
            return Boolean(
                job.level != null ||
                job.checkLevel ||
                job.extensionsBuy.length ||
                job.extensionsState.length ||
                job.checkExtensions.length ||
                job.buildingEnabled != null ||
                job.checkEnabled ||
                job.purchases.length
            );
        }

        function hasPersonnelWork(job) {
            return Boolean(
                job.personnel.length ||
                job.personnelAfterPurchase.length
            );
        }

        function jobNeedsStage(job, stage) {
            switch (stage) {
                case 'level':
                    return job.level != null || job.checkLevel;
                case 'extensions':
                    return Boolean(
                        job.extensionsBuy.length ||
                        job.extensionsState.length ||
                        job.checkExtensions.length
                    );
                case 'state':
                    return job.buildingEnabled != null || job.checkEnabled;
                case 'vehicle':
                    return job.purchases.length > 0;
                default:
                    return false;
            }
        }

        const BUILDING_STAGES = [
            'level', 'extensions', 'state', 'vehicle'
        ];

        function phaseIdsForPlan(jobs, lists) {
            const ids = BUILDING_STAGES.filter(stage =>
                lists.buildingJobs.some(job => jobNeedsStage(job, stage))
            );
            const afterPurchase = jobs.flatMap(job =>
                job.personnelAfterPurchase
            );

            if (lists.maxTasks.length ||
                afterPurchase.some(rule => rule.max != null)) {
                ids.push('max');
            }

            if (lists.crewTasks.length ||
                afterPurchase.some(rule => rule.crew != null)) {
                ids.push('crew');
            }

            return ids;
        }

        function buildJob(building, template) {
            const id = Number(building.id);

            if (
                Number(building.building_type) !==
                template.type
            ) {
                throw new Error(
                    `${building.caption}: Falscher Gebäudetyp.`
                );
            }

            const job = {
                id,
                level: null,
                checkLevel: false,
                extensionsBuy: [],
                extensionsState: [],
                checkExtensions: [],
                buildingEnabled: null,
                checkEnabled: false,
                purchases: [],
                existingVehicleIds: {},
                personnel: [],
                personnelAfterPurchase: [],
                description: [],
                hasPhaseOne: false,
                hasPersonnel: false,
                hasWork: false
            };

            if (template.level != null) {
                const current = levelOf(building);

                if (current == null) {
                    job.level = template.level;
                    job.checkLevel = true;

                    job.description.push(
                        `Ausbaustufe prüfen · Soll ${template.level}`
                    );
                } else if (current < template.level) {
                    job.level = template.level;

                    job.description.push(
                        `Ausbaustufe: ${current} → ${template.level}`
                    );
                }
            }

            for (const rule of template.extensions) {
                if (!Array.isArray(building.extensions)) {
                    job.checkExtensions.push({
                        ...rule
                    });

                    job.description.push(
                        `${rule.name}: Istzustand prüfen`
                    );

                    continue;
                }

                const current = extension(
                    building,
                    rule.type
                );

                if (!current) {
                    if (rule.buy) {
                        job.extensionsBuy.push({
                            ...rule
                        });

                        job.description.push(
                            `${rule.name}: Kaufen`
                        );

                        if (rule.enabled != null) {
                            job.extensionsState.push({
                                ...rule
                            });
                        }
                    }

                    continue;
                }

                if (rule.enabled != null) {
                    if (
                        typeof current.enabled !==
                        'boolean'
                    ) {
                        job.checkExtensions.push({
                            ...rule
                        });

                        job.description.push(
                            `${rule.name}: Status prüfen`
                        );
                    } else if (
                        current.enabled !== rule.enabled
                    ) {
                        job.extensionsState.push({
                            ...rule
                        });

                        job.description.push(
                            `${rule.name}: ` +
                            (
                                rule.enabled
                                    ? 'Aktivieren'
                                    : 'Deaktivieren'
                            )
                        );
                    }
                }
            }

            if (template.enabled != null) {
                if (
                    typeof building.enabled !==
                    'boolean'
                ) {
                    job.checkEnabled = true;
                    job.buildingEnabled =
                        template.enabled;

                    job.description.push(
                        'Gebäudestatus prüfen'
                    );
                } else if (
                    building.enabled !==
                    template.enabled
                ) {
                    job.buildingEnabled =
                        template.enabled;

                    job.description.push(
                        template.enabled
                            ? 'Gebäude aktivieren'
                            : 'Gebäude deaktivieren'
                    );
                }
            }

            for (const rule of template.vehicles) {
                const existing = vehiclesOf(
                    id,
                    rule.type
                );

                job.existingVehicleIds[rule.type] =
                    existing.map(vehicle =>
                        Number(vehicle.id)
                    );

                if (rule.count != null) {
                    const missing = Math.max(
                        0,
                        Number(rule.count) -
                            existing.length
                    );

                    if (missing > 0) {
                        job.purchases.push({
                            type: rule.type,
                            name: rule.name,
                            before: existing.length,
                            missing,
                            target: Number(rule.count)
                        });

                        job.description.push(
                            `${rule.name}: ` +
                            `${existing.length} → ${rule.count} · ` +
                            `${missing} kaufen`
                        );
                    }
                }

                if (
                    rule.max == null &&
                    rule.crew == null
                ) {
                    continue;
                }

                for (const vehicle of existing) {
                    const task = personalTask(
                        vehicle,
                        rule,
                        id,
                        false
                    );

                    if (task) {
                        job.personnel.push(task);
                    }
                }

                if (
                    rule.count != null &&
                    Number(rule.count) >
                        existing.length
                ) {
                    job.personnelAfterPurchase.push({
                        ...rule
                    });
                }
            }

            const maxTasks = job.personnel.filter(
                task => task.maxNeeded
            ).length;

            const crewTasks = job.personnel.filter(
                task => task.crewNeeded
            ).length;

            if (maxTasks) {
                job.description.push(
                    `Maximalpersonal: ${maxTasks} vorhandene Fahrzeuge`
                );
            }

            if (crewTasks) {
                job.description.push(
                    `Personalzuweisung: ${crewTasks} vorhandene Fahrzeuge`
                );
            }

            if (job.personnelAfterPurchase.length) {
                job.description.push(
                    'Neue Fahrzeuge nach Kaufbestätigung prüfen'
                );
            }

            job.hasPhaseOne = hasPhaseOneWork(job);
            job.hasPersonnel = hasPersonnelWork(job);

            job.hasWork =
                job.hasPhaseOne ||
                job.hasPersonnel;

            return job;
        }

        /* Gebäude-/Kaufaufträge und konkrete Personalaufträge
         * bleiben getrennt. Neue Fahrzeuge werden nach erfolgreicher
         * Kaufbestätigung ergänzt. */

        function splitPlan(jobs) {
            const buildingJobs = jobs.filter(
                job => job.hasPhaseOne
            );

            const maxTasks = [];
            const crewTasks = [];

            for (const job of jobs) {
                for (const task of job.personnel) {
                    if (task.maxNeeded) {
                        maxTasks.push(task);
                    }

                    if (task.crewNeeded) {
                        crewTasks.push(task);
                    }
                }
            }

            return {
                buildingJobs,
                maxTasks,
                crewTasks
            };
        }

        // =================================================
        // VORSCHAU
        // =================================================

        previewButton.onclick = async () => {
            if (busy) return;

            invalidate();
            setBusy(true);
            drawSummary();

            try {
                const template = readTemplate();
                const ids = [...selectedBuildings];

                if (!selectedCenters.size) {
                    throw new Error(
                        'Keine Leitstelle ausgewählt.'
                    );
                }

                if (!ids.length) {
                    throw new Error(
                        'Keine Wache ausgewählt.'
                    );
                }

                clearLog();
                resetPhases();
                showPhaseCards([]);

                log(
                    '--- API-v2-Abgleich vor der Vorschau ---'
                );

                await loadBuildings(true);

                if (template.vehicles.length) {
                    await loadVehicles(true);
                }

                const valid = new Set(
                    (
                        buildingsByType.get(
                            template.type
                        ) ?? []
                    ).filter(building =>
                        selectedCenters.has(
                            centerId(building)
                        )
                    ).map(building =>
                        Number(building.id)
                    )
                );

                if (
                    ids.some(id => !valid.has(id))
                ) {
                    throw new Error(
                        'Wachenauswahl stimmt nicht mit Leitstellen überein.'
                    );
                }

                log(
                    '--- Soll-Ist-Ausführungsplan ---'
                );

                const jobs = [];
                let skipped = 0;
                let errors = 0;
                let shown = 0;

                setPreviewProgress(
                    0,
                    ids.length
                );

                for (
                    let index = 0;
                    index < ids.length;
                    index++
                ) {
                    const id = ids[index];

                    try {
                        const building =
                            buildingById.get(id);

                        if (!building) {
                            throw new Error(
                                `${buildingLabel(id)} fehlt im Cache.`
                            );
                        }

                        const job = buildJob(
                            building,
                            template
                        );

                        if (job.hasWork) {
                            jobs.push(job);

                            if (shown < DETAIL_LIMIT) {
                                log(
                                    `\n${buildingLabel(id)}:\n  ` +
                                    job.description.join(
                                        '\n  '
                                    )
                                );

                                shown++;
                            }
                        } else {
                            skipped++;
                        }
                    } catch (error) {
                        errors++;

                        log(
                            `FEHLER ${buildingLabel(id)}: ` +
                            error.message
                        );
                    }

                    if (
                        (index + 1) % PREVIEW_BATCH ===
                            0 ||
                        index === ids.length - 1
                    ) {
                        setPreviewProgress(
                            index + 1,
                            ids.length
                        );

                        await yieldUI();
                    }
                }

                if (errors) {
                    throw new Error(
                        `${errors} Wachen konnten nicht ausgewertet werden.`
                    );
                }

                // Nur Wachen mit offenen Gebäude-/Kaufaktionen vormerken.
                const lists = splitPlan(jobs);
                const phaseIds = phaseIdsForPlan(jobs, lists);

                prepared = {
                    createdAt: Date.now(),
                    template,
                    ids,
                    jobs,
                    skipped,
                    phaseIds,
                    buildingJobs: lists.buildingJobs,
                    initialMaxTasks: lists.maxTasks,
                    initialCrewTasks: lists.crewTasks
                };

                const phaseOneSkipped =
                    ids.length - lists.buildingJobs.length;

                log(
                    '\n--- Ergebnis der Vorschau ---'
                );

                log(
                    `Ausgewählte Wachen: ${fmt(ids.length)}`
                );

                log(
                    `Vollständig fertig: ${fmt(skipped)}`
                );

                log(`${fmt(phaseOneSkipped)} Wachen ohne Gebäude- oder Kaufaktionen.`);

                const newVehicleRules = jobs.reduce(
                    (sum, job) =>
                        sum + job.personnelAfterPurchase.length,
                    0
                );

                if (newVehicleRules) {
                    log(
                        'Zusätzliche Personalaufträge für neue Fahrzeuge ' +
                        'werden nach der Kaufbestätigung ergänzt.'
                    );
                }

                showPhaseCards(phaseIds);

                for (const stage of BUILDING_STAGES) {
                    if (!phaseIds.includes(stage)) continue;

                    const count = lists.buildingJobs.filter(job =>
                        jobNeedsStage(job, stage)
                    ).length;

                    previewPhase(stage, count, `${fmt(count)} Wachen offen`);
                }

                for (const [id, tasks] of [
                    ['max', lists.maxTasks],
                    ['crew', lists.crewTasks]
                ]) {
                    if (!phaseIds.includes(id)) continue;

                    previewPhase(id, tasks.length,
                        `${fmt(tasks.length)} Fahrzeuge offen`);

                    if (!tasks.length) {
                        progressCards[id].status = 'pending';
                        progressCards[id].current.textContent =
                            'Aufträge nach Fahrzeugkauf ermitteln';
                        paintPhase(id);
                    }
                }

                const phaseSummary = phaseIds.map(id => {
                    const config = PHASES.find(item => item.id === id);
                    const count = progressCards[id].total;
                    return `${config.title}: ${fmt(count)}`;
                });

                planText.textContent = phaseSummary.length
                    ? `${fmt(skipped)} Wachen vollständig fertig · ` +
                        phaseSummary.join(' · ')
                    : 'Alle ausgewählten Wachen sind bereits fertig.';

                setStatus(
                    'Arbeitsplan bereit'
                );

                log(`${phaseIds.length} benötigte Arbeitsphasen erstellt.`);

            } catch (error) {
                log(
                    `FEHLER: ${error.message}`
                );

                setStatus(
                    'Vorschau fehlgeschlagen'
                );
            } finally {
                setBusy(false);
            }
        };

        // =================================================
        // AUSFÜHRUNG
        // =================================================

        function check() {
            if (cancelled) {
                throw new Error(
                    'Ablauf angehalten.'
                );
            }
        }

        async function act(message, operation) {
            check();

            log(`  ${message}`);
            await operation();

            await sleep(ACTION_DELAY);
        }

        async function runBuildingJob(job, ledger, stage) {
            check();

            const id = job.id;

            if (stage === 'level' && job.level != null) {
                let level =
                    job.checkLevel
                        ? await liveLevel(id)
                        : levelOf(
                            buildingById.get(id)
                        );

                if (level == null) {
                    level = await liveLevel(id);
                }

                while (level < job.level) {
                    check();

                    const previous = level;
                    const expected = previous + 1;

                    await act(
                        `Ausbaustufe ${expected} kaufen`,
                        () => postCredit(
                            `/buildings/${id}/expand_do/credits` +
                            `?level=${previous}`,
                            'get'
                        )
                    );

                    level = await confirmChange(
                        () => liveLevel(id),
                        value => value >= expected,
                        'Ausbaustufe'
                    );
                }
            }

            if (stage === 'extensions') {
            // Der Sammel-Cache wird inkrementell aktualisiert. Gerade
            // gekaufte Erweiterungen deshalb vor dem Kauf am einzelnen
            // Gebäude live prüfen.
            const liveBefore = await liveBuilding(id);

            if (!Array.isArray(liveBefore.extensions)) {
                throw new Error('Live-Erweiterungsbestand unbekannt.');
            }

            const buyRules = [
                ...job.extensionsBuy
            ];

            const stateRules = [
                ...job.extensionsState
            ];

            if (job.checkExtensions.length) {
                for (
                    const rule
                    of job.checkExtensions
                ) {
                    const existing = extension(
                        liveBefore,
                        rule.type
                    );

                    if (!existing && rule.buy) {
                        buyRules.push(rule);
                    }

                    if (
                        rule.enabled != null &&
                        (existing || rule.buy)
                    ) {
                        stateRules.push(rule);
                    }
                }
            }

            for (const rule of buyRules) {
                check();

                if (extension(liveBefore, rule.type)) {
                    log(`  ${rule.name}: bereits vorhanden (Live-API)`);
                    continue;
                }

                const offers = await extensionOffers(id);
                const url = offers.get(rule.type);

                if (!url) {
                    // Zwischen Vorschau und Durchlauf kann die Erweiterung
                    // auch auf anderem Weg gekauft worden sein.
                    const current = await liveBuilding(id);

                    if (extension(current, rule.type)) {
                        log(`  ${rule.name}: inzwischen vorhanden`);
                        continue;
                    }

                    const liveTypes = Array.isArray(current.extensions)
                        ? current.extensions
                            .map(item => item.type_id)
                            .filter(value => value != null)
                            .slice(0, 25)
                            .join(', ')
                        : 'unbekannt';

                    throw new Error(
                        `${rule.name} (Typ-ID ${rule.type}): weder im ` +
                        'Live-Bestand noch als Kaufangebot gefunden. ' +
                        `Live-IDs: ${liveTypes || 'keine'}`
                    );
                }

                await act(
                    `${rule.name} kaufen`,
                    () => postCredit(url, 'post')
                );

                await confirmChange(
                    () => liveBuilding(id),
                    value =>
                        Boolean(
                            extension(value, rule.type)
                        ),
                    rule.name
                );
            }

            for (const rule of stateRules) {
                check();

                const live = await liveBuilding(id);
                const existing = extension(
                    live,
                    rule.type
                );

                if (!existing) {
                    throw new Error(
                        `${rule.name}: Erweiterung fehlt.`
                    );
                }

                if (
                    existing.enabled === rule.enabled
                ) {
                    continue;
                }

                if (
                    typeof existing.enabled !==
                    'boolean'
                ) {
                    throw new Error(
                        `${rule.name}: Status unbekannt.`
                    );
                }

                const url = await extensionToggleUrl(
                    id,
                    rule.type
                );

                await act(
                    `${rule.name} ` +
                    (
                        rule.enabled
                            ? 'aktivieren'
                            : 'deaktivieren'
                    ),
                    () => postCredit(url, 'post')
                );

                await confirmChange(
                    () => liveBuilding(id),
                    value =>
                        extension(
                            value,
                            rule.type
                        )?.enabled === rule.enabled,
                    rule.name
                );
            }

            }

            if (stage === 'state' && job.buildingEnabled != null) {
                let needsChange = true;

                if (job.checkEnabled) {
                    const live =
                        await liveBuilding(id);

                    if (
                        typeof live.enabled !==
                        'boolean'
                    ) {
                        throw new Error(
                            'Gebäudestatus unbekannt.'
                        );
                    }

                    needsChange =
                        live.enabled !==
                        job.buildingEnabled;
                }

                if (needsChange) {
                    await act(
                        job.buildingEnabled
                            ? 'Gebäude aktivieren'
                            : 'Gebäude deaktivieren',
                        () => toggleBuilding(id)
                    );

                    await confirmChange(
                        () => liveBuilding(id),
                        value =>
                            value.enabled ===
                            job.buildingEnabled,
                        'Gebäudestatus'
                    );
                }
            }

            if (stage === 'vehicle') {
            for (const purchase of job.purchases) {
                check();

                let missing =
                    purchase.missing;

                const entry = {
                    buildingId: id,
                    type: purchase.type,
                    name: purchase.name,
                    before: purchase.before,
                    requested: 0,
                    requests: 0,
                    expected: purchase.before,
                    confirmed: false
                };

                ledger.set(
                    purchaseKey(id, purchase.type),
                    entry
                );

                while (missing > 0) {
                    check();

                    const available =
                        await availablePurchase(
                            id,
                            purchase.type
                        );

                    if (!available) {
                        throw new Error(
                            `${purchase.name}: ${missing} fehlen, ` +
                            'derzeit nicht kaufbar.'
                        );
                    }

                    const quantity = Math.min(
                        missing,
                        available
                    );

                    await act(
                        `${purchase.name}: ${quantity} kaufen ` +
                        `(Massenkauf ${entry.requests + 1})`,
                        () => buyVehicle(
                            id,
                            purchase.type,
                            quantity
                        )
                    );

                    entry.requested += quantity;
                    entry.requests++;

                    entry.expected =
                        entry.before +
                        entry.requested;

                    missing -= quantity;

                    log(
                        `  ${purchase.name}: ` +
                        `${entry.requested}/${purchase.missing} ` +
                        'angefordert'
                    );
                }
            }
            }
        }

        // =================================================
        // FAHRZEUGBESTÄTIGUNG
        // =================================================

        async function verifyPurchases(ledger) {
            if (!ledger.size) {
                log(
                    'Keine Fahrzeugkäufe – abschließender ' +
                    'Fahrzeug-API-Abgleich entfällt.'
                );

                return;
            }

            log(
                '\n--- Fahrzeugprüfung nach dem Kauf ---'
            );

            setPhase(
                'Fahrzeug-API synchronisieren'
            );

            await loadVehicles(true);

            for (const entry of ledger.values()) {
                const actual = vehiclesOf(
                    entry.buildingId,
                    entry.type
                ).length;

                entry.confirmed =
                    actual >= entry.expected;

                log(
                    (
                        entry.confirmed
                            ? 'BESTÄTIGT'
                            : 'NICHT BESTÄTIGT'
                    ) +
                    `: ${buildingLabel(entry.buildingId)} · ` +
                    `${entry.name} · ` +
                    `${entry.before} → ${actual} · ` +
                    `Soll ${entry.expected}`
                );
            }
        }

        // =================================================
        // PERSONALAUFTRÄGE ZUSAMMENSTELLEN
        // =================================================

        function createPersonnelQueue(
            snapshot,
            ledger,
            phaseOneSuccessful,
            verificationFailed
        ) {
            const tasks = [];

            for (const job of snapshot.jobs) {
                /* Reine Personalaufträge benötigen keine Gebäude- oder
                 * Kaufphase. Fehlerhafte Gebäudeaktionen sperren hingegen
                 * die abhängigen Personalaufträge dieser Wache. */

                const phaseOneOkay =
                    !job.hasPhaseOne ||
                    phaseOneSuccessful.has(job.id);

                if (!phaseOneOkay) {
                    log(
                        `Personal übersprungen: ${buildingLabel(job.id)} · ` +
                        'Gebäude- oder Kaufaktion nicht erfolgreich.'
                    );

                    continue;
                }

                const hasPurchases =
                    job.purchases.length > 0;

                if (
                    hasPurchases &&
                    verificationFailed
                ) {
                    log(
                        `Personal übersprungen: ${buildingLabel(job.id)} · ` +
                        'Fahrzeugprüfung fehlgeschlagen.'
                    );

                    continue;
                }

                const failedPurchase =
                    job.purchases.some(purchase => {
                        const entry = ledger.get(
                            purchaseKey(
                                job.id,
                                purchase.type
                            )
                        );

                        return (
                            !entry ||
                            !entry.confirmed
                        );
                    });

                if (failedPurchase) {
                    log(
                        `Personal übersprungen: ${buildingLabel(job.id)} · ` +
                        'Fahrzeugkauf nicht bestätigt.'
                    );

                    continue;
                }

                for (const task of job.personnel) {
                    tasks.push({ ...task });
                }

                for (
                    const rule
                    of job.personnelAfterPurchase
                ) {
                    const knownIds = new Set(
                        job.existingVehicleIds[
                            rule.type
                        ] ?? []
                    );

                    const newVehicles = vehiclesOf(
                        job.id,
                        rule.type
                    ).filter(vehicle =>
                        !knownIds.has(
                            Number(vehicle.id)
                        )
                    );

                    for (const vehicle of newVehicles) {
                        const task = personalTask(
                            vehicle,
                            rule,
                            job.id,
                            true
                        );

                        if (task) {
                            tasks.push(task);
                        }
                    }
                }
            }

            const unique = new Map();

            for (const task of tasks) {
                unique.set(
                    task.vehicleId,
                    task
                );
            }

            return [
                ...unique.values()
            ];
        }

        // =================================================
        // PHASE 2: MAXIMALPERSONAL
        // =================================================

        async function runMaxPhase(tasks) {
            const maxTasks = tasks.filter(
                task => task.maxNeeded
            );

            beginPhase(
                'max',
                maxTasks.length
            );

            if (!maxTasks.length) {
                log(
                    'Keine Maximalpersonal-Änderungen erforderlich.'
                );

                finishPhase('max');
                return 0;
            }

            log(
                `\n--- Maximalpersonal (${maxTasks.length} Fahrzeuge) ---`
            );

            let done = 0;
            let nextIndex = 0;

            async function worker() {
                while (!cancelled) {
                    const index = nextIndex++;

                    if (index >= maxTasks.length) {
                        return;
                    }

                    const task = maxTasks[index];

                    const detail =
                        `${buildingLabel(task.buildingId)} · ` +
                        `${task.name} #${task.vehicleId}`;

                    setPhase(
                        `Maximalpersonal: ${done + 1}/${maxTasks.length}`
                    );

                    progressCards.max.current.textContent =
                        detail;

                    paintPhase('max');

                    let error = false;

                    try {
                        let needsChange = true;

                        if (task.maxUnknown) {
                            const current = await readMax(
                                task.vehicleId
                            );

                            needsChange =
                                current !== task.maxTarget;
                        }

                        if (needsChange) {
                            await act(
                                `${detail}: Maximalpersonal ${task.maxTarget}`,
                                () => writeMax(
                                    task.vehicleId,
                                    task.maxTarget
                                )
                            );

                            await confirmChange(
                                () => readMax(
                                    task.vehicleId
                                ),
                                value =>
                                    value === task.maxTarget,
                                'Maximalpersonal'
                            );
                        }
                    } catch (exception) {
                        error = true;

                        log(
                            `FEHLER Maximalpersonal ${detail}: ` +
                            exception.message
                        );
                    }

                    done++;

                    updatePhase(
                        'max',
                        done,
                        detail,
                        error
                    );

                    await yieldUI();
                }
            }

            await Promise.all(
                Array.from(
                    { length: Math.min(3, maxTasks.length) },
                    worker
                )
            );

            finishPhase(
                'max',
                cancelled
            );

            return progressCards.max.errors;
        }

        // =================================================
        // PHASE 3: PERSONALZUWEISUNG
        // =================================================

        async function runCrewPhase(tasks) {
            const crewTasks = tasks.filter(
                task => task.crewNeeded
            );

            beginPhase(
                'crew',
                crewTasks.length
            );

            if (!crewTasks.length) {
                log(
                    'Keine Personalzuweisungen erforderlich.'
                );

                finishPhase('crew');
                return 0;
            }

            log(
                `\n--- Personalzuweisung (${crewTasks.length} Fahrzeuge) ---`
            );

            let done = 0;

            for (const task of crewTasks) {
                if (cancelled) break;

                const detail =
                    `${buildingLabel(task.buildingId)} · ` +
                    `${task.name} #${task.vehicleId}`;

                setPhase(
                    `Personalzuweisung: ${done + 1}/${crewTasks.length}`
                );

                progressCards.crew.current.textContent =
                    detail;

                paintPhase('crew');

                let error = false;

                try {
                    await changeCrew(
                        {
                            id: task.vehicleId,
                            vehicle_type:
                                task.vehicleType
                        },
                        task.crewTarget,
                        task.crewMode,
                        act,
                        check
                    );
                } catch (exception) {
                    error = true;

                    log(
                        `FEHLER Personal ${detail}: ` +
                        exception.message
                    );
                }

                done++;

                updatePhase(
                    'crew',
                    done,
                    detail,
                    error
                );

                await yieldUI();
            }

            finishPhase(
                'crew',
                cancelled
            );

            return progressCards.crew.errors;
        }

        // =================================================
        // GESAMTABLAUF
        // =================================================

        startButton.onclick = async () => {
            if (busy || !prepared) {
                return;
            }

            if (
                Date.now() - prepared.createdAt >
                PLAN_MAX_AGE
            ) {
                invalidate();

                log(
                    'Vorschau älter als fünf Minuten. ' +
                    'Bitte neu erstellen.'
                );

                setStatus(
                    'Neue Vorschau erforderlich'
                );

                return;
            }

            const snapshot = prepared;

            if (!snapshot.jobs.length) {
                log(
                    'Alle ausgewählten Wachen sind bereits fertig.'
                );

                setStatus(
                    'Keine Änderungen nötig'
                );

                showPhaseCards([]);

                return;
            }

            const selectedPhases = snapshot.phaseIds.map((id, index) => {
                const config = PHASES.find(item => item.id === id);
                const count = BUILDING_STAGES.includes(id)
                    ? snapshot.buildingJobs.filter(job =>
                        jobNeedsStage(job, id)).length
                    : id === 'max'
                        ? snapshot.initialMaxTasks.length
                        : snapshot.initialCrewTasks.length;

                return `Phase ${index + 1}: ${config.title} – ` +
                    `${count} ${config.unit}`;
            });

            if (!window.confirm(
                `${snapshot.jobs.length} Wachen mit offenen Aufgaben.\n\n` +
                selectedPhases.join('\n') + '\n\n' +
                (snapshot.phaseIds.includes('vehicle')
                    ? 'Neue Fahrzeuge können nach dem Kauf dazukommen.\n\n'
                    : '') +
                'Jetzt starten?'
            )) {
                return;
            }

            invalidate();
            cancelled = false;

            setBusy(true, true);
            showTab('run');

            resetPhases();
            showPhaseCards(snapshot.phaseIds);

            const ledger = new Map();
            const phaseOneSuccessful = new Set();

            let failed = 0;
            let verificationFailed = false;
            let runStarted = false;

            try {
                if (!navigator.locks?.request) {
                    throw new Error(
                        'Browser unterstützt keine Lauf-Sperre.'
                    );
                }

                await navigator.locks.request(
                    `nilspe.mastermind.${account}`,
                    {
                        ifAvailable: true
                    },
                    async lock => {
                        if (!lock) {
                            throw new Error(
                                'Ein anderer Durchlauf ist aktiv.'
                            );
                        }

                        runStarted = true;

                        // Nur die tatsächlich benötigten Gebäude- und
                        // Kaufphasen ausführen, in bisheriger Reihenfolge.
                        const failedBuildings = new Set();

                        for (const stage of BUILDING_STAGES) {
                            if (!snapshot.phaseIds.includes(stage)) continue;

                            const config = PHASES.find(item => item.id === stage);
                            const stageJobs = snapshot.buildingJobs.filter(
                                job => jobNeedsStage(job, stage)
                            );
                            let processed = 0;

                            beginPhase(stage, stageJobs.length);
                            log(`\n--- ${config.title}: ${stageJobs.length} Wachen ---`);

                            for (const job of stageJobs) {
                                if (cancelled) break;

                                const detail = buildingLabel(job.id);
                                let error = false;

                                if (failedBuildings.has(job.id)) {
                                    log(`Übersprungen ${detail}: vorheriger Schritt fehlgeschlagen.`);
                                    error = true;
                                } else {
                                    setPhase(
                                        `${config.title}: ` +
                                        `${processed + 1}/${stageJobs.length} · ` +
                                        detail
                                    );
                                    progressCards[stage].current.textContent = detail;
                                    paintPhase(stage);

                                    log(`\n--- ${detail} ---`);

                                    try {
                                        await runBuildingJob(job, ledger, stage);
                                    } catch (exception) {
                                        failed++;
                                        error = true;
                                        failedBuildings.add(job.id);
                                        log(`FEHLER ${detail}: ${exception.message}`);
                                    }
                                }

                                processed++;
                                updatePhase(stage, processed, detail, error);
                                await sleep(BUILDING_DELAY);
                                await yieldUI();
                            }

                            finishPhase(stage, cancelled);

                            if (cancelled) break;
                        }

                        for (const job of snapshot.buildingJobs) {
                            if (!failedBuildings.has(job.id)) {
                                phaseOneSuccessful.add(job.id);
                            }
                        }

                        // =================================
                        // KAUFBESTÄTIGUNG NUR BEI KÄUFEN
                        // =================================

                        if (ledger.size) {
                            try {
                                await verifyPurchases(
                                    ledger
                                );
                            } catch (exception) {
                                verificationFailed = true;
                                failed++;

                                log(
                                    'FEHLER Fahrzeugprüfung: ' +
                                    exception.message
                                );
                            }
                        } else {
                            log(
                                'Kein Fahrzeugkauf durchgeführt. ' +
                                'Fahrzeug-API-Abgleich übersprungen.'
                            );
                        }

                        if (cancelled) {
                            return;
                        }

                        // =================================
                        // PERSONALAUFTRÄGE
                        // =================================

                        const tasks = createPersonnelQueue(
                            snapshot,
                            ledger,
                            phaseOneSuccessful,
                            verificationFailed
                        );

                        const maxCount = tasks.filter(
                            task => task.maxNeeded
                        ).length;

                        const crewCount = tasks.filter(
                            task => task.crewNeeded
                        ).length;

                        log(
                            '\n--- Personalplanung ---'
                        );

                        if (snapshot.phaseIds.includes('max')) {
                            log(`Maximalpersonal: ${fmt(maxCount)} Fahrzeuge`);
                        }

                        if (snapshot.phaseIds.includes('crew')) {
                            log(`Personalzuweisung: ${fmt(crewCount)} Fahrzeuge`);
                        }

                        // =================================
                        // PHASE 2
                        // =================================

                        if (snapshot.phaseIds.includes('max')) {
                            failed += await runMaxPhase(tasks);
                        }

                        if (cancelled) {
                            return;
                        }

                        // =================================
                        // PHASE 3
                        // =================================

                        if (snapshot.phaseIds.includes('crew')) {
                            failed += await runCrewPhase(tasks);
                        }
                    }
                );

                if (!runStarted) {
                    return;
                }

                log(
                    '\n--- Zusammenfassung ---'
                );

                log(
                    `Ausgewählte Wachen: ${fmt(snapshot.ids.length)}`
                );

                for (const [index, id] of snapshot.phaseIds.entries()) {
                    const config = PHASES.find(item => item.id === id);
                    const item = progressCards[id];

                    log(
                        `Phase ${index + 1} ${config.title}: ` +
                        `${fmt(item.done)} / ${fmt(item.total)} ${config.unit}`
                    );
                }

                const purchases = [
                    ...ledger.values()
                ];

                log(
                    `Fahrzeuge angefordert: ${fmt(
                        purchases.reduce(
                            (sum, item) =>
                                sum + item.requested,
                            0
                        )
                    )}`
                );

                log(
                    `Kaufanfragen: ${fmt(
                        purchases.reduce(
                            (sum, item) =>
                                sum + item.requests,
                            0
                        )
                    )}`
                );

                log(
                    `Fehler: ${fmt(failed)}`
                );

                setPhase(
                    cancelled
                        ? 'Angehalten'
                        : failed || verificationFailed
                            ? 'Abgeschlossen mit Fehlern'
                            : 'Abgeschlossen'
                );

            } catch (error) {
                log(
                    `FEHLER: ${error.message}`
                );

                setPhase(
                    cancelled
                        ? 'Angehalten'
                        : 'Fehler'
                );
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        stopButton.onclick = () => {
            if (!running) {
                return;
            }

            cancelled = true;
            stopButton.disabled = true;

            log(
                'Stopp angefordert. Keine weiteren Aktionen ' +
                'nach dem laufenden Schritt.'
            );
        };

        // =================================================
        // EIGENSTÄNDIGE WACHEN-AKTIONEN
        // Diese Aktionen verändern den Drei-Phasen-Plan nicht.
        // =================================================

        const buildingToolsPage = pages.get('buildingTools');
        const toolsIntro = panel(
            'Wachen-Aktionen',
            'Gilt nur für die im Tab Gebäude ausgewählten Wachen. ' +
            'Jede Aktion wird zunächst als Vorschau angezeigt.'
        );
        const toolsTargetCenter = select([
            ['', 'Ziel-Leitstelle wählen']
        ]);
        const toolsMovePreview = button('Verschieben: Vorschau');
        const toolsMoveRun = button('Verschieben', 'primary');
        const toolsName = input('text', 'Neuer Name');
        const toolsStart = input('number', '1');
        const toolsDigits = input('number', '3');
        const toolsRenamePreview = button('Umbenennen: Vorschau');
        const toolsRenameRun = button('Umbenennen', 'primary');
        const toolsStaffTarget = input('number', 'Soll-Personal');
        const toolsAutomatic = input('checkbox');
        const toolsStaffPreview = button('Wachenpersonal: Vorschau');
        const toolsStaffRun = button('Personal-Soll setzen', 'primary');
        const toolsActivatePreview = button('Aktivieren: Vorschau');
        const toolsActivateRun = button('Wachen aktivieren', 'primary');
        const toolsDeactivatePreview = button('Deaktivieren: Vorschau');
        const toolsDeactivateRun = button('Wachen deaktivieren', 'warning');
        const toolsDeleteStart = input('number', '1');
        const toolsDeleteEvery = input('number', '1');
        const toolsDeletePreview = button('Löschen: Vorschau');
        const toolsDeleteRun = button('Wachen endgültig löschen', 'danger');
        const toolsStatus = el('p', 'aio-tool-status', 'Keine Vorschau erstellt.');
        const toolsProgress = el('div', 'aio-preview-progress');
        const toolsProgressFill = el('div', 'aio-preview-fill');
        const toolsPreviewList = el('pre', 'aio-log');
        let toolsSnapshot = null;

        toolsProgress.append(toolsProgressFill);

        buildingToolsPage.append(
            toolsIntro,
            panel('Verschieben', 'Zuordnung zur Ziel-Leitstelle ändern.'),
            row(
                field('Ziel-Leitstelle', toolsTargetCenter),
                toolsMovePreview,
                toolsMoveRun
            ),
            panel('Umbenennen',
                'Name mit fortlaufender Nummer; Reihenfolge nach Gebäude-ID.'
            ),
            row(
                field('Namensstamm', toolsName),
                field('Startnummer', toolsStart),
                field('Stellen', toolsDigits),
                toolsRenamePreview,
                toolsRenameRun
            ),
            panel('Wachenpersonal',
                'Soll-Personal setzen und bei Bedarf automatische Werbung starten.'
            ),
            row(
                field('Soll-Personal', toolsStaffTarget),
                field('Automatische Werbung aktivieren', toolsAutomatic),
                toolsStaffPreview,
                toolsStaffRun
            ),
            panel('Wachenstatus',
                'Nur Wachen mit abweichendem Status werden umgeschaltet.'
            ),
            row(
                toolsActivatePreview,
                toolsActivateRun,
                toolsDeactivatePreview,
                toolsDeactivateRun
            ),
            panel('Löschen',
                'Unwiderruflich. Nur nach erneuter Prüfung der Vorschau.'
            ),
            row(
                field('Ab Wache Nr.', toolsDeleteStart),
                field('Jede n-te Wache', toolsDeleteEvery),
                toolsDeletePreview,
                toolsDeleteRun
            ),
            toolsStatus,
            toolsProgress,
            toolsPreviewList
        );

        toolsStart.value = '1';
        toolsDigits.value = '3';
        toolsDeleteStart.value = '1';
        toolsDeleteEvery.value = '1';
        toolsMoveRun.disabled = true;
        toolsRenameRun.disabled = true;
        toolsStaffRun.disabled = true;
        toolsActivateRun.disabled = true;
        toolsDeactivateRun.disabled = true;
        toolsDeleteRun.disabled = true;

        const toolTitles = {
            move: 'Wachen verschieben',
            rename: 'Wachen umbenennen',
            staff: 'Wachenpersonal setzen',
            activate: 'Wachen aktivieren',
            deactivate: 'Wachen deaktivieren',
            delete: 'Wachen löschen'
        };

        function selectedToolBuildings() {
            return [...selectedBuildings]
                .map(id => buildingById.get(Number(id)))
                .filter(Boolean)
                .sort((a, b) => Number(a.id) - Number(b.id));
        }

        function toolPlan(kind) {
            const chosen = selectedToolBuildings();

            if (!chosen.length) {
                throw new Error('Im Tab Gebäude erst Wachen auswählen.');
            }

            if (kind === 'move') {
                const target = Number(toolsTargetCenter.value);

                if (!target || !centers.some(center => Number(center.id) === target)) {
                    throw new Error('Gültige Ziel-Leitstelle auswählen.');
                }

                return chosen.filter(building => centerId(building) !== target)
                    .map(building => ({
                        id: Number(building.id),
                        before: building.caption ?? `Wache ${building.id}`,
                        after: `${toolsTargetCenter.selectedOptions[0].textContent}`,
                        target
                    }));
            }

            if (kind === 'rename') {
                const stem = toolsName.value.trim();
                const start = Number(toolsStart.value);
                const digits = Number(toolsDigits.value);

                if (!stem || !Number.isSafeInteger(start) || start < 0 ||
                    !Number.isSafeInteger(digits) || digits < 1 || digits > 8) {
                    throw new Error('Namensstamm, Startnummer und Stellen prüfen.');
                }

                return chosen.map((building, index) => ({
                    id: Number(building.id),
                    before: building.caption ?? '',
                    after: `${stem} ${String(start + index).padStart(digits, '0')}`
                })).filter(item => item.before !== item.after);
            }

            if (kind === 'staff') {
                const target = Number(toolsStaffTarget.value);

                if (!Number.isSafeInteger(target) || target < 0 ||
                    toolsStaffTarget.value.trim() === '') {
                    throw new Error('Gültiges Soll-Personal eingeben.');
                }

                return chosen.filter(building =>
                    Number(building.personal_count_target) !== target ||
                    (toolsAutomatic.checked && !building.hiring_automatic)
                ).map(building => ({
                    id: Number(building.id),
                    before: `${building.caption ?? building.id}: ` +
                        `Soll ${building.personal_count_target ?? '?'}`,
                    after: `Soll ${target}` +
                        (toolsAutomatic.checked ? ' · Automatik an' : ''),
                    target,
                    automatic: toolsAutomatic.checked,
                    needsTarget: Number(building.personal_count_target) !== target,
                    needsAutomatic: toolsAutomatic.checked &&
                        !building.hiring_automatic
                }));
            }

            if (kind === 'activate' || kind === 'deactivate') {
                const desired = kind === 'activate';

                return chosen.filter(building =>
                    typeof building.enabled !== 'boolean' ||
                    building.enabled !== desired
                ).map(building => ({
                    id: Number(building.id),
                    before: `${building.caption ?? building.id}: ` +
                        (building.enabled ? 'aktiv' : 'inaktiv'),
                    after: desired ? 'aktivieren' : 'deaktivieren',
                    desired
                }));
            }

            const startAt = Number(toolsDeleteStart.value);
            const every = Number(toolsDeleteEvery.value);

            if (!Number.isSafeInteger(startAt) || startAt < 1 ||
                !Number.isSafeInteger(every) || every < 1) {
                throw new Error('Lösch-Startnummer und Abstand prüfen.');
            }

            return chosen.filter((_, index) =>
                index + 1 >= startAt &&
                (index + 1 - startAt) % every === 0
            ).map(building => ({
                id: Number(building.id),
                before: building.caption ?? `Wache ${building.id}`,
                after: 'LÖSCHEN'
            }));
        }

        function clearToolPreview() {
            toolsSnapshot = null;
            toolsMoveRun.disabled = true;
            toolsRenameRun.disabled = true;
            toolsStaffRun.disabled = true;
            toolsActivateRun.disabled = true;
            toolsDeactivateRun.disabled = true;
            toolsDeleteRun.disabled = true;
        }

        function toolSignature(kind, plan) {
            return JSON.stringify({
                kind,
                selectedCenters: [...selectedCenters].sort((a, b) => a - b),
                selectedBuildings: [...selectedBuildings].sort((a, b) => a - b),
                plan
            });
        }

        function showToolPreview(kind) {
            clearToolPreview();

            try {
                if (busy) {
                    throw new Error('Es läuft bereits eine Aktion.');
                }

                const plan = toolPlan(kind);

                if (kind === 'delete' && plan.length > 100) {
                    throw new Error(
                        'Zum Löschen höchstens 100 Wachen auswählen, ' +
                        'damit alle Treffer in der Vorschau sichtbar sind.'
                    );
                }

                toolsPreviewList.textContent = plan.slice(0, 100)
                    .map(item => `${item.id}: ${item.before} → ${item.after}`)
                    .join('\n');

                if (plan.length > 100) {
                    toolsPreviewList.textContent +=
                        `\n… und ${plan.length - 100} weitere Wachen`;
                }

                toolsStatus.textContent =
                    `${toolTitles[kind]}: ${fmt(plan.length)} Änderungen ` +
                    'in der Vorschau.';

                if (!plan.length) {
                    return;
                }

                toolsSnapshot = toolSignature(kind, plan);
                ({
                    move: toolsMoveRun,
                    rename: toolsRenameRun,
                    staff: toolsStaffRun,
                    activate: toolsActivateRun,
                    deactivate: toolsDeactivateRun,
                    delete: toolsDeleteRun
                })[kind].disabled = false;
            } catch (error) {
                toolsStatus.textContent = `Fehler: ${error.message}`;
                toolsPreviewList.textContent = '';
            }
        }

        async function toolRequest(kind, item) {
            if (kind === 'activate' || kind === 'deactivate') {
                const current = await liveBuilding(item.id);

                if (typeof current.enabled !== 'boolean') {
                    throw new Error('Aktueller Gebäudestatus unbekannt.');
                }

                if (current.enabled !== item.desired) {
                    await toggleBuilding(item.id);
                    await confirmChange(
                        async () => (await liveBuilding(item.id)).enabled,
                        enabled => enabled === item.desired,
                        `Gebäudestatus ${item.id}`
                    );
                }

                return;
            }

            if (kind === 'delete') {
                const current = await liveBuilding(item.id);

                if (String(current.caption ?? current.name ?? '') !==
                    String(item.before)) {
                    throw new Error(
                        'Gebäudename seit der Vorschau geändert; nicht gelöscht.'
                    );
                }
            }

            if (kind === 'staff') {
                if (item.needsTarget) {
                    const token = csrf();
                    const body = new URLSearchParams({
                        'building[personal_count_target]': String(item.target),
                        _method: 'put'
                    });

                    if (token) {
                        body.set('authenticity_token', token);
                    }

                    const response = await fetch(
                        `/buildings/${item.id}?personal_count_target_only=1`,
                        {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type':
                                    'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-CSRF-Token': token,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Personal-Soll HTTP ${response.status}`);
                    }
                }

                if (item.needsAutomatic && !cancelled) {
                    const doc = await fetchPage(`/buildings/${item.id}`);
                    const link = [...doc.querySelectorAll(
                        'a.btn-hire[duration="automatic"], ' +
                        'a.btn-hire[data-duration="automatic"]'
                    )].find(node =>
                        node.getAttribute('href')?.includes(
                            `/buildings/${item.id}`
                        )
                    );

                    const href = link?.getAttribute('href');

                    if (!href) {
                        throw new Error('Automatik-URL nicht gefunden.');
                    }

                    const response = await fetch(
                        new URL(href, location.origin).href, {
                        credentials: 'same-origin',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Personalwerbung HTTP ${response.status}`);
                    }
                }

                return;
            }

            if (kind === 'move') {
                const response = await fetch(
                    `/buildings/${item.id}/leitstelle-set/${item.target}`,
                    {
                        credentials: 'same-origin',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    }
                );

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return;
            }

            const token = csrf();

            if (!token) {
                throw new Error('CSRF-Token fehlt.');
            }

            const body = new URLSearchParams({
                _method: kind === 'delete' ? 'delete' : 'patch',
                authenticity_token: token
            });

            if (kind === 'rename') {
                body.set('building[name]', item.after);
                body.set('commit', 'Speichern');
            }

            const response = await fetch(`/buildings/${item.id}`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-CSRF-Token': token,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body,
                redirect: kind === 'rename' ? 'manual' : 'follow'
            });

            if (kind === 'rename' && response.type === 'opaqueredirect') {
                return;
            }

            if (!response.ok && !(kind === 'rename' && response.status === 302)) {
                throw new Error(`HTTP ${response.status}`);
            }
        }

        async function runTool(kind) {
            if (busy || !toolsSnapshot) {
                return;
            }

            let plan;

            try {
                plan = toolPlan(kind);

                if (toolSignature(kind, plan) !== toolsSnapshot) {
                    throw new Error('Auswahl geändert – bitte neue Vorschau erstellen.');
                }
            } catch (error) {
                clearToolPreview();
                toolsStatus.textContent = error.message;
                return;
            }

            clearToolPreview();
            cancelled = false;
            setBusy(true, true);
            toolsProgressFill.style.width = '0%';
            let done = 0;
            let failed = 0;

            try {
                for (const item of plan) {
                    if (cancelled) {
                        break;
                    }

                    try {
                        await toolRequest(kind, item);
                        done++;
                    } catch (error) {
                        failed++;
                        log(`Wachen-Aktion ${kind}, ${item.id}: ${error.message}`);
                    }

                    toolsStatus.textContent =
                        `${toolTitles[kind]}: ` +
                        `${done + failed}/${plan.length} · ` +
                        `${done} erfolgreich · ${failed} Fehler`;
                    toolsProgressFill.style.width =
                        `${Math.round((done + failed) / plan.length * 100)}%`;
                    await sleep(ACTION_DELAY);
                }

                invalidate();
                await loadBuildings(true);
                for (const id of selectedBuildings) {
                    const building = buildingById.get(Number(id));

                    if (!building ||
                        !selectedCenters.has(centerId(building)) ||
                        Number(building.building_type) !==
                            Number(buildingType.value)) {
                        selectedBuildings.delete(id);
                    }
                }
                drawCenters();
                drawStations();
                drawSummary();
                toolsStatus.textContent += cancelled
                    ? ' · angehalten'
                    : ' · abgeschlossen';
            } catch (error) {
                log(`Wachen-Aktion abgebrochen: ${error.message}`);
                toolsStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                cancelled = false;
                setBusy(false);
                clearToolPreview();
            }
        }

        toolsMovePreview.onclick = () => showToolPreview('move');
        toolsRenamePreview.onclick = () => showToolPreview('rename');
        toolsStaffPreview.onclick = () => showToolPreview('staff');
        toolsActivatePreview.onclick = () => showToolPreview('activate');
        toolsDeactivatePreview.onclick = () => showToolPreview('deactivate');
        toolsDeletePreview.onclick = () => showToolPreview('delete');
        toolsMoveRun.onclick = () => runTool('move');
        toolsRenameRun.onclick = () => runTool('rename');
        toolsStaffRun.onclick = () => runTool('staff');
        toolsActivateRun.onclick = () => runTool('activate');
        toolsDeactivateRun.onclick = () => runTool('deactivate');
        toolsDeleteRun.onclick = () => runTool('delete');

        toolsTargetCenter.addEventListener('change', () => {
            GM.setValue(toolsTargetKey, toolsTargetCenter.value)
                .catch(error => log(`Ziel-Leitstelle nicht gespeichert: ${error}`));
        });

        buildingToolsPage.addEventListener('input', clearToolPreview);
        buildingToolsPage.addEventListener('change', clearToolPreview);
        buildingsPage.addEventListener('change', clearToolPreview);
        centersPage.addEventListener('change', clearToolPreview);

        // =================================================
        // FAHRZEUGE LÖSCHEN (EIGENSTÄNDIGE AKTION)
        // =================================================

        const vehicleToolsPage = pages.get('vehicleTools');
        const vehicleDeleteType = select([
            ['', 'Fahrzeugtyp wählen']
        ]);
        const vehicleKeep = input('number', '0');
        const vehicleEveryStation = input('number', '1');
        const vehicleDeletePreview = button('Löschen: Vorschau');
        const vehicleDeleteRun = button('Fahrzeuge endgültig löschen', 'danger');
        const vehicleDeleteStatus = el(
            'p', '', 'Noch keine Fahrzeug-Vorschau erstellt.'
        );
        const vehicleDeleteList = el('pre', 'aio-log');
        const vehicleDeleteProgress = el('div', 'aio-preview-progress');
        const vehicleDeleteFill = el('div', 'aio-preview-fill');
        let vehicleDeleteSnapshot = null;

        vehicleKeep.value = '0';
        vehicleEveryStation.value = '1';
        vehicleDeleteRun.disabled = true;
        vehicleDeleteProgress.append(vehicleDeleteFill);
        vehicleToolsPage.append(
            panel('Fahrzeuge löschen',
                'Nur Fahrzeuge der im Tab Gebäude ausgewählten Wachen. ' +
                'Die Vorschau zeigt alle betroffenen Fahrzeuge.'
            ),
            row(
                field('Fahrzeugtyp', vehicleDeleteType),
                field('Pro Wache behalten', vehicleKeep),
                field('Jede n-te Wache', vehicleEveryStation)
            ),
            row(vehicleDeletePreview, vehicleDeleteRun),
            vehicleDeleteStatus,
            vehicleDeleteProgress,
            vehicleDeleteList
        );

        function clearVehicleDeletePreview() {
            vehicleDeleteSnapshot = null;
            vehicleDeleteRun.disabled = true;
        }

        function vehicleDeletePlan() {
            const type = Number(vehicleDeleteType.value);
            const keep = Number(vehicleKeep.value);
            const every = Number(vehicleEveryStation.value);

            if (!vehicleDeleteType.value ||
                !vehicleTypes.some(([id]) => id === type)) {
                throw new Error('Fahrzeugtyp auswählen.');
            }

            if (!Number.isSafeInteger(keep) || keep < 0 ||
                !Number.isSafeInteger(every) || every < 1) {
                throw new Error('Anzahl pro Wache und Wachenabstand prüfen.');
            }

            const stations = selectedToolBuildings();

            if (!stations.length) {
                throw new Error('Im Tab Gebäude erst Wachen auswählen.');
            }

            return stations
                .filter((_, index) => (index + 1) % every === 0)
                .flatMap(building =>
                    vehiclesOf(building.id, type)
                        .slice()
                        .sort((a, b) => Number(a.id) - Number(b.id))
                        .slice(keep)
                        .map(vehicle => ({
                            id: Number(vehicle.id),
                            buildingId: Number(building.id),
                            type,
                            name: String(vehicle.caption ??
                                vehicle.name ?? `Fahrzeug ${vehicle.id}`),
                            station: String(building.caption ?? building.id)
                        }))
                );
        }

        function vehicleDeleteSignature(plan) {
            return JSON.stringify({
                type: vehicleDeleteType.value,
                keep: vehicleKeep.value,
                every: vehicleEveryStation.value,
                buildings: [...selectedBuildings].sort((a, b) => a - b),
                plan
            });
        }

        vehicleDeletePreview.onclick = async () => {
            if (busy) {
                return;
            }

            clearVehicleDeletePreview();
            vehicleDeleteList.textContent = '';
            setBusy(true);

            try {
                vehicleDeleteStatus.textContent = 'Fahrzeuge werden abgeglichen …';
                await loadVehicles(true);
                const plan = vehicleDeletePlan();

                if (plan.length > 100) {
                    throw new Error(
                        'Höchstens 100 Fahrzeuge auf einmal löschen. ' +
                        'Bitte Auswahl eingrenzen.'
                    );
                }

                vehicleDeleteList.textContent = plan.map(item =>
                    `${item.id}: ${item.name} · ${item.station}`
                ).join('\n');
                vehicleDeleteStatus.textContent =
                    `${fmt(plan.length)} Fahrzeuge in der Vorschau.`;

                if (plan.length) {
                    vehicleDeleteSnapshot = vehicleDeleteSignature(plan);
                }
            } catch (error) {
                vehicleDeleteStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                setBusy(false);
            }
        };

        vehicleDeleteRun.onclick = async () => {
            if (busy || !vehicleDeleteSnapshot) {
                return;
            }

            let plan;

            try {
                plan = vehicleDeletePlan();

                if (vehicleDeleteSignature(plan) !== vehicleDeleteSnapshot) {
                    throw new Error('Auswahl geändert – neue Vorschau erstellen.');
                }
            } catch (error) {
                clearVehicleDeletePreview();
                vehicleDeleteStatus.textContent = error.message;
                return;
            }

            clearVehicleDeletePreview();
            cancelled = false;
            setBusy(true, true);
            vehicleDeleteFill.style.width = '0%';
            let success = 0;
            let errors = 0;

            try {
                for (const item of plan) {
                    if (cancelled) {
                        break;
                    }

                    try {
                        const currentResponse = await fetch(
                            `/api/v2/vehicles/${item.id}`,
                            {
                                credentials: 'same-origin',
                                cache: 'no-store',
                                headers: { Accept: 'application/json' }
                            }
                        );

                        if (!currentResponse.ok) {
                            throw new Error(`Prüfung HTTP ${currentResponse.status}`);
                        }

                        const payload = await currentResponse.json();
                        const current = payload.result ?? payload;

                        if (Number(current.id) !== item.id ||
                            Number(current.building_id) !== item.buildingId ||
                            vehicleType(current) !== item.type) {
                            throw new Error('Fahrzeug-Zuordnung geändert.');
                        }

                        const token = csrf();

                        if (!token) {
                            throw new Error('CSRF-Token fehlt.');
                        }

                        const response = await fetch(`/vehicles/${item.id}`, {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type':
                                    'application/x-www-form-urlencoded; charset=UTF-8',
                                'X-CSRF-Token': token,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            body: new URLSearchParams({
                                _method: 'delete',
                                authenticity_token: token
                            })
                        });

                        if (!response.ok) {
                            throw new Error(`Löschen HTTP ${response.status}`);
                        }

                        success++;
                    } catch (error) {
                        errors++;
                        log(`Fahrzeug ${item.id} nicht gelöscht: ${error.message}`);
                    }

                    vehicleDeleteStatus.textContent =
                        `${success + errors}/${plan.length} · ` +
                        `${success} gelöscht · ${errors} Fehler`;
                    vehicleDeleteFill.style.width =
                        `${Math.round((success + errors) / plan.length * 100)}%`;
                    await sleep(ACTION_DELAY);
                }

                invalidate();
                await loadVehicles(true);
                vehicleDeleteStatus.textContent += cancelled
                    ? ' · angehalten'
                    : ' · abgeschlossen';
            } catch (error) {
                vehicleDeleteStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        vehicleToolsPage.addEventListener('input', clearVehicleDeletePreview);
        vehicleToolsPage.addEventListener('change', clearVehicleDeletePreview);
        buildingsPage.addEventListener('change', clearVehicleDeletePreview);
        centersPage.addEventListener('change', clearVehicleDeletePreview);

        // =================================================
        // FAHRZEUGSTATUS 2 / 6
        // =================================================

        const vehicleStatusType = select([
            ['', 'Fahrzeugtyp wählen']
        ]);
        const vehicleStatusTarget = select([
            ['6', 'Status 6 setzen'],
            ['2', 'Status 2 setzen']
        ]);
        const vehicleStatusKeep = input('number', '0');
        const vehicleStatusPreview = button('Status: Vorschau');
        const vehicleStatusRun = button('Status ändern', 'primary');
        const vehicleStatusText = el('p', '', 'Noch keine Status-Vorschau.');
        const vehicleStatusList = el('pre', 'aio-log');
        const vehicleStatusProgress = el('div', 'aio-preview-progress');
        const vehicleStatusFill = el('div', 'aio-preview-fill');
        let vehicleStatusSnapshot = null;

        vehicleStatusKeep.value = '0';
        vehicleStatusRun.disabled = true;
        vehicleStatusProgress.append(vehicleStatusFill);
        vehicleToolsPage.append(
            panel('Fahrzeugstatus 2 / 6',
                'Nur Fahrzeuge der ausgewählten Wachen mit bekanntem ' +
                'Status. Beim Setzen auf 6 können pro Wache Fahrzeuge ' +
                'in Status 2 bleiben.'
            ),
            row(
                field('Fahrzeugtyp', vehicleStatusType),
                field('Zielstatus', vehicleStatusTarget),
                field('Pro Wache in 2 behalten', vehicleStatusKeep)
            ),
            row(vehicleStatusPreview, vehicleStatusRun),
            vehicleStatusText,
            vehicleStatusProgress,
            vehicleStatusList
        );

        function statusOf(vehicle) {
            return knownNumber(vehicle, [
                'fms', 'fms_real', 'fms_status', 'status'
            ]);
        }

        function clearVehicleStatusPreview() {
            vehicleStatusSnapshot = null;
            vehicleStatusRun.disabled = true;
        }

        function vehicleStatusPlan() {
            const type = Number(vehicleStatusType.value);
            const target = Number(vehicleStatusTarget.value);
            const keep = Number(vehicleStatusKeep.value);

            if (!vehicleStatusType.value ||
                !vehicleTypes.some(([id]) => id === type)) {
                throw new Error('Fahrzeugtyp auswählen.');
            }

            if (!Number.isSafeInteger(keep) || keep < 0) {
                throw new Error('Anzahl der zu behaltenden Fahrzeuge prüfen.');
            }

            const stations = selectedToolBuildings();

            if (!stations.length) {
                throw new Error('Im Tab Gebäude erst Wachen auswählen.');
            }

            const all = stations.flatMap(building => vehiclesOf(building.id, type));

            if (all.some(vehicle => statusOf(vehicle) == null)) {
                throw new Error(
                    'Fahrzeug-API liefert nicht für alle Fahrzeuge einen ' +
                    'eindeutigen FMS-Status. Keine Änderung gestartet.'
                );
            }

            return stations.flatMap(building => {
                const matching = vehiclesOf(building.id, type)
                    .filter(vehicle => target === 6
                        ? statusOf(vehicle) !== 6
                        : statusOf(vehicle) === 6)
                    .sort((a, b) => Number(a.id) - Number(b.id));

                return (target === 6 ? matching.slice(keep) : matching)
                    .map(vehicle => ({
                        id: Number(vehicle.id),
                        type,
                        buildingId: Number(building.id),
                        previous: statusOf(vehicle),
                        target,
                        name: String(vehicle.caption ??
                            vehicle.name ?? vehicle.id)
                    }));
            });
        }

        function vehicleStatusSignature(plan) {
            return JSON.stringify({
                type: vehicleStatusType.value,
                target: vehicleStatusTarget.value,
                keep: vehicleStatusKeep.value,
                buildings: [...selectedBuildings].sort((a, b) => a - b),
                plan
            });
        }

        vehicleStatusPreview.onclick = async () => {
            if (busy) {
                return;
            }

            clearVehicleStatusPreview();
            setBusy(true);

            try {
                vehicleStatusText.textContent = 'Fahrzeugstatus wird abgeglichen …';
                await loadVehicles(true);
                const plan = vehicleStatusPlan();
                vehicleStatusList.textContent = plan.slice(0, 100)
                    .map(item =>
                        `${item.id}: ${item.name} · ${item.previous} → ${item.target}`
                    ).join('\n');

                if (plan.length > 100) {
                    vehicleStatusList.textContent +=
                        `\n… und ${plan.length - 100} weitere Fahrzeuge`;
                }

                vehicleStatusText.textContent =
                    `${fmt(plan.length)} Statusänderungen in der Vorschau.`;

                if (plan.length) {
                    vehicleStatusSnapshot = vehicleStatusSignature(plan);
                }
            } catch (error) {
                vehicleStatusText.textContent = `Fehler: ${error.message}`;
                vehicleStatusList.textContent = '';
            } finally {
                setBusy(false);
            }
        };

        vehicleStatusRun.onclick = async () => {
            if (busy || !vehicleStatusSnapshot) {
                return;
            }

            let plan;

            try {
                plan = vehicleStatusPlan();

                if (vehicleStatusSignature(plan) !== vehicleStatusSnapshot) {
                    throw new Error('Auswahl geändert – neue Vorschau erstellen.');
                }
            } catch (error) {
                clearVehicleStatusPreview();
                vehicleStatusText.textContent = error.message;
                return;
            }

            clearVehicleStatusPreview();
            cancelled = false;
            setBusy(true, true);
            vehicleStatusFill.style.width = '0%';
            let success = 0;
            let errors = 0;

            try {
                for (const item of plan) {
                    if (cancelled) {
                        break;
                    }

                    try {
                        const response = await fetch(
                            `/vehicles/${item.id}/set_fms/${item.target}`,
                            {
                                credentials: 'same-origin',
                                headers: {
                                    'X-Requested-With': 'XMLHttpRequest'
                                }
                            }
                        );

                        if (!response.ok) {
                            throw new Error(`Status HTTP ${response.status}`);
                        }

                        success++;
                    } catch (error) {
                        errors++;
                        log(`Fahrzeug ${item.id}: ${error.message}`);
                    }

                    vehicleStatusText.textContent =
                        `${success + errors}/${plan.length} · ` +
                        `${success} geändert · ${errors} Fehler`;
                    vehicleStatusFill.style.width =
                        `${Math.round((success + errors) / plan.length * 100)}%`;
                    await sleep(ACTION_DELAY);
                }

                invalidate();
                vehicleStatusText.textContent += cancelled
                    ? ' · angehalten'
                    : ' · abgeschlossen';
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        vehicleToolsPage.addEventListener('input', clearVehicleStatusPreview);
        vehicleToolsPage.addEventListener('change', clearVehicleStatusPreview);
        buildingsPage.addEventListener('change', clearVehicleStatusPreview);
        centersPage.addEventListener('change', clearVehicleStatusPreview);

        // =================================================
        // ANHÄNGER FESTEN ZUGFAHRZEUGEN ZUWEISEN
        // =================================================

        const trailerPage = pages.get('trailers');
        const trailerType = select([['', 'Anhänger-Typ wählen']]);
        const towType = select([['', 'Zugfahrzeug-Typ wählen']]);
        const trailerPreview = button('Zuweisung prüfen');
        const trailerRun = button('Anhänger zuweisen', 'primary');
        const trailerStatus = el('p', '', 'Noch keine Prüfung.');
        const trailerList = el('pre', 'aio-log');
        const trailerProgress = el('div', 'aio-preview-progress');
        const trailerFill = el('div', 'aio-preview-fill');
        const knownTrailerTypes = new Map([
            [0, [143, 111, 113, 115, 141, 168, 70, 186]],
            [18, [143, 111, 113, 115, 141, 168, 70, 186]],
            [9, [43, 110, 44, 66, 67, 68, 92, 101,
                102, 112, 146, 178, 183]],
            [11, [136]],
            [12, [70, 132, 174, 175]],
            [15, [70]],
            [25, [155]]
        ]);
        let trailerSnapshot = null;

        trailerRun.disabled = true;
        trailerProgress.append(trailerFill);
        trailerPage.append(
            panel('Anhänger zuweisen',
                'Ausgewählte Wachen prüfen. Bereits korrekt fest zugewiesene ' +
                'Anhänger bleiben unverändert; Zugfahrzeuge werden nur ' +
                'einmal vergeben.'
            ),
            row(
                field('Anhänger-Typ', trailerType),
                field('Zugfahrzeug-Typ', towType)
            ),
            row(trailerPreview, trailerRun),
            trailerStatus,
            trailerProgress,
            trailerList
        );

        function clearTrailerPreview() {
            trailerSnapshot = null;
            trailerRun.disabled = true;
        }

        async function trailerAssignment(id) {
            const doc = await fetchPage(`/vehicles/${id}/edit`);
            const selectNode = doc.querySelector(
                'select[name="vehicle[tractive_vehicle_id]"]'
            );

            if (!selectNode) {
                throw new Error(`Anhänger ${id}: Zugfahrzeug-Feld fehlt.`);
            }

            return {
                towId: Number(selectNode.value) || null,
                allowedTowIds: [...selectNode.options]
                    .map(option => Number(option.value))
                    .filter(id => Number.isSafeInteger(id) && id > 0),
                random: Boolean(doc.querySelector(
                    'input[name="vehicle[tractive_random]"]'
                )?.checked)
            };
        }

        async function makeTrailerPlan() {
            const trailerTypeId = Number(trailerType.value);
            const towTypeId = Number(towType.value);

            if (!trailerType.value || !towType.value ||
                trailerTypeId === towTypeId) {
                throw new Error('Verschiedene Anhänger- und Zugfahrzeugtypen wählen.');
            }

            const stations = selectedToolBuildings();

            if (!stations.length) {
                throw new Error('Im Tab Gebäude erst Wachen auswählen.');
            }

            const tows = new Map();
            const trailers = [];

            for (const building of stations) {
                if (!(knownTrailerTypes.get(
                    Number(building.building_type)) ?? []
                ).includes(trailerTypeId)) {
                    throw new Error(
                        `Anhänger-Typ ${trailerTypeId} passt nicht zu ` +
                        `Wachentyp ${building.building_type}.`
                    );
                }

                tows.set(Number(building.id),
                    vehiclesOf(building.id, towTypeId)
                        .map(vehicle => Number(vehicle.id))
                        .sort((a, b) => a - b));
                for (const vehicle of vehiclesOf(building.id, trailerTypeId)) {
                    trailers.push({
                        id: Number(vehicle.id),
                        buildingId: Number(building.id),
                        name: String(vehicle.caption ??
                            vehicle.name ?? vehicle.id),
                        station: String(building.caption ?? building.id)
                    });
                }
            }

            trailers.sort((a, b) => a.id - b.id);
            const inspected = [];

            for (const trailer of trailers) {
                if (cancelled) {
                    throw new Error('Prüfung angehalten.');
                }

                inspected.push({
                    ...trailer,
                    assignment: await trailerAssignment(trailer.id)
                });
                trailerStatus.textContent =
                    `Anhänger geprüft: ${inspected.length}/${trailers.length}`;
                await sleep(20);
            }

            const reserved = new Set();
            const repair = [];

            const otherTrailers = stations.flatMap(building =>
                vehiclesAt(building.id)
                    .filter(vehicle =>
                        (knownTrailerTypes.get(
                            Number(building.building_type)) ?? []
                        ).includes(vehicleType(vehicle)) &&
                        vehicleType(vehicle) !== trailerTypeId)
                    .map(vehicle => ({
                        id: Number(vehicle.id),
                        buildingId: Number(building.id)
                    }))
            );

            for (let index = 0; index < otherTrailers.length; index++) {
                if (cancelled) {
                    throw new Error('Prüfung angehalten.');
                }

                const other = otherTrailers[index];

                try {
                    const assignment = await trailerAssignment(other.id);

                    if (!assignment.random && assignment.towId &&
                        (tows.get(other.buildingId) ?? [])
                            .includes(assignment.towId)) {
                        reserved.add(assignment.towId);
                    }
                } catch (error) {
                    throw new Error(
                        `Andere Anhänger-Zuweisung ${other.id} ` +
                        `nicht prüfbar: ${error.message}`
                    );
                }

                trailerStatus.textContent =
                    `Weitere Anhänger geprüft: ` +
                    `${index + 1}/${otherTrailers.length}`;
                await sleep(20);
            }

            for (const item of inspected) {
                const candidates = tows.get(item.buildingId) ?? [];
                const current = item.assignment.towId;

                if (!item.assignment.random && current &&
                    candidates.includes(current) && !reserved.has(current)) {
                    reserved.add(current);
                } else {
                    repair.push(item);
                }
            }

            const plan = [];
            let missing = 0;

            for (const item of repair) {
                const candidate = (tows.get(item.buildingId) ?? [])
                    .find(id => !reserved.has(id) &&
                        item.assignment.allowedTowIds.includes(id));

                if (!candidate) {
                    missing++;
                    continue;
                }

                reserved.add(candidate);
                plan.push({
                    id: item.id,
                    buildingId: item.buildingId,
                    name: item.name,
                    station: item.station,
                    towId: candidate,
                    previousTowId: item.assignment.towId,
                    wasRandom: item.assignment.random
                });
            }

            return {
                plan,
                correct: inspected.length - repair.length,
                missing,
                trailerTypeId,
                towTypeId
            };
        }

        function trailerSignature(result) {
            return JSON.stringify({
                trailerType: trailerType.value,
                towType: towType.value,
                buildings: [...selectedBuildings].sort((a, b) => a - b),
                result
            });
        }

        trailerPreview.onclick = async () => {
            if (busy) {
                return;
            }

            clearTrailerPreview();
            cancelled = false;
            setBusy(true, true);

            try {
                await loadVehicles(true);
                const result = await makeTrailerPlan();
                trailerList.textContent = result.plan.slice(0, 100)
                    .map(item =>
                        `${item.id}: ${item.name} · ${item.station} → ` +
                        `Zugfahrzeug ${item.towId}`
                    ).join('\n');

                if (result.plan.length > 100) {
                    trailerList.textContent +=
                        `\n… und ${result.plan.length - 100} weitere`;
                }

                trailerStatus.textContent =
                    `${result.plan.length} zuweisen · ` +
                    `${result.correct} bereits richtig · ` +
                    `${result.missing} ohne freies Zugfahrzeug`;

                if (result.plan.length) {
                    trailerSnapshot = trailerSignature(result);
                }
            } catch (error) {
                trailerStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        trailerRun.onclick = async () => {
            if (busy || !trailerSnapshot) {
                return;
            }

            const snapshot = trailerSnapshot;
            const result = JSON.parse(snapshot).result;
            clearTrailerPreview();
            cancelled = false;
            setBusy(true, true);
            trailerFill.style.width = '0%';
            let success = 0;
            let errors = 0;

            try {
                if (trailerSignature(result) !== snapshot) {
                    throw new Error('Auswahl geändert – neue Prüfung starten.');
                }

                for (const item of result.plan) {
                    if (cancelled) {
                        break;
                    }

                    try {
                        const current = await trailerAssignment(item.id);

                        if (current.towId !== item.previousTowId ||
                            current.random !== item.wasRandom) {
                            throw new Error('Zuweisung seit Prüfung geändert.');
                        }

                        const token = csrf();

                        if (!token) {
                            throw new Error('CSRF-Token fehlt.');
                        }

                        const response = await fetch(`/vehicles/${item.id}`, {
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
                                'vehicle[tractive_random]': '0',
                                'vehicle[tractive_vehicle_id]': String(item.towId)
                            })
                        });

                        if (!response.ok) {
                            throw new Error(`Zuweisen HTTP ${response.status}`);
                        }

                        success++;
                    } catch (error) {
                        errors++;
                        log(`Anhänger ${item.id}: ${error.message}`);
                    }

                    trailerStatus.textContent =
                        `${success + errors}/${result.plan.length} · ` +
                        `${success} zugewiesen · ${errors} Fehler`;
                    trailerFill.style.width =
                        `${Math.round((success + errors) / result.plan.length * 100)}%`;
                    await sleep(ACTION_DELAY);
                }

                trailerStatus.textContent += cancelled
                    ? ' · angehalten'
                    : ' · abgeschlossen';
            } catch (error) {
                trailerStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        trailerPage.addEventListener('change', clearTrailerPreview);
        buildingsPage.addEventListener('change', clearTrailerPreview);
        centersPage.addEventListener('change', clearTrailerPreview);

        // =================================================
        // POLIZEI- UND BEPO-PERSONAL ÜBERNEHMEN
        // =================================================

        const recruitersPage = pages.get('recruiters');
        const recruitType = select([
            ['6', 'Polizeiwachen'],
            ['11', 'BePo-Wachen']
        ]);
        const recruitMode = select([
            ['untrained', 'Ohne Ausbildung'],
            ['trained', 'Mit Ausbildung (BePo)']
        ]);
        const recruitEducation = select([
            ['zugfuehrer', 'Zugführer'],
            ['hundertschaftsfuehrer', 'Hundertschaftsführer'],
            ['wasserwerfer', 'Wasserwerfer'],
            ['sek', 'SEK'],
            ['mek', 'MEK'],
            ['hundefuehrer', 'Hundeführer']
        ]);
        const recruitTarget = input('number', '110');
        const recruitPoliceReserve = input('number', '36');
        const recruitBepoReserve = input('number', '244');
        const recruitSourceScope = select([
            ['all', 'Alle Leitstellen'],
            ['selected', 'Nur ausgewählte Leitstellen']
        ]);
        const recruitExcludeSources = input(
            'text', 'Quellwachen-IDs, mit Komma getrennt'
        );
        const recruitPreview = button('Personalbedarf prüfen');
        const recruitRun = button('Personal übernehmen', 'primary');
        const recruitStatus = el('p', '', 'Noch keine Prüfung.');
        const recruitList = el('pre', 'aio-log');
        const recruitProgress = el('div', 'aio-preview-progress');
        const recruitFill = el('div', 'aio-preview-fill');
        let recruitSnapshot = null;

        recruitTarget.value = '36';
        recruitPoliceReserve.value = '36';
        recruitBepoReserve.value = '244';
        recruitRun.disabled = true;
        recruitEducation.disabled = true;
        recruitProgress.append(recruitFill);
        recruitersPage.append(
            panel('Personal auf Polizei- oder BePo-Wachen verschieben',
                'Ausgewählte Wachen werden bis zur Zielzahl aufgefüllt. ' +
                'Quellen sind Polizei- und BePo-Wachen; deren Reserve ' +
                'wird vor jeder Übernahme live geprüft.'
            ),
            row(
                field('Zielwachen', recruitType),
                field('Personalart', recruitMode),
                field('Ausbildung', recruitEducation),
                field('Zielzahl', recruitTarget)
            ),
            row(
                field('Mindestpersonal Polizei', recruitPoliceReserve),
                field('Mindestpersonal BePo', recruitBepoReserve),
                field('Quell-Leitstellen', recruitSourceScope),
                field('Quellwachen ausschließen', recruitExcludeSources)
            ),
            row(recruitPreview, recruitRun),
            recruitStatus,
            recruitProgress,
            recruitList
        );

        const recruitEducationAliases = new Map([
            ['zugfuehrer', ['Zugführer', 'Zugführer (leBefKw)']],
            ['hundertschaftsfuehrer', [
                'Hundertschaftsführer', 'Hundertschaftsführer (FüKw)'
            ]],
            ['wasserwerfer', ['Wasserwerfer']],
            ['sek', ['SEK']],
            ['mek', ['MEK']],
            ['hundefuehrer', [
                'Hundeführer', 'Hundeführer (Schutzhund)'
            ]]
        ]);

        function normalizeEducation(value) {
            return String(value ?? '')
                .normalize('NFC')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .toLocaleLowerCase('de-DE');
        }

        function clearRecruitPreview() {
            recruitSnapshot = null;
            recruitRun.disabled = true;
        }

        function recruitConfig() {
            const type = Number(recruitType.value);
            const mode = recruitMode.value;
            const target = Number(recruitTarget.value);
            const policeReserve = Number(recruitPoliceReserve.value);
            const bepoReserve = Number(recruitBepoReserve.value);

            if (!Number.isSafeInteger(target) || target < 0 ||
                !Number.isSafeInteger(policeReserve) || policeReserve < 2 ||
                !Number.isSafeInteger(bepoReserve) || bepoReserve < 0) {
                throw new Error('Zielzahl und Mindestpersonal prüfen.');
            }

            if (mode === 'trained' && type !== 11) {
                throw new Error('Ausbildungsmodus ist nur für BePo verfügbar.');
            }

            return {
                type, mode, target, policeReserve, bepoReserve,
                education: recruitEducation.value,
                sourceScope: recruitSourceScope.value,
                excludedSources: recruitExcludeSources.value
                    .split(/[\s,;]+/)
                    .filter(Boolean)
                    .map(Number)
                    .filter(Number.isSafeInteger)
                    .sort((a, b) => a - b)
            };
        }

        function recruitTable(doc, id) {
            return doc.getElementById(`personal_table_${id}`) ??
                doc.querySelector('table');
        }

        async function recruitPersonnelDoc(id) {
            return fetchPage(`/buildings/${id}/schooling_personal_select`);
        }

        function recruitEligible(doc, id, config) {
            const table = recruitTable(doc, id);

            if (!table) {
                throw new Error(`Wache ${id}: Personalliste fehlt.`);
            }

            const aliases = config.mode === 'trained'
                ? (recruitEducationAliases.get(config.education) ?? [])
                    .map(normalizeEducation)
                : [''];
            const accepted = new Set(aliases);
            const ids = [];

            for (const row of table.querySelectorAll('tbody tr')) {
                const cells = row.querySelectorAll('td');
                const inputNode = cells[0]?.querySelector('input[value]');
                const education = normalizeEducation(cells[2]?.textContent);
                const currentCourse = normalizeEducation(cells[3]?.textContent);

                if (inputNode?.value && cells[2] && cells[3] &&
                    !currentCourse && accepted.has(education)) {
                    ids.push(inputNode.value);
                }
            }

            return {
                ids,
                total: table.querySelectorAll('tbody tr').length
            };
        }

        function recruitTargets(config) {
            const chosen = selectedToolBuildings()
                .filter(building => Number(building.building_type) ===
                    config.type);

            if (!chosen.length) {
                throw new Error(
                    'Im Tab Gebäude passende Polizei- oder BePo-Wachen wählen.'
                );
            }

            return chosen;
        }

        function recruitSignature(config, targets) {
            return JSON.stringify({
                config,
                targets: targets.map(item => Number(item.id)),
                centers: [...selectedCenters].sort((a, b) => a - b)
            });
        }

        recruitType.onchange = () => {
            if (recruitType.value === '6') {
                recruitMode.value = 'untrained';
                recruitTarget.value = '36';
            } else {
                recruitTarget.value = '110';
            }
            recruitEducation.disabled = recruitMode.value !== 'trained';
            clearRecruitPreview();
        };

        recruitMode.onchange = () => {
            recruitEducation.disabled = recruitMode.value !== 'trained';
            clearRecruitPreview();
        };

        recruitPreview.onclick = async () => {
            if (busy) {
                return;
            }

            clearRecruitPreview();

            try {
                const config = recruitConfig();
                const targets = recruitTargets(config);
                recruitList.textContent = targets.slice(0, 100)
                    .map(item =>
                        `${item.id}: ${item.caption} · ` +
                        `${item.personal_count ?? '?'} vorhanden`
                    ).join('\n');
                recruitStatus.textContent =
                    `${targets.length} Zielwachen. Live-Personal wird ` +
                    'beim Start geprüft.';
                recruitSnapshot = recruitSignature(config, targets);
                recruitRun.disabled = false;
            } catch (error) {
                recruitStatus.textContent = `Fehler: ${error.message}`;
            }
        };

        recruitRun.onclick = async () => {
            if (busy || !recruitSnapshot) {
                return;
            }

            let config;
            let targets;

            try {
                config = recruitConfig();
                targets = recruitTargets(config);

                if (!csrf()) {
                    throw new Error('CSRF-Token fehlt.');
                }

                if (recruitSignature(config, targets) !== recruitSnapshot) {
                    throw new Error('Auswahl geändert – neue Vorschau erstellen.');
                }
            } catch (error) {
                clearRecruitPreview();
                recruitStatus.textContent = `Fehler: ${error.message}`;
                return;
            }

            clearRecruitPreview();
            cancelled = false;
            setBusy(true, true);
            recruitFill.style.width = '0%';
            const targetIds = new Set(targets.map(item => Number(item.id)));
            const excludedSources = new Set(config.excludedSources);
            const sources = buildings
                .filter(item => [6, 11].includes(
                    Number(item.building_type)))
                .filter(item => config.type === 11 ||
                    Number(item.building_type) === 6)
                .filter(item => !targetIds.has(Number(item.id)))
                .filter(item => !excludedSources.has(Number(item.id)))
                .filter(item => config.sourceScope !== 'selected' ||
                    selectedCenters.has(centerId(item)))
                .map(item => ({
                    id: Number(item.id),
                    type: Number(item.building_type),
                    caption: item.caption,
                    reserve: config.mode === 'trained'
                        ? 1
                        : Number(item.building_type) === 11
                            ? config.bepoReserve
                            : config.policeReserve,
                    available: Math.max(
                        Number(item.personal_count ?? 0) -
                            (config.mode === 'trained'
                                ? 1
                                : Number(item.building_type) === 11
                                    ? config.bepoReserve
                                    : config.policeReserve),
                        0
                    )
                }))
                .filter(item => item.available > 0)
                .sort((a, b) => b.available - a.available || a.id - b.id);
            const pools = new Map();
            let moved = 0;
            let errors = 0;

            try {
                for (let index = 0; index < targets.length; index++) {
                    if (cancelled) {
                        break;
                    }

                    const target = targets[index];

                    try {
                        const targetDoc = await recruitPersonnelDoc(target.id);
                        const targetPersonnel = recruitEligible(
                            targetDoc, target.id, config
                        );
                        const current = config.mode === 'trained'
                            ? targetPersonnel.ids.length
                            : targetPersonnel.total;
                        const needed = Math.max(config.target - current, 0);
                        const chosen = [];
                        const reservations = [];

                        for (const source of sources) {
                            if (cancelled || chosen.length >= needed) {
                                break;
                            }

                            if (source.available <= 0) {
                                continue;
                            }

                            try {
                                if (!pools.has(source.id)) {
                                    const doc = await recruitPersonnelDoc(source.id);
                                    const personnel = recruitEligible(
                                        doc, source.id, config
                                    );
                                    source.available = Math.max(
                                        Math.min(source.available,
                                            personnel.total - source.reserve),
                                        0
                                    );
                                    pools.set(source.id, personnel.ids);
                                }

                                const pool = pools.get(source.id);
                                const count = Math.min(
                                    needed - chosen.length,
                                    source.available,
                                    pool.length
                                );

                                if (count <= 0) {
                                    continue;
                                }

                                const ids = pool.splice(0, count);
                                chosen.push(...ids);
                                source.available -= ids.length;
                                reservations.push({ source, pool, ids });
                            } catch (error) {
                                log(`Quelle ${source.id}: ${error.message}`);
                                source.available = 0;
                            }
                        }

                        if (cancelled) {
                            for (const { source, pool, ids } of reservations) {
                                pool.unshift(...ids);
                                source.available += ids.length;
                            }
                            break;
                        }

                        if (chosen.length) {
                            const token = csrf();

                            const body = new URLSearchParams({
                                utf8: '✓',
                                authenticity_token: token,
                                commit: 'Personal übernehmen'
                            });

                            for (const id of chosen) {
                                body.append('personal_ids[]', id);
                            }

                            try {
                                const response = await fetch(
                                    `/buildings/${target.id}/adopt`, {
                                        method: 'POST',
                                        credentials: 'same-origin',
                                        body,
                                        redirect: 'manual'
                                    }
                                );

                                if (response.status >= 400) {
                                    throw new Error(
                                        `Übernahme HTTP ${response.status}`
                                    );
                                }

                                moved += chosen.length;
                            } catch (error) {
                                for (const { source, pool, ids }
                                    of reservations.reverse()) {
                                    pool.unshift(...ids);
                                    source.available += ids.length;
                                }
                                throw error;
                            }
                        }

                        log(`${target.caption}: ${current} + ${chosen.length}` +
                            ` / ${config.target}`);
                    } catch (error) {
                        errors++;
                        log(`Ziel ${target.id}: ${error.message}`);
                    }

                    recruitStatus.textContent =
                        `${index + 1}/${targets.length} Wachen · ` +
                        `${moved} Personen übernommen · ${errors} Fehler`;
                    recruitFill.style.width =
                        `${Math.round((index + 1) / targets.length * 100)}%`;
                    await sleep(ACTION_DELAY);
                }

                recruitStatus.textContent += cancelled
                    ? ' · angehalten'
                    : ' · abgeschlossen';
                invalidate();
                await loadBuildings(true);
                drawStations();
            } catch (error) {
                recruitStatus.textContent = `Fehler: ${error.message}`;
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        recruitersPage.addEventListener('input', clearRecruitPreview);
        recruitersPage.addEventListener('change', clearRecruitPreview);
        buildingsPage.addEventListener('change', clearRecruitPreview);
        centersPage.addEventListener('change', clearRecruitPreview);

        // =================================================
        // KRANKENHAUSBETTEN / ZELLEN IM VERBAND FREIGEBEN
        // =================================================

        const sharingPage = pages.get('sharing');
        const shareCenter = select([['', 'Leitstelle wählen']]);
        const shareMode = select([
            ['share', 'Im Verband freigeben'],
            ['unshare', 'Freigabe beenden']
        ]);
        const shareHospitals = input('checkbox');
        const shareCells = input('checkbox');
        const sharePercentOptions = [0, 10, 20, 30, 40, 50]
            .map(value => [String(value), `${value} %`]);
        const shareHospitalPercent = select(sharePercentOptions);
        const shareCellPercent = select(sharePercentOptions);
        const sharePreview = button('Freigaben prüfen');
        const shareRun = button('Freigaben anwenden', 'primary');
        const shareStatus = el('p', '', 'Noch keine Prüfung.');
        const shareList = el('pre', 'aio-log');
        const shareProgress = el('div', 'aio-preview-progress');
        const shareFill = el('div', 'aio-preview-fill');
        let shareSnapshot = null;

        shareHospitals.checked = true;
        shareCells.checked = true;
        shareRun.disabled = true;
        shareProgress.append(shareFill);
        sharingPage.append(
            panel('Im Verband freigeben',
                'Liest die Erweiterungsliste der gewählten Leitstelle. ' +
                'Krankenhausbetten und Zellen können einzeln ein- oder ' +
                'ausgeschlossen werden.'
            ),
            row(
                field('Leitstelle', shareCenter),
                field('Aktion', shareMode)
            ),
            row(
                field('Krankenhausbetten', shareHospitals),
                field('Gebühr Krankenhaus', shareHospitalPercent),
                field('Zellen', shareCells),
                field('Gebühr Zellen', shareCellPercent)
            ),
            row(sharePreview, shareRun),
            shareStatus,
            shareProgress,
            shareList
        );

        function clearSharePreview() {
            shareSnapshot = null;
            shareRun.disabled = true;
        }

        function shareConfig() {
            const center = Number(shareCenter.value);

            if (!center || !centers.some(item => Number(item.id) === center)) {
                throw new Error('Leitstelle auswählen.');
            }

            if (!shareHospitals.checked && !shareCells.checked) {
                throw new Error('Krankenhausbetten oder Zellen auswählen.');
            }

            return {
                center,
                mode: shareMode.value,
                hospitals: shareHospitals.checked,
                cells: shareCells.checked,
                hospitalStep: Number(shareHospitalPercent.value) / 10,
                cellStep: Number(shareCellPercent.value) / 10
            };
        }

        function normalizedShareText(value) {
            return String(value ?? '').replace(/\s+/g, ' ')
                .trim().toLocaleLowerCase('de-DE');
        }

        async function loadSharingTable(centerId) {
            const frame = el('iframe');
            frame.style.cssText =
                'position:absolute;left:-10000px;top:0;width:1px;height:1px';
            const loaded = new Promise((resolve, reject) => {
                const timer = setTimeout(() =>
                    reject(new Error('Leitstellenseite lädt nicht.')), 20000);
                frame.onload = () => {
                    clearTimeout(timer);
                    resolve();
                };
                frame.onerror = () => {
                    clearTimeout(timer);
                    reject(new Error('Leitstellenseite nicht erreichbar.'));
                };
            });
            frame.src = `/buildings/${centerId}`;
            document.body.append(frame);

            try {
                await loaded;

                const doc = frame.contentDocument;

                if (!doc) {
                    throw new Error('Leitstellenseite nicht zugreifbar.');
                }

                doc.querySelector(
                    'a[href="#tab_extensions"], ' +
                    'a[data-target="#tab_extensions"]'
                )?.click();
                const timeoutAt = Date.now() + 20000;

                while (Date.now() < timeoutAt && !cancelled) {
                    const table = doc.querySelector('#tab_extensions table');

                    if (table?.querySelector('tr a.btn')) {
                        return table.cloneNode(true);
                    }

                    await sleep(100);
                }

                throw new Error(
                    'Erweiterungsliste nicht geladen. Bitte die ' +
                    'Leitstelle im Spiel öffnen und erneut versuchen.'
                );
            } finally {
                frame.remove();
            }
        }

        function sharingTargets(table, config) {
            const rows = [...table.querySelectorAll('tr')];
            const header = row => [...row.querySelectorAll('a.btn')]
                .some(link => normalizedShareText(link.textContent)
                    .includes('im verband freigeben'));
            const targets = [];

            for (let index = 0; index < rows.length; index++) {
                const row = rows[index];

                if (!header(row)) {
                    continue;
                }

                const block = [row];
                let next = index + 1;

                while (next < rows.length && !header(rows[next])) {
                    block.push(rows[next++]);
                }

                const blockText = normalizedShareText(
                    block.map(item => item.textContent).join(' ')
                );
                const type = blockText.includes('zellen')
                    ? 'cells'
                    : blockText.includes('krankenhaus') ||
                        blockText.includes('betten')
                        ? 'hospital'
                        : null;

                if (!type || !(type === 'cells'
                    ? config.cells : config.hospitals)) {
                    continue;
                }

                const links = block.flatMap(item =>
                    [...item.querySelectorAll('a[href]')]);
                const buildingLink = links.find(link =>
                    /\/buildings\/\d+/.test(link.getAttribute('href') ?? '')
                );
                const id = Number(buildingLink?.getAttribute('href')
                    ?.match(/\/buildings\/(\d+)/)?.[1]);

                if (!id) {
                    continue;
                }

                const share = links.find(link =>
                    link.classList.contains('btn-success') &&
                    normalizedShareText(link.textContent)
                        .includes('im verband freigeben'));
                const unshare = links.find(link =>
                    normalizedShareText(link.textContent)
                        .includes('nicht im verband freigeben'));
                const step = type === 'cells'
                    ? config.cellStep : config.hospitalStep;
                const fee = links.find(link =>
                    Number(link.getAttribute('href')
                        ?.match(/\/alliance_costs\/(\d+)/)?.[1]) === step
                );

                targets.push({
                    id,
                    type,
                    shareHref: share?.getAttribute('href') ?? null,
                    unshareHref: unshare?.getAttribute('href') ?? null,
                    feeHref: fee?.getAttribute('href') ??
                        `/buildings/${id}/alliance_costs/${step}`
                });
            }

            return [...new Map(targets.map(item =>
                [`${item.type}:${item.id}`, item])).values()];
        }

        sharePreview.onclick = async () => {
            if (busy) {
                return;
            }

            clearSharePreview();
            cancelled = false;
            setBusy(true, true);

            try {
                const config = shareConfig();
                shareStatus.textContent = 'Erweiterungsliste wird geladen …';
                const table = await loadSharingTable(config.center);
                const targets = sharingTargets(table, config);
                shareList.textContent = targets.slice(0, 100)
                    .map(item => `${item.id}: ${item.type}`)
                    .join('\n');
                shareStatus.textContent =
                    `${targets.length} Freigabe-Ziele gefunden.`;

                if (targets.length) {
                    shareSnapshot = JSON.stringify({ config, targets });
                }
            } catch (error) {
                shareStatus.textContent = `Fehler: ${error.message}`;
                shareList.textContent = '';
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        shareRun.onclick = async () => {
            if (busy || !shareSnapshot) {
                return;
            }

            const snapshot = JSON.parse(shareSnapshot);
            let currentConfig;

            try {
                currentConfig = shareConfig();
            } catch (error) {
                clearSharePreview();
                shareStatus.textContent = `Fehler: ${error.message}`;
                return;
            }

            if (JSON.stringify(currentConfig) !==
                JSON.stringify(snapshot.config)) {
                clearSharePreview();
                shareStatus.textContent = 'Auswahl geändert – erneut prüfen.';
                return;
            }

            clearSharePreview();
            cancelled = false;
            setBusy(true, true);
            shareFill.style.width = '0%';
            let success = 0;
            let errors = 0;

            try {
                for (const item of snapshot.targets) {
                    if (cancelled) {
                        break;
                    }

                    try {
                        const hrefs = snapshot.config.mode === 'share'
                            ? [item.shareHref, item.feeHref].filter(Boolean)
                            : [item.unshareHref].filter(Boolean);

                        if (!hrefs.length) {
                            throw new Error('Freigabe-Link fehlt.');
                        }

                        for (const href of hrefs) {
                            const response = await fetch(
                                new URL(href, location.origin).href, {
                                    credentials: 'same-origin',
                                    headers: {
                                        'X-Requested-With': 'XMLHttpRequest'
                                    }
                                }
                            );

                            if (!response.ok) {
                                throw new Error(`HTTP ${response.status}`);
                            }
                        }

                        success++;
                    } catch (error) {
                        errors++;
                        log(`Freigabe ${item.id}: ${error.message}`);
                    }

                    shareStatus.textContent =
                        `${success + errors}/${snapshot.targets.length} · ` +
                        `${success} erfolgreich · ${errors} Fehler`;
                    shareFill.style.width =
                        `${Math.round((success + errors) /
                            snapshot.targets.length * 100)}%`;
                    await sleep(ACTION_DELAY);
                }

                shareStatus.textContent += cancelled
                    ? ' · angehalten'
                    : ' · abgeschlossen';
            } finally {
                cancelled = false;
                setBusy(false);
            }
        };

        sharingPage.addEventListener('change', clearSharePreview);

        // =================================================
        // MANUELLE API-AKTUALISIERUNG
        // =================================================

        async function manualRefresh(mode) {
            if (busy) {
                return;
            }

            invalidate();
            setBusy(true);

            try {
                if (
                    mode === 'all' ||
                    mode === 'buildings'
                ) {
                    // maxAge=0 allein startet in der Skriptbasis nur einen
                    // inkrementellen Abruf. Ein manueller Abgleich soll auch
                    // bereits gekaufte, dabei übersehene Erweiterungen neu
                    // aus dem vollständigen Gebäudebestand lesen.
                    const state = await getSyncState(db, 'buildings');
                    await writeSyncState(db, 'buildings', {
                        ...state,
                        inProgress: false,
                        resumeUrl: null,
                        complete: false,
                        checkedAt: 0,
                        fullSyncAt: 0
                    });
                    await loadBuildings(true);

                    drawCenters();
                    drawStations();
                    drawExtensions();
                }

                if (
                    mode === 'all' ||
                    mode === 'vehicles'
                ) {
                    await loadVehicles(true);
                }

                setStatus(
                    'API-Aktualisierung abgeschlossen'
                );

                log(
                    `Manuelle Aktualisierung: ${mode}`
                );
            } catch (error) {
                log(
                    `FEHLER API: ${error.message}`
                );

                setStatus(
                    'API-Aktualisierung fehlgeschlagen'
                );
            } finally {
                setBusy(false);
            }
        }

        refreshAll.onclick = () =>
            manualRefresh('all');

        refreshBuildings.onclick = () =>
            manualRefresh('buildings');

        refreshVehicles.onclick = () =>
            manualRefresh('vehicles');

        for (const [pageId, pageNode] of pages) {
            if (['buildingTools', 'vehicleTools', 'trailers',
                'recruiters', 'sharing'].includes(pageId)) {
                continue;
            }

            pageNode.addEventListener(
                'input',
                event => {
                    if (
                        event.target !== centerSearch &&
                        event.target !== stationSearch &&
                        event.target !== quickCenter &&
                        event.target !== quickDisabled &&
                        event.target !== quickOwnMissions
                    ) {
                        invalidate();
                    }
                }
            );

            pageNode.addEventListener(
                'change', event => {
                    if (![quickCenter, quickDisabled, quickOwnMissions]
                        .includes(event.target)) {
                        invalidate();
                        drawSummary();
                    }
                }
            );
        }

        // =================================================
        // INITIALISIERUNG
        // =================================================

        showTab('centers');
        setBusy(true);

        try {
            await Promise.all([
                loadBuildings(),
                updateVehicleTypes(db),
                updateBuildingTypes(db)
            ]);

            const [vehicleData, typeData] =
                await Promise.all([
                    getAllData(db, 'vehicleTypes'),
                    getAllData(db, 'buildingTypes')
                ]);

            vehicleTypes = vehicleData.map(item => [
                Number(item.id),
                item.caption ??
                    `Fahrzeug ${item.id}`
            ]).sort((a, b) =>
                String(a[1]).localeCompare(
                    String(b[1]),
                    'de'
                )
            );

            vehicleDeleteType.replaceChildren(
                new Option('Fahrzeugtyp wählen', ''),
                ...vehicleTypes.map(([id, name]) =>
                    new Option(name, String(id))
                )
            );
            vehicleStatusType.replaceChildren(
                new Option('Fahrzeugtyp wählen', ''),
                ...vehicleTypes.map(([id, name]) =>
                    new Option(name, String(id))
                )
            );
            trailerType.replaceChildren(
                new Option('Anhänger-Typ wählen', ''),
                ...vehicleTypes.map(([id, name]) =>
                    new Option(name, String(id))
                )
            );
            towType.replaceChildren(
                new Option('Zugfahrzeug-Typ wählen', ''),
                ...vehicleTypes.map(([id, name]) =>
                    new Option(name, String(id))
                )
            );

            const buildingNames = new Map(
                typeData.map(item => [
                    Number(item.id),
                    item.caption ??
                        FALLBACK_BUILDINGS.get(
                            Number(item.id)
                        ) ??
                        `Gebäudetyp ${item.id}`
                ])
            );

            for (
                const [id, name]
                of FALLBACK_BUILDINGS
            ) {
                if (!buildingNames.has(id)) {
                    buildingNames.set(id, name);
                }
            }

            for (
                const type
                of buildingsByType.keys()
            ) {
                if (!buildingNames.has(type)) {
                    buildingNames.set(
                        type,
                        `Gebäudetyp ${type}`
                    );
                }
            }

            for (
                const [id, name]
                of [...buildingNames]
                    .filter(([id]) => id !== 7)
                    .sort((a, b) =>
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

                option.value = id;
                buildingType.append(option);
            }

            const validCenters = new Set(
                centers.map(
                    item => Number(item.id)
                )
            );

            for (const id of [...selectedCenters]) {
                if (!validCenters.has(id)) {
                    selectedCenters.delete(id);
                }
            }

            const vehicleCount =
                await getCount(db, 'vehicles');

            const vehicleState =
                await getSyncState(db, 'vehicles');

            const vehicleCard =
                apiCards.vehicles;

            vehicleCard.count.textContent =
                fmt(vehicleCount);

            const complete =
                Boolean(vehicleState?.complete) &&
                !vehicleState?.inProgress;

            vehicleCard.badge.textContent =
                complete
                    ? 'Cache vorhanden'
                    : vehicleCount
                        ? 'Cache unvollständig'
                        : 'Noch nicht geladen';

            vehicleCard.detail.textContent =
                'Fahrzeug-API wird vor der Vorschau aktualisiert.';

            if (complete) {
                vehicleCard.fill.style.width =
                    '100%';
            }

            refreshTemplatePicker();
            toolsTargetCenter.replaceChildren(
                new Option('Ziel-Leitstelle wählen', ''),
                ...centers
                    .slice()
                    .sort((a, b) =>
                        String(a.caption ?? '').localeCompare(
                            String(b.caption ?? ''), 'de'
                        )
                    )
                    .map(center => new Option(
                        `${center.caption} (${center.id})`,
                        String(center.id)
                    ))
            );
            if ([...toolsTargetCenter.options].some(
                option => option.value === storedToolTarget
            )) {
                toolsTargetCenter.value = storedToolTarget;
            }
            quickCenter.replaceChildren(
                new Option('Leitstelle wählen', ''),
                ...centers
                    .slice()
                    .sort((a, b) =>
                        String(a.caption ?? '').localeCompare(
                            String(b.caption ?? ''), 'de'
                        )
                    )
                    .map(center => new Option(
                        `${center.caption} (${center.id})`,
                        String(center.id)
                    ))
            );
            shareCenter.replaceChildren(
                new Option('Leitstelle wählen', ''),
                ...centers
                    .slice()
                    .sort((a, b) =>
                        String(a.caption ?? '').localeCompare(
                            String(b.caption ?? ''), 'de'
                        )
                    )
                    .map(center => new Option(
                        `${center.caption} (${center.id})`,
                        String(center.id)
                    ))
            );
            const toolPreferences =
                await GM.getValue(toolsPreferencesKey, {});
            const preferenceControls = {
                quickCenter,
                toolsName,
                toolsStart,
                toolsDigits,
                toolsDeleteStart,
                toolsDeleteEvery,
                toolsStaffTarget,
                toolsAutomatic,
                vehicleDeleteType,
                vehicleKeep,
                vehicleEveryStation,
                vehicleStatusType,
                vehicleStatusTarget,
                vehicleStatusKeep,
                trailerType,
                towType,
                recruitType,
                recruitMode,
                recruitEducation,
                recruitTarget,
                recruitPoliceReserve,
                recruitBepoReserve,
                recruitSourceScope,
                recruitExcludeSources,
                shareCenter,
                shareMode,
                shareHospitals,
                shareCells,
                shareHospitalPercent,
                shareCellPercent
            };

            for (const [key, control] of Object.entries(
                preferenceControls
            )) {
                const saved = toolPreferences?.[key];

                if (saved !== undefined) {
                    if (control.type === 'checkbox') {
                        control.checked = Boolean(saved);
                    } else if (control.tagName === 'SELECT') {
                        if ([...control.options].some(option =>
                            option.value === String(saved))) {
                            control.value = String(saved);
                        }
                    } else {
                        control.value = String(saved);
                    }
                }

                control.addEventListener('change', () => {
                    const values = {};

                    for (const [name, node] of Object.entries(
                        preferenceControls
                    )) {
                        values[name] = node.type === 'checkbox'
                            ? node.checked : node.value;
                    }

                    GM.setValue(toolsPreferencesKey, values)
                        .catch(error => log(
                            `Werkzeug-Einstellungen nicht gespeichert: ${error}`
                        ));
                });
            }

            recruitEducation.disabled = recruitMode.value !== 'trained';
            drawCenters();
            drawStations();
            drawExtensions();
            drawSummary();

            clearLog();

            log(
                `${fmt(buildings.length)} Gebäude geladen.`
            );

            log(
                `${fmt(centers.length)} Leitstellen verfügbar.`
            );

            log(`v${VERSION}: Dynamische Arbeitsphasen aktiviert.`);

            log(
                'Leere Phasen springen sofort auf 100 %.'
            );

            log(
                'Delays: 100 ms Aktionen · 20 ms Wachen · ' +
                'Bestätigung 0/300/500 ms.'
            );

            setStatus('Bereit');
        } catch (error) {
            log(
                `Initialisierung fehlgeschlagen: ${error.message}`
            );

            setStatus('Fehler');
        } finally {
            setBusy(false);
        }
    }

    // ====================================================
    // DESIGN
    // ====================================================

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

            #nilspe-all-in-one .aio-version {
                border: 1px solid #8885;
                border-radius: 5px;
                padding: 6px 10px;
                font-size: 12px;
                opacity: .8;
            }

            #nilspe-all-in-one .aio-muted {
                opacity: .75;
                font-size: 13px;
            }

            #nilspe-all-in-one .aio-tabs {
                border-bottom: 1px solid #8885;
                padding-bottom: 10px;
                margin-bottom: 18px;
            }

            #nilspe-all-in-one .aio-tab-primary,
            #nilspe-all-in-one .aio-tab-group {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: flex-start;
                gap: 6px;
            }

            #nilspe-all-in-one .aio-tab-primary {
                margin-bottom: 8px;
            }

            #nilspe-all-in-one .aio-tab-group[hidden] {
                display: none;
            }

            #nilspe-all-in-one .aio-tab-secondary {
                padding: 8px;
                border-radius: 5px;
                background: #8881;
            }

            #nilspe-all-in-one .aio-tabs button {
                padding: 7px 12px;
                background: #8881;
                border: 1px solid #8884;
                border-radius: 4px;
                color: inherit;
            }

            #nilspe-all-in-one .aio-tab-secondary button {
                padding: 5px 10px;
            }

            #nilspe-all-in-one .aio-tabs button.active {
                background: #337ab7;
                border-color: #337ab7;
                color: white;
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

            #nilspe-all-in-one .aio-row {
                display: flex;
                align-items: end;
                justify-content: flex-start;
                flex-wrap: wrap;
                gap: 8px;
                margin: 10px 0;
            }

            #nilspe-all-in-one .aio-field {
                display: flex;
                flex-direction: column;
                gap: 5px;
                min-width: 140px;
                max-width: 260px;
                flex: 0 1 220px;
                font-weight: normal;
                text-align: left;
            }

            #nilspe-all-in-one .aio-field > span {
                font-size: 13px;
                font-weight: 500;
            }

            #nilspe-all-in-one .aio-field input,
            #nilspe-all-in-one .aio-field select {
                height: 30px;
                color: #333;
            }

            #nilspe-all-in-one .aio-field input[type="checkbox"] {
                width: 16px !important;
                height: 16px !important;
                min-width: 16px;
                padding: 0;
                align-self: flex-start;
            }

            #nilspe-all-in-one .aio-list {
                border: 1px solid #8885;
                border-radius: 5px;
                max-height: 360px;
                overflow-y: auto;
                margin: 10px 0;
            }

            #nilspe-all-in-one .aio-center-list {
                max-height: min(60vh, 620px);
            }

            #nilspe-all-in-one .aio-check {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 8px;
                width: 100%;
                min-height: 30px;
                padding: 5px 9px;
                margin: 0;
                border-bottom: 1px solid #8883;
                background: #8881;
                font-weight: normal;
                text-align: left;
                cursor: pointer;
            }

            #nilspe-all-in-one .aio-check > span {
                flex: 1;
                min-width: 0;
                text-align: left;
            }

            #nilspe-all-in-one .aio-check:nth-child(even) {
                background: #8882;
            }

            #nilspe-all-in-one .aio-check input[type="checkbox"],
            #nilspe-all-in-one .aio-inline input[type="checkbox"] {
                display: inline-block;
                position: static !important;
                width: 16px !important;
                height: 16px !important;
                min-width: 16px;
                flex: 0 0 16px;
                padding: 0;
                margin: 0 !important;
                box-shadow: none;
            }

            #nilspe-all-in-one .aio-inline {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 7px;
                font-weight: normal;
                margin: 0;
                text-align: left;
            }

            #nilspe-all-in-one .aio-pagination {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                margin: 12px;
                font-size: 12px;
            }

            #nilspe-all-in-one .aio-extension {
                display: grid;
                grid-template-columns:
                    minmax(180px, 1fr)
                    minmax(160px, auto)
                    minmax(150px, 180px);
                gap: 8px;
                align-items: center;
                padding: 7px 9px;
                border: 1px solid #8885;
                border-radius: 4px;
                background: #8881;
                margin-bottom: 5px;
                text-align: left;
            }

            #nilspe-all-in-one .aio-vehicle {
                display: grid;
                grid-template-columns:
                    minmax(180px, 1.8fr)
                    minmax(105px, .8fr)
                    minmax(120px, .9fr)
                    minmax(115px, .9fr)
                    minmax(170px, 1.3fr)
                    auto;
                gap: 8px;
                align-items: end;
                padding: 8px;
                margin-bottom: 6px;
                border: 1px solid rgba(92,184,92,.30);
                border-radius: 4px;
                background: rgba(92,184,92,.07);
                text-align: left;
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

            #nilspe-all-in-one .aio-phase {
                padding: 12px;
                border-left: 3px solid #337ab7;
                background: #8881;
                margin: 16px 0;
            }

            #nilspe-all-in-one .aio-footer {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                padding: 15px;
                border: 1px solid #8885;
                border-radius: 5px;
                margin-top: 20px;
            }

            #nilspe-all-in-one .aio-status {
                margin-left: auto;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-api-actions {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
            }

            #nilspe-all-in-one .aio-log {
                width: 100%;
                min-height: 160px;
                max-height: 370px;
                overflow: auto;
                white-space: pre-wrap;
                word-break: break-word;
                padding: 15px;
                margin-top: 14px;
                background: #8881;
                border: 1px solid #8885;
                border-radius: 5px;
                color: inherit;
                font: 12px/1.6 Consolas, monospace;
            }

            #nilspe-all-in-one .aio-api-dashboard {
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap: 14px;
                margin-bottom: 18px;
            }

            #nilspe-all-in-one .aio-api-card {
                padding: 15px;
                min-width: 0;
                border: 1px solid #8885;
                border-radius: 6px;
                background: #8881;
            }

            #nilspe-all-in-one .aio-api-heading {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 14px;
            }

            #nilspe-all-in-one .aio-api-badge {
                font-size: 12px;
                opacity: .85;
            }

            #nilspe-all-in-one .aio-api-badge.success {
                color: #90cf90;
            }

            #nilspe-all-in-one .aio-api-badge.running {
                color: #8cb9ed;
            }

            #nilspe-all-in-one .aio-api-badge.error {
                color: #e78e8e;
            }

            #nilspe-all-in-one .aio-api-metrics {
                display: grid;
                grid-template-columns:
                    repeat(3, minmax(0, 1fr));
                gap: 8px;
            }

            #nilspe-all-in-one .aio-api-metrics > div {
                display: flex;
                flex-direction: column;
                gap: 5px;
                padding: 10px;
                border: 1px solid #8884;
                background: #8881;
                border-radius: 4px;
            }

            #nilspe-all-in-one .aio-api-metrics small {
                font-size: 10px;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-api-count {
                font-size: 17px;
                font-weight: 500;
            }

            #nilspe-all-in-one .aio-api-bar {
                position: relative;
                height: 6px;
                background: #8883;
                border-radius: 4px;
                overflow: hidden;
            }

            #nilspe-all-in-one .aio-api-fill {
                height: 100%;
                width: 0;
                background: #337ab7;
            }

            #nilspe-all-in-one .aio-api-bar.running .aio-api-fill {
                position: absolute;
                width: 30%;
                animation:
                    aio-api-moving 1.6s ease-in-out infinite alternate;
            }

            @keyframes aio-api-moving {
                from { left: 0; }
                to { left: 70%; }
            }

            #nilspe-all-in-one .aio-phase-progress {
                display: grid;
                grid-template-columns: 1fr;
                gap: 9px;
                margin: 18px 0;
            }

            #nilspe-all-in-one .aio-phase-progress[hidden],
            #nilspe-all-in-one .aio-phase-card[hidden] {
                display: none;
            }

            #nilspe-all-in-one .aio-phase-card {
                border: 1px solid #8885;
                background: #8881;
                border-radius: 6px;
                padding: 13px 15px;
            }

            #nilspe-all-in-one .aio-phase-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 10px;
            }

            #nilspe-all-in-one .aio-phase-heading strong {
                font-weight: 500;
                font-size: 14px;
            }

            #nilspe-all-in-one .aio-phase-state {
                font-size: 12px;
                opacity: .8;
            }

            #nilspe-all-in-one .aio-phase-state.running {
                color: #8cb9ed;
            }

            #nilspe-all-in-one .aio-phase-state.done,
            #nilspe-all-in-one .aio-phase-state.skipped {
                color: #90cf90;
            }

            #nilspe-all-in-one .aio-phase-state.warning,
            #nilspe-all-in-one .aio-phase-state.stopped {
                color: #e7a05c;
            }

            #nilspe-all-in-one .aio-phase-track {
                height: 11px;
                overflow: hidden;
                background: #8883;
                border-radius: 6px;
            }

            #nilspe-all-in-one .aio-phase-fill {
                width: 0%;
                height: 100%;
                background: #3985d3;
                transition: width .13s linear;
            }

            #nilspe-all-in-one
            .aio-phase-card[data-phase="max"]
            .aio-phase-fill {
                background: #4eaa7b;
            }

            #nilspe-all-in-one
            .aio-phase-card[data-phase="crew"]
            .aio-phase-fill {
                background: #9574cb;
            }

            #nilspe-all-in-one .aio-phase-detail-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-top: 8px;
                font-size: 12px;
            }

            #nilspe-all-in-one .aio-phase-current {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                opacity: .75;
            }

            #nilspe-all-in-one .aio-phase-count {
                flex-shrink: 0;
                font-variant-numeric: tabular-nums;
            }

            #nilspe-all-in-one .aio-phase-eta {
                flex-shrink: 0;
                margin-left: auto;
                opacity: .8;
                font-variant-numeric: tabular-nums;
            }

            #nilspe-all-in-one .aio-preview-progress {
                height: 8px;
                width: 100%;
                background: #8883;
                border-radius: 4px;
                margin-top: 12px;
                overflow: hidden;
            }

            #nilspe-all-in-one .aio-preview-progress[hidden] {
                display: none;
            }

            #nilspe-all-in-one .aio-preview-fill {
                width: 0;
                height: 100%;
                background: #337ab7;
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

                #nilspe-all-in-one .aio-api-dashboard {
                    grid-template-columns: 1fr;
                }

                #nilspe-all-in-one .aio-extension {
                    grid-template-columns: 1fr;
                }

                #nilspe-all-in-one .aio-vehicle {
                    grid-template-columns: 1fr 1fr;
                }

                #nilspe-all-in-one .aio-phase-detail-row {
                    align-items: flex-start;
                    flex-direction: column;
                    gap: 4px;
                }
            }
        `;

        document.head.append(style);
    }

    // ====================================================
    // START
    // ====================================================

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
            console.error(
                '[LSS All in One]',
                error
            );

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

            link.href = PAGE_URL +
                (
                    buildingId
                        ? `&building=${buildingId}`
                        : ''
                );

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
        '[LSS All in One]',
        `Version ${VERSION} geladen`
    );
})();
