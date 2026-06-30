#!/bin/bash
set -e

# Run common bundling steps
bash ./scripts/bundle.sh

# Install Webkit for Bundle
export PLAYWRIGHT_BROWSERS_PATH=0
export PLAYWRIGHT_SKIP_BROWSER_GC=1
cd bundle

if [ "$(uname -m)" = "arm64" ]; then
  # Apple Silicon: the repo pins playwright-webkit 1.57.0 for the Intel macOS 11/12/13 WebKit builds, which 1.58+ dropped.
  # 1.57.0 has no working macOS 14 WebKit, so install 1.58.1 here (without changing the manifest) to get the macOS 14
  # and macOS 15 arm64 WebKit. Never go to 1.59, which drops macOS 14 WebKit.
  npm install playwright-webkit@1.58.1 --no-save
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64 npx playwright install webkit
  ZIP_NAME=cypress-macos-arm64.zip
else
  # Intel runner: unchanged. playwright-webkit 1.57.0 (the repo pin) ships the macOS 11, 12 and 13 WebKit builds.
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac13 npx playwright install webkit
  ZIP_NAME=cypress-macos-amd64.zip
fi
cd ..

# Archive Bundle with symlinks
zip --symlinks -r "${ZIP_NAME}" bundle/
