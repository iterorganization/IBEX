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

# Recreate the venv if it was created with a different Python (major.minor)
# version than the one currently loaded, to avoid stale-interpreter failures
# when the user switches Python versions (e.g. module load) between runs.
ensure_compatible_venv() {
  local venv_dir="$1"
  local current_version
  current_version=$(python -c 'import platform; v = platform.python_version_tuple(); print(f"{v[0]}.{v[1]}")')

  if [ -f "$venv_dir/pyvenv.cfg" ]; then
    local venv_version
    venv_version=$(awk -F '= ' '/^version/ {print $2}' "$venv_dir/pyvenv.cfg" | cut -d '.' -f1,2)

    if [ -n "$venv_version" ] && [ "$venv_version" != "$current_version" ]; then
      echo "WARNING: existing virtual environment at '$venv_dir' was created with Python $venv_version, but the currently loaded Python is $current_version."
      echo "Recreating the virtual environment to match the current Python version..."
      rm -rf "$venv_dir"
    fi
  fi
}

# Check that a given environment module is currently loaded (by name prefix,
# ignoring version), without attempting to load it ourselves.
is_module_loaded() {
  local mod_name="$1"
  module -t list 2>&1 | grep -qi "^${mod_name}\(/\|$\)"
}

echo "1. Checking required modules are loaded..."
required_modules=(IMAS-Python IDStools nodejs)
missing_modules=()
for mod in "${required_modules[@]}"; do
  if ! is_module_loaded "$mod"; then
    missing_modules+=("$mod")
  fi
done

if [ "${#missing_modules[@]}" -ne 0 ]; then
  echo "ERROR: the following required module(s) are not loaded: ${missing_modules[*]}" >&2
  echo "Please load them first, e.g.: module load ${missing_modules[*]}" >&2
  exit 1
fi

echo "2. Setting up Python virtual environment..."
mkdir -p ~/.config/ibex
cd ~/.config/ibex
ensure_compatible_venv "$(pwd)/ibex_venv"
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