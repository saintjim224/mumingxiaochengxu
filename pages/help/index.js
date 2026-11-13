const { CONTACT_TYPES, loadContacts, saveContact, callContact } = require('../../utils/contacts');
Page({
  data: { contacts: [], editor: null, name: '', phone: '', error: '' },
  onShow() { this.refresh(); },
  refresh() {
    const saved = loadContacts();
    this.setData({
      contacts: CONTACT_TYPES.map(type => {
        const contact = saved[type.id];
        return Object.assign({}, type, {
          contact,
          initial: contact && contact.name ? String(contact.name).trim().slice(0, 1) : ''
        });
      })
    });
  },
  edit(e) { const item = this.data.contacts.find(c => c.id === e.currentTarget.dataset.id); if (!item) return; this.setData({ editor: item, name: item.contact ? item.contact.name : '', phone: item.contact ? item.contact.phone : '', error: '' }); },
  close() { this.setData({ editor: null }); },
  noOp() {},
  onName(e) { this.setData({ name: e.detail.value }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  save() { try { saveContact(this.data.editor.id, this.data.name, this.data.phone); this.refresh(); this.close(); wx.showToast({ title: '电话已记好', icon: 'success' }); } catch(e) { this.setData({ error: e.message || '保存失败，请重试' }); } },
  call(e) { const item = this.data.contacts.find(c => c.id === e.currentTarget.dataset.id); if (item && item.contact) callContact(item.contact.name, item.contact.phone); },
  emergency(e) { const numbers = { '110': '报警求助', '119': '消防救援', '120': '急救中心' }; const number = String(e.currentTarget.dataset.phone); if (numbers[number]) callContact(numbers[number], number); }
});
