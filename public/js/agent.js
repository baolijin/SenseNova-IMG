function routeModel(prompt, kind, refCount) {
  if (state.settings.model === 'lite' || state.settings.model === 'fast') {
    return {
      key: state.settings.model,
      reason: `手动指定 ${MODEL_INFO[state.settings.model].short}`
    };
  }
  const complexSignals = /海报|排版|文字|字体|信息图|品牌|界面|UI|分镜|四格|复杂|精确|细节|材质|多主体|参考图|保持|构图|光影|一致性/i;
  const isComplex = prompt.length > 68 || refCount > 1 || complexSignals.test(prompt) || kind === 'reference';
  return isComplex
    ? { key: 'lite', reason: 'Auto → Lite · 复杂指令与多约束优先' }
    : { key: 'fast', reason: 'Auto → Fast · 轻量任务优先速度' };
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

async function assetToDataURL(asset) {
  if (!asset) throw new Error('缺少编辑主图');
  if (asset.url.startsWith('data:')) return asset.url;
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error('无法读取当前画布图片');
  return blobToDataURL(await response.blob());
}

async function apiCall(endpoint, payload, signal) {
  const headers = { 'content-type': 'application/json' };
  if (state.key) headers['x-sensenova-key'] = state.key;
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || !data || !data.ok) {
    const message = data && data.error && data.error.message ? data.error.message : `请求失败（HTTP ${response.status}）`;
    const error = new Error(message);
    error.code = data && data.error ? data.error.code : 'HTTP_ERROR';
    error.detail = data && data.error ? data.error.detail : null;
    error.status = response.status;
    throw error;
  }
  return data;
}

function createAssetFromResponse(data, options) {
  const dims = parseSize(data.size) || {};
  return {
    id: uid('a'),
    url: data.image.url,
    prompt: options.prompt,
    kind: options.kind,
    model: options.model,
    size: data.size || 'auto',
    width: dims.width || options.width || null,
    height: dims.height || options.height || null,
    format: data.output_format || options.format || 'png',
    elapsed: data.elapsed_ms || options.elapsed || null,
    usage: data.usage || null,
    demo: false,
    parentId: options.parentId || null,
    createdAt: Date.now()
  };
}

function trackUsage(session, usage, demo) {
  session.counters.calls += 1;
  if (demo) {
    session.counters.demo += 1;
    return;
  }
  if (usage) {
    session.counters.input += usage.input_tokens || 0;
    session.counters.output += usage.output_tokens || 0;
  }
}

function setStep(message, index, patch) {
  if (!message.steps[index]) return;
  Object.assign(message.steps[index], patch);
}

