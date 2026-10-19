<#
.SYNOPSIS
    Queries Windows GSMTC for active media session, friendly app name, track info, exact timeline position, and thumbnail.
#>

$assetsDir = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "assets"
if (-not (Test-Path $assetsDir)) {
    $assetsDir = Join-Path (Get-Location) "assets"
}
$thumbFile = Join-Path $assetsDir "current_thumb.jpg"

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
    
    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    }
    
    if (-not $asTaskGeneric) {
        exit 0
    }
    
    $managerAsync = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]::RequestAsync()
    $task = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($managerAsync))
    $null = $task.Wait(2000)
    $manager = $task.Result
    
    if ($manager) {
        $sessions = $manager.GetSessions()
        $session = $null
        
        if ($sessions -and $sessions.Count -gt 0) {
            # 1. Dedicated music apps (Spotify, Apple Music, etc.) always take top priority!
            # Prefer playing music app first, then paused music app
            $musicApp = $sessions | Where-Object {
                $id = ($_.SourceAppUserModelId + "").ToLower()
                $id -like "*spotify*" -or $id -like "*apple*" -or $id -like "*tidal*" -or $id -like "*music*"
            } | Sort-Object -Descending {
                $_.GetPlaybackInfo().PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
            } | Select-Object -First 1

            if ($musicApp) {
                $session = $musicApp
            } else {
                # 2. If no dedicated music app, find any active playing session (e.g. Browser)
                $anyPlaying = $sessions | Where-Object {
                    $_.GetPlaybackInfo().PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
                } | Select-Object -First 1
                
                if ($anyPlaying) {
                    $session = $anyPlaying
                } else {
                    $session = $manager.GetCurrentSession()
                    if (-not $session) {
                        $session = $sessions[0]
                    }
                }
            }
        }
        
        if ($session) {
            # 1. Playback status
            $playbackInfo = $session.GetPlaybackInfo()
            $isPlaying = ($playbackInfo -and $playbackInfo.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing)
            
            # 2. Timeline properties (exact Position & Duration)
            $position = 0
            $duration = 0
            try {
                $timeline = $session.GetTimelineProperties()
                if ($timeline) {
                    $posSec = $timeline.Position.TotalSeconds
                    $durSec = $timeline.EndTime.TotalSeconds
                    
                    if ($isPlaying -and $timeline.LastUpdatedTime) {
                        $elapsed = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime.ToUniversalTime()).TotalSeconds
                        if ($elapsed -gt 0 -and $elapsed -lt 7200) {
                            $posSec += $elapsed
                        }
                    }
                    
                    if ($durSec -gt 0) {
                        $position = [Math]::Round([Math]::Min($posSec, $durSec), 2)
                        $duration = [Math]::Round($durSec, 1)
                    } else {
                        $position = [Math]::Round($posSec, 2)
                        $duration = 0
                    }
                }
            } catch {}
            
            # 3. App Name resolution
            $appId = $session.SourceAppUserModelId
            $appName = "Music"
            if ($appId) {
                $lowerApp = $appId.ToLower()
                if ($lowerApp -like "*spotify*") { $appName = "Spotify" }
                elseif ($lowerApp -like "*chrome*") { $appName = "Chrome" }
                elseif ($lowerApp -like "*brave*") { $appName = "Brave" }
                elseif ($lowerApp -like "*msedge*" -or $lowerApp -like "*edge*") { $appName = "Edge" }
                elseif ($lowerApp -like "*firefox*") { $appName = "Firefox" }
                elseif ($lowerApp -like "*vlc*") { $appName = "VLC" }
                elseif ($lowerApp -like "*apple*") { $appName = "Apple Music" }
                else {
                    $appName = [System.IO.Path]::GetFileNameWithoutExtension($appId)
                }
            }
            
            # 4. Media Properties (Title, Artist, Album, Thumbnail)
            $propsAsync = $session.TryGetMediaPropertiesAsync()
            $pTask = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($propsAsync))
            $null = $pTask.Wait(2000)
            $props = $pTask.Result
            
            if ($props -and $props.Title) {
                $hasThumb = $false
                $thumbBase64 = ""
                
                if ($props.Thumbnail) {
                    try {
                        $thumbAsync = $props.Thumbnail.OpenReadAsync()
                        $tTask = $asTaskGeneric[0].MakeGenericMethod([Windows.Storage.Streams.IRandomAccessStreamWithContentType]).Invoke($null, @($thumbAsync))
                        $null = $tTask.Wait(2000)
                        $raStream = $tTask.Result
                        
                        if ($raStream) {
                            $asStreamMethod = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object {
                                $_.Name -eq 'AsStream' -and $_.GetParameters().Count -eq 1
                            } | Select-Object -First 1
                            
                            $dotNetStream = $asStreamMethod.Invoke($null, @($raStream))
                            $mem = New-Object System.IO.MemoryStream
                            $dotNetStream.CopyTo($mem)
                            $bytes = $mem.ToArray()
                            
                            if ($bytes.Length -gt 0) {
                                [System.IO.File]::WriteAllBytes($thumbFile, $bytes)
                                $b64Str = [Convert]::ToBase64String($bytes)
                                $thumbBase64 = "data:image/jpeg;base64,$b64Str"
                                $hasThumb = $true
                            }
                            $mem.Dispose()
                            $dotNetStream.Dispose()
                        }
                    } catch {}
                }
                
                $result = [PSCustomObject]@{
                    hasMedia    = $true
                    playing     = $isPlaying
                    app         = $appName
                    title       = $props.Title
                    artist      = $props.Artist
                    album       = $props.AlbumTitle
                    hasThumb    = $hasThumb
                    thumbBase64 = $thumbBase64
                    position    = $position
                    duration    = $duration
                }
                $result | ConvertTo-Json -Compress
                exit 0
            }
        }
    }
} catch {}

# Fallback when no media is actively streaming
$fallback = [PSCustomObject]@{
    hasMedia    = $false
    playing     = $false
    app         = "Paper Sky"
    title       = "Paper Sky"
    artist      = "Lumen Coast"
    album       = "Summer Flows"
    hasThumb    = $false
    thumbBase64 = ""
    position    = 193
    duration    = 256
}
$fallback | ConvertTo-Json -Compress
