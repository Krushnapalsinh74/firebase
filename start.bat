@echo off
title Yunora Question Hub Starter
cls
echo ===================================================
echo   Yunora Question Hub - Launching Services
echo ===================================================
echo.
echo [1/2] Launching API Server in a new window...
start "Yunora API Server" cmd /k "echo Starting API Server... && pnpm --filter @workspace/api-server dev"

echo [2/2] Launching Admin Frontend (Vite) in a new window...
start "Yunora Admin Frontend" cmd /k "echo Starting Frontend... && pnpm --filter @workspace/yunora-admin dev"

echo.
echo ===================================================
echo   All services have been launched!
echo   - API Server: http://localhost:8080
echo   - Admin Frontend: http://localhost:5173
echo.
echo   Note: Keep the opened windows running. 
echo   To stop a service, simply close its window.
echo ===================================================
echo.
pause