async function runAgent(text, options = {}) {
  if (state.running) return;
  const clean = String(text || '').trim();
  if (!clean) return;

  const session = currentSession();
  if (!session) return;
  const current = currentAsset();
  let mode = options.mode || state.mode;
  if (mode === 'edit' && !current) mode = 'new';
  if (options.forceKind === 'generate') mode = 'new';

  const demo = usingDemo();
  const plannedKind = mode === 'edit' ? 'edit' : state.refs.length ? 'reference' : 'generate';
  const routed = routeModel(clean, plannedKind, state.refs.length + (mode === 'edit' ? 1 : 0));
  const size = resolveSize();
  const startedAt = Date.now();
  const serial = ++state.runSerial;
  const assertActive = () => {
    if (state.cancelRequested || serial !== state.runSerial) {
      const error = new Error('已取消');
      error.name = 'AbortError';
      throw error;
    }
  };
  let initialAsset = null;
  let refineFailed = false;

  if (!options.silentUser) {
    session.messages.push({
      id: uid('m'),
      role: 'user',
      text: clean,
      at: Date.now()
    });
    if (session.title === '未命名创作') session.title = deriveTitle(clean);
  }

  const steps = [
    {
      label: '解析创作意图',
      tag: 'INTENT',
      status: 'running',
      detail: mode === 'edit' ? '图像编辑 · 保留未指定的画面元素' : state.refs.length ? '参考图创作 · 提取视觉条件' : '文生图 · 从描述构建画面'
    },
    {
      label: '选择创作模型',
      tag: 'ROUTE',
      status: 'pending',
      detail: state.settings.model === 'auto' ? '正在评估复杂度…' : `使用 ${MODEL_INFO[state.settings.model].short}`
    },
    {
      label: mode === 'edit' ? '图像编辑' : state.refs.length ? '参考图创作' : '图像生成',
      tag: mode === 'edit' ? 'EDIT' : 'RENDER',
      status: 'pending',
      detail: demo ? '演示合成 · 不调用远程接口' : '准备请求 SenseNova…'
    }
  ];

  if (state.settings.refine) {
    steps.push({
      label: '智能精修',
      tag: 'POLISH',
      status: 'pending',
      detail: '保持主体与构图 · 增强光影与细节'
    });
  }

  const agentMessage = {
    id: uid('m'),
    role: 'agent',
    at: Date.now(),
    steps,
    text: '',
    assetId: null
  };
  session.messages.push(agentMessage);
  session.updatedAt = Date.now();

  state.running = {
    phase: '解析创作意图',
    sub: demo ? '演示模式' : 'U1.5 Agent',
    prompt: clean,
    startedAt
  };
  state.cancelRequested = false;
  state.abort = null;
  state.compare = false;
  renderAll(true);
  if (demo) notifyDemo();

  try {
    await pause(180);
    assertActive();
    setStep(agentMessage, 0, { status: 'done' });
    state.running = { phase: '选择创作模型', sub: 'Agent 正在路由', prompt: clean, startedAt };
    setStep(agentMessage, 1, {
      status: 'running',
      detail: state.settings.model === 'auto' ? '评估指令复杂度与参考图…' : `手动指定 ${MODEL_INFO[state.settings.model].short}`
    });
    renderAll(true);

    await pause(220);
    assertActive();
    setStep(agentMessage, 1, { status: 'done', detail: routed.reason });
    setStep(agentMessage, 2, {
      status: 'running',
      detail: `${MODEL_INFO[routed.key].short} · ${size === 'auto' ? '自动尺寸' : size}`
    });
    state.running = {
      phase: mode === 'edit' ? '编辑画面' : state.refs.length ? '参考创作' : '生成画面',
      sub: demo ? '演示合成' : MODEL_INFO[routed.key].short,
      prompt: clean,
      startedAt
    };
    renderAll(true);

    let imagePayload = [];
    if (mode === 'edit' && current) {
      imagePayload.push(await assetToDataURL(current));
    }
    for (const ref of state.refs.slice(0, mode === 'edit' ? 4 : 5)) {
      imagePayload.push(ref.dataUrl);
    }

    assertActive();
    const basePayload = {
      model: MODEL_INFO[routed.key].id,
      prompt: clean,
      n: 1,
      size,
      output_format: state.settings.format,
      watermark: !state.settings.noWatermark,
      prompt_extend: state.settings.enhance
    };

    const stepMeta = {
      endpoint: mode === 'edit' || state.refs.length ? '/v1/images/edits' : '/v1/images/generations',
      model: MODEL_INFO[routed.key].id,
      size,
      images: imagePayload.length,
      watermark: !state.settings.noWatermark,
      prompt_extend: state.settings.enhance
    };
    setStep(agentMessage, 2, { meta: stepMeta });
    renderAll(true);

    let resultData;
    if (demo) {
      await pause(1050 + Math.floor(Math.random() * 550));
      assertActive();
      const demoResult = await createDemoImage(clean, imagePayload[0] || null, {
        refine: false,
        size,
        reference: imagePayload.length > 0
      });
      resultData = {
        image: { url: demoResult.dataUrl },
        size: `${demoResult.width}x${demoResult.height}`,
        output_format: 'jpeg',
        usage: null,
        elapsed_ms: Date.now() - startedAt
      };
    } else {
      const controller = new AbortController();
      state.abort = controller;
      assertActive();
      const requestPayload = { ...basePayload };
      if (imagePayload.length) requestPayload.images = imagePayload.map((image) => ({ image_url: image }));
      resultData = await apiCall(mode === 'edit' || imagePayload.length ? 'edit' : 'generate', requestPayload, controller.signal);
    }

    assertActive();
    const responseKind = mode === 'edit' ? 'edit' : imagePayload.length ? 'reference' : 'generate';
    initialAsset = createAssetFromResponse(resultData, {
      prompt: clean,
      kind: responseKind,
      model: MODEL_INFO[routed.key].id,
      parentId: mode === 'edit' && current ? current.id : null,
      format: state.settings.format,
      elapsed: resultData.elapsed_ms
    });
    if (demo) initialAsset.demo = true;

    session.assets.push(initialAsset);
    session.currentId = initialAsset.id;
    session.updatedAt = Date.now();
    trackUsage(session, resultData.usage, demo);
    agentMessage.assetId = initialAsset.id;

    setStep(agentMessage, 2, {
      status: 'done',
      detail: `${MODEL_INFO[routed.key].short} · ${initialAsset.width ? `${initialAsset.width}×${initialAsset.height}` : size}${initialAsset.elapsed ? ` · ${formatElapsed(initialAsset.elapsed)}` : ''}`
    });

    if (state.settings.refine) {
      await pause(260);
      assertActive();
      const refineKey = state.settings.model === 'lite' ? 'lite' : 'fast';
      setStep(agentMessage, 3, {
        status: 'running',
        detail: `${MODEL_INFO[refineKey].short} · 保持主体与构图，精修光影细节`
      });
      agentMessage.text = '初稿已经就位，Agent 正在进行细节精修…';
      state.running = {
        phase: '智能精修',
        sub: MODEL_INFO[refineKey].short,
        prompt: clean,
        startedAt
      };
      renderAll(true);

      try {
        let refinedData;
        if (demo) {
          await pause(820 + Math.floor(Math.random() * 350));
          assertActive();
          const baseData = await assetToDataURL(initialAsset);
          const demoRefined = await createDemoImage(clean, baseData, {
            refine: true,
            size: initialAsset.width && initialAsset.height ? `${initialAsset.width}x${initialAsset.height}` : size,
            reference: true
          });
          refinedData = {
            image: { url: demoRefined.dataUrl },
            size: `${demoRefined.width}x${demoRefined.height}`,
            output_format: 'jpeg',
            usage: null,
            elapsed_ms: Date.now() - startedAt
          };
        } else {
          assertActive();
          const controller = new AbortController();
          state.abort = controller;
          const image = await assetToDataURL(initialAsset);
          assertActive();
          refinedData = await apiCall('edit', {
            model: MODEL_INFO[refineKey].id,
            prompt: refinePromptText(clean),
            images: [{ image_url: image }],
            n: 1,
            size: 'auto',
            output_format: state.settings.format,
            watermark: !state.settings.noWatermark,
            prompt_extend: false
          }, controller.signal);
        }

        assertActive();
        const refinedAsset = createAssetFromResponse(refinedData, {
          prompt: clean,
          kind: 'refine',
          model: MODEL_INFO[refineKey].id,
          parentId: initialAsset.id,
          format: state.settings.format,
          elapsed: refinedData.elapsed_ms,
          width: initialAsset.width,
          height: initialAsset.height
        });
        if (demo) refinedAsset.demo = true;
        session.assets.push(refinedAsset);
        session.currentId = refinedAsset.id;
        session.updatedAt = Date.now();
        trackUsage(session, refinedData.usage, demo);
        agentMessage.assetId = refinedAsset.id;
        setStep(agentMessage, 3, {
          status: 'done',
          detail: `${MODEL_INFO[refineKey].short} · ${refinedAsset.elapsed ? formatElapsed(refinedAsset.elapsed) : '完成'}`
        });
        initialAsset = refinedAsset;
      } catch (refineError) {
        if (refineError.name === 'AbortError' || state.cancelRequested) throw refineError;
        refineFailed = true;
        setStep(agentMessage, 3, {
          status: 'failed',
          detail: `精修未完成，已保留初稿：${refineError.message}`
        });
        toast(`精修未完成：${refineError.message}`, 'error');
      }
    }

    assertActive();

    const usedRefs = state.refs.length;
    const mainName = MODEL_INFO[routed.key].short;
    const refineName = MODEL_INFO[state.settings.model === 'lite' ? 'lite' : 'fast'].short;
    const actionLabel = mode === 'edit' ? '完成编辑' : usedRefs ? '完成参考创作' : '生成初稿';
    let finalText;
    if (state.settings.refine && !refineFailed) {
      finalText = `完成。采用 <em>${mainName}</em> ${actionLabel}，再由 <em>${refineName}</em> 做了一轮细节精修。继续描述修改，我会在当前画布上迭代。`;
    } else if (refineFailed) {
      finalText = `已完成 <em>${mainName}</em> 的${actionLabel}。细节精修没有完成，但初稿已保留，可以继续编辑或在参数中关闭精修后重试。`;
    } else {
      finalText = `完成。采用 <em>${mainName}</em> ${actionLabel}。继续描述修改，我会在当前画布上迭代。`;
    }
    agentMessage.text = finalText;

    state.mode = 'edit';
    capRefsForMode();
    state.compare = false;
    state.comparePos = 50;
    state.running = null;
    state.abort = null;
    session.updatedAt = Date.now();
    saveSessions();
    persistActive();
    renderAll(true);
    toast(`创作完成 · ${formatElapsed(Date.now() - startedAt)}`, 'success');
  } catch (error) {
    if (error.name === 'AbortError' || state.cancelRequested) {
      const runningIndex = steps.findIndex((step) => step.status === 'running');
      if (runningIndex >= 0) {
        setStep(agentMessage, runningIndex, { status: 'cancelled', detail: '用户停止了本次执行' });
      }
      steps.forEach((step, index) => {
        if (index > runningIndex && step.status === 'pending') setStep(agentMessage, index, { status: 'cancelled', detail: '未执行' });
      });
      agentMessage.cancelled = true;
      agentMessage.text = initialAsset ? '已停止后续精修，初稿保留在画布中。' : '';
      state.running = null;
      state.abort = null;
      state.cancelRequested = false;
      session.updatedAt = Date.now();
      saveSessions();
      renderAll(true);
      toast('已停止当前任务');
      return;
    }

    const runningIndex = steps.findIndex((step) => step.status === 'running');
    if (runningIndex >= 0) {
      setStep(agentMessage, runningIndex, { status: 'failed', detail: '接口返回错误' });
    }
    steps.forEach((step, index) => {
      if (index > runningIndex && step.status === 'pending') setStep(agentMessage, index, { status: 'cancelled', detail: '未执行' });
    });
    agentMessage.error = {
      message: error.message || '请求失败',
      detail: error.detail || '',
      status: error.status || null,
      retry: { text: clean, mode }
    };
    agentMessage.text = initialAsset ? '初稿已生成，但后续步骤没有完成。' : '';
    agentMessage.assetId = initialAsset ? initialAsset.id : null;
    state.running = null;
    state.abort = null;
    session.updatedAt = Date.now();
    saveSessions();
    renderAll(true);
    if (error.status === 401 || error.code === 'MISSING_KEY') openKeyModal();
    toast(error.message || '请求失败', 'error');
  } finally {
    if (serial === state.runSerial) {
      state.running = null;
      state.abort = null;
      renderComposerState();
      renderStage();
    }
  }
}

