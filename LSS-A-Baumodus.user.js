
// ==UserScript==
// @name         LSS A Baumodus
// @namespace    nilspe.baumodus
// @version      1.1.6
// @license      MIT
// @description  Reduziert Einsatzliste und Missions-Updates fuer fluessigeres Bauen.
// @author       NilsPe
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-A-Baumodus.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/LSS-A-Baumodus.user.js
// @match        https://*.leitstellenspiel.de/
// @grant        GM_addStyle
// @grant        unsafeWindow
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const pageWindow = unsafeWindow;
  const DEBUG = false;
  const HEADER_ID = 'baumodusWindowHeader';
  const WINDOW_ID = 'missions_outer';

  const log = (...args) => {
    if (DEBUG) console.log('[Baumodus]', ...args);
  };

  const isMainPage = () => location.pathname === '/';

  function removeOldBanners() {
    document.getElementById('baumodusBanner')?.remove();
    document.getElementById('einsatzmodusBanner')?.remove();
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
  // MISSIONS-REQUESTS UNTERDRÜCKEN
  // ============================================

  function isMissionUrl(url) {
    if (!url) return false;

    const text = String(url);

    if (
      text.includes('/api/buildings') ||
      text.includes('/buildings') ||
      text.includes('/alliance_buildings') ||
      text.includes('/schools') ||
      text.includes('/vehicles') ||
      text.includes('/settings') ||
      text.includes('/profile') ||
      text.includes('/credits') ||
      text.includes('/map') ||
      text.includes('/api/v1/buildings')
    ) {
      return false;
    }

    return (
      /\/missions(\?|$|\/)/i.test(text) ||
      /\/mission_markers(\?|$|\/)/i.test(text) ||
      /\/mission_list/i.test(text) ||
      /\/mission_lists/i.test(text) ||
      /\/alliance_missions/i.test(text)
    );
  }

  function installFetchBlocker() {
    const originalFetch = pageWindow.fetch;

    if (typeof originalFetch !== 'function') return;

    pageWindow.fetch = function (...args) {
      const resource = args[0];

      const url = typeof resource === 'string'
        ? resource
        : resource?.url || '';

      if (isMissionUrl(url)) {
        log('fetch geblockt:', url);

        return Promise.resolve(
          new pageWindow.Response(null, {
            status: 204,
            statusText: 'No Content'
          })
        );
      }

      return originalFetch.apply(this, args);
    };
  }

  function installXhrBlocker() {
    const OriginalXHR = pageWindow.XMLHttpRequest;
    if (!OriginalXHR) return;

    pageWindow.XMLHttpRequest = function () {
      const xhr = new OriginalXHR();

      let blocked = false;
      let blockedReadyState = 0;
      let blockedStatus = 0;
      let blockedResponseText = '';
      let blockedResponse = '';

      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      xhr.open = function (method, url, ...rest) {
        blocked = isMissionUrl(url);

        if (blocked) {
          blockedReadyState = 1;
          xhr._baumodus_blocked_url = url;
          log('xhr geblockt:', url);
          return;
        }

        return originalOpen.call(this, method, url, ...rest);
      };

      xhr.send = function (...args) {
        if (!blocked) {
          return originalSend.apply(this, args);
        }

        blockedStatus = 204;
        blockedReadyState = 4;
        blockedResponseText = '';
        blockedResponse = '';

        setTimeout(() => {
          try {
            if (typeof xhr.onreadystatechange === 'function') {
              xhr.onreadystatechange();
            }
          } catch {}

          try {
            xhr.dispatchEvent?.(
              new pageWindow.Event('readystatechange')
            );
          } catch {}

          try {
            if (typeof xhr.onload === 'function') {
              xhr.onload();
            }
          } catch {}

          try {
            xhr.dispatchEvent?.(
              new pageWindow.Event('load')
            );
          } catch {}

          try {
            xhr.dispatchEvent?.(
              new pageWindow.Event('loadend')
            );
          } catch {}
        }, 0);
      };

      Object.defineProperty(xhr, 'readyState', {
        get() {
          return blocked
            ? blockedReadyState
            : Object.getOwnPropertyDescriptor(
                OriginalXHR.prototype,
                'readyState'
              )?.get?.call(xhr) ?? 0;
        },
        configurable: true
      });

      Object.defineProperty(xhr, 'status', {
        get() {
          return blocked
            ? blockedStatus
            : Object.getOwnPropertyDescriptor(
                OriginalXHR.prototype,
                'status'
              )?.get?.call(xhr) ?? 0;
        },
        configurable: true
      });

      Object.defineProperty(xhr, 'responseText', {
        get() {
          return blocked
            ? blockedResponseText
            : Object.getOwnPropertyDescriptor(
                OriginalXHR.prototype,
                'responseText'
              )?.get?.call(xhr) ?? '';
        },
        configurable: true
      });

      Object.defineProperty(xhr, 'response', {
        get() {
          return blocked
            ? blockedResponse
            : Object.getOwnPropertyDescriptor(
                OriginalXHR.prototype,
                'response'
              )?.get?.call(xhr) ?? null;
        },
        configurable: true
      });

      return xhr;
    };

    pageWindow.XMLHttpRequest.prototype = OriginalXHR.prototype;
    pageWindow.XMLHttpRequest.UNSENT = OriginalXHR.UNSENT;
    pageWindow.XMLHttpRequest.OPENED = OriginalXHR.OPENED;
    pageWindow.XMLHttpRequest.HEADERS_RECEIVED =
      OriginalXHR.HEADERS_RECEIVED;
    pageWindow.XMLHttpRequest.LOADING = OriginalXHR.LOADING;
    pageWindow.XMLHttpRequest.DONE = OriginalXHR.DONE;
  }

  // ============================================
  // CSS
  // ============================================

  function installCss() {
    GM_addStyle(`
      /* Bisherige Einsatzlisten ausblenden */
      #missions-panel,
      #missions-panel-main,
      #mission_list,
      #mission_list_alliance,
      #mission_list_alliance_event,
      #mission_list_sicherheitswache,
      #mission_list_sicherheitswache_alliance,
      #mission_list_combined,
      .mission-panel,
      .mission_side_bar,
      .missionSideBar,
      .mission-list,
      .missionMarkerPanel,
      div.alert.alert-success[id^="alert_success_"] {
        display: none !important;
        visibility: hidden !important;
      }

      /*
       * Gesamte originale Einsatzoberfläche ausblenden.
       * Nur der neue Header, die Fenster-Titelleiste
       * und Resize-Handles bleiben erhalten.
       */
      #${WINDOW_ID} > :not(#${HEADER_ID}):not(.big_map_window_head):not(.ui-resizable-handle) {
        display: none !important;
      }

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
  // EINSATZFENSTER BEREINIGEN
  // ============================================

  function removeMissionUi() {
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
      document.getElementById(id)?.remove();
    }

    const selectors = [
      '.mission-panel',
      '.mission_side_bar',
      '.missionSideBar',
      '.mission-list',
      '.missionMarkerPanel'
    ];

    for (const selector of selectors) {
      document
        .querySelectorAll(selector)
        .forEach(element => element.remove());
    }
  }

  function removeSuccessAlerts() {
    document
      .querySelectorAll(
        'div.alert.alert-success[id^="alert_success_"]'
      )
      .forEach(element => element.remove());
  }

  // ============================================
  // HEADER DIREKT IM EINSATZFENSTER
  // ============================================

  function installWindowHeader() {
    const outer = document.getElementById(WINDOW_ID);
    if (!outer) return;

    let header = document.getElementById(HEADER_ID);

    if (!header) {
      header = document.createElement('div');
      header.id = HEADER_ID;
      header.textContent =
        'Baumodus - Einsatzliste ausgeblendet';
    }

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
  // DOM-BEOBACHTER
  // ============================================

  function installDomCleaner() {
    let pending = false;

    function cleanup() {
      pending = false;

      removeOldBanners();
      removeMissionUi();
      removeSuccessAlerts();
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

  // ============================================
  // START
  // ============================================

  installCss();
  installFetchBlocker();
  installXhrBlocker();
  installDomCleaner();

  log('Baumodus 1.1.6 aktiv');
})();
