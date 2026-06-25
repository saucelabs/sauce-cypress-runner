#!/bin/bash
set -e

# Run common bundling steps
bash ./scripts/bundle.sh

# Install Webkit for Bundle
export PLAYWRIGHT_BROWSERS_PATH=0
export PLAYWRIGHT_SKIP_BROWSER_GC=1
cd bundle

if [ "$(uname -m)" = "arm64" ]; then
  # Apple Silicon runner installs arm64 WebKit for macOS 14
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64 npx playwright install webkit
  ZIP_NAME=cypress-macos-arm64.zip
else
  # Intel runner installs amd64 WebKit
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac13 npx playwright install webkit
  ZIP_NAME=cypress-macos-amd64.zip
fi
cd ..

# Archive Bundle with symlinks
zip --symlinks -r "${ZIP_NAME}" bundle/