function refinePromptText(original) {
  return `在严格保持主体、构图、文字内容与画面布局不变的前提下，精修这张图的光影层次、材质细节与边缘干净度，去除噪点与瑕疵，提升整体质感。原始创作意图：${original}`;
}

function cancelRun() {
  if (!state.running) return;
  state.cancelRequested = true;
  state.runSerial += 1;
  if (state.abort) {
    try {
      state.abort.abort();
    } catch {
      state.abort = null;
    }
  }
  toast('正在停止…');
}

async function addFiles(files) {
  if (state.running) {
    toast('Agent 正在执行，请稍后再调整参考图', 'error');
    return;
  }
  const list = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
  if (!list.length) return;
  const asset = currentAsset();
  const maxRefs = state.mode === 'edit' && asset ? 4 : 5;
  const remaining = maxRefs - state.refs.length;
  if (remaining <= 0) {
    toast(`参考图已达上限（${maxRefs} 张）`, 'error');
    return;
  }
  let added = 0;
  for (const file of list.slice(0, remaining)) {
    if (file.size > 20 * 1024 * 1024) {
      toast(`${file.name} 超过 20MB，已跳过`, 'error');
      continue;
    }
    try {
      const prepared = await prepareReference(file);
      state.refs.push(prepared);
      added += 1;
    } catch (error) {
      toast(error.message || '无法读取图片', 'error');
    }
  }
  if (added) {
    renderInspector();
    renderComposerState();
    toast(`已添加 ${added} 张参考图`, 'success');
  }
}

