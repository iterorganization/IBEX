#!/bin/bash

set -e

# Find and print 3 random unused TCP ports in the dynamic/private range (49152–65535)
get_free_ports() {
  local num_ports=3
  local port_range_start=49152
  local port_range_end=65535


  # Generate the full list of candidate ports
  local all_ports
  all_ports=$(seq "$port_range_start" "$port_range_end")
  local used_ports
  used_ports=$(ss -tan | awk 'NR > 1 { gsub(".*:", "", $4); print $4 }' | sort -u)

  
  # Get free ports using comm on seq and ss output
  local free_ports
  free_ports=$(comm -23 <(echo "$all_ports") <(echo "$used_ports"))

  # Randomize, pick top N, print space-separated ports with newline at end
  echo "$free_ports" | shuf | head -n "$num_ports" | paste -sd ' ' -
  echo
}

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

echo "0. Load modules..."
# `module` is an exported shell function; re-source it when it is missing
# (e.g. when the script is run from a non-login shell).
command -v module >/dev/null 2>&1 || source /etc/profile.d/modules.sh
module purge
module load "${IBEX_MODULES[@]}"

# Activate the venv rather than deriving its site-packages path from the live
# interpreter: that guess silently pointed at a non-existent
# lib/python<version>/site-packages whenever the module Python moved.
if [ ! -f "$SCRIPT_DIR/ibex_venv/bin/activate" ]; then
  echo "No virtual environment at $SCRIPT_DIR/ibex_venv - run ./install.sh first." >&2
  exit 1
fi
source "$SCRIPT_DIR/ibex_venv/bin/activate"

echo "1. Launch backend server..."

read -r -a found_ports < <(get_free_ports)
echo "Selected free ports: ${found_ports[@]}"
echo "Setting IBEX BACKEND PORT = ${found_ports[0]}"

cd "$SCRIPT_DIR/backend"
python -m ibex.cli -p ${found_ports[0]} &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

echo "Setting IBEX_BACKEND_URL = http://127.0.0.1:${found_ports[0]}"
export IBEX_BACKEND_URL="http://127.0.0.1:${found_ports[0]}"

echo "2. Configuring frontend"

# Search for 2 open ports, one for webpack renderer and one for webpack logger
# The range 49152–65535 contains dynamic or private ports.
# This range is used for private or customized services, for temporary purposes, and for automatic allocation of ephemeral ports.

echo "Setting WEBPACK_RENDERER PORT = ${found_ports[1]}"
echo "Setting WEBPACK_LOGGER PORT = ${found_ports[2]}"

echo "CREATING CONFIG FILE IN ~/.config/ibex/config.json"
mkdir -p ~/.config/ibex
rm -f ~/.config/ibex/config.json
touch ~/.config/ibex/config.json
echo "DONE CREATING CONFIG FILE"

cat > ~/.config/ibex/config.json <<EOF
{
  "API_URL": "http://localhost:${found_ports[0]}",
  "WEBPACK_PORT": ${found_ports[1]},
  "LOGGER_PORT": ${found_ports[2]}
}
EOF

echo "3. Launch frontend server..."
"$SCRIPT_DIR/frontend/out/ibex-linux-x64/ibex" &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for both processes to finish
wait $FRONTEND_PID
kill $BACKEND_PID
