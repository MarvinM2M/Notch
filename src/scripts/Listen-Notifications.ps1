[CmdletBinding()]
param()

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    })[0]

    function Invoke-WinRtAsync($winRtTask, $resultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
        $netTask = $asTask.Invoke($null, @($winRtTask))
        $netTask.Wait(-1) | Out-Null
        return $netTask.Result
    }

    [Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $listener = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
    $access = Invoke-WinRtAsync ($listener.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus])
    Write-Output "ACCESS: $access"

    if ($access -eq [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed) {
        $notifs = Invoke-WinRtAsync ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
        Write-Output "COUNT: $($notifs.Count)"
        foreach ($n in ($notifs | Select-Object -Last 10)) {
            $appName = $n.AppInfo.DisplayInfo.DisplayName
            $appId = $n.AppInfo.Id
            $binding = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
            $texts = @()
            if ($binding) {
                foreach ($t in $binding.GetTextElements()) {
                    if ($t.Text) { $texts += $t.Text }
                }
            }
            $sender = if ($texts.Count -gt 0) { $texts[0] } else { $appName }
            $message = if ($texts.Count -gt 1) { $texts[1] } else { "" }
            Write-Output "NOTIF: ID=$($n.Id) | APP=$appName | SENDER=$sender | MSG=$message"
        }
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
