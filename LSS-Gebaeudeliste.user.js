// ==UserScript==
// @name         LSS Gebäudeliste
// @namespace    NilsPe.lss.building.list.fix
// @version      1.0.1
// @license      MIT
// @description  Erhält Gebäude-Maps bei der Übertragung aus dem offiziellen Gebäude-Worker.
// @author       NilsPe
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeudeliste.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Gebaeudeliste.user.js
// @match        https://www.leitstellenspiel.de/*
// @match        https://leitstellenspiel.de/*
// @grant        none
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-start
// @sandbox      raw
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const marker = '__nilspeBuildingWorkerFixV1';
    if (window[marker] || typeof window.Worker !== 'function') return;
    const NativeWorker = window.Worker;
    const prefix = '[LSS Gebäudeliste-Fix]';

    // Runs inside a dedicated classic worker, not in the page or other workers.
    function bootstrap(originalURL) {
        const nativeImport = self.importScripts.bind(self);
        const nativeFetch = self.fetch.bind(self);
        const nativePost = self.postMessage.bind(self);

        function installTransferFix() {
            const originalSend = self.prepareResponseAndSend;
            if (typeof originalSend !== 'function' || originalSend.__nilspeFixed) return;
            function send(response) {
                if (response?.type === 'buildings' &&
                    response.buildingHTMLElements instanceof Map) {
                    // Structured cloning preserves both building Maps. JSON does not.
                    nativePost(response);
                    return;
                }
                return originalSend.apply(this, arguments);
            }
            send.__nilspeFixed = true;
            self.prepareResponseAndSend = send;
        }

        // Blob workers have no HTTP base URL. Preserve the original worker's
        // resolution for fetches and imports, including imports made onmessage.
        self.fetch = function (input, options) {
            const resolved = typeof input === 'string' || input instanceof URL
                ? new URL(input, originalURL).href : input;
            return nativeFetch(resolved, options);
        };
        self.importScripts = function (...urls) {
            nativeImport(...urls.map(url => new URL(url, originalURL).href));
            installTransferFix();
        };
        self.importScripts(originalURL);
    }

    window.Worker = new Proxy(NativeWorker, {
        construct(target, args, newTarget) {
            let url;
            try {
                url = new URL(args[0], document.baseURI);
            } catch {
                return Reflect.construct(target, args, newTarget);
            }
            if (url.origin !== location.origin ||
                !/^\/assets\/workers\/buildings_worker(?:-[a-f0-9]+)?\.js$/.test(url.pathname) ||
                (args[1]?.type && args[1].type !== 'classic')) {
                return Reflect.construct(target, args, newTarget);
            }

            const source = `(${bootstrap.toString()})(${JSON.stringify(url.href)});`;
            const blobURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
            let worker;
            try {
                worker = Reflect.construct(target, [blobURL, ...args.slice(1)], newTarget);
            } catch (error) {
                URL.revokeObjectURL(blobURL);
                console.warn(prefix, 'Worker-Wrapper nicht verfügbar; verwende Original.', error);
                return Reflect.construct(target, args, newTarget);
            }
            let released = false;
            const release = () => {
                if (released) return;
                released = true;
                URL.revokeObjectURL(blobURL);
            };
            const terminate = worker.terminate;
            worker.terminate = function (...params) {
                release();
                return terminate.apply(this, params);
            };
            worker.addEventListener('message', event => {
                release();
                if (event.data?.type === 'buildings') {
                    console.info(prefix, `${event.data.buildings?.length ?? '?'} Gebäude übertragen; Maps erhalten:`,
                        event.data.buildingHTMLElements instanceof Map);
                }
            }, { once: true });
            worker.addEventListener('error', event => {
                release();
                console.warn(prefix, 'Gebäude-Worker fehlgeschlagen:', event.message);
            }, { once: true });
            return worker;
        }
    });
    window[marker] = true;
    console.info(prefix, 'Aktiv – Gebäude-Worker werden mit verlustfreier Map-Übertragung gestartet.');
})();
