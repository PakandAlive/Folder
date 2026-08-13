# Surge 模块开发指南

## 1. 整体开发模型

Surge 模块开发可以理解为四层：

```text
模块声明（.sgmodule）
        ↓
脚本执行（JavaScript）
        ↓
面板渲染（Panel）
        ↓
远程资源与结果缓存
```

- `.sgmodule` 负责声明模块名称、面板、脚本、规则等配置。
- JavaScript 负责获取或计算数据，并通过 `$done()` 返回结果。
- `[Panel]` 负责把脚本结果展示在 Surge Dashboard 中。
- GitHub Raw CDN、Surge 外部资源和面板结果都可能存在缓存。

## 2. 模块基本结构

Surge 模块使用 `.sgmodule` 文件，将需要合并到主配置的内容按区段组织：

```ini
#!name=模块名称
#!desc=模块说明
#!author=作者

[Panel]
面板名称 = script-name=脚本名称, update-interval=-1

[Script]
脚本名称 = type=generic, timeout=5, script-path=https://example.com/script.js
```

常见区段：

| 区段 | 用途 |
| --- | --- |
| `[Panel]` | 声明 Dashboard 面板 |
| `[Script]` | 声明脚本及其触发方式 |
| `[Rule]` | 添加分流规则 |
| `[URL Rewrite]` | URL 重写 |
| `[Map Local]` | 返回本地响应 |
| `[MITM]` | 声明需要解密的域名 |
| `[Host]` | 修改 DNS 解析 |
| `[General]` | 修改通用配置 |

模块安装后，Surge 会把模块中的各区段合并到当前配置。不要把完整 `.sgmodule` 原样追加到主配置，也不要在主配置中重复创建同名区段。

## 3. Panel 与 Script 的关系

`[Panel]` 定义面板名称、关联脚本和刷新策略：

```ini
[Panel]
世界时间 = script-name=世界时间脚本-v2, update-interval=-1
```

- `世界时间`：用户看到的面板名称。
- `script-name`：关联 `[Script]` 中的内部脚本名称。
- `update-interval=-1`：不定时自动执行，点击面板时执行。
- `update-interval=60`：每 60 秒自动执行一次。

`[Script]` 定义脚本类型、超时和远程资源地址：

```ini
[Script]
世界时间脚本-v2 = type=generic, timeout=5, script-path=https://example.com/world-time.js?v=2
```

面板名称与脚本名称可以相同，但建议区分显示名称和内部名称：

```text
显示名称：世界时间
内部名称：世界时间脚本-v2
```

这样更容易进行版本升级、日志定位和缓存隔离。

## 4. 面板脚本输出

面板脚本最终通过 `$done()` 返回结果：

```javascript
$done({
  title: "世界时间",
  content: "面板正文",
});
```

需要图标时可以返回：

```javascript
$done({
  title: "标题",
  content: "正文",
  icon: "clock.fill",
  "icon-color": "#1677FF",
});
```

`icon` 通常使用 Apple SF Symbols 名称。

如果不需要图标，脚本从第一版开始就不要返回 `icon` 和 `icon-color`。Surge 可能缓存上一次面板结果，仅在新版脚本中省略字段，不一定会删除已经缓存的旧字段。

## 5. 常见脚本类型

```ini
# Dashboard 面板或普通任务
type=generic

# 处理请求
type=http-request

# 处理响应
type=http-response

# 定时任务
type=cron

# 响应 Surge 事件
type=event
```

示例：

```ini
[Script]
状态面板 = type=generic, timeout=5, script-path=https://example.com/panel.js

定时任务 = type=cron, cronexp="0 9 * * *", timeout=30, script-path=https://example.com/task.js

请求处理 = type=http-request, pattern=^https://example\.com, timeout=10, script-path=https://example.com/request.js
```

只有确实需要读取或修改 HTTPS 请求、响应时才配置 `[MITM]`。纯本地计算类面板不需要 MITM，也不需要网络请求。

## 6. GitHub 部署方式

推荐仓库结构：

```text
plugin/
└── surge-modules/
    └── world-time/
        ├── world-time.sgmodule
        └── world-time.js
```

模块安装地址：

```text
https://raw.githubusercontent.com/用户名/仓库/main/plugin/surge-modules/world-time/world-time.sgmodule
```

脚本地址：

```text
https://raw.githubusercontent.com/用户名/仓库/main/plugin/surge-modules/world-time/world-time.js
```

必须使用 `raw.githubusercontent.com` 地址，不能使用 GitHub 的 `/blob/` 或 `/tree/` 网页地址。

模块中的 `script-path` 也应使用完整 Raw URL：

```ini
script-path=https://raw.githubusercontent.com/用户名/仓库/main/plugin/surge-modules/world-time/world-time.js
```

不要把包含代理密码、证书、令牌或其他敏感配置的主配置文件上传到公共仓库。

## 7. 缓存机制与版本控制

实际更新链路可能包含多层缓存：

```text
GitHub 仓库
    ↓
GitHub Raw CDN 缓存
    ↓
Surge External Resource 脚本缓存
    ↓
Surge Panel Result 面板结果缓存
```

因此，“GitHub 已更新”并不代表 Surge 已经执行新版代码。

常见现象：

- Raw URL 在几分钟内仍返回旧文件。
- Surge 继续执行外部资源缓存中的旧脚本。
- 新版脚本省略某个字段，但面板继续保留旧字段。
- 卸载模块并重启 Surge 后，同名面板仍复用之前的结果。

开发阶段建议为脚本 URL 增加版本参数：

