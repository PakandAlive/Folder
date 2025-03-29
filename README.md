<h1 align="center" style="color: #FF0000; background-color: #FFE7E7; padding: 20px; border: 2px solid #FF0000;">
⚠️ 警告 / WARNING ⚠️

本仓库仅供个人使用，严禁 Fork 和商业使用！

代码中包含其他开源项目的引用，如果私自使用，有隐藏风险，后果自负！


</h1>

# VPS 工具箱 🚀

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/PakandAlive/Folder.svg)](https://github.com/PakandAlive/Folder/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/PakandAlive/Folder.svg)](https://github.com/PakandAlive/Folder/network)

一个功能强大的 VPS 管理工具箱,集成了常用的服务器管理、代理协议安装、系统监控等功能。

## 🌟 特性

- 一键安装各种服务
- 支持多种代理协议
- 系统状态监控
- 便捷的配置管理
- 完整的错误处理

## 📦 安装

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/PakandAlive/Folder/main/vpsall.sh)
```

## 🛠️ 功能列表

### 基础服务
- Docker 安装与管理
- 1Panel 面板
- TM 工具

### 代理协议
- 3to1 (Reality + Hysteria2 + VmessArgo)
  - 安装完成后可使用 `nowhash` 命令快速打开配置菜单
- Alpine Hysteria2
- Serv00 Hysteria2
- X-UI 面板

### 系统工具
- 优选 IP
- 哪吒探针
- 流媒体检测
- Docker 监测
- 解压工具
- Hummingbot
- PM2 状态监控
- 系统密码修改

## 📝 使用说明

### 主菜单操作
```shell:vpsall.sh
startLine: 16
endLine: 32
```

### 3to1 快捷配置
安装完成后，使用 `nowhash` 命令可以:
- 快速打开配置菜单
- 查看客户端配置
- 管理代理服务
- 配置 WARP 和端口跳跃

## 🔌 LOON 插件

<details>
<summary>系统相关</summary>

- [屏蔽系统更新](https://whatshub.top/plugin/DisableUpdate.plugin)
</details>

<details>
<summary>应用增强</summary>

- [Spotify Premium](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/Spotify.plugin)
- [Fimo PRO](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/FIMO2LOON.plugin)
</details>

<details>
<summary>广告拦截</summary>

- [Bilibili](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/Bilibili_remove_ads.plugin)
- [YouTube](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/YouTube_remove_ads.plugin)
- [Rednote](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/RedPaper_remove_ads.plugin)
- [Weibo](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/Weibo_remove_ads.plugin)
- [NeteaseCloudMusic](https://raw.githubusercontent.com/PakandAlive/Folder/main/plugin/NeteaseCloudMusic_remove_ads.plugin)
</details>

## 📋 LOON 规则

<details>
<summary>社交媒体</summary>

- [TikTok](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/TikTok/TikTok.list)
- [Twitter](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Twitter.list)
- [Telegram](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/YouTube-TG.list)
</details>

<details>
<summary>流媒体</summary>

- [Netflix](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Netflix.list)
- [Netflix 检测](https://raw.githubusercontent.com/PakandAlive/Folder/main/netmedia.sgmodule)
</details>

<details>
<summary>支付服务</summary>

- [PayPal](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/PayPal/PayPal.list)
</details>

<details>
<summary>AI 服务</summary>

- [OpenAI-Claude](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/OpenAI-Claude.list)
</details>

<details>
<summary>其他规则</summary>

- [Proxy](https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Loon/Proxy/Proxy.list)
- [Talkalone](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/Talkalone.list)
- [Talkalone Ads](https://raw.githubusercontent.com/PakandAlive/Folder/main/rules/TalkaloneREJECT.list)
</details>

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🤝 贡献

欢迎提交 Issues 和 Pull Requests 来帮助改进项目！
