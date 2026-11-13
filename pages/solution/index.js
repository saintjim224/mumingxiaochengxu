Page({
  data: {
    counties: [
      { id: 'naqu', name: '西藏 · 那曲色尼区', altitude: '4500m', temp: '-14', weather: '大风伴阵雪', wind: '西北风 5-6级', feelTemp: '-19', riskLevel: 'orange', riskTitle: '暴风雪黄色预警', riskDesc: '预计夜间阵风可达8级，积雪深度将达12cm，谨防白灾受冻' },
      { id: 'maduo', name: '青海 · 果洛玛多县', altitude: '4300m', temp: '-16', weather: '晴转阴雪', wind: '西风 4-5级', feelTemp: '-21', riskLevel: 'blue', riskTitle: '强降温蓝色预警', riskDesc: '48小时降温幅度达8℃以上，夜间极端低温逼近-24℃' },
      { id: 'shiqu', name: '四川 · 甘孜石渠县', altitude: '4250m', temp: '-13', weather: '严寒多云', wind: '偏北风 4-5级', feelTemp: '-18', riskLevel: 'orange', riskTitle: '低温积雪预警', riskDesc: '高寒牧草被积雪硬壳覆盖，建议增加人工补饲' },
      { id: 'dangxiong', name: '西藏 · 当雄县草场', altitude: '4280m', temp: '-11', weather: '多云间阴', wind: '偏北风 3-4级', feelTemp: '-15', riskLevel: 'green', riskTitle: '天气相对平稳', riskDesc: '当前气温适宜午间放牧，请于16:00前归牧暖棚' }
    ],
    selectedCountyIndex: 0,
    currentCounty: {},
    grazingAdvice: {
      status: '极寒慎牧',
      timeSlot: '11:30 ~ 15:00',
      radius: '控制在 2.0 公里以内',
      warmShed: '加固迎风侧防风帘，谨防积雪压顶',
      feedAction: '补饲燕麦干草与精饲料，提供温水防冻胃'
    },
    indicators: [
      { name: '草场积雪', val: '11 cm', status: '覆草较深', warn: true },
      { name: '风寒体感', val: '-19 ℃', status: '冻伤高危', warn: true },
      { name: '高寒冻土', val: '120 cm', status: '深度冻结', warn: false },
      { name: '草情NDVI', val: '0.28', status: '枯草越冬期', warn: false }
    ],
    lastUpdate: '刚刚更新'
  },

  onLoad() {
    this.setData({
      currentCounty: this.data.counties[0]
    });
  },

  onCountyChange(e) {
    const idx = e.detail.value;
    const county = this.data.counties[idx];
    this.setData({
      selectedCountyIndex: idx,
      currentCounty: county
    });
    wx.showToast({
      title: '已切换至 ' + county.name.split('·')[1],
      icon: 'none'
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id || 'snow_defense';
    wx.navigateTo({
      url: '/pages/detail/index?id=' + id
    });
  },

  callRescue() {
    wx.makePhoneCall({
      phoneNumber: '0896-3822119'
    });
  },

  onPullDownRefresh() {
    setTimeout(() => {
      this.setData({ lastUpdate: '刚刚刷新' });
      wx.stopPullDownRefresh();
      wx.showToast({ title: '看板数据已刷新', icon: 'success' });
    }, 500);
  }
});
