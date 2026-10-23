function sendPrompt() {
  if (state.running) {
    cancelRun();
    return;
  }
  const input = $('#promptInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }
  input.value = '';
  autoGrow();
  runAgent(text);
}

function startNewSession() {
  if (state.running) {
    toast('Agent 正在执行，请先停止当前任务', 'error');
    return null;
  }
  const session = createSession(true);
  closeDrawers();
  state.mode = 'new';
  state.refs = [];
  setMobileView('chat');
  renderAll(true);
  persistActive();
  toast('已新建创作会话');
  return session;
}

function loadSession(id) {
  if (state.running) {
    toast('Agent 正在执行，请先停止当前任务', 'error');
    return;
  }
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  state.activeId = id;
  state.refs = [];
  state.compare = false;
  state.comparePos = 50;
  state.mode = currentAsset() ? 'edit' : 'new';
  persistActive();
  saveSessions();
  closeDrawers();
  setMobileView('chat');
  renderAll(true);
}

function deleteSession(id) {
  if (state.running) {
    toast('Agent 正在执行，请先停止当前任务', 'error');
    return;
  }
  const session = state.sessions.find((item) => item.id === id);
  if (!session) return;
  if (!window.confirm(`删除「${session.title}」？本地记录与图片将从会话列表中移除。`)) return;
  state.sessions = state.sessions.filter((item) => item.id !== id);
  if (!state.sessions.length) {
    createSession(true, true);
  } else if (state.activeId === id) {
    state.activeId = state.sessions[0].id;
    state.mode = currentAsset() ? 'edit' : 'new';
    state.refs = [];
  }
  saveSessions();
  persistActive();
  renderAll(true);
  toast('会话已删除');
}

function applySuggestion(index) {
  const suggestion = SUGGESTIONS[Number(index)];
  if (!suggestion) return;
  const input = $('#promptInput');
  if (!input) return;
  input.value = suggestion.prompt;
  autoGrow();
  input.focus();
  if (suggestion.needsRef && !state.refs.length) {
    toast('建议先添加一张参考图，再发送这条指令');
    $('#fileInput').click();
  }
}

function setMode(mode) {
  if (state.running) return;
  if (mode === 'edit' && !currentAsset()) {
    toast('还没有可编辑的画面', 'error');
    return;
  }
  state.mode = mode === 'edit' ? 'edit' : 'new';
  state.compare = false;
  capRefsForMode();
  renderInspector();
  renderComposerState();
  const input = $('#promptInput');
  if (input) input.focus();
}

function handleAction(action, target) {
  switch (action) {
    case 'new-session':
      startNewSession();
      break;
    case 'open-history':
      openHistory();
      break;
    case 'close-drawers':
      closeDrawers();
      break;
    case 'open-inspector':
      openInspector();
      break;
    case 'close-inspector':
      closeDrawers();
      break;
    case 'load-session':
      loadSession(target.dataset.id);
      break;
    case 'delete-session':
      deleteSession(target.dataset.id);
      break;
    case 'open-key':
      openKeyModal();
      break;
    case 'close-key':
      closeKeyModal();
      break;
    case 'save-key':
      saveKey();
      break;
    case 'use-demo':
      useDemoMode();
      break;
    case 'toggle-key': {
      const input = $('#keyInput');
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
      break;
    }
    case 'use-suggestion':
      applySuggestion(target.dataset.index);
      break;
    case 'set-mode':
      setMode(target.dataset.mode);
      break;
    case 'set-setting': {
      const key = target.dataset.setting;
      const value = target.dataset.value;
      if (!key || !value) break;
      state.settings[key] = value;
      saveSettings();
      renderInspector();
      renderComposerState();
      break;
    }
    case 'toggle-setting': {
      const key = target.dataset.setting;
      if (!key) break;
      state.settings[key] = !state.settings[key];
      saveSettings();
      renderInspector();
      renderComposerState();
      break;
    }
    case 'add-ref':
      $('#fileInput').click();
      break;
    case 'remove-ref':
      removeRef(target.dataset.id);
      break;
    case 'select-asset':
      selectAsset(target.dataset.id);
      break;
    case 'edit-asset':
      selectAsset(target.dataset.id, { focusEdit: true });
      break;
    case 'download-asset':
      downloadAsset(target.dataset.id);
      break;
    case 'retry':
      retryMessage(target.dataset.messageId);
      break;
    case 'toggle-compare':
      state.compare = !state.compare;
      renderStage();
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
    case 'remake-asset':
      remakeAsset();
      break;
    case 'mobile-tab':
      setMobileView(target.dataset.view);
      break;
    case 'send':
      sendPrompt();
      break;
    default:
      break;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.preventDefault();
  handleAction(target.dataset.action, target);
});

document.addEventListener('input', (event) => {
  if (!event.target.classList || !event.target.classList.contains('compare-range')) return;
  const value = Number(event.target.value);
  state.comparePos = value;
  const current = $('#canvasShell .canvas-layer.current');
  if (current) current.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
  const line = $('#canvasShell .compare-line');
  if (line) line.style.left = `${value}%`;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if ($('#keyModal').classList.contains('show')) {
      closeKeyModal();
      return;
    }
    closeDrawers();
  }

  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    if ($('#keyModal').classList.contains('show')) return;
    event.preventDefault();
    sendPrompt();
    return;
  }

  const input = $('#promptInput');
  if (!input || event.target !== input) return;
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendPrompt();
  }
});

