const KEY = 'rt-muban-farm-v1';
const DEFAULTS = { countyIndex: 0, yaks: '', sheep: '', hay: '', days: 14, yakRate: 8, sheepRate: 2, saved: false };
const COUNTIES = [
  { name: '那曲 · 色尼区', region: '西藏', latitude: 31.48, longitude: 92.05, id: 'naqu-seni' },
  { name: '果洛 · 玛沁县', region: '青海', latitude: 34.48, longitude: 100.24, id: 'guoluo-maqin' },
  { name: '甘孜 · 石渠县', region: '四川', latitude: 32.98, longitude: 98.10, id: 'ganzi-shiqu' },
  { name: '那曲 · 班戈县', region: '西藏', latitude: 31.36, longitude: 90.01, id: 'naqu-bange' },
  { name: '那曲 · 申扎县', region: '西藏', latitude: 30.94, longitude: 88.71, id: 'naqu-shenzha' },
  { name: '林芝 · 巴宜区', region: '西藏', latitude: 29.64, longitude: 94.36, id: 'linzhi-bayi' }
];
function loadFarm() {
  let stored = {};
  try { stored = wx.getStorageSync(KEY) || {}; } catch (e) { /* Empty fields when storage is unavailable. */ }
  const farm = Object.assign({}, DEFAULTS, stored);
  if (!COUNTIES[farm.countyIndex]) farm.countyIndex = 0;
  return farm;
}
function saveFarm(changes) {
  const farm = Object.assign({}, loadFarm(), changes);
  wx.setStorageSync(KEY, farm);
  return farm;
}
function validateFarm(farm) {
  for (const key of ['yaks', 'sheep']) {
    if (String(farm[key]).trim() === '' || !Number.isInteger(Number(farm[key])) || Number(farm[key]) < 0 || Number(farm[key]) > 100000) return '请填牛和羊的数量，没有就填 0';
  }
  if (String(farm.hay).trim() === '' || !Number.isFinite(Number(farm.hay)) || Number(farm.hay) < 0 || Number(farm.hay) > 100000) return '请填现有干草吨数，没有就填 0';
  return '';
}
function calculateFeed(farm) {
  const error = validateFarm(farm);
  if (error) return { error };
  const days = Number(farm.days), yakRate = Number(farm.yakRate), sheepRate = Number(farm.sheepRate);
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: '备草天数请填 1 到 365 天' };
  if (![yakRate, sheepRate].every(n => Number.isFinite(n) && n > 0 && n <= 100)) return { error: '每天用草量请填大于 0、不超过 100 的数' };
  const dailyKg = Number(farm.yaks) * yakRate + Number(farm.sheep) * sheepRate;
  if (!dailyKg) return { error: '先填至少一头牛或一只羊，再来算草料' };
  const required = dailyKg * days / 1000;
  const shortage = Math.max(0, required - Number(farm.hay));
  return { dailyKg: Number(dailyKg.toFixed(2)), total: required.toFixed(2), shortage: shortage.toFixed(2), enough: shortage === 0, daysLeft: Math.floor(Number(farm.hay) * 1000 / dailyKg), days };
}
function dateLabel() { const d = new Date(); return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + '日一二三四五六'[d.getDay()]; }
module.exports = { COUNTIES, loadFarm, saveFarm, validateFarm, calculateFeed, dateLabel };
