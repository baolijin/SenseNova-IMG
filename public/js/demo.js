function parseSize(size) {
  const match = String(size || '').match(/^(\d+)x(\d+)$/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

async function createDemoImage(prompt, baseDataUrl, options = {}) {
  const ratio = options.size === 'auto' || !options.size ? state.settings.ratio : null;
  let width = 1024;
  let height = 1024;
  const parsed = parseSize(options.size);
  if (parsed) {
    width = Math.min(parsed.width, 1280);
    height = Math.min(parsed.height, 1280);
  } else if (ratio === '16:9') {
    width = 1280;
    height = 720;
  } else if (ratio === '9:16') {
    width = 720;
    height = 1280;
  } else if (ratio === '2:3') {
    width = 832;
    height = 1248;
  } else if (ratio === '3:2') {
    width = 1248;
    height = 832;
  }

  if (baseDataUrl && (!options.size || options.size === 'auto')) {
    try {
      const metadata = await loadImage(baseDataUrl);
      if (metadata) {
        width = Math.min(metadata.width, 1280);
        height = Math.min(metadata.height, 1280);
      }
    } catch {
      width = 1024;
      height = 1024;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const seed = hashString(prompt);
  const palette = pickPalette(prompt, seed);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, width, height);

  if (baseDataUrl) {
    try {
      const image = await loadImage(baseDataUrl);
      const scale = Math.max(width / image.width, height / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      ctx.save();
      ctx.filter = options.refine
        ? 'saturate(1.08) contrast(1.05) brightness(1.02)'
        : 'saturate(0.9) contrast(0.96) brightness(0.94)';
      ctx.drawImage(image, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
      ctx.restore();
      const tint = ctx.createLinearGradient(0, 0, width, height);
      tint.addColorStop(0, hexAlpha(palette[3], options.refine ? 0.1 : 0.24));
      tint.addColorStop(0.55, hexAlpha(palette[1], 0.06));
      tint.addColorStop(1, hexAlpha(palette[2], options.refine ? 0.08 : 0.2));
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, width, height);
    } catch {
      drawMesh(ctx, width, height, palette, seed, prompt);
    }
  } else {
    drawMesh(ctx, width, height, palette, seed, prompt);
  }

  drawGrain(ctx, width, height, seed, 3200);
  drawFrame(ctx, width, height, palette);
  drawCaption(ctx, width, height, prompt, palette, options.refine);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.86), width, height };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPalette(prompt, seed) {
  const sets = [
    ['#10120f', '#28352a', '#c9ff5c', '#6f8f5a', '#e9edd9'],
    ['#0b0d12', '#1a2240', '#7aa2ff', '#b48cff', '#e8ecf8'],
    ['#14100d', '#3a2418', '#ffb15c', '#d36a4a', '#f5e4cf'],
    ['#0e1011', '#2a3036', '#d9e4e8', '#8a9ba6', '#f5f8f9'],
    ['#120d15', '#34213b', '#ff7ac8', '#8661ff', '#f7e8ff'],
    ['#0f1110', '#3b2c1f', '#e5d3a8', '#aa7c4a', '#faf4e3']
  ];
  const style = prompt.toLowerCase();
  if (/吉卜力|动画|森林|自然|治愈/.test(style)) return sets[0];
  if (/霓虹|赛博|未来|科技|蓝色/.test(style)) return sets[1];
  if (/咖啡|海报|复古|印刷|暖|日落/.test(style)) return sets[2];
  if (/极简|产品|香|金属|灰|商业/.test(style)) return sets[3];
  if (/梦幻|花|紫|浪漫/.test(style)) return sets[4];
  return sets[seed % sets.length];
}

function hexAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawMesh(ctx, width, height, palette, seed, promptText) {
  const random = mulberry32(seed);
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, palette[0]);
  background.addColorStop(0.6, palette[1]);
  background.addColorStop(1, palette[0]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 7; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const radius = (0.18 + random() * 0.42) * Math.max(width, height);
    const color = palette[2 + (i % 3)];
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, hexAlpha(color, 0.22 + random() * 0.16));
    gradient.addColorStop(0.5, hexAlpha(color, 0.07));
    gradient.addColorStop(1, hexAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.save();
  ctx.translate(width * (0.5 + (random() - 0.5) * 0.12), height * 0.47);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, width * (0.18 + i * 0.1), height * (0.3 - i * 0.055), random() * Math.PI, 0, Math.PI * 2);
    ctx.strokeStyle = hexAlpha(palette[4], 0.13 - i * 0.025);
    ctx.lineWidth = Math.max(1, width * 0.0014);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = hexAlpha(palette[4], 0.07);
  ctx.lineWidth = 1;
  const step = Math.round(Math.min(width, height) / 8);
  for (let x = step; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = step; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const word = (String(promptText).match(/[A-Za-z]{3,}/) || ['NOVA'])[0].toUpperCase().slice(0, 8);
  ctx.save();
  ctx.font = `italic ${Math.round(width * 0.16)}px "Iowan Old Style", Georgia, serif`;
  ctx.fillStyle = hexAlpha(palette[4], 0.06);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, width / 2, height * 0.42);
  ctx.restore();
}

function drawGrain(ctx, width, height, seed, count) {
  const random = mulberry32(seed + 99);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const alpha = 0.015 + random() * 0.045;
    ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.restore();
}

function drawFrame(ctx, width, height, palette) {
  ctx.save();
  ctx.strokeStyle = hexAlpha(palette[4], 0.16);
  ctx.lineWidth = Math.max(1, width * 0.0012);
  const inset = Math.round(Math.min(width, height) * 0.045);
  ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  ctx.beginPath();
  ctx.moveTo(inset, inset + 20);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + 20, inset);
  ctx.moveTo(width - inset - 20, height - inset);
  ctx.lineTo(width - inset, height - inset);
  ctx.lineTo(width - inset, height - inset - 20);
  ctx.strokeStyle = hexAlpha(palette[2], 0.55);
  ctx.lineWidth = Math.max(1.5, width * 0.0018);
  ctx.stroke();
  ctx.restore();
}

function drawCaption(ctx, width, height, prompt, palette, refined) {
  const gradient = ctx.createLinearGradient(0, height * 0.58, 0, height);
  gradient.addColorStop(0, 'rgba(6, 7, 9, 0)');
  gradient.addColorStop(0.55, 'rgba(6, 7, 9, 0.56)');
  gradient.addColorStop(1, 'rgba(6, 7, 9, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.56, width, height * 0.44);

  const margin = Math.round(width * 0.075);
  const maxWidth = width - margin * 2;
  const fontSize = Math.max(15, Math.round(width * 0.019));
  ctx.font = `500 ${fontSize}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(242, 245, 248, 0.92)';
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, prompt, maxWidth, 3);
  const lineHeight = fontSize * 1.55;
  let y = height - margin - lines.length * lineHeight - 26;
  lines.forEach((line) => {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  });

  ctx.font = `500 ${Math.max(8, Math.round(width * 0.0095))}px "SF Mono", Menlo, monospace`;
  ctx.fillStyle = hexAlpha(palette[2], 0.86);
  ctx.fillText(`${refined ? 'REFINED' : 'GENERATED'} WITH SENSENOVA U1.5 · LOCAL DEMO`, margin, height - margin - 8);

  ctx.save();
  ctx.translate(width - margin, height - margin - 6);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = `400 ${Math.max(8, Math.round(width * 0.0085))}px "SF Mono", Menlo, monospace`;
  ctx.fillText('NOVA ATELIER / DEMO', 0, 0);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const characters = Array.from(String(text).replace(/\s+/g, ' ').trim());
  const lines = [];
  let line = '';
  for (const char of characters) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (last.length > 2 && ctx.measureText(`${last}…`).width > maxWidth) {
      lines[maxLines - 1] = `${last.slice(0, -1)}…`;
    } else if (characters.length > lines.join('').length) {
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}
