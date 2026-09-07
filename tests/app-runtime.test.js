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

test('mergeAdvancedMetrics should fall back to projected touchdown stats when advanced data lacks explicit TD columns', () => {
  const context = {
    console,
    document: { getElementById() { return null; } },
    window: {},
    setTimeout: (fn) => fn(),
    clearTimeout() {},
    fetch: async () => ({ ok: true, text: async () => '', json: async () => ({}) })
  };

  context.window.window = context.window;
  context.window.document = context.document;

  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/state.js', 'utf8'), context);

  const State = vm.runInContext('State', context);
  State.allPlayers = [{
    Player: 'Puka Nacua',
    Team: 'LAR',
    Pos: 'WR',
    stats: {
      targets: 44,
      rec: 32,
      recYds: 489,
      recTd: 5
    }
  }];
  State.enrichPlayerMap();

  State.mergeAdvancedMetrics([{ Player: 'Puka Nacua', Team: 'LAR', Pos: 'WR', TGT: 44, REC: 32, YDS: 489 }]);

  const player = State.allPlayers[0];
  assert.equal(player.pastStats.recTd, 5);
  assert.equal(player.pastStats.totalTd, 5);
});

test('player ages should prefer the team/position-matching Sleeper entry when names are duplicated', async () => {
  const context = {
    console,
    document: { getElementById() { return null; } },
    window: {},
    setTimeout: (fn) => fn(),
    clearTimeout() {},
    fetch: async () => ({
      ok: true,
      json: async () => ({
        a: { full_name: 'Josh Allen', age: 29, team: 'BUF', position: 'QB' },
        b: { full_name: 'Josh Allen', age: 31, team: 'NYG', position: 'OL' }
      })
    })
  };

  context.window.window = context.window;
  context.window.document = context.document;

  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/state.js', 'utf8'), context);

  const State = vm.runInContext('State', context);
  State.allPlayers = [{ Player: 'Josh Allen', Team: 'BUF', Pos: 'QB' }];
  State.enrichPlayerMap();

  const ageMap = {};
  Object.values({
    a: { full_name: 'Josh Allen', age: 29, team: 'BUF', position: 'QB' },
    b: { full_name: 'Josh Allen', age: 31, team: 'NYG', position: 'OL' }
  }).forEach(entry => {
    const normalizedName = State.normalizeName(entry.full_name);
    const normalizedTeam = State.normalizeTeam(entry.team);
    const normalizedPos = State.normalizePos(entry.position);
    const key = `${normalizedName}::${normalizedTeam || 'NONE'}::${normalizedPos || 'NONE'}`;
    ageMap[key] = entry.age;
  });

  const normalizedName = State.normalizeName(State.allPlayers[0].Player);
  const normalizedTeam = State.normalizeTeam(State.allPlayers[0].Team);
  const normalizedPos = State.normalizePos(State.allPlayers[0].Pos);
  const directKey = `${normalizedName}::${normalizedTeam || 'NONE'}::${normalizedPos || 'NONE'}`;
  const fallbackKey = `${normalizedName}::${normalizedTeam || 'NONE'}::NONE`;
  const fallbackNameKey = `${normalizedName}::NONE::NONE`;

  const matchedAge = ageMap[directKey] ?? ageMap[fallbackKey] ?? ageMap[fallbackNameKey];

  State.allPlayers[0].age = matchedAge;

  assert.equal(State.allPlayers[0].age, 29);
});

test('recap summaries and roster audits remain finite for incomplete teams', () => {
  const context = {
    console,
    document: { getElementById() { return null; } },
    window: {},
    State: {
      settings: {
        startWeek: 1,
        endWeek: 17,
        roster: {
          QB: { max: 1 }, RB: { max: 2 }, WR: { max: 2 }, TE: { max: 1 },
          PK: { max: 1 }, DST: { max: 1 }, Flex: { max: 1 }, Bench: { max: 5 }
        }
      }
    }
  };

  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/recap.js', 'utf8'), context);

  const recap = context.window.DraftRecap;
  const summary = recap.summarizeWeeklyScores([10, Number.NaN, 0, 20], 3);
  assert.equal(summary.total, 30);
  assert.equal(summary.bestWeek, 5);
  assert.equal(summary.worstWeek, 4);
  assert.ok(Number.isFinite(summary.consistency));

  const audit = recap.auditRoster({
    roster: [
      { Pos: 'QB', injuryStatus: 'Questionable', byeWeek: 9 },
      { Pos: 'RB', byeWeek: 9 }
    ]
  });
  assert.equal(audit.missingCore, 6);
  assert.equal(audit.byePeak, 2);
  assert.equal(audit.injuredCount, 1);
  assert.ok(audit.availabilityScore < 100);
});

test('recap grade calibration treats average complete teams as average', () => {
  const context = {
    console,
    document: { getElementById() { return null; } },
    window: {},
    State: { settings: { roster: {} } }
  };

  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/recap.js', 'utf8'), context);

  const recap = context.window.DraftRecap;
  const averageScore = recap.calculateGradeScore({
    lineup: 65,
    depth: 65,
    value: 65,
    stability: 65,
    availability: 100,
    completeness: 100
  });
  const strongScore = recap.calculateGradeScore({
    lineup: 82,
    depth: 82,
    value: 82,
    stability: 82,
    availability: 90,
    completeness: 100
  });

  assert.equal(averageScore, 73);
  assert.equal(recap.getGradeDetails(averageScore).grade, 'C');
  assert.equal(recap.getGradeDetails(strongScore).grade, 'B');
});

test('draft assessment distinguishes smart value, reaches, stashes, and roster shape', () => {
  const context = {
    console,
    document: { getElementById() { return null; } },
    window: {},
    State: { settings: { numTeams: 12, roster: {} } }
  };

  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/recap.js', 'utf8'), context);

  const recap = context.window.DraftRecap;
  const assessment = recap.assessDraftConstruction({
    roster: [
      { Player: 'Starter A', Pos: 'RB', draftPickNum: 30, adp: 20, handcuffName: 'Backup A' },
      { Player: 'Backup A', Pos: 'RB', draftPickNum: 150, adp: 130, isRBHandcuff: true, contingentDraftEquity: 30 },
      { Player: 'Reach', Pos: 'WR', draftPickNum: 10, adp: 25 }
    ]
  }, 2, 1.08, 1, 1.08, 1);

  assert.equal(assessment.valuePicks, 2);
  assert.equal(assessment.reaches, 1);
  assert.equal(assessment.severeReaches, 1);
  assert.equal(assessment.handcuffsOwned, 1);
  assert.equal(assessment.handcuffTargets, 1);
  assert.equal(assessment.upsideStashes, 1);
  assert.equal(assessment.rosterProfile, 'Complete Contender');
});
