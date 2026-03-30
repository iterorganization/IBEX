#!/bin/bash

# Bamboo CI script for pytest

# Debuggging:
set -e -o pipefail


# Set up environment s
BACKEND_ROOT_DIR=$(realpath "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/..")
source ${BACKEND_ROOT_DIR}/ci/configure_env.sh

#set -x
cd ${BACKEND_ROOT_DIR}

# Create a venv
python -m venv venv
. venv/bin/activate
echo "PWD: " `pwd`

# PREPARE THE ENVIRONMENT
pip install --upgrade pip setuptools wheel
pip install --upgrade .[docs]

# BUILD DOCS
make -C ../docs html