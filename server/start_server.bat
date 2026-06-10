@echo off
setlocal

echo ==========================================
echo   Metapharsic ERP - Server Startup
echo ==========================================

:: Environment Setup
if not exist .env (
    if exist ..\.env.example (
        echo [INFO] Creating .env from ..\.env.example...
        copy ..\.env.example .env
    ) else (
        echo [WARN] .env.example not found.
    )
)

:: Dependencies
if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install
)

:: Start Server
echo [INFO] Starting Backend Server...
npm start
