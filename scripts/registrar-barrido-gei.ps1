# Registra (o actualiza) la tarea "LUE - Barrido GEI" en el Programador de tareas de Windows:
# el día 5 de cada mes a las 08:00 abre la ventana del barrido, que pide usuario y contraseña del GEI.
# Si la PC está apagada ese día, se abre apenas se inicia sesión.
#
# Uso (una sola vez por computadora):  powershell -ExecutionPolicy Bypass -File scripts\registrar-barrido-gei.ps1
# Para quitarla:                       schtasks /Delete /TN "LUE - Barrido GEI" /F

$nombre = "LUE - Barrido GEI"
$script = Join-Path $PSScriptRoot "gei-barrido.ps1"

schtasks.exe /Create /TN $nombre /SC MONTHLY /D 5 /ST 08:00 /TR "powershell.exe" /F | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "No se pudo crear la tarea." -ForegroundColor Red; exit 1 }

$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
Set-ScheduledTask -TaskName $nombre -Action $accion -Settings $ajustes | Out-Null

$t = Get-ScheduledTask -TaskName $nombre
Write-Host "Tarea registrada: $nombre" -ForegroundColor Green
Write-Host ("Próxima ejecución: " + (Get-ScheduledTaskInfo -TaskName $nombre).NextRunTime)