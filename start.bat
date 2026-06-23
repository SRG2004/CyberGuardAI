@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM  CyberGuard AI - Start All Services (Windows)
REM  Double-click this file or run: start.bat
REM  Args: start.bat backend / start.bat ml / start.bat frontend
REM ============================================================

title CyberGuard AI - Services
color 0A

echo.
echo ================================================
echo   [CyberGuard AI] Starting Services...
echo ================================================
echo.

set "ROOT_DIR=%~dp0"
set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "BACKEND=%ROOT_DIR%\backend"
set "ML=%ROOT_DIR%\ml-service"
set "FRONTEND=%ROOT_DIR%\cyberguard-ui"

REM ─── Parse argument ────────────────────────────────
set "MODE=all"
if not "%~1"=="" set "MODE=%~1"

REM ─── Check .env ───────────────────────────────────
if not exist "%ROOT_DIR%\.env" (
    echo [WARN] .env not found. Copying from .env.example...
    if exist "%ROOT_DIR%\.env.example" (
        copy /Y "%ROOT_DIR%\.env.example" "%ROOT_DIR%\.env" >nul
    )
    echo [WARN] Edit %ROOT_DIR%\.env with your API keys before using in production.
)
copy /Y "%ROOT_DIR%\.env" "%BACKEND%\.env" >nul

REM ─── Create required dirs ─────────────────────────
if not exist "%BACKEND%\logs" mkdir "%BACKEND%\logs"
if not exist "%BACKEND%\uploads" mkdir "%BACKEND%\uploads"
if not exist "%ML%\models" mkdir "%ML%\models"
if not exist "%ML%\data" mkdir "%ML%\data"

REM ─── Install backend deps ─────────────────────────
if not "%MODE%"=="ml" (
    if not exist "%BACKEND%\node_modules" (
        echo [INFO] Installing backend dependencies...
        cd /d "%BACKEND%"
        call npm install
        if errorlevel 1 (
            echo [ERROR] Backend npm install failed.
            pause
            exit /b 1
        )
    )
    cd /d "%ROOT_DIR%"
)

REM ─── Install ML deps ─────────────────────────────
if not "%MODE%"=="frontend" (
    python -c "import fastapi" 2>nul
    if errorlevel 1 (
        echo [INFO] Installing ML service dependencies...
        cd /d "%ML%"
        pip install -r requirements.txt --quiet
        if errorlevel 1 (
            echo [ERROR] ML pip install failed.
            pause
            exit /b 1
        )
        cd /d "%ROOT_DIR%"
    )
)

REM ─── Install frontend deps ───────────────────────
if not "%MODE%"=="backend" (
    if not exist "%FRONTEND%\node_modules" (
        echo [INFO] Installing frontend dependencies...
        cd /d "%FRONTEND%"
        call npm install
        if errorlevel 1 (
            echo [ERROR] Frontend npm install failed.
            pause
            exit /b 1
        )
        cd /d "%ROOT_DIR%"
    )
)

start "CyberGuard - Backend API" cmd /k "cd /d %BACKEND% && set NODE_ENV=development && node --watch src\server.js"
timeout /t 2 /nobreak >nul

if not "%MODE%"=="frontend" (
    start "CyberGuard - ML Service" cmd /k "cd /d %ML% && python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
    timeout /t 2 /nobreak >nul
)

if not "%MODE%"=="backend" (
    start "CyberGuard - Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"
)

echo.
echo ================================================
echo   All services started in separate windows!
echo ================================================
echo.
echo   Backend    -^> http://localhost:5000
echo   ML Service -^> http://localhost:8001
echo   Frontend   -^> http://localhost:5173
echo.
echo   Health:     http://localhost:5000/health
echo   ML Health:  http://localhost:8001/health
echo.
echo   Close each service window to stop it.
echo.
pause
