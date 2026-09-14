#!/bin/sh --login

echo "Loading modules..."

# Set up ITER modules environment
source /etc/profile.d/modules.sh
module purge

# Set up environment
module load Python
module load IMAS-Core

# Debuggging:
echo "Done loading modules"
