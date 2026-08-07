// ==UserScript==
// @name         LSS A Baumodus
// @namespace    NoOne
// @version      1.1.3
// @license      MIT
// @description  Reduziert Einsatzliste und Missions-Updates fuer fluessigeres Bauen.
// @author       NoOne & NilsPe
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

  const log = (...args) => {
    if (DEBUG) console.log('[Baumodus]', ...args);
  };

  function isMainPage() {
    return window.location.pathname === '/';
  }

  function removeModeBanners() {
    const remove = () => {
      document.getElementById('baumodusBanner')?.remove();
      document.getElementById('einsatzmodusBanner')?.remove();
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

  function isMissionUrl(url) {
    if (!url) return false;
    const text = String(url);

    // Dinge, die ausdrücklich NICHT geblockt werden sollen
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

    // Nur missionsbezogene Endpunkte
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
        return Promise.resolve(new pageWindow.Response('', {
          status: 204,
          statusText: 'No Content'
        }));
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
            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
          } catch {}
          try {
            xhr.dispatchEvent?.(new pageWindow.Event('readystatechange'));
          } catch {}
          try {
            if (typeof xhr.onload === 'function') xhr.onload();
          } catch {}
          try {
            xhr.dispatchEvent?.(new pageWindow.Event('load'));
          } catch {}
          try {
            xhr.dispatchEvent?.(new pageWindow.Event('loadend'));
          } catch {}
        }, 0);
      };

      Object.defineProperty(xhr, 'readyState', {
        get() {
          return blocked ? blockedReadyState :
            Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'readyState')?.get?.call(xhr) ?? 0;
        },
        configurable: true
      });

      Object.defineProperty(xhr, 'status', {
        get() {
          return blocked ? blockedStatus :
            Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'status')?.get?.call(xhr) ?? 0;
        },
        configurable: true
      });

      Object.defineProperty(xhr, 'responseText', {
        get() {
          return blocked ? blockedResponseText :
            Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'responseText')?.get?.call(xhr) ?? '';
        },
        configurable: true
      });

      Object.defineProperty(xhr, 'response', {
        get() {
          return blocked ? blockedResponse :
            Object.getOwnPropertyDescriptor(OriginalXHR.prototype, 'response')?.get?.call(xhr) ?? null;
        },
        configurable: true
      });

      return xhr;
    };

    pageWindow.XMLHttpRequest.prototype = OriginalXHR.prototype;
    pageWindow.XMLHttpRequest.UNSENT = OriginalXHR.UNSENT;
    pageWindow.XMLHttpRequest.OPENED = OriginalXHR.OPENED;
    pageWindow.XMLHttpRequest.HEADERS_RECEIVED = OriginalXHR.HEADERS_RECEIVED;
    pageWindow.XMLHttpRequest.LOADING = OriginalXHR.LOADING;
    pageWindow.XMLHttpRequest.DONE = OriginalXHR.DONE;
  }

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
      document.querySelectorAll(selector).forEach(el => el.remove());
    }
  }

  function removeSuccessAlerts() {
    document
      .querySelectorAll('div.alert.alert-success[id^="alert_success_"]')
      .forEach(element => element.remove());
  }

  function hideMissionUiCss() {
    GM_addStyle(`
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
    `);
  }

  function addBanner() {
    const insert = () => {
      if (!isMainPage()) {
        removeModeBanners();
        return;
      }

      if (!document.body || document.getElementById('baumodusBanner')) return;

      const box = document.createElement('div');
      box.id = 'baumodusBanner';
      box.textContent = 'Baumodus aktiv - Einsatzliste reduziert, Baumeister bleibt nutzbar.';
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
        box-shadow: 0 2px 10px rgba(0,0,0,.3);
        pointer-events: none;
      `;
      document.body.appendChild(box);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insert, { once: true });
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

      removeMissionUi();
      removeSuccessAlerts();
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
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  function init() {
    hideMissionUiCss();
    installFetchBlocker();
    installXhrBlocker();
    installDomCleaner();
    addBanner();
    log('Baumodus aktiv');
  }

  init();
})();
