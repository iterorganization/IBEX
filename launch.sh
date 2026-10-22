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
IBEX_BIN="$SCRIPT_DIR/frontend/out/ibex-linux-x64/ibex"

# Directory the user started IBEX from: relative paths given as options
# (-c FILE, -t FILE) are resolved against it, since this script changes
# directory before starting the app.
export IBEX_CALLER_CWD="$PWD"

# True when the options only ask IBEX to print something (--help,
# --version): no backend or set-up step is needed then.
is_info_only() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -h|--help|-v|--version) return 0 ;;
    esac
  done
  return 1
}

if is_info_only "$@"; then
  exec "$IBEX_BIN" "$@"
fi

echo "0. Load modules..."
module purge
module load IMAS-Python IDStools nodejs

PYTHON_VERSION=$(python --version | cut -d ' ' -f 2 | cut -d '.' -f1,2)
export PYTHONPATH=${SCRIPT_DIR}/ibex_venv/lib/python${PYTHON_VERSION}/site-packages:${PYTHONPATH}

echo "1. Launch backend server..."

read -r -a found_ports < <(get_free_ports)
echo "Selected free ports: ${found_ports[@]}"
echo "Setting IBEX BACKEND PORT = ${found_ports[0]}"

cd "$SCRIPT_DIR/backend"
python -m ibex.cli -p ${found_ports[0]} &
BACKEND_PID=$!
# Stop the backend however the script ends, including when the app exits
# with an error (e.g. an invalid command-line option)
trap 'kill $BACKEND_PID 2>/dev/null' EXIT
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
# Command-line options are passed on to IBEX (see `./launch.sh --help`)
"$IBEX_BIN" "$@" &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for the app to finish; the EXIT trap stops the backend
wait $FRONTEND_PID
