
// ==UserScript==
// @name            LSS Gebäude Reload-Blocker
// @namespace       NilsPe.lss.building.reloadblocker
// @version         1.3.0
// @license         MIT
// @author          NilsPe
// @description     Verhindert automatische Gebäude-Reloads durch ablaufende Spiel-Timer.
// @homepageURL     https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL      https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL     https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeude-Reload-Blocker.user.js
// @updateURL       https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeude-Reload-Blocker.user.js
// @match           https://www.leitstellenspiel.de/buildings/*
// @icon            https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at          document-start
// @inject-into     page
// @grant           none
// ==/UserScript==

(function () {
    'use strict';

    /*
     * Der eigentliche Patch wird im Seitenkontext
     * ausgeführt, damit die lexikalische Variable
     * TickManager erreichbar ist.
     */

    function pageScript() {
        'use strict';

        const PREFIX = '[LSS Reload-Blocker]';
        const VERSION = '1.3.0';

        const STORAGE_KEY =
            'LSS_ReloadBlocker_Diagnostics_V13';

        const CFG = {
            debug: true,
            maxHistory: 100,
            startupInterval: 20,
            startupDuration: 30000,
            maintenanceInterval: 2000
        };

        const TIMER_TYPES = {
            mission_countdown_: 'Einsatz-Countdown',
            prisoner_transportation_: 'Gefangenentransport',
            complex_base_: 'Complex-Base'
        };

        const patchedManagers = new WeakSet();

        const stats = {
            patched: false,
            registered: 0,
            blocked: 0,
            lastBlocked: null
        };

        function log(...args) {
            if (CFG.debug) {
                console.log(PREFIX, ...args);
            }
        }

        function warn(...args) {
            console.warn(PREFIX, ...args);
        }

        function getHistory() {
            try {
                return JSON.parse(
                    sessionStorage.getItem(STORAGE_KEY) || '[]'
                );
            } catch (_) {
                return [];
            }
        }

        function saveEvent(type, details = {}) {
            const entry = {
                time: new Date().toISOString(),
                type,
                page: location.pathname,
                ...details
            };

            try {
                const history = getHistory();

                history.push(entry);

                if (history.length > CFG.maxHistory) {
                    history.splice(
                        0,
                        history.length - CFG.maxHistory
                    );
                }

                sessionStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(history)
                );
            } catch (error) {
                warn('Diagnose konnte nicht gespeichert werden:', error);
            }

            return entry;
        }

        function getManager() {
            try {
                return typeof TickManager !== 'undefined'
                    ? TickManager
                    : null;
            } catch (_) {
                return null;
            }
        }

        function getTimerType(id) {
            if (typeof id !== 'string') {
                return null;
            }

            for (const [prefix, name] of Object.entries(TIMER_TYPES)) {
                if (id.startsWith(prefix)) {
                    return name;
                }
            }

            return null;
        }

        /*
         * TIMER-MANAGER PATCH
         */

        function patchTickManager() {
            const manager = getManager();

            if (!manager ||
                typeof manager.registerObject !== 'function') {
                return false;
            }

            if (patchedManagers.has(manager) &&
                manager.registerObject.__lssReloadBlockerV13) {
                stats.patched = true;
                return true;
            }

            const originalRegister = manager.registerObject;

            if (originalRegister.__lssReloadBlockerV13) {
                patchedManagers.add(manager);
                stats.patched = true;
                return true;
            }

            function patchedRegisterObject(options, ...args) {
                if (!options || typeof options !== 'object') {
                    return originalRegister.call(
                        this,
                        options,
                        ...args
                    );
                }

                const type = getTimerType(options.id);

                if (!type ||
                    typeof options.onEnd !== 'function') {
                    return originalRegister.call(
                        this,
                        options,
                        ...args
                    );
                }

                const timerId = String(options.id);

                stats.registered++;

                saveEvent('timer_registered', {
                    id: timerId,
                    timerType: type
                });

                log('Timer registriert:', type, timerId);

                const modified = {
                    ...options,

                    onEnd: function (data) {
                        stats.blocked++;

                        stats.lastBlocked = {
                            id: timerId,
                            type,
                            time: new Date().toISOString()
                        };

                        saveEvent('timer_reload_blocked', {
                            id: timerId,
                            timerType: type
                        });

                        log(
                            '✓ Automatischer Reload verhindert:',
                            type,
                            timerId
                        );

                        /*
                         * Countdown-Anzeige aktualisieren.
                         * Die originale onEnd-Funktion
                         * wird NICHT ausgeführt, weil
                         * sie location.reload() enthält.
                         */

                        if (typeof options.onTick === 'function') {
                            try {
                                options.onTick.call(this, {
                                    ...(data || {}),
                                    remainingTime: -1
                                });
                            } catch (error) {
                                warn(
                                    'Countdown-Aktualisierung fehlgeschlagen:',
                                    timerId,
                                    error
                                );
                            }
                        }
                    }
                };

                return originalRegister.call(
                    this,
                    modified,
                    ...args
                );
            }

            Object.defineProperty(
                patchedRegisterObject,
                '__lssReloadBlockerV13',
                { value: true }
            );

            try {
                manager.registerObject = patchedRegisterObject;

                if (manager.registerObject !== patchedRegisterObject) {
                    throw new Error(
                        'registerObject konnte nicht ersetzt werden'
                    );
                }

                patchedManagers.add(manager);
                stats.patched = true;

                saveEvent('patch_installed');

                log('✓ TickManager erfolgreich gepatcht');

                return true;
            } catch (error) {
                warn('TickManager-Patch fehlgeschlagen:', error);
                return false;
            }
        }

        /*
         * DIAGNOSE
         */

        const navigationEntry =
            performance.getEntriesByType('navigation')[0];

        const navigationType = navigationEntry
            ? navigationEntry.type
            : 'unknown';

        saveEvent('page_started', {
            navigationType
        });

        if (navigationType === 'reload') {
            log('Seite wurde neu geladen');

            if (CFG.debug) {
                console.table(getHistory().slice(-15));
            }
        }

        window.addEventListener('beforeunload', () => {
            saveEvent('page_unloading');
        });

        /*
         * STATUS-OBJEKT
         */

        window.LSSReloadBlocker = {
            version: VERSION,
            stats,

            getStatus() {
                const manager = getManager();

                const active = !!(
                    manager &&
                    typeof manager.registerObject === 'function' &&
                    manager.registerObject.__lssReloadBlockerV13
                );

                return {
                    version: VERSION,
                    managerFound: !!manager,
                    patched: active,
                    active,
                    registered: stats.registered,
                    blocked: stats.blocked,
                    lastBlocked: stats.lastBlocked
                };
            },

            history() {
                const history = getHistory();
                console.table(history);
                return history;
            },

            lastEvents(count = 20) {
                const events = getHistory().slice(-count);
                console.table(events);
                return events;
            },

            clearHistory() {
                sessionStorage.removeItem(STORAGE_KEY);
                log('Diagnoseverlauf gelöscht');
            }
        };

        /*
         * INITIALISIERUNG
         */

        function initialize() {
            try {
                patchTickManager();
            } catch (error) {
                warn('Initialisierungsfehler:', error);
            }
        }

        initialize();

        const fastCheck = setInterval(
            initialize,
            CFG.startupInterval
        );

        setTimeout(() => {
            clearInterval(fastCheck);
            log('Schnelle Initialisierung beendet');
        }, CFG.startupDuration);

        setInterval(
            initialize,
            CFG.maintenanceInterval
        );

        document.addEventListener(
            'DOMContentLoaded',
            initialize,
            { once: true }
        );

        log('Version', VERSION, 'im Seitenkontext gestartet');
    }

    /*
     * SEITENKONTEXT-INJEKTION
     *
     * Nicht über window.TickManager zugreifen:
     * Der Manager liegt in einer lexikalischen
     * Variable der Spielseite.
     */

    function inject() {
        const root = document.documentElement;

        if (!root) {
            return false;
        }

        const script = document.createElement('script');

        script.textContent =
            '(' + pageScript.toString() + ')();';

        root.appendChild(script);
        script.remove();

        if (!window.LSSReloadBlocker ||
            window.LSSReloadBlocker.version !== '1.3.0') {
            console.warn(
                '[LSS Reload-Blocker] Seitenkontext-Injektion konnte nicht bestätigt werden. Möglicherweise blockiert die Content-Security-Policy das Inline-Script.'
            );
        }

        return true;
    }

    if (!inject()) {
        const observer = new MutationObserver(() => {
            if (inject()) {
                observer.disconnect();
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true
        });
    }

})();
