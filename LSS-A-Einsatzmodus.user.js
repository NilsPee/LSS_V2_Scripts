// ==UserScript==
// @name         LSS A Einsatzmodus
// @namespace    NoOne
// @version      1.1.3
// @license      MIT
// @description  Blendet die Gebaeudeliste aus, waehrend Karte und Einsatzlisten aktiv bleiben.
// @author       NoOne & NilsPe
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

  const log = (...args) => {
    if (DEBUG) console.log('[Einsatzmodus]', ...args);
  };

  function isMainPage() {
    return window.location.pathname === '/';
  }

  function removeModeBanners() {
    const remove = () => {
      document.getElementById('einsatzmodusBanner')?.remove();
      document.getElementById('baumodusBanner')?.remove();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', remove, { once: true });
    } else {
      remove();
    }
  }

  if (!isMainPage()) {
    removeModeBanners();
    log('Nicht auf der Hauptseite, Script inaktiv');
    return;
  }

  /*
   * Nur Elemente innerhalb des Gebäude-Panels ausblenden,
   * die zur Gebäudeliste gehören.
   *
   * #buildings und #buildings_outer dürfen NICHT entfernt werden,
   * da dies das komplette Gebäude-Panel betreffen würde.
   */
  function hideBuildingListCss() {
    GM_addStyle(`
      /* Eigentliche Gebäudeliste */
      #building_list {
        display: none !important;
        visibility: hidden !important;
      }

      /* Mobile Suchleiste über der Gebäudeliste */
      #building_list_header_search_mobile {
        display: none !important;
        visibility: hidden !important;
      }

      /* Auswahl-/Filterknöpfe über der Gebäudeliste */
      #btn-group-building-select {
        display: none !important;
        visibility: hidden !important;
      }

      /* Erfolgsmeldungen auf der Hauptseite ausblenden */
      div.alert.alert-success[id^="alert_success_"] {
        display: none !important;
        visibility: hidden !important;
      }

      /*
       * Verhindert unnötigen Leerraum, falls die Seite
       * eine feste Höhe für den Panel-Inhalt setzt.
       */
      #building_panel_body {
        height: auto !important;
        min-height: 0 !important;
      }
    `);
  }

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
      .querySelectorAll('div.alert.alert-success[id^="alert_success_"]')
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

  function addBanner() {
    const insert = () => {
      if (!isMainPage()) {
        removeModeBanners();
        return;
      }

      if (
        !document.body ||
        document.getElementById('einsatzmodusBanner')
      ) {
        return;
      }

      const box = document.createElement('div');

      box.id = 'einsatzmodusBanner';
      box.textContent =
        'Einsatzmodus aktiv - Gebäudeliste ausgeblendet.';

      box.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        background: #222;
        color: #fff;
        border: 1px solid #555;
        border-radius: 10px;
        padding: 8px 14px;
        font: 13px/1.3 Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0, 0, 0, .3);
        pointer-events: none;
      `;

      document.body.appendChild(box);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insert, {
        once: true
      });
    } else {
      insert();
    }
  }

  function installDomCleaner() {
    let cleanupPending = false;

    const cleanup = () => {
      cleanupPending = false;

      if (!isMainPage()) {
        removeModeBanners();
        return;
      }

      removeBuildingList();
      removeSuccessAlerts();
      keepMissionUiVisible();
    };

    const scheduleCleanup = () => {
      if (cleanupPending) return;

      cleanupPending = true;
      requestAnimationFrame(cleanup);
    };

    const start = () => {
      cleanup();

      const observer = new MutationObserver(scheduleCleanup);

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      log('DOM-Beobachter gestartet');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, {
        once: true
      });
    } else {
      start();
    }
  }

  function init() {
    hideBuildingListCss();
    installDomCleaner();
    addBanner();

    log('Einsatzmodus aktiv');
  }

  init();
})();
