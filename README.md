# SubConvert - 代理订阅转换

自托管的代理节点订阅转换工具，部署在 Cloudflare Pages 上。所有转换逻辑在 Cloudflare 边缘节点本地执行，**不依赖任何第三方转换服务**，确保订阅信息零泄漏。

## 功能特性

- 🔒 **零泄漏** — 转换逻辑完全本地执行，不调用任何第三方 API
- ⚡ **实时转换** — 每次访问订阅链接都拉取最新源订阅并即时转换
- 📦 **多格式支持** — Clash/Mihomo、Sing-Box、V2Ray Base64、纯文本互转
- 🌐 **全协议覆盖** — SS、VMess、VLESS、Trojan、Hysteria2、TUIC
- 🔗 **自定义路径** — 可自定义输出 URL 的 path，如 `/sub/my-sub`
- 📋 **链接管理** — 查看所有已生成的转换链接，支持复制和删除
- 🚀 **一键部署** — 基于 Cloudflare Pages + KV，零服务器成本

## 支持的格式

### 输入格式（自动检测）

- Base64 编码的订阅链接（V2Ray 格式）
- Clash / Mihomo YAML 配置
- Sing-Box JSON 配置
- 纯文本 URI 列表（每行一个节点）

### 输出格式

| 格式        | 说明                                             |
| --------- | ---------------------------------------------- |
| `clash`   | Clash / Mihomo YAML 配置（含 proxy-groups 和 rules） |
| `singbox` | Sing-Box JSON 配置（含 route 和 dns）                |
| `base64`  | V2Ray Base64 编码的 URI 列表                        |
| `plain`   | 纯文本 URI 列表                                     |

### 支持的代理协议

- Shadowsocks (`ss://`)
- VMess (`vmess://`)
- VLESS (`vless://`)
- Trojan (`trojan://`)
- Hysteria2 (`hysteria2://` / `hy2://`)
- TUIC (`tuic://`)

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18+
- Cloudflare 账号

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 KV 命名空间

```bash
npx wrangler kv namespace create SUBCONVERT_KV
```

将输出的 `id` 填入 `wrangler.toml` 中，替换 `REPLACE_WITH_YOUR_KV_ID`。

### 3. 本地开发

```bash
npm run dev
```

访问 `http://localhost:8788` 即可使用。本地开发会自动创建本地 KV 实例。

### 4. 部署到 Cloudflare Pages

有两种部署方式：

#### 方式一：Git 导入部署（推荐）

1. 将本项目 Fork 或推送到你的 GitHub 仓库
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择你的 GitHub 仓库
4. 构建设置：
   - **Framework preset**: `None`
   - **Build command**: 留空（无需构建，js-yaml 已内联）
   - **Build output directory**: `public`
5. 点击 **Save and Deploy**
6. 部署完成后，进入项目 **Settings** → **Functions** → **KV namespace bindings**，添加绑定：
   - Variable name: `SUBCONVERT_KV`
   - KV namespace: 选择第 2 步创建的命名空间
7. 重新部署一次使 KV 绑定生效

#### 方式二：Wrangler CLI 部署

```bash
npm run deploy
```

首次部署时，wrangler 会引导你登录 Cloudflare 账号并创建 Pages 项目。

### 5. 绑定 KV（生产环境）

> 如果使用方式一（Git 导入），KV 绑定在 Dashboard 中完成（见上方步骤 6-7）。
> 如果使用方式二（CLI 部署），也可在 Dashboard 中手动绑定：

在 Cloudflare Dashboard 中：

1. 进入 **Workers & Pages** → 选择你的 `subconvert` 项目
2. 进入 **Settings** → **Bindings**
3. 添加 **KV namespace** 绑定
   - 变量名：`SUBCONVERT_KV`
   - KV 命名空间：选择第 2 步创建的命名空间
4. 重新部署项目

## 使用方法

1. 打开网站首页
2. 填写源订阅 URL
3. 选择目标格式（Clash / Sing-Box / V2Ray / Plain Text）
4. 可选：填写自定义路径（同时作为备注标识，留空则自动生成）
5. 点击「生成转换链接」
6. 复制生成的订阅链接，导入到你的代理客户端

在「转换链接管理」区域可以：

