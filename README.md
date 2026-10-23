# Nova Atelier

由 SenseNova **U1.5 Lite** 与 **U1.5 Fast** 驱动的本地图像创作工作台。用自然语言生成图片、上传参考图创作，或在当前画布上继续编辑；Agent 会自动选择模型，并在生成后做一轮细节精修。

这是一个可本地运行的交互原型：零前端构建、零第三方运行时依赖，只需 Node.js。

## 功能

- **文生图 / 参考图创作 / 图像编辑**：对话式输入，支持拖拽、粘贴、批量选择参考图（最多 5 张）。
- **双模型 Agent 路由**：
  - `sensenova-u1.5-lite`：复杂指令、排版文字、海报、多约束与高质量任务。
  - `sensenova-u1.5-fast`：轻量提示、快速迭代与精修。
  - Auto 模式按提示长度、参考图数量和复杂度信号自动选择，也可以手动锁定。
- **自动精修**：初稿完成后调用 Fast 模型保持主体与构图做细节增强，可在参数面板关闭。
- **画布工作流**：版本胶片条、原图/当前对比滑块、继续编辑、重做、下载、全屏。
- **本地持久化**：会话与参数存入 `localStorage`；真实生成图由本地服务归档到 `.data/media`，避免上游 24 小时临时链接过期。
- **演示模式**：没有 API Key 时，用 Canvas 在本地合成演示画面，完整保留 Agent 轨迹和交互流程。
- **响应式布局**：桌面三栏、平板抽屉、移动端「对话 / 画布」双视图。

## 运行

要求 **Node.js 18+**（使用内置 `fetch`）。无需 `npm install`。

```bash
cd nova-atelier
npm start
```

打开 <http://127.0.0.1:4173>。

### 配置 API Key

任选一种方式：

1. **浏览器内配置**：点击右上角「演示模式 / 未连接」状态，填入 SenseNova API Key。密钥只保存在当前浏览器的 `localStorage`，请求时通过本地代理转发。
2. **服务端环境变量**：

```bash
SENSENOVA_API_KEY=sk-... npm start
```

可选环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `4173` | 本地端口 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `SENSENOVA_BASE_URL` | `https://token.sensenova.cn/v1` | 上游 API 地址 |
| `SENSENOVA_API_KEY` | 空 | 服务端 API Key |
| `NOVA_DATA_DIR` | 项目/程序旁的 `.data` | 图片归档目录 |
| `NOVA_NO_OPEN` | 空 | 设为 `1` 时打包版不自动打开浏览器 |

未配置任何 Key 时自动进入演示模式。点击「先以演示模式体验」可强制使用演示模式。

## 打包为独立程序

可以把服务、前端和 Node.js 运行时打进单个文件，目标电脑**无需安装 Node.js**。

### Windows

```bash
npm run package:win
```

或在 Windows 上双击 `scripts\build-windows.bat`。

产物为 `dist/nova-atelier-win-x64.exe`（约 99 MB）。双击运行后会自动打开默认浏览器；关闭控制台窗口即停止服务。ARM64 Windows 使用：

```bash
npm run package:win:arm64
```

### macOS

```bash
npm run package:mac
```

或在 Finder 中双击 `scripts/build-macos.command`。

产物为 `dist/nova-atelier-macos-arm64`（Apple Silicon）。Intel Mac 使用 `npm run package:mac:x64`，建议直接在 Intel Mac 上构建并测试。首次打开若被 Gatekeeper 拦截，可右键选择「打开」，或执行：

```bash
xattr -dr com.apple.quarantine dist/nova-atelier-macos-arm64
```

### 打包说明

- 打包机需要 Node.js 18+ 和网络。脚本会从 nodejs.org 下载官方 Node `v26.7.0`，校验 SHA256，再用内置 `--build-sea` 生成单文件程序。
- 可用参数：`--platform win|mac`、`--arch x64|arm64`、`--node-version vX.Y.Z`、`--clean`；打包逻辑位于 `scripts/build-sea.js`。
- Windows 产物会先移除 Node 官方 Authenticode 签名，避免注入后出现无效签名；但整体未做代码签名，首次运行可能触发 SmartScreen，选择「更多信息 → 仍要运行」即可。
- macOS 产物会做 ad-hoc 签名。对外分发仍建议使用 Apple Developer ID 签名并公证；在非 macOS 系统上交叉打包会跳过签名。
- 打包版的数据目录在**可执行文件旁的 `.data/`**，请放在有写权限的目录中。移动程序时连同 `.data` 一起移动；也可用 `NOVA_DATA_DIR` 指定独立目录。
- 打包版默认监听 `127.0.0.1:4173` 并自动打开浏览器。`PORT`、`HOST`、`SENSENOVA_API_KEY` 仍然有效，`NOVA_NO_OPEN=1` 可禁止自动打开。