async function prepareReference(file) {
  const maxSide = 2048;
  let source;
  let width;
  let height;
  if (window.createImageBitmap) {
    source = await createImageBitmap(file);
    width = source.width;
    height = source.height;
  } else {
    source = await new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取图片'));
      };
      image.src = url;
    });
    width = source.width;
    height = source.height;
  }
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, outWidth, outHeight);
  if (source.close) source.close();
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const dataUrl = canvas.toDataURL(type, 0.9);
  return {
    id: uid('r'),
    dataUrl,
    name: file.name || '参考图',
    width: outWidth,
    height: outHeight
  };
}

function removeRef(id) {
  if (state.running) {
    toast('Agent 正在执行，请稍后再调整参考图', 'error');
    return;
  }
  state.refs = state.refs.filter((ref) => ref.id !== id);
  renderInspector();
  renderComposerState();
}

function selectAsset(id, options = {}) {
  const session = currentSession();
  const asset = findAsset(id);
  if (!session || !asset) return;
  session.currentId = asset.id;
  state.compare = false;
  state.comparePos = 50;
  if (options.focusEdit) {
    state.mode = 'edit';
    capRefsForMode();
    if (window.innerWidth <= 860) setMobileView('chat');
    setTimeout(() => {
      const input = $('#promptInput');
      if (input) input.focus();
    }, 120);
  }
  saveSessions();
  renderAll(Boolean(options.focusEdit));
}

