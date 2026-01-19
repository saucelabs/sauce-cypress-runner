#!/bin/bash
set -e

# Run common bundling steps
bash ./scripts/bundle.sh

# Install Webkit for Bundle
cd bundle
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install webkit
cd ..

# Archive Bundle using PowerShell
powershell.exe -Command "Compress-Archive -Path bundle/ -DestinationPath cypress-windows-amd64.zip -Force"
