#!/bin/zsh
set -euo pipefail

script_dir="${0:A:h}"
project_dir="${script_dir:h}"
notary_profile="${SPOOLY_NOTARY_PROFILE:-spooly-notary}"
signing_identity="${SPOOLY_SIGNING_IDENTITY:-}"

if [[ -z "$signing_identity" ]]; then
  signing_identity="$(
    security find-identity -v -p codesigning \
      | awk '/Developer ID Application: Roger Stout \(W3WPVL2V32\)/ { print $2; exit }'
  )"
fi

if [[ -z "$signing_identity" ]]; then
  print -u2 "No Developer ID Application identity was found for team W3WPVL2V32"
  exit 1
fi

cd "$project_dir"

corepack pnpm exec electron-builder --mac dmg --arm64

version="$(node -p "require('./package.json').version")"
app_path="dist/mac-arm64/Spooly.app"
dmg_path="dist/Spooly-${version}-arm64.dmg"

if [[ ! -d "$app_path" ]]; then
  print -u2 "Signed app was not created at $app_path"
  exit 1
fi

if [[ ! -f "$dmg_path" ]]; then
  print -u2 "DMG was not created at $dmg_path"
  exit 1
fi

codesign --verify --deep --strict --verbose=4 "$app_path"

signature_details="$(codesign -d --verbose=4 "$app_path" 2>&1)"
if [[ "$signature_details" != *"flags=0x10000(runtime)"* ]]; then
  print -u2 "Hardened runtime is missing from $app_path"
  exit 1
fi

codesign --force --sign "$signing_identity" --timestamp "$dmg_path"
codesign --verify --verbose=4 "$dmg_path"

xcrun notarytool submit "$dmg_path" \
  --keychain-profile "$notary_profile" \
  --wait

xcrun stapler staple "$dmg_path"
xcrun stapler validate "$dmg_path"
hdiutil verify "$dmg_path"
spctl --assess --type execute --verbose=4 "$app_path"
spctl --assess --type open --context context:primary-signature --verbose=4 "$dmg_path"

print "Signed, notarized, stapled, and verified: $dmg_path"
