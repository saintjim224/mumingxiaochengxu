const { COUNTIES, loadFarm, saveFarm, validateFarm, calculateFeed } = require('../../utils/farm');
Page({
  data: {
    farm: {},
    form: {},
    counties: COUNTIES,
    county: COUNTIES[0],
    editing: false,
    error: '',
    summary: null,
    farmCover: '/images/dynamic/banner_dawn_pasture.jpg'
  },
  onShow() {
    this.refresh();
    try {
      const custom = wx.getStorageSync && wx.getStorageSync('custom_farm_cover');
      if (custom) this.setData({ farmCover: custom });
    } catch (e) {}
  },
  refresh() {
    const farm = loadFarm();
    const result = calculateFeed(farm);
    this.setData({ farm, form: Object.assign({}, farm), county: COUNTIES[farm.countyIndex], summary: result.error ? null : result });
  },
  chooseCover() {
    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          if (res && res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath) {
            const path = res.tempFiles[0].tempFilePath;
            try { if (wx.setStorageSync) wx.setStorageSync('custom_farm_cover', path); } catch(err) {}
            this.setData({ farmCover: path });
            if (wx.showToast) wx.showToast({ title: '牧场照片已更新', icon: 'success' });
          }
        }
      });
    }
  },
  previewCover() {
    if (typeof wx.previewImage === 'function') {
      wx.previewImage({ urls: [this.data.farmCover] });
    }
  },
  startEdit() { this.setData({ form: Object.assign({}, this.data.farm), editing: true, error: '' }); },
  cancelEdit() { this.setData({ editing: false, error: '' }); },
  onInput(e) { const field = e.currentTarget.dataset.field; if (['yaks','sheep','hay'].includes(field)) this.setData({ ['form.' + field]: e.detail.value }); },
  onCountyChange(e) { this.setData({ 'form.countyIndex': Number(e.detail.value) }); },
  save() {
    const error = validateFarm(this.data.form); if (error) return this.setData({ error });
    try { saveFarm(Object.assign({}, this.data.form, { saved: true })); this.refresh(); this.setData({ editing: false, error: '' }); wx.showToast({ title: '已经记好了', icon: 'success' }); }
    catch(e) { this.setData({ error: '没有保存成功，请再试一次' }); }
  },
  openFeed() { wx.navigateTo({ url: '/pages/feed/index' }); },
  openHelp() { wx.navigateTo({ url: '/pages/help/index' }); }
});