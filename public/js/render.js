function renderAll(forceScroll = false) {
  renderConnection();
  renderSessionHeader();
  renderChat(forceScroll);
  renderStage();
  renderFilmstrip();
  renderInspector();
  renderComposerState();
  renderHistory();
}

function renderConnection() {
  const pill = $('#connStatus');
  const text = $('#connText');
  if (!pill || !text) return;
  pill.classList.remove('live', 'demo', 'error');
  if (state.forceDemo) {
    pill.classList.add('demo');
    text.textContent = '演示模式';
  } else if (state.key) {
    pill.classList.add('live');
    text.textContent = '已连接 · 本地密钥';
  } else if (state.cfg.hasServerKey) {
    pill.classList.add('live');
    text.textContent = '已连接 · 服务端密钥';
  } else {
    pill.classList.add('demo');
    text.textContent = '演示模式';
  }
}

function renderSessionHeader() {
  const session = currentSession();
  if (!session) return;
  $('#sessionTitle').textContent = session.title;
  const nextTitle = `${session.title} · Nova Atelier`;
  if (document.title !== nextTitle) document.title = nextTitle;
}

function renderChat(forceScroll = false) {
  const session = currentSession();
  const scroll = $('#chatScroll');
  if (!session || !scroll) return;
  const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 140;
  scroll.innerHTML = session.messages.map((message) => renderMessage(message, session)).join('');
  if (forceScroll || nearBottom) {
    requestAnimationFrame(() => {
      scroll.scrollTop = scroll.scrollHeight;
    });
  }
}

function renderMessage(message, session) {
  if (message.kind === 'intro') return renderIntro();
  if (message.role === 'user') {
    return `
      <div class="msg user" data-message-id="${esc(message.id)}">
        <div class="user-bubble">${esc(message.text)}</div>
      </div>
    `;
  }

  const asset = message.assetId ? session.assets.find((item) => item.id === message.assetId) : null;
  const stepHtml = message.steps && message.steps.length ? renderTrace(message.steps) : '';
  const textHtml = message.text ? `<div class="agent-text">${message.text}</div>` : '';
  const errorHtml = message.error ? renderError(message) : '';
  const assetHtml = asset ? renderAssetCard(asset, session) : '';
  const cancelled = message.cancelled && !message.text ? '<div class="agent-text">已停止当前任务。画布与已完成的版本会保留。</div>' : '';
  return `
    <div class="msg agent" data-message-id="${esc(message.id)}">
      <div class="agent-head">
        <span class="agent-orb">${icon('sparkles')}</span>
        <strong>Agent</strong>
        <span class="agent-time">${formatClock(message.at || Date.now())}</span>
      </div>
      <div class="agent-body">
        ${textHtml}
        ${stepHtml}
        ${cancelled}
        ${errorHtml}
        ${assetHtml}
      </div>
    </div>
  `;
}

function renderIntro() {
  return `
    <div class="intro">
      <div class="intro-orb">${icon('sparkles')}</div>
      <h2>把想法交给一个<br><em>会创作的 Agent</em></h2>
      <p>描述画面，或拖入一张参考图。我会选择 U1.5 Lite 或 Fast，自动完成生成、编辑与细节精修。</p>
      <div class="suggestion-list">
        ${SUGGESTIONS.map((item, index) => `
          <button class="suggestion" data-action="use-suggestion" data-index="${index}">
            <span class="suggestion-icon">${icon(item.icon)}</span>
            <span class="suggestion-copy">
              <strong>${esc(item.title)}</strong>
              <span>${esc(item.desc)}</span>
            </span>
            <span class="suggestion-arrow">${icon('chevron-right')}</span>
          </button>
        `).join('')}
      </div>
      <div class="intro-foot">
        <span class="capability-chip">TEXT → IMAGE</span>
        <span class="capability-chip">IMAGE → IMAGE</span>
        <span class="capability-chip">MULTI-REFERENCE</span>
        <span class="capability-chip">AGENT LOOP</span>
      </div>
    </div>
  `;
}

