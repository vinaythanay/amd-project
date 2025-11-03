#!/bin/bash

# AMD Telephony App Setup Script

echo "🚀 Setting up AMD Telephony Application..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js found: $(node -v)"

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python 3 is not installed. ML service will not work."
else
    echo "✅ Python found: $(python3 --version)"
    echo "📦 Installing Python dependencies..."
    cd python-service
    pip install -r requirements.txt
    cd ..
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your credentials!"
else
    echo "✅ .env file exists"
fi

# Check Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker found"
    echo "🐳 Starting PostgreSQL container..."
    docker-compose up -d postgres
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
else
    echo "⚠️  Docker not found. Please set up PostgreSQL manually."
fi

# Run Prisma migrations
echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Twilio and API keys"
echo "2. Start the ML service: cd python-service && python app.py"
echo "3. Start Next.js: npm run dev"
echo ""
echo "Happy coding! 🎉"

