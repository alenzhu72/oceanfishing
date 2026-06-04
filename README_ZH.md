# OceanFishing 中文说明

OceanFishing 是一个面向手机浏览器的 H5 钓鱼参考页面，用于查看不同海域未来一段时间的潮汐、海况、风浪、水温和鱼情评分。

当前版本已从 Firebase Hosting / Firestore 改为 Windows Server 自托管：

```text
手机浏览器 -> HTTP/HTTPS -> Node.js API -> 本地 JSON 数据
```

默认访问域名：

```text
http://fish.britesky.net:5173
```

如果服务器前面另有 IIS、Nginx、Apache、Caddy 或其他 HTTPS 服务，可以把外部域名反向代理到：

```text
http://127.0.0.1:5173
```

## 主要功能

- 默认英文界面，可在页面中切换中文。
- 支持 Singapore、Tioman、Bali、Maldives 四个海域。
- 显示未来潮汐日历、近 30 天鱼情榜单和单日详情。
- 支持底钓模式，重点显示 Grouper 和 Snapper 评分。
- 后端定时刷新数据，不依赖 Firebase 客户端。

## 数据来源和兜底规则

后端刷新数据时优先请求 Open-Meteo：

- Marine API：浪高、海表温度、海流速度、海流方向、海平面高度。
- Forecast / Archive API：风速和风向。

规则：

1. 当前和短期预测范围内，优先使用网上实时/预测数据。
2. 超出预测范围的数据，使用去年同期的真实历史数据作为参考。
3. 某些字段缺失时，逐字段用去年同期补齐。
4. 潮差缺失时，用月相估算潮汐强弱。

注意：这些分数只用于出海参考，不应替代当地海事天气、船长判断或安全预警。

## Windows Server 运行

项目放在服务器目录，例如：

```text
C:\PHPWeb\fish
```

安装依赖和注册计划任务：

```powershell
cd C:\PHPWeb\fish
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows\install.ps1
```

初始化数据：

```powershell
.\deploy\windows\refresh-data.ps1 -Initial
```

检查服务：

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

浏览器访问：

```text
http://fish.britesky.net:5173
```

更完整的 Windows Server 2016 部署步骤见：

```text
WINDOWS_SERVER_DEPLOY.md
```

## 更新服务器代码

如果只是更新前端：

```text
public/app.js
public/index.html
```

覆盖服务器对应文件后，浏览器执行 `Ctrl + F5` 强制刷新。

如果更新了后端：

```powershell
cd C:\PHPWeb\fish
Stop-ScheduledTask -TaskName "OceanFishing Node"
Start-ScheduledTask -TaskName "OceanFishing Node"
Start-Sleep -Seconds 5
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

如果更新了数据刷新逻辑：

```powershell
cd C:\PHPWeb\fish
.\deploy\windows\refresh-data.ps1 -Initial
```

## 关键文件

| 文件 | 说明 |
| --- | --- |
| `public/index.html` | H5 页面入口 |
| `public/app.js` | 前端渲染、语言切换、榜单和潮汐日历 |
| `server/index.js` | Node.js API、数据刷新和评分逻辑 |
| `server/data/dailyStats.json` | 服务器本地生成的数据文件，不提交到 Git |
| `deploy/windows/install.ps1` | Windows 安装和计划任务注册 |
| `deploy/windows/refresh-data.ps1` | 定时刷新海况/天气数据 |
| `WINDOWS_SERVER_DEPLOY.md` | Windows Server 2016 详细部署说明 |