const promptInput = $('#promptInput');
if (promptInput) {
  promptInput.addEventListener('input', autoGrow);
}

const sendBtn = $('#sendBtn');
if (sendBtn) {
  sendBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    sendPrompt();
  });
}

const fileInput = $('#fileInput');
if (fileInput) {
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    if (files.length) await addFiles(files);
  });
}

$('#keyModal').addEventListener('click', (event) => {
  if (event.target === $('#keyModal')) closeKeyModal();
});

$('#keyInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveKey();
  }
});

let dragDepth = 0;
const dropOverlay = $('#dropOverlay');

window.addEventListener('dragenter', (event) => {
  if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
  event.preventDefault();
  dragDepth += 1;
  dropOverlay.classList.add('show');
});

window.addEventListener('dragover', (event) => {
  if (!event.dataTransfer || !Array.from(event.dataTransfer.types || []).includes('Files')) return;
  event.preventDefault();
});

window.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.classList.remove('show');
});

window.addEventListener('drop', async (event) => {
  if (!event.dataTransfer) return;
  event.preventDefault();
  dragDepth = 0;
  dropOverlay.classList.remove('show');
  const files = Array.from(event.dataTransfer.files || []);
  if (files.length) {
    setMobileView(window.innerWidth <= 860 ? 'chat' : state.mobileView);
    await addFiles(files);
  }
});

document.addEventListener('paste', async (event) => {
  if (!event.clipboardData) return;
  const files = Array.from(event.clipboardData.files || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;
  event.preventDefault();
  await addFiles(files);
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.mobileView === 'stage' || window.innerWidth > 860) fitCanvas();
  }, 120);
});

let fullscreenReturnView = null;
document.addEventListener('fullscreenchange', () => {
  const shell = $('#canvasShell');
  if (!shell) return;
  if (document.fullscreenElement) {
    fullscreenReturnView = state.mobileView;
    if (state.mobileView !== 'stage') setMobileView('stage');
  } else {
    if (fullscreenReturnView) setMobileView(fullscreenReturnView);
    fullscreenReturnView = null;
    setTimeout(fitCanvas, 60);
  }
});

hydrateIcons();
renderAll();
setMobileView('chat');
loadConfig();

setTimeout(() => {
  if (window.innerWidth > 860) {
    const input = $('#promptInput');
    if (input) input.focus();
  }
}, 260);
