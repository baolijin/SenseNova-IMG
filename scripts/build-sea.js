#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, '.build');
const CACHE_DIR = path.join(BUILD_DIR, 'cache');
const TARGETS_DIR = path.join(BUILD_DIR, 'targets');
const TOOLCHAINS_DIR = path.join(BUILD_DIR, 'toolchains');
const WORK_DIR = path.join(BUILD_DIR, 'work');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const NODE_DIST = 'https://nodejs.org/dist';
const DEFAULT_NODE_VERSION = 'v26.7.0';

function usage() {
  console.log(`用法: node scripts/build-sea.js [选项]

选项:
  --platform <win|mac>       目标平台（默认当前系统）
  --arch <x64|arm64>         目标架构（Windows 默认 x64，macOS 默认当前架构）
  --node-version <vX.Y.Z>    内嵌 Node 版本（默认 ${DEFAULT_NODE_VERSION}）
  --clean                    构建前清理 .build 目录
  -h, --help                 显示帮助

示例:
  npm run package:win
  npm run package:mac
  node scripts/build-sea.js --platform mac --arch x64
`);
}

function fatal(message) {
  console.error(`\n打包失败: ${message}\n`);
  const error = new Error(message);
  error.buildError = true;
  throw error;
}

function parseArgs(argv) {
  const options = {
    platform: null,
    arch: null,
    nodeVersion: DEFAULT_NODE_VERSION,
    clean: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--clean') {
      options.clean = true;
      continue;
    }
    if (arg === '--platform' || arg.startsWith('--platform=')) {
      options.platform = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++index];
      if (!options.platform) fatal('--platform 缺少参数');
      continue;
    }
    if (arg === '--arch' || arg.startsWith('--arch=')) {
      options.arch = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++index];
      if (!options.arch) fatal('--arch 缺少参数');
      continue;
    }
    if (arg === '--node-version' || arg.startsWith('--node-version=')) {
      options.nodeVersion = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++index];
      if (!options.nodeVersion) fatal('--node-version 缺少参数');
      continue;
    }
    fatal(`未知参数: ${arg}`);
  }

  return options;
}

function normalizePlatform(value) {
  const platform = String(value || process.platform).toLowerCase();
  if (platform === 'win' || platform === 'windows' || platform === 'win32') return 'win';
  if (platform === 'mac' || platform === 'macos' || platform === 'darwin') return 'mac';
  fatal(`不支持的目标平台: ${value}（当前支持 win、mac）`);
}

function normalizeArch(value, platform) {
  const arch = String(value || (platform === 'win' ? 'x64' : process.arch)).toLowerCase();
  if (arch === 'x64' || arch === 'amd64') return 'x64';
  if (arch === 'arm64' || arch === 'aarch64') return 'arm64';
  fatal(`不支持的目标架构: ${value}（当前支持 x64、arm64）`);
}

function normalizeVersion(value) {
  const version = String(value || DEFAULT_NODE_VERSION);
  return version.startsWith('v') ? version : `v${version}`;
}

function hostNodeDistribution() {
  const platform = process.platform === 'win32' ? 'win' : process.platform;
  if (!['win', 'darwin', 'linux'].includes(platform)) {
    fatal(`不支持在当前系统上打包: ${process.platform}`);
  }
  if (!['x64', 'arm64'].includes(process.arch)) {
    fatal(`不支持当前构建机架构: ${process.arch}`);
  }
  return {
    platform,
    arch: process.arch,
    extension: platform === 'linux' ? '.tar.xz' : platform === 'darwin' ? '.tar.gz' : '.zip',
    nodePath: platform === 'win' ? 'node.exe' : 'bin/node'
  };
}

function targetDistribution(platform, arch, version) {
  return {
    platform,
    arch,
    os: platform === 'win' ? 'win' : 'darwin',
    extension: platform === 'win' ? '.zip' : '.tar.gz',
    nodePath: platform === 'win' ? 'node.exe' : 'bin/node',
    folder: `node-${version}-${platform === 'win' ? 'win' : 'darwin'}-${arch}`,
    output: platform === 'win'
      ? path.join(DIST_DIR, `nova-atelier-win-${arch}.exe`)
      : path.join(DIST_DIR, `nova-atelier-macos-${arch}`)
  };
}

