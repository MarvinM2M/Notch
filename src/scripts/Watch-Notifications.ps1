[CmdletBinding()]
param()

$ErrorActionPreference = 'SilentlyContinue'

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
    
    if ($access -ne [Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]::Allowed) {
        Write-Output (ConvertTo-Json @{ error = "Access not allowed: $access" } -Compress)
        exit 1
    }

    # Track seen notification IDs to only report NEW incoming ones
    $seenIds = [System.Collections.Generic.HashSet[uint32]]::new()
    
    # Initialize with current notifications so we don't spam old ones on startup
    $initial = Invoke-WinRtAsync ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
    if ($initial) {
        foreach ($n in $initial) {
            $seenIds.Add($n.Id) | Out-Null
        }
    }
    Write-Output (ConvertTo-Json @{ ready = $true; tracked = $seenIds.Count } -Compress)

    while ($true) {
        Start-Sleep -Milliseconds 500
        $current = Invoke-WinRtAsync ($listener.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) ([System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]])
        if (-not $current) { continue }

        foreach ($n in $current) {
            if (-not $seenIds.Contains($n.Id)) {
                $seenIds.Add($n.Id) | Out-Null

                $appName = $n.AppInfo.DisplayInfo.DisplayName
                $appId = $n.AppInfo.Id

                # Ignore IDE terminal command authorization / clipboard toasts
                if ($appName -match "Antigravity" -or $appName -match "Snipping Tool") {
                    continue
                }

                $binding = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric)
                $texts = @()
                if ($binding) {
                    foreach ($t in $binding.GetTextElements()) {
                        if ($t.Text -and $t.Text.Trim()) { 
                            $texts += $t.Text.Trim() 
                        }
                    }
                }

                $fullContext = ("$appName $appId " + ($texts -join " ")).ToLower()
                
                # Determine App Category
                $appType = "generic"
                if ($fullContext -match "whatsapp") { 
                    $appType = "whatsapp" 
                } elseif ($fullContext -match "telegram") { 
                    $appType = "telegram" 
                } elseif ($fullContext -match "discord") { 
                    $appType = "discord" 
                } elseif ($fullContext -match "signal" -or $fullContext -match "teams" -or $fullContext -match "slack") {
                    $appType = "generic"
                }

                $sender = ""
                $message = ""
                if ($texts.Count -eq 1) {
                    $sender = if ($appType -ne "generic") { $appType.Substring(0,1).ToUpper() + $appType.Substring(1) } else { $appName }
                    $message = $texts[0]
                } elseif ($texts.Count -ge 2) {
                    $sender = $texts[0]
                    # Filter out browser URL if present in second position
                    if ($texts[1] -match "^(https?://|web\.)" -and $texts.Count -ge 3) {
                        $message = $texts[2]
                    } else {
                        $message = $texts[1]
                    }
                } else {
                    $sender = $appName
                    $message = "Pesan baru masuk"
                }

                $payload = @{
                    id = $n.Id
                    app = $appType
                    appName = $appName
                    sender = $sender
                    text = $message
                }
                Write-Output (ConvertTo-Json $payload -Compress)
            }
        }
    }
} catch {
    Write-Output (ConvertTo-Json @{ error = $_.Exception.Message } -Compress)
}
