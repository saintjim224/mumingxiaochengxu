const { COUNTIES, loadFarm, saveFarm, dateLabel, calculateFeed } = require('../../utils/farm');
const { getWeather } = require('../../services/pasture');
const { loadTodos, toggleTodo, addTodo, getTodoStats } = require('../../utils/todos');

// 高原一天的节奏：不同时段给一句更贴身的提醒
const GREETINGS = [
  [6, '天还黑着，出门多穿一件'],
  [11, '喝口热茶，先看天气再出牧'],
  [15, '日头正高，记得给牛羊添水'],
  [19, '风起来了，早点把牛羊赶回圈'],
  [24, '夜里冷，查一遍棚门再歇']
];

// 每日一条牧活提醒，按日期轮换
const DAILY_TIPS = [
  '降温前先查一遍棚门，草料备够三天更安心。',
  '水槽结冰要及时敲开，尽量让牛羊喝上温水。',
  '风雪天出牧，手机充满电，告诉家里人去哪片草场。',
  '幼畜、弱畜先安顿，别让它们挤在风口上。',
  '干草受潮发霉不要喂，宁可多花点钱也别省这一口。',
  '傍晚清点时多看一眼，精神差的牛羊单独分圈。'
];

function greetingText() {
  const hour = new Date().getHours();
  const found = GREETINGS.find(item => hour < item[0]);
  return (found || GREETINGS[GREETINGS.length - 1])[1];
}

function buildHay(farm, summary) {
  if (!farm.saved || !summary) {
    return { saved: false, tons: '—', daysLeft: 0, enough: true, shortage: '0', percent: 0, label: '点此记下存草' };
  }
  const total = Number(summary.total);
  const shortage = Number(summary.shortage);
  const percent = total > 0 ? Math.max(2, Math.min(100, Math.round(((total - shortage) / total) * 100))) : 0;
  return {
    saved: true,
    tons: farm.hay,
    daysLeft: summary.daysLeft,
    enough: summary.enough,
    shortage: summary.shortage,
    percent,
    label: summary.enough ? '约够吃 ' + summary.daysLeft + ' 天' : '缺口 ' + summary.shortage + ' 吨'
  };
}

function todoPercentOf(stats) {
  return stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
}

function dailyTip() {
  return DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];
}

function computeWeatherTheme(weather) {
  const hour = new Date().getHours();
  if (weather && weather.temperature !== null && weather.temperature !== undefined) {
    const temp = Number(weather.temperature);
    const desc = weather.description || '';
    if (desc.includes('雪') || temp <= -6) return 'theme-snow';
    if (desc.includes('雨')) return 'theme-rain';
    if (desc.includes('风')) return 'theme-wind';
  }
  if (hour >= 6 && hour < 10) return 'theme-dawn';
  if (hour >= 10 && hour < 17) return 'theme-sunny';
  if (hour >= 17 && hour < 20) return 'theme-dusk';
  return 'theme-night';
}

const INITIAL_WEATHER = {
  temperature: '-5',
  description: '正常 (无灾害) · 积雪0.7cm',
  wind: '9.9 m/s · 风险低',
  precipitation: '0.7 cm 积雪',
  time: dateLabel(),
  clock: '实时',
  stale: false,
  status: '融天气象平台实时感知',
  source: '融天气象 · 时空融合平台'
};

