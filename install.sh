#!/bin/bash

set -e

if [ -z "$1" ]; then
    echo "Error: script expects installation directory to be passed as argument."
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "0. Loading required modules..."
module load nodejs

echo "1. Installing backend"
#pip install click uvicorn
cd "$SCRIPT_DIR/backend"
pip install --no-deps --target $1 .

IBEX_VERSION=$(PYTHONPATH=$1 pip show ibex | grep "Version:" | sed 's/Version: //')

echo "5. Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install

# replace version in package.json with current version
python -c "import json; filename='package.json'; data=json.load(open(filename)); data['version']='${IBEX_VERSION}'; json.dump(data, open(filename, 'w'), indent=2)"

TMPDIR=~/tmp/ibex-build npm run package
chmod 755 "$SCRIPT_DIR/frontend/out/ibex-linux-x64"
chmod -R 755 "$SCRIPT_DIR/frontend/out/ibex-linux-x64/ibex"
cp "$SCRIPT_DIR/frontend/out/ibex-linux-x64/ibex" "$1/bin/run_ibex_frontend"
cp "$SCRIPT_DIR/launch.sh" "$1/bin/ibex"
