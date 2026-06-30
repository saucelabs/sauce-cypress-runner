#!/bin/bash
set -e

# Run common bundling steps
bash ./scripts/bundle.sh

# Install Webkit for Bundle
export PLAYWRIGHT_BROWSERS_PATH=0
export PLAYWRIGHT_SKIP_BROWSER_GC=1
cd bundle

if [ "$(uname -m)" = "arm64" ]; then
  # Apple Silicon: the repo manifest pins playwright-webkit 1.57.0 for the Intel macOS 11/12/13 WebKit builds, which
  # 1.58+ dropped. For the arm64 bundle we install playwright-webkit 1.59.1 here (without changing the manifest).
  # 1.59.0 is the first release whose browsers.json carries a frozen macOS 14 arm64 WebKit revision override (2251,
  # built against the macOS 14 SDK), kept in its own webkit_mac14_arm64_special-2251 folder so it coexists with the
  # rolling macOS 15 build (2272, webkit-2272). 1.58.1 had NO macOS 14 override, so its mac14-arm64 install collapsed
  # onto the default rev 2248 (the macOS 15.5 build) and aborted on real macOS 14 with
  # "Symbol not found: _SecCertificateCopyNotValidAfterDate ... WebKit.framework built for macOS 15.5". Do not use
  # 1.60.0: it removed playwright-core's wkBrowser.js, which Cypress reads to detect the WebKit version, so the job
  # would report WebKit 0. PLAYWRIGHT_BROWSERS_PATH stays 0 (set above) so both builds land in
  # node_modules/playwright-core/.local-browsers, where the runner reads them at runtime (src/cypress-runner.ts).
  # PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 stops the npm postinstall pulling the build host's webkit, so the only builds
  # that land are the two explicit installs below.
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright-webkit@1.59.1 --no-save
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac14-arm64 npx playwright install webkit
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac15-arm64 npx playwright install webkit

  # Fail the build if the macOS 14 WebKit is missing or is a macOS 15 SDK binary (which aborts on real macOS 14).
  BROWSERS_DIR="node_modules/playwright-core/.local-browsers"
  echo "WebKit builds in ${BROWSERS_DIR}:"
  ls -1 "${BROWSERS_DIR}" | grep -i webkit || true
  MAC14_WEBKIT_DIR=$(find "${BROWSERS_DIR}" -maxdepth 1 -type d -name 'webkit_mac14_arm64_special-*' | head -n1)
  if [ -z "${MAC14_WEBKIT_DIR}" ]; then
    echo "ERROR: macOS 14 arm64 WebKit (webkit_mac14_arm64_special-*) was not installed" >&2
    exit 1
  fi
  if find "${BROWSERS_DIR}" -maxdepth 1 -type d -name 'webkit-2248' | grep -q .; then
    echo "ERROR: webkit-2248 (macOS 15.5 build) is present, the macOS 14 override did not take effect" >&2
    exit 1
  fi
  MAC14_WEBKIT_BIN=$(find "${MAC14_WEBKIT_DIR}" -type f -path '*WebKit.framework/Versions/A/WebKit' | head -n1)
  if [ -n "${MAC14_WEBKIT_BIN}" ] && command -v otool >/dev/null 2>&1; then
    if otool -l "${MAC14_WEBKIT_BIN}" | grep -A5 LC_BUILD_VERSION | grep -Eq 'sdk 15\.|minos 15\.'; then
      echo "ERROR: ${MAC14_WEBKIT_BIN} is built against the macOS 15 SDK and will abort on macOS 14" >&2
      exit 1
    fi
  fi
  echo "OK: macOS 14 arm64 WebKit installed at ${MAC14_WEBKIT_DIR}"

  ZIP_NAME=cypress-macos-arm64.zip
else
  # Intel runner: unchanged. playwright-webkit 1.57.0 (the repo pin) ships the macOS 11, 12 and 13 WebKit builds.
  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac13 npx playwright install webkit
  ZIP_NAME=cypress-macos-amd64.zip
fi
cd ..

# Archive Bundle with symlinks
zip --symlinks -r "${ZIP_NAME}" bundle/
