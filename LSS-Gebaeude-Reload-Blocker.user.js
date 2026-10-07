// ==UserScript==
// @name            LSS Gebäude Reload-Blocker
// @namespace       NilsPe.lss.building.reloadblocker
// @version         1.0.0
// @license         MIT
// @author          NilsPe
// @description     Verhindert automatische Seiten-Reloads durch abgelaufene Timer in Gebäude- und Leitstellenansichten.
// @homepageURL     https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL      https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL     https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeude-Reload-Blocker.user.js
// @updateURL       https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeude-Reload-Blocker.user.js
// @match           https://www.leitstellenspiel.de/buildings/*
// @icon            https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at          document-idle
// @grant           none
// ==/UserScript==

(function () {
    'use strict';

    const PREFIX = '[LSS Reload-Blocker]';

    console.log(`${PREFIX} wird initialisiert...`);

    /*
     * 1. Einsatz-Countdown
     *
     * Original:
     * missionCountdownOnTick(...)
     * location.reload()
     *
     * Neu:
     * Tick wird weiterhin ausgeführt,
     * nur der anschließende Reload entfällt.
     */
    function patchMissionCountdown() {
        if (typeof window.registerMissionCountdownTimer !== 'function') {
            return false;
        }

        window.registerMissionCountdownTimer = function (e, t, i) {
            const n = `mission_countdown_${t}`;
            const s = $(`#${t}`);

            return TickManager.registerObject({
                id: n,
                elementId: t,

                onTick: ({
                    id: e,
                    params: t,
                    remainingTime: i
                }) => {
                    missionCountdownOnTick(
                        e,
                        t.$element,
                        i
                    );
                },

                onEnd: ({
                    id: e,
                    params: t,
                    remainingTime: i
                }) => {
                    missionCountdownOnTick(
                        e,
                        t.$element,
                        i
                    );

                    console.log(
                        `${PREFIX} Mission-Countdown beendet – Reload verhindert`
                    );
                },

                endDate: i,

                params: {
                    $element: s
                }
            });
        };

        console.log(
            `${PREFIX} registerMissionCountdownTimer gepatcht`
        );

        return true;
    }


    /*
     * 2. Gefangenentransport-Countdown
     */
    function patchPrisonerTransportation() {
        if (
            typeof window.registerPrisonerTransportationTimer !==
            'function'
        ) {
            return false;
        }

        window.registerPrisonerTransportationTimer = function (e, t, i) {
            const n = `prison_transportation_${e}`;
            const s = $(`#${t}`);

            return TickManager.registerObject({
                id: n,
                elementId: t,

                onTick: ({
                    id: e,
                    params: t,
                    remainingTime: i
                }) => {
                    missionPrisonerTransportationOnTick(
                        e,
                        t.$element,
                        i
                    );
                },

                onEnd: ({
                    id: e,
                    params: t,
                    remainingTime: i
                }) => {
                    missionPrisonerTransportationOnTick(
                        e,
                        t.$element,
                        i
                    );

                    console.log(
                        `${PREFIX} Gefangenentransport beendet – Reload verhindert`
                    );
                },

                endDate: i,

                params: {
                    $element: s
                }
            });
        };

        console.log(
            `${PREFIX} registerPrisonerTransportationTimer gepatcht`
        );

        return true;
    }


    /*
     * 3. Complex-Base-Timer
     */
    function patchComplexBaseTimer() {
        if (typeof window.registerComplexBaseTimer !== 'function') {
            return false;
        }

        window.registerComplexBaseTimer = function (e, t, i) {
            const n = `complex_base_${e}`;
            const s = $(`#${t}`);

            return TickManager.registerObject({
                id: n,
                elementId: t,

                onTick: ({
                    id: e,
                    params: t,
                    remainingTime: i
                }) => {
                    timerUpdate(
                        e,
                        t.$element,
                        i
                    );
                },

                onEnd: ({
                    id: e,
                    params: t
                }) => {
                    timerUpdate(
                        e,
                        t.$element,
                        -1
                    );

                    console.log(
                        `${PREFIX} Complex-Base-Timer beendet – Reload verhindert`
                    );
                },

                endDate: i,

                params: {
                    $element: s
                }
            });
        };

        console.log(
            `${PREFIX} registerComplexBaseTimer gepatcht`
        );

        return true;
    }


    /*
     * 4. Fahrzeug-Umbau-Timer
     */
    function patchVehicleRefit() {
        if (
            typeof window.vehicleRefitCountdownInterval !==
            'function'
        ) {
            return false;
        }

        window.vehicleRefitCountdownInterval = function (e) {
            setupTimerNew({
                callerId: e,
                $timer: $(`#${e}`),

                onTimerEnd: function (element) {
                    element.text(
                        I18n.t('javascript.few_seconds')
                    );

                    console.log(
                        `${PREFIX} Fahrzeug-Umbau beendet – Reload verhindert`
                    );
                }
            });
        };

        console.log(
            `${PREFIX} vehicleRefitCountdownInterval gepatcht`
        );

        return true;
    }


    /*
     * ---------------------------------------------------------
     * INITIALISIERUNG
     * ---------------------------------------------------------
     *
     * Die Spiel-JavaScripts sind möglicherweise noch nicht
     * vollständig geladen, wenn Tampermonkey startet.
     *
     * Deshalb warten wir, bis alle vier Funktionen existieren.
     */

    let attempts = 0;

    const patcher = setInterval(() => {

        attempts++;

        const results = [
            patchMissionCountdown(),
            patchPrisonerTransportation(),
            patchComplexBaseTimer(),
            patchVehicleRefit()
        ];

        const success = results.filter(Boolean).length;

        if (success === 4) {

            clearInterval(patcher);

            console.log(
                `${PREFIX} ✓ Alle 4 Reload-Quellen erfolgreich gepatcht`
            );

        } else if (attempts >= 100) {

            clearInterval(patcher);

            console.warn(
                `${PREFIX} Initialisierung beendet – ${success}/4 Funktionen gefunden`
            );
        }

    }, 100);

})();