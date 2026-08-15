# 脚本与代理配置收藏库

这是一个按用途维护的个人脚本、代理插件、规则集和 API 服务收藏库。仓库中的内容来源不一，使用前应阅读对应文件及上游项目说明，并仅在合法、已授权的环境中运行。

## 目录结构

```text
.
├── assets/images/          图片资源
├── plugins/loon/           Loon 插件及配套脚本
├── plugins/surge/          Surge 模块及配套脚本
├── rules/                  代理分流规则
├── scripts/automation/     自动化脚本
├── scripts/security/       仅限授权目标的安全检查脚本
├── scripts/server/         VPS 和服务器管理脚本
├── scripts/utilities/      本地实用工具
└── services/api-proxies/   API 代理服务源码
```

## 服务器脚本

### 3to1

用于安装和管理 Reality、Hysteria2、Vmess Argo 等代理协议。脚本会修改服务器网络与服务配置，运行前必须先审阅源码。

- [3to1.sh 源码](https://raw.githubusercontent.com/PakandAlive/Folder/main/scripts/server/3to1.sh)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/PakandAlive/Folder/main/scripts/server/3to1.sh)
```

## Loon 插件

- [Bilibili 去广告](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/Bilibili_remove_ads.plugin)
- [Duolingo Max](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/duolingopro.plugin)
- [FIMO](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/FIMO2LOON.plugin)
- [网易云音乐去广告](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/NeteaseCloudMusic_remove_ads.plugin)
- [小红书去广告](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/RedPaper_remove_ads.plugin)
- [Spotify](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/Spotify.plugin)
- [TikTok 重定向](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/TikTok_redirect.plugin)
- [微博去广告](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/Weibo%20Remove%20Ads.plugin)
- [YouTube 去广告](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/YouTube_remove_ads.plugin)
- [Duolingo 配套脚本](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/loon/duolingopro.js)

## Surge 模块

- IP 信息查询：[模块](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/ipinfo/ipinfo.sgmodule) | [脚本](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/ipinfo/ipinfo.js)
- 流媒体解锁检测：[模块](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/netmedia/netmedia.sgmodule) | [脚本](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/netmedia/netmedia.js)
- 世界时间：[模块](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/world-time/world-time.sgmodule) | [脚本](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/world-time/world-time.js) | [开发指南](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/world-time/Surge%E6%A8%A1%E5%9D%97%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md)

世界时间模块的开发说明位于 [`plugins/surge/world-time/Surge模块开发指南.md`](plugins/surge/world-time/Surge模块开发指南.md)。

## 分流规则

`rules/` 按服务保存独立规则文件，包括 AI 服务、流媒体、社交平台、支付与金融服务。规则格式和兼容性以使用的代理客户端为准。

- [COCA.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/COCA.list)
- [FIMO.js](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/FIMO.js)
- [Gemini.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Gemini.list)
- [MoneseCard.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/MoneseCard.list)
- [N26.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/N26.list)
- [Netflix.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Netflix.list)
- [OpenAI-Claude.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/OpenAI-Claude.list)
- [Sing Box Proxy List.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Sing%20Box%20Proxy%20List.list)
- [Talkalone.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Talkalone.list)
- [TalkaloneREJECT.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/TalkaloneREJECT.list)
- [Trading212.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Trading212.list)
- [TranslateX.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/TranslateX.list)
- [Twitter.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Twitter.list)
- [Weibo-Rednote.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Weibo-Rednote.list)
- [YouTube-TG.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/YouTube-TG.list)
- [appleintelligence.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/appleintelligence.list)
- [bybit.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/bybit.list)
- [claudeai.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/claudeai.list)
- [etherfi.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/etherfi.list)
- [notcn.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/notcn.list)
- [x.list](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/x.list)

## Python 脚本

- [boyinfo.py](https://raw.githubusercontent.com/PakandAlive/Folder/main/scripts/automation/boyinfo.py)：Telegram 自动化脚本，必须通过 `TELEGRAM_BOT_TOKEN` 环境变量提供令牌。
- [login_test.py](https://raw.githubusercontent.com/PakandAlive/Folder/main/scripts/security/login_test.py)：默认凭据审计脚本，只能用于已获授权的目标；必须设置 `AUDIT_CONFIRMATION=authorized`、`AUDIT_USERNAME` 和 `AUDIT_PASSWORD`。
- [gmail_normalizer.py](https://raw.githubusercontent.com/PakandAlive/Folder/main/scripts/utilities/gmail_normalizer.py)：生成 Gmail 点号与加号别名。
- [update_cursor_ids.py](https://raw.githubusercontent.com/PakandAlive/Folder/main/scripts/utilities/update_cursor_ids.py)：更新当前用户 Cursor 本地遥测标识。

运行时输入文件、输出文件、数据库、日志和本地环境变量文件均不应提交到仓库。

## API 服务

- `services/api-proxies/lc2api-worker.js`：Cloudflare Worker 风格的 OpenAI 兼容代理。
- `services/api-proxies/p2api-server.ts`：基于 Deno/Oak 的 OpenAI 兼容代理和统计服务。

这些服务源码不包含部署凭据。部署前需要自行评估访问控制、公开接口、请求日志和统计数据的隐私风险。

## 安全要求

- 禁止在源码、配置、示例、日志或图片元数据中保存真实令牌、密码、Cookie、私钥和个人路径。
- 所有凭据必须由运行环境或平台 Secret 管理功能注入。
- 提交前检查暂存区和完整 Git 历史；删除当前文件不能清除旧提交中的秘密。
- 安全问题与凭据处置流程见 [`SECURITY.md`](SECURITY.md)。

## 路径变更

2026 年 8 月完成目录重构。旧的根目录脚本、`plugin/`、`ohter/` 和 `pic/` 路径已经停止使用，不提供兼容副本；现有订阅或脚本引用需要更新为本 README 中的新地址。

## 许可与来源

本仓库没有统一许可证。各文件可能来自不同上游项目，版权和许可应以文件头、上游仓库及原作者说明为准。未明确授权的内容不得假定为 MIT 许可。
