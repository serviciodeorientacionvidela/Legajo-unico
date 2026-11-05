# Barrido del GEI: descarga e importa matrícula, asistencia, notas del ciclo, fichas, trayectoria
# y alertas (npm run gei:scrape). Pide usuario y contraseña del GEI en el momento: no se guardan
# en ningún archivo, solo viven en la memoria de esta ventana mientras dura el barrido.
#
# Se abre con doble clic en "Barrido GEI.cmd" (raíz del proyecto) o desde la tarea mensual
# (scripts/registrar-barrido-gei.ps1). Deja un registro en logs\gei y un aviso en el sistema.

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$Host.UI.RawUI.WindowTitle = "Barrido GEI · Legajo Único Escolar"

function Pausa([string]$texto = "Presione Enter para cerrar") { [void](Read-Host $texto) }

Write-Host ""
Write-Host "  BARRIDO GEI · Legajo Único Escolar" -ForegroundColor Cyan
Write-Host "  Actualiza notas, asistencia, matrícula, fichas y alertas desde el GEI." -ForegroundColor Gray
Write-Host ""

# 1. Requisitos de esta computadora.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Falta Node.js. Instálelo desde https://nodejs.org (versión LTS) y vuelva a abrir." -ForegroundColor Red
  Pausa; exit 1
}
if (-not (Test-Path (Join-Path $raiz ".env.local"))) {
  Write-Host "  Falta el archivo .env.local con la conexión a la base (DATABASE_URL) y la clave de Google." -ForegroundColor Red
  Write-Host "  Pídalo a la administración del sistema y cópielo en: $raiz" -ForegroundColor Red
  Pausa; exit 1
}
if (-not (Test-Path (Join-Path $raiz "node_modules"))) {
  Write-Host "  Primera vez en esta computadora: instalando dependencias (puede tardar unos minutos)..." -ForegroundColor Yellow
  cmd.exe /c "npm install"
  cmd.exe /c "npx playwright install chromium"
}

# 2. Credenciales del GEI (no se guardan).
$usuario = Read-Host "  Usuario del GEI (intranet DGE)"
if ([string]::IsNullOrWhiteSpace($usuario)) { Write-Host "  Sin usuario: se cancela." -ForegroundColor Red; Pausa; exit 1 }
$segura = Read-Host "  Contraseña del GEI" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
try { $clave = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ([string]::IsNullOrEmpty($clave)) { Write-Host "  Sin contraseña: se cancela." -ForegroundColor Red; Pausa; exit 1 }

$email = Read-Host "  Email de su cuenta del LUE (Enter = el configurado en .env.local)"

# Solo para este proceso y los que lance; dotenv no las reemplaza con lo que diga .env.local.
$env:GEI_USER = $usuario.Trim()
$env:GEI_PASS = $clave
if (-not [string]::IsNullOrWhiteSpace($email)) { $env:GEI_SYNC_USER_EMAIL = $email.Trim() }
Remove-Variable clave, segura

# 3. Registro.
$carpetaLogs = Join-Path $raiz "logs\gei"
New-Item -ItemType Directory -Force -Path $carpetaLogs | Out-Null
$log = Join-Path $carpetaLogs ("barrido-" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".log")
Add-Content -Path $log -Encoding UTF8 -Value ("Barrido iniciado " + (Get-Date -Format "yyyy-MM-dd HH:mm") + " por " + $env:USERNAME)

# 4. Barrido. Las notas de ciclos anteriores no cambian: se omiten (más rápido).
Write-Host ""
Write-Host "  Barriendo el GEI. No cierre esta ventana (tarda entre 20 y 60 minutos)..." -ForegroundColor Yellow
cmd.exe /c "npm run gei:scrape -- --sin-historial 2>&1" | Tee-Object -FilePath $log -Append
$exito = ($LASTEXITCODE -eq 0)

# Borrar las credenciales de la memoria del proceso.
Remove-Item Env:GEI_PASS -ErrorAction SilentlyContinue
Remove-Item Env:GEI_USER -ErrorAction SilentlyContinue

# 5. Aviso en el sistema (lo ve Dirección al ingresar).
$modo = $(if ($exito) { "--ok" } else { "--error" })
cmd.exe /c "npx tsx scripts/aviso-barrido-gei.ts $modo `"$log`" 2>&1" | Tee-Object -FilePath $log -Append

# 6. Conservar solo los últimos 24 registros.
Get-ChildItem -Path $carpetaLogs -Filter "barrido-*.log" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 24 |
  Remove-Item -Force -Confirm:$false

Write-Host ""
if ($exito) {
  Write-Host "  Listo. Datos actualizados. Registro: $log" -ForegroundColor Green
} else {
  Write-Host "  El barrido terminó con errores. Revise el registro: $log" -ForegroundColor Red
  Write-Host "  Si fue la contraseña, vuelva a abrir y pruebe de nuevo." -ForegroundColor Red
}
Pausa
if (-not $exito) { exit 1 }
