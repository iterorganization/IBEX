#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pinned to the SDCC 2025b toolchain. Do NOT drop the versions: unversioned
# `module load` follows the cluster default, which moved from 2023b to 2025b
# on 2025-07-31 and broke every venv built before that date.
IBEX_MODULES=(
  IMAS-Python/2.3.0-intel-2025b
  IDStools/2.4.1-intel-2025b
  nodejs/22.17.1-GCCcore-14.3.0
)

# Create $1 if absent; recreate it when its interpreter no longer matches the
# loaded Python. `venv` upgrades an existing directory in place and leaves a
# stale bin/python behind, which is exactly how the 2023b -> 2025b move
# produced a venv whose pyvenv.cfg said 3.13.5 while bin/python was 3.11.5.
ensure_venv() {
  local venv_dir="$1"
  local want have
  want="$(python -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
  if [ -e "$venv_dir" ]; then
    have="$("$venv_dir/bin/python" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || echo none)"
    if [ "$have" != "$want" ]; then
      echo "Recreating $venv_dir (Python $have -> $want)"
      rm -rf "$venv_dir"
    fi
  fi
  [ -d "$venv_dir" ] || python -m venv --system-site-packages "$venv_dir"
}

echo "1. Loading required modules..."
# `module` is an exported shell function; re-source it when it is missing
# (e.g. when the script is run from a non-login shell).
command -v module >/dev/null 2>&1 || source /etc/profile.d/modules.sh
module purge
module load "${IBEX_MODULES[@]}"

echo "2. Setting up Python virtual environment..."
cd "$SCRIPT_DIR"
ensure_venv "$SCRIPT_DIR/ibex_venv"
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