- 查看所有已生成的链接
- 复制订阅链接
- 在新标签页预览
- 删除不需要的链接
- 查看访问次数

## 项目结构

```
subconvert/
├── functions/                  # Cloudflare Pages Functions (后端)
│   ├── _lib/                   # 共享库（下划线前缀，不作为路由）
│   │   ├── utils.js            # 工具函数（base64, URL解析等）
│   │   ├── uri-parse.js        # 代理协议 URI 解析器
│   │   ├── uri-generate.js     # 代理协议 URI 生成器
│   │   ├── sub-parse.js        # 订阅内容解析（自动检测格式）
│   │   ├── sub-generate.js     # 订阅内容生成
│   │   ├── store.js            # KV 存储操作
│   │   ├── convert.js          # 转换管道
│   │   ├── response.js         # HTTP 响应辅助
│   │   └── vendor/
│   │       └── js-yaml.mjs     # js-yaml v4.3.1 内联（MIT，无需 npm install）
│   ├── api/
│   │   ├── convert.js          # POST /api/convert — 创建转换
│   │   └── links.js            # GET/DELETE /api/links — 管理链接
│   └── sub/
│       └── [path].js           # GET /sub/:path — 订阅输出端点
├── public/                     # 静态前端
│   ├── index.html
│   ├── style.css
│   └── app.js
├── package.json
├── deploy.js                   # 部署脚本（清除代理环境变量）
├── dev.js                      # 本地开发启动脚本（清除代理环境变量）
├── wrangler.toml               # Cloudflare Pages 配置（需填入你的 KV ID）
├── LICENSE
└── README.md
```

## API 文档

### 创建转换链接

```
POST /api/convert
Content-Type: application/json

{
  "sourceUrl": "https://example.com/subscribe/...",
  "targetFormat": "clash",
  "customPath": "my-sub"          // 可选，同时作为备注标识
}
```

### 列出所有链接

```
GET /api/links
```

### 删除链接

```
DELETE /api/links?path=my-sub
```

### 获取转换后的订阅

```
GET /sub/:path
```

## 安全说明

- 所有订阅转换逻辑在 Cloudflare 边缘节点本地执行
- **不调用任何第三方转换 API**，订阅数据不会发送到外部服务
- 源订阅 URL 仅存储在你自己的 Cloudflare KV 中
- 建议为自定义路径使用不易猜到的字符串

## 常见问题

### 本地开发服务器页面空白/一直转圈

如果你使用了代理软件（Clash、v2ray 等），`HTTPS_PROXY` 环境变量会干扰 wrangler 4 的 ProxyWorker 内部转发，导致页面无法加载。

`npm run dev` 使用 `dev.js` 脚本启动，会自动在 Node.js 层面清除代理环境变量。如果仍有问题，可能是代理软件在系统网络层拦截了本地连接，请尝试：

1. **完全退出代理软件**（不仅是关闭系统代理设置，需要退出代理软件进程本身）
2. 或在代理软件中将 `127.0.0.1` 和 `localhost` 添加到直连/绕过列表
3. 或手动执行：

```powershell
# PowerShell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; $env:ALL_PROXY=""; node dev.js
```

### wrangler 4 不支持 `[...path].js` 路由

wrangler 4 不支持 splat 路由参数（`...`），参数名只能包含字母数字和下划线。本项目使用 `[path].js` 单段路由，完全满足自定义路径需求。

### 部分订阅源返回 403 Forbidden

可能原因及解决方案：

1. **User-Agent 不被识别** — 默认使用 `clash-verge/v2.5.1`，大多数订阅源支持。如需修改默认 UA，可编辑 `functions/_lib/convert.js` 中的 `DEFAULT_UA` 常量。

2. **订阅源启用了 Cloudflare 防护（Under Attack 模式）** — 如果错误信息中包含 `Just a moment...`，说明订阅源网站本身也托管在 Cloudflare 上并开启了 JS 挑战。由于本服务运行在 Cloudflare 边缘网络上，Cloudflare-to-Cloudflare 的请求会触发挑战页，Worker 无法执行 JavaScript 也就无法通过挑战。这是 Cloudflare 平台层面的限制，无法从代码层面解决。建议联系订阅源提供商获取不经过 Cloudflare 挑战的订阅域名。

## License

MIT
