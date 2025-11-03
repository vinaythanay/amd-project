# 🚀 How to Run - Step by Step

## Quick Start (All-in-One)

### Step 1: Start Database

**Option A: Using Docker (if Docker Desktop is running)**
```powershell
# Start Docker Desktop first, then:
docker-compose up -d postgres
```

**Option B: Using Existing PostgreSQL**
If you already have PostgreSQL running, just make sure the connection string in `.env` is correct:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/amd_telephony?schema=public"
```

### Step 2: Run Database Migrations
```powershell
npx prisma migrate dev --name init
npx prisma generate
```

### Step 3: Start Python ML Service
```powershell
# Open a NEW terminal window
cd python-service
pip install -r requirements.txt
python app.py
```

### Step 4: Start Next.js App
```powershell
# In the original terminal (keep Python service running)
npm run dev
```

### Step 5: Open Browser
Go to: http://localhost:3000

---

## Detailed Instructions

### Prerequisites Check ✅
- ✅ Node.js v22.11.0 (installed)
- ✅ Python 3.11.8 (installed)
- ✅ Docker 28.2.2 (installed, but Desktop may not be running)

### What You Need to Do:

1. **Start Docker Desktop** (if using Docker)
   - Open Docker Desktop application
   - Wait for it to start completely
   - Then run: `docker-compose up -d postgres`

2. **Or Use Local PostgreSQL**
   - Make sure PostgreSQL is running
   - Update `.env` with your local PostgreSQL credentials

3. **Update .env File**
   Make sure these are set correctly:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/amd_telephony?schema=public"
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
   BETTER_AUTH_SECRET=any-random-string-here
   BETTER_AUTH_URL=http://localhost:3000
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=any-random-string-here
   ML_SERVICE_URL=http://localhost:8000
   ```

4. **Run Migrations**
   ```powershell
   npx prisma migrate dev
   ```

5. **Start Services** (in separate terminals)

   **Terminal 1 - Python Service:**
   ```powershell
   cd python-service
   pip install -r requirements.txt
   python app.py
   ```

   **Terminal 2 - Next.js:**
   ```powershell
   npm run dev
   ```

6. **Access Application**
   - Open browser: http://localhost:3000
   - Register a new account
   - Start testing!

---

## Troubleshooting

### If Docker Won't Start:
1. Open Docker Desktop manually
2. Wait for "Docker Desktop is running" message
3. Try `docker-compose up -d postgres` again

### If PostgreSQL Connection Fails:
1. Check if PostgreSQL service is running:
   ```powershell
   # Windows: Check Services
   Get-Service -Name "*postgres*"
   ```
2. Update DATABASE_URL in `.env` with correct credentials
3. Make sure database `amd_telephony` exists

### If Python Service Fails:
```powershell
# Install dependencies
cd python-service
pip install -r requirements.txt

# If PyTorch fails, use CPU version:
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### If Port 3000 is Busy:
```powershell
# Use different port
npm run dev -- -p 3001
# Update .env: NEXTAUTH_URL=http://localhost:3001
```

---

## Testing Checklist

Once running:
- [ ] Register a new user account
- [ ] Login successfully
- [ ] See dial interface
- [ ] Select AMD strategy
- [ ] Test dial with voicemail number: `+18007742678`
- [ ] Check call history tab
- [ ] Export call history to CSV

---

## Current Status Commands

```powershell
# Check if services are running
docker ps                    # Check Docker containers
Get-Process -Name node       # Check Node.js
Get-Process -Name python     # Check Python

# Check ports
netstat -ano | findstr :3000   # Check Next.js
netstat -ano | findstr :8000   # Check Python service
netstat -ano | findstr :5432   # Check PostgreSQL
```

---

Ready to start? Follow the steps above! 🎉