function downloadAsset(id) {
  const asset = id ? findAsset(id) : currentAsset();
  if (!asset) return;
  const extension = asset.demo ? 'jpg' : (asset.format === 'jpeg' ? 'jpg' : asset.format || 'png');
  const anchor = document.createElement('a');
  anchor.href = asset.url;
  anchor.download = `nova-atelier-${new Date().toISOString().slice(0, 10)}-${asset.id.slice(-5)}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  toast('已开始下载', 'success');
}

function remakeAsset() {
  const asset = currentAsset();
  if (!asset || state.running) return;
  let source = asset;
  let guard = 0;
  while (source.parentId && guard < 12) {
    const parent = findAsset(source.parentId);
    if (!parent) break;
    source = parent;
    guard += 1;
  }
  runAgent(source.prompt, { forceKind: 'generate', silentUser: true });
}

function capRefsForMode() {
  if (state.mode === 'edit' && state.refs.length > 4) {
    state.refs = state.refs.slice(0, 4);
    toast('编辑模式下最多使用 4 张额外参考图，已保留前 4 张');
  }
}

function retryMessage(messageId) {
  const session = currentSession();
  if (!session || state.running) return;
  const index = session.messages.findIndex((message) => message.id === messageId);
  if (index < 0) return;
  const message = session.messages[index];
  if (!message.error || !message.error.retry) return;
  const retry = message.error.retry;
  session.messages.splice(index, 1);
  saveSessions();
  renderAll(true);
  runAgent(retry.text, { silentUser: true, mode: retry.mode });
}

async function toggleFullscreen() {
  const shell = $('#canvasShell');
  if (!shell) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await shell.requestFullscreen();
    }
  } catch {
    toast('当前浏览器不支持全屏', 'error');
  }
}
