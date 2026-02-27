#!/bin/sh --login

echo "Loading modules..."

# Set up ITER modules environment
source /etc/profile.d/modules.sh
module purge

# Set up environment
module load IDStools/2.4.0-intel-2023b
module unload Python-bundle-PyPI

# Debuggging:
echo "Done loading modules"
