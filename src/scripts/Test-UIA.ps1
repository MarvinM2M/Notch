Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$proc = Get-Process chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $proc) {
    Write-Output "No Chrome/Edge window found"
    exit
}

Write-Output "Browser: $($proc.ProcessName) | Title: $($proc.MainWindowTitle)"
$root = [System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle)

# Search for TabItems in Chrome
$propCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::TabItem
)

$tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $propCondition)
Write-Output "Tabs count: $($tabs.Count)"
foreach ($t in $tabs) {
    Write-Output "TAB: $($t.Current.Name)"
}