## 使用

1. 在左侧输入描述，例如「为一家山野咖啡馆设计开业海报，中文标题『山野有风』，复古丝网印刷」。
2. Agent 依次执行：解析意图 → 选择模型 → 生成/编辑 → 智能精修。
3. 生成后可：
   - 在版本胶片条切换历史版本；
   - 点击「对比」查看原图与当前图；
   - 点击「继续编辑」基于当前画布继续修改；
   - 添加参考图后选择「新建作品」或「编辑当前」；
   - 在右侧「创作参数」中锁定模型、画幅、格式、精修、提示词增强与去水印。
4. 编辑操作以当前选中的版本为父图，形成可追溯的版本链。

## 目录结构

```text
nova-atelier/
├── server.js              # 静态服务 + SenseNova 代理 + 图片归档
├── package.json
├── scripts/
│   ├── build-sea.js       # 跨平台 SEA 单文件打包脚本
│   ├── build-windows.bat
│   └── build-macos.command
├── public/
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── core.js        # 常量、状态、localStorage、弹窗/抽屉
│       ├── demo.js        # 无 Key 时的 Canvas 演示画面
│       ├── render.js      # 对话、画布、参数、历史渲染
│       ├── agent.js       # Agent 编排、API 调用、下载/重做/全屏
│       └── events.js      # 事件委托、拖拽/粘贴、初始化
├── dist/                  # 独立可执行程序产物（gitignore）
└── .data/media/           # 真实生成图归档（gitignore）
```

浏览器端不直接请求 SenseNova，而是调用本地代理：

```text
POST /api/generate   →   POST {SENSENOVA_BASE_URL}/images/generations
POST /api/edit       →   POST {SENSENOVA_BASE_URL}/images/edits
GET  /api/config     →   读取服务端是否已配置 Key
GET  /media/<file>   →   读取归档图片
```

## 上游参数

服务端会把前端请求规范化为：

```json
{
  "model": "sensenova-u1.5-lite",
  "prompt": "...",
  "n": 1,
  "size": "auto",
  "output_format": "png",
  "response_format": "url",
  "watermark": false,
  "prompt_extend": true
}
```

编辑请求额外携带：

```json
{
  "images": [{ "image_url": "data:image/png;base64,..." }]
}
```

约束与默认值：

- `size` 支持 `auto`，或 512–4096 之间、32 的倍数、长宽比不超过 3:1 的尺寸。
- 图像编辑最多 5 张参考图；编辑模式下，当前主图占 1 张，额外参考图最多 4 张。
- 默认请求去水印（`watermark: false`）并开启提示词增强（`prompt_extend: true`）。
- 精修请求固定 `size: "auto"`、`prompt_extend: false`，使用 `U1.5 Fast`，除非手动锁定 Lite。
- 上游超时 240 秒，请求体上限 64 MB。

## 设计说明

- **Agent 编排是确定性的本地流程**，由规则完成意图解析、复杂度路由和精修，不依赖额外的 LLM 规划服务。这样原型可离线演示，也更容易控制成本与时延。
- **密钥不进代码库**。浏览器 Key 存在 `localStorage`，服务端 Key 只从环境变量读取；两者都不会写入日志。
- **图片归档**：默认下载上游图片到本地；如果下载失败但上游仍返回可访问 URL，则回退使用该临时 URL。
- **演示图不是模型输出**，只用于体验界面和流程，画面上会标注 `DEMO`。

## 已知限制

- 单用户、无鉴权，仅建议绑定 `127.0.0.1` 本地使用。
- 会话数据存在浏览器 `localStorage`，清理浏览器数据会丢失会话索引；归档图片仍保留在 `.data/media`。
- 未内置账号、配额、计费或多用户数据库。
- Windows 独立程序未做 Authenticode 代码签名，macOS 只有 ad-hoc 签名；正式分发前需自行签名。
- 实际生成质量、延迟与上游限制以 SenseNova 官方文档和账户额度为准。

## 故障排查

- **端口被占用**：`PORT=4174 npm start`；打包版请先关闭已运行的实例。
- **Windows 提示已保护你的电脑**：程序未签名，点击「更多信息 → 仍要运行」。
- **打包版没有自动打开浏览器**：手动访问 `http://127.0.0.1:4173`，或检查是否设置了 `NOVA_NO_OPEN=1`。
- **仍显示演示模式**：确认 Key 已保存，或启动时设置了 `SENSENOVA_API_KEY`；点击状态胶囊可重新配置。
- **请求 401/403**：检查 Key 是否有效、是否包含 `Bearer` 以外的多余字符。
- **请求超时**：大尺寸或复杂任务可能接近 240 秒，稍后重试或改用 `U1.5 Fast`。
