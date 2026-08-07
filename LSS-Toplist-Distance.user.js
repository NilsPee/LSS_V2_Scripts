// ==UserScript==
// @name            LSS Toplist Distance
// @namespace       NilsPe.lss.toplist.distance
// @version         2.0.1
// @license         MIT
// @author          Jan (jxn_30) & NilsPe
// @description     Shows credit differences and a bounded history chart on the toplist.
// @description:de  Zeigt Credit-Abstaende und einen begrenzten Verlauf in der Topliste.
// @homepageURL     https://github.com/NilsPee/LSS_V2_Scripts
// @source          https://github.com/jxn-30/LSS-Scripts
// @supportURL      https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL     https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Toplist-Distance.user.js
// @updateURL       https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Toplist-Distance.user.js
// @match           https://www.leitstellenspiel.de/toplist*
// @icon            https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at          document-idle
// @grant           none
// ==/UserScript==

(async function () {
    'use strict';

    const MY_NAME = 'NilsPe';
    const HISTORY_LIMIT = 500;
    const CREDIT_CACHE_MAX_AGE = 5 * 60 * 1000;

    function parseJson(value, fallback) {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    function parseCredits(cell) {
        const match = cell?.textContent?.trim().match(/^\d{1,3}(?:[.,]\d{3})*/);
        return match ? Number(match[0].replace(/\D/g, '')) : null;
    }

    async function currentCredits() {
        let cached = parseJson(sessionStorage.getItem('aCredits'), null);

        if (!cached || cached.lastUpdate < Date.now() - CREDIT_CACHE_MAX_AGE) {
            const response = await fetch('/api/credits', {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error('Credits konnten nicht geladen werden: HTTP ' + response.status);
            }

            cached = {
                lastUpdate: Date.now(),
                value: await response.json()
            };
            sessionStorage.setItem('aCredits', JSON.stringify(cached));
        }

        return Number(cached.value?.credits_user_total ?? 0);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-nilspe-src="' + src + '"]');

            if (existing?.dataset.loaded === 'true') {
                resolve();
                return;
            }

            const script = existing ?? document.createElement('script');
            const timer = setTimeout(
                () => reject(new Error('Zeitueberschreitung beim Laden von ' + src)),
                15000
            );

            script.dataset.nilspeSrc = src;
            script.addEventListener('load', () => {
                clearTimeout(timer);
                script.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            script.addEventListener('error', () => {
                clearTimeout(timer);
                reject(new Error('Konnte ' + src + ' nicht laden'));
            }, { once: true });

            if (!existing) {
                script.src = src;
                document.head.append(script);
            }
        });
    }

    function loadStylesheet(href) {
        if (document.querySelector('link[data-nilspe-href="' + href + '"]')) {
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.nilspeHref = href;
        document.head.append(link);
    }

    const ownTotalCredits = await currentCredits().catch(error => {
        console.warn('[LSS Toplist Distance]', error);
        return 0;
    });
    const memberValues = {};
    const memberNames = {};
    let previousCredits;

    for (const row of document.querySelectorAll('tbody tr')) {
        const creditsCell = row.querySelector('td:nth-of-type(2)');
        const nameCell = row.querySelector('td:nth-of-type(3)');
        const nameLink = nameCell?.querySelector('a');
        const credits = parseCredits(creditsCell);
        const memberId = nameLink?.href?.match(/\d+$/)?.[0];
        const memberName = nameLink?.textContent?.trim();

        if (!creditsCell || !nameCell || credits === null || !memberId || !memberName) {
            continue;
        }

        memberValues[memberId] = credits;
        memberNames[memberId] = memberName;

        const distance = document.createElement('span');
        distance.className = 'nilspe-toplist-distance';
        distance.textContent = (credits - (previousCredits ?? credits)).toLocaleString();
        distance.title = 'Zu mir selbst: ' +
            (credits - ownTotalCredits).toLocaleString();
        distance.style.color = 'red';
        distance.style.marginLeft = '1em';
        creditsCell.append(distance);

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Diff';
        button.className = 'btn btn-default btn-xs';
        button.style.marginLeft = '0.75em';

        button.addEventListener('click', () => {
            const ownRow = [...document.querySelectorAll('tbody tr')].find(candidate =>
                candidate.querySelector('td:nth-of-type(3) a')
                    ?.textContent?.trim() === MY_NAME
            );

            if (!ownRow) {
                alert('Dein Name "' + MY_NAME + '" wurde auf dieser Seite nicht gefunden.');
                return;
            }

            const ownCreditsCell = ownRow.querySelector('td:nth-of-type(2)');
            const ownCredits = parseCredits(ownCreditsCell);

            if (ownCredits === null) {
                return;
            }

            let output = ownRow.querySelector('.toplist-my-diff');

            if (!output) {
                output = document.createElement('span');
                output.className = 'toplist-my-diff';
                output.style.color = 'lime';
                output.style.marginLeft = '1em';
                output.style.fontWeight = 'bold';
                ownCreditsCell.append(output);
            }

            const difference = credits - ownCredits;
            output.textContent = 'zu ' + memberName + ': ' +
                (difference > 0 ? '+' : '') + difference.toLocaleString();
        });

        nameCell.append(button);
        previousCredits = credits;
    }

    const page = document.querySelector('.pagination .active')?.textContent?.trim() || '1';
    const history = parseJson(localStorage.getItem('toplist_history'), {});
    history[page] ??= {};
    const timestamps = Object.keys(history[page]).map(Number).filter(Number.isFinite);
    const latestTimestamp = timestamps.length ? Math.max(...timestamps) : 0;

    if (latestTimestamp < Date.now() - 10 * 60 * 1000) {
        history[page][Date.now()] = memberValues;
    }

    const orderedTimestamps = Object.keys(history[page])
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    for (const timestamp of orderedTimestamps.slice(0, -HISTORY_LIMIT)) {
        delete history[page][timestamp];
    }

    localStorage.setItem('toplist_history', JSON.stringify(history));

    const chartContainer = document.createElement('div');
    chartContainer.id = 'gesamtcredits-chart';
    chartContainer.style.width = '100%';
    chartContainer.style.height = '100vh';
    chartContainer.style.backgroundColor = '#282828';
    document.body.append(chartContainer);

    try {
        await loadScript('https://www.amcharts.com/lib/3/amcharts.js');
        await Promise.all([
            loadScript('https://www.amcharts.com/lib/3/serial.js'),
            loadScript('https://www.amcharts.com/lib/3/themes/dark.js'),
            loadScript('https://www.amcharts.com/lib/3/plugins/export/export.min.js')
        ]);
        loadStylesheet(
            'https://www.amcharts.com/lib/3/plugins/export/export.css'
        );
    } catch (error) {
        console.warn('[LSS Toplist Distance] Diagramm konnte nicht geladen werden:', error);
        chartContainer.remove();
        return;
    }

    if (!window.AmCharts?.AmSerialChart) {
        chartContainer.remove();
        return;
    }

    const shown = new Set(
        parseJson(localStorage.getItem('toplist_history_shown'), [])
    );
    const graphMap = new Map();

    for (const values of Object.values(history[page])) {
        for (const id of Object.keys(values)) {
            if (!graphMap.has(id)) {
                const title = memberNames[id] || id;
                graphMap.set(id, {
                    id,
                    title,
                    valueField: id,
                    hidden: !shown.has(id),
                    lineColor: '#' + colorFromString(title)
                });
            }
        }
    }

    function colorFromString(value = '') {
        let hash = 0;

        for (let index = 0; index < value.length; index++) {
            hash = value.charCodeAt(index) + ((hash << 5) - hash);
        }

        const color = (hash & 0x00ffffff).toString(16).toUpperCase();
        return '000000'.substring(0, 6 - color.length) + color;
    }

    const chart = window.AmCharts.makeChart('gesamtcredits-chart', {
        type: 'serial',
        categoryField: 'date',
        theme: 'dark',
        categoryAxis: {
            minPeriod: 'ss',
            parseDates: true
        },
        chartCursor: {
            enabled: true,
            categoryBalloonDateFormat: 'DD.MM JJ:NN:SS'
        },
        valueAxes: [{
            id: 'ValueAxis-1',
            usePrefixes: true
        }],
        graphs: [...graphMap.values()],
        legend: {
            enabled: true,
            useGraphSettings: true
        },
        titles: [{
            id: 'title',
            size: 15,
            text: 'Verlauf'
        }],
        export: {
            enabled: true
        },
        dataProvider: Object.entries(history[page])
            .sort(([left], [right]) => Number(left) - Number(right))
            .map(([time, data]) => ({
                date: new Date(Number(time)),
                ...data
            }))
    });

    chart.legend.addListener('showItem', ({ dataItem: { id } }) => {
        shown.add(id);
        localStorage.setItem(
            'toplist_history_shown',
            JSON.stringify([...shown])
        );
    });
    chart.legend.addListener('hideItem', ({ dataItem: { id } }) => {
        shown.delete(id);
        localStorage.setItem(
            'toplist_history_shown',
            JSON.stringify([...shown])
        );
    });
})();
