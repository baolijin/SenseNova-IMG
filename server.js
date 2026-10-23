const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

let sea = null;
try {
  sea = require('node:sea');
} catch {
  sea = null;
}
const IS_SEA = Boolean(sea && typeof sea.isSea === 'function' && sea.isSea());
const ROOT = IS_SEA ? path.dirname(process.execPath) : __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.NOVA_DATA_DIR ? path.resolve(process.env.NOVA_DATA_DIR) : path.join(ROOT, '.data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const UPSTREAM = (process.env.SENSENOVA_BASE_URL || 'https://token.sensenova.cn/v1').replace(/\/+$/, '');
const ENV_KEY = process.env.SENSENOVA_API_KEY || '';
const MAX_BODY = 64 * 1024 * 1024;
const UPSTREAM_TIMEOUT = 240000;

const MODELS = new Set(['sensenova-u1.5-lite', 'sensenova-u1.5-fast']);
const FORMATS = new Set(['png', 'jpeg', 'jpg', 'webp']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function fail(res, status, code, message, detail) {
  sendJson(res, status, { ok: false, error: { code, message, detail: detail || null } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('请求体超过 64MB 限制'), { status: 413, code: 'BODY_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isDataImage(value) {
  return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value);
}

function normalizeSize(value) {
  if (value === undefined || value === null || value === '') return 'auto';
  if (value === 'auto') return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{3,4})x(\d{3,4})$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 512 || height < 512 || width > 4096 || height > 4096) return null;
  if (width % 32 !== 0 || height % 32 !== 0) return null;
  if (Math.max(width / height, height / width) > 3) return null;
  return `${width}x${height}`;
}

function normalizeRequest(body, endpoint) {
  if (!body || typeof body !== 'object') throw Object.assign(new Error('请求体不是有效 JSON 对象'), { status: 400, code: 'BAD_REQUEST' });
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) throw Object.assign(new Error('prompt 不能为空'), { status: 400, code: 'BAD_PROMPT' });
  if (prompt.length > 8000) throw Object.assign(new Error('prompt 过长，最多 8000 字符'), { status: 400, code: 'BAD_PROMPT' });

  const model = typeof body.model === 'string' ? body.model : 'sensenova-u1.5-lite';
  if (!MODELS.has(model)) throw Object.assign(new Error('不支持的模型 ID'), { status: 400, code: 'BAD_MODEL' });

  const size = normalizeSize(body.size);
  if (!size) throw Object.assign(new Error('尺寸需为 auto 或 512–4096 之间、32 的倍数，且长宽比不超过 3:1'), { status: 400, code: 'BAD_SIZE' });

  const outputFormat = typeof body.output_format === 'string' ? body.output_format.toLowerCase() : 'png';
  if (!FORMATS.has(outputFormat)) throw Object.assign(new Error('输出格式仅支持 png / jpeg / webp'), { status: 400, code: 'BAD_FORMAT' });

  const payload = {
    model,
    prompt,
    n: 1,
    size,
    output_format: outputFormat,
    response_format: 'url',
    watermark: body.watermark !== false,
    prompt_extend: body.prompt_extend !== false
  };

  if (endpoint === 'edits') {
    if (!Array.isArray(body.images) || body.images.length < 1) {
      throw Object.assign(new Error('图像编辑至少需要 1 张参考图'), { status: 400, code: 'BAD_IMAGES' });
    }
    if (body.images.length > 5) {
      throw Object.assign(new Error('最多支持 5 张参考图'), { status: 400, code: 'BAD_IMAGES' });
    }
    payload.images = body.images.map((image) => {
      const raw = typeof image === 'string' ? image : image && image.image_url;
      if (typeof raw !== 'string' || (!isHttpUrl(raw) && !isDataImage(raw))) {
        throw Object.assign(new Error('图片需为公网 http(s) 链接或完整的 data:image/...;base64, Data URL'), { status: 400, code: 'BAD_IMAGE_URL' });
      }
      return { image_url: raw };
    });
  }

  return payload;
}

async function upstreamRequest(endpoint, payload, apiKey, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  const abort = () => controller.abort();
  if (signal) signal.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(`${UPSTREAM}/images/${endpoint}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = null;
    }

    if (!response.ok) {
      const upstreamMessage = data && data.error && (data.error.message || data.error.code);
      const message = upstreamMessage || text.slice(0, 320) || `SenseNova 返回 HTTP ${response.status}`;
      throw Object.assign(new Error(message), {
        status: response.status,
        code: 'UPSTREAM_ERROR',
        detail: text.slice(0, 2000)
      });
    }

    if (!data || !Array.isArray(data.data) || !data.data[0]) {
      throw Object.assign(new Error('SenseNova 返回中缺少图片数据'), {
        status: 502,
        code: 'EMPTY_RESPONSE',
        detail: text.slice(0, 2000)
      });
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('SenseNova 请求超时或已取消'), { status: 504, code: 'TIMEOUT' });
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

function extensionFor(format, contentType) {
  if (format === 'jpeg' || format === 'jpg') return 'jpg';
  if (format === 'webp') return 'webp';
  if (format === 'png') return 'png';
  if (contentType && contentType.includes('webp')) return 'webp';
  if (contentType && contentType.includes('jpeg')) return 'jpg';
  return 'png';
}

async function persistImage(item, format, signal) {
  let buffer;
  let contentType = '';
  let sourceUrl = item.url || '';

  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item.url) {
    if (!isHttpUrl(item.url)) throw new Error('上游返回了无效的图片地址');
    const response = await fetch(item.url, { signal });
    if (!response.ok) throw new Error(`下载生成图片失败（HTTP ${response.status}）`);
    contentType = response.headers.get('content-type') || '';
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error('上游未返回 b64_json 或 url');
  }

  if (!buffer || buffer.length < 32) throw new Error('生成图片数据为空');
  const ext = extensionFor(format, contentType);
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
  await fsp.writeFile(path.join(MEDIA_DIR, name), buffer);
  return { path: `/media/${name}`, bytes: buffer.length, sourceUrl };
}

function serveEmbedded(res, relative, cacheControl) {
  const key = relative.replace(/^\/+/, '');
  let buffer;
  try {
    buffer = Buffer.from(sea.getAsset(key));
  } catch {
    return fail(res, 404, 'NOT_FOUND', '文件不存在');
  }
  const ext = path.extname(key).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': buffer.length,
    'cache-control': cacheControl,
    'x-content-type-options': 'nosniff'
  });
  if (res.req.method === 'HEAD') return res.end();
  res.end(buffer);
}

async function serveFile(res, filePath, cacheControl) {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff'
    });
    if (res.req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  } catch {
    fail(res, 404, 'NOT_FOUND', '文件不存在');
  }
}

function apiKeyFor(req) {
  const header = req.headers['x-sensenova-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return ENV_KEY;
}

async function handleApi(req, res, pathname, url) {
  if (req.method === 'GET' && pathname === '/api/config') {
    return sendJson(res, 200, {
      ok: true,
      hasServerKey: Boolean(ENV_KEY),
      upstream: UPSTREAM,
      models: [
        { id: 'sensenova-u1.5-lite', name: 'SenseNova U1.5 Lite' },
        { id: 'sensenova-u1.5-fast', name: 'SenseNova U1.5 Fast' }
      ]
    });
  }

  if (req.method !== 'POST' || (pathname !== '/api/generate' && pathname !== '/api/edit')) {
    return fail(res, 404, 'NOT_FOUND', '接口不存在');
  }

  const apiKey = apiKeyFor(req);
  if (!apiKey) {
    return fail(res, 401, 'MISSING_KEY', '未配置 SenseNova API Key');
  }

  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    if (error.status) return fail(res, error.status, error.code || 'BAD_REQUEST', error.message);
    return fail(res, 400, 'BAD_JSON', '无法解析请求 JSON');
  }

  const endpoint = pathname === '/api/generate' ? 'generations' : 'edits';
  let payload;
  try {
    payload = normalizeRequest(body, endpoint);
  } catch (error) {
    return fail(res, error.status || 400, error.code || 'BAD_REQUEST', error.message);
  }

  const abortController = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on('close', onClose);

  const startedAt = Date.now();
  try {
    const data = await upstreamRequest(endpoint, payload, apiKey, abortController.signal);
    const item = data.data[0];
    let image;
    try {
      image = await persistImage(item, payload.output_format, abortController.signal);
    } catch (persistError) {
      if (!item.url || !isHttpUrl(item.url)) throw persistError;
      image = { path: item.url, bytes: 0, sourceUrl: item.url, cached: false };
    }
    const result = {
      ok: true,
      image: {
        url: image.path,
        bytes: image.bytes,
        sourceUrl: image.sourceUrl || null,
        cached: image.cached !== false
      },
      created: data.created || Math.floor(Date.now() / 1000),
      size: data.size || payload.size,
      output_format: data.output_format || payload.output_format,
      usage: data.usage || null,
      elapsed_ms: Date.now() - startedAt,
      request: {
        endpoint,
        model: payload.model,
        prompt: payload.prompt,
        size: payload.size,
        watermark: payload.watermark,
        prompt_extend: payload.prompt_extend,
        images_count: payload.images ? payload.images.length : 0
      }
    };
    sendJson(res, 200, result);
  } catch (error) {
    if (res.writableEnded) return;
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    fail(res, status, error.code || 'UPSTREAM_FAILED', error.message || 'SenseNova 请求失败', error.detail);
  } finally {
    res.off('close', onClose);
  }
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return fail(res, 400, 'BAD_URL', '无效请求地址');
  }

  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url.pathname, url);
  }

  if (url.pathname.startsWith('/media/')) {
    const name = decodeURIComponent(url.pathname.slice('/media/'.length));
    if (!/^[a-z0-9-]+\.(png|jpe?g|webp|gif)$/i.test(name)) {
      return fail(res, 404, 'NOT_FOUND', '图片不存在');
    }
    return serveFile(res, path.join(MEDIA_DIR, name), 'public, max-age=31536000, immutable');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return fail(res, 405, 'METHOD_NOT_ALLOWED', '不支持的请求方法');
  }

  let relative;
  try {
    relative = decodeURIComponent(url.pathname);
  } catch {
    return fail(res, 400, 'BAD_URL', '无效路径');
  }
  if (relative === '/') relative = '/index.html';
  const cache = relative === '/index.html' || /\.(?:js|css)$/i.test(relative) ? 'no-cache' : 'public, max-age=3600';
  if (IS_SEA) return serveEmbedded(res, relative, cache);
  const filePath = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    return fail(res, 403, 'FORBIDDEN', '禁止访问');
  }
  return serveFile(res, filePath, cache);
});

function openBrowser(url) {
  if (process.env.NOVA_NO_OPEN === '1') return;
  const options = { detached: true, stdio: 'ignore' };
  try {
    if (process.platform === 'win32') {
      spawn('explorer.exe', [url], options).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], options).unref();
    } else {
      spawn('xdg-open', [url], options).unref();
    }
  } catch {
    // Browser launch is best effort.
  }
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n端口 ${PORT} 已被占用。请关闭已运行的 Nova Atelier，或设置 PORT 后重试。`);
  } else {
    console.error('\n本地服务启动失败:', error.message);
  }
  if (IS_SEA && process.stdin.isTTY) {
    console.error('按 Enter 退出…');
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(1));
    return;
  }
  process.exit(1);
});

fsp.mkdir(MEDIA_DIR, { recursive: true })
  .then(() => {
    server.listen(PORT, HOST, () => {
      const keyState = ENV_KEY ? '服务端 API Key 已加载' : '等待浏览器端 API Key';
      const browserHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
      const url = `http://${browserHost}:${PORT}`;
      console.log(`\n  Nova Atelier  →  ${url}`);
      console.log(`  SenseNova U1.5 · ${keyState}`);
      if (IS_SEA) console.log('  关闭此窗口即可停止服务\n');
      else console.log('');
      if (IS_SEA) setTimeout(() => openBrowser(url), 500);
    });
  })
  .catch((error) => {
    console.error('无法初始化媒体目录:', error);
    console.error(`数据目录: ${DATA_DIR}`);
    process.exit(1);
  });

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
