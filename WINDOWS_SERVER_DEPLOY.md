# Windows Server 2016 部署说明

公开的 H5 网站由 `server/` 目录中的 Node.js API 提供服务。

Caddy 负责监听 `80` 和 `443` 端口，自动为 `fish.britesky.net` 申请及续期
HTTPS 证书，并将访问请求转发到本机 Node.js 服务：

```text
https://fish.britesky.net -> Caddy -> http://127.0.0.1:5173
```

## 一、部署前准备

1. 确认域名 `fish.britesky.net` 已解析到服务器公网 IP：`124.155.209.219`。
2. 在云服务器安全组、机房防火墙或路由器中开放 TCP 入站端口 `80` 和 `443`。
3. 从 <https://nodejs.org/en/download/> 下载并安装 x64 版本的 Node.js LTS MSI。
4. 将整个项目复制到 Windows Server。

Caddy 必须能够占用 `80` 和 `443` 端口。如果服务器已经运行 IIS 或其他网站
服务，需要先停止对应网站，或者将原有服务修改为其他端口。

打开 PowerShell，检查端口占用：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 80,443
```

如需查看具体占用端口的程序：

```powershell
Get-Process -Id (Get-NetTCPConnection -State Listen -LocalPort 80,443).OwningProcess
```

## 二、执行安装

在项目目录中，以管理员身份打开 Windows PowerShell，然后依次执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows\install.ps1
.\deploy\windows\refresh-data.ps1 -Initial
Invoke-RestMethod https://fish.britesky.net/api/health
```

最后一个命令正常返回类似以下内容，表示部署成功：

```text
ok         : True
dailyStats : 2900
```

安装脚本会自动完成以下工作：

| 任务 | 说明 |
| --- | --- |
| 下载 Caddy | 用于 HTTPS 证书申请、自动续期和反向代理 |
| 安装 Node.js 依赖 | 安装网站 API 所需的软件包 |
| 创建随机 `SEED_KEY` | 保护数据刷新接口，防止公网用户随意触发刷新 |
| 配置 Windows 防火墙 | 开放 TCP 入站端口 `80` 和 `443` |
| 注册计划任务 | 让服务开机自动启动，并每天刷新海况数据 |

安装完成后会创建三个 Windows 计划任务：

| 计划任务 | 用途 |
| --- | --- |
| `OceanFishing Node` | 开机启动 Node.js API，异常退出后自动重启 |
| `OceanFishing Caddy` | 开机启动 HTTPS 反向代理 |
| `OceanFishing Refresh` | 每天服务器时间 `02:10` 刷新海况数据 |

随机生成的管理密钥保存在：

```text
deploy/windows/.env
```

该文件已被 Git 忽略。不要公开此文件，也不要将 Node.js 的 `5173` 端口开放到
公网。

## 三、验证网站

在服务器上执行：

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health
Invoke-RestMethod https://fish.britesky.net/api/health
```

然后使用苹果手机或安卓手机打开：

```text
https://fish.britesky.net
```

手机应显示正常的 HTTPS 小锁标志，不应出现证书警告。

## 四、日常维护

手动刷新近期海况数据：

```powershell
.\deploy\windows\refresh-data.ps1
```

检查本机 Node.js 服务状态：

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

更新代码后重启 Node.js 服务：

```powershell
Stop-ScheduledTask -TaskName "OceanFishing Node"
Start-ScheduledTask -TaskName "OceanFishing Node"
```

重启 HTTPS 反向代理：

```powershell
Stop-ScheduledTask -TaskName "OceanFishing Caddy"
Start-ScheduledTask -TaskName "OceanFishing Caddy"
```

## 五、常见问题

### HTTPS 证书申请失败

检查以下项目：

1. 域名 `fish.britesky.net` 是否仍然解析到 `124.155.209.219`。
2. 云服务器安全组、机房防火墙或路由器是否允许公网访问 TCP 端口 `80` 和 `443`。
3. Windows 防火墙是否允许 TCP 端口 `80` 和 `443`。
4. IIS 或其他服务是否仍然占用 `80` 或 `443` 端口。

### Caddy 无法启动

检查端口占用：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 80,443
```

如果 IIS 占用端口，可以先停止 IIS：

```powershell
Stop-Service W3SVC
Set-Service W3SVC -StartupType Disabled
```

### 本机 API 正常，但手机无法打开网站

如果下面的本机命令能够正常返回：

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/health
```

但是手机无法访问 `https://fish.britesky.net`，通常是公网端口、安全组、路由器
端口映射或 Caddy 启动状态的问题。
