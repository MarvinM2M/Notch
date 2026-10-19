param(
    [string]$Action = "playpause",
    [double]$Position = -1
)

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
    
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    }
    
    if ($asTaskGeneric) {
        $managerAsync = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]::RequestAsync()
        $task = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($managerAsync))
        $null = $task.Wait(1500)
        $manager = $task.Result
        
        if ($manager) {
            $sessions = $manager.GetSessions()
            $session = $null
            
            if ($sessions -and $sessions.Count -gt 0) {
                # 1. Prioritize active music app (Spotify, etc.)
                $musicSession = $sessions | Where-Object {
                    $id = ($_.SourceAppUserModelId + "").ToLower()
                    ($id -like "*spotify*" -or $id -like "*apple*" -or $id -like "*tidal*" -or $id -like "*music*")
                } | Sort-Object -Descending {
                    $_.GetPlaybackInfo().PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
                } | Select-Object -First 1
                
                if ($musicSession) {
                    $session = $musicSession
                } else {
                    $session = $manager.GetCurrentSession()
                    if (-not $session) { $session = $sessions[0] }
                }
            }
            
            if ($session) {
                switch ($Action.ToLower()) {
                    "play" {
                        $op = $session.TryPlayAsync()
                        $t = $asTaskGeneric[0].MakeGenericMethod([bool]).Invoke($null, @($op))
                        $null = $t.Wait(1500)
                        if ($t.Result) { Write-Output "Played"; exit 0 }
                    }
                    "pause" {
                        $op = $session.TryPauseAsync()
                        $t = $asTaskGeneric[0].MakeGenericMethod([bool]).Invoke($null, @($op))
                        $null = $t.Wait(1500)
                        if ($t.Result) { Write-Output "Paused"; exit 0 }
                    }
                    "playpause" {
                        $pb = $session.GetPlaybackInfo()
                        if ($pb -and $pb.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing) {
                            $op = $session.TryPauseAsync()
                        } elseif ($pb -and $pb.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Paused) {
                            $op = $session.TryPlayAsync()
                        } else {
                            $op = $session.TryTogglePlayPauseAsync()
                        }
                        $t = $asTaskGeneric[0].MakeGenericMethod([bool]).Invoke($null, @($op))
                        $null = $t.Wait(1500)
                        if ($t.Result) { Write-Output "Toggled"; exit 0 }
                    }
                    "next" {
                        $op = $session.TrySkipNextAsync()
                        $t = $asTaskGeneric[0].MakeGenericMethod([bool]).Invoke($null, @($op))
                        $null = $t.Wait(1500)
                        if ($t.Result) { Write-Output "Next"; exit 0 }
                    }
                    "prev" {
                        $op = $session.TrySkipPreviousAsync()
                        $t = $asTaskGeneric[0].MakeGenericMethod([bool]).Invoke($null, @($op))
                        $null = $t.Wait(1500)
                        if ($t.Result) { Write-Output "Prev"; exit 0 }
                    }
                    "seek" {
                        if ($Position -ge 0) {
                            $ticks = [long]($Position * 10000000)
                            $op = $session.TryChangePlaybackPositionAsync($ticks)
                            $t = $asTaskGeneric[0].MakeGenericMethod([bool]).Invoke($null, @($op))
                            $null = $t.Wait(1500)
                            if ($t.Result) { Write-Output "Seeked"; exit 0 }
                        }
                    }
                }
            }
        }
    }
} catch {}

# Fallback: Virtual Key Media Event using keybd_event
try {
    $vk = 0xB3 # Play/Pause
    if ($Action -eq "next") { $vk = 0xB0 }
    elseif ($Action -eq "prev") { $vk = 0xB1 }
    
    $csharp = @"
using System;
using System.Runtime.InteropServices;
public class NativeMediaControl {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static void Send(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        keybd_event(vk, 0, 2, UIntPtr.Zero);
    }
}
"@
    Add-Type -TypeDefinition $csharp -ErrorAction SilentlyContinue
    [NativeMediaControl]::Send($vk)
    Write-Output "KeybdSent"
} catch {}
