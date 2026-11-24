
// ==UserScript==
// @name         Leitstelle Quick Settings
// @namespace    NilsPe.leitstelle.quick.settings
// @version      1.3.0
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

    const VERSION = '1.3.0';
    const PREFIX = '[Leitstelle Quick Settings]';

    const PANEL_ID = 'nilspe-leitstelle-quick-settings';

    const FIELD_ACTIVE = 'building[active]';
    const FIELD_OWN_MISSIONS = 'building[generate_own_missions]';

    const LEITSTELLE_TYPE_ID = 7;
    const MAX_PARALLEL = 4;

    addStyles();

    const pathMatch = location.pathname.match(
        /^\/buildings\/(\d+)\/?$/
    );

    if (pathMatch) {
        initBuildingPage(pathMatch[1]).catch(error => {
            console.error(PREFIX, error);
        });
    }

    initBuildingList();

    // ============================================================
    // HELFER
    // ============================================================

    function el(tag, className = '', text = '') {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text) {
            element.textContent = text;
        }

        return element;
    }

    function makeCheckbox(name, labelText, title, checked) {
        const label = el(
            'label',
            'nilspe-lqs-option'
        );

        label.title = title;

        const checkbox = el('input');
        checkbox.type = 'checkbox';
        checkbox.name = name;
        checkbox.checked = Boolean(checked);

        const text = el(
            'span',
            'nilspe-lqs-option-text',
            labelText
        );

        label.append(checkbox, text);

        return label;
    }

    // ============================================================
    // ÄNDERUNGEN ERKENNEN
    // ============================================================

    function getControlValues(controls) {
        return {
            dispatchDisabled: controls.querySelector(
                '[name="quick_active"]'
            ).checked,

            ownMissions: controls.querySelector(
                '[name="quick_own_missions"]'
            ).checked
        };
    }

    function watchChanges(controls, initialValues) {
        const button = controls.querySelector(
            'button[type="submit"], .nilspe-lqs-save'
        );

        if (!button) return;

        let savedValues = {
            dispatchDisabled: Boolean(
                initialValues.dispatchDisabled
            ),
            ownMissions: Boolean(
                initialValues.ownMissions
            )
        };

        let saving = false;

        function isChanged() {
            const current = getControlValues(controls);

            return (
                current.dispatchDisabled !==
                    savedValues.dispatchDisabled ||
                current.ownMissions !==
                    savedValues.ownMissions
            );
        }

        function updateButton() {
            const changed = isChanged();

            button.classList.toggle(
                'nilspe-lqs-save-hidden',
                !saving && !changed
            );

            controls.classList.toggle(
                'nilspe-lqs-changed',
                !saving && changed
            );

            controls.classList.toggle(
                'nilspe-lqs-saving',
                saving
            );
        }

        controls.querySelectorAll(
            '[name="quick_active"], [name="quick_own_missions"]'
        ).forEach(checkbox => {
            checkbox.addEventListener(
                'change',
                updateButton
            );
        });

        controls.nilspeQuickSettingsState = {
            hasChanges: isChanged,

            startSaving() {
                saving = true;
                updateButton();
            },

            finishSaving(success, submittedValues) {
                if (success) {
                    savedValues = {
                        ...submittedValues
                    };
                }

                saving = false;
                updateButton();
            }
        };

        updateButton();
    }

    // ============================================================
    // EINZELNE LEITSTELLENSEITE
    // ============================================================

    async function initBuildingPage(buildingId) {
        if (document.getElementById(PANEL_ID)) {
            return;
        }

        const heading = document.querySelector(
            'h1[building_type]'
        );

        if (
            Number(
                heading?.getAttribute('building_type')
            ) !== LEITSTELLE_TYPE_ID
        ) {
            return;
        }

        const editUrl =
            `${location.origin}/buildings/${buildingId}/edit`;

        const editDocument = await fetchEditDocument(editUrl);
        const editForm = findSettingsForm(editDocument);

        if (!editForm) return;

        const activeCheckbox = editForm.querySelector(
            `input[type="checkbox"][name="${FIELD_ACTIVE}"]`
        );

        const ownMissionsCheckbox = editForm.querySelector(
            `input[type="checkbox"][name="${FIELD_OWN_MISSIONS}"]`
        );

        if (!activeCheckbox || !ownMissionsCheckbox) {
            return;
        }

        const values = {
            dispatchDisabled: activeCheckbox.checked,
            ownMissions: ownMissionsCheckbox.checked
        };

        const row = createSettingsRow(values);

        insertSettingsRow(row);

        watchChanges(row.description, values);

        row.description
            .querySelector('form')
            .addEventListener('submit', event => {
                event.preventDefault();

                void saveSettings(
                    editForm,
                    row.description,
                    true
                );
            });
    }

    // ============================================================
    // LEITSTELLENLISTE
    // ============================================================

    function initBuildingList() {
        const buildingList = document.querySelector(
            '#building_list'
        );

        if (!buildingList) return;

        processBuildingList();

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

        if (!leitstellen.length) return;

        for (const li of leitstellen) {
            li.dataset.nilspeQuickSettings = 'loading';
            createListPlaceholder(li);
        }

        void runPool(
            leitstellen,
            MAX_PARALLEL,
            loadListEntry
        );
    }

    function createListPlaceholder(li) {
        const caption = li.querySelector(
            '.building_list_caption'
        );

        if (!caption) return;

        /*
         * Der bestehende Leitstellenname
         * bleibt an seinem Platz.
         *
         * Die zusätzlichen Steuerelemente
         * werden als kompakte Gruppe
         * daneben angezeigt.
         */

        const container = el(
            'span',
            'nilspe-lqs-list nilspe-lqs-loading',
            'Lade…'
        );

        container.title =
            'Leitstellen-Einstellungen werden geladen';

        caption.classList.add(
            'nilspe-lqs-caption'
        );

        caption.append(container);
    }

    async function loadListEntry(li) {
        const buildingId = getBuildingId(li);

        const container = li.querySelector(
            '.nilspe-lqs-list'
        );

        if (!buildingId) {
            li.dataset.nilspeQuickSettings = 'error';

            if (container) {
                showLoadError(container);
            }

            return;
        }

        try {
            const editUrl =
                `${location.origin}/buildings/${buildingId}/edit`;

            const editDocument = await fetchEditDocument(
                editUrl
            );

            const editForm = findSettingsForm(
                editDocument
            );

            if (!editForm) {
                throw new Error(
                    'Einstellungsformular nicht gefunden'
                );
            }

            const activeCheckbox = editForm.querySelector(
                `input[type="checkbox"][name="${FIELD_ACTIVE}"]`
            );

            const ownMissionsCheckbox = editForm.querySelector(
                `input[type="checkbox"][name="${FIELD_OWN_MISSIONS}"]`
            );

            if (!activeCheckbox || !ownMissionsCheckbox) {
                throw new Error(
                    'Checkboxen nicht gefunden'
                );
            }

            if (!container?.isConnected) {
                return;
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
                PREFIX,
                buildingId,
                error
            );

            li.dataset.nilspeQuickSettings = 'error';

            if (container) {
                showLoadError(container);
            }
        }
    }

    function showLoadError(container) {
        container.className =
            'nilspe-lqs-list nilspe-lqs-error';

        container.textContent = 'Fehler';

        container.title =
            'Leitstellen-Einstellungen konnten nicht geladen werden';
    }

    function createListControls(container, editForm, values) {
        container.className = 'nilspe-lqs-list';
        container.replaceChildren();

        const active = makeCheckbox(
            'quick_active',
            'LS aus',
            'Leitstelle deaktivieren',
            values.dispatchDisabled
        );

        const ownMissions = makeCheckbox(
            'quick_own_missions',
            'Eig. Bereich',
            'Eigener Einsatzbereich',
            values.ownMissions
        );

        const saveButton = el(
            'button',
            'btn btn-success btn-xs nilspe-lqs-save',
            'Speichern'
        );

        saveButton.type = 'button';

        const status = el(
            'span',
            'nilspe-lqs-status'
        );

        status.setAttribute(
            'aria-live',
            'polite'
        );

        container.append(
            active,
            ownMissions,
            saveButton,
            status
        );

        watchChanges(container, values);

        saveButton.addEventListener(
            'click',
            () => {
                void saveSettings(
                    editForm,
                    container,
                    false
                );
            }
        );
    }

    function getBuildingId(li) {
        const match = li.id?.match(
            /^building_list_(\d+)$/
        );

        if (match) return match[1];

        const link = li.querySelector(
            'a[href*="/buildings/"]'
        );

        const linkMatch = link?.pathname?.match(
            /^\/buildings\/(\d+)/
        );

        return linkMatch?.[1] || null;
    }

    // ============================================================
    // SPEICHERN
    // ============================================================

    async function saveSettings(
        editForm,
        controls,
        reloadAfterSave
    ) {
        const submitButton = controls.querySelector(
            'button[type="submit"], .nilspe-lqs-save'
        );

        const status = controls.querySelector(
            '.nilspe-lqs-status'
        );

        const successAlert = controls.querySelector(
            '[data-quick-success]'
        );

        const errorAlert = controls.querySelector(
            '[data-quick-error]'
        );

        const state =
            controls.nilspeQuickSettingsState;

        if (state && !state.hasChanges()) {
            return;
        }

        if (!submitButton || submitButton.disabled) {
            return;
        }

        const submittedValues = getControlValues(
            controls
        );

        if (successAlert) setAlert(successAlert, '');
        if (errorAlert) setAlert(errorAlert, '');

        if (status) {
            status.textContent = '';
            status.className = 'nilspe-lqs-status';
        }

        state?.startSaving();

        submitButton.disabled = true;

        const oldText = submitButton.textContent;
        submitButton.textContent = 'Speichere…';

        const checkboxes = [
            controls.querySelector(
                '[name="quick_active"]'
            ),
            controls.querySelector(
                '[name="quick_own_missions"]'
            )
        ];

        checkboxes.forEach(input => {
            input.disabled = true;
        });

        let success = false;

        try {
            const activeInput = editForm.querySelector(
                `input[type="checkbox"][name="${FIELD_ACTIVE}"]`
            );

            const missionsInput = editForm.querySelector(
                `input[type="checkbox"][name="${FIELD_OWN_MISSIONS}"]`
            );

            if (!activeInput || !missionsInput) {
                throw new Error(
                    'Einstellungsfelder nicht gefunden.'
                );
            }

            activeInput.checked =
                submittedValues.dispatchDisabled;

            missionsInput.checked =
                submittedValues.ownMissions;

            const action = new URL(
                editForm.getAttribute('action') ||
                location.pathname,
                location.origin
            );

            const method = (
                editForm.getAttribute('method') ||
                'post'
            ).toUpperCase();

            /*
             * Bestehendes Speichervorgehen:
             * vollständiges Edit-Formular senden.
             *
             * Nur die beiden angezeigten
             * Checkboxen werden verändert.
             */

            const response = await fetch(
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

            success = true;

            if (successAlert) {
                setAlert(
                    successAlert,
                    'Gespeichert.'
                );
            }

            if (status) {
                status.className =
                    'nilspe-lqs-status nilspe-lqs-status-success';

                status.textContent = '✓';
                status.title = 'Gespeichert';
            }

            if (reloadAfterSave) {
                window.setTimeout(
                    () => location.reload(),
                    700
                );
            } else {
                window.setTimeout(() => {
                    if (
                        status?.textContent === '✓'
                    ) {
                        status.textContent = '';
                    }
                }, 1500);
            }

        } catch (error) {
            console.error(
                PREFIX,
                error
            );

            if (errorAlert) {
                setAlert(
                    errorAlert,
                    error.message ||
                    'Speichern fehlgeschlagen.'
                );
            }

            if (status) {
                status.className =
                    'nilspe-lqs-status nilspe-lqs-status-error';

                status.textContent = '✕';
                status.title =
                    error.message ||
                    'Speichern fehlgeschlagen';
            }

        } finally {
            checkboxes.forEach(input => {
                input.disabled = false;
            });

            submitButton.disabled = false;
            submitButton.textContent = oldText;

            state?.finishSaving(
                success,
                submittedValues
            );
        }
    }

    // ============================================================
    // EDIT-SEITE LADEN
    // ============================================================

    async function fetchEditDocument(editUrl) {
        const response = await fetch(
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

        const html = await response.text();

        return new DOMParser().parseFromString(
            html,
            'text/html'
        );
    }

    function findSettingsForm(editDocument) {
        return Array.from(
            editDocument.forms
        ).find(form =>
            form.querySelector(
                `[name="${FIELD_ACTIVE}"]`
            ) &&
            form.querySelector(
                `[name="${FIELD_OWN_MISSIONS}"]`
            ) &&
            form.querySelector(
                '[name="commit"], input[type="submit"]'
            )
        );
    }

    // ============================================================
    // EINZELNE LEITSTELLE: STEUERELEMENTE
    // ============================================================

    function createSettingsRow(values) {
        const term = el('dt');

        term.append(
            el('strong', '', 'Leitstelle:')
        );

        const description = el('dd');
        description.id = PANEL_ID;

        const form = el(
            'form',
            'nilspe-lqs-detail-form'
        );

        const options = el(
            'div',
            'nilspe-lqs-detail-options'
        );

        const active = makeCheckbox(
            'quick_active',
            'Leitstelle deaktivieren',
            'Leitstelle deaktivieren',
            values.dispatchDisabled
        );

        active.querySelector('input').id =
            'nilspe-lqs-active';

        const ownMissions = makeCheckbox(
            'quick_own_missions',
            'Eigener Einsatzbereich',
            'Eigener Einsatzbereich',
            values.ownMissions
        );

        ownMissions.querySelector('input').id =
            'nilspe-lqs-own-missions';

        options.append(
            active,
            ownMissions
        );

        const footer = el(
            'div',
            'nilspe-lqs-detail-footer'
        );

        const saveButton = el(
            'button',
            'btn btn-success btn-xs nilspe-lqs-save',
            'Speichern'
        );

        saveButton.type = 'submit';

        const status = el(
            'span',
            'nilspe-lqs-status'
        );

        const success = el(
            'span',
            'text-success hidden'
        );

        success.dataset.quickSuccess = '';

        const error = el(
            'span',
            'text-danger hidden'
        );

        error.dataset.quickError = '';

        footer.append(
            saveButton,
            status,
            success,
            error
        );

        form.append(
            options,
            footer
        );

        description.append(form);

        return {
            term,
            description
        };
    }

    function insertSettingsRow(row) {
        const details = document.querySelector(
            '.building-title ~ dl.dl-horizontal'
        );

        if (details) {
            details.append(
                row.term,
                row.description
            );
            return;
        }

        const tabs = document.querySelector(
            'ul.nav-tabs, .nav-tabs'
        );

        if (tabs?.parentNode) {
            tabs.parentNode.insertBefore(
                row.description,
                tabs
            );
        }
    }

    // ============================================================
    // PARALLELE ANFRAGEN
    // ============================================================

    async function runPool(items, concurrency, worker) {
        const queue = [...items];

        const workers = Array.from(
            {
                length: Math.min(
                    concurrency,
                    queue.length
                )
            },
            async () => {
                while (queue.length) {
                    const item = queue.shift();

                    await worker(item);
                }
            }
        );

        await Promise.all(workers);
    }

    function setAlert(element, message) {
        element.textContent = message;

        element.classList.toggle(
            'hidden',
            !message
        );
    }

    // ============================================================
    // DESIGN
    // ============================================================

    function addStyles() {
        if (
            document.getElementById(
                'nilspe-lqs-style'
            )
        ) {
            return;
        }

        const style = el('style');
        style.id = 'nilspe-lqs-style';

        style.textContent = `
            /*
             * ==========================================
             * LEITSTELLENLISTE
             * ==========================================
             *
             * Kompaktes Layout für die Gebäudeliste,
             * insbesondere den schmalen Kartenrand.
             */

            #building_list > li[building_type_id="7"] {
                min-height: 28px;
            }

            #building_list .nilspe-lqs-caption {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 3px 8px;
                min-width: 0;
            }

            /*
             * Der vorhandene Gebäudename
             * behält seine Spiel-Formatierung.
             */

            #building_list .nilspe-lqs-caption
            > a {
                min-width: 0;
            }

            #building_list .nilspe-lqs-list {
                display: inline-flex;
                flex: 0 0 auto;
                align-items: center;
                gap: 5px;
                margin-left: 0;
                padding: 3px 6px;
                border: 1px solid rgba(128,128,128,.28);
                border-radius: 4px;
                background: rgba(128,128,128,.09);
                vertical-align: middle;
                font-size: 11px;
                line-height: 16px;
                white-space: nowrap;
                box-sizing: border-box;
            }

            #building_list .nilspe-lqs-option {
                display: inline-flex;
                align-items: center;
                flex: 0 0 auto;
                gap: 4px;
                margin: 0;
                padding: 0 3px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                line-height: 16px;
                font-weight: normal;
                white-space: nowrap;
                user-select: none;
            }

            #building_list .nilspe-lqs-option + 
            .nilspe-lqs-option {
                padding-left: 7px;
                border-left: 1px solid rgba(128,128,128,.3);
                border-radius: 0;
            }

            /*
             * Checkboxen ohne abweichende
             * Browser- oder Bootstrap-Abstände.
             */

            .nilspe-lqs-option input[type="checkbox"] {
                position: static !important;
                display: inline-block;
                flex: 0 0 13px;
                width: 13px;
                height: 13px;
                margin: 0 !important;
                padding: 0;
                vertical-align: middle;
                cursor: pointer;
                accent-color: #2684d9;
            }

            .nilspe-lqs-option-text {
                display: inline-block;
                margin: 0;
                padding: 0;
                line-height: inherit;
            }

            /*
             * Nur ungespeicherte Änderungen
             * werden dezent hervorgehoben.
             */

            #building_list .nilspe-lqs-list.nilspe-lqs-changed {
                border-color: rgba(240,173,78,.55);
                background: rgba(240,173,78,.09);
            }

            #building_list .nilspe-lqs-list.nilspe-lqs-saving {
                opacity: .8;
            }

            /*
             * Speichern erscheint wie bisher
             * ausschließlich bei Änderungen.
             */

            .nilspe-lqs-save {
                flex: 0 0 auto;
                padding: 2px 7px !important;
                margin: 0 !important;
                font-size: 11px !important;
                line-height: 16px !important;
                font-weight: normal;
                border-radius: 3px;
            }

            .nilspe-lqs-save-hidden {
                display: none !important;
            }

            .nilspe-lqs-status {
                display: inline-block;
                flex: 0 0 auto;
                min-width: 0;
                font-weight: bold;
                line-height: 16px;
            }

            .nilspe-lqs-status:empty {
                display: none;
            }

            .nilspe-lqs-status-success {
                color: #5cb85c;
            }

            .nilspe-lqs-status-error {
                color: #d9534f;
            }

            #building_list .nilspe-lqs-loading {
                opacity: .65;
                font-size: 10px;
                font-style: italic;
            }

            #building_list .nilspe-lqs-error {
                color: #d9534f;
                font-size: 10px;
            }

            /*
             * ==========================================
             * EINZELNE LEITSTELLE
             * ==========================================
             *
             * Kompakte, untereinander angeordnete
             * Optionen mit sauberer Ausrichtung.
             */

            #${PANEL_ID} .nilspe-lqs-detail-form {
                display: inline-flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
                max-width: 100%;
                padding: 10px 12px;
                margin: 0;
                border: 1px solid rgba(128,128,128,.28);
                border-radius: 4px;
                background: rgba(128,128,128,.07);
                box-sizing: border-box;
            }

            #${PANEL_ID} .nilspe-lqs-detail-options {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 7px;
            }

            #${PANEL_ID} .nilspe-lqs-option {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin: 0;
                padding: 0;
                cursor: pointer;
                font-size: 12px;
                line-height: 18px;
                font-weight: normal;
                user-select: none;
            }

            #${PANEL_ID} .nilspe-lqs-option input {
                flex: 0 0 14px;
                width: 14px;
                height: 14px;
            }

            #${PANEL_ID} .nilspe-lqs-detail-footer {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
                min-height: 0;
            }

            #${PANEL_ID}.nilspe-lqs-changed
            .nilspe-lqs-detail-form {
                border-color: rgba(240,173,78,.55);
                background: rgba(240,173,78,.09);
            }

            #${PANEL_ID}.nilspe-lqs-saving
            .nilspe-lqs-detail-form {
                opacity: .8;
            }

            /*
             * ==========================================
             * SCHMALE ANSICHTEN
             * ==========================================
             *
             * Bei wenig Platz bleiben die
             * Checkboxen nebeneinander,
             * können aber auf die nächste
             * Zeile umbrechen.
             */

            @media (max-width: 500px) {
                #building_list .nilspe-lqs-list {
                    gap: 4px;
                    padding: 3px 5px;
                    font-size: 10px;
                }

                #building_list .nilspe-lqs-option {
                    font-size: 10px;
                    padding: 0 2px;
                }

                #building_list .nilspe-lqs-option + 
                .nilspe-lqs-option {
                    padding-left: 5px;
                }
            }
        `;

        document.head.append(style);
    }

    console.log(
        PREFIX,
        `Version ${VERSION} geladen`
    );
})();
