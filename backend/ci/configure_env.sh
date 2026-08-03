#!/bin/sh --login

echo "Loading modules..."

# Set up ITER modules environment
source /etc/profile.d/modules.sh
module purge

# Set up environment.
# Pinned to the SDCC 2025b toolchain. Do NOT drop the versions: unversioned
# `module load` follows the cluster default, which moved from 2023b to 2025b
# on 2025-07-31. IMAS-Python pulls in IMAS-Core and Python transitively.
module load IMAS-Python/2.3.0-intel-2025b
module load IDStools/2.4.1-intel-2025b

# Debuggging:
echo "Done loading modules"
