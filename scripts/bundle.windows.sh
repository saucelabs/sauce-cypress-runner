#!/bin/bash
set -e

# Accept version as parameter (defaults to 1.0.0 for testing)
VERSION=${1:-1.0.0}

# Update Release Version
npm version --no-git-tag-version "$VERSION"

# Run common bundling steps
bash ./scripts/bundle.sh

# Install Webkit for Bundle
cd bundle
export PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install webkit
cd ..

# Archive Bundle using PowerShell
powershell.exe -Command "Compress-Archive -Path bundle/ -DestinationPath cypress-windows-amd64.zip -Force"