async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

let sumsCache = null;

async function fetchChecksums(version) {
  if (sumsCache && sumsCache.version === version) return sumsCache.sums;
  const url = `${NODE_DIST}/${version}/SHASUMS256.txt`;
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  } catch (error) {
    fatal(`无法下载 Node 校验文件 (${url}): ${error.message}`);
  }
  if (!response.ok) fatal(`无法下载 Node 校验文件 (HTTP ${response.status}): ${url}`);
  const text = await response.text();
  const sums = new Map();
  for (const line of text.split('\n')) {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (match) sums.set(match[2].trim(), match[1].toLowerCase());
  }
  sumsCache = { version, sums };
  return sums;
}

async function downloadFile(url, destination) {
  console.log(`下载 ${url}`);
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(600000) });
  } catch (error) {
    fatal(`下载失败: ${error.message}`);
  }
  if (!response.ok || !response.body) fatal(`下载失败 (HTTP ${response.status}): ${url}`);

  const total = Number(response.headers.get('content-length') || 0);
  let received = 0;
  let lastReport = 0;
  const body = Readable.fromWeb(response.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    if (!total || received - lastReport < 5 * 1024 * 1024) return;
    lastReport = received;
    const percent = Math.min(100, Math.floor((received / total) * 100));
    process.stdout.write(`  下载中 ${percent}%（${(received / 1024 / 1024).toFixed(1)} MB）\n`);
  });

  const temporary = `${destination}.part`;
  try {
    await pipeline(body, fs.createWriteStream(temporary));
    await fsp.rename(temporary, destination);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    fatal(`保存安装包失败: ${error.message}`);
  }
}

async function ensureNodeArchive(version, os, arch, extension) {
  const fileName = `node-${version}-${os}-${arch}${extension}`;
  const archive = path.join(CACHE_DIR, fileName);
  const sums = await fetchChecksums(version);
  const expected = sums.get(fileName);
  if (!expected) fatal(`Node ${version} 没有提供 ${fileName}`);
  if (process.env.NODE_SEA_SKIP_CHECKSUM !== '1') {
    if (fs.existsSync(archive)) {
      const actual = await sha256File(archive);
      if (actual === expected) return archive;
      console.log(`校验失败，重新下载 ${fileName}`);
      await fsp.rm(archive, { force: true });
    }
    await downloadFile(`${NODE_DIST}/${version}/${fileName}`, archive);
    const actual = await sha256File(archive);
    if (actual !== expected) {
      await fsp.rm(archive, { force: true });
      fatal(`SHA256 校验失败: ${fileName}`);
    }
    console.log(`SHA256 校验通过: ${fileName}`);
    return archive;
  }
  if (!fs.existsSync(archive)) await downloadFile(`${NODE_DIST}/${version}/${fileName}`, archive);
  return archive;
}

function extractArchive(archive, destination, extension) {
  fs.mkdirSync(destination, { recursive: true });
  const result = spawnSync('tar', ['-xf', archive, '-C', destination], { stdio: 'inherit' });
  if (result.status === 0) return;

  if (extension === '.zip' && process.platform === 'win32') {
    const quote = (value) => `'${value.replace(/'/g, "''")}'`;
    const command = `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(destination)} -Force`;
    const fallback = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { stdio: 'inherit' }
    );
    if (fallback.status === 0) return;
  }
  fatal(`解压失败: ${archive}`);
}

async function prepareNode(version, distribution, extension, kind) {
  const baseDir = kind === 'target' ? TARGETS_DIR : TOOLCHAINS_DIR;
  const folder = `node-${version}-${distribution.os || distribution.platform}-${distribution.arch}`;
  const executable = path.join(baseDir, folder, distribution.nodePath);
  if (!fs.existsSync(executable)) {
    const archive = await ensureNodeArchive(
      version,
      distribution.os || distribution.platform,
      distribution.arch,
      extension
    );
    console.log(`解压 ${path.basename(archive)}`);
    await fsp.rm(path.join(baseDir, folder), { recursive: true, force: true });
    extractArchive(archive, baseDir, extension);
  }
  if (!fs.existsSync(executable)) fatal(`安装包中没有找到 Node 可执行文件: ${executable}`);
  if (process.platform !== 'win32') await fsp.chmod(executable, 0o755);
  return executable;
}

