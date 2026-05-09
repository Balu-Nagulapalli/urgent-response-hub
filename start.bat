@echo off
REM Quick Start Script for Urgent Response Hub
REM This script starts both frontend and backend servers

echo.
echo ========================================
echo   Urgent Response Hub - Quick Start
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Install dependencies if needed
echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install --legacy-peer-deps
    if errorlevel 1 (
        echo Failed to install root dependencies
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
    if errorlevel 1 (
        echo Failed to install backend dependencies
        pause
        exit /b 1
    )
)

echo.
echo [2/4] Dependencies ready!
echo.

REM Start servers
echo [3/4] Starting servers...
echo.
echo ========================================
echo   IMPORTANT: Two terminals will open
echo   Terminal 1: Frontend (Port 8080)
echo   Terminal 2: Backend (Port 5000)
echo ========================================
echo.

timeout /t 2 /nobreak

REM Start Backend Server in new terminal
echo [4/4] Starting Backend Server on Port 5000...
start cmd /k "cd backend && npm start"

timeout /t 3 /nobreak

REM Start Frontend Server in new terminal
echo Starting Frontend Server on Port 8080...
start cmd /k "npm run dev"

echo.
echo ========================================
echo   ✅ Servers Starting!
echo ========================================
echo.
echo   Frontend: http://localhost:8080
echo   Backend:  http://localhost:5000
echo.
echo   Press ENTER to open application...
echo.
pause

REM Open browser
start http://localhost:8080

echo.
echo ✅ Application opened in browser!
echo.
echo   Features:
echo   - Report Incident with Voice Input
echo   - GPS Location Tracking
echo   - Real-time Status Tracking
echo.
echo   Keep both terminal windows open while using the app.
echo.
pause
