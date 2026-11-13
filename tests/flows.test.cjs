const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '..');
const app = require('../app.json');
const farm = require('../utils/farm');
const contacts = require('../utils/contacts');
const todos = require('../utils/todos');
const api = require('../services/pasture');

function setupWx() {
  const storage = new Map();
  const calls = [];
  global.wx = {
    getStorageSync: key => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
    navigateTo: opts => calls.push(['navigateTo', opts]),
    switchTab: opts => calls.push(['switchTab', opts]),
    pageScrollTo() {}, stopPullDownRefresh() {}, showToast() {},
    showModal: opts => calls.push(['modal', opts]),
    makePhoneCall: opts => calls.push(['phone', opts])
  };
  return { storage, calls };
}
function page(relative, mocks = {}) {
  const filename = path.join(ROOT, relative + '.js');
  const realRequire = createRequire(filename);
  let instance;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => mocks[name] || realRequire(name),
    wx: global.wx, Date, Promise,
    Page(definition) {
      instance = definition;
      instance.data = structuredClone(definition.data);
      instance.setData = function(changes) {
        for (const [key, value] of Object.entries(changes)) {
          const parts = key.split('.'); let target = this.data;
          for (const part of parts.slice(0, -1)) target = target[part];
          target[parts.at(-1)] = value;
        }
      };
    }
  }, { filename });
  return instance;
}
const input = (field, value) => ({ currentTarget: { dataset: { field } }, detail: { value } });
const click = dataset => ({ currentTarget: { dataset } });
const validFarm = { yaks: '80', sheep: '200', hay: '12', days: 14, yakRate: 8, sheepRate: 2 };
function weatherPayload(current = {}) {
  return { ok: true, current: { temperature: 0, weather: '晴', obsTime: '2026-11-05T12:00', wind_speed: 0, precipitation: 0, ...current }, raw: { utc_offset_seconds: 28800, current_units: { wind_speed_10m: 'km/h' } } };
}

test('all registered pages, event handlers and static images resolve', () => {
  setupWx();
  for (const route of app.pages) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(ROOT, route + '.' + ext)), route + '.' + ext);
    JSON.parse(fs.readFileSync(path.join(ROOT, route + '.json'), 'utf8'));
    const definition = page(route);
    const wxml = fs.readFileSync(path.join(ROOT, route + '.wxml'), 'utf8');
    for (const match of wxml.matchAll(/(?:bind|catch):?[a-z-]+="([A-Za-z_][\w]*)"/g)) assert.equal(typeof definition[match[1]], 'function', route + ':' + match[1]);
    for (const match of wxml.matchAll(/src="(\/[^"{]+)"/g)) assert.ok(fs.existsSync(path.join(ROOT, match[1])), match[1]);
  }
  for (const tab of app.tabBar.list) {
    assert.ok(app.pages.includes(tab.pagePath));
    for (const key of ['iconPath', 'selectedIconPath']) assert.ok(fs.existsSync(path.join(ROOT, tab[key])));
  }
});
test('home and assistant shortcuts all navigate to registered pages', () => {
  const { calls } = setupWx(); const home = page('pages/index/index');
  home.data.actions.forEach(action => home.openPage(click({ page: action.page })));
  home.openAssistant(); home.openFarm(); home.openGuide(click({ id: 'shed_guard' }));
  const ask = page('pages/ask/index'); ask.data.questions.forEach((_, index) => ask.openQuestion(click({ index })));
  for (const [method, opts] of calls) {
    const target = opts.url.split('?')[0].slice(1);
    assert.ok(app.pages.includes(target), target);
    if (method === 'switchTab') assert.ok(app.tabBar.list.some(t => t.pagePath === target));
  }
});
test('new households start empty, not with fabricated livestock', () => {
  setupWx(); const value = farm.loadFarm();
  assert.equal(value.saved, false); assert.equal(value.yaks, ''); assert.equal(value.sheep, ''); assert.ok(farm.calculateFeed(value).error);
});
test('feed estimate gives correct daily usage, required grass and shortage', () => {
  assert.deepEqual(farm.calculateFeed(validFarm), { dailyKg: 1040, total: '14.56', shortage: '2.56', enough: false, daysLeft: 11, days: 14 });
  const enough = farm.calculateFeed({ ...validFarm, hay: '14.56' });
  assert.equal(enough.enough, true); assert.equal(enough.daysLeft, 14);
  assert.equal(farm.calculateFeed({ ...validFarm, yaks: 0, sheep: 10, hay: 1 }).total, '0.28');
});
test('invalid and zero livestock cannot produce misleading feed results', () => {
  for (const patch of [{ yaks: '' }, { sheep: -1 }, { yaks: '2.5' }, { hay: 'abc' }, { hay: -1 }, { yaks: 0, sheep: 0 }, { days: 0 }, { yakRate: 0 }, { sheepRate: Infinity }]) assert.ok(farm.calculateFeed({ ...validFarm, ...patch }).error, JSON.stringify(patch));
});
test('calculator saves to household record; edits invalidate old calculation', () => {
  setupWx(); const calculator = page('pages/feed/index'); calculator.onLoad();
  for (const key of ['yaks', 'sheep', 'hay']) calculator.onInput(input(key, validFarm[key]));
  calculator.calculate(); assert.equal(calculator.data.result.total, '14.56'); calculator.save();
  const household = page('pages/aboutUs/index'); household.onShow();
  assert.equal(household.data.farm.saved, true); assert.equal(household.data.farm.yaks, '80'); assert.equal(household.data.summary.daysLeft, 11);
  calculator.onInput(input('yaks', '90')); assert.equal(calculator.data.result, null);
  calculator.save(); assert.equal(farm.loadFarm().yaks, '80');
});
test('storage failure does not report a successful household save', () => {
  setupWx(); const household = page('pages/aboutUs/index'); household.onShow(); household.startEdit();
  household.data.form = { ...validFarm };
  wx.setStorageSync = () => { throw new Error('disk full'); };
  household.save(); assert.equal(household.data.editing, true); assert.ok(household.data.error);
});
test('contacts validate, persist, and only dial after user confirmation', () => {
  const { calls } = setupWx();
  assert.ok(contacts.validateContact('', '13800000000'));
  assert.ok(contacts.validateContact('测试联系人', '123'));
  contacts.saveContact('vet', '测试联系人', '13800000000');
  assert.equal(contacts.loadContacts().vet.phone, '13800000000');
  contacts.callContact('测试联系人', '13800000000');
  assert.equal(calls.filter(c => c[0] === 'phone').length, 0);
  calls[0][1].success({ confirm: false }); assert.equal(calls.length, 1);
  calls[0][1].success({ confirm: true }); assert.equal(calls[1][1].phoneNumber, '13800000000');
});
test('weather preserves valid zero values and distinguishes stale or missing data', () => {
  const now = Date.parse('2026-11-05T04:30:00Z');
  const value = api.normalizeWeather(weatherPayload(), now);
  assert.equal(value.temperature, '0'); assert.equal(value.wind, '0 km/h'); assert.equal(value.precipitation, '0 mm'); assert.equal(value.stale, false);
  assert.equal(api.normalizeWeather(weatherPayload(), now + 4 * 3600000).stale, true);
  assert.equal(api.normalizeWeather(weatherPayload({wind_speed:null}), now).wind, '暂无');
  assert.throws(() => api.normalizeWeather(weatherPayload({ temperature: null }), now));
  assert.throws(() => api.normalizeWeather(weatherPayload({ obsTime: '' }), now));
});
test('HTML fallback and request failure are not treated as weather or AI answers', async () => {
  setupWx(); wx.request = opts => opts.success({ statusCode: 200, data: '<!DOCTYPE html><html>portal</html>' });
  await assert.rejects(api.getWeather(farm.COUNTIES[0])); await assert.rejects(api.askQuestion('天气怎样', farm.COUNTIES[0]));
  wx.request = opts => opts.fail({ errMsg: 'network unavailable' }); await assert.rejects(api.getWeather(farm.COUNTIES[0]));
});
test('switching county ignores an older weather response', async () => {
  setupWx(); const pending = [];
  const weatherPage = page('pages/weather/index', { '../../services/pasture': { getWeather: () => new Promise(resolve => pending.push(resolve)) } });
  const first = weatherPage.refresh(); weatherPage.setData({ county: farm.COUNTIES[1] }); const second = weatherPage.refresh();
  pending[1]({ temperature: '-5' }); await second;
  pending[0]({ temperature: '10' }); await first;
  assert.equal(weatherPage.data.weather.temperature, '-5'); assert.equal(weatherPage.data.loading, false);
});
test('failed questions preserve the user question and do not invent a reply', async () => {
  setupWx(); const ask = page('pages/ask/index', { '../../services/pasture': { askQuestion: async () => { throw new Error('offline'); } } });
  ask.onInput({ detail: { value: '圈舍要检查什么' } }); await ask.send();
  assert.equal(ask.data.busy, false); assert.equal(ask.data.input, '圈舍要检查什么'); assert.ok(ask.data.error);
  assert.equal(ask.data.messages.filter(m => m.sender === 'assistant').length, 0);
});

