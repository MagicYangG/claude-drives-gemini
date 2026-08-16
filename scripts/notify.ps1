# 轻量桌面气泡通知,无第三方依赖。无人值守时任务完成提醒用户。
# 用法: powershell -ExecutionPolicy Bypass -File notify.ps1 "标题" "正文"
param([string]$Title = "Gemini Studio", [string]$Body = "任务完成")
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.Visible = $true
$n.ShowBalloonTip(8000, $Title, $Body, [System.Windows.Forms.ToolTipIcon]::Info)
Start-Sleep -Seconds 6
$n.Dispose()