Page({
  data: {
    counties: COUNTIES,
    countyIndex: 0,
    county: COUNTIES[0],
    date: '',
    greeting: '',
    tip: '',
    weather: INITIAL_WEATHER,
    weatherTheme: 'theme-snow',
    isExtremeWeather: false,
    loading: false,
    weatherError: '',
    farm: {},
    summary: null,
    hay: { saved: false, tons: '—', percent: 0, label: '点此记下存草', enough: true, daysLeft: 0, shortage: '0' },
    todos: [],
    todoStats: { total: 0, completed: 0, allDone: false, label: '0/0' },
    todoPercent: 0,
    showAddSheet: false,
    newTodoText: '',
    newTodoTag: '防风寒',
    quickTags: ['防风寒', '保饮水', '补草料', '点牛羊', '买盐砖', '找兽医'],
    banners: [
      {
        id: 'pasture',
        title: '高原晨光 · 水草丰美',
        sub: '晨牧察看风向草势 · 健牛安群',
        image: '/images/dynamic/banner_dawn_pasture.jpg',
        tag: '今日草场',
        page: 'weather'
      },
      {
        id: 'remote_sensing',
        title: '遥感生态 · 绿度监测',
        sub: '高寒草场越冬植被态势良好',
        image: '/images/dynamic/banner_remote_sensing.jpg',
        tag: '生态监测',
        page: 'weather'
      },
      {
        id: 'shed',
        title: '防灾暖棚 · 安全护幼',
        sub: '风雪降温前检查门窗与保温',
        image: '/images/dynamic/banner_warm_shed.jpg',
        tag: '科学护畜',
        guideId: 'shed_guard',
        page: 'detail'
      },
      {
        id: 'hay',
        title: '科学补饲 · 丰足越冬',
        sub: '算好家里的干草还能吃几天',
        image: '/images/dynamic/banner_hay_storage.jpg',
        tag: '草料储备',
        page: 'feed'
      }
    ],
    bulletins: [
      { id: 1, tag: '气象预警', text: '夜间部分牧区有大风降温，请及时安顿幼畜并查好棚门' },
      { id: 2, tag: '遥感生态', text: '最新卫星草场绿度监测已更新，全区越冬植被态势平稳' },
      { id: 3, tag: '饲草储备', text: '冬季草料调运通道保持通畅，算好家底余量早备早安心' },
      { id: 4, tag: '防疫提示', text: '冬春换茬期留意牛羊反刍与精神，异常及时联系兽医' }
    ],
    actions: [
      { title: '看天气', desc: '风向与灾害预警', icon: 'line-weather', tone: 'sky', page: 'weather' },
      { title: '算草料', desc: '还能吃几天', icon: 'line-hay', tone: 'brass', page: 'feed' },
      { title: '护牛羊', desc: '降温下雪照着做', icon: 'line-yak', tone: 'pine', page: 'detail' },
      { title: '找人帮忙', desc: '兽医村干一键拨号', icon: 'line-phone', tone: 'clay', page: 'help' }
    ]
  },

  onShow() {
    const farm = loadFarm();
    const feedCalc = calculateFeed(farm);
    const summary = feedCalc.error ? null : feedCalc;
    const todos = loadTodos();
    const todoStats = getTodoStats(todos);
    const changed = this.data.countyIndex !== farm.countyIndex;

    this.setData({
      farm,
      summary,
      todos,
      todoStats,
      todoPercent: todoPercentOf(todoStats),
      hay: buildHay(farm, summary),
      greeting: greetingText(),
      tip: dailyTip(),
      countyIndex: farm.countyIndex,
      county: COUNTIES[farm.countyIndex],
      date: dateLabel()
    });

    if (changed || !this._lastFetch || Date.now() - this._lastFetch > 300000) {
      this.refreshWeather();
    }
  },

  onUnload() {
    this._requestId = (this._requestId || 0) + 1;
  },

  async refreshWeather() {
    const id = (this._requestId = (this._requestId || 0) + 1);
    this.setData({ loading: !this.data.weather, weatherError: '' });
    try {
      const weather = await getWeather(this.data.county);
      if (id === this._requestId) {
        this._lastFetch = Date.now();
        const clock = weather && weather.time ? String(weather.time).slice(11, 16) : '';
        const weatherTheme = computeWeatherTheme(weather);
        const temp = weather ? Number(weather.temperature) : 0;
        const desc = weather ? (weather.description || '') : '';
        const isExtremeWeather = desc.includes('雪') || temp <= -6 || (weather && weather.wind && parseFloat(weather.wind) >= 25);
        this.setData({ weather: Object.assign({}, weather, { clock }), weatherTheme, isExtremeWeather, weatherError: '' });
      }
    } catch (e) {
      if (id === this._requestId && !this.data.weather) {
        this.setData({ weatherError: '天气暂时没连上' });
      }
    } finally {
      if (id === this._requestId) {
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
      }
    }
  },

  onPullDownRefresh() {
    const todos = loadTodos();
    const todoStats = getTodoStats(todos);
    const farm = loadFarm();
    const feedCalc = calculateFeed(farm);
    const summary = feedCalc.error ? null : feedCalc;
    this.setData({
      todos,
      todoStats,
      todoPercent: todoPercentOf(todoStats),
      farm,
      summary,
      hay: buildHay(farm, summary)
    });
    this.refreshWeather();
  },

  onCountyChange(e) {
    const index = Number(e.detail.value);
    try {
      saveFarm({ countyIndex: index });
    } catch (err) {
      wx.showToast({ title: '地点未能记住，请重试', icon: 'none' });
      return;
    }
    this.setData({ countyIndex: index, county: COUNTIES[index] });
    this.refreshWeather();
  },

  openPage(e) {
    const page = e.currentTarget.dataset.page;
    if (page === 'aboutUs') {
      wx.switchTab({ url: '/pages/aboutUs/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/' + page + '/index' });
  },

  onBannerTap(e) {
    const { page, guideid } = e.currentTarget.dataset;
    if (guideid) {
      wx.navigateTo({ url: '/pages/detail/index?id=' + guideid });
    } else if (page === 'aboutUs') {
      wx.switchTab({ url: '/pages/aboutUs/index' });
    } else if (page) {
      wx.navigateTo({ url: '/pages/' + page + '/index' });
    }
  },

  openAlertGuide() {
    wx.navigateTo({ url: '/pages/detail/index?id=snow_defense' });
  },

  openAssistant() {
    wx.navigateTo({ url: '/pages/ask/index' });
  },

  openFarm() {
    wx.switchTab({ url: '/pages/aboutUs/index' });
  },

  openGuide(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || 'shed_guard';
    wx.navigateTo({ url: '/pages/detail/index?id=' + id });
  },

  onToggleTodo(e) {
    const id = e.currentTarget.dataset.id;
    const todos = toggleTodo(id);
    const todoStats = getTodoStats(todos);
    this.setData({ todos, todoStats, todoPercent: todoPercentOf(todoStats) });
    try {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } catch (err) {
      /* 部分机型不支持轻微震动，忽略即可 */
    }
  },

  onTodoGuide(e) {
    const { id, page } = e.currentTarget.dataset;
    if (page === 'aboutUs') {
      this.openFarm();
    } else if (page === 'feed') {
      wx.navigateTo({ url: '/pages/feed/index' });
    } else if (id) {
      wx.navigateTo({ url: '/pages/detail/index?id=' + id });
    } else if (page) {
      wx.navigateTo({ url: '/pages/' + page + '/index' });
    }
  },

  openAddTodoSheet() {
    this.setData({ showAddSheet: true, newTodoText: '', newTodoTag: '防风寒' });
  },

  closeAddTodoSheet() {
    this.setData({ showAddSheet: false });
  },

  onTodoTextInput(e) {
    this.setData({ newTodoText: e.detail.value });
  },

  onSelectTag(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ newTodoTag: tag });
  },

  confirmAddTodo() {
    const text = this.data.newTodoText;
    if (!text || !text.trim()) {
      wx.showToast({ title: '请先写上事情', icon: 'none' });
      return;
    }
    const res = addTodo(text, this.data.newTodoTag);
    if (res.error) {
      wx.showToast({ title: res.error, icon: 'none' });
      return;
    }
    const todos = res.list;
    const todoStats = getTodoStats(todos);
    this.setData({
      todos,
      todoStats,
      todoPercent: todoPercentOf(todoStats),
      showAddSheet: false,
      newTodoText: ''
    });
    wx.showToast({ title: '已记下', icon: 'success' });
  },

  noOp() {}
});
