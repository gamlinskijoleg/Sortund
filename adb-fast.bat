@echo off
setlocal enabledelayedexpansion

:: Check if .env file exists
if not exist .env (
    echo [ERROR] .env file not found!
    echo Copy .env.example to .env and specify your ADB_PHONE_IP.
    pause
    exit /b
)

:: Parse .env file and look for ADB_PHONE_IP variable
set IP=
for /f "usebackq delims== tokens=1,2" %%A in (".env") do (
    if "%%A"=="ADB_PHONE_IP" set IP=%%B
)

:: Check if we found the IP
if "%IP%"=="" (
    echo [ERROR] ADB_PHONE_IP variable not found in .env file!
    pause
    exit /b
)

set PORT=5555

echo [ADB] Attempting to connect to %IP%:%PORT%...
adb disconnect
adb connect %IP%:%PORT%

echo.
echo [ADB] Current device status:
adb devices
pause