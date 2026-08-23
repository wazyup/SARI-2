@echo off
title SARI 2 - Smart Store Manager
color 0b

echo =========================================================
echo               SARI 2 - SMART STORE MANAGER
echo               Local PWA ^& Predictive Engine
echo =========================================================
echo.

:: Navigate to script directory
cd /d "%~dp0"

:: 1. Verify Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: 2. Verify Python is installed
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Python not detected in PATH.
    echo System will use internal TypeScript analytics engine fallback.
) else (
    echo [OK] Python analytics engine available.
)

:: 3. Check for dependencies
if not exist "node_modules" (
    echo [INFO] Installing required dependencies...
    call npm install
)

:: 4. Check for SQLite database file
if not exist "prisma\dev.db" (
    echo [INFO] Setting up local SQLite database and seeding default data...
    call npx prisma db push --force-reset
    call npx prisma db seed
)

:: 5. Open browser in the background after 3 seconds
start "" powershell -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"

:: 6. Start the server
echo.
echo [OK] Launching SARI 2 on http://localhost:3000 ...
echo [INFO] Close this window to stop the server.
echo.

call npm run start
if %ERRORLEVEL% neq 0 (
    echo [INFO] Production build not found. Starting in development mode...
    call npm run dev
)

pause
