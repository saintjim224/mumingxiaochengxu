const { COUNTIES, loadFarm } = require('../../utils/farm');
const { askQuestion } = require('../../services/pasture');
Page({
  data: { input: '', messages: [], busy: false, error: '', questions: [
    { text: '今天能不能出牧？', page: 'weather' },
    { text: '家里草料还够几天？', page: 'feed' },
    { text: '下雪了，怎么护暖棚？', page: 'detail', id: 'shed_guard' },
    { text: '牛羊不舒服，找谁问？', page: 'help' }
  ] },
  onUnload() { this._unloaded = true; },
  onInput(e) { this.setData({ input: e.detail.value }); },
  openQuestion(e) { const item = this.data.questions[Number(e.currentTarget.dataset.index)]; if(item) wx.navigateTo({ url: '/pages/' + item.page + '/index' + (item.id ? '?id=' + item.id : '') }); },
  async send() {
    const query = this.data.input.trim(); if (!query || this.data.busy) return;
    const history = this.data.messages.slice(-6).map(m => ({ sender: m.sender === 'user' ? 'user' : 'ai', text: m.text }));
    this.setData({ busy: true, error: '', messages: this.data.messages.concat({ id: Date.now(), sender: 'user', text: query }), input: '' });
    try { const answer = await askQuestion(query, COUNTIES[loadFarm().countyIndex], history); if (!this._unloaded) this.setData({ messages: this.data.messages.concat({ id: Date.now() + 1, sender: 'assistant', text: answer.text, source: answer.source }) }); }
    catch (e) { if (!this._unloaded) this.setData({ error: '这会儿没连上牧小安。你可以重新发送，或点上面的常见问题，继续办事。', input: query }); }
    finally { if (!this._unloaded) { this.setData({ busy: false }); wx.pageScrollTo({ selector: '#ask-compose', duration: 200 }); } }
  }
});
