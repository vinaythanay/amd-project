# Add Windows Defender Exclusion for ngrok
# Note: This script requires Administrator privileges

Write-Host "=== Adding Windows Defender Exclusion for ngrok ===" -ForegroundColor Cyan
Write-Host ""

$ngrokDir = "$env:USERPROFILE\ngrok"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[WARNING] This script needs Administrator privileges" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To add the exclusion manually:" -ForegroundColor Yellow
    Write-Host "1. Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor White
    Write-Host "2. Run: Add-MpPreference -ExclusionPath '$ngrokDir'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "OR use Windows Security UI:" -ForegroundColor Yellow
    Write-Host "1. Open Windows Security" -ForegroundColor White
    Write-Host "2. Virus & threat protection -> Manage settings" -ForegroundColor White
    Write-Host "3. Exclusions -> Add or remove exclusions -> Add an exclusion -> Folder" -ForegroundColor White
    Write-Host "4. Select: $ngrokDir" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if exclusion already exists
    try {
        $exclusions = Get-MpPreference | Select-Object -ExpandProperty ExclusionPath -ErrorAction SilentlyContinue
        if ($exclusions -contains $ngrokDir) {
            Write-Host "[INFO] Exclusion may already exist, but script needs admin to verify" -ForegroundColor Cyan
        }
    }
    catch {
        Write-Host "[INFO] Cannot check exclusions without admin rights" -ForegroundColor Yellow
    }
    
    exit 1
}

# Add exclusion
Write-Host "[1/2] Adding exclusion for: $ngrokDir" -ForegroundColor Yellow
try {
    Add-MpPreference -ExclusionPath $ngrokDir
    Write-Host "[OK] Exclusion added successfully!" -ForegroundColor Green
}
catch {
    Write-Host "[WARNING] Error adding exclusion: $_" -ForegroundColor Yellow
    Write-Host "The exclusion may already exist, or there was an issue." -ForegroundColor Yellow
}

# Verify exclusion
Write-Host "[2/2] Verifying exclusion..." -ForegroundColor Yellow
try {
    $exclusions = Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
    if ($exclusions -contains $ngrokDir) {
        Write-Host "[OK] Exclusion verified!" -ForegroundColor Green
        Write-Host ""
        Write-Host "ngrok folder is now excluded from Windows Defender scanning." -ForegroundColor Cyan
    }
    else {
        Write-Host "[WARNING] Exclusion not found in list" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[ERROR] Could not verify exclusion" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restore ngrok.exe from Windows Defender Protection history" -ForegroundColor White
Write-Host "2. Test ngrok: $ngrokDir\ngrok.exe version" -ForegroundColor Cyan

