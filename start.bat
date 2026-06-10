@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   Metapharsic ERP - Startup Script
echo ==========================================

:: 1. Environment Setup
echo [1/4] Setting up environment...

if not exist .env (
    if exist .env.example (
        echo [INFO] Creating root .env from .env.example...
        copy .env.example .env
    )
)

if not exist server\.env (
    if exist server\.env.example (
        echo [INFO] Creating server .env from server\.env.example...
        copy server\.env.example server\.env
    ) else if exist .env.example (
        echo [INFO] Creating server .env from root .env.example...
        copy .env.example server\.env
    )
)

:: 2. Dependencies
echo [2/4] Checking dependencies...

if not exist node_modules (
    echo [INFO] Installing root dependencies...
    call npm install --silent
)

if not exist server\node_modules (
    echo [INFO] Installing server dependencies...
    cd server
    call npm install --silent
    cd ..
)

:: 3. Database Health Check
echo [3/4] Checking database status...
if exist server\db_health.cjs (
    node server\db_health.cjs
) else (
    echo [WARN] db_health.cjs not found, skipping check.
)

:: 4. Execution
echo [4/4] Launching services...

echo [INFO] Starting Backend Server in new window...
start "ERP Backend" cmd /c "cd server && npm start"

echo [INFO] Starting Frontend (Vite) in new window...
start "ERP Frontend" cmd /c "npm run dev"

echo.
echo ==========================================
echo   ERP IS STARTING!
echo ==========================================
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:5173
echo ==========================================
echo.
echo Press any key to exit this script (services will continue running).
pause > nul
