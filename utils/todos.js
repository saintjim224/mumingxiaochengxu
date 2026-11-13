const KEY = 'rt-muban-todos-v1';

const DEFAULT_TODOS = [
  { id: 'shed', text: '早起查棚：关严门窗，幼弱畜防风', done: false, tag: '防寒要点', guideId: 'shed_guard', page: 'detail' },
  { id: 'water', text: '午间化冰：水槽敲冰，备足温饮水', done: false, tag: '饮水要点', guideId: 'snow_defense', page: 'detail' },
  { id: 'feed', text: '按温补草：天寒添草，查存草余量', done: false, tag: '草料测算', guideId: 'feed_storage', page: 'feed' },
  { id: 'count', text: '傍晚清点：数清牛羊，弱畜分圈护', done: false, tag: '牛羊清点', page: 'aboutUs' }
];

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadTodos() {
  const today = getTodayString();
  let stored = null;
  try {
    stored = wx.getStorageSync(KEY);
  } catch (e) {
    // Storage fallback
  }

  if (stored && stored.date === today && Array.isArray(stored.list) && stored.list.length > 0) {
    return stored.list;
  }

  // If new day, preserve user-added custom items with done=false, and reset default items
  let baseList = DEFAULT_TODOS.map(item => Object.assign({}, item, { done: false }));
  if (stored && Array.isArray(stored.list)) {
    const customItems = stored.list
      .filter(item => item.id && String(item.id).startsWith('custom_'))
      .map(item => Object.assign({}, item, { done: false }));
    baseList = baseList.concat(customItems);
  }

  saveTodos(baseList);
  return baseList;
}

function saveTodos(list) {
  const today = getTodayString();
  try {
    wx.setStorageSync(KEY, { date: today, list });
  } catch (e) {
    // Storage error
  }
}

function toggleTodo(id) {
  const list = loadTodos();
  const item = list.find(t => t.id === id);
  if (item) {
    item.done = !item.done;
    saveTodos(list);
  }
  return list;
}

function addTodo(text, tag) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { error: '请写下要记的事情' };
  const list = loadTodos();
  const newItem = {
    id: 'custom_' + Date.now(),
    text: trimmed,
    done: false,
    tag: tag || '记一笔'
  };
  list.push(newItem);
  saveTodos(list);
  return { list, item: newItem };
}

function removeTodo(id) {
  let list = loadTodos();
  list = list.filter(t => t.id !== id);
  saveTodos(list);
  return list;
}

function getTodoStats(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return { total: 0, completed: 0, allDone: false, label: '0/0' };
  }
  const completed = list.filter(t => t.done).length;
  return {
    total: list.length,
    completed,
    allDone: completed === list.length && list.length > 0,
    label: `${completed}/${list.length}`
  };
}

module.exports = {
  loadTodos,
  saveTodos,
  toggleTodo,
  addTodo,
  removeTodo,
  getTodoStats,
  DEFAULT_TODOS
};
