@echo off
echo 🚀 Starting Cladhunter API Server...
echo.

REM Check if .env exists
if not exist .env (
    echo ⚠️  .env file not found!
    echo 📝 Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo ⚙️  Please edit server\.env and add your DATABASE_URL from Neon
    echo    Get it from: https://console.neon.tech
    echo.
    exit /b 1
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Check if DATABASE_URL is configured
findstr /C:"DATABASE_URL=postgresql://" .env >nul
if errorlevel 1 (
    echo ❌ DATABASE_URL not configured in .env
    echo    Please add your Neon connection string
    echo.
    exit /b 1
)

echo ✅ Configuration looks good!
echo.
echo 🔄 Running migrations...
call npm run migrate

if %errorlevel% equ 0 (
    echo.
    echo ✅ Migrations completed!
    echo.
    echo 🚀 Starting server on port 3001...
    call npm run dev
) else (
    echo.
    echo ❌ Migration failed. Please check your DATABASE_URL
    exit /b 1
)
