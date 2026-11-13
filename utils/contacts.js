const KEY = 'rt-muban-contacts-v1';
const CONTACT_TYPES = [
  { id: 'vet', name: '找兽医', description: '牛羊不舒服，问问专业的人', placeholder: '如：王兽医', icon: 'line-yak', tone: 'pine' },
  { id: 'village', name: '找村里', description: '困难求助，先联系熟悉的人', placeholder: '如：村部联系人', icon: 'line-phone', tone: 'clay' },
  { id: 'forage', name: '找草料', description: '提前问问，备草更从容', placeholder: '如：送草料的李师傅', icon: 'line-hay', tone: 'brass' }
];
function loadContacts() { try { const value = wx.getStorageSync(KEY); return value && typeof value === 'object' ? value : {}; } catch (e) { return {}; } }
function validateContact(name, phone) {
  if (!String(name || '').trim()) return '先填联系人怎么称呼';
  if (!/^(?:1\d{10}|0\d{2,3}-?\d{7,8})$/.test(String(phone || '').trim())) return '请填 11 位手机号，或带区号的座机号';
  return '';
}
function saveContact(id, name, phone) {
  if (!CONTACT_TYPES.some(item => item.id === id)) throw new Error('请选择联系人类型');
  const error = validateContact(name, phone); if (error) throw new Error(error);
  const contacts = loadContacts(); contacts[id] = { name: name.trim(), phone: phone.trim() }; wx.setStorageSync(KEY, contacts); return contacts;
}
function callContact(name, phone) {
  wx.showModal({ title: '给' + name + '打电话', content: phone, confirmText: '拨打电话', confirmColor: '#355f3f', success(res) {
    if (res.confirm) wx.makePhoneCall({ phoneNumber: phone, fail(err) { if (!/cancel/.test(err.errMsg || '')) wx.showToast({ title: '没能拨出，可按号码手动拨打', icon: 'none' }); } });
  } });
}
module.exports = { CONTACT_TYPES, loadContacts, validateContact, saveContact, callContact };