test('pasture chores load defaults, toggle state, compute stats, and persist custom notes', () => {
  setupWx();
  const list = todos.loadTodos();
  assert.equal(list.length, 4);
  assert.equal(list[0].done, false);
  let stats = todos.getTodoStats(list);
  assert.equal(stats.completed, 0);
  assert.equal(stats.total, 4);
  assert.equal(stats.allDone, false);

  const updated = todos.toggleTodo(list[0].id);
  assert.equal(updated[0].done, true);
  stats = todos.getTodoStats(updated);
  assert.equal(stats.completed, 1);

  const emptyRes = todos.addTodo('  ');
  assert.ok(emptyRes.error);

  const addedRes = todos.addTodo('找兽医打疫苗', '找兽医');
  assert.equal(addedRes.list.length, 5);
  assert.equal(addedRes.item.tag, '找兽医');

  const afterRemoval = todos.removeTodo(addedRes.item.id);
  assert.equal(afterRemoval.length, 4);
});

test('home page handles todo toggle, guide navigation, and adding custom chores', () => {
  const { calls } = setupWx();
  const home = page('pages/index/index');
  home.onShow();
  assert.equal(home.data.todos.length, 4);
  assert.equal(home.data.todoStats.completed, 0);

  // Toggle todo item
  home.onToggleTodo(click({ id: 'shed' }));
  assert.equal(home.data.todoStats.completed, 1);

  // Todo guide shortcut navigates to relevant guide or page
  home.onTodoGuide(click({ id: 'shed_guard' }));
  assert.equal(calls.at(-1)[0], 'navigateTo');
  assert.equal(calls.at(-1)[1].url, '/pages/detail/index?id=shed_guard');

  home.onTodoGuide(click({ page: 'aboutUs' }));
  assert.equal(calls.at(-1)[0], 'switchTab');
  assert.equal(calls.at(-1)[1].url, '/pages/aboutUs/index');

  // Add custom chore
  home.openAddTodoSheet();
  assert.equal(home.data.showAddSheet, true);
  home.onSelectTag(click({ tag: '买盐砖' }));
  home.onTodoTextInput({ detail: { value: '去县里买舔盐砖' } });
  home.confirmAddTodo();
  assert.equal(home.data.showAddSheet, false);
  assert.equal(home.data.todos.length, 5);
});

