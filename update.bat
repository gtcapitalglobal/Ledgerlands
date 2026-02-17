@echo off
echo ========================================
echo   Land Contract Dashboard - UPDATE
echo ========================================
echo.

echo Updating dependencies...
pnpm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to update dependencies!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Update completed successfully!
echo ========================================
echo.
echo You can now run start.bat to start the server
echo.
pause
