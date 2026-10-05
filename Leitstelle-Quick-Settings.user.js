// ==UserScript==
// @name         Leitstelle Quick Settings
// @namespace    NilsPe.leitstelle.quick.settings
// @version      1.1.0
// @description  Zeigt wichtige Leitstellen-Einstellungen direkt auf der Leitstellen-Hauptseite und in der Gebäudeliste an
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Quick-Settings.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Leitstelle-Quick-Settings.user.js
// @match        https://*.leitstellenspiel.de/*
// @grant        none
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'nilspe-leitstelle-quick-settings';

    const FIELD_ACTIVE = 'building[active]';
    const FIELD_OWN_MISSIONS = 'building[generate_own_missions]';

    const LEITSTELLE_TYPE_ID = 7;

    const MAX_PARALLEL = 4;

    addStyles();

    const pathMatch = location.pathname.match(/^\/buildings\/(\d+)\/?$/);

    if (pathMatch) {
        initBuildingPage(pathMatch[1]).catch(error => {
            console.error('[Leitstelle Quick Settings]', error);
        });
    }

    initBuildingList();
    

    // ============================================================
    // Einzelne Leitstellen-Seite
    // ============================================================

    async function initBuildingPage(buildingId) {

        if (document.getElementById(PANEL_ID)) {
            return;
        }

        const heading = document.querySelector('h1[building_type]');

        if (Number(heading?.getAttribute('building_type')) !== LEITSTELLE_TYPE_ID) {
            return;
        }

        const editUrl = `${location.origin}/buildings/${buildingId}/edit`;

        const editDocument = await fetchEditDocument(editUrl);
        const editForm = findSettingsForm(editDocument);

        if (!editForm) {
            return;
        }

        const activeCheckbox =
            editForm.querySelector(
                `input[type="checkbox"][name="${FIELD_ACTIVE}"]`
            );

        const ownMissionsCheckbox =
            editForm.querySelector(
                `input[type="checkbox"][name="${FIELD_OWN_MISSIONS}"]`
            );

        if (!activeCheckbox || !ownMissionsCheckbox) {
            return;
        }

        const row = createSettingsRow({
            dispatchDisabled: activeCheckbox.checked,
            ownMissions: ownMissionsCheckbox.checked
        });

        insertSettingsRow(row);

        row.description
            .querySelector('form')
            .addEventListener('submit', event => {

                event.preventDefault();

                saveSettings(
                    editForm,
                    row.description,
                    true
                );
            });
    }


    // ============================================================
    // Gebäudeliste / Leitstellenliste
    // ============================================================

    function initBuildingList() {

        const buildingList = document.querySelector('#building_list');

        if (!buildingList) {
            return;
        }

        processBuildingList();

        /*
         * Falls LSS die Liste später dynamisch verändert / nachlädt.
         */
        const observer = new MutationObserver(() => {
            processBuildingList();
        });

        observer.observe(buildingList, {
            childList: true,
            subtree: true
        });
    }


    function processBuildingList() {

        const leitstellen = [
            ...document.querySelectorAll(
                `#building_list > li[building_type_id="${LEITSTELLE_TYPE_ID}"]`
            )
        ].filter(li =>
            !li.dataset.nilspeQuickSettings
        );

        if (!leitstellen.length) {
            return;
        }

        leitstellen.forEach(li => {
            li.dataset.nilspeQuickSettings = 'loading';
            createListPlaceholder(li);
        });

        runPool(
            leitstellen,
            MAX_PARALLEL,
            loadListEntry
        );
    }


    function createListPlaceholder(li) {

        const caption =
            li.querySelector('.building_list_caption');

        if (!caption) {
            return;
        }

        const container = document.createElement('span');

        container.className =
            'nilspe-lqs-list nilspe-lqs-loading';

        container.textContent = 'Lade Einstellungen…';

        caption.append(container);
    }


    async function loadListEntry(li) {

        const buildingId = getBuildingId(li);

        if (!buildingId) {
            li.dataset.nilspeQuickSettings = 'error';
            return;
        }

        const container =
            li.querySelector('.nilspe-lqs-list');

        try {

            const editUrl =
                `${location.origin}/buildings/${buildingId}/edit`;

            const editDocument =
                await fetchEditDocument(editUrl);

            const editForm =
                findSettingsForm(editDocument);

            if (!editForm) {
                throw new Error('Einstellungsformular nicht gefunden');
            }

            const activeCheckbox =
                editForm.querySelector(
                    `input[type="checkbox"][name="${FIELD_ACTIVE}"]`
                );

            const ownMissionsCheckbox =
                editForm.querySelector(
                    `input[type="checkbox"][name="${FIELD_OWN_MISSIONS}"]`
                );

            if (!activeCheckbox || !ownMissionsCheckbox) {
                throw new Error('Checkboxen nicht gefunden');
            }

            createListControls(
                container,
                editForm,
                {
                    dispatchDisabled: activeCheckbox.checked,
                    ownMissions: ownMissionsCheckbox.checked
                }
            );

            li.dataset.nilspeQuickSettings = 'ready';

        } catch (error) {

            console.error(
                '[Leitstelle Quick Settings]',
                buildingId,
                error
            );

            container.classList.remove(
                'nilspe-lqs-loading'
            );

            container.classList.add(
                'nilspe-lqs-error'
            );

            container.textContent = 'Fehler';

            li.dataset.nilspeQuickSettings = 'error';
        }
    }


    function createListControls(
        container,
        editForm,
        values
    ) {

        container.className = 'nilspe-lqs-list';

        container.innerHTML = `
            <label
                class="nilspe-lqs-list-option"
                title="Leitstelle deaktivieren"
            >
                <input
                    type="checkbox"
                    name="quick_active"
                >
                <span>LS aus</span>
            </label>

            <label
                class="nilspe-lqs-list-option"
                title="Eigener Einsatzbereich"
            >
                <input
                    type="checkbox"
                    name="quick_own_missions"
                >
                <span>Eig. Bereich</span>
            </label>

            <button
                type="button"
                class="btn btn-success btn-xs nilspe-lqs-save"
            >
                Speichern
            </button>

            <span
                class="nilspe-lqs-status"
            ></span>
        `;

        const active =
            container.querySelector(
                '[name="quick_active"]'
            );

        const missions =
            container.querySelector(
                '[name="quick_own_missions"]'
            );

        active.checked =
            values.dispatchDisabled;

        missions.checked =
            values.ownMissions;

        const button =
            container.querySelector(
                '.nilspe-lqs-save'
            );

        button.addEventListener(
            'click',
            () => saveSettings(
                editForm,
                container,
                false
            )
        );
    }


    function getBuildingId(li) {

        /*
         * Variante 1:
         * li-ID = building_list_123456
         */
        const match =
            li.id?.match(/^building_list_(\d+)$/);

        if (match) {
            return match[1];
        }

        /*
         * Fallback:
         * Gebäudelink innerhalb des Eintrags
         */
        const link =
            li.querySelector(
                'a[href*="/buildings/"]'
            );

        const linkMatch =
            link?.pathname?.match(
                /^\/buildings\/(\d+)/
            );

        return linkMatch?.[1] || null;
    }


    // ============================================================
    // Speichern
    // ============================================================

    async function saveSettings(
        editForm,
        controls,
        reloadAfterSave
    ) {

        const submitButton =
            controls.querySelector(
                'button[type="submit"], .nilspe-lqs-save'
            );

        const status =
            controls.querySelector(
                '.nilspe-lqs-status'
            );

        const successAlert =
            controls.querySelector(
                '[data-quick-success]'
            );

        const errorAlert =
            controls.querySelector(
                '[data-quick-error]'
            );

        const dispatchDisabled =
            controls.querySelector(
                '[name="quick_active"]'
            ).checked;

        const ownMissions =
            controls.querySelector(
                '[name="quick_own_missions"]'
            ).checked;

        if (successAlert) {
            setAlert(successAlert, '');
        }

        if (errorAlert) {
            setAlert(errorAlert, '');
        }

        if (status) {
            status.textContent = '';
        }

        submitButton.disabled = true;

        const oldText =
            submitButton.textContent;

        submitButton.textContent =
            'Speichere…';

        try {

            const activeInput =
                editForm.querySelector(
                    `input[type="checkbox"][name="${FIELD_ACTIVE}"]`
                );

            const missionsInput =
                editForm.querySelector(
                    `input[type="checkbox"][name="${FIELD_OWN_MISSIONS}"]`
                );

            activeInput.checked =
                dispatchDisabled;

            missionsInput.checked =
                ownMissions;

            const action =
                new URL(
                    editForm.getAttribute('action')
                        || location.pathname,
                    location.origin
                );

            const method =
                (
                    editForm.getAttribute('method')
                    || 'post'
                ).toUpperCase();

            const response =
                await fetch(
                    action.href,
                    {
                        method,
                        credentials: 'same-origin',
                        body: new FormData(editForm),
                        headers: {
                            Accept:
                                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        },
                        redirect: 'follow'
                    }
                );

            if (!response.ok) {
                throw new Error(
                    `Speichern fehlgeschlagen (${response.status}).`
                );
            }

            if (successAlert) {
                setAlert(
                    successAlert,
                    'Gespeichert.'
                );
            }

            if (status) {
                status.className =
                    'nilspe-lqs-status text-success';

                status.textContent =
                    '✓';
            }

            if (reloadAfterSave) {

                window.setTimeout(
                    () => location.reload(),
                    700
                );

            } else {

                window.setTimeout(
                    () => {
                        if (status) {
                            status.textContent = '';
                        }
                    },
                    1500
                );
            }

        } catch (error) {

            console.error(
                '[Leitstelle Quick Settings]',
                error
            );

            if (errorAlert) {
                setAlert(
                    errorAlert,
                    error.message
                    || 'Speichern fehlgeschlagen.'
                );
            }

            if (status) {

                status.className =
                    'nilspe-lqs-status text-danger';

                status.textContent =
                    '✕';
            }

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = oldText;
        }
    }


    // ============================================================
    // Hilfsfunktionen
    // ============================================================

    async function fetchEditDocument(editUrl) {

        const response =
            await fetch(
                editUrl,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'text/html'
                    }
                }
            );

        if (!response.ok) {
            throw new Error(
                `Edit-Seite konnte nicht geladen werden (${response.status}).`
            );
        }

        const html =
            await response.text();

        return new DOMParser()
            .parseFromString(
                html,
                'text/html'
            );
    }


    function findSettingsForm(editDocument) {

        return Array
            .from(editDocument.forms)
            .find(form =>
                form.querySelector(
                    `[name="${FIELD_ACTIVE}"]`
                )
                &&
                form.querySelector(
                    `[name="${FIELD_OWN_MISSIONS}"]`
                )
                &&
                form.querySelector(
                    '[name="commit"], input[type="submit"]'
                )
            );
    }


    function createSettingsRow(values) {

        const term =
            document.createElement('dt');

        const strong =
            document.createElement('strong');

        strong.textContent =
            'Leitstelle:';

        term.append(strong);

        const description =
            document.createElement('dd');

        description.id =
            PANEL_ID;

        description.innerHTML = `
            <form
                style="
                    display:inline-flex;
                    flex-direction:column;
                    gap:3px;
                    margin:0;
                "
            >
                <label
                    for="nilspe-lqs-active"
                    style="
                        display:inline-flex;
                        align-items:center;
                        gap:6px;
                        margin:0;
                    "
                >
                    <input
                        id="nilspe-lqs-active"
                        type="checkbox"
                        name="quick_active"
                        style="
                            width:13px;
                            height:13px;
                            margin:0;
                        "
                    >
                    <span>LS deaktivieren</span>
                </label>

                <label
                    for="nilspe-lqs-own-missions"
                    style="
                        display:inline-flex;
                        align-items:center;
                        gap:6px;
                        margin:0;
                    "
                >
                    <input
                        id="nilspe-lqs-own-missions"
                        type="checkbox"
                        name="quick_own_missions"
                        style="
                            width:13px;
                            height:13px;
                            margin:0;
                        "
                    >
                    <span>Eigener Einsatzbereich</span>
                </label>

                <button
                    class="btn btn-success btn-xs"
                    type="submit"
                    style="
                        align-self:flex-start;
                    "
                >
                    Speichern
                </button>

                <span
                    class="text-success hidden"
                    data-quick-success
                    style="margin-left:4px;"
                ></span>

                <span
                    class="text-danger hidden"
                    data-quick-error
                    style="margin-left:4px;"
                ></span>
            </form>
        `;

        description
            .querySelector(
                '[name="quick_active"]'
            )
            .checked =
                values.dispatchDisabled;

        description
            .querySelector(
                '[name="quick_own_missions"]'
            )
            .checked =
                values.ownMissions;

        return {
            term,
            description
        };
    }


    function insertSettingsRow(row) {

        const details =
            document.querySelector(
                '.building-title ~ dl.dl-horizontal'
            );

        if (details) {

            details.append(
                row.term,
                row.description
            );

            return;
        }

        const tabs =
            document.querySelector(
                'ul.nav-tabs, .nav-tabs'
            );

        if (tabs?.parentNode) {

            tabs.parentNode.insertBefore(
                row.description,
                tabs
            );
        }
    }


    async function runPool(
        items,
        concurrency,
        worker
    ) {

        const queue =
            [...items];

        const workers =
            Array.from(
                {
                    length: Math.min(
                        concurrency,
                        queue.length
                    )
                },
                async () => {

                    while (queue.length) {

                        const item =
                            queue.shift();

                        await worker(item);
                    }
                }
            );

        await Promise.all(workers);
    }


    function setAlert(
        element,
        message
    ) {

        element.textContent =
            message;

        element.classList.toggle(
            'hidden',
            !message
        );
    }


    function addStyles() {

        if (
            document.getElementById(
                'nilspe-lqs-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'nilspe-lqs-style';

        style.textContent = `

            .nilspe-lqs-list {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-left: 8px;
                vertical-align: middle;
                font-size: 10px;
                white-space: nowrap;
            }

            .nilspe-lqs-list-option {
                display: inline-flex;
                align-items: center;
                gap: 2px;
                margin: 0;
                cursor: pointer;
                font-weight: normal;
            }

            .nilspe-lqs-list-option input {
                margin: 0;
                width: 12px;
                height: 12px;
            }

            .nilspe-lqs-save {
                padding: 1px 5px;
                font-size: 10px;
                line-height: 14px;
            }

            .nilspe-lqs-status {
                display: inline-block;
                min-width: 10px;
                font-weight: bold;
            }

            .nilspe-lqs-loading {
                opacity: 0.65;
                font-style: italic;
            }

            .nilspe-lqs-error {
                color: #d9534f;
            }

        `;

        document.head.append(style);
    }

})();