function stripAuthenticode(file) {
  const data = fs.readFileSync(file);
  if (data.length < 0x40 || data.toString('ascii', 0, 2) !== 'MZ') return false;
  const peOffset = data.readUInt32LE(0x3c);
  if (data.toString('ascii', peOffset, peOffset + 4) !== 'PE\u0000\u0000') return false;

  const optionalOffset = peOffset + 4 + 20;
  const magic = data.readUInt16LE(optionalOffset);
  if (magic !== 0x10b && magic !== 0x20b) return false;
  const dataDirectory = optionalOffset + (magic === 0x10b ? 96 : 112);
  const certificateEntry = dataDirectory + 4 * 8;
  const certificateOffset = data.readUInt32LE(certificateEntry);
  const certificateSize = data.readUInt32LE(certificateEntry + 4);
  if (!certificateSize) return false;
  if (certificateOffset + certificateSize !== data.length) {
    console.warn('  Windows 可执行文件的证书表不在文件末尾，跳过签名清理。');
    return false;
  }

  const output = Buffer.from(data.subarray(0, certificateOffset));
  output.writeUInt32LE(0, certificateEntry);
  output.writeUInt32LE(0, certificateEntry + 4);
  fs.writeFileSync(file, output);
  return true;
}

async function collectAssets() {
  const assets = {};

  async function walk(directory) {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const key = path.relative(PUBLIC_DIR, absolute).split(path.sep).join('/');
        assets[key] = absolute;
      }
    }
  }

  await walk(PUBLIC_DIR);
  for (const required of ['index.html', 'styles.css', 'js/agent.js']) {
    if (!assets[required]) fatal(`缺少前端资源: public/${required}`);
  }
  return assets;
}

