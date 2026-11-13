const { GUIDES } = require('../../utils/guides');
Page({
  data: { article: {}, activeId: 'snow_defense', tabs: [{id:'snow_defense',name:'下雪降温'}, {id:'shed_guard',name:'护好暖棚'}, {id:'feed_storage',name:'备好草料'}] },
  onLoad(options) { this.showGuide(options.id || 'snow_defense'); },
  showGuide(id) { const activeId = GUIDES[id] ? id : 'snow_defense'; this.setData({ activeId, article: GUIDES[activeId] }); },
  changeGuide(e) { this.showGuide(e.currentTarget.dataset.id); wx.pageScrollTo({scrollTop:0,duration:200}); },
  openHelp() { wx.navigateTo({ url:'/pages/help/index' }); },
  openFeed() { wx.navigateTo({ url:'/pages/feed/index' }); }
});