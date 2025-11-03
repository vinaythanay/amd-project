# Get ngrok URL and update .env file

Write-Host "=== Getting Your ngrok URL ===" -ForegroundColor Cyan
Write-Host ""

# Wait a bit for ngrok to start
Start-Sleep -Seconds 2

try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
    $httpsUrl = ($response.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1).public_url
    
    if ($httpsUrl) {
        Write-Host "[OK] Found your ngrok URL!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Your ngrok URL is:" -ForegroundColor Yellow
        Write-Host "  $httpsUrl" -ForegroundColor Cyan -BackgroundColor Black
        Write-Host ""
        
        # Update .env file
        Write-Host "Updating .env file..." -ForegroundColor Yellow
        $envContent = Get-Content .env -Raw
        $pattern = 'TWILIO_WEBHOOK_URL=https://your-ngrok-url-here\.ngrok-free\.app'
        $replacement = "TWILIO_WEBHOOK_URL=$httpsUrl"
        
        if ($envContent -match $pattern) {
            $newContent = $envContent -replace $pattern, $replacement
            Set-Content -Path .env -Value $newContent -NoNewline
            Write-Host "[OK] Updated .env file!" -ForegroundColor Green
        } else {
            Write-Host "[INFO] Could not find placeholder in .env. Please manually update:" -ForegroundColor Yellow
            Write-Host "  TWILIO_WEBHOOK_URL=$httpsUrl" -ForegroundColor Cyan
        }
        
        Write-Host ""
        Write-Host "Next step: Restart your Next.js server for changes to take effect." -ForegroundColor Yellow
    } else {
        Write-Host "[WARNING] ngrok is running but HTTPS URL not found" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[INFO] Cannot connect to ngrok API. ngrok may still be starting." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "How to find your ngrok URL:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Method 1: Check ngrok terminal window" -ForegroundColor White
    Write-Host "  Look for a line like:" -ForegroundColor Gray
    Write-Host "  Forwarding    https://xxxxx-xxxxx.ngrok-free.app -> http://localhost:3004" -ForegroundColor Green
    Write-Host ""
    Write-Host "Method 2: Open ngrok web interface" -ForegroundColor White
    Write-Host "  Visit: http://localhost:4040 in your browser" -ForegroundColor Cyan
    Write-Host "  Your public URL will be displayed there" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Once you have the URL, update .env:" -ForegroundColor Yellow
    Write-Host "  TWILIO_WEBHOOK_URL=https://your-actual-ngrok-url.ngrok-free.app" -ForegroundColor Cyan
}

