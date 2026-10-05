// ==UserScript==
// @name         Gebaeude Personnel Selector
// @namespace    NilsPe.personnel.Selector
// @version      2.0.1
// @description  Schnellauswahl von Personal zur Übernahme mit Lehrgangsfilter und nur ungebundenem Personal
// @author       NilsPe
// @license      MIT
// @homepageURL  https://github.com/NilsPee/LSS_V2_Scripts
// @supportURL   https://github.com/NilsPee/LSS_V2_Scripts/issues
// @downloadURL  https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Gebaeude-Personnel-Selector.user.js
// @updateURL    https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/Gebaeude-Personnel-Selector.user.js
// @match        https://*.leitstellenspiel.de/buildings/*/hire
// @match        https://*.leitstellenspiel.de/settings/index*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        unsafeWindow
// @require      https://raw.githubusercontent.com/NilsPee/LSS_V2_Scripts/main/NilsPe-Skriptbasis.user.js?v=1.0.13
// @icon         https://raw.githubusercontent.com/NilsPee/Profil_Picture/main/NilsPe_Profile.png
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  const SETTINGS_IDENTIFIER = 'nilspe_personnel_transfer';

  const KEYS = {
    quickValues: 'nilspe_pt_quick_values'
  };

  const DEFAULT_QUICK_VALUES =
    '1,2,3,4,5,6,7,8,9,10,15,20,30,40,50,60';

  const FILTER_ANY = '__ANY__';
  const FILTER_NONE = '__NONE__';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function isHirePage() {
    return /\/buildings\/\d+\/hire$/.test(location.pathname);
  }

  function headingOf(id) {
    return document.querySelector(
      `.panel-heading[building_id="${id}"]`
    );
  }

  function bodyOf(id) {
    return document.querySelector(
      `.panel-body[building_id="${id}"]`
    );
  }

  function filterId(id) {
    return `transfer-filter-${id}`;
  }

  function assignerId(id) {
    return `transfer-assigner-${id}`;
  }

  function counterId(id) {
    return `transfer-selection-counter-${id}`;
  }

  const courseCache = new Map();

  // ============================================================
  // Einstellungen
  // ============================================================

  function parseQuickValues(value) {
    const numbers = String(value ?? '')
      .split(/[,;\s]+/)
      .map(Number)
      .filter(value =>
        Number.isInteger(value) &&
        value > 0
      );

    return [...new Set(numbers)];
  }

  async function quickValues() {
    const stored = await GM.getValue(
      KEYS.quickValues,
      DEFAULT_QUICK_VALUES
    );

    const parsed = parseQuickValues(stored);

    return parsed.length
      ? parsed
      : parseQuickValues(DEFAULT_QUICK_VALUES);
  }

  async function createSettings() {
    if (typeof addOptions !== 'function') {
      console.error(
        '[Personalübernahme] addOptions wurde nicht gefunden.'
      );
      return;
    }

    await addOptions({
      identifier: SETTINGS_IDENTIFIER,
      title: 'Personalübernahme',

      settings: [
        {
          type: 'header',
          text: 'Schnellauswahl'
        },
        {
          type: 'text',
          key: KEYS.quickValues,
          label: 'Personenanzahl-Buttons',
          info:
            'Kommagetrennte Werte, z. B. 1,2,3,4,5,10,15,20,30.',
          default: DEFAULT_QUICK_VALUES
        }
      ]
    });
  }

  // ============================================================
  // Gebäudeblöcke
  // ============================================================

  function getHref(id) {
    const heading = headingOf(id);

    if (!heading) {
      return null;
    }

    const link = heading.querySelector('a[href]');

    return link?.getAttribute('href') ?? null;
  }

  async function ensurePanelLoadedAndOpen(id) {
    const heading = headingOf(id);
    const body = bodyOf(id);

    if (!heading || !body) {
      return null;
    }

    const href = getHref(id);

    if (body.classList.contains('hidden')) {
      body.classList.remove('hidden');
    }

    const page =
      typeof unsafeWindow !== 'undefined'
        ? unsafeWindow
        : window;

    const loadedBuildings =
      page.loadedBuildings;

    if (
      href &&
      Array.isArray(loadedBuildings) &&
      !loadedBuildings.includes(href)
    ) {
      loadedBuildings.push(href);

      const jq =
        page.jQuery ??
        page.$;

      if (typeof jq === 'function') {
        await new Promise((resolve, reject) => {
          const request = jq.get(
            href,
            html => {
              const liveBody = bodyOf(id);

              if (liveBody) {
                liveBody.innerHTML = html;
              }

              resolve();
            }
          );

          if (
            request &&
            typeof request.fail === 'function'
          ) {
            request.fail(reject);
          }
        });
      }
    }

    return body;
  }

  // ============================================================
  // Tabelle analysieren
  // ============================================================

  function findColumnIndexByHeader(scope) {
    const table =
      scope.querySelector('table') ??
      scope.closest('table');

    if (!table) {
      return {
        idxAusbildung: -1,
        idxGebunden: -1
      };
    }

    const thead =
      table.querySelector('thead');

    const headers =
      thead
        ? $$('th', thead)
        : $$(
            'tbody tr:first-child th, tbody tr:first-child td',
            table
          );

    const normalize = text =>
      String(text ?? '')
        .trim()
        .toLowerCase();

    let idxAusbildung = -1;
    let idxGebunden = -1;

    headers.forEach((th, index) => {
      const text =
        normalize(th.textContent);

      if (
        idxAusbildung < 0 &&
        /ausbildung|opleiding|training/.test(text)
      ) {
        idxAusbildung = index;
      }

      if (
        idxGebunden < 0 &&
        /(gebunden|gebonden|bound)/.test(text)
      ) {
        idxGebunden = index;
      }
    });

    return {
      idxAusbildung,
      idxGebunden
    };
  }

  function collectCourses(
    scope,
    idxAusbildung
  ) {
    if (idxAusbildung < 0) {
      return [];
    }

    const table =
      scope.querySelector('table') ??
      scope.closest('table') ??
      scope;

    const courses = new Set();

    $$('tbody tr', table).forEach(row => {
      const cells =
        $$('td', row);

      const text =
        String(
          cells[idxAusbildung]?.textContent ??
          ''
        ).trim();

      if (text) {
        courses.add(text);
      }
    });

    return [...courses].sort(
      (a, b) =>
        a.localeCompare(
          b,
          undefined,
          {
            sensitivity: 'base'
          }
        )
    );
  }

  // ============================================================
  // Lehrgänge laden
  // ============================================================

  async function fetchCoursesOffDOM(id) {
    if (courseCache.has(id)) {
      return courseCache.get(id);
    }

    const liveBody =
      bodyOf(id);

    if (
      liveBody &&
      !liveBody.classList.contains('hidden') &&
      liveBody.querySelector('table')
    ) {
      const scope =
        liveBody.querySelector('tbody') ??
        liveBody;

      const {
        idxAusbildung
      } =
        findColumnIndexByHeader(scope);

      const courses =
        collectCourses(
          scope,
          idxAusbildung
        );

      courseCache.set(
        id,
        courses
      );

      return courses;
    }

    const href =
      getHref(id);

    if (!href) {
      return [];
    }

    const page =
      typeof unsafeWindow !== 'undefined'
        ? unsafeWindow
        : window;

    const jq =
      page.jQuery ??
      page.$;

    if (typeof jq !== 'function') {
      return [];
    }

    const html =
      await new Promise((resolve, reject) => {
        const request =
          jq.get(
            href,
            data => resolve(data)
          );

        if (
          request &&
          typeof request.fail === 'function'
        ) {
          request.fail(reject);
        }
      });

    const temporary =
      document.createElement('div');

    temporary.innerHTML =
      html;

    const scope =
      temporary.querySelector('tbody') ??
      temporary;

    const {
      idxAusbildung
    } =
      findColumnIndexByHeader(scope);

    const courses =
      collectCourses(
        scope,
        idxAusbildung
      );

    courseCache.set(
      id,
      courses
    );

    return courses;
  }

  // ============================================================
  // Auswahlzähler
  // ============================================================

  function countCheckedIn(scope) {
    return $$(
      'input[type="checkbox"]',
      scope
    ).filter(
      checkbox =>
        checkbox.checked
    ).length;
  }

  function updateCounter(id, value) {
    let badge =
      document.getElementById(
        counterId(id)
      );

    if (!badge) {
      badge =
        document.createElement('span');

      badge.id =
        counterId(id);

      badge.className =
        'label label-primary';

      badge.style.marginLeft =
        '6px';

      const group =
        document.getElementById(
          assignerId(id)
        );

      if (group) {
        group.after(badge);
      }
    }

    badge.textContent =
      `${value} ausgewählt`;
  }

  // ============================================================
  // Filter
  // ============================================================

  function currentFilter(id) {
    const select =
      document.getElementById(
        filterId(id)
      );

    return (
      select?.value ??
      FILTER_NONE
    );
  }

  async function populateFilterOptions(id) {
    const select =
      document.getElementById(
        filterId(id)
      );

    if (!select) {
      return;
    }

    const previous =
      select.value;

    const courses =
      await fetchCoursesOffDOM(id);

    select.replaceChildren();

    function add(value, text) {
      const option =
        document.createElement('option');

      option.value =
        value;

      option.textContent =
        text;

      select.append(option);
    }

    add(
      FILTER_NONE,
      'Ohne Ausbildung'
    );

    add(
      FILTER_ANY,
      'Beliebig'
    );

    courses.forEach(
      course =>
        add(course, course)
    );

    if (
      [...select.options].some(
        option =>
          option.value === previous
      )
    ) {
      select.value =
        previous;
    }
  }

  function stopToggle(element) {
    [
      'click',
      'mousedown',
      'mouseup',
      'dblclick',
      'keydown'
    ].forEach(eventName => {
      element.addEventListener(
        eventName,
        event => {
          event.stopPropagation();
        },
        true
      );
    });
  }

  function ensureFilterUI(id) {
    if (
      document.getElementById(
        filterId(id)
      )
    ) {
      return;
    }

    const heading =
      headingOf(id);

    if (!heading) {
      return;
    }

    const wrapper =
      document.createElement('span');

    wrapper.style.marginRight =
      '6px';

    const select =
      document.createElement('select');

    select.id =
      filterId(id);

    select.className =
      'form-control input-sm';

    select.style.display =
      'inline-block';

    select.style.width =
      'auto';

    select.style.marginRight =
      '6px';

    const initialOptions = [
      {
        value: FILTER_NONE,
        text: 'Ohne Ausbildung'
      },
      {
        value: FILTER_ANY,
        text: 'Beliebig'
      }
    ];

    for (const item of initialOptions) {
      const option =
        document.createElement('option');

      option.value =
        item.value;

      option.textContent =
        item.text;

      select.append(option);
    }

    stopToggle(select);

    select.addEventListener(
      'mousedown',
      () => {
        void populateFilterOptions(id);
      }
    );

    select.addEventListener(
      'focus',
      () => {
        void populateFilterOptions(id);
      },
      true
    );

    select.addEventListener(
      'change',
      () => {
        const body =
          bodyOf(id);

        if (body) {
          updateCounter(
            id,
            countCheckedIn(body)
          );
        }
      }
    );

    wrapper.append(select);

    const target =
      heading.querySelector('a') ??
      heading;

    target.append(wrapper);
  }

  // ============================================================
  // Personal auswählen
  // ============================================================

  async function selectN(id, number) {
    const body =
      await ensurePanelLoadedAndOpen(id);

    if (!body) {
      return;
    }

    const scope =
      body.querySelector('tbody') ??
      body;

    const {
      idxAusbildung,
      idxGebunden
    } =
      findColumnIndexByHeader(scope);

    const wantedFilter =
      currentFilter(id);

    let remaining =
      Number(number);

    $$('tr', scope).forEach(row => {
      if (remaining <= 0) {
        return;
      }

      const checkbox =
        row.querySelector(
          'input[type="checkbox"]'
        );

      if (
        !checkbox ||
        checkbox.disabled ||
        checkbox.checked
      ) {
        return;
      }

      const cells =
        $$('td', row);

      const educationText =
        String(
          cells[idxAusbildung]
            ?.textContent ??
          ''
        ).trim();

      const boundText =
        String(
          cells[idxGebunden]
            ?.textContent ??
          ''
        ).trim();

      // Nur ungebundenes Personal
      if (
        idxGebunden >= 0 &&
        boundText !== ''
      ) {
        return;
      }

      // Ohne Ausbildung
      if (
        wantedFilter === FILTER_NONE
      ) {
        if (
          idxAusbildung >= 0 &&
          educationText !== ''
        ) {
          return;
        }
      }

      // Bestimmter Lehrgang
      else if (
        wantedFilter !== FILTER_ANY
      ) {
        if (
          idxAusbildung >= 0 &&
          !educationText.includes(
            wantedFilter
          )
        ) {
          return;
        }
      }

      checkbox.checked =
        true;

      remaining--;
    });

    updateCounter(
      id,
      countCheckedIn(body)
    );
  }

  // ============================================================
  // Reset
  // ============================================================

  async function resetSelection(id) {
    const body =
      await ensurePanelLoadedAndOpen(id);

    if (!body) {
      return;
    }

    $$(
      'input[type="checkbox"]',
      body
    ).forEach(checkbox => {
      checkbox.checked =
        false;
    });

    updateCounter(
      id,
      0
    );
  }

  // ============================================================
  // Buttons
  // ============================================================

  function addQuickButton(
    group,
    label,
    handler
  ) {
    const button =
      document.createElement('button');

    button.type =
      'button';

    button.className =
      'btn btn-default btn-sm';

    button.textContent =
      label;

    button.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();

        void handler();
      }
    );

    group.append(button);
  }

  async function makeButtons(id) {
    document.getElementById(
      assignerId(id)
    )?.remove();

    const group =
      document.createElement('div');

    group.id =
      assignerId(id);

    group.className =
      'btn-group btn-group-sm';

    const resetButton =
      document.createElement('button');

    resetButton.type =
      'button';

    resetButton.className =
      'btn btn-default btn-sm';

    resetButton.title =
      'Auswahl zurücksetzen';

    const trash =
      document.createElement('span');

    trash.className =
      'glyphicon glyphicon-trash';

    resetButton.append(trash);

    resetButton.addEventListener(
      'click',
      event => {
        event.preventDefault();
        event.stopPropagation();

        void resetSelection(id);
      }
    );

    group.append(resetButton);

    const values =
      await quickValues();

    for (const value of values) {
      addQuickButton(
        group,
        String(value),
        () =>
          selectN(id, value)
      );
    }

    return group;
  }

  // ============================================================
  // Settings-Button
  // ============================================================

  function createSettingsButton() {
    const button =
      document.createElement('a');

    button.id =
      'nilspe-pt-settings-button';

    button.className =
      'btn btn-default btn-xs';

    button.href =
      `/settings/index#${SETTINGS_IDENTIFIER}`;

    button.target =
      '_blank';

    button.title =
      'Einstellungen';

    const icon =
      document.createElement('span');

    icon.className =
      'glyphicon glyphicon-cog';

    button.append(icon);

    return button;
  }

  // ============================================================
  // Render
  // ============================================================

  async function render() {
    const headings =
      document.querySelectorAll(
        '.panel-heading[building_id]'
      );

    for (const heading of headings) {
      const id =
        heading.getAttribute(
          'building_id'
        );

      if (!id) {
        continue;
      }

      ensureFilterUI(id);

      const target =
        heading.querySelector('a') ??
        heading;

      document.getElementById(
        assignerId(id)
      )?.remove();

      const group =
        await makeButtons(id);

      target.append(group);

      const body =
        bodyOf(id);

      if (body) {
        updateCounter(
          id,
          countCheckedIn(body)
        );
      }
    }

    if (
      !document.getElementById(
        'nilspe-pt-settings-button'
      )
    ) {
      const button =
        createSettingsButton();

      button.style.marginBottom =
        '5px';

      const firstPanel =
        document.querySelector(
          '.panel'
        );

      firstPanel
        ?.parentElement
        ?.insertBefore(
          button,
          firstPanel
        );
    }
  }

  // ============================================================
  // Start
  // ============================================================

  if (
    location.pathname.startsWith(
      '/settings/index'
    )
  ) {
    await createSettings();
    return;
  }

  if (!isHirePage()) {
    return;
  }

  await render();

  document.addEventListener(
    'personaluebernahme:render',
    () => {
      void render();
    }
  );

  document.addEventListener(
    'lehrgangszuweiser:render-personnel-selectors',
    () => {
      void render();
    }
  );

})();