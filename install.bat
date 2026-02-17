@echo off
echo ========================================
echo   Land Contract Dashboard - INSTALL
echo ========================================
echo.

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pnpm is not installed!
    echo.
    echo Please install pnpm first:
    echo   npm install -g pnpm
    echo.
    pause
    exit /b 1
)

echo Installing dependencies...
echo This may take a few minutes...
echo.

pnpm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation completed successfully!
echo ========================================
echo.
echo Next steps:
echo   1. Configure your .env file with database credentials
echo   2. Run start.bat to start the development server
echo.
pause