function renderTrace(steps) {
  return `
    <div class="trace">
      ${steps.map((step) => {
        const status = step.status || 'pending';
        const nodeIcon = status === 'done' ? 'check' : status === 'failed' ? 'alert' : status === 'cancelled' ? 'stop' : status === 'skipped' ? 'check' : status === 'running' ? 'refresh' : 'clock';
        return `
          <div class="trace-step ${status}">
            <span class="trace-node" ${status === 'running' ? 'style="animation:spin 1.1s linear infinite"' : ''}>${icon(nodeIcon)}</span>
            <div class="trace-copy">
              <div class="trace-label">
                <span>${esc(step.label)}</span>
                <span class="trace-tag">${esc(step.tag || '')}</span>
              </div>
              ${step.detail ? `<div class="trace-detail">${esc(step.detail)}</div>` : ''}
              ${step.meta ? `<details class="trace-json"><summary>请求参数</summary><pre>${esc(JSON.stringify(step.meta, null, 2))}</pre></details>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function kindLabel(kind) {
  return ({
    generate: 'T2I',
    edit: 'EDIT',
    reference: 'REF',
    refine: 'POLISH'
  }[kind] || 'IMAGE');
}

function renderAssetCard(asset, session) {
  const model = asset.demo ? 'DEMO' : (asset.model === 'sensenova-u1.5-fast' ? 'U1.5 Fast' : 'U1.5 Lite');
  const size = asset.width && asset.height ? `${asset.width}×${asset.height}` : (asset.size || 'auto');
  return `
    <div class="asset-card">
      <button class="asset-thumb" data-action="select-asset" data-id="${esc(asset.id)}" aria-label="在画布中查看">
        <img src="${esc(asset.url)}" alt="${esc(asset.prompt)}" loading="lazy" />
        <span class="asset-kind ${asset.demo ? 'demo' : ''}">${asset.demo ? 'DEMO' : kindLabel(asset.kind)}</span>
        <span class="asset-open-hint">在画布打开</span>
      </button>
      <div class="asset-info">
        <div class="asset-prompt">${esc(asset.prompt)}</div>
        <div class="asset-meta">
          <span>${esc(model)}</span><i class="meta-dot"></i>
          <span>${esc(size)}</span>
          ${asset.elapsed ? `<i class="meta-dot"></i><span>${esc(formatElapsed(asset.elapsed))}</span>` : ''}
          ${asset.usage && asset.usage.total_tokens ? `<i class="meta-dot"></i><span>${esc(formatTokens(asset.usage.total_tokens))} tok</span>` : ''}
        </div>
        <div class="asset-actions">
          <button class="card-btn" data-action="select-asset" data-id="${esc(asset.id)}">${icon('expand')}查看</button>
          <button class="card-btn accent" data-action="edit-asset" data-id="${esc(asset.id)}">${icon('edit')}继续编辑</button>
          <button class="card-btn" data-action="download-asset" data-id="${esc(asset.id)}" aria-label="下载">${icon('download')}</button>
        </div>
      </div>
    </div>
  `;
}

function renderError(message) {
  const error = message.error;
  return `
    <div class="error-card">
      <strong>${icon('alert')}执行中断</strong>
      <p>${esc(error.message || '未知错误')}</p>
      ${error.detail ? `<details><summary>错误详情</summary><pre>${esc(error.detail)}</pre></details>` : ''}
      ${error.retry ? `<button class="card-btn" data-action="retry" data-message-id="${esc(message.id)}">${icon('refresh')}重试这一步</button>` : ''}
    </div>
  `;
}

function renderStage() {
  const session = currentSession();
  const asset = currentAsset();
  const host = $('#stageHost');
  const actions = $('#stageActions');
  if (!session || !host || !actions) return;

  if (!asset) {
    $('#stageTitle').textContent = session.title;
    $('#stageMeta').textContent = state.running ? state.running.phase : '等待第一笔';
    actions.innerHTML = '';
    host.innerHTML = state.running ? renderStageLoading() : renderStageEmpty();
    return;
  }

  const parent = asset.parentId ? session.assets.find((item) => item.id === asset.parentId) : null;
  const showCompare = state.compare && parent;
  const version = session.assets.findIndex((item) => item.id === asset.id) + 1;
  const model = asset.demo ? 'DEMO' : (asset.model === 'sensenova-u1.5-fast' ? 'U1.5 Fast' : 'U1.5 Lite');
  const size = asset.width && asset.height ? `${asset.width}×${asset.height}` : (asset.size || 'auto');
  const metaParts = [`V${version}`, model, size, asset.elapsed ? formatElapsed(asset.elapsed) : null].filter(Boolean);

  $('#stageTitle').textContent = session.title;
  $('#stageMeta').textContent = metaParts.join(' · ');
  actions.innerHTML = `
    ${parent ? `<button class="stage-btn ${showCompare ? 'active' : ''}" data-action="toggle-compare" title="对比原图">${icon('compare')}<span>对比</span></button>` : ''}
    <button class="stage-btn" data-action="remake-asset" title="按原始提示重新生成">${icon('refresh')}<span>重做</span></button>
    <button class="stage-btn" data-action="download-asset" data-id="${esc(asset.id)}" title="下载">${icon('download')}<span>下载</span></button>
    <button class="stage-btn" data-action="fullscreen" title="全屏查看">${icon('maximize')}<span>全屏</span></button>
    <button class="stage-btn accent wide" data-action="edit-asset" data-id="${esc(asset.id)}">${icon('edit')}<span>继续编辑</span></button>
  `;

  const layer = showCompare ? `
    <img class="canvas-layer base" src="${esc(parent.url)}" alt="原图" draggable="false" />
    <img class="canvas-layer current" src="${esc(asset.url)}" alt="${esc(asset.prompt)}" draggable="false" style="clip-path:inset(0 ${100 - state.comparePos}% 0 0)" />
    <div class="compare-line" style="left:${state.comparePos}%">
      <span class="compare-knob">${icon('compare')}</span>
    </div>
    <span class="compare-tag left">原图</span>
    <span class="compare-tag right">当前</span>
    <input class="compare-range" type="range" min="0" max="100" value="${state.comparePos}" aria-label="对比滑块" />
  ` : `<img class="canvas-layer current" src="${esc(asset.url)}" alt="${esc(asset.prompt)}" draggable="false" />`;

  host.innerHTML = `
    <div class="canvas-shell ${showCompare ? 'compare' : ''} ${asset.demo ? 'is-demo' : ''}" id="canvasShell">
      <button class="fs-exit" data-action="fullscreen" aria-label="退出全屏">${icon('x')}</button>
      ${layer}
      ${state.running ? renderStageOverlay() : ''}
    </div>
  `;

  requestAnimationFrame(() => {
    fitCanvas();
    const image = $('#canvasShell .canvas-layer.current');
    if (image && (!asset.width || !asset.height)) {
      image.addEventListener('load', () => {
        asset.width = image.naturalWidth || asset.width;
        asset.height = image.naturalHeight || asset.height;
        fitCanvas();
        saveSessions();
      }, { once: true });
    }
  });
}

function renderStageEmpty() {
  return `
    <div class="stage-empty" id="stageEmpty">
      <div class="empty-orb">${icon('wand')}</div>
      <h2>画布空置</h2>
      <p>在对话中描述一个画面，或把参考图拖进这里。Agent 会把结果放在这张画布上。</p>
      <div class="empty-specs">
        <span>2K NATIVE</span><span>UP TO 5 REFS</span><span>PNG / WEBP</span>
      </div>
      <div class="empty-drop">${icon('image')}拖入图片设为参考</div>
    </div>
  `;
}

function renderStageLoading() {
  return `
    <div class="stage-empty" id="stageEmpty">
      <div class="empty-orb">${icon('sparkles')}</div>
      <h2>Agent 正在创作</h2>
      <p>${esc(state.running ? state.running.prompt : '正在生成画面…')}</p>
      <div class="empty-specs">
        <span>${esc(state.running ? state.running.phase : 'PLANNING')}</span>
        <span>U1.5</span>
      </div>
    </div>
  `;
}

function renderStageOverlay() {
  return `
    <div class="stage-loading">
      <div class="loading-ring"></div>
      <div class="loading-copy">
        <strong>${esc(state.running.phase)}</strong>
        <span>${esc(state.running.sub || 'SenseNova U1.5 · Agent 执行中')}</span>
      </div>
      <div class="loading-shimmer"></div>
    </div>
  `;
}

function fitCanvas() {
  const shell = $('#canvasShell');
  const host = $('#stageHost');
  const asset = currentAsset();
  if (!shell || !host || !asset) return;
  const compact = window.innerWidth <= 860;
  const pad = compact ? 14 : 24;
  const maxWidth = Math.max(180, host.clientWidth - pad * 2);
  const maxHeight = Math.max(180, host.clientHeight - pad * 2);
  const width = asset.width || 1024;
  const height = asset.height || 1024;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  shell.style.width = `${Math.max(160, Math.round(width * scale))}px`;
  shell.style.height = `${Math.max(160, Math.round(height * scale))}px`;
}

function renderFilmstrip() {
  const session = currentSession();
  const strip = $('#filmstrip');
  const count = $('#versionCount');
  if (!session || !strip) return;
  if (count) count.textContent = String(session.assets.length);
  if (!session.assets.length) {
    strip.innerHTML = '<div class="film-empty">生成的画面会在这里形成版本序列</div>';
    return;
  }
  strip.innerHTML = session.assets.map((asset, index) => {
    const modelClass = asset.demo ? 'demo' : (asset.model === 'sensenova-u1.5-fast' ? 'fast' : 'lite');
    return `
      <button class="film-item ${asset.id === session.currentId ? 'active' : ''}" data-action="select-asset" data-id="${esc(asset.id)}" title="${esc(asset.prompt)}">
        <img src="${esc(asset.url)}" alt="版本 ${index + 1}" loading="lazy" />
        <span class="film-num">V${index + 1}</span>
        <span class="film-kind ${modelClass}"></span>
      </button>
    `;
  }).join('');
  requestAnimationFrame(() => {
    const active = $('.film-item.active', strip);
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

function renderInspector() {
  const session = currentSession();
  const body = $('#inspectorBody');
  if (!session || !body) return;
  const asset = currentAsset();
  const maxRefs = state.mode === 'edit' && asset ? 4 : 5;
  const refs = state.refs;
  const counters = session.counters || { calls: 0, input: 0, output: 0, demo: 0 };
  const currentModelLabel = state.settings.model === 'auto' ? 'Auto 智能路由' : MODEL_INFO[state.settings.model].short;

  body.innerHTML = `
    <div class="ins-group">
      <div class="ins-label"><strong>模型</strong><span>${esc(currentModelLabel)}</span></div>
      <div class="model-grid">
        ${renderModelCard('auto', 'sparkles', '智能路由', '按任务复杂度分配 Lite / Fast', true)}
        ${renderModelCard('lite', 'diamond', 'U1.5 Lite', '复杂指令 · 排版文字 · 最高质量', false)}
        ${renderModelCard('fast', 'bolt', 'U1.5 Fast', '快速迭代 · 局部修改 · 高效响应', false)}
      </div>
    </div>

    <div class="ins-group">
      <div class="ins-label"><strong>画幅</strong><span>${state.settings.ratio === 'auto' ? '跟随内容' : SIZE_MAP[state.settings.ratio]}</span></div>
      <div class="ratio-grid">
        ${RATIOS.map((ratio) => {
          const [w, h, dashed] = ratio.glyph;
          const style = `width:${w}px;height:${h}px;${dashed ? 'border-style:dashed;' : ''}`;
          return `<button class="ratio-btn ${state.settings.ratio === ratio.value ? 'active' : ''}" data-action="set-setting" data-setting="ratio" data-value="${ratio.value}">
            <i class="ratio-glyph" style="${style}"></i><span>${ratio.label}</span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div class="ins-group">
      <div class="ins-label"><strong>输出格式</strong><span>${state.settings.format.toUpperCase()}</span></div>
      <div class="format-switch">
        ${['png', 'jpeg', 'webp'].map((format) => `<button class="format-btn ${state.settings.format === format ? 'active' : ''}" data-action="set-setting" data-setting="format" data-value="${format}">${format.toUpperCase()}</button>`).join('')}
      </div>
    </div>

    <div class="ins-group">
      <div class="ins-label"><strong>Agent 行为</strong><span>${state.settings.refine ? '2 次调用' : '1 次调用'}</span></div>
      ${renderToggle('refine', '智能精修', '完成后追加一次细节增强', state.settings.refine)}
      ${renderToggle('enhance', '提示词增强', '允许模型自动扩写与优化提示', state.settings.enhance)}
      ${renderToggle('noWatermark', '去除水印', 'watermark=false · 公测免费', state.settings.noWatermark)}
    </div>

    <div class="ins-group">
      <div class="ins-label"><strong>当前上下文</strong><span>${state.mode === 'edit' ? 'EDIT' : 'NEW'}</span></div>
      ${asset ? `
        <div class="context-card">
          <img src="${esc(asset.url)}" alt="" />
          <div class="context-copy">
            <strong>编辑主图 · V${session.assets.findIndex((item) => item.id === asset.id) + 1}</strong>
            <span>${esc(asset.demo ? '演示画面' : (asset.model === 'sensenova-u1.5-fast' ? 'U1.5 Fast' : 'U1.5 Lite'))}</span>
          </div>
        </div>
      ` : '<div class="context-empty">还没有画布内容，将从文本开始生成</div>'}
    </div>

    <div class="ins-group">
      <div class="ins-label"><strong>参考图</strong><span>${refs.length} / ${maxRefs}</span></div>
      <div class="ref-grid">
        ${refs.length ? refs.map((ref) => `
          <div class="ref-cell">
            <img src="${esc(ref.dataUrl)}" alt="${esc(ref.name)}" />
            <button data-action="remove-ref" data-id="${esc(ref.id)}" aria-label="移除参考图">${icon('x')}</button>
          </div>
        `).join('') : '<div class="ref-empty">拖动图片到画布，或点击下方添加</div>'}
        ${refs.length < maxRefs ? `<button class="ref-add" data-action="add-ref" aria-label="添加参考图">${icon('plus')}</button>` : ''}
      </div>
      <div class="ref-note">${state.mode === 'edit' && asset ? '当前画布已是第 1 张主图，最多再加 4 张参考图。' : '最多 5 张参考图；第一张将作为主编辑对象。'}</div>
    </div>

    <div class="ins-group">
      <div class="ins-label"><strong>本次会话</strong><span>LOCAL</span></div>
      <div class="usage-card">
        <div class="usage-row"><span>Agent 调用</span><span>${counters.calls} 次</span></div>
        <div class="usage-row"><span>生成图片</span><span>${session.assets.length} 张</span></div>
        <div class="usage-row"><span>输入 Tokens</span><span>${formatTokens(counters.input)}</span></div>
        <div class="usage-row"><span>输出 Tokens</span><span>${formatTokens(counters.output)}</span></div>
        <div class="usage-foot">图片归档在本地 .data/media；API 临时链接不会直接暴露在画布中。</div>
      </div>
    </div>
  `;
}

function renderModelCard(value, iconName, title, desc, recommended) {
  const active = state.settings.model === value;
  return `
    <button class="model-card ${active ? 'active' : ''}" data-action="set-setting" data-setting="model" data-value="${value}">
      <span class="model-icon">${icon(iconName)}</span>
      <span class="model-copy">
        <strong>${esc(title)}${recommended ? '<span class="rec-badge">AUTO</span>' : ''}</strong>
        <small>${esc(desc)}</small>
      </span>
      <span class="model-check">${icon('check')}</span>
    </button>
  `;
}

function renderToggle(key, title, desc, active) {
  return `
    <button class="toggle-row" data-action="toggle-setting" data-setting="${key}" aria-pressed="${active}">
      <span class="toggle-copy"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>
      <span class="switch"></span>
    </button>
  `;
}

function renderComposerState() {
  const session = currentSession();
  const asset = currentAsset();
  const tray = $('#refTray');
  const modeRow = $('#modeRow');
  const hint = $('#composerHint');
  const sendBtn = $('#sendBtn');
  const runNote = $('#runNote');
  const prompt = $('#promptInput');
  if (!session || !tray || !modeRow || !hint || !sendBtn || !runNote || !prompt) return;

  const maxRefs = state.mode === 'edit' && asset ? 4 : 5;
  if (state.refs.length) {
    tray.classList.add('has-refs');
    tray.innerHTML = state.refs.map((ref, index) => `
      <div class="ref-chip">
        <img src="${esc(ref.dataUrl)}" alt="${esc(ref.name)}" />
        <span class="ref-index">R${index + 1}</span>
        <button class="ref-remove" data-action="remove-ref" data-id="${esc(ref.id)}" aria-label="移除">${icon('x')}</button>
      </div>
    `).join('') + (state.refs.length < maxRefs ? `<button class="ref-chip add-ref" data-action="add-ref" aria-label="添加参考图">${icon('plus')}</button>` : '');
  } else {
    tray.classList.remove('has-refs');
    tray.innerHTML = '';
  }

  modeRow.innerHTML = `
    <div class="mode-switch">
      <button class="mode-btn ${state.mode === 'new' ? 'active' : ''}" data-action="set-mode" data-mode="new" ${state.running ? 'disabled' : ''}>${icon('plus')}新建作品</button>
      <button class="mode-btn ${state.mode === 'edit' ? 'active' : ''}" data-action="set-mode" data-mode="edit" ${!asset || state.running ? 'disabled' : ''}>${icon('edit')}编辑当前</button>
    </div>
    ${asset && state.mode === 'edit' ? `
      <div class="mode-context">
        <img src="${esc(asset.url)}" alt="" />
        <span>主图 V${session.assets.findIndex((item) => item.id === asset.id) + 1}${asset.demo ? ' · DEMO' : ''}</span>
      </div>
    ` : state.refs.length ? `
      <div class="mode-context"><span>参考创作 · ${state.refs.length} 张图</span></div>
    ` : ''}
  `;

  const modelLabel = state.settings.model === 'auto' ? 'Auto' : MODEL_INFO[state.settings.model].short;
  const sizeLabel = state.settings.ratio === 'auto'
    ? (state.mode === 'edit' && asset ? '跟随主图' : '自动尺寸')
    : SIZE_MAP[state.settings.ratio];
  hint.textContent = usingDemo() ? `演示模式 · ${sizeLabel}` : `${modelLabel} · ${sizeLabel}`;

  if (state.running) {
    sendBtn.classList.add('stopping');
    sendBtn.innerHTML = icon('stop');
    sendBtn.setAttribute('aria-label', '停止生成');
  } else {
    sendBtn.classList.remove('stopping');
    sendBtn.innerHTML = icon('arrow-up');
    sendBtn.setAttribute('aria-label', '发送');
  }

  prompt.placeholder = state.mode === 'edit' && asset
    ? '描述要修改的内容，例如：把背景换成雪山…'
    : '描述你想创作的画面…';

  runNote.classList.toggle('busy', Boolean(state.running));
  runNote.classList.toggle('demo', usingDemo() && !state.running);
  if (state.running) {
    runNote.innerHTML = `${icon('refresh')}<span>${esc(state.running.phase)} · ${esc(state.running.sub || 'U1.5 Agent')}</span>`;
  } else if (usingDemo()) {
    runNote.innerHTML = `${icon('info')}<span>演示模式 · 配置 API Key 后可调用真实模型</span>`;
  } else {
    runNote.innerHTML = `${icon('sparkles')}<span>Agent 会自动规划、选择模型并执行</span>`;
  }

  autoGrow();
}

function renderHistory() {
  const list = $('#sessionList');
  if (!list) return;
  if (!state.sessions.length) {
    list.innerHTML = '<div class="session-empty">还没有创作记录</div>';
    return;
  }
  const sorted = [...state.sessions].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  list.innerHTML = sorted.map((session) => {
    const last = session.assets && session.assets.length ? session.assets[session.assets.length - 1] : null;
    return `
      <div class="session-item ${session.id === state.activeId ? 'active' : ''}" data-action="load-session" data-id="${esc(session.id)}" role="button" tabindex="0">
        <span class="session-thumb">${last ? `<img src="${esc(last.url)}" alt="" loading="lazy" />` : icon('wand')}</span>
        <span class="session-copy">
          <strong>${esc(session.title || '未命名创作')}</strong>
          <span>${formatDate(session.updatedAt || session.createdAt)} · ${session.assets ? session.assets.length : 0} 张图</span>
        </span>
        <button class="session-delete" data-action="delete-session" data-id="${esc(session.id)}" aria-label="删除会话">${icon('trash')}</button>
      </div>
    `;
  }).join('');
}

function autoGrow() {
  const input = $('#promptInput');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(160, Math.max(52, input.scrollHeight))}px`;
}

function deriveTitle(prompt) {
  const clean = String(prompt).replace(/\s+/g, ' ').replace(/[，。！？、；：""''（）【】]/g, ' ').trim();
  return clean.length > 18 ? `${clean.slice(0, 18)}…` : (clean || '未命名创作');
}

function resolveSize() {
  if (state.settings.ratio === 'auto') return 'auto';
  return SIZE_MAP[state.settings.ratio] || 'auto';
}
