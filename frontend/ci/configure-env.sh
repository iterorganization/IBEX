#!/bin/sh --login

echo "Loading modules..."

# Set up ITER modules environment
source /etc/profile.d/modules.sh
module purge

# Set up environment
module load nodejs
module load Xvfb/21.1.9-GCCcore-13.2.0
module load Python
module load IMAS-Core

# Debuggging:
echo "Done loading modules"
echo "Node.js version:"
node -v
echo "NPM version:"
npm -v
