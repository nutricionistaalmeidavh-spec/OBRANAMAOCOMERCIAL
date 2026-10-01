$ErrorActionPreference = 'Stop'

$serviceName = 'ObraNaMaoServer'
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) { exit 0 }

if ($service.Status -ne 'Stopped') {
  Stop-Service -Name $serviceName -Force -ErrorAction Stop
  $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
}

exit 0
