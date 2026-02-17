@echo off
echo ========================================
echo   Land Contract Dashboard - START
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: Dependencies not installed!
    echo Please run install.bat first.
    echo.
    pause
    exit /b 1
)

echo Starting development server...
echo.
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

pnpm dev
