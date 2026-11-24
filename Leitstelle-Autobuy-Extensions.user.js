// ==UserScript==
// @name         Leitstelle Autobuy Extensions
// @namespace    NilsPe.autobuy.extensions
// @version      1.2.6
// @description  Erweiterungskauf mit individueller Reihenfolge und automatischer Nachprüfung
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Extensions.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Autobuy-Extensions.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/settings/index*
// @match        https://leitstellenspiel.de/buildings/*
// @match        https://leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';

    const VERSION = '1.2.6';
    const PREFIX = `[Autobuy Extensions ${VERSION}]`;
    const SETTINGS_IDENTIFIER = 'nilspe_autobuy_extensions';
    const EXTENSION_KEY_PREFIX = 'nilspe_abe_extensions_';
    const ORDER_KEY_PREFIX = 'nilspe_abe_order_';

    const ACTION_DELAY_KEY = 'nilspe_abe_action_delay';
    const BUILDING_DELAY_KEY = 'nilspe_abe_building_delay';
    const VERIFY_DELAY_KEY = 'nilspe_abe_verify_delay';
    const RETRY_ENABLED_KEY = 'nilspe_abe_retry_enabled';
    const RETRY_COUNT_KEY = 'nilspe_abe_retry_count';
    const RETRY_DELAY_KEY = 'nilspe_abe_retry_delay';
    const MANUAL_UPDATE_KEY = 'nilspe_abe_last_manual_building_update';

    const DEFAULT_ACTION_DELAY = 150;
    const DEFAULT_BUILDING_DELAY = 100;
    const DEFAULT_VERIFY_DELAY = 500;
    const DEFAULT_RETRY_COUNT = 2;
    const DEFAULT_RETRY_DELAY = 5000;

    let running = false;
    let cancelled = false;

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const log = (...args) => console.log(PREFIX, ...args);
    const warn = (...args) => console.warn(PREFIX, ...args);

    // =========================================================
    // GEBÄUDETYPEN
    // =========================================================

    const BUILDING_TYPES = [
        [0, 'Feuerwache'],
        [1, 'Feuerwehrschule'],
        [2, 'Rettungswache'],
        [3, 'Rettungsschule'],
        [4, 'Krankenhaus'],
        [5, 'Rettungshubschrauber-Station'],
        [6, 'Polizeiwache'],
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
        [28, 'Hubschrauberstation (Seenotrettung)']
    ].map(([id, label]) => ({ id, label }));

    function numberedOptions(label, ids) {
        return ids.map((id, index) => ({
            value: id,
            name: `${label} ${index + 1}`
        }));
    }

    const FIRE_EXTENSIONS = [
        { value: 0, name: 'Rettungsdienst' },
        ...numberedOptions('Abrollbehälter', [1, 2, 3, 4, 5, 7, 10, 11, 12, 17]),
        { value: 6, name: 'Wasserrettung' },
        { value: 8, name: 'Flughafen' },
        { value: 9, name: 'Großwache' },
        { value: 13, name: 'Werkfeuerwehr' },
        { value: 14, name: 'NEA50' },
        { value: 15, name: 'NEA200' },
        { value: 16, name: 'Lüfter' },
        { value: 18, name: 'Drohnen-Erweiterung' },
        { value: 19, name: 'Verpflegungsdienst' },
        ...numberedOptions('Anhänger-Stellplatz', [20, 21, 22, 23, 24]),
        { value: 25, name: 'Bahnrettung' }
    ];

    const POLICE_EXTENSIONS = [
        ...numberedOptions('Zelle', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
        { value: 10, name: 'Diensthundestaffel' },
        { value: 11, name: 'Kriminalpolizei' },
        { value: 12, name: 'Dienstgruppenleitung' },
        { value: 13, name: 'Motorradstaffel' },
        { value: 14, name: 'Großwache' },
        { value: 15, name: 'Großgewahrsam' }
    ];

    const KNOWN_EXTENSION_OPTIONS = new Map([
        [0, FIRE_EXTENSIONS],
        [18, FIRE_EXTENSIONS],
        [2, [{ value: 0, name: 'Großwache' }]],
        [20, [{ value: 0, name: 'Großwache' }]],

        [4, [
            { value: 0, name: 'Allgemeine Innere' },
            { value: 1, name: 'Allgemeine Chirurgie' },
            { value: 2, name: 'Gynäkologie' },
            { value: 3, name: 'Urologie' },
            { value: 4, name: 'Unfallchirurgie' },
            { value: 5, name: 'Neurologie' },
            { value: 6, name: 'Neurochirurgie' },
            { value: 7, name: 'Kardiologie' },
            { value: 8, name: 'Kardiochirurgie' },
            { value: 9, name: 'Großkrankenhaus' }
        ]],

        [6, POLICE_EXTENSIONS],
        [19, POLICE_EXTENSIONS],

        [11, [
            { value: 0, name: '2. Zug der Hundertschaft' },
            { value: 1, name: '3. Zug der Hundertschaft' },
            { value: 2, name: 'Sonderfahrzeug: Gefangenenkraftwagen' },
            { value: 3, name: 'Technischer Zug: Wasserwerfer' },
            { value: 4, name: 'SEK: 1. Zug' },
            { value: 5, name: 'SEK: 2. Zug' },
            { value: 6, name: 'MEK: 1. Zug' },
            { value: 7, name: 'MEK: 2. Zug' },
            { value: 8, name: 'Diensthundestaffel' },
            { value: 9, name: 'Reiterstaffel' },
            { value: 10, name: 'LauKW' }
        ]],

        [9, [
            { value: 0, name: '1. TZ: Fachgruppe Notversorgung/Notinstandsetzung' },
            { value: 1, name: '1. TZ: Zugtrupp' },
            { value: 2, name: 'Fachgruppe Räumen' },
            { value: 3, name: 'Fachgruppe Wassergefahren' },
            { value: 4, name: '2. TZ: Grundvoraussetzungen' },
            { value: 5, name: '2. TZ: Fachgruppe Notversorgung/Notinstandsetzung' },
            { value: 6, name: '2. TZ: Zugtrupp' },
            { value: 7, name: 'Fachgruppe Ortung' },
            { value: 8, name: 'Fachgruppe Wasserschaden/Pumpen' },
            { value: 9, name: 'Fachgruppe schwere Bergung' },
            { value: 10, name: 'Fachgruppe Elektroversorgung' },
            { value: 11, name: 'Ortsverbands-Mannschaftstransportwagen' },
            { value: 12, name: 'Trupp Unbemannte Luftfahrtsysteme' },
            { value: 13, name: 'Fachzug Führung und Kommunikation' }
        ]],

        [12, [
            { value: 0, name: 'Führung' },
            { value: 1, name: 'Sanitätsdienst' },
            { value: 2, name: 'Wasserrettungs-Erweiterung' },
            { value: 3, name: 'Rettungshundestaffel' },
            { value: 4, name: 'SEG Drohne' },
            { value: 5, name: 'Betreuungs- und Verpflegungsdienst' },
            { value: 6, name: 'Technik und Sicherheit' }
        ]]
    ]);

    // =========================================================
    // EINSTELLUNGEN UND SPEICHER
    // =========================================================

    function extensionKey(type) {
        return `${EXTENSION_KEY_PREFIX}${type}`;
    }

    function orderKey(type) {
        return `${ORDER_KEY_PREFIX}${type}`;
    }

    function parseJsonArray(value) {
        let parsed = value;

        if (!Array.isArray(parsed)) {
            try {
                parsed = JSON.parse(value);
            } catch {
                return [];
            }
        }

        if (!Array.isArray(parsed)) return [];

        return [...new Set(
            parsed
                .filter(value => value !== '' && value != null)
                .map(Number)
                .filter(id => Number.isInteger(id) && id >= 0)
        )];
    }

    async function selectedExtensionIds(type) {
        const selected = parseJsonArray(
            await GM.getValue(extensionKey(type), '[]')
        );

        const order = parseJsonArray(
            await GM.getValue(orderKey(type), '[]')
        );

        const selectedSet = new Set(selected);

        return [...new Set([...order, ...selected])]
            .filter(id => selectedSet.has(id));
    }

    async function loadEditorState(type, options) {
        const selected = await selectedExtensionIds(type);

        const storedOrder = parseJsonArray(
            await GM.getValue(orderKey(type), '[]')
        );

        const availableIds = options.map(option => Number(option.value));

        return {
            order: [...new Set([...storedOrder, ...selected, ...availableIds])],
            selected: new Set(selected)
        };
    }

    async function saveEditorState(type, order, selected) {
        await GM.setValue(orderKey(type), JSON.stringify(order));

        await GM.setValue(
            extensionKey(type),
            JSON.stringify(order.filter(id => selected.has(id)))
        );
    }

    async function numberSetting(key, fallback, min, max) {
        const value = Number(await GM.getValue(key, fallback));

        return Number.isFinite(value)
            ? Math.min(max, Math.max(min, Math.floor(value)))
            : fallback;
    }

    async function configuredDelays() {
        const retryEnabled = await GM.getValue(RETRY_ENABLED_KEY, true);

        return {
            action: await numberSetting(
                ACTION_DELAY_KEY, DEFAULT_ACTION_DELAY, 0, 5000
            ),

            building: await numberSetting(
                BUILDING_DELAY_KEY, DEFAULT_BUILDING_DELAY, 0, 5000
            ),

            verify: await numberSetting(
                VERIFY_DELAY_KEY, DEFAULT_VERIFY_DELAY, 0, 10000
            ),

            retryEnabled:
                retryEnabled === true ||
                retryEnabled === 'true' ||
                retryEnabled === 1 ||
                retryEnabled === '1',

            retryCount: await numberSetting(
                RETRY_COUNT_KEY, DEFAULT_RETRY_COUNT, 0, 3
            ),

            retryDelay: await numberSetting(
                RETRY_DELAY_KEY, DEFAULT_RETRY_DELAY, 1000, 60000
            )
        };
    }

    // =========================================================
    // GEBÄUDE-CACHE
    // =========================================================

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

            leitstelle_building_id:
                dispatchCenterId == null ? null : Number(dispatchCenterId),

            caption:
                building.caption ||
                building.name ||
                `Gebäude ${building.id}`,

            extensions: Array.isArray(building.extensions)
                ? building.extensions
                : []
        };
    }

    async function openCurrentBuildingCache(maxAge = 60) {
        if (
            typeof openDb !== 'function' ||
            typeof updateBuildings !== 'function'
        ) {
            throw new Error('NilsPe-Skriptbasis wurde nicht geladen.');
        }

        const db = await openDb();

        try {
            const updated = await updateBuildings(db, maxAge);
            const count = await getCount(db, 'buildings');

            if (!count) {
                throw new Error('Keine Gebäude im API-Cache vorhanden.');
            }

            if (updated === false) {
                warn('Gebäude-Cache wird verwendet.');
            }

            return db;

        } catch (error) {
            db.close();
            throw error;
        }
    }

    async function buildingById(id) {
        const db = await openCurrentBuildingCache();

        try {
            const building = await getData(db, 'buildings', Number(id));

            return building ? normalizeBuilding(building) : null;

        } finally {
            db.close();
        }
    }

    async function buildingsForDispatchCenter(id) {
        const db = await openCurrentBuildingCache();

        try {
            const buildings = await getAllData(db, 'buildings');

            return buildings
                .map(normalizeBuilding)
                .filter(building =>
                    building.leitstelle_building_id === Number(id)
                )
                .sort((a, b) => a.id - b.id);

        } finally {
            db.close();
        }
    }

    async function extensionOptionsByBuildingType() {
        const db = await openCurrentBuildingCache();

        try {
            const buildings = (
                await getAllData(db, 'buildings')
            ).map(normalizeBuilding);

            const optionsByType = new Map();

            for (const building of buildings) {
                if (!optionsByType.has(building.building_type)) {
                    optionsByType.set(building.building_type, new Map());
                }

                const options = optionsByType.get(building.building_type);

                for (const extension of building.extensions) {
                    if (extension.type_id == null) continue;

                    const id = Number(extension.type_id);

                    if (Number.isInteger(id) && id >= 0 && !options.has(id)) {
                        options.set(id, {
                            value: id,
                            name: extension.caption || `Erweiterung ${id}`
                        });
                    }
                }
            }

            return new Map(
                [...optionsByType].map(([type, options]) => [
                    type, [...options.values()]
                ])
            );

        } finally {
            db.close();
        }
    }

    function mergedExtensionOptions(type, discovered = []) {
        const merged = new Map();

        for (const option of KNOWN_EXTENSION_OPTIONS.get(type) ?? []) {
            merged.set(Number(option.value), option);
        }

        for (const option of discovered) {
            const id = Number(option.value);

            if (!merged.has(id)) merged.set(id, option);
        }

        return [...merged.values()].sort(
            (a, b) => Number(a.value) - Number(b.value)
        );
    }

    function extensionName(type, id) {
        return KNOWN_EXTENSION_OPTIONS
            .get(type)
            ?.find(option => Number(option.value) === Number(id))
            ?.name ?? `Erweiterung ${id}`;
    }

    function buildingTypeName(type) {
        return BUILDING_TYPES
            .find(entry => entry.id === type)
            ?.label ?? `Gebäudetyp ${type}`;
    }

    // =========================================================
    // EINSTELLUNGSOBERFLÄCHE
    // =========================================================

    function makeButton(text, handler, className = 'btn-default') {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = `btn ${className} btn-xs`;
        button.textContent = text;
        button.addEventListener('click', handler);

        return button;
    }

    function installSettingsStyles() {
        if (document.getElementById('nilspe-abe-settings-style')) return;

        const style = document.createElement('style');
        style.id = 'nilspe-abe-settings-style';

        style.textContent = `
            .nilspe-abe-type-panel {
                margin-bottom: 7px;
                border: 1px solid #8885;
                border-radius: 4px;
            }

            .nilspe-abe-type-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 9px 12px;
                cursor: pointer;
                background: #8882;
            }

            .nilspe-abe-type-body {
                padding: 10px;
            }

            .nilspe-abe-toolbar {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 5px;
                margin-bottom: 8px;
            }

            .nilspe-abe-order-row {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 6px 8px;
                margin-bottom: 3px;
                border: 1px solid #8885;
                border-radius: 3px;
                background: #8881;
            }

            .nilspe-abe-order-row.is-selected {
                background: rgba(92, 184, 92, .10);
                border-color: rgba(92, 184, 92, .35);
            }

            .nilspe-abe-order-row.is-inactive {
                background: #8881;
            }

            .nilspe-abe-order-row.is-inactive
            .nilspe-abe-extension-name {
                opacity: .60;
            }

            .nilspe-abe-order-row:hover {
                background: #8883;
            }

            .nilspe-abe-order-row.dragging {
                opacity: .35;
            }

            .nilspe-abe-order-row.drag-over {
                border-top: 2px solid #5cb85c;
            }

            .nilspe-abe-drag {
                cursor: grab;
                font-size: 16px;
                opacity: .65;
                user-select: none;
            }

            .nilspe-abe-position {
                width: 28px;
                text-align: right;
                opacity: .75;
            }

            .nilspe-abe-extension-name {
                flex: 1;
                cursor: pointer;
            }

            .nilspe-abe-toggle {
                width: 30px;
                min-width: 30px;
                font-weight: bold;
            }

            .nilspe-abe-arrow {
                width: 26px;
                min-width: 26px;
            }

            .nilspe-abe-save-status {
                font-size: 11px;
                margin-left: auto;
                opacity: .7;
            }

            .nilspe-abe-flow-setting {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
                padding: 8px 10px;
                border-bottom: 1px solid #8883;
            }

            .nilspe-abe-flow-setting input[type="number"] {
                width: 130px;
            }

            .nilspe-abe-flow-setting input[type="checkbox"] {
                width: 17px;
                height: 17px;
            }

            .nilspe-abe-api-panel {
                border: 1px solid #8885;
                border-radius: 4px;
                margin-bottom: 15px;
            }

            .nilspe-abe-api-header {
                padding: 9px 12px;
                background: #8882;
                font-weight: bold;
            }

            .nilspe-abe-api-body {
                padding: 10px;
            }

            .nilspe-abe-api-actions {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                padding-top: 12px;
            }

            .nilspe-abe-api-message {
                font-size: 12px;
            }
        `;

        document.head.append(style);
    }

    async function createOrderEditor(parent, type, options) {
        const state = await loadEditorState(type.id, options);

        let order = state.order;
        let selected = state.selected;
        let draggedIndex = null;
        let saveQueue = Promise.resolve();

        const optionMap = new Map(
            options.map(option => [Number(option.value), option.name])
        );

        for (const id of order) {
            if (!optionMap.has(id)) {
                optionMap.set(id, `Erweiterung ${id}`);
            }
        }

        const panel = document.createElement('details');
        panel.className = 'nilspe-abe-type-panel';

        const header = document.createElement('summary');
        header.className = 'nilspe-abe-type-header';

        const heading = document.createElement('strong');
        heading.textContent = `${type.id} – ${type.label}`;

        const countLabel = document.createElement('span');
        countLabel.className = 'label label-default';

        header.append(heading, countLabel);

        const body = document.createElement('div');
        body.className = 'nilspe-abe-type-body';

        const toolbar = document.createElement('div');
        toolbar.className = 'nilspe-abe-toolbar';

        const list = document.createElement('div');

        const status = document.createElement('span');
        status.className = 'nilspe-abe-save-status';

        function persist() {
            const orderSnapshot = [...order];
            const selectedSnapshot = new Set(selected);

            status.textContent = 'Speichere...';

            saveQueue = saveQueue
                .catch(() => {})
                .then(() => saveEditorState(
                    type.id, orderSnapshot, selectedSnapshot
                ))
                .then(() => {
                    status.textContent = 'Gespeichert';
                })
                .catch(error => {
                    status.textContent = 'Speicherfehler';
                    console.error(PREFIX, error);
                });

            return saveQueue;
        }

        function move(from, to) {
            if (
                from === to ||
                from < 0 ||
                to < 0 ||
                from >= order.length ||
                to >= order.length
            ) return;

            const [item] = order.splice(from, 1);
            order.splice(to, 0, item);

            render();
            void persist();
        }

        function toggle(id) {
            if (selected.has(id)) {
                selected.delete(id);
            } else {
                selected.add(id);
            }

            render();
            void persist();
        }

        toolbar.append(
            makeButton('Alle auswählen', () => {
                selected = new Set(order);
                render();
                void persist();
            }, 'btn-success'),

            makeButton('Alle abwählen', () => {
                selected.clear();
                render();
                void persist();
            }, 'btn-danger'),

            makeButton('Nach ID sortieren', () => {
                order.sort((a, b) => a - b);
                render();
                void persist();
            }),

            status
        );

        function render() {
            countLabel.textContent =
                `${selected.size} / ${order.length} ausgewählt`;

            countLabel.className = selected.size
                ? 'label label-success'
                : 'label label-default';

            list.replaceChildren();

            if (order.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-muted';
                empty.textContent = 'Keine Erweiterungen bekannt.';
                list.append(empty);
                return;
            }

            let activePosition = 0;

            order.forEach((id, index) => {
                const active = selected.has(id);

                if (active) activePosition++;

                const row = document.createElement('div');

                row.className = 'nilspe-abe-order-row ' +
                    (active ? 'is-selected' : 'is-inactive');

                row.draggable = true;

                const drag = document.createElement('span');
                drag.className = 'nilspe-abe-drag';
                drag.textContent = '⠿';
                drag.title = 'Zum Verschieben ziehen';

                const position = document.createElement('span');
                position.className = 'nilspe-abe-position';
                position.textContent = active ? `${activePosition}.` : '–';

                const name = document.createElement('span');
                name.className = 'nilspe-abe-extension-name';
                name.textContent = `${optionMap.get(id)} (${id})`;

                name.title = active
                    ? 'Erweiterung abwählen'
                    : 'Erweiterung auswählen';

                name.addEventListener('click', () => toggle(id));

                const toggleButton = makeButton(
                    active ? '✕' : '✓',
                    () => toggle(id),
                    active ? 'btn-danger' : 'btn-success'
                );

                toggleButton.classList.add('nilspe-abe-toggle');

                toggleButton.title = active
                    ? 'Erweiterung aus der Kaufliste entfernen'
                    : 'Erweiterung zur Kaufliste hinzufügen';

                const up = makeButton('▲', () => move(index, index - 1));
                const down = makeButton('▼', () => move(index, index + 1));

                up.classList.add('nilspe-abe-arrow');
                down.classList.add('nilspe-abe-arrow');

                up.disabled = index === 0;
                down.disabled = index === order.length - 1;

                row.addEventListener('dragstart', event => {
                    draggedIndex = index;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                    row.classList.add('dragging');
                });

                row.addEventListener('dragover', event => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    row.classList.add('drag-over');
                });

                row.addEventListener('dragleave', () => {
                    row.classList.remove('drag-over');
                });

                row.addEventListener('drop', event => {
                    event.preventDefault();
                    row.classList.remove('drag-over');

                    if (draggedIndex !== null) {
                        move(draggedIndex, index);
                    }

                    draggedIndex = null;
                });

                row.addEventListener('dragend', () => {
                    draggedIndex = null;

                    for (const element of list.children) {
                        element.classList.remove('dragging', 'drag-over');
                    }
                });

                row.append(drag, position, name, toggleButton, up, down);
                list.append(row);
            });
        }

        body.append(toolbar, list);
        panel.append(header, body);
        parent.append(panel);

        render();
    }

    async function addNumberSetting(parent, key, label, fallback, min, max) {
        const row = document.createElement('div');
        row.className = 'nilspe-abe-flow-setting';

        const text = document.createElement('label');
        text.textContent = label;

        const input = document.createElement('input');

        input.type = 'number';
        input.className = 'form-control input-sm';
        input.min = String(min);
        input.max = String(max);
        input.step = '1';

        input.value = String(
            await numberSetting(key, fallback, min, max)
        );

        input.addEventListener('change', async () => {
            const raw = Number(input.value);

            const value = Number.isFinite(raw)
                ? Math.min(max, Math.max(min, Math.floor(raw)))
                : fallback;

            input.value = String(value);

            await GM.setValue(key, value);
        });

        row.append(text, input);
        parent.append(row);
    }

    async function addCheckboxSetting(parent, key, label, fallback) {
        const row = document.createElement('label');
        row.className = 'nilspe-abe-flow-setting';

        const text = document.createElement('span');
        text.textContent = label;

        const input = document.createElement('input');
        input.type = 'checkbox';

        const stored = await GM.getValue(key, fallback);

        input.checked =
            stored === true ||
            stored === 'true' ||
            stored === 1 ||
            stored === '1';

        input.addEventListener('change', async () => {
            await GM.setValue(key, input.checked);
        });

        row.append(text, input);
        parent.append(row);
    }

    // =========================================================
    // API-VERWALTUNG
    // =========================================================

    async function createApiManagement(parent) {
        const title = document.createElement('h2');
        title.textContent = 'API-Verwaltung';

        const panel = document.createElement('div');
        panel.className = 'nilspe-abe-api-panel';

        const header = document.createElement('div');
        header.className = 'nilspe-abe-api-header';
        header.textContent = 'Gebäude-API';

        const body = document.createElement('div');
        body.className = 'nilspe-abe-api-body';

        function addInfoRow(label) {
            const row = document.createElement('div');
            row.className = 'nilspe-abe-flow-setting';

            const name = document.createElement('span');
            name.textContent = label;

            const value = document.createElement('strong');
            value.textContent = '–';

            row.append(name, value);
            body.append(row);

            return value;
        }

        const cacheStatus = addInfoRow('Cache-Status');
        const buildingCount = addInfoRow('Gespeicherte Gebäude');
        const lastUpdate = addInfoRow('Letzte manuelle Aktualisierung');

        const actions = document.createElement('div');
        actions.className = 'nilspe-abe-api-actions';

        const message = document.createElement('span');
        message.className = 'nilspe-abe-api-message';

        const description = document.createElement('p');
        description.className = 'text-muted';
        description.style.marginTop = '10px';

        description.textContent =
            'Die Gebäude-API wird weiterhin automatisch aktualisiert. ' +
            'Über diesen Button kann zusätzlich eine manuelle Aktualisierung ' +
            'unabhängig vom normalen Cache-Intervall gestartet werden.';

        async function refreshStatus() {
            let db;

            try {
                db = await openDb();

                const count = await getCount(db, 'buildings');

                cacheStatus.textContent = count
                    ? 'Vorhanden'
                    : 'Leer';

                cacheStatus.className = count
                    ? 'text-success'
                    : 'text-warning';

                buildingCount.textContent =
                    Number(count || 0).toLocaleString('de-DE');

                const timestamp = Number(
                    await GM.getValue(MANUAL_UPDATE_KEY, 0)
                );

                lastUpdate.textContent = timestamp > 0
                    ? new Date(timestamp).toLocaleString('de-DE')
                    : 'Noch nicht manuell aktualisiert';

            } catch (error) {
                cacheStatus.textContent = 'Nicht verfügbar';
                cacheStatus.className = 'text-danger';
                buildingCount.textContent = '–';

                warn('API-Status konnte nicht geladen werden.', error);

            } finally {
                if (db) db.close();
            }
        }

        const updateButton = makeButton(
            'Gebäude-API jetzt aktualisieren',

            async () => {
                if (updateButton.disabled) return;

                updateButton.disabled = true;
                updateButton.textContent = 'Gebäude-API wird geladen...';

                message.className = 'nilspe-abe-api-message text-info';
                message.textContent = 'Aktualisierung läuft...';

                let db;

                try {
                    if (
                        typeof openDb !== 'function' ||
                        typeof updateBuildings !== 'function'
                    ) {
                        throw new Error('NilsPe-Skriptbasis fehlt.');
                    }

                    db = await openDb();

                    const updated = await updateBuildings(db, 0);

                    if (updated === false) {
                        throw new Error(
                            'Aktualisierung nicht bestätigt. Cache wird weiterverwendet.'
                        );
                    }

                    const count = await getCount(db, 'buildings');

                    if (!count) {
                        throw new Error('Keine Gebäude im API-Cache vorhanden.');
                    }

                    await GM.setValue(MANUAL_UPDATE_KEY, Date.now());

                    message.className =
                        'nilspe-abe-api-message text-success';

                    message.textContent =
                        `Aktualisierung erfolgreich – ` +
                        `${Number(count).toLocaleString('de-DE')} Gebäude.`;

                    log('Gebäude-API manuell aktualisiert:', count);

                } catch (error) {
                    message.className =
                        'nilspe-abe-api-message text-danger';

                    message.textContent =
                        `Aktualisierung fehlgeschlagen: ${error.message}`;

                    console.error(PREFIX, error);

                } finally {
                    if (db) db.close();

                    await refreshStatus();

                    updateButton.disabled = false;
                    updateButton.textContent = 'Gebäude-API jetzt aktualisieren';
                }
            },

            'btn-primary'
        );

        actions.append(updateButton, message);
        body.append(actions, description);
        panel.append(header, body);
        parent.append(title, panel);

        await refreshStatus();
    }

    // =========================================================
    // EINSTELLUNGSSEITE
    // =========================================================

    async function createSettings() {
        if (
            typeof waitForSettingsDom !== 'function' ||
            typeof createSettingsPane !== 'function'
        ) {
            console.error(PREFIX, 'NilsPe-Skriptbasis fehlt.');
            return;
        }

        if (!await waitForSettingsDom()) return;

        installSettingsStyles();

        const { anchor, body } = createSettingsPane(
            SETTINGS_IDENTIFIER, 'Autobuy Extensions'
        );

        let renderPromise = null;

        async function renderSettings() {
            if (renderPromise) return renderPromise;

            renderPromise = (async () => {
                body.replaceChildren();

                const title = document.createElement('h2');
                title.textContent = 'Ausbaureihenfolge';

                const description = document.createElement('p');

                description.textContent =
                    'Grüner Haken = hinzufügen. Rotes X = entfernen. ' +
                    'Grün hinterlegte Erweiterungen werden gekauft. ' +
                    'Die Reihenfolge wird per Drag & Drop oder ' +
                    'über die Pfeile festgelegt.';

                body.append(title, description);

                let discovered = new Map();

                try {
                    discovered = await extensionOptionsByBuildingType();

                } catch (error) {
                    warn(
                        'API-Erweiterungen konnten nicht geladen werden.',
                        error
                    );
                }

                const allTypes = new Map(
                    BUILDING_TYPES.map(type => [type.id, type])
                );

                for (const type of discovered.keys()) {
                    if (!allTypes.has(type) && type !== 7) {
                        allTypes.set(type, {
                            id: type,
                            label: `Gebäudetyp ${type}`
                        });
                    }
                }

                for (const type of [...allTypes.values()]
                    .sort((a, b) => a.id - b.id)) {

                    const options = mergedExtensionOptions(
                        type.id, discovered.get(type.id) ?? []
                    );

                    await createOrderEditor(body, type, options);
                }

                const flowTitle = document.createElement('h2');
                flowTitle.textContent = 'Ablauf';

                const flowDescription = document.createElement('p');
                flowDescription.className = 'text-muted';

                flowDescription.textContent =
                    'Alle Kaufanfragen werden nacheinander ausgeführt. ' +
                    'Nach jeder Kaufrunde wird die Erweiterungstabelle ' +
                    'erneut geladen und geprüft.';

                body.append(flowTitle, flowDescription);

                await addNumberSetting(
                    body, ACTION_DELAY_KEY,
                    'Pause nach einem Kauf [ms]',
                    DEFAULT_ACTION_DELAY, 0, 5000
                );

                await addNumberSetting(
                    body, BUILDING_DELAY_KEY,
                    'Pause zwischen Gebäuden [ms]',
                    DEFAULT_BUILDING_DELAY, 0, 5000
                );

                await addNumberSetting(
                    body, VERIFY_DELAY_KEY,
                    'Wartezeit vor Kaufbestätigung [ms]',
                    DEFAULT_VERIFY_DELAY, 0, 10000
                );

                const retryTitle = document.createElement('h2');
                retryTitle.textContent = 'Automatische Nachprüfung';

                const retryDescription = document.createElement('p');
                retryDescription.className = 'text-muted';

                retryDescription.textContent =
                    'Nur Gebäude mit fehlgeschlagenen Kaufanfragen oder ' +
                    'weiterhin vorhandenen Kaufbuttons werden nachgeprüft. ' +
                    'Nicht verfügbare Erweiterungen lösen keine Nachprüfung aus.';

                body.append(retryTitle, retryDescription);

                await addCheckboxSetting(
                    body, RETRY_ENABLED_KEY,
                    'Fehlerhafte Käufe automatisch nachprüfen',
                    true
                );

                await addNumberSetting(
                    body, RETRY_COUNT_KEY,
                    'Maximale Nachprüfungen',
                    DEFAULT_RETRY_COUNT, 0, 3
                );

                await addNumberSetting(
                    body, RETRY_DELAY_KEY,
                    'Wartezeit vor Nachprüfung [ms]',
                    DEFAULT_RETRY_DELAY, 1000, 60000
                );

                await createApiManagement(body);

            })().catch(error => {
                renderPromise = null;
                console.error(PREFIX, error);
                throw error;
            });

            return renderPromise;
        }

        anchor.addEventListener('click', () => {
            void renderSettings().catch(console.error);
        });

        if (location.hash === `#${SETTINGS_IDENTIFIER}`) {
            await renderSettings();
            anchor.click();
        }
    }

    // =========================================================
    // ERWEITERUNGSTABELLE
    // =========================================================

    function buildingIdFromLocation() {
        const match = location.pathname.match(/^\/buildings\/(\d+)/);

        return match ? Number(match[1]) : null;
    }

    function csrfToken() {
        return document.querySelector(
            'meta[name="csrf-token"]'
        )?.content ?? '';
    }

    function extensionTableUrl(dispatchCenterId) {
        const tab = document.querySelector('a[href="#tab_extensions"][url]');

        return new URL(
            tab?.getAttribute('url') ||
            `/buildings/${dispatchCenterId}/leitstelle-extensions`,
            location.origin
        ).href;
    }

    async function fetchHtml(url) {
        const target = new URL(url, location.origin);

        if (target.origin !== location.origin) {
            throw new Error('Ungültige Anfrage-URL.');
        }

        const response = await fetch(target.href, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                Accept: 'text/html, */*'
            }
        });

        if (!response.ok) {
            const error = new Error(
                `Tabellenabruf: HTTP ${response.status}`
            );

            error.status = response.status;

            throw error;
        }

        if (
            response.redirected &&
            /\/(users\/sign_in|login)/.test(response.url)
        ) {
            const error = new Error('Anmeldung erforderlich.');
            error.status = 401;
            throw error;
        }

        const html = await response.text();

        const doc = new DOMParser().parseFromString(html, 'text/html');

        if (doc.querySelector('input[type="password"]')) {
            const error = new Error(
                'Anmeldeseite statt Erweiterungstabelle erhalten.'
            );

            error.status = 401;

            throw error;
        }

        return doc;
    }

    function purchasesFromDocument(doc) {
        const purchases = new Map();

        for (const link of doc.querySelectorAll(
            'a[href*="/extension/credits/"]'
        )) {
            const href = link.getAttribute('href');

            if (!href) continue;

            const url = new URL(href, location.origin);

            if (url.origin !== location.origin) continue;

            const match = url.pathname.match(
                /^\/buildings\/(\d+)\/extension\/credits\/(\d+)\/?$/
            );

            if (!match) continue;

            if (
                link.classList.contains('disabled') ||
                link.getAttribute('aria-disabled') === 'true' ||
                link.hasAttribute('disabled')
            ) continue;

            const buildingId = Number(match[1]);
            const extensionId = Number(match[2]);

            if (!purchases.has(buildingId)) {
                purchases.set(buildingId, new Map());
            }

            purchases.get(buildingId).set(extensionId, url.href);
        }

        return purchases;
    }

    async function loadPurchaseTable(context) {
        const url = context.dispatchCenterId !== null
            ? extensionTableUrl(context.dispatchCenterId)
            : `/buildings/${context.buildingId}`;

        const doc = await fetchHtml(url);

        if (!doc.querySelector('table')) {
            throw new Error(
                'Keine Erweiterungstabelle in der Antwort gefunden.'
            );
        }

        const purchases = purchasesFromDocument(doc);

        log('Erweiterungstabelle geladen:', {
            buildings: purchases.size,
            availablePurchases: [...purchases.values()]
                .reduce((sum, map) => sum + map.size, 0)
        });

        return purchases;
    }

    // =========================================================
    // KAUFANFRAGEN
    // =========================================================

    async function buyExtension(url) {
        const token = csrfToken();

        if (!token) {
            const error = new Error('CSRF-Token wurde nicht gefunden.');
            error.status = 403;
            throw error;
        }

        const target = new URL(url, location.origin);

        if (
            target.origin !== location.origin ||
            !/^\/buildings\/\d+\/extension\/credits\/\d+\/?$/
                .test(target.pathname)
        ) {
            throw new Error('Ungültiger Erweiterungs-Kaufpfad.');
        }

        const response = await fetch(target.href, {
            method: 'POST',
            credentials: 'same-origin',

            headers: {
                'Content-Type':
                    'application/x-www-form-urlencoded; charset=UTF-8',

                'X-CSRF-Token': token,
                'X-Requested-With': 'XMLHttpRequest'
            },

            body: new URLSearchParams({
                _method: 'post',
                authenticity_token: token
            }),

            redirect: 'manual'
        });

        if (response.type === 'opaqueredirect') return;

        if (!response.ok) {
            const error = new Error(`Kauf: HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
    }

    // =========================================================
    // FORTSCHRITTSANZEIGE
    // =========================================================

    function ensureProgressBar() {
        if (document.getElementById('nilspe-abe-progress')) return;

        const style = document.createElement('style');
        style.id = 'nilspe-abe-style';

        style.textContent = `
            #nilspe-abe-progress {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 2147483000;
                padding: 9px 12px;
                border-top: 1px solid #888;
                background: #333;
                color: #fff;
            }

            #nilspe-abe-progress-row {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }

            #nilspe-abe-statistics {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                margin-top: 6px;
                font-size: 12px;
            }

            #nilspe-abe-track {
                height: 12px;
                margin-top: 6px;
                overflow: hidden;
                border-radius: 4px;
                background: #777;
            }

            #nilspe-abe-fill {
                height: 100%;
                width: 0;
                background: #5cb85c;
                transition: width .15s;
            }
        `;

        document.head.append(style);

        const container = document.createElement('div');
        container.id = 'nilspe-abe-progress';

        const row = document.createElement('div');
        row.id = 'nilspe-abe-progress-row';

        const status = document.createElement('span');
        status.id = 'nilspe-abe-status';
        status.className = 'label label-info';
        status.textContent = 'Bereit';

        const stop = makeButton('Abbrechen', () => {
            cancelled = true;
            stop.disabled = true;

            status.textContent =
                'Abbruch – laufende Anfrage wird beendet...';

        }, 'btn-danger');

        stop.id = 'nilspe-abe-stop';

        const close = makeButton('Schließen', () => {
            if (!running) {
                container.remove();
                style.remove();
            }
        });

        close.id = 'nilspe-abe-close';

        row.append(stop, status, close);

        const statistics = document.createElement('div');
        statistics.id = 'nilspe-abe-statistics';

        const track = document.createElement('div');
        track.id = 'nilspe-abe-track';

        const fill = document.createElement('div');
        fill.id = 'nilspe-abe-fill';

        track.append(fill);
        container.append(row, statistics, track);
        document.body.append(container);
    }

    function setProgress(message, completed = 0, total = 0, style = 'info') {
        ensureProgressBar();

        const status = document.getElementById('nilspe-abe-status');
        const fill = document.getElementById('nilspe-abe-fill');

        status.className = `label label-${style}`;
        status.textContent = message;

        fill.style.width = total > 0
            ? `${Math.min(100, completed / total * 100)}%`
            : '0%';
    }

    function updateStatistics(state) {
        const element = document.getElementById('nilspe-abe-statistics');

        if (!element) return;

        const format = value => Number(value).toLocaleString('de-DE');

        const entries = [
            `Gekaufte Erweiterungen: ${format(state.confirmed.size)}`,
            `Fehler: ${format(state.errors)}`,
            `Nachbearbeitung: ${format(state.recovered.size)}/${format(state.retryTargets.size)}`
        ];

        element.replaceChildren();

        for (const entry of entries) {
            const span = document.createElement('span');
            span.textContent = entry;
            element.append(span);
        }
    }

    // =========================================================
    // KAUFVERWALTUNG
    // =========================================================

    function taskKey(buildingId, extensionId) {
        return `${buildingId}:${extensionId}`;
    }

    function markPending(state, building, extensionId, reason) {
        state.pending.set(building.id, building);
        state.retryTargets.add(building.id);

        if (!state.reasons.has(building.id)) {
            state.reasons.set(building.id, new Map());
        }

        state.reasons.get(building.id).set(extensionId, reason);
    }

    function clearPending(state, buildingId) {
        state.pending.delete(buildingId);
        state.reasons.delete(buildingId);
    }

    function clearPendingExtension(state, buildingId, extensionId) {
        const reasons = state.reasons.get(buildingId);

        if (!reasons) return;

        reasons.delete(extensionId);

        if (reasons.size === 0) {
            clearPending(state, buildingId);
        }
    }

    function cachedExtensionExists(building, extensionId) {
        return building.extensions.some(extension =>
            extension.type_id != null &&
            Number(extension.type_id) === extensionId
        );
    }

    function markConfirmed(state, buildingId, extensionId) {
        const key = taskKey(buildingId, extensionId);

        state.confirmed.add(key);
        state.skipped.delete(key);
        state.unavailable.delete(key);

        clearPendingExtension(state, buildingId, extensionId);
    }

    function markSkipped(state, buildingId, extensionId) {
        const key = taskKey(buildingId, extensionId);

        state.unavailable.delete(key);

        if (!state.confirmed.has(key)) {
            state.skipped.add(key);
        }
    }

    function markUnavailable(state, buildingId, extensionId) {
        const key = taskKey(buildingId, extensionId);

        if (
            !state.confirmed.has(key) &&
            !state.skipped.has(key)
        ) {
            state.unavailable.add(key);
        }
    }

    // =========================================================
    // FEHLERPROTOKOLLIERUNG
    // =========================================================

    function recordError(
        state,
        category,
        phase,
        building,
        extensionId,
        reason,
        status = null
    ) {
        state.errors++;

        if (category === 'HTTP') {
            state.httpErrors++;
        } else if (category === 'BESTÄTIGUNG') {
            state.verificationErrors++;
        } else {
            state.otherErrors++;
        }

        const entry = {
            Zeitpunkt: new Date().toLocaleTimeString('de-DE'),
            Phase: phase,
            Kategorie: category,
            Gebäude: building?.caption ?? '–',
            GebäudeID: building?.id ?? '–',
            Erweiterung: extensionId >= 0 && building
                ? extensionName(building.building_type, extensionId)
                : '–',
            ErweiterungsID: extensionId,
            HTTP: status ?? '–',
            Fehler: reason
        };

        state.errorDetails.push(entry);

        warn(`[${phase}] [${category}]`, entry);

        updateStatistics(state);
    }

    function recordRequestError(
        state,
        phase,
        building,
        extensionId,
        error
    ) {
        recordError(
            state,
            Number.isInteger(error.status) ? 'HTTP' : 'ANFRAGE',
            phase,
            building,
            extensionId,
            error.message,
            error.status ?? null
        );
    }

    async function cancellableSleep(ms) {
        let remaining = ms;

        while (remaining > 0 && !cancelled) {
            const interval = Math.min(remaining, 250);

            await sleep(interval);

            remaining -= interval;
        }
    }

    function isFatalPurchaseError(error) {
        return [401, 403, 429, 503].includes(error.status);
    }

    // =========================================================
    // HAUPTDURCHLAUF
    // =========================================================

    async function runMainPass(
        groups, selectedByType, context, delays, state
    ) {
        let purchases = await loadPurchaseTable(context);

        const blocked = new Set();

        for (const [type, buildings] of groups) {
            if (cancelled) break;

            const selected = selectedByType.get(type);

            for (let round = 0; round < selected.length; round++) {
                if (cancelled) break;

                const extensionId = selected[round];
                const name = extensionName(type, extensionId);
                const tasks = [];

                for (const building of buildings) {
                    if (blocked.has(building.id)) {
                        state.completedSteps++;
                        continue;
                    }

                    const url = purchases.get(building.id)?.get(extensionId);

                    if (!url) {
                        if (cachedExtensionExists(building, extensionId)) {
                            markSkipped(
                                state,
                                building.id,
                                extensionId
                            );

                        } else {
                            markUnavailable(
                                state,
                                building.id,
                                extensionId
                            );
                        }

                        state.completedSteps++;
                        continue;
                    }

                    tasks.push({
                        building,
                        extensionId,
                        url
                    });
                }

                let roundCompleted = 0;

                const submitted = [];

                const roundLabel =
                    `${buildingTypeName(type)} | ` +
                    `${round + 1}/${selected.length} | ${name}`;

                setProgress(
                    `${roundLabel} | 0/${tasks.length}`,
                    state.completedSteps,
                    state.totalSteps
                );

                updateStatistics(state);

                log('Kaufrunde:', {
                    type,
                    extensionId,
                    name,
                    round: round + 1,
                    tasks: tasks.length,
                    parallel: false
                });

                if (tasks.length === 0) {
                    continue;
                }

                // =============================================
                // SEQUENZIELLE KAUFANFRAGEN
                // Immer nur eine aktive Kaufanfrage.
                // =============================================

                let fatalError = null;

                for (const task of tasks) {
                    if (cancelled) break;

                    try {
                        await buyExtension(task.url);

                        submitted.push(task);

                    } catch (error) {
                        blocked.add(task.building.id);

                        markPending(
                            state,
                            task.building,
                            task.extensionId,
                            error.message
                        );

                        recordRequestError(
                            state,
                            'Hauptdurchlauf',
                            task.building,
                            task.extensionId,
                            error
                        );

                        if (isFatalPurchaseError(error)) {
                            fatalError = error;
                        }

                    } finally {
                        roundCompleted++;
                        state.completedSteps++;

                        setProgress(
                            `${roundLabel} | ` +
                            `${roundCompleted}/${tasks.length}`,
                            state.completedSteps,
                            state.totalSteps,
                            state.errors ? 'warning' : 'info'
                        );

                        updateStatistics(state);
                    }

                    if (fatalError) break;

                    await cancellableSleep(
                        Math.max(delays.action, delays.building)
                    );
                }

                // Bei kritischen HTTP-Fehlern keine weiteren
                // Serveranfragen starten.

                if (fatalError) {
                    throw fatalError;
                }

                // =============================================
                // KAUFBESTÄTIGUNG NACH DER GESAMTEN RUNDE
                // =============================================

                if (submitted.length > 0) {
                    setProgress(
                        `${name}: Warte auf Kaufbestätigung...`,
                        state.completedSteps,
                        state.totalSteps
                    );

                    // Zusätzliche Wartezeit für die serverseitige
                    // Verarbeitung der letzten Kaufanfragen.

                    await sleep(delays.verify);

                    setProgress(
                        `${name}: Prüfe Käufe...`,
                        state.completedSteps,
                        state.totalSteps
                    );

                    try {
                        purchases = await loadPurchaseTable(context);

                    } catch (error) {
                        for (const task of submitted) {
                            blocked.add(task.building.id);

                            markPending(
                                state,
                                task.building,
                                task.extensionId,
                                'Kaufbestätigung nicht abrufbar'
                            );
                        }

                        recordRequestError(
                            state,
                            'Tabellenprüfung',
                            null,
                            extensionId,
                            error
                        );

                        throw error;
                    }

                    for (const task of submitted) {
                        const stillAvailable = purchases
                            .get(task.building.id)
                            ?.has(task.extensionId);

                        if (stillAvailable) {
                            blocked.add(task.building.id);

                            markPending(
                                state,
                                task.building,
                                task.extensionId,
                                'Kaufbutton weiterhin vorhanden'
                            );

                            recordError(
                                state,
                                'BESTÄTIGUNG',
                                'Hauptdurchlauf',
                                task.building,
                                task.extensionId,
                                'Kaufbutton nach Tabellenaktualisierung weiterhin vorhanden'
                            );

                        } else {
                            markConfirmed(
                                state,
                                task.building.id,
                                task.extensionId
                            );
                        }
                    }

                    updateStatistics(state);
                }
            }
        }
    }

    // =========================================================
    // NACHPRÜFUNG EINZELNER GEBÄUDE
    // =========================================================

    async function loadBuildingPurchaseState(buildingId) {
        const doc = await fetchHtml(`/buildings/${buildingId}`);

        if (!doc.querySelector('table')) {
            throw new Error('Gebäudetabelle konnte nicht geprüft werden.');
        }

        const purchases = purchasesFromDocument(doc);

        return purchases.get(buildingId) ?? new Map();
    }

    async function refreshPendingBuildings(state) {
        const db = await openCurrentBuildingCache(0);

        try {
            for (const [id] of state.pending) {
                const current = await getData(db, 'buildings', id);

                if (current) {
                    state.pending.set(id, normalizeBuilding(current));
                }
            }

        } finally {
            db.close();
        }
    }

    async function retryBuilding(building, selected, delays, state, label) {
        let purchases;

        try {
            purchases = await loadBuildingPurchaseState(building.id);

        } catch (error) {
            recordRequestError(
                state,
                'Nachprüfung: Gebäudeabruf',
                building,
                -1,
                error
            );

            if (isFatalPurchaseError(error)) {
                throw error;
            }

            return false;
        }

        for (const extensionId of selected) {
            if (cancelled) return false;

            const key = taskKey(building.id, extensionId);
            const name = extensionName(building.building_type, extensionId);

            const previousError = state.reasons
                .get(building.id)
                ?.has(extensionId) ?? false;

            setProgress(
                `${label} | ${building.caption} | ${name}`,
                state.completedSteps,
                state.totalSteps,
                'warning'
            );

            if (state.confirmed.has(key)) {
                clearPendingExtension(
                    state,
                    building.id,
                    extensionId
                );

                continue;
            }

            const url = purchases.get(extensionId);

            if (!url) {
                if (cachedExtensionExists(building, extensionId)) {
                    if (previousError) {
                        markConfirmed(
                            state,
                            building.id,
                            extensionId
                        );

                    } else {
                        markSkipped(
                            state,
                            building.id,
                            extensionId
                        );
                    }

                } else if (previousError) {
                    warn(
                        'Früherer Kauffehler noch nicht auflösbar:',
                        building.caption,
                        name
                    );

                } else {
                    markUnavailable(
                        state,
                        building.id,
                        extensionId
                    );
                }

                updateStatistics(state);

                continue;
            }

            try {
                await buyExtension(url);

                await cancellableSleep(delays.action);

                purchases = await loadBuildingPurchaseState(building.id);

                if (purchases.has(extensionId)) {
                    markPending(
                        state,
                        building,
                        extensionId,
                        'Kaufbutton nach Nachprüfung weiterhin vorhanden'
                    );

                    recordError(
                        state,
                        'BESTÄTIGUNG',
                        'Nachprüfung',
                        building,
                        extensionId,
                        'Kaufbutton nach Nachprüfung weiterhin vorhanden'
                    );

                    return false;
                }

                markConfirmed(
                    state,
                    building.id,
                    extensionId
                );

                updateStatistics(state);

            } catch (error) {
                markPending(
                    state,
                    building,
                    extensionId,
                    error.message
                );

                recordRequestError(
                    state,
                    'Nachprüfung',
                    building,
                    extensionId,
                    error
                );

                if (isFatalPurchaseError(error)) {
                    throw error;
                }

                return false;
            }
        }

        return !cancelled &&
            !(state.reasons.get(building.id)?.size > 0);
    }

    async function runRetryPasses(selectedByType, delays, state) {
        if (
            !delays.retryEnabled ||
            delays.retryCount === 0 ||
            state.errors === 0 ||
            state.pending.size === 0
        ) {
            return;
        }

        for (let attempt = 1; attempt <= delays.retryCount; attempt++) {
            if (cancelled || state.pending.size === 0) break;

            const label = `Nachprüfung ${attempt}/${delays.retryCount}`;

            setProgress(
                `${label}: ${state.pending.size} Wachen – Wartezeit...`,
                state.completedSteps,
                state.totalSteps,
                'warning'
            );

            await cancellableSleep(delays.retryDelay);

            if (cancelled) break;

            try {
                await refreshPendingBuildings(state);

            } catch (error) {
                warn(
                    'Cache-Aktualisierung vor Nachprüfung fehlgeschlagen:',
                    error
                );

                if (isFatalPurchaseError(error)) {
                    throw error;
                }
            }

            const retryBuildings = [...state.pending.values()];

            log(label, {
                buildings: retryBuildings.map(building => building.id)
            });

            let processed = 0;

            for (const building of retryBuildings) {
                if (cancelled) break;

                const selected = selectedByType
                    .get(building.building_type) ?? [];

                const success = await retryBuilding(
                    building,
                    selected,
                    delays,
                    state,
                    label
                );

                if (success) {
                    clearPending(state, building.id);
                    state.recovered.add(building.id);
                }

                processed++;

                setProgress(
                    `${label} | ` +
                    `${processed}/${retryBuildings.length} Wachen`,
                    state.completedSteps,
                    state.totalSteps,
                    state.pending.size ? 'warning' : 'success'
                );

                updateStatistics(state);

                await cancellableSleep(delays.building);
            }
        }
    }

    // =========================================================
    // FEHLERÜBERSICHT
    // =========================================================

    function logErrorSummary(state, phase) {
        log(`${phase} – Fehlerübersicht:`, {
            FehlerGesamt: state.errors,
            HTTPFehler: state.httpErrors,
            FehlgeschlageneKaufbestätigungen: state.verificationErrors,
            SonstigeAnfragefehler: state.otherErrors,
            BetroffeneWachen: state.retryTargets.size,
            OffeneWachen: state.pending.size
        });
    }

    function logPendingBuildings(state) {
        if (state.pending.size === 0) return;

        const rows = [];

        for (const [id, building] of state.pending) {
            const reasons = state.reasons.get(id);

            for (const [extensionId, reason] of reasons ?? []) {
                rows.push({
                    Gebäude: building.caption,
                    GebäudeID: id,

                    Erweiterung: extensionId < 0
                        ? 'Gebäudeprüfung'
                        : extensionName(
                            building.building_type,
                            extensionId
                        ),

                    ErweiterungsID: extensionId,
                    Fehler: reason
                });
            }
        }

        warn(
            'Folgende Gebäude benötigen eine manuelle Prüfung:'
        );

        console.table(rows);
    }

    // =========================================================
    // GESAMTABLAUF
    // =========================================================

    async function runForBuildings(buildings, context) {
        if (running) return;

        running = true;
        cancelled = false;

        ensureProgressBar();

        document.getElementById('nilspe-abe-stop').disabled = false;
        document.getElementById('nilspe-abe-close').disabled = true;

        const state = {
            confirmed: new Set(),
            skipped: new Set(),
            unavailable: new Set(),
            recovered: new Set(),
            retryTargets: new Set(),

            pending: new Map(),
            reasons: new Map(),

            errors: 0,
            httpErrors: 0,
            verificationErrors: 0,
            otherErrors: 0,
            errorDetails: [],

            completedSteps: 0,
            totalSteps: 0
        };

        updateStatistics(state);

        try {
            const delays = await configuredDelays();

            const selectedByType = new Map();
            const groups = new Map();

            for (const building of buildings) {
                const type = building.building_type;

                if (!selectedByType.has(type)) {
                    selectedByType.set(
                        type,
                        await selectedExtensionIds(type)
                    );
                }

                const selected = selectedByType.get(type);

                if (!selected.length) continue;

                if (!groups.has(type)) {
                    groups.set(type, []);
                }

                groups.get(type).push(building);

                state.totalSteps += selected.length;
            }

            if (state.totalSteps === 0) {
                setProgress(
                    'Keine Erweiterungen ausgewählt.',
                    0,
                    0,
                    'warning'
                );

                return;
            }

            const configuredBuildingCount = [...groups.values()]
                .reduce((sum, group) => sum + group.length, 0);

            setProgress(
                'Lade Erweiterungstabelle...',
                0,
                state.totalSteps
            );

            updateStatistics(state);

            log('Lauf gestartet:', {
                buildings: configuredBuildingCount,
                steps: state.totalSteps,
                delays,
                parallel: false
            });

            await runMainPass(
                groups,
                selectedByType,
                context,
                delays,
                state
            );

            // Fehler des Hauptdurchlaufs separat ausgeben,
            // bevor die Nachbearbeitung beginnt.

            logErrorSummary(state, 'Hauptdurchlauf beendet');

            if (state.errorDetails.length > 0) {
                console.table([...state.errorDetails]);
            }

            if (
                !cancelled &&
                delays.retryEnabled &&
                state.errors > 0 &&
                state.pending.size > 0
            ) {
                await runRetryPasses(
                    selectedByType,
                    delays,
                    state
                );

            } else if (!cancelled && state.errors === 0) {
                log(
                    'Keine Kauffehler – Nachprüfung wird übersprungen.'
                );
            }

            const completeBuildings = cancelled
                ? null
                : configuredBuildingCount - state.pending.size;

            const message = cancelled
                ? 'Abgebrochen'
                : state.pending.size > 0
                    ? 'Fertig – offene Kauffehler vorhanden'
                    : 'Fertig';

            setProgress(
                message,
                state.completedSteps,
                state.totalSteps,
                cancelled || state.pending.size > 0
                    ? 'warning'
                    : 'success'
            );

            updateStatistics(state);

            log('Abschlussstatistik:', {
                configuredBuildings: configuredBuildingCount,
                completeBuildings,
                confirmedPurchases: state.confirmed.size,
                skipped: state.skipped.size,
                unavailable: state.unavailable.size,
                recoveredBuildings: state.recovered.size,
                retryTargets: state.retryTargets.size,
                errors: state.errors,
                httpErrors: state.httpErrors,
                verificationErrors: state.verificationErrors,
                otherErrors: state.otherErrors,
                pendingBuildings: state.pending.size,
                cancelled
            });

            logErrorSummary(state, 'Gesamtlauf beendet');

            if (state.errorDetails.length > 0) {
                console.table(state.errorDetails);
            }

            logPendingBuildings(state);

            log(
                'Kaufbestätigung bedeutet: Der zuvor vorhandene ' +
                'Kaufbutton ist nach dem Kauf nicht mehr verfügbar ' +
                'oder die Erweiterung wurde bei der Nachprüfung ' +
                'im aktualisierten Gebäude-Cache nachgewiesen.'
            );

        } catch (error) {
            console.error(PREFIX, error);

            setProgress(
                `Lauf gestoppt: ${error.message}`,
                state.completedSteps,
                state.totalSteps,
                'danger'
            );

            updateStatistics(state);

            logErrorSummary(state, 'Lauf gestoppt');

            if (state.errorDetails.length > 0) {
                console.table(state.errorDetails);
            }

            logPendingBuildings(state);

        } finally {
            running = false;

            const stop = document.getElementById('nilspe-abe-stop');
            const close = document.getElementById('nilspe-abe-close');

            if (stop) stop.disabled = true;
            if (close) close.disabled = false;
        }
    }

    // =========================================================
    // BUTTONS
    // =========================================================

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

    function appendDetailButtons(labelText, buttonId, run) {
        const details = document.querySelector(
            '.building-title ~ dl.dl-horizontal'
        );

        if (!details || document.getElementById(buttonId)) return;

        const label = document.createElement('dt');
        const strong = document.createElement('strong');

        strong.textContent = labelText;

        label.append(strong);

        const value = document.createElement('dd');
        const group = document.createElement('div');

        group.id = buttonId;
        group.className = 'btn-group';

        const runButton = document.createElement('button');

        runButton.type = 'button';
        runButton.className = 'btn btn-default btn-xs';
        runButton.textContent = 'Autobuy Extensions';

        runButton.addEventListener('click', async () => {
            if (running) return;

            runButton.disabled = true;

            try {
                await run();

            } catch (error) {
                console.error(PREFIX, error);

                setProgress(
                    `Fehler: ${error.message}`,
                    0,
                    0,
                    'danger'
                );

            } finally {
                runButton.disabled = false;
            }
        });

        group.append(runButton, settingsButton());

        value.append(group);

        details.append(label, value);
    }

    // =========================================================
    // INITIALISIERUNG
    // =========================================================

    if (location.pathname.startsWith('/settings/index')) {
        await createSettings();
        return;
    }

    const heading = document.querySelector('h1[building_type]');
    const buildingId = buildingIdFromLocation();

    if (!heading || !buildingId) return;

    const buildingType = Number(
        heading.getAttribute('building_type')
    );

    if (buildingType === 7) {
        appendDetailButtons(
            'Erweiterungen kaufen:',
            'nilspe-abe-dispatch-buttons',

            async () => {
                setProgress('Lade Gebäude...');

                const buildings = await buildingsForDispatchCenter(
                    buildingId
                );

                if (!buildings.length) {
                    setProgress(
                        'Keine zugeordneten Gebäude gefunden.',
                        0,
                        0,
                        'warning'
                    );

                    return;
                }

                await runForBuildings(buildings, {
                    dispatchCenterId: buildingId,
                    buildingId: null
                });
            }
        );

    } else {
        appendDetailButtons(
            'Erweiterungen kaufen:',
            'nilspe-abe-building-buttons',

            async () => {
                const building = await buildingById(buildingId);

                if (!building) {
                    setProgress(
                        'Gebäude nicht im API-Cache gefunden.',
                        0,
                        0,
                        'danger'
                    );

                    return;
                }

                await runForBuildings([building], {
                    dispatchCenterId: null,
                    buildingId
                });
            }
        );
    }

    log('Geladen – sequenzieller Kaufmodus.');

})();
