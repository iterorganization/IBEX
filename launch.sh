#!/bin/bash

# IBEX launch script. It assumes both ibex and run_ibex_service executables are in PATH

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

echo "1. Launch backend server..."

read -r -a found_ports < <(get_free_ports)
echo "Selected free ports: ${found_ports[@]}"
echo "Setting IBEX BACKEND PORT = ${found_ports[0]}"

run_ibex_service -p ${found_ports[0]} &
BACKEND_PID=$!

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

echo "3. Launch IBEX frontend..."
run_ibex_frontend &
FRONTEND_PID=$!

# Wait for both processes to finish
wait $FRONTEND_PID
kill $BACKEND_PID
