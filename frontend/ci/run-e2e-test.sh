#!/bin/bash

# Script to run E2E tests
FRONTEND_ROOT_DIR=$(realpath "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/..")

BACKEND_ROOT_DIR=$(realpath "$(dirname "$(realpath "${BASH_SOURCE[0]}")")/../../backend")

echo "FRONTEND_ROOT_DIR: ${FRONTEND_ROOT_DIR}"
echo "BACKEND_ROOT_DIR: ${BACKEND_ROOT_DIR}"

# Root directory of the frontend
source ${FRONTEND_ROOT_DIR}/ci/configure-env.sh

cd ${BACKEND_ROOT_DIR}
which python
python --version

python -m venv venv
. venv/bin/activate
echo "PWD: " `pwd`

# PREPARE THE ENVIRONMENT
pip install --upgrade pip setuptools wheel pytest-cov pytest-xdist
pip install --upgrade .

# Set up environment
cd ${FRONTEND_ROOT_DIR}

# Install frontend dependencies (required for cross-env and other local binaries)
echo "Installing frontend npm dependencies..."
npm ci

# Start a virtual framebuffer so Electron can run headlessly in CI (no $DISPLAY)
echo "Starting Xvfb virtual display..."
Xvfb :99 -screen 0 1920x1080x24 &
XVFB_PID=$!
export DISPLAY=:99
sleep 2  # give Xvfb time to initialise

# Start Electron app
echo "Starting Electron app for E2E tests..."
npm run start:e2e &

# Allow app to cleanly start
sleep 120

# Find the real Electron app process using the debug port argument
APP_PID=$(ps -aux | grep ". --remote-debugging-port=9222 --no-watch" | grep -v grep | awk '{print $2}')

if [ -z "$APP_PID" ]; then
  echo "Could not find Electron app process!"
  ps -aux | grep electron || true
  exit 1
fi

# Run tests
echo "Running E2E tests..."
npm run test:e2e
TEST_RESULT=$?

# Stop Electron app
echo "Stopping Electron app (PID $APP_PID)..."
kill $APP_PID || echo "App already stopped"

# Wait a bit and double-check
sleep 2

if ps -p "$APP_PID" > /dev/null; then
  echo "App still running, forcing kill..."
  kill -9 "$APP_PID" || true
else
  echo "App stopped successfully."
fi

# Stop Xvfb virtual display
if [ -n "$XVFB_PID" ]; then
  echo "Stopping Xvfb (PID $XVFB_PID)..."
  kill $XVFB_PID || true
fi

if [ $TEST_RESULT -eq 0 ]; then
  echo "✅ E2E tests passed!"
else
  echo "❌ E2E tests failed (exit code $TEST_RESULT)"
fi

exit $TEST_RESULT
