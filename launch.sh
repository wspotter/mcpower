#!/bin/bash
# MCPower Launcher
# Double-click this file or run: ./launch.sh

set -e

cd "$(dirname "$0")"

echo "🚀 Starting MCPower Web Console..."
echo ""
echo "   📊 Dashboard: http://127.0.0.1:4173"
echo "   📁 Manage datasets, create indexes, and monitor status"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

# Check if .env exists, if not create it
if [ ! -f .env ]; then
    echo "📝 Creating .env configuration..."
    cat > .env <<EOL
MCPOWER_PYTHON=$(pwd)/.venv/bin/python
MCPOWER_DATASETS=./datasets
MCPOWER_WEB_PORT=4173
MCPOWER_WEB_HOST=127.0.0.1
LOG_LEVEL=info
EOL
fi

# Check if Python virtual environment exists
if [ ! -d .venv ]; then
    echo "⚠️  Python virtual environment not found!"
    echo "   Please run: python3 -m venv .venv"
    echo "   Then: .venv/bin/pip install typer faiss-cpu sentence-transformers"
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Open browser after a short delay
(sleep 3 && xdg-open http://127.0.0.1:4173 2>/dev/null || open http://127.0.0.1:4173 2>/dev/null || echo "   👉 Open your browser to http://127.0.0.1:4173") &

# Start the web console
npm run web
