const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  sliders: '<path d="M4 6h4M12 6h8M4 12h10M18 12h2M4 18h2M10 18h10"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
  sparkles: '<path d="m12 3 1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5L5 20"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  key: '<circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 8-8M15 8l3 3M17 6l3 3"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  compare: '<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-14.9-3M4 4v4h4M4 13a8.1 8.1 0 0 0 14.9 3M20 20v-4h-4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  diamond: '<path d="m12 3 7 5-7 13L5 8l7-5Z"/><path d="M5 8h14"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-4-4-7-9-7Z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="9.5" cy="7.5" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  expand: '<path d="M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  wand: '<path d="m15 4 5 5M4 20 15 9M6 4v4M4 6h4M18 16v4M16 18h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};

const MODEL_INFO = {
  lite: { id: 'sensenova-u1.5-lite', short: 'U1.5 Lite', name: 'SenseNova U1.5 Lite' },
  fast: { id: 'sensenova-u1.5-fast', short: 'U1.5 Fast', name: 'SenseNova U1.5 Fast' }
};

const DEFAULT_SETTINGS = {
  model: 'auto',
  ratio: 'auto',
  format: 'png',
  refine: true,
  enhance: true,
  noWatermark: true
};

const RATIOS = [
  { value: 'auto', label: '自动', glyph: [13, 13, true] },
  { value: '1:1', label: '1:1', glyph: [12, 12] },
  { value: '16:9', label: '16:9', glyph: [14, 8] },
  { value: '9:16', label: '9:16', glyph: [8, 14] },
  { value: '2:3', label: '2:3', glyph: [9, 13] },
  { value: '3:2', label: '3:2', glyph: [13, 9] }
];

const SIZE_MAP = {
  '1:1': '2048x2048',
  '16:9': '2720x1536',
  '9:16': '1536x2720',
  '2:3': '1664x2496',
  '3:2': '2496x1664'
};

const SUGGESTIONS = [
  {
    icon: 'layers',
    title: '山野咖啡海报',
    desc: '复杂排版 · 中文文字 · 复古印刷',
    prompt: '为一家山野咖啡馆设计开业海报。主视觉是晨雾中的木屋与松林，暖色晨光，画面中央有手写感中文标题「山野有风」，下方小字「本周六 · 正式营业」。复古丝网印刷质感，克制的奶油色与森林绿配色，留白充足，网格严谨。'
  },
  {
    icon: 'image',
    title: '风格改造实验',
    desc: '上传参考图 · 保留构图 · 动画质感',
    prompt: '将参考图改写为吉卜力动画风格：保留人物、构图与画面主体，使用柔和的手绘笔触、通透的自然光、层次丰富的绿色植被与细腻的云层，整体温暖而富有故事感。',
    needsRef: true
  },
  {
    icon: 'diamond',
    title: '产品级静物摄影',
    desc: '极简构图 · 商业光影 · 材质细节',
    prompt: '生成一张极简商业静物摄影：磨砂金属香水瓶置于浅灰色石材台面，柔和侧逆光勾勒玻璃与金属边缘，背景干净，微妙的长阴影，高端美妆广告质感，8K 细节，居中构图。'
  }
];

const STORAGE_KEYS = {
  sessions: 'nova.sessions.v1',
  active: 'nova.active.v1',
  settings: 'nova.settings.v1',
  key: 'nova.key.v1',
  demo: 'nova.demo.v1'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function icon(name, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[name] || ''}</svg>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function uid(prefix = 'id') {
  if (window.crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pause(ms) {
  await sleep(ms);
  if (state.cancelRequested) {
    const error = new Error('已取消');
    error.name = 'AbortError';
    throw error;
  }
}

function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return formatClock(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTokens(value) {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatElapsed(ms) {
  if (!ms && ms !== 0) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const storedSettings = loadJSON(STORAGE_KEYS.settings, {});
const storedSessions = loadJSON(STORAGE_KEYS.sessions, []);

const state = {
  cfg: { hasServerKey: false },
  key: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.key) || '';
    } catch {
      return '';
    }
  })(),
  settings: { ...DEFAULT_SETTINGS, ...(storedSettings && typeof storedSettings === 'object' ? storedSettings : {}) },
  sessions: Array.isArray(storedSessions) ? storedSessions : [],
  activeId: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.active) || '';
    } catch {
      return '';
    }
  })(),
  refs: [],
  mode: 'new',
  compare: false,
  comparePos: 50,
  running: null,
  abort: null,
  cancelRequested: false,
  runSerial: 0,
  mobileView: 'chat',
  lastDemoNotice: 0,
  forceDemo: (() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.demo) === '1';
    } catch {
      return false;
    }
  })()
};

function currentSession() {
  return state.sessions.find((session) => session.id === state.activeId) || state.sessions[0] || null;
}

function currentAsset() {
  const session = currentSession();
  if (!session) return null;
  return session.assets.find((asset) => asset.id === session.currentId) || null;
}

function findAsset(id) {
  const session = currentSession();
  if (!session) return null;
  return session.assets.find((asset) => asset.id === id) || null;
}

function usingDemo() {
  return state.forceDemo || (!state.key && !state.cfg.hasServerKey);
}

function makeIntroMessage() {
  return {
    id: uid('m'),
    role: 'agent',
    kind: 'intro',
    at: Date.now()
  };
}

