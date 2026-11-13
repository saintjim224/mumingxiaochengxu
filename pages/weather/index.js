const { COUNTIES, loadFarm, saveFarm } = require('../../utils/farm');
const { getWeather } = require('../../services/pasture');

const HABITS = [
  { title: '看看天，听听预警', text: '留意村里的通知；风雪大、看不清路时不要冒险。' },
  { title: '带好手机，告诉家里', text: '说清去哪片草场，预计什么时候回来。' },
  { title: '天气变了，及时回去', text: '别只看出发时的天气，途中也要留意变化。' }
];

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
  wind: '9.9 m/s',
  precipitation: '0.7 cm 积雪',
  clock: '实时',
  time: '刚刚更新',
  status: '融天气象平台实时感知',
  source: '融天气象 · 时空融合平台'
};

Page({
  data: {
    counties: COUNTIES,
    countyIndex: 0,
    county: COUNTIES[0],
    weather: INITIAL_WEATHER,
    weatherTheme: 'theme-snow',
    loading: false,
    error: '',
    habits: HABITS
  },
  onLoad() {
    const farm = loadFarm();
    this.setData({ countyIndex: farm.countyIndex, county: COUNTIES[farm.countyIndex] });
    this.refresh();
  },
  onUnload() {
    this._id = (this._id || 0) + 1;
  },
  onPullDownRefresh() {
    this.refresh();
  },
  onCountyChange(e) {
    const i = Number(e.detail.value);
    try {
      saveFarm({ countyIndex: i });
    } catch (err) {
      wx.showToast({ title: '地点未能保存', icon: 'none' });
      return;
    }
    this.setData({ countyIndex: i, county: COUNTIES[i] });
    this.refresh();
  },
  async refresh() {
    const id = (this._id = (this._id || 0) + 1);
    this.setData({ loading: !this.data.weather, error: '' });
    try {
      const weather = await getWeather(this.data.county);
      if (id === this._id) {
        const clock = weather && weather.time ? String(weather.time).slice(11, 16) : '';
        const weatherTheme = computeWeatherTheme(weather);
        this.setData({ weather: Object.assign({}, weather, { clock }), weatherTheme, error: '' });
      }
    } catch (e) {
      if (id === this._id && !this.data.weather) {
        this.setData({ error: '当地天气暂时没连上，稍后再试试。' });
      }
    } finally {
      if (id === this._id) {
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
      }
    }
  },
  openGuide() {
    wx.navigateTo({ url: '/pages/detail/index?id=snow_defense' });
  },
  previewRemoteSensing() {
    if (typeof wx.previewImage === 'function') {
      wx.previewImage({ urls: ['/images/dynamic/banner_remote_sensing.jpg'] });
    }
  }
});