```ini
script-path=https://example.com/world-time.js?v=2
```

如果出现面板结果字段残留，同时修改内部脚本名称：

```ini
[Panel]
世界时间 = script-name=世界时间脚本-v2, update-interval=-1

[Script]
世界时间脚本-v2 = type=generic, timeout=5, script-path=https://example.com/world-time.js?v=2
```

后续升级可递增版本：

```text
世界时间脚本-v2 → 世界时间脚本-v3
?v=2            → ?v=3
```

面向用户的面板名称可以保持不变。

## 8. 推荐开发流程

1. 明确模块属于面板、请求处理、响应处理、定时任务还是规则模块。
2. 先单独编写并验证 JavaScript。
3. 模拟 `$done()`，检查返回对象和显示内容。
4. 执行 JavaScript 语法检查。
5. 编写 `.sgmodule`，确认 `[Panel]` 与 `[Script]` 名称准确对应。
6. 上传模块和脚本到 GitHub。
7. 分别检查两个 Raw URL 的 HTTP 状态与实际内容。
8. 在 Surge 中安装模块。
9. 点击面板并检查 Surge 脚本日志中的实际执行结果。
10. 更新不符合预期时，依次排查 GitHub、Raw CDN、External Resource 和 Panel Result 缓存。

## 9. 本地验证命令

检查 JavaScript 语法：

```bash
node --check world-time.js
```

模拟 Surge 执行：

```bash
node -e 'global.$done = console.log; require("./world-time.js")'
```

检查 Raw 文件实际内容：

```bash
curl -L 'RAW_URL'
```

绕过分支 Raw URL 的短期缓存，可以使用提交 SHA：

```text
https://raw.githubusercontent.com/用户名/仓库/提交SHA/文件路径
```

## 10. 调试顺序

遇到“代码已经更新，但 Surge 行为未变化”时，按以下顺序排查：

1. 检查 GitHub 网页中的最新文件内容。
2. 检查 GitHub Contents API 返回的文件 SHA 和内容。
3. 检查 `main` 分支 Raw URL 是否仍命中 CDN 旧缓存。
4. 使用最新提交 SHA 的 Raw URL验证真实仓库内容。
5. 检查 Surge 已安装的 `.sgmodule` 副本。
6. 检查 Surge 脚本日志中的实际返回对象。
7. 检查 Surge External Resource 是否仍保存旧脚本。
8. 检查 Panel Result 是否保存旧字段。
9. 必要时升级内部脚本名称和 URL 版本参数。

不要一开始就手动删除 Surge 缓存文件。优先通过模块版本设计解决缓存隔离问题，避免破坏其他模块或面板状态。

## 11. 代码设计原则

- 优先使用纯本地计算，非必要不发起网络请求。
- 时区使用 IANA 标识，例如 `America/New_York`，不要手写固定 UTC 偏移。
- 每条执行路径只调用一次 `$done()`。
- 面板输出保持简洁，避免内容过长。
- 根据真实任务设置 `timeout`，不要无意义地设置很大的超时。
- 不需要的返回字段不要声明。
- 仅在确有必要时启用 MITM，并限定准确域名。
- 模块中不要包含密钥、代理密码、证书或完整主配置。
- 删除已有返回字段时，考虑面板结果缓存，主动升级内部脚本名称。
- 修改远程脚本后，递增 URL 版本参数。
- 在日志中确认 Surge 实际执行的脚本版本，不根据界面表现猜测。

## 12. 发布检查清单

- [ ] `.sgmodule` 可以通过 Raw URL 返回，HTTP 状态为 200。
- [ ] JavaScript 可以通过 Raw URL 返回，HTTP 状态为 200。
- [ ] `script-path` 使用完整 Raw URL。
- [ ] `[Panel]` 的 `script-name` 与 `[Script]` 条目一致。
- [ ] JavaScript 通过语法检查。
- [ ] `$done()` 返回字段符合预期。
- [ ] 刷新策略符合需求：自动刷新或点击刷新。
- [ ] 不需要网络的模块没有多余网络请求。
- [ ] 不需要 MITM 的模块没有 `[MITM]` 配置。
- [ ] 仓库中不包含敏感信息。
- [ ] 更新版本时已处理脚本资源和面板结果缓存。
- [ ] 已在 Surge 日志中确认实际执行结果。

## 13. 世界时间模块参考模板

### world-time.sgmodule

```ini
#!name=世界时间
#!desc=在 Surge 面板显示美东、英国曼彻斯特和上海的当前时间
#!author=Local

[Panel]
世界时间 = script-name=世界时间脚本-v2, update-interval=-1

[Script]
世界时间脚本-v2 = type=generic, timeout=5, script-path=https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/surge-modules/world-time/world-time.js?v=2
```

### world-time.js

```javascript
const 地区列表 = [
  { 名称: "美东", 地点: "纽约", 时区: "America/New_York" },
  { 名称: "英国", 地点: "曼彻斯特", 时区: "Europe/London" },
  { 名称: "中国", 地点: "上海", 时区: "Asia/Shanghai" },
];

const 当前时间 = new Date();

function 格式化时间(时区) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: 时区,
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(当前时间);
}

const 内容 = 地区列表
  .map(({ 名称, 地点, 时区 }) => `${名称} - ${地点}\n${格式化时间(时区)}`)
  .join("\n\n");

$done({
  title: "世界时间",
  content: 内容,
});
```

这个模板采用纯本地计算、无 MITM、无网络请求和点击刷新，并通过内部脚本版本与 URL 参数隔离旧缓存。
