Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
}

$managerAsync = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]::RequestAsync()
$task = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($managerAsync))
$null = $task.Wait(2000)
$manager = $task.Result

$sessions = $manager.GetSessions()
$spotify = $sessions | Where-Object { $_.SourceAppUserModelId -like '*spotify*' } | Select-Object -First 1

if ($spotify) {
    $propsAsync = $spotify.TryGetMediaPropertiesAsync()
    $pTask = $asTaskGeneric[0].MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($propsAsync))
    $null = $pTask.Wait(2000)
    $props = $pTask.Result
    Write-Output "Title: $($props.Title)"
    Write-Output "Artist: $($props.Artist)"
    
    if ($props.Thumbnail) {
        $thumbAsync = $props.Thumbnail.OpenReadAsync()
        $tTask = $asTaskGeneric[0].MakeGenericMethod([Windows.Storage.Streams.IRandomAccessStreamWithContentType]).Invoke($null, @($thumbAsync))
        $null = $tTask.Wait(2000)
        $raStream = $tTask.Result
        Write-Output "Stream Size: $($raStream.Size)"
        
        $asStreamMethod = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsStream' -and $_.GetParameters().Count -eq 1
        } | Select-Object -First 1
        
        $dotNetStream = $asStreamMethod.Invoke($null, @($raStream))
        $mem = New-Object System.IO.MemoryStream
        $dotNetStream.CopyTo($mem)
        $bytes = $mem.ToArray()
        Write-Output "Bytes length: $($bytes.Length)"
        
        $outPath = "c:\Users\COMPUTER\OneDrive\Documents\notch\assets\current_thumb.jpg"
        [System.IO.File]::WriteAllBytes($outPath, $bytes)
        Write-Output "Successfully wrote thumbnail to $outPath"
    } else {
        Write-Output "No thumbnail object in props"
    }
} else {
    Write-Output "Spotify session not found"
}
