@echo off
echo Setting up Face Verification...
echo.

REM Create temp directory for face verification uploads
if not exist "uploads\temp" (
    mkdir uploads\temp
    echo ✓ Created uploads\temp directory
) else (
    echo ✓ uploads\temp directory already exists
)

echo.
echo Face Verification setup complete!
echo.
echo Next steps:
echo 1. Restart your backend server: npm run dev
echo 2. Test the API endpoints
echo.
pause
