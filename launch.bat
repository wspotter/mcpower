@echo off
REM MCPower Launcher for Windows
REM Double-click this file to start MCPower

cd /d "%~dp0"

echo.
echo 🚀 Starting MCPower Web Console...
echo.
echo    📊 Dashboard: http://127.0.0.1:4173
echo    📁 Manage datasets, create indexes, and monitor status
echo.
echo    Press Ctrl+C to stop the server
echo.

REM Check if .env exists, if not create it
if not exist .env (
    echo 📝 Creating .env configuration...
    (
        echo MCPOWER_PYTHON=%CD%\.venv\Scripts\python.exe
        echo MCPOWER_DATASETS=./datasets
        echo MCPOWER_WEB_PORT=4173
        echo MCPOWER_WEB_HOST=127.0.0.1
        echo LOG_LEVEL=info
    ) > .env
)

REM Check if Python virtual environment exists
if not exist .venv (
    echo ⚠️  Python virtual environment not found!
    echo    Please run: python -m venv .venv
    echo    Then: .venv\Scripts\pip install typer faiss-cpu sentence-transformers
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist node_modules (
    echo 📦 Installing Node.js dependencies...
    call npm install
)

REM Open browser after a short delay
start "" timeout /t 3 /nobreak >nul && start http://127.0.0.1:4173

REM Start the web console
call npm run web
