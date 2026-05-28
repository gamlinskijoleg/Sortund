@echo off
setlocal enabledelayedexpansion

:: Перевіряємо, чи існує .env файл
if not exist .env (
    echo [ПОМИЛКА] Файл .env не знайдено!
    echo Скопіюйте .env.example у .env та вкажіть ваш ADB_PHONE_IP.
    pause
    exit /b
)

:: Парсимо .env файл та шукаємо змінну ADB_PHONE_IP
set IP=
for /f "usebackq delims== tokens=1,2" %%A in (".env") do (
    if "%%A"=="ADB_PHONE_IP" set IP=%%B
)

:: Перевіряємо, чи ми знайшли IP
if "%IP%"=="" (
    echo [ПОМИЛКА] Змінну ADB_PHONE_IP не знайдено у файлі .env!
    pause
    exit /b
)

set PORT=5555

echo [ADB] Спроба підключення до %IP%:%PORT%...
adb disconnect
adb connect %IP%:%PORT%

echo.
echo [ADB] Поточний статус пристроїв:
adb devices
pause