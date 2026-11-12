// ==UserScript==
// @name         LSS Verbandspanel
// @namespace    NilsPe
// @version      1.0.0
// @license      MIT
// @description  Zeigt Verbandsmitglieder mit Online-Status, Rollen und aktuellen Einsatzfreigaben in einem verschiebbaren BigMap-Panel an.
// @author       NilsPe
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Verbandspanel.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-Verbandspanel.user.js
// @match        https://*.leitstellenspiel.de/
// @require      https://raw.githubusercontent.com/LUFSI/framework/refs/heads/main/src/SharedAPIStorage.js
// @grant        unsafeWindow
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

 (() => {
     'use strict';

     const UW = typeof unsafeWindow !== 'undefined'
         ? unsafeWindow
         : window;

     const $ = UW.$ || window.$;

     if (!$) {
         console.warn('[Verbandspanel] jQuery fehlt.');
         return;
     }

     // ============================================
     // EINSTELLUNGEN
     // ============================================

     const CFG = {
         debug: false,
         highlightFriends: false,
         friendsOnTop: false,
         countOwnReleases: true,
         includeSiwa: true,
         includeEvent: false,
         showOfflineAtStart: true,
         membersRefreshSeconds: 300,
         defaultWidth: 520,
         defaultHeight: 520,
         defaultLeft: 90,
         defaultTop: 90,
         borderColor: '#c9302c'
     };

     const STORAGE = {
         position: 'vbp_members_window_position',
         open: 'vbp_members_window_open'
     };

     const log = (...args) => {
         if (CFG.debug) console.log('[Verbandspanel]', ...args);
     };

     const warn = (...args) => {
         if (CFG.debug) console.warn('[Verbandspanel]', ...args);
     };

     const roles = {
         admin: { title: 'Admin', icon: '♛' },
         coadmin: { title: 'Co-Admin', icon: '♚' },
         schooling: { title: 'Lehrgangsmeister', icon: '🕮' },
         finance: { title: 'Finanzminister', icon: '💰' },
         staff: { title: 'Verbands-Personal', icon: '👤' },
         transport_requests: { title: 'Sprechwunsch-Admin', icon: '📣' },
         view_logs: { title: 'Aufsichtsrat', icon: '🔍️' },
         event_manager: { title: 'Eventmanager', icon: '🗓️' }
     };

     // ============================================
     // CSS
     // ============================================

     const style = document.createElement('style');
     style.id = 'vbp-panel-style';

     style.textContent = `
         #bigMapMenu {
             min-width: 280px !important;
             width: 280px !important;
             overflow: visible !important;
             white-space: nowrap !important;
         }

         #bigMapMenu:hover {
             min-width: 280px !important;
             width: 280px !important;
             overflow: visible !important;
         }

         #bigMapMenu #vbp_members_button {
             display: inline-block !important;
             visibility: visible !important;
             opacity: 1 !important;
             pointer-events: auto !important;
             cursor: pointer;
             background-color: #c9302c !important;
         }

         #vbp_members_window {
             box-sizing: border-box;
         }

         #vbp_members_window .panel {
             height: 100%;
             margin: 0;
             overflow: hidden;
         }

         #vbp_members_window .panel-body {
             height: calc(100% - 32px);
             overflow-y: auto;
             padding: 10px;
         }

         #vbp_members_window .vbp-topbar {
             display: flex;
             align-items: center;
             gap: 8px;
             margin-bottom: 8px;
         }

         #vbp_members_window .vbp-topbar input {
             flex: 1;
             min-width: 0;
             font-size: 12px;
             border-radius: 4px;
         }

         #vbp_members_window .vbp-countdown {
             white-space: nowrap;
         }

         #vbp_members_window .vbp-members {
             width: 100%;
         }

         #vbp_members_window .vbp-members td {
             vertical-align: middle;
         }

         #vbp_members_window .vbp-members
         tbody tr.vbp-has-releases > td {
             background-color: rgba(46, 204, 113, 0.18) !important;
             background-image: none !important;
         }

         #vbp_members_window .vbp-members tbody td.vbp-rel {
             font-weight: 700;
             color: #2ecc71;
         }

         #vbp_members_window .vbp-count-cell {
             text-align: center;
             white-space: nowrap;
         }

         #vbp_members_window .vbp-role-cell {
             white-space: nowrap;
         }

         #vbp_members_window .vbp-name-cell {
             overflow-wrap: anywhere;
         }

         #vbp_members_window .vbp-members
         tbody tr[data-online="false"] {
             opacity: 0.85;
         }

         #vbp_members_window .vbp-members
         tbody tr:hover {
             opacity: 1;
         }

         #vbp_members_window .vbp-close {
             color: white;
             font-weight: 700;
             text-decoration: none;
             cursor: pointer;
         }

         #vbp_members_window .vbp-close:hover {
             color: #ddd;
             text-decoration: none;
         }

         #vbp_members_window .big_map_window_head {
             cursor: move;
         }
     `;

     document.head.append(style);

     const wait = ms =>
         new Promise(resolve => setTimeout(resolve, ms));

     // ============================================
     // FENSTERPOSITION – VERSION 3.3
     // ============================================

     let windowPanel = null;

     function saveWindowPosition() {
         try {
             if (!windowPanel) return;

             const wrapper = windowPanel.wrapper;

             if (getComputedStyle(wrapper).display === 'none') {
                 return;
             }

             const data = {
                 left: `${Math.max(0, wrapper.offsetLeft)}px`,
                 top: `${Math.max(0, wrapper.offsetTop)}px`,
                 width: `${Math.max(250, wrapper.offsetWidth)}px`,
                 height: `${Math.max(180, wrapper.offsetHeight)}px`
             };

             localStorage.setItem(
                 STORAGE.position,
                 JSON.stringify(data)
             );

             log('Position gespeichert:', data);

         } catch (error) {
             warn('Speichern fehlgeschlagen:', error);
         }
     }

     function restoreWindowPosition(wrapper) {
         try {
             const raw = localStorage.getItem(STORAGE.position);
             if (!raw) return;

             const data = JSON.parse(raw);

             for (const key of ['left', 'top', 'width', 'height']) {
                 if (data[key]) {
                     wrapper.style.setProperty(key, data[key]);
                 }
             }

             log('Position wiederhergestellt:', data);

         } catch (error) {
             warn('Wiederherstellen fehlgeschlagen:', error);
         }
     }

     // ============================================
     // PANEL ERSTELLEN
     // ============================================

     function createPanel() {
         const wrapper = document.createElement('div');

         wrapper.id = 'vbp_members_window';
         wrapper.classList.add('overview_outer', 'bigMapWindow');

         wrapper.style.setProperty(
             'position',
             'absolute',
             'important'
         );

         wrapper.style.setProperty('padding', '0');

         wrapper.style.setProperty(
             'border',
             `2px solid ${CFG.borderColor}`
         );

         wrapper.style.setProperty('overflow', 'hidden');

         wrapper.style.setProperty(
             'display',
             'none',
             'important'
         );

         wrapper.style.setProperty('z-index', '10000');

         wrapper.style.width = `${CFG.defaultWidth}px`;
         wrapper.style.height = `${CFG.defaultHeight}px`;
         wrapper.style.left = `${CFG.defaultLeft}px`;
         wrapper.style.top = `${CFG.defaultTop}px`;

         const panel = document.createElement('div');
         panel.classList.add('panel', 'panel-default');

         const heading = document.createElement('div');

         heading.classList.add(
             'panel-heading',
             'big_map_window_head'
         );

         heading.style.setProperty('border', 'none');
         heading.style.setProperty('padding', '5px 8px');
         heading.style.setProperty('background-color', '#424242');
         heading.style.setProperty('color', 'white');
         heading.style.setProperty('margin', '0');
         heading.style.setProperty('background-image', 'none');
         heading.style.setProperty('border-radius', '0');
         heading.style.setProperty('display', 'flex');
         heading.style.setProperty('align-items', 'center');

         heading.style.setProperty(
             'justify-content',
             'space-between'
         );

         heading.style.setProperty('gap', '8px');

         const title = document.createElement('span');
         title.textContent = 'Verbandsmitglieder';
         title.style.fontWeight = '700';

         const close = document.createElement('a');
         close.classList.add('vbp-close');
         close.textContent = '×';
         close.title = 'Fenster schließen';

         close.addEventListener('click', event => {
             event.preventDefault();
             closePanel();
         });

         heading.append(title, close);

         const body = document.createElement('div');
         body.classList.add('panel-body');

         panel.append(heading, body);
         wrapper.append(panel);

         // Einbindung hinter dem Funkfenster.
         const radioOuter = document.getElementById('radio_outer');

         if (radioOuter) {
             radioOuter.after(wrapper);
         } else {
             document.body.append(wrapper);
         }

         restoreWindowPosition(wrapper);

         try {
             const jq = UW.$(wrapper);
             const missionWindow = UW.$('#missions_outer');

             if (typeof jq.draggable === 'function') {
                 let options = {};

                 if (
                     missionWindow.length &&
                     missionWindow.data('ui-draggable')
                 ) {
                     options = missionWindow.draggable('option');
                 }

                 jq.draggable({
                     ...options,
                     handle: '.big_map_window_head',
                     scroll: false,
                     stop: () => saveWindowPosition()
                 });
             }

             if (typeof jq.resizable === 'function') {
                 let options = {};

                 if (
                     missionWindow.length &&
                     missionWindow.data('ui-resizable')
                 ) {
                     options = missionWindow.resizable('option');
                 }

                 jq.resizable({
                     ...options,
                     minWidth: 250,
                     minHeight: 180,
                     stop: () => saveWindowPosition()
                 });
             }

         } catch (error) {
             warn('Drag/Resize fehlgeschlagen:', error);
         }

         return { wrapper, panel, heading, body, title };
     }

     windowPanel = createPanel();

     // ============================================
     // DIREKTE FENSTERSTEUERUNG
     // ============================================

     function isPanelVisible() {
         return getComputedStyle(windowPanel.wrapper).display !== 'none';
     }

     function showPanel() {
         const wrapper = windowPanel.wrapper;

         restoreWindowPosition(wrapper);

         wrapper.classList.remove('hidden', 'fadeOut');

         wrapper.style.setProperty(
             'display',
             'block',
             'important'
         );

         wrapper.style.setProperty(
             'visibility',
             'visible',
             'important'
         );

         wrapper.style.setProperty(
             'opacity',
             '1',
             'important'
         );

         wrapper.style.setProperty(
             'position',
             'absolute',
             'important'
         );

         wrapper.style.setProperty(
             'z-index',
             '2147483647',
             'important'
         );

         localStorage.setItem(STORAGE.open, '1');

         log('Panel geöffnet.');
     }

     function closePanel() {
         const wrapper = windowPanel.wrapper;

         if (isPanelVisible()) {
             saveWindowPosition();
         }

         wrapper.style.setProperty(
             'display',
             'none',
             'important'
         );

         localStorage.setItem(STORAGE.open, '0');

         log('Panel geschlossen.');
     }

     function togglePanel() {
         if (isPanelVisible()) {
             closePanel();
         } else {
             showPanel();
         }
     }

     // ============================================
     // SUCHFELD, COUNTDOWN, OFFLINE-SCHALTER
     // ============================================

     const topbar = document.createElement('div');
     topbar.classList.add('vbp-topbar');

     const search = document.createElement('input');
     search.classList.add('search_input_field');
     search.placeholder = 'Suchen...';

     const countdown = document.createElement('span');
     countdown.classList.add('text-muted', 'vbp-countdown');
     countdown.textContent = '5:00';

     const offlineBtn = document.createElement('button');
     offlineBtn.type = 'button';
     offlineBtn.classList.add('btn', 'btn-default', 'btn-xs');

     const offlineImg = document.createElement('img');
     offlineImg.src = '/images/user_gray.png';
     offlineImg.alt = 'Offline';

     offlineBtn.append(offlineImg);
     topbar.append(search, countdown, offlineBtn);

     const table = document.createElement('table');

     table.classList.add(
         'table',
         'table-striped',
         'table-hover',
         'table-condensed',
         'vbp-members'
     );

     const tableBody = document.createElement('tbody');
     table.append(tableBody);

     windowPanel.body.append(topbar, table);

     let showOffline = CFG.showOfflineAtStart;

     function applyFilters() {
         const filter = search.value.trim().toLowerCase();

         for (const row of tableBody.rows) {
             const name = (row.dataset.userName || '').toLowerCase();

             const matchesSearch = name.includes(filter);

             const matchesOnline =
                 showOffline || row.dataset.online === 'true';

             row.style.display =
                 matchesSearch && matchesOnline ? '' : 'none';
         }

         offlineBtn.classList.toggle('active', !showOffline);

         offlineBtn.title = showOffline
             ? 'Offline-Spieler ausblenden'
             : 'Offline-Spieler anzeigen';
     }

     search.addEventListener('input', applyFilters);

     offlineBtn.addEventListener('click', () => {
         showOffline = !showOffline;
         applyFilters();
     });

     // ============================================
     // FREUNDE UND ROLLEN
     // ============================================

     function createRoleFlagSpan(role) {
         const span = document.createElement('span');
         const config = roles[role];

         if (config) {
             span.textContent = config.icon;
             span.title = config.title;
         }

         return span;
     }

     const getFriendsList = () =>
         fetch('/freunde')
             .then(res => res.text())
             .then(html =>
                 Array.from(
                     new DOMParser()
                         .parseFromString(html, 'text/html')
                         .querySelectorAll(
                             'table tbody tr td a[href^="/profile/"]'
                         )
                 ).map(a => a.textContent.trim())
             );

     function getSortingFn(friendsList) {
         return (a, b) => {
             if (CFG.friendsOnTop) {
                 const aFriend = friendsList.includes(a);
                 const bFriend = friendsList.includes(b);

                 if (aFriend && !bFriend) return -1;
                 if (!aFriend && bFriend) return 1;
             }

             return a.localeCompare(b);
         };
     }

     // ============================================
     // FREIGABEN ERMITTELN
     // ============================================

     function hasAnyValue(map) {
         for (const value of map.values()) {
             if (Number.isFinite(value) && value > 0) {
                 return true;
             }
         }

         return false;
     }

     async function getReleasesMap() {
         let tries = 50;

         while (
             (!Array.isArray(UW.mission_markers) ||
              UW.mission_markers.length === 0) &&
             tries-- > 0
         ) {
             await wait(100);
         }

         const listConfig = [
             {
                 id: 'mission_list_alliance',
                 onlyShared: false,
                 fallbackOwn: false
             },
             {
                 id: CFG.includeSiwa
                     ? 'mission_list_sicherheitswache_alliance'
                     : null,
                 onlyShared: false,
                 fallbackOwn: false
             },
             {
                 id: CFG.includeEvent
                     ? 'mission_list_alliance_event'
                     : null,
                 onlyShared: false,
                 fallbackOwn: false
             },
             {
                 id: CFG.countOwnReleases
                     ? 'mission_list'
                     : null,
                 onlyShared: true,
                 fallbackOwn: true
             },
             {
                 id: CFG.countOwnReleases && CFG.includeSiwa
                     ? 'mission_list_sicherheitswache'
                     : null,
                 onlyShared: true,
                 fallbackOwn: true
             }
         ].filter(entry => entry.id);

         function collectMissionEntries({
             id,
             onlyShared,
             fallbackOwn
         }) {
             const root = document.getElementById(id);

             if (!root) return [];

             return Array.from(
                 root.querySelectorAll(
                     '.missionSideBarEntry:not(.mission_deleted)'
                 )
             )
                 .filter(el =>
                     !onlyShared || el.querySelector('.panel-success')
                 )
                 .map(el => ({
                     missionId: el.getAttribute('mission_id'),
                     fallbackOwn
                 }))
                 .filter(entry => entry.missionId)
                 .map(entry => ({
                     ...entry,
                     missionId: String(entry.missionId)
                 }));
         }

         const missionEntries =
             listConfig.flatMap(collectMissionEntries);

         const markers = Array.isArray(UW.mission_markers)
             ? UW.mission_markers
             : [];

         const missionIdToOwner = new Map();

         for (const marker of markers) {
             if (!marker) continue;

             const id = marker.mission_id != null
                 ? String(marker.mission_id)
                 : null;

             if (!id) continue;

             missionIdToOwner.set(id, marker.user_id ?? null);
         }

         const countedMissionIds = new Set();
         const counts = new Map();

         for (const { missionId, fallbackOwn } of missionEntries) {
             if (countedMissionIds.has(missionId)) continue;

             countedMissionIds.add(missionId);

             let userId = missionIdToOwner.get(missionId);

             if (
                 (userId == null || userId === '') &&
                 fallbackOwn
             ) {
                 userId = UW.user_id;
             }

             if (userId == null || userId === '') continue;

             if (
                 !CFG.countOwnReleases &&
                 String(userId) === String(UW.user_id)
             ) {
                 continue;
             }

             const key = String(userId);
             counts.set(key, (counts.get(key) ?? 0) + 1);
         }

         return counts;
     }

     // ============================================
     // FREIGABEN LIVE AKTUALISIEREN
     // ============================================

     let currentRefreshController = null;

     function wireFreigabenAutoRefresh(releaseCells, body) {
         if (currentRefreshController) {
             currentRefreshController.abort();
         }

         const controller = new AbortController();
         currentRefreshController = controller;

         let updating = false;
         let updatePending = false;

         function resortRows() {
             const rows = Array.from(body.rows);

             rows.sort((a, b) => {
                 const aCount = Number(a.dataset.releasesCount || 0);
                 const bCount = Number(b.dataset.releasesCount || 0);

                 if (bCount !== aCount) return bCount - aCount;

                 return (a.dataset.userName || '').localeCompare(
                     b.dataset.userName || ''
                 );
             });

             rows.forEach(row => body.append(row));
             applyFilters();
         }

         async function fillOnce() {
             if (controller.signal.aborted) return new Map();

             if (updating) {
                 updatePending = true;
                 return new Map();
             }

             updating = true;

             try {
                 const map = await getReleasesMap();

                 if (controller.signal.aborted) return map;

                 for (const [userId, cell] of releaseCells) {
                     const row = cell.closest('tr');
                     if (!row) continue;

                     const value = map.get(userId);

                     const count = Number.isFinite(value)
                         ? Number(value)
                         : 0;

                     cell.textContent = String(count);
                     row.dataset.releasesCount = String(count);

                     row.classList.toggle(
                         'vbp-has-releases',
                         count > 0
                     );

                     cell.classList.toggle('vbp-rel', count > 0);
                 }

                 resortRows();
                 return map;

             } catch (error) {
                 warn('Freigabenaktualisierung:', error);
                 return new Map();

             } finally {
                 updating = false;

                 if (updatePending && !controller.signal.aborted) {
                     updatePending = false;
                     setTimeout(fillOnce, 100);
                 }
             }
         }

         fillOnce().then(map => {
             if (controller.signal.aborted || hasAnyValue(map)) return;

             let remaining = 15;

             const retryInterval = setInterval(async () => {
                 if (controller.signal.aborted) {
                     clearInterval(retryInterval);
                     return;
                 }

                 const result = await fillOnce();

                 if (hasAnyValue(result) || --remaining <= 0) {
                     clearInterval(retryInterval);
                 }
             }, 2000);

             controller.signal.addEventListener('abort', () => {
                 clearInterval(retryInterval);
             });
         });

         const listIds = [
             'mission_list_alliance',
             CFG.countOwnReleases ? 'mission_list' : null,
             CFG.includeSiwa
                 ? 'mission_list_sicherheitswache_alliance'
                 : null,
             CFG.countOwnReleases && CFG.includeSiwa
                 ? 'mission_list_sicherheitswache'
                 : null,
             CFG.includeEvent
                 ? 'mission_list_alliance_event'
                 : null
         ].filter(Boolean);

         let mutationTimer = null;

         const observer = new MutationObserver(() => {
             clearTimeout(mutationTimer);
             mutationTimer = setTimeout(fillOnce, 250);
         });

         for (const id of listIds) {
             const element = document.getElementById(id);

             if (element) {
                 observer.observe(element, {
                     childList: true,
                     subtree: true
                 });
             }
         }

         controller.signal.addEventListener('abort', () => {
             observer.disconnect();
             clearTimeout(mutationTimer);
         });

         let lastLength = Array.isArray(UW.mission_markers)
             ? UW.mission_markers.length
             : 0;

         const markerInterval = setInterval(() => {
             if (controller.signal.aborted) {
                 clearInterval(markerInterval);
                 return;
             }

             const length = Array.isArray(UW.mission_markers)
                 ? UW.mission_markers.length
                 : 0;

             if (length !== lastLength) {
                 lastLength = length;
                 fillOnce();
             }
         }, 1000);

         const markerTimeout = setTimeout(() => {
             clearInterval(markerInterval);
         }, 60000);

         controller.signal.addEventListener('abort', () => {
             clearInterval(markerInterval);
             clearTimeout(markerTimeout);
         });
     }

     // ============================================
     // MITGLIEDERLISTE
     // ============================================

     let countdownInterval = null;
     let membersLoading = false;
     let refreshPending = false;

     async function updateMembersList() {
         if (membersLoading) {
             refreshPending = true;
             return;
         }

         if (typeof sharedAPIStorage === 'undefined') {
             console.error('[Verbandspanel] sharedAPIStorage fehlt.');
             return;
         }

         membersLoading = true;

         try {
             const users = await sharedAPIStorage.getAllianceMembers();

             let friendsList = [];

             if (CFG.highlightFriends || CFG.friendsOnTop) {
                 friendsList = await getFriendsList();
             }

             tableBody.replaceChildren();

             let onlineCounter = 0;
             const releaseCells = new Map();
             const sortingFn = getSortingFn(friendsList);

             users
                 .sort(({ name: a }, { name: b }) =>
                     sortingFn(a, b)
                 )
                 .forEach(user => {
                     const row = tableBody.insertRow();

                     const iconCell = row.insertCell();
                     const icon = document.createElement('img');

                     icon.src =
                         `/images/user_${user.online ? 'green' : 'gray'}.png`;

                     iconCell.append(icon);

                     const nameCell = row.insertCell();
                     nameCell.classList.add('vbp-name-cell');

                     const link = document.createElement('a');
                     link.classList.add('lightbox-open');
                     link.href = `/profile/${user.id}`;
                     link.textContent = user.name;

                     if (
                         CFG.highlightFriends &&
                         friendsList.includes(user.name)
                     ) {
                         link.textContent = `🫂 ${link.textContent}`;
                     }

                     nameCell.append(link);

                     const releaseCell = row.insertCell();
                     releaseCell.classList.add('vbp-count-cell');
                     releaseCell.textContent = '…';
                     releaseCell.title =
                         'Aktuell freigegebene Einsätze';

                     releaseCells.set(String(user.id), releaseCell);

                     const roleCell = row.insertCell();
                     roleCell.classList.add('vbp-role-cell');

                     const flags = user.role_flags || {};

                     if (flags.admin) {
                         roleCell.append(createRoleFlagSpan('admin'));
                     } else {
                         roleCell.append(
                             ...Object.keys(flags)
                                 .filter(role => flags[role] && roles[role])
                                 .sort()
                                 .map(createRoleFlagSpan)
                         );
                     }

                     row.dataset.online = String(Boolean(user.online));
                     row.dataset.userName = user.name;
                     row.dataset.releasesCount = '0';

                     if (user.online) onlineCounter++;
                 });

             windowPanel.title.textContent =
                 `Verbandsmitglieder (${onlineCounter}/${users.length})`;

             applyFilters();
             wireFreigabenAutoRefresh(releaseCells, tableBody);

             if (countdownInterval) {
                 clearInterval(countdownInterval);
             }

             let seconds = CFG.membersRefreshSeconds;

             const updateCountdown = () => {
                 countdown.textContent =
                     `${Math.floor(seconds / 60)}:` +
                     `${String(seconds % 60).padStart(2, '0')}`;
             };

             updateCountdown();

             countdownInterval = setInterval(() => {
                 seconds--;
                 updateCountdown();

                 if (seconds <= 0) {
                     clearInterval(countdownInterval);
                     updateMembersList();
                 }
             }, 1000);

         } catch (error) {
             console.error(
                 '[Verbandspanel] Mitglieder konnten nicht geladen werden:',
                 error
             );

         } finally {
             membersLoading = false;

             if (refreshPending) {
                 refreshPending = false;
                 setTimeout(updateMembersList, 250);
             }
         }
     }

     // ============================================
     // LIVE-REFRESH
     // ============================================

     function scheduleMembersRefresh() {
         clearTimeout(UW.__vbpMembersRefreshTimer);

         UW.__vbpMembersRefreshTimer = setTimeout(() => {
             updateMembersList();
         }, 150);
     }

     try {
         const originalAdd = UW.missionMarkerAdd;

         if (typeof originalAdd === 'function') {
             UW.missionMarkerAdd = function (...args) {
                 const result = originalAdd.apply(this, args);
                 scheduleMembersRefresh();
                 return result;
             };
         }
     } catch (error) {
         warn('missionMarkerAdd:', error);
     }

     try {
         const originalDelete = UW.missionDelete;

         if (typeof originalDelete === 'function') {
             UW.missionDelete = function (...args) {
                 const result = originalDelete.apply(this, args);
                 scheduleMembersRefresh();
                 return result;
             };
         }
     } catch (error) {
         warn('missionDelete:', error);
     }

     // ============================================
     // BIGMAP-BUTTON
     // ============================================

     const button = document.createElement('img');

     button.id = 'vbp_members_button';
     button.src = '/images/alliance.svg';
     button.alt = 'Verbandspanel';
     button.title = 'Verbandsmitglieder';
     button.classList.add('bigMapMenuButton');

     button.addEventListener('click', event => {
         event.preventDefault();
         event.stopPropagation();
         togglePanel();
     });

     function attachBigMapButton() {
         const menu = document.querySelector('#bigMapMenu');

         if (!menu) return false;

         if (button.parentElement !== menu) {
             menu.append(button);
             log('BigMap-Button eingefügt.');
         }

         menu.style.setProperty(
             'width',
             '280px',
             'important'
         );

         menu.style.setProperty(
             'min-width',
             '280px',
             'important'
         );

         Array.from(menu.childNodes)
             .filter(node => node.nodeType === 3)
             .forEach(node => node.remove());

         return true;
     }

     const buttonInitInterval = setInterval(() => {
         if (attachBigMapButton()) {
             clearInterval(buttonInitInterval);
         }
     }, 250);

     let buttonCheckScheduled = false;

     const menuObserver = new MutationObserver(() => {
         if (buttonCheckScheduled) return;

         buttonCheckScheduled = true;

         setTimeout(() => {
             buttonCheckScheduled = false;

             const menu = document.querySelector('#bigMapMenu');

             if (menu && button.parentElement !== menu) {
                 attachBigMapButton();
             }
         }, 100);
     });

     menuObserver.observe(document.body, {
         childList: true,
         subtree: true
     });

     setInterval(() => {
         const menu = document.querySelector('#bigMapMenu');

         if (menu && button.parentElement !== menu) {
             attachBigMapButton();
         }
     }, 3000);

     // ============================================
     // FENSTERSTATUS WIEDERHERSTELLEN
     // ============================================

     if (localStorage.getItem(STORAGE.open) === '1') {
         showPanel();
     }

     window.addEventListener('beforeunload', () => {
         if (isPanelVisible()) {
             saveWindowPosition();
         }
     });

     // ============================================
     // START
     // ============================================

     updateMembersList();

     log('Verbandspanel 3.3 gestartet.');

 })();