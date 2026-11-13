const { loadFarm, saveFarm, calculateFeed } = require('../../utils/farm');
Page({
  data: { form: {}, daysOptions: [7, 14, 30], result: null, error: '', ratesOpen: false, saved: false },
  onLoad() { this.setData({ form: loadFarm() }); },
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!['yaks', 'sheep', 'hay', 'yakRate', 'sheepRate'].includes(field)) return;
    this.setData({ ['form.' + field]: e.detail.value, result: null, error: '', saved: false });
  },
  adjust(e) {
    const field = e.currentTarget.dataset.field;
    if (!['yaks', 'sheep'].includes(field)) return;
    const current = Number(this.data.form[field]) || 0;
    this.setData({ ['form.' + field]: Math.max(0, Math.min(100000, current + Number(e.currentTarget.dataset.delta))), result: null, error: '', saved: false });
  },
  chooseDays(e) { this.setData({ 'form.days': Number(e.currentTarget.dataset.days), result: null, error: '', saved: false }); },
  toggleRates() { this.setData({ ratesOpen: !this.data.ratesOpen }); },
  calculate() {
    const result = calculateFeed(this.data.form);
    let payload = null;
    if (!result.error) {
      const total = Number(result.total);
      payload = Object.assign({}, result, {
        percent: total > 0 ? Math.min(100, Math.round(((total - Number(result.shortage)) / total) * 100)) : 0
      });
    }
    this.setData({ error: result.error || '', result: payload, saved: false });
    if (!result.error) wx.pageScrollTo({ selector: '#feed-result', duration: 250 });
  },
  save() {
    if (!this.data.result || this.data.result.error) return;
    try { saveFarm(Object.assign({}, this.data.form, { saved: true })); this.setData({ saved: true }); wx.showToast({ title: '已记到我家牛羊', icon: 'success' }); }
    catch (e) { this.setData({ error: '这次没有保存成功，请再试一次' }); }
  },
  getHelp() { wx.navigateTo({ url: '/pages/help/index' }); }
});
