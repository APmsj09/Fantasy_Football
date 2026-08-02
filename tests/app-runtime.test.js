const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function makeClassList() {
  const classes = new Set();
  return {
    add(...names) { names.forEach(name => classes.add(name)); },
    remove(...names) { names.forEach(name => classes.delete(name)); },
    contains(name) { return classes.has(name); },
    replace(oldName, newName) {
      if (classes.has(oldName)) {
        classes.delete(oldName);
        classes.add(newName);
      }
    },
    toString() { return Array.from(classes).join(' '); }
  };
}

function createElement(id = null, classes = []) {
  const element = {
    id,
    classList: makeClassList(),
    dataset: {},
    attributes: {},
    children: [],
    parentElement: null,
    getAttribute(name) { return this.attributes[name] || null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener() {},
    className: ''
  };
  classes.forEach(cls => element.classList.add(cls));
  return element;
}

test('draft tab clicks should work when the click target is inside the button', () => {
  const listeners = new Map();
  const elementsById = new Map();
  const button = createElement('draft-tab-btn', ['draft-tab-btn']);
  button.setAttribute('data-target', 'draft-available');
  const child = { parentElement: button };
  const content = createElement('draft-available', ['draft-tab-content']);
  content.classList.add('hidden');

  elementsById.set('draft-available', content);
  elementsById.set('load-data-button', createElement('load-data-button'));
  elementsById.set('start-draft-btn', createElement('start-draft-btn'));
  elementsById.set('setting-teams', createElement('setting-teams'));
  elementsById.set('setting-user-pick', createElement('setting-user-pick'));
  elementsById.set('message-modal-close', createElement('message-modal-close'));
  elementsById.set('db-search', createElement('db-search'));
  elementsById.set('db-position', createElement('db-position'));

  const documentStub = {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(type, event) {
      const handlers = listeners.get(type) || [];
      handlers.forEach(handler => handler(event));
    },
    getElementById(id) {
      if (id === null) return null;
      return elementsById.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '.draft-tab-btn') return [button];
      if (selector === '.draft-tab-content') return [content];
      if (selector === '.nav-btn') return [];
      if (selector === '.target-tab-btn') return [];
      if (selector === '.metric-tab-btn') return [];
      return [];
    },
    querySelector(selector) {
      if (selector === '.bg-white') return createElement('bg-white');
      return null;
    },
    createElement() { return createElement(); },
    body: createElement('body')
  };

  const context = {
    console,
    document: documentStub,
    window: {},
    setTimeout: (fn) => fn(),
    clearTimeout() {},
    fetch: async () => ({ ok: true, text: async () => '', json: async () => ({}) }),
    Chart: undefined,
    UI: {
      switchTab() {},
      renderDatabase() {},
      renderDraftAvailablePlayers() {},
      renderProfileAssignments() {},
      updateDraftBoard() {},
      showMessage() {}
    },
    State: {
      allPlayers: [],
      availablePlayers: [],
      teamTargets: [],
      advancedMetrics: [],
      managerProfiles: {},
      settings: { numTeams: 1, draftMode: 'live', userTeamIndex: 1, roster: { QB: { max: 1 }, RB: { max: 2 }, WR: { max: 2 }, TE: { max: 1 }, Flex: { max: 2 }, PK: { max: 1 }, DST: { max: 1 }, Bench: { max: 6 }, totalSize: 16 } },
      draftStarted: false,
      draftOrder: [],
      currentPick: 0,
      draftHistory: [],
      teamsById: {},
      userTeamId: null,
      parseProjectedData() { return []; },
      parseDefData() { return []; },
      parseKickerData() { return []; },
      enrichPlayerMap() {},
      mergeSOSData() {},
      mergeAdvancedMetrics() {},
      parseAdvancedData() { return []; },
      mergeADPData() {},
      mergeDepthChartData() {},
      mergeSnapCountData() {},
      mergeOLRankData() {},
      parseHistory() {},
      calculateProjections() {},
      calculateVBD() {},
      initializeTeams() {},
      evaluateRosterFits() {},
      normalizeName(name) { return name; },
      normalizeTeam(team) { return team; },
      normalizePos(pos) { return pos; }
    },
    renderTeamTargets() {},
    renderMetricLeaders() {},
    renderInsightsTable() {}
  };

  context.window.window = context.window;
  context.window.document = documentStub;
  context.window.UI = context.UI;
  context.window.State = context.State;
  context.window.AutoDraft = { processQueue() {}, executeDraft() {} };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/app.js', 'utf8'), context);

  assert.doesNotThrow(() => {
    documentStub.dispatchEvent('click', { target: child });
  });
});
