#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "1. Loading required modules..."
module load Python nodejs 

echo "2. Setting up Python virtual environment..."
cd "$SCRIPT_DIR"
python -m venv ibex_venv
source ibex_venv/bin/activate

echo "3. Installing backend"
pip install --upgrade pip setuptools wheel
cd "$SCRIPT_DIR/backend" && pip install .
cd "$SCRIPT_DIR"
echo "5. Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install

# replace version in package.json with current version
python -c "import json;import ibex; filename='package.json'; data=json.load(open(filename)); data['version']=ibex.__version__; json.dump(data, open(filename, 'w'), indent=2)"

TMPDIR=~/tmp/ibex-build npm run package
chmod 755 "$SCRIPT_DIR/frontend/out/ibex-linux-x64"
chmod -R 755 "$SCRIPT_DIR/frontend/out/ibex-linux-x64/ibex"
