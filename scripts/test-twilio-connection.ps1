# Test Twilio Connection
# This script tests if your Twilio credentials are working

Write-Host "=== Testing Twilio Connection ===" -ForegroundColor Cyan
Write-Host ""

# Load .env file
$envContent = Get-Content .env -Raw
$envVars = @{}
foreach ($line in ($envContent -split "`n")) {
    if ($line -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim() -replace '^["\'](.*)["\']$', '$1'
        $envVars[$key] = $value
    }
}

$accountSid = $envVars['TWILIO_ACCOUNT_SID']
$authToken = $envVars['TWILIO_AUTH_TOKEN']
$phoneNumber = $envVars['TWILIO_PHONE_NUMBER']

if (-not $accountSid) {
    Write-Host "[ERROR] TWILIO_ACCOUNT_SID not found in .env" -ForegroundColor Red
    exit 1
}

if (-not $authToken) {
    Write-Host "[ERROR] TWILIO_AUTH_TOKEN not found in .env" -ForegroundColor Red
    exit 1
}

Write-Host "Testing Twilio API connection..." -ForegroundColor Yellow

try {
    $uri = "https://$accountSid`:$authToken@api.twilio.com/2010-04-01/Accounts/$accountSid.json"
    $response = Invoke-RestMethod -Uri $uri -Method Get
    
    Write-Host "[OK] Twilio connection successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Account Details:" -ForegroundColor Cyan
    Write-Host "  Account SID: $($response.sid)" -ForegroundColor White
    Write-Host "  Account Name: $($response.friendly_name)" -ForegroundColor White
    Write-Host "  Status: $($response.status)" -ForegroundColor White
    
    if ($phoneNumber) {
        Write-Host ""
        Write-Host "Phone Number: $phoneNumber" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To test if this number can make calls:" -ForegroundColor Yellow
        Write-Host "1. Make sure the number is verified in Twilio Console" -ForegroundColor White
        Write-Host "2. Check if your Twilio account has calling capabilities enabled" -ForegroundColor White
        Write-Host "3. For trial accounts, you can only call verified numbers" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "[OK] Twilio credentials are valid!" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Twilio connection failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "1. Invalid Account SID or Auth Token" -ForegroundColor White
    Write-Host "2. Credentials may have been regenerated" -ForegroundColor White
    Write-Host "3. Account may be suspended" -ForegroundColor White
    Write-Host ""
    Write-Host "Check your credentials at: https://console.twilio.com/" -ForegroundColor Cyan
}

