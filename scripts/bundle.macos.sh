#!/bin/bash
set -e

# Run common bundling steps
bash ./scripts/bundle.sh

# Install Webkit for Bundle
export PLAYWRIGHT_BROWSERS_PATH=0
export PLAYWRIGHT_SKIP_BROWSER_GC=1
cd bundle
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac13 npx playwright install webkit
cd ..

# Archive Bundle with symlinks
zip --symlinks -r cypress-macos-amd64.zip bundle/
