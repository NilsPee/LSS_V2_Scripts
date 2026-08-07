// ==UserScript==
// @name         Wachen/Fhz Navigation Hotkeys
// @namespace    bos-ernie.leitstellenspiel.de
// @version      1.3.1
// @license      BSD-3-Clause
// @author       BOS-Ernie & NilsPe
// @description  Hotkeys zum Navigieren zwischen Gebaeuden und Fahrzeugen.
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Wachen-Fhz-Navigation-Hotkeys.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Wachen-Fhz-Navigation-Hotkeys.user.js
// @match        https://*.leitstellenspiel.de/buildings/*
// @match        https://*.leitstellenspiel.de/vehicles/*
// @match        https://*.leitstellenspiel.de/Vehicles/*
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const isTypingContext = element => {
    if (!element) return false;
    if (element.closest('input, textarea, select, [contenteditable="true"]')) {
      return true;
    }

    const role = element.getAttribute?.('role');
    return ['textbox', 'combobox', 'searchbox', 'spinbutton'].includes(role);
  };

  const inBuildings = () => /\/buildings\//i.test(location.pathname);
  const inVehicles = () => /\/vehicles\//i.test(location.pathname);

  const buildDialogIsOpen = () => {
    const form = document.getElementById('new_building');

    if (!form) {
      return false;
    }

    const modal = form.closest('.modal');
    return modal ? modal.offsetParent !== null : form.offsetParent !== null;
  };

  const findBuildingNav = () => {
    const navigation = document.getElementById(
      'building-navigation-container'
    );

    if (!navigation) {
      return { prev: null, next: null, middle: null };
    }

    const successButtons = navigation.querySelectorAll(
      'a.btn-success[href*="/buildings/"]'
    );

    return {
      prev: successButtons[0] || null,
      next: successButtons[1] || null,
      middle: navigation.querySelector(
        'a.btn-default[href*="/buildings/"], ' +
        'a.btn-primary[href*="/buildings/"]'
      )
    };
  };

  const findVehicleNav = () => {
    const left = document
      .querySelector('a.btn span.glyphicon-arrow-left')
      ?.closest('a');
    const right = document
      .querySelector('a.btn span.glyphicon-arrow-right')
      ?.closest('a');
    const clickable = link =>
      link?.classList.contains('btn-success') &&
      link.getAttribute('href') &&
      link.getAttribute('href') !== '#';

    return {
      prev: clickable(left) ? left : null,
      next: clickable(right) ? right : null
    };
  };

  const activate = (event, link) => {
    if (!link) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    link.click();
    return true;
  };

  document.addEventListener('keydown', event => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      event.repeat ||
      isTypingContext(event.target) ||
      buildDialogIsOpen()
    ) {
      return;
    }

    const key = (event.key || '').toLowerCase();
    let prev = null;
    let next = null;
    let middle = null;

    if (inBuildings()) {
      ({ prev, next, middle } = findBuildingNav());
    } else if (inVehicles()) {
      ({ prev, next } = findVehicleNav());
    } else {
      return;
    }

    if ((key === 'a' || key === 'arrowleft') && activate(event, prev)) {
      return;
    }

    if ((key === 'd' || key === 'arrowright') && activate(event, next)) {
      return;
    }

    if (key === 'w' && inBuildings() && activate(event, middle)) {
      return;
    }

    if (key === 's' && inBuildings()) {
      event.preventDefault();
      event.stopPropagation();
      location.assign(
        location.pathname.replace(/\/$/, '') + '/vehicles/new'
      );
    }
  }, { capture: true });
})();
