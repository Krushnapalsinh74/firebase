@echo off
title Yunora / KPark Local AI Bridge (ChatGPT)
color 0A

echo ===================================================
echo     Yunora / KPark - Local AI Browser Bridge
echo     Target: ChatGPT Web (https://chatgpt.com)
echo ===================================================
echo.

set PROFILE_DIR=%USERPROFILE%\.yunora_browser_profile
if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

echo [1/3] Detecting installed browser...
set BROWSER_EXE=""

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_EXE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set BROWSER_EXE="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set BROWSER_EXE="C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set BROWSER_EXE="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

if %BROWSER_EXE%=="" (
    echo [ERROR] Could not find Microsoft Edge or Google Chrome on your computer!
    pause
    exit /b 1
)

echo [2/3] Using browser: %BROWSER_EXE%
echo [3/3] Launching Local AI Browser Session with CDP on port 9222...
echo.

start "" %BROWSER_EXE% --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%PROFILE_DIR%" --no-first-run --no-default-browser-check https://chatgpt.com

echo ===================================================
echo   Local AI Browser is now active on port 9222!
echo   
echo   - Log in to your ChatGPT account in the 
echo     opened browser window once.
echo   - Keep this window open or minimized while using 
echo     the Local AI features.
echo ===================================================
echo.
pause
