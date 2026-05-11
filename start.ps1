#!/usr/bin/env pwsh
# Quick Start Script for Urgent Response Hub
# Run with: powershell -ExecutionPolicy Bypass -File start.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Urgent Response Hub - Quick Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

# Install root dependencies if needed
Write-Host "[1/4] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing root dependencies..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install root dependencies" -ForegroundColor Red
        Read-Host "Press ENTER to exit"
        exit 1
    }
}

# Install backend dependencies if needed
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Push-Location backend
    npm install
    Pop-Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install backend dependencies" -ForegroundColor Red
        Read-Host "Press ENTER to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "[2/4] Dependencies ready!" -ForegroundColor Green
Write-Host ""

# Start servers
Write-Host "[3/4] Starting servers..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   IMPORTANT: Two terminals will open" -ForegroundColor Cyan
Write-Host "   Terminal 1: Backend (Port 5000)" -ForegroundColor Cyan
Write-Host "   Terminal 2: Frontend (Port 8080)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 2

# Start Backend Server
Write-Host "[4/4] Starting Backend Server on Port 5000..." -ForegroundColor Yellow
$backendScript = {
    Set-Location backend
    npm start
}
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "$backendScript"

Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "Starting Frontend Server on Port 8080..." -ForegroundColor Yellow
$frontendScript = {
    npm run dev
}
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "$frontendScript"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   ✅ Servers Starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Frontend: http://localhost:8080" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Press ENTER to open application..." -ForegroundColor Yellow
Write-Host ""
Read-Host

# Open browser
Start-Process "http://localhost:8080"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   ✅ Application opened in browser!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "   Features:" -ForegroundColor Cyan
Write-Host "   - Report Incident with Voice Input" -ForegroundColor Cyan
Write-Host "   - GPS Location Tracking" -ForegroundColor Cyan
Write-Host "   - Real-time Status Tracking" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Keep both terminal windows open while using the app." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press ENTER to close this window"
