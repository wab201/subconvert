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

## 部署

本项目基于 Cloudflare Pages + KV，**零构建依赖**（js-yaml 已内联），两种部署方式任选其一。

> **关于 KV 绑定（重要）**：无论用哪种方式部署，KV 命名空间都通过 **Cloudflare Dashboard** 绑定，变量名固定为 `SUBCONVERT_KV`。**`wrangler.toml` 中不包含、也不应该包含任何 KV ID**——它已纳入版本控制，直接 Fork 即可部署，无需改任何配置。

### 前置要求

- 一个 Cloudflare 账号
- （仅本地开发需要）[Node.js](https://nodejs.org/) 18+

### 方式一：通过 GitHub 导入部署（推荐）

1. 将本仓库 **Fork** 到你的 GitHub 账号。
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选择你 Fork 的仓库，构建设置如下：
   - **Framework preset**：`None`
   - **Build command**：留空（无需构建，依赖已内联）
   - **Build output directory**：`public`
4. 点击 **Save and Deploy**，等待首次部署完成。
5. 创建 KV 命名空间：Dashboard 左侧 **KV** → **Create a namespace**，名字随意（如 `subconvert-kv`），记下它的 **ID**。
6. 绑定 KV：进入你的 Pages 项目 → **Settings** → **Functions** → **KV namespace bindings** → **Add binding**：
   - Variable name：`SUBCONVERT_KV`
   - KV namespace：选择上一步创建的命名空间
7. 回到项目 **Deployments** 标签，点击最新一次部署的 **Redeploy** 使绑定生效。
8. （可选）设置访问密码，见下方「访问密码保护」一节。

部署完成后访问你的 `*.pages.dev` 地址即可使用。

### 方式二：通过 Wrangler CLI 部署（不推荐用于本项目）

> ⚠️ **重要警告**：`npm run deploy` 底层执行的是 `wrangler pages deploy`，这会把项目创建为 **直接上传（direct-upload）类型**。此类项目的绑定由 `wrangler.toml` 管理，**Dashboard 的 KV 绑定界面会被锁定为只读**，并提示「此项目的绑定在通过 wrangler.toml 进行管理」。即使之后再去连接 GitHub，项目类型也不会改变。
>
> 因此，如果你是为了开源 Fork / 一键部署，**请务必使用方式一（GitHub 导入）**，不要用方式二。方式二仅适合你明确需要「本地直接上传」且愿意在本地 `wrangler.toml` 里写 KV ID 的场景（注意这会导致 KV ID 泄露到仓库，详见上方 KV 绑定说明）。

如果你已经用方式二建过项目、现在卡在「绑定由 wrangler.toml 管理」无法在 Dashboard 手动绑定，请见下方「常见问题」的对应条目。

适合本地开发完直接推送（仅当你接受 direct-upload 模式时）：

```bash
npm install      # 仅本地需要
npx wrangler login
npm run deploy   # 首次会引导创建 Pages 项目（direct-upload 类型）
```

部署成功后，KV 绑定需写在本地 `wrangler.toml` 的 `[[kv_namespaces]]` 中（**不要提交到 Git**），变量名固定为 `SUBCONVERT_KV`。

### 本地开发

```bash
npm run dev
```

访问 `http://localhost:8788`。`dev.js` 会自动清除代理环境变量，并以 `--kv SUBCONVERT_KV` 绑定一个本地 KV 实例——**无需修改 `wrangler.toml`，也无需创建线上 KV**。

## 访问密码保护（可选）

为了防止他人随意访问你的首页并管理/删除转换链接，你可以配置首页访问密码：

1. 在 Cloudflare Dashboard 中进入 **Workers & Pages** → 你的 `subconvert` 项目 → **Settings** → **Environment variables**。
2. 添加环境变量：
   - 变量名：`ACCESS_PASSWORD`
   - 变量值：`你的自定义密码`
3. 保存并重新部署项目。

> **说明**：
> - 未设置 `ACCESS_PASSWORD` 时，首页保持公开访问。
> - **密码仅限制访问和管理网页首页**；网页生成的转换链接（如 `/sub/my-sub`）完全免密且公开可访问，以便各类代理客户端订阅更新。
> - 本地开发调试时，可在根目录创建 `.dev.vars` 文件并写入 `ACCESS_PASSWORD=你的密码`。


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
├── wrangler.toml               # Cloudflare Pages 配置（无账号相关 ID，KV 经 Dashboard 绑定）
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

### Dashboard 提示「此项目的绑定在通过 wrangler.toml 进行管理」，无法手动绑定 KV

这是项目类型不对导致的，不是配置写错。Cloudflare Pages 有两类项目，绑定来源完全不同：

| 项目类型 | 如何创建 | KV 绑定在哪里配置 | Dashboard 绑定界面 |
| --- | --- | --- | --- |
| **Git 连接项目** | 通过 GitHub 导入（方式一） | Cloudflare Dashboard | ✅ 可手动编辑 |
| **直接上传项目** | 通过 `wrangler pages deploy`（方式二） | `wrangler.toml` | 🔒 只读，提示由 wrangler.toml 管理 |

出现该提示，说明当前项目是**直接上传类型**（通常是因为最初用 `npm run deploy` / `wrangler pages deploy` 建的项目，之后又去连接了 GitHub——但连接 Git 不会改变已有的项目类型）。

**解决步骤（推荐）**：删除当前项目，重新通过 GitHub 导入创建一个全新的 Git 连接项目。

1. Cloudflare Dashboard → **Workers & Pages** → 选中当前项目 → **Manage** / **Delete** 删除它（注意：`.pages.dev` 子域名删除后不一定能立即复用，新项目会得到一个新地址；如有自定义域名可重新绑定）。
2. 回到 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，重新导入你的仓库（按方式一的设置）。
3. 这次创建的是 Git 连接项目，进入 **Settings → Functions → KV namespace bindings**（或 **Settings → Bindings**）→ **Add binding**，变量名 `SUBCONVERT_KV`，选择你的命名空间。
4. **Deployments** → 最新部署 **Redeploy** 使绑定生效。

> **为什么这样就能一劳永逸？** Git 连接项目的 KV 绑定保存在**项目级别**（不是某次部署、也不是 `wrangler.toml`）。所以之后你每次 `git push` 触发的重新部署，都会自动沿用同一个 Dashboard 绑定——**只要仓库里的 `wrangler.toml` 不含 `[[kv_namespaces]]` 块**（本项目已是如此），绑定就永远不会因为重部署而丢失。

如果你必须保留现有项目地址、不想删除重建，则只能走直接上传模式：把 KV 绑定写进**本地** `wrangler.toml`（用 `git update-index --skip-worktree wrangler.toml` 或加入 `.gitignore` 确保不提交），然后 `npm run deploy` 手动上传。但这种模式下 `git push` 不会自动更新 Functions，且容易误提交 KV ID。

### wrangler 4 不支持 `[...path].js` 路由

wrangler 4 不支持 splat 路由参数（`...`），参数名只能包含字母数字和下划线。本项目使用 `[path].js` 单段路由，完全满足自定义路径需求。

### 部分订阅源返回 403 Forbidden

可能原因及解决方案：

1. **User-Agent 不被识别** — 默认使用 `clash-verge/v2.5.1`，大多数订阅源支持。如需修改默认 UA，可编辑 `functions/_lib/convert.js` 中的 `DEFAULT_UA` 常量。

2. **订阅源启用了 Cloudflare 防护（Under Attack 模式）** — 如果错误信息中包含 `Just a moment...`，说明订阅源网站本身也托管在 Cloudflare 上并开启了 JS 挑战。由于本服务运行在 Cloudflare 边缘网络上，Cloudflare-to-Cloudflare 的请求会触发挑战页，Worker 无法执行 JavaScript 也就无法通过挑战。这是 Cloudflare 平台层面的限制，无法从代码层面解决。建议联系订阅源提供商获取不经过 Cloudflare 挑战的订阅域名。

## License

MIT