function createSession(activate = true, silent = false) {
  const session = {
    id: uid('s'),
    title: '未命名创作',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [makeIntroMessage()],
    assets: [],
    currentId: null,
    counters: { calls: 0, input: 0, output: 0, demo: 0 }
  };
  state.sessions.unshift(session);
  if (state.sessions.length > 16) {
    state.sessions = state.sessions.slice(0, 16);
  }
  if (activate) {
    state.activeId = session.id;
    state.mode = 'new';
    state.refs = [];
    state.compare = false;
    state.comparePos = 50;
  }
  if (!silent) {
    saveSessions();
    persistActive();
  }
  return session;
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state.sessions));
  } catch {
    while (state.sessions.length > 1) {
      const removable = state.sessions.filter((session) => session.id !== state.activeId).pop();
      if (!removable) break;
      state.sessions = state.sessions.filter((session) => session.id !== removable.id);
      try {
        localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state.sessions));
        return;
      } catch {
        continue;
      }
    }
  }
}

function persistActive() {
  try {
    localStorage.setItem(STORAGE_KEYS.active, state.activeId || '');
  } catch {
    return;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  } catch {
    return;
  }
}

if (!state.sessions.length) {
  createSession(true, true);
} else {
  state.sessions = state.sessions.filter((session) => session && Array.isArray(session.messages));
  if (!state.sessions.length) createSession(true, true);
  if (!state.sessions.some((session) => session.id === state.activeId)) {
    state.activeId = state.sessions[0].id;
  }
  state.sessions.forEach((session) => {
    session.assets = Array.isArray(session.assets) ? session.assets : [];
    session.counters = { calls: 0, input: 0, output: 0, demo: 0, ...(session.counters || {}) };
    if (!session.assets.some((asset) => asset.id === session.currentId)) {
      session.currentId = session.assets.length ? session.assets[session.assets.length - 1].id : null;
    }
  });
  state.mode = currentAsset() ? 'edit' : 'new';
}

const validModels = ['auto', 'lite', 'fast'];
const validRatios = ['auto', '1:1', '16:9', '9:16', '2:3', '3:2'];
const validFormats = ['png', 'jpeg', 'webp'];
if (!validModels.includes(state.settings.model)) state.settings.model = 'auto';
if (!validRatios.includes(state.settings.ratio)) state.settings.ratio = 'auto';
if (!validFormats.includes(state.settings.format)) state.settings.format = 'png';
['refine', 'enhance', 'noWatermark'].forEach((key) => {
  if (typeof state.settings[key] !== 'boolean') state.settings[key] = DEFAULT_SETTINGS[key];
});

document.body.dataset.mobileView = 'chat';

function hydrateIcons() {
  $$('[data-icon]').forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

function toast(message, type = '') {
  const stack = $('#toastStack');
  if (!stack) return;
  const node = document.createElement('div');
  node.className = `toast ${type}`.trim();
  node.textContent = message;
  stack.appendChild(node);
  while (stack.children.length > 3) stack.firstElementChild.remove();
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 200);
  }, 3200);
}

function notifyDemo() {
  const now = Date.now();
  if (now - state.lastDemoNotice < 12000) return;
  state.lastDemoNotice = now;
  toast('未配置 API Key，当前使用本地演示画面');
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    if (data && data.ok) state.cfg = data;
  } catch {
    state.cfg = { hasServerKey: false };
  }
  renderAll();
}

function setMobileView(view) {
  state.mobileView = view === 'stage' ? 'stage' : 'chat';
  document.body.dataset.mobileView = state.mobileView;
  $$('.mobile-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === state.mobileView);
  });
  if (state.mobileView === 'stage') requestAnimationFrame(fitCanvas);
}

function openHistory() {
  $('#historyDrawer').classList.add('open');
  $('#scrim').classList.add('show');
  $('#inspector').classList.remove('open');
}

function openInspector() {
  $('#inspector').classList.add('open');
  $('#scrim').classList.add('show');
  $('#historyDrawer').classList.remove('open');
}

function closeDrawers() {
  $('#historyDrawer').classList.remove('open');
  $('#inspector').classList.remove('open');
  $('#scrim').classList.remove('show');
}

function openKeyModal() {
  $('#keyModal').classList.add('show');
  $('#keyModal').setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    const input = $('#keyInput');
    if (input) {
      input.value = '';
      input.focus();
    }
  }, 120);
}

function closeKeyModal() {
  $('#keyModal').classList.remove('show');
  $('#keyModal').setAttribute('aria-hidden', 'true');
}

function saveKey() {
  const input = $('#keyInput');
  const value = input ? input.value.trim() : '';
  if (!value && !state.key && !state.cfg.hasServerKey) {
    toast('请填入 API Key，或选择演示模式', 'error');
    return;
  }
  if (value) {
    state.key = value;
    try {
      localStorage.setItem(STORAGE_KEYS.key, value);
    } catch {
      toast('浏览器无法保存密钥，本次会话仍可使用', 'error');
    }
  }
  state.forceDemo = false;
  try {
    localStorage.removeItem(STORAGE_KEYS.demo);
  } catch {
    state.forceDemo = false;
  }
  closeKeyModal();
  renderAll();
  toast(value || state.key ? '已保存 API Key，下一次创作将调用真实模型' : '正在使用服务端 API Key', 'success');
}

function useDemoMode() {
  state.key = '';
  state.forceDemo = true;
  try {
    localStorage.removeItem(STORAGE_KEYS.key);
    localStorage.setItem(STORAGE_KEYS.demo, '1');
  } catch {
    state.forceDemo = true;
  }
  closeKeyModal();
  renderAll();
  toast('已切换到演示模式');
}
