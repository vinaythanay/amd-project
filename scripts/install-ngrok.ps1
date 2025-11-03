# ngrok Installation Script
# Handles Windows Defender blocking issue

Write-Host "=== ngrok Installation Script ===" -ForegroundColor Cyan
Write-Host ""

$ngrokDir = "$env:USERPROFILE\ngrok"
$zipPath = "$env:TEMP\ngrok.zip"
$exePath = "$ngrokDir\ngrok.exe"

# Step 1: Download
Write-Host "[1/4] Downloading ngrok..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile $zipPath
    Write-Host "[OK] Download complete" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Download failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Create directory
Write-Host "[2/4] Creating directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $ngrokDir | Out-Null
Write-Host "[OK] Directory created" -ForegroundColor Green

# Step 3: Extract
Write-Host "[3/4] Extracting ngrok..." -ForegroundColor Yellow
Write-Host "[WARNING] Windows Defender may block this - if so, see instructions below" -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $ngrokDir -Force
    Write-Host "[OK] Extraction complete" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Extraction blocked by Windows Defender" -ForegroundColor Red
    Write-Host ""
    Write-Host "=== ACTION REQUIRED ===" -ForegroundColor Red
    Write-Host '1. Open Windows Security (Windows Defender)'
    Write-Host '2. Go to: Virus and threat protection -> Protection history'
    Write-Host '3. Find the ngrok.exe threat and click Actions -> Restore'
    Write-Host '4. Add an exception: Virus and threat protection -> Manage settings -> Exclusions'
    Write-Host "5. Add folder exclusion for: $ngrokDir"
    Write-Host ""
    Write-Host "After restoring, run this script again or manually extract:"
    Write-Host "  Expand-Archive -Path $zipPath -DestinationPath $ngrokDir -Force" -ForegroundColor Cyan
    exit 1
}

# Step 4: Verify
Write-Host "[4/4] Verifying installation..." -ForegroundColor Yellow
if (Test-Path $exePath) {
    Write-Host "[OK] ngrok installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Location: $exePath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To use ngrok, run:" -ForegroundColor Yellow
    Write-Host "  $exePath http 3004" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or add to PATH to use 'ngrok' command globally." -ForegroundColor Yellow
}
else {
    Write-Host "[ERROR] ngrok.exe not found - may have been quarantined" -ForegroundColor Red
    Write-Host "Check Windows Defender Protection history" -ForegroundColor Yellow
    exit 1
}

# Cleanup
Remove-Item $zipPath -ErrorAction SilentlyContinue
