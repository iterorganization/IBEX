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

echo "1. Loading required modules..."
module load IMAS-Python IDStools nodejs

echo "2. Setting up Python virtual environment..."
mkdir -p ~/.config/ibex
cd ~/.config/ibex
python -m venv ibex_venv
source ibex_venv/bin/activate

echo "3. Installing backend in editable mode..."
# install requirements: to be modified later for central installation
cd "$SCRIPT_DIR/backend"
pip uninstall ibex -y
pip install -e .

echo "4. Launch backend server..."

read -r -a found_ports < <(get_free_ports)
echo "Selected free ports: ${found_ports[@]}"
echo "Setting IBEX BACKEND PORT = ${found_ports[0]}"

run_ibex_service -p ${found_ports[0]} &
BACKEND_PID=$!

export IBEX_BACKEND_URL="http://127.0.0.1:${found_ports[0]}"
echo "Setting IBEX_BACKEND_URL = $IBEX_BACKEND_URL"

cd "$SCRIPT_DIR"

echo "5. Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"

# Search for 2 open ports, one for webpack renderer and one for webpack logger
# The range 49152–65535 contains dynamic or private ports.
# This range is used for private or customized services, for temporary purposes, and for automatic allocation of ephemeral ports.

echo "Setting WEBPACK_RENDERER PORT = ${found_ports[1]}"
echo "Setting WEBPACK_LOGGER PORT = ${found_ports[2]}"

echo "CREATING CONFIG FILE IN ~/.config/ibex/config.json"
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

npm install

echo "6. Launch frontend server..."
npm run start &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

# Wait for both processes to finish
wait $FRONTEND_PID
kill $BACKEND_PID