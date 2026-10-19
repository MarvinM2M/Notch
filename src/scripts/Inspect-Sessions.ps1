Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}

$managerAsync = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]::RequestAsync()
$task = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($managerAsync))
$null = $task.Wait(2000)
$manager = $task.Result

$sessions = $manager.GetSessions()
Write-Output "Found $($sessions.Count) sessions:"
foreach ($s in $sessions) {
    $info = $s.GetPlaybackInfo()
    $propsAsync = $s.TryGetMediaPropertiesAsync()
    $pTask = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($propsAsync))
    $null = $pTask.Wait(2000)
    $props = $pTask.Result
    
    $timeline = $s.GetTimelineProperties()
    Write-Output "---"
    Write-Output "AppId: $($s.SourceAppUserModelId)"
    Write-Output "Status: $($info.PlaybackStatus)"
    Write-Output "Title: $($props.Title)"
    Write-Output "Artist: $($props.Artist)"
    Write-Output "Thumbnail: $(if ($props.Thumbnail) { 'YES' } else { 'NO' })"
    if ($timeline) {
        Write-Output "Position: $($timeline.Position.TotalSeconds)"
        Write-Output "EndTime: $($timeline.EndTime.TotalSeconds)"
        Write-Output "LastUpdatedTime: $($timeline.LastUpdatedTime)"
    }
}
