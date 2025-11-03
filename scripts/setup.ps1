# AMD Telephony App Setup Script (PowerShell)

Write-Host "🚀 Setting up AMD Telephony Application..." -ForegroundColor Green

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js found: $(node -v)" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Yellow
npm install

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Python 3 is not installed. ML service will not work." -ForegroundColor Yellow
} else {
    Write-Host "✅ Python found: $(python --version)" -ForegroundColor Green
    Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
    Set-Location python-service
    pip install -r requirements.txt
    Set-Location ..
}

# Check for .env file
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "⚠️  Please edit .env file with your credentials!" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file exists" -ForegroundColor Green
}

# Check Docker
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "✅ Docker found" -ForegroundColor Green
    Write-Host "🐳 Starting PostgreSQL container..." -ForegroundColor Yellow
    docker-compose up -d postgres
    
    Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "⚠️  Docker not found. Please set up PostgreSQL manually." -ForegroundColor Yellow
}

# Run Prisma migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Yellow
npx prisma migrate dev --name init

Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your Twilio and API keys"
Write-Host "2. Start the ML service: cd python-service && python app.py"
Write-Host "3. Start Next.js: npm run dev"
Write-Host ""
Write-Host "Happy coding! 🎉" -ForegroundColor Green

