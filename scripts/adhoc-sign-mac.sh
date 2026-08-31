#!/bin/zsh
set -euo pipefail

app_path="${1:?Pass the path to the packaged macOS app}"

# Electron's unsigned distribution contains linker-signed Mach-O files but no
# complete bundle resource seal. A full ad-hoc signature makes the bundle
# internally consistent while we intentionally ship without a Developer ID.
codesign --force --deep --sign - --timestamp=none "$app_path"
codesign --verify --deep --strict --verbose=4 "$app_path"
