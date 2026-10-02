# DEV PATH V5 - abre as duas telas (chamado pelo INICIAR.bat)
#  - TV (segunda tela via HDMI, modo "Estender"): apresentacao em tela cheia (kiosk)
#  - Notebook (tela principal): painel do operador
# Sem segunda tela, abre a apresentacao normalmente no notebook.

# O servidor grava em data\.porta a porta que conseguiu abrir (8787 ou a proxima livre).
# Usamos 127.0.0.1 e confirmamos que quem responde e o DEV PATH, nao outro programa
# (ex.: o AdGuard Home ocupa a porta 3000).
$portFile = Join-Path $PSScriptRoot "data\.porta"
$base = $null
for ($i = 0; $i -lt 60 -and -not $base; $i++) {
  Start-Sleep -Milliseconds 300
  if (Test-Path $portFile) {
    $port = (Get-Content $portFile -Raw).Trim()
    try {
      $info = Invoke-WebRequest "http://127.0.0.1:$port/api/info" -UseBasicParsing -TimeoutSec 1
      if ($info.Content -match 'mobileUrl') { $base = "http://127.0.0.1:$port" }
    } catch {}
  }
}
if (-not $base) {
  Write-Host "  O servidor do DEV PATH nao respondeu. Veja a mensagem na janela preta do servidor."
  Read-Host "  Enter para fechar"
  exit 1
}

# Chrome ou Edge
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

Add-Type -AssemblyName System.Windows.Forms
$tv = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1

if ($browser -and $tv) {
  $x = $tv.Bounds.X + 50; $y = $tv.Bounds.Y + 50
  # perfil separado = janela independente, que abre direto em tela cheia na TV
  $profile = Join-Path $env:TEMP "devpath-tv"
  Start-Process $browser -ArgumentList @(
    "--user-data-dir=`"$profile`"", "--new-window", "--window-position=$x,$y", "--kiosk",
    "--no-first-run", "--no-default-browser-check", "--disable-session-crashed-bubble", "--noerrdialogs",
    "$base/"
  )
  Write-Host "  Apresentacao aberta na TV (tela $($tv.DeviceName)). Para fechar: clique nela e Alt+F4."
} else {
  Start-Process "$base/"
  if (-not $tv) { Write-Host "  Segunda tela nao encontrada. Ligue o HDMI, aperte Windows+P e escolha 'Estender'." }
}

Start-Sleep -Seconds 1
Start-Process "$base/operador"