function runBuilder(builder, version, configPath) {
  const help = spawnSync(builder, ['--help'], { encoding: 'utf8' });
  const helpText = `${help.stdout || ''}${help.stderr || ''}`;
  if (help.error) fatal(`无法运行打包用 Node: ${help.error.message}`);
  if (!helpText.includes('--build-sea')) {
    fatal(`Node ${version} 不支持 --build-sea；请使用官方 Node.js 发布包。`);
  }

  console.log(`使用 Node ${version} 生成单文件程序`);
  const result = spawnSync(builder, ['--build-sea', configPath], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  if (result.error) fatal(`无法启动 Node 打包器: ${result.error.message}`);
  if (result.status !== 0) fatal(`Node --build-sea 退出码 ${result.status}`);
}

function verifyPeOutput(output) {
  const data = fs.readFileSync(output);
  if (data.length < 0x40 || data.toString('ascii', 0, 2) !== 'MZ') fatal('产物不是有效的 Windows PE 文件');
  const peOffset = data.readUInt32LE(0x3c);
  if (data.toString('ascii', peOffset, peOffset + 4) !== 'PE\u0000\u0000') {
    fatal('产物缺少 PE 头');
  }
  const optionalOffset = peOffset + 4 + 20;
  const magic = data.readUInt16LE(optionalOffset);
  const dataDirectory = optionalOffset + (magic === 0x10b ? 96 : 112);
  const certificateSize = data.readUInt32LE(dataDirectory + 4 * 8 + 4);
  if (certificateSize) {
    console.warn('  警告: Windows 产物仍包含 Authenticode 证书表。');
  }
}

function verifyMacOutput(output) {
  const data = fs.readFileSync(output);
  const magic = data.readUInt32BE(0);
  if (![0xcafebabe, 0xbebafeca, 0xcffaedfe, 0xfeedfacf, 0xcefaedfe, 0xfeedface].includes(magic)) {
    fatal('产物不是有效的 Mach-O 文件');
  }
}

function adHocSign(output) {
  if (process.platform !== 'darwin') {
    console.warn('  当前不在 macOS 上，无法执行 ad-hoc 签名；分发给 macOS 用户前请在 Mac 上重新打包。');
    return;
  }
  spawnSync('codesign', ['--remove-signature', output], { stdio: 'ignore' });
  const result = spawnSync('codesign', ['--force', '--sign', '-', output], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.warn('  macOS ad-hoc 签名失败。你仍可本机运行，但分发给其他设备时可能被 Gatekeeper 拦截。');
  } else {
    console.log('macOS ad-hoc 签名完成');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const platform = normalizePlatform(options.platform);
  const arch = normalizeArch(options.arch, platform);
  const version = normalizeVersion(options.nodeVersion);
  if (!/^v\d+\.\d+\.\d+$/.test(version)) fatal(`Node 版本格式无效: ${version}`);

  const host = hostNodeDistribution();
  const target = targetDistribution(platform, arch, version);

  if (options.clean) {
    console.log(`清理 ${BUILD_DIR}`);
    await fsp.rm(BUILD_DIR, { recursive: true, force: true });
  }
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  await fsp.mkdir(TARGETS_DIR, { recursive: true });
  await fsp.mkdir(TOOLCHAINS_DIR, { recursive: true });
  await fsp.mkdir(WORK_DIR, { recursive: true });
  await fsp.mkdir(DIST_DIR, { recursive: true });

  console.log(`\n目标: ${platform === 'win' ? 'Windows' : 'macOS'} ${arch}`);
  console.log(`内嵌 Node: ${version}\n`);

  const targetNode = await prepareNode(version, target, target.extension, 'target');

  let builder = targetNode;
  if (host.platform !== target.os || host.arch !== target.arch) {
    const builderDistribution = {
      ...host,
      os: host.platform
    };
    builder = await prepareNode(version, {
      ...builderDistribution,
      nodePath: host.nodePath
    }, host.extension, 'toolchain');
  }

  const platformKey = `${platform}-${arch}`;
  const workDirectory = path.join(WORK_DIR, platformKey);
  await fsp.rm(workDirectory, { recursive: true, force: true });
  await fsp.mkdir(workDirectory, { recursive: true });

  const executableName = platform === 'win' ? 'node.exe' : 'node';
  const workExecutable = path.join(workDirectory, executableName);
  await fsp.copyFile(targetNode, workExecutable);
  if (process.platform !== 'win32') await fsp.chmod(workExecutable, 0o755);

  if (platform === 'win') {
    if (stripAuthenticode(workExecutable)) {
      console.log('已移除 Node 官方可执行文件的 Authenticode 签名，避免注入后出现无效签名。');
    }
  }

  const assets = await collectAssets();
  console.log(`内嵌 ${Object.keys(assets).length} 个前端资源`);

  const configPath = path.join(workDirectory, 'sea-config.json');
  const config = {
    main: path.join(PROJECT_ROOT, 'server.js'),
    mainFormat: 'commonjs',
    executable: workExecutable,
    output: target.output,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    assets
  };
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
  await fsp.rm(target.output, { force: true });

  runBuilder(builder, version, configPath);

  if (!fs.existsSync(target.output)) fatal(`打包器没有生成产物: ${target.output}`);
  if (platform === 'win') verifyPeOutput(target.output);
  else verifyMacOutput(target.output);

  if (platform === 'mac') {
    adHocSign(target.output);
  } else {
    console.warn('  Windows 产物未签名；首次运行可能触发 SmartScreen，选择「更多信息 → 仍要运行」即可。');
  }

  if (process.env.NODE_SEA_KEEP_WORK !== '1') {
    await fsp.rm(workDirectory, { recursive: true, force: true }).catch(() => {});
  }

  const stat = await fsp.stat(target.output);
  const digest = await sha256File(target.output);
  console.log('\n打包完成');
  console.log(`  文件: ${path.relative(PROJECT_ROOT, target.output)}`);
  console.log(`  大小: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  SHA256: ${digest}`);
  console.log(`\n数据目录: ${path.join(path.dirname(target.output), '.data')}（运行后创建）\n`);
}

main().catch((error) => {
  process.exitCode = 1;
  if (!error.buildError) console.error(error);
});
