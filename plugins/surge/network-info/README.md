# 网络信息

展示国内出口、代理入口及落地 IP、归属地、运营商和代理策略。网络变化时查询并按出口变化发送通知，面板每 300 秒刷新。

## 安装

在 Surge 的模块管理中通过 URL 安装：

https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/network-info/network-info.sgmodule

模块内脚本指向本仓库的远程地址：

https://raw.githubusercontent.com/PakandAlive/Folder/main/plugins/surge/network-info/network-info.js

若之前已安装本地网络信息模块或在主配置中定义了同名脚本和面板，应停用或移除旧定义，避免重复执行。模块无需启用 MITM 即可显示面板；HTTPS 请求入口需另外配置 MITM。

## IPPure 与显示参数

代理出口默认使用 `https://my.ippure.com/v1/info`，附带浏览器 UA、`Origin: https://ippure.com`、`Referer: https://ippure.com/` 和 JSON Accept，无需签名。国内出口仍使用原查询接口；入口地址的查询仍使用支持指定 IP 的接口，避免把调用者出口误认为入口。

模块参数均默认开启，可在 Surge 模块参数中设为 `0` 隐藏：

| 参数 | 显示内容 | 数据来源 |
|---|---|---|
| `RISK_SCORE` | 风险分数，0–100，越低越纯净 | IPPure 返回的风险分数字段 |
| `RESIDENTIAL` | 住宅 IP：是/否/未知 | `isResidential` |
| `BROADCAST` | 广播 IP：是/否/未知 | `isBroadcast` |

缺失或无效的字段显示“未知”；0 分和 false 均正常显示。IPPure 查询失败时使用原 ip-api 接口获取出口信息，三项属性显示“未知”，不推测风险分数。显式设置其他 `LANDING_IPv4` 数据源时沿用该数据源原有行为。原持久化参数仍可能覆盖模块参数。

## 迭代

- `network-info.js`：实际执行的脚本，在这里修改功能。
- `network-info.sgmodule`：触发方式、参数和刷新间隔。
- `upstream.original.js`：迁移时原始脚本，供比较，不由模块执行。

修改并推送到 GitHub 后，在 Surge 更新模块（模块定义变化时）和对应远程脚本资源，再重新加载配置。GitHub Raw 和 Surge 均可能缓存内容，不应仅凭重新加载判断已取得新版本。

当前保持迁移前的 `FLAG=0`、120 秒执行上限、300 秒刷新间隔及脚本存储键。原有持久化参数可能覆盖模块传入参数。IP 查询按 Surge 分流规则执行，面板出口不代表所有策略组的出口。

## 来源

基于 [xream/scripts](https://github.com/xream/scripts) 的 [net-lsp-x.js](https://github.com/xream/scripts/blob/main/surge/modules/network-info/net-lsp-x.js)。保留其中 Env 等公共辅助代码的原有来源注释。

初始版本取自 2026-11-06 Surge 实际使用的缓存脚本，避免迁移时引入上游更新。原始脚本 SHA-256：

`efcedfe72a613b314609f2ed82ea716d821d5c1d7db15012fe4ead218b3fc5a4`
