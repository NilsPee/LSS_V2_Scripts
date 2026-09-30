// ==UserScript==
// @name            LSS Toplist Check
// @namespace       NilsPe.lss.toplist.check
// @version         1.4.0
// @license         MIT
// @author          NilsPe
// @description     Prüft alle Mitglieder eines Verbandes gegen die ersten 100 Seiten der LSS-Toplist.
// @homepageURL     https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL      https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL     https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Toplist-Check.user.js
// @updateURL       https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Toplist-Check.user.js
// @match           https://www.leitstellenspiel.de/verband/mitglieder/*
// @icon            https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at          document-idle
// @grant           none
// ==/UserScript==

(async function () {
    'use strict';

    // =========================================================
    // Einstellungen
    // =========================================================

    const CONFIG = {
        // 100 Seiten × 20 Spieler = Top 2.000
        toplistPages: 100,

        toplistConcurrency: 5,
        toplistRequestDelay: 150,
        toplistRetries: 3,

        // Mitgliederseiten eines Verbandes
        memberConcurrency: 4,
        memberRequestDelay: 100,
        memberRetries: 3,

        // Toplist 12 Stunden zwischenspeichern
        cacheMaxAge: 12 * 60 * 60 * 1000,

        // Darstellung
        missingColor: '#ff5c5c',
        missingBackground: 'rgba(255, 80, 80, 0.10)',

        outsideColor: '#999'
    };

    const CACHE_KEY =
        'lss_toplist_check_top2000_v1';

    // Enthält nach Abschluss der Prüfung alle
    // auffälligen Mitglieder des gesamten Verbandes.
    let allianceMissingMembers = [];

    // =========================================================
    // Hilfsfunktionen
    // =========================================================

    function sleep(ms) {
        return new Promise(
            resolve => setTimeout(resolve, ms)
        );
    }

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    function parseCredits(value) {
        const numeric =
            String(value || '')
                .replace(/[^0-9]/g, '');

        return numeric
            ? Number(numeric)
            : null;
    }

    function formatCredits(value) {
        return Number(value)
            .toLocaleString('de-DE');
    }

    // =========================================================
    // Toplist Cache
    // =========================================================

    function loadToplistCache() {
        const cache = parseJson(
            localStorage.getItem(CACHE_KEY),
            null
        );

        if (!cache) {
            return null;
        }

        if (
            !cache.timestamp ||
            !Array.isArray(cache.players) ||
            cache.minimumCredits == null
        ) {
            return null;
        }

        if (
            Date.now() - cache.timestamp >
            CONFIG.cacheMaxAge
        ) {
            return null;
        }

        return {
            players: new Map(
                cache.players.map(player => [
                    String(player.id),
                    player
                ])
            ),

            minimumCredits:
                Number(cache.minimumCredits)
        };
    }

    function saveToplistCache(
        players,
        minimumCredits
    ) {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
                timestamp: Date.now(),
                pages: CONFIG.toplistPages,

                players: [
                    ...players.values()
                ],

                minimumCredits
            })
        );
    }

    function clearToplistCache() {
        localStorage.removeItem(
            CACHE_KEY
        );
    }

    // =========================================================
    // Verbands-ID
    // =========================================================

    function getAllianceId() {
        return location.pathname
            .match(
                /\/verband\/mitglieder\/(\d+)/
            )?.[1] || null;
    }

    // =========================================================
    // Mitglieder aus Dokument lesen
    // =========================================================

    function parseMembersFromDocument(
        doc,
        includeDomReferences = false
    ) {
        const members = [];

        for (
            const row of doc.querySelectorAll(
                'table.table tbody tr'
            )
        ) {
            const profileLink =
                row.querySelector(
                    'a[href^="/profile/"]'
                );

            if (!profileLink) {
                continue;
            }

            const href =
                profileLink.getAttribute(
                    'href'
                ) || '';

            const id =
                href.match(
                    /\/profile\/(\d+)/
                )?.[1];

            if (!id) {
                continue;
            }

            const cells =
                row.querySelectorAll('td');

            /*
             * Mitgliederliste:
             *
             * 0 = Name
             * 1 = Rolle
             * 2 = Verdiente Credits
             * 3 = Mitglied seit
             */

            const credits =
                parseCredits(
                    cells[2]?.textContent
                );

            members.push({
                id,

                name:
                    profileLink
                        .textContent
                        .trim(),

                credits,

                link:
                    includeDomReferences
                        ? profileLink
                        : null,

                row:
                    includeDomReferences
                        ? row
                        : null
            });
        }

        return members;
    }

    // =========================================================
    // Anzahl Mitgliederseiten bestimmen
    // =========================================================

    function getLastMemberPage(doc) {
        let maxPage = 1;

        for (
            const link of
            doc.querySelectorAll(
                'a[href*="/verband/mitglieder/"]'
            )
        ) {
            const href =
                link.getAttribute('href') || '';

            const match =
                href.match(
                    /[?&]page=(\d+)/
                );

            if (!match) {
                continue;
            }

            const page =
                Number(match[1]);

            if (
                Number.isFinite(page)
            ) {
                maxPage =
                    Math.max(
                        maxPage,
                        page
                    );
            }
        }

        return maxPage;
    }

    // =========================================================
    // Einzelne Mitgliederseite laden
    // =========================================================

    async function fetchMemberPage(
        allianceId,
        page
    ) {
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= CONFIG.memberRetries;
            attempt++
        ) {
            try {
                await sleep(
                    CONFIG.memberRequestDelay
                );

                const response =
                    await fetch(
                        `/verband/mitglieder/${allianceId}?page=${page}`,
                        {
                            credentials:
                                'same-origin',

                            cache:
                                'no-store'
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }

                const html =
                    await response.text();

                const doc =
                    new DOMParser()
                        .parseFromString(
                            html,
                            'text/html'
                        );

                const members =
                    parseMembersFromDocument(
                        doc,
                        false
                    );

                if (!members.length) {
                    throw new Error(
                        'Keine Mitglieder erkannt'
                    );
                }

                console.log(
                    `[LSS Toplist Check] ` +
                    `Mitgliederseite ${page}: ` +
                    `${members.length} Mitglieder`
                );

                return members;

            } catch (error) {
                lastError = error;

                console.warn(
                    `[LSS Toplist Check] ` +
                    `Mitgliederseite ${page}, ` +
                    `Versuch ${attempt}/${CONFIG.memberRetries} fehlgeschlagen`,
                    error
                );

                if (
                    attempt <
                    CONFIG.memberRetries
                ) {
                    await sleep(
                        500 * attempt
                    );
                }
            }
        }

        throw lastError ||
            new Error(
                `Mitgliederseite ${page} konnte nicht geladen werden`
            );
    }

    // =========================================================
    // Gesamten Verband laden
    // =========================================================

    async function loadAllAllianceMembers(
        allianceId,
        onProgress
    ) {
        const lastPage =
            getLastMemberPage(
                document
            );

        const currentPage =
            Number(
                new URLSearchParams(
                    location.search
                ).get('page')
            ) || 1;

        const allMembers =
            new Map();

        /*
         * Aktuell sichtbare Seite direkt übernehmen.
         * Diese müssen wir nicht noch einmal laden.
         */

        const visibleMembers =
            parseMembersFromDocument(
                document,
                false
            );

        for (
            const member of
            visibleMembers
        ) {
            allMembers.set(
                member.id,
                member
            );
        }

        const pagesToLoad = [];

        for (
            let page = 1;
            page <= lastPage;
            page++
        ) {
            if (
                page !== currentPage
            ) {
                pagesToLoad.push(
                    page
                );
            }
        }

        if (!pagesToLoad.length) {
            return {
                members: [
                    ...allMembers.values()
                ],

                pages:
                    lastPage
            };
        }

        let nextIndex = 0;
        let completed = 1;

        async function worker() {
            while (true) {
                const index =
                    nextIndex++;

                if (
                    index >=
                    pagesToLoad.length
                ) {
                    return;
                }

                const page =
                    pagesToLoad[index];

                const members =
                    await fetchMemberPage(
                        allianceId,
                        page
                    );

                for (
                    const member of
                    members
                ) {
                    allMembers.set(
                        member.id,
                        member
                    );
                }

                completed++;

                onProgress?.(
                    completed,
                    lastPage,
                    allMembers.size
                );
            }
        }

        const workerCount =
            Math.min(
                CONFIG.memberConcurrency,
                pagesToLoad.length
            );

        await Promise.all(
            Array.from(
                {
                    length:
                        workerCount
                },
                () => worker()
            )
        );

        return {
            members: [
                ...allMembers.values()
            ],

            pages:
                lastPage
        };
    }

    // =========================================================
    // Toplist parsen
    // =========================================================

    function parseToplist(
        html,
        page
    ) {
        const doc =
            new DOMParser()
                .parseFromString(
                    html,
                    'text/html'
                );

        const players = [];

        const rows =
            doc.querySelectorAll(
                'table.table.table-striped tbody tr'
            );

        rows.forEach(
            (row, rowIndex) => {
                const cells =
                    row.querySelectorAll('td');

                if (
                    cells.length < 3
                ) {
                    return;
                }

                const playerLink =
                    cells[2]
                        .querySelector(
                            'a[href^="/profile/"]'
                        );

                if (!playerLink) {
                    return;
                }

                const href =
                    playerLink
                        .getAttribute(
                            'href'
                        ) || '';

                const id =
                    href.match(
                        /\/profile\/(\d+)/
                    )?.[1];

                const credits =
                    parseCredits(
                        cells[1]
                            ?.textContent
                    );

                if (
                    !id ||
                    credits === null
                ) {
                    return;
                }

                players.push({
                    id,
                    credits,

                    rank:
                        (page - 1) *
                        20 +
                        rowIndex +
                        1
                });
            }
        );

        return players;
    }

    // =========================================================
    // Toplist-Seite laden
    // =========================================================

    async function fetchToplistPage(
        page
    ) {
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= CONFIG.toplistRetries;
            attempt++
        ) {
            try {
                await sleep(
                    CONFIG.toplistRequestDelay
                );

                const response =
                    await fetch(
                        `/toplist?page=${page}`,
                        {
                            credentials:
                                'same-origin',

                            cache:
                                'no-store'
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}`
                    );
                }

                const html =
                    await response.text();

                const players =
                    parseToplist(
                        html,
                        page
                    );

                if (!players.length) {
                    throw new Error(
                        'Keine Spieler erkannt'
                    );
                }

                console.log(
                    `[LSS Toplist Check] ` +
                    `Toplist ${page}: ` +
                    `${players.length} Spieler`
                );

                return players;

            } catch (error) {
                lastError = error;

                console.warn(
                    `[LSS Toplist Check] ` +
                    `Toplist ${page}, ` +
                    `Versuch ${attempt}/${CONFIG.toplistRetries} fehlgeschlagen`,
                    error
                );

                if (
                    attempt <
                    CONFIG.toplistRetries
                ) {
                    await sleep(
                        1000 * attempt
                    );
                }
            }
        }

        throw lastError ||
            new Error(
                `Toplist-Seite ${page} konnte nicht geladen werden`
            );
    }

    // =========================================================
    // Top 2.000 laden
    // =========================================================

    async function loadToplist(
        onProgress
    ) {
        const players =
            new Map();

        let nextPage = 1;
        let completed = 0;

        async function worker() {
            while (true) {
                const page =
                    nextPage++;

                if (
                    page >
                    CONFIG.toplistPages
                ) {
                    return;
                }

                const pagePlayers =
                    await fetchToplistPage(
                        page
                    );

                for (
                    const player of
                    pagePlayers
                ) {
                    players.set(
                        player.id,
                        player
                    );
                }

                completed++;

                onProgress?.(
                    completed,
                    CONFIG.toplistPages,
                    players.size
                );
            }
        }

        const workerCount =
            Math.min(
                CONFIG.toplistConcurrency,
                CONFIG.toplistPages
            );

        await Promise.all(
            Array.from(
                {
                    length:
                        workerCount
                },
                () => worker()
            )
        );

        let minimumCredits =
            Infinity;

        for (
            const player of
            players.values()
        ) {
            minimumCredits =
                Math.min(
                    minimumCredits,
                    player.credits
                );
        }

        if (
            !Number.isFinite(
                minimumCredits
            )
        ) {
            throw new Error(
                'Credit-Grenze konnte nicht ermittelt werden'
            );
        }

        return {
            players,
            minimumCredits
        };
    }

    // =========================================================
    // Status eines Mitglieds bestimmen
    // =========================================================

    function getMemberStatus(
        member,
        toplist
    ) {
        /*
         * ID in den Top 2.000 gefunden.
         */
        if (
            toplist.players.has(
                member.id
            )
        ) {
            return 'listed';
        }

        /*
         * Keine Credits lesbar:
         * keine sichere Aussage.
         */
        if (
            member.credits === null
        ) {
            return 'outside';
        }

        /*
         * Der Spieler hat mindestens so viele Credits
         * wie der letzte geladene Toplist-Spieler,
         * wurde aber in den Top 2.000 nicht gefunden.
         */
        if (
            member.credits >=
            toplist.minimumCredits
        ) {
            return 'missing';
        }

        /*
         * Credits unterhalb unserer Top-2000-Grenze.
         */
        return 'outside';
    }

    // =========================================================
    // Markierungen der sichtbaren Seite
    // =========================================================

    function clearMemberMark(
        member
    ) {
        if (
            !member.row ||
            !member.link
        ) {
            return;
        }

        member.row.dataset.toplist =
            '';

        member.link.style.color =
            '';

        member.link.style.fontWeight =
            '';

        member.row.style.backgroundColor =
            '';

        member.row
            .querySelector(
                '.lss-toplist-status'
            )
            ?.remove();
    }

    function markListed(
        member
    ) {
        if (
            !member.row ||
            !member.link
        ) {
            return;
        }

        clearMemberMark(
            member
        );

        member.row.dataset.toplist =
            'yes';

        member.link.title =
            'Spieler wurde in der geprüften Toplist gefunden';
    }

    function markMissing(
        member
    ) {
        if (
            !member.row ||
            !member.link
        ) {
            return;
        }

        clearMemberMark(
            member
        );

        member.row.dataset.toplist =
            'no';

        member.link.style.color =
            CONFIG.missingColor;

        member.link.style.fontWeight =
            'bold';

        member.row.style.backgroundColor =
            CONFIG.missingBackground;

        const badge =
            document.createElement(
                'span'
            );

        badge.className =
            'lss-toplist-status';

        badge.textContent =
            ' ⚠ nicht in Toplist';

        badge.style.color =
            CONFIG.missingColor;

        badge.style.fontWeight =
            'bold';

        badge.style.marginLeft =
            '6px';

        badge.title =
            'Spieler liegt anhand seiner Credits im geprüften Bereich, wurde dort aber nicht gefunden';

        member.link.after(
            badge
        );
    }

    function markOutside(
        member
    ) {
        if (
            !member.row ||
            !member.link
        ) {
            return;
        }

        clearMemberMark(
            member
        );

        member.row.dataset.toplist =
            'outside';

        const badge =
            document.createElement(
                'span'
            );

        badge.className =
            'lss-toplist-status';

        badge.textContent =
            ' – außerhalb Prüfbereich';

        badge.style.color =
            CONFIG.outsideColor;

        badge.style.marginLeft =
            '6px';

        badge.title =
            'Credits liegen unterhalb der geladenen Toplist-Grenze';

        member.link.after(
            badge
        );
    }

    function markVisibleMembers(
        toplist
    ) {
        const visibleMembers =
            parseMembersFromDocument(
                document,
                true
            );

        for (
            const member of
            visibleMembers
        ) {
            const status =
                getMemberStatus(
                    member,
                    toplist
                );

            if (
                status === 'listed'
            ) {
                markListed(
                    member
                );

            } else if (
                status === 'missing'
            ) {
                markMissing(
                    member
                );

            } else {
                markOutside(
                    member
                );
            }
        }
    }

    // =========================================================
    // Gesamten Verband auswerten
    // =========================================================

    function checkAlliance(
        members,
        toplist
    ) {
        const result = {
            total:
                members.length,

            listed: 0,
            missing: 0,
            outside: 0,

            missingMembers: []
        };

        for (
            const member of
            members
        ) {
            const status =
                getMemberStatus(
                    member,
                    toplist
                );

            if (
                status === 'listed'
            ) {
                result.listed++;

            } else if (
                status === 'missing'
            ) {
                result.missing++;

                result.missingMembers.push(
                    member
                );

            } else {
                result.outside++;
            }
        }

        /*
         * Auffällige Spieler direkt nach Credits
         * absteigend sortieren.
         */
        result.missingMembers.sort(
            (a, b) =>
                (b.credits || 0) -
                (a.credits || 0)
        );

        return result;
    }

    // =========================================================
    // UI
    // =========================================================

    function createUI() {
        const table =
            document.querySelector(
                'table.table'
            );

        if (!table) {
            return;
        }

        const box =
            document.createElement(
                'div'
            );

        box.id =
            'lss-toplist-check-box';

        box.className =
            'alert alert-info';

        box.style.marginTop =
            '10px';

        box.style.marginBottom =
            '10px';

        box.innerHTML = `
            <strong>Toplist-Check:</strong>

            <span id="lss-toplist-status">
                Vorbereitung...
            </span>

            &nbsp;|&nbsp;

            <span id="lss-alliance-result">
                Verband wird geladen...
            </span>

            &nbsp;|&nbsp;

            <span id="lss-toplist-limit">
                Grenze wird ermittelt...
            </span>

            &nbsp;

            <button
                id="lss-toplist-filter"
                class="btn btn-default btn-xs"
                type="button"
                disabled
            >
                Nur nicht gelistete
            </button>

            <button
                id="lss-toplist-refresh"
                class="btn btn-default btn-xs"
                type="button"
            >
                Toplist neu laden
            </button>
        `;

        table.parentNode.insertBefore(
            box,
            table
        );
    }

    function setStatus(text) {
        const element =
            document.getElementById(
                'lss-toplist-status'
            );

        if (element) {
            element.textContent =
                text;
        }
    }

    function setAllianceResult(text) {
        const element =
            document.getElementById(
                'lss-alliance-result'
            );

        if (element) {
            element.textContent =
                text;
        }
    }

    function setLimit(credits) {
        const element =
            document.getElementById(
                'lss-toplist-limit'
            );

        if (element) {
            element.textContent =
                'Prüfgrenze: ' +
                formatCredits(
                    credits
                ) +
                ' Credits';
        }
    }

    // =========================================================
    // Verbandsweite Tabelle:
    // "Nur nicht gelistete"
    // =========================================================

    function createMissingMembersTable() {
        const originalTable =
            document.querySelector(
                'table.table'
            );

        if (!originalTable) {
            return;
        }

        /*
         * Eventuell bereits vorhandene Ergebnistabelle
         * zuerst entfernen.
         */
        document
            .getElementById(
                'lss-toplist-missing-wrapper'
            )
            ?.remove();

        const wrapper =
            document.createElement(
                'div'
            );

        wrapper.id =
            'lss-toplist-missing-wrapper';

        // =====================================================
        // Keine auffälligen Spieler
        // =====================================================

        if (
            !allianceMissingMembers.length
        ) {
            const info =
                document.createElement(
                    'div'
                );

            info.className =
                'alert alert-success';

            info.textContent =
                'Keine nicht gelisteten Spieler im gesamten Verband gefunden.';

            wrapper.appendChild(
                info
            );

            originalTable.insertAdjacentElement(
                'afterend',
                wrapper
            );

            return;
        }

        // =====================================================
        // Überschrift
        // =====================================================

        const heading =
            document.createElement(
                'div'
            );

        heading.style.marginBottom =
            '8px';

        heading.innerHTML =
            `<strong>${allianceMissingMembers.length} ` +
            `nicht gelistete Spieler im gesamten Verband</strong>`;

        wrapper.appendChild(
            heading
        );

        // =====================================================
        // Tabelle
        // =====================================================

        const table =
            document.createElement(
                'table'
            );

        table.className =
            'table table-striped';

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Verdiente Credits</th>
                    <th>Status</th>
                </tr>
            </thead>

            <tbody></tbody>
        `;

        const tbody =
            table.querySelector(
                'tbody'
            );

        for (
            const member of
            allianceMissingMembers
        ) {
            const row =
                document.createElement(
                    'tr'
                );

            row.style.backgroundColor =
                CONFIG.missingBackground;

            // =================================================
            // Name
            // =================================================

            const nameCell =
                document.createElement(
                    'td'
                );

            const profileLink =
                document.createElement(
                    'a'
                );

            profileLink.href =
                `/profile/${member.id}`;

            profileLink.textContent =
                member.name;

            profileLink.style.color =
                CONFIG.missingColor;

            profileLink.style.fontWeight =
                'bold';

            profileLink.title =
                `Profil von ${member.name} öffnen`;

            nameCell.appendChild(
                profileLink
            );

            // =================================================
            // Credits
            // =================================================

            const creditCell =
                document.createElement(
                    'td'
                );

            creditCell.textContent =
                member.credits !== null
                    ? `${formatCredits(member.credits)} Credits`
                    : '–';

            // =================================================
            // Status
            // =================================================

            const statusCell =
                document.createElement(
                    'td'
                );

            statusCell.textContent =
                '⚠ nicht in Toplist';

            statusCell.style.color =
                CONFIG.missingColor;

            statusCell.style.fontWeight =
                'bold';

            // =================================================
            // Zeile zusammenbauen
            // =================================================

            row.appendChild(
                nameCell
            );

            row.appendChild(
                creditCell
            );

            row.appendChild(
                statusCell
            );

            tbody.appendChild(
                row
            );
        }

        wrapper.appendChild(
            table
        );

        originalTable.insertAdjacentElement(
            'afterend',
            wrapper
        );
    }

    // =========================================================
    // Filter
    // =========================================================

    function setupFilter() {
        const button =
            document.getElementById(
                'lss-toplist-filter'
            );

        if (!button) {
            return;
        }

        let active = false;

        button.addEventListener(
            'click',
            () => {
                const originalTable =
                    document.querySelector(
                        'table.table'
                    );

                if (!originalTable) {
                    return;
                }

                active = !active;

                // =================================================
                // Gesamtverbandsansicht aktivieren
                // =================================================

                if (active) {
                    originalTable.style.display =
                        'none';

                    createMissingMembersTable();

                    /*
                     * Die normale LSS-Pagination gehört zur
                     * ausgeblendeten Tabelle und wird nicht
                     * benötigt.
                     *
                     * Da sie außerhalb der Tabelle liegt,
                     * blenden wir sie separat aus.
                     */
                    setOriginalPaginationVisible(
                        false
                    );

                    button.textContent =
                        'Alle anzeigen';

                    return;
                }

                // =================================================
                // Normale LSS-Mitgliederliste wiederherstellen
                // =================================================

                originalTable.style.display =
                    '';

                document
                    .getElementById(
                        'lss-toplist-missing-wrapper'
                    )
                    ?.remove();

                setOriginalPaginationVisible(
                    true
                );

                button.textContent =
                    'Nur nicht gelistete';
            }
        );
    }

    // =========================================================
    // Originale Pagination finden/ein-/ausblenden
    // =========================================================

    function getOriginalPaginationElements() {
        const result = [];

        /*
         * LSS verwendet je nach Version/Markup Bootstrap-
         * Pagination bzw. Buttons/Links mit ?page=X.
         *
         * Wir suchen deshalb zunächst über die Links und
         * gehen anschließend auf deren gemeinsamen Container.
         */

        const pageLinks = [
            ...document.querySelectorAll(
                'a[href*="/verband/mitglieder/"][href*="page="]'
            )
        ];

        for (
            const link of
            pageLinks
        ) {
            /*
             * Nicht unsere eigene UI berücksichtigen.
             */
            if (
                link.closest(
                    '#lss-toplist-missing-wrapper'
                )
            ) {
                continue;
            }

            const pagination =
                link.closest(
                    '.pagination'
                );

            if (
                pagination &&
                !result.includes(pagination)
            ) {
                result.push(
                    pagination
                );

                continue;
            }

            /*
             * Fallback für das ältere LSS-Markup:
             * Elterncontainer des Seitenlinks.
             */
            const parent =
                link.parentElement;

            if (
                parent &&
                !parent.closest('table') &&
                !result.includes(parent)
            ) {
                result.push(
                    parent
                );
            }
        }

        return result;
    }

    function setOriginalPaginationVisible(
        visible
    ) {
        const elements =
            getOriginalPaginationElements();

        for (
            const element of
            elements
        ) {
            if (visible) {
                element.style.display =
                    element.dataset
                        .lssToplistOldDisplay ||
                    '';

                delete element.dataset
                    .lssToplistOldDisplay;

            } else {
                if (
                    element.style.display
                ) {
                    element.dataset
                        .lssToplistOldDisplay =
                        element.style.display;
                }

                element.style.display =
                    'none';
            }
        }
    }

    // =========================================================
    // Toplist neu laden
    // =========================================================

    function setupRefresh() {
        const button =
            document.getElementById(
                'lss-toplist-refresh'
            );

        if (!button) {
            return;
        }

        button.addEventListener(
            'click',
            () => {
                clearToplistCache();

                location.reload();
            }
        );
    }

    // =========================================================
    // Start
    // =========================================================

    const allianceId =
        getAllianceId();

    if (!allianceId) {
        console.warn(
            '[LSS Toplist Check] Keine Verbands-ID erkannt.'
        );

        return;
    }

    createUI();
    setupFilter();
    setupRefresh();

    try {
        // =====================================================
        // 1. Toplist laden / Cache verwenden
        // =====================================================

        let toplist =
            loadToplistCache();

        if (!toplist) {
            setStatus(
                `Toplist 0 / ${CONFIG.toplistPages} Seiten`
            );

            toplist =
                await loadToplist(
                    (
                        completed,
                        total,
                        players
                    ) => {
                        setStatus(
                            `Toplist ${completed} / ${total} Seiten ` +
                            `(${players} Spieler)`
                        );
                    }
                );

            saveToplistCache(
                toplist.players,
                toplist.minimumCredits
            );

            setStatus(
                `${toplist.players.size} Toplist-Spieler geladen`
            );

        } else {
            setStatus(
                `${toplist.players.size} Toplist-Spieler aus Cache`
            );
        }

        setLimit(
            toplist.minimumCredits
        );

        // =====================================================
        // 2. Aktuell sichtbare Seite markieren
        // =====================================================

        markVisibleMembers(
            toplist
        );

        // =====================================================
        // 3. Alle Mitgliederseiten des Verbandes laden
        // =====================================================

        setAllianceResult(
            'Gesamtverband wird geladen...'
        );

        const allianceData =
            await loadAllAllianceMembers(
                allianceId,

                (
                    completed,
                    total,
                    memberCount
                ) => {
                    setAllianceResult(
                        `Verband ${completed} / ${total} Seiten ` +
                        `(${memberCount} Mitglieder)`
                    );
                }
            );

        // =====================================================
        // 4. Gesamtverband auswerten
        // =====================================================

        const result =
            checkAlliance(
                allianceData.members,
                toplist
            );

        /*
         * Wichtig:
         *
         * Hier speichern wir die Treffer ALLER Mitgliederseiten.
         * Genau diese Liste verwendet anschließend
         * "Nur nicht gelistete".
         */
        allianceMissingMembers =
            result.missingMembers;

        setAllianceResult(
            `Verband: ${result.total} Mitglieder | ` +
            `${result.listed} gelistet | ` +
            `${result.missing} nicht gelistet | ` +
            `${result.outside} außerhalb`
        );

        // =====================================================
        // 5. Filter erst jetzt freigeben
        //
        // Dadurch kann der Benutzer den verbandsweiten Filter
        // erst anklicken, wenn wirklich ALLE Seiten geladen
        // wurden.
        // =====================================================

        const filterButton =
            document.getElementById(
                'lss-toplist-filter'
            );

        if (filterButton) {
            filterButton.disabled =
                false;
        }

        // =====================================================
        // 6. Konsole
        // =====================================================

        console.log(
            '[LSS Toplist Check] Gesamtverband:',
            result
        );

        if (
            allianceMissingMembers.length
        ) {
            console.table(
                allianceMissingMembers.map(
                    member => ({
                        Name:
                            member.name,

                        ID:
                            member.id,

                        Credits:
                            member.credits
                    })
                )
            );
        }

    } catch (error) {
        console.error(
            '[LSS Toplist Check]',
            error
        );

        setStatus(
            'Fehler'
        );

        setAllianceResult(
            error instanceof Error
                ? error.message
                : String(error)
        );
    }

})();