
// ==UserScript==
// @name         LSS A Einsatzmodus
// @namespace    nilspe.einsatzmodus
// @version      1.1.6
// @license      MIT
// @description  Blendet die Gebaeudeliste aus, waehrend Karte und Einsatzlisten aktiv bleiben.
// @author       NilsPe
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-A-Einsatzmodus.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-A-Einsatzmodus.user.js
// @match        https://*.leitstellenspiel.de/
// @grant        GM_addStyle
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const DEBUG = false;
  const HEADER_ID = 'einsatzmodusWindowHeader';
  const WINDOW_ID = 'buildings_outer';

  const log = (...args) => {
    if (DEBUG) console.log('[Einsatzmodus]', ...args);
  };

  const isMainPage = () => location.pathname === '/';

  function removeOldBanners() {
    document.getElementById('einsatzmodusBanner')?.remove();
    document.getElementById('baumodusBanner')?.remove();
  }

  if (!isMainPage()) {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        removeOldBanners,
        { once: true }
      );
    } else {
      removeOldBanners();
    }
    return;
  }

  // ============================================
  // CSS
  // ============================================

  function installCss() {
    GM_addStyle(`
      /* Gebäudeliste und originale Bedienelemente */
      #building_list,
      #building_list_header_search_mobile,
      #btn-group-building-select {
        display: none !important;
        visibility: hidden !important;
      }

      /* Erfolgsmeldungen wie bisher ausblenden */
      div.alert.alert-success[id^="alert_success_"] {
        display: none !important;
        visibility: hidden !important;
      }

      /*
       * Gebäudefenster vollständig leeren.
       * Fensterkopf und Resize-Handles bleiben erhalten.
       */
      #${WINDOW_ID} > :not(#${HEADER_ID}):not(.big_map_window_head):not(.ui-resizable-handle) {
        display: none !important;
      }

      /* Neuer Header direkt im Gebäudefenster */
      #${WINDOW_ID} > #${HEADER_ID} {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        box-sizing: border-box;
        width: 100%;
        margin: 0;
        padding: 8px 10px;
        background: #333;
        color: #fff;
        border: 1px solid #555;
        border-radius: 3px;
        text-align: center;
        font: 600 12px/1.4 Arial, sans-serif;
        z-index: 2;
      }
    `);
  }

  // ============================================
  // HEADER DIREKT IM GEBÄUDEFENSTER
  // ============================================

  function installWindowHeader() {
    const outer = document.getElementById(WINDOW_ID);
    if (!outer) return;

    let header = document.getElementById(HEADER_ID);

    if (!header) {
      header = document.createElement('div');
      header.id = HEADER_ID;
      header.textContent =
        'Einsatzmodus - Gebäudeliste ausgeblendet';
    }

    // Nicht mehr in #building_panel_body einsetzen,
    // da dieser Bereich ausgeblendet werden kann.
    if (header.parentElement !== outer) {
      const titleBar = Array.from(outer.children).find(
        child => child.matches('.big_map_window_head')
      );

      if (titleBar) {
        titleBar.after(header);
      } else {
        outer.prepend(header);
      }
    }
  }

  // ============================================
  // BISHERIGE GEBÄUDEBEREINIGUNG
  // ============================================

  function removeBuildingList() {
    const ids = [
      'building_list',
      'building_list_header_search_mobile',
      'btn-group-building-select'
    ];

    for (const id of ids) {
      document.getElementById(id)?.remove();
    }
  }

  function removeSuccessAlerts() {
    document
      .querySelectorAll(
        'div.alert.alert-success[id^="alert_success_"]'
      )
      .forEach(element => element.remove());
  }

  function keepMissionUiVisible() {
    const ids = [
      'missions-panel',
      'missions-panel-main',
      'mission_list',
      'mission_list_alliance',
      'mission_list_alliance_event',
      'mission_list_sicherheitswache',
      'mission_list_sicherheitswache_alliance',
      'mission_list_combined'
    ];

    for (const id of ids) {
      const element = document.getElementById(id);

      if (element) {
        element.style.removeProperty('display');
        element.style.removeProperty('visibility');
      }
    }
  }

  // ============================================
  // DOM-BEOBACHTER
  // ============================================

  function installDomCleaner() {
    let pending = false;

    function cleanup() {
      pending = false;

      removeOldBanners();
      removeBuildingList();
      removeSuccessAlerts();
      keepMissionUiVisible();
      installWindowHeader();
    }

    function scheduleCleanup() {
      if (pending) return;

      pending = true;
      requestAnimationFrame(cleanup);
    }

    function start() {
      cleanup();

      const observer = new MutationObserver(scheduleCleanup);

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      log('DOM-Beobachter gestartet');
    }

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        start,
        { once: true }
      );
    } else {
      start();
    }
  }

  installCss();
  installDomCleaner();

  log('Einsatzmodus 1.1.6 aktiv');
})();
