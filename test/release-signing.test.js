const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const packageJson = require(path.join(projectRoot, "package.json"));

test("macOS release requires Developer ID signing and hardened runtime", () => {
  const mac = packageJson.build.mac;

  assert.equal(mac.identity, "Roger Stout (W3WPVL2V32)");
  assert.equal(mac.hardenedRuntime, true);
  assert.equal(mac.gatekeeperAssess, false);
  assert.equal(mac.entitlements, "build/entitlements.mac.plist");
  assert.equal(mac.entitlementsInherit, "build/entitlements.mac.plist");
  assert.match(packageJson.scripts["dist:mac"], /build-release-mac\.sh/);
});

test("macOS release script notarizes, staples, and verifies without ad-hoc signing", () => {
  const script = fs.readFileSync(
    path.join(projectRoot, "scripts", "build-release-mac.sh"),
    "utf8",
  );

  assert.match(script, /notarytool submit/);
  assert.match(script, /codesign --force --sign/);
  assert.match(script, /stapler staple/);
  assert.match(script, /stapler validate/);
  assert.match(script, /spctl --assess/);
  assert.doesNotMatch(script, /codesign[^\n]*--sign\s+-/);
});

test("macOS entitlements include Electron runtime requirements", () => {
  const entitlements = fs.readFileSync(
    path.join(projectRoot, "build", "entitlements.mac.plist"),
    "utf8",
  );

  assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
  assert.match(
    entitlements,
    /com\.apple\.security\.cs\.allow-unsigned-executable-memory/,
  );
  assert.doesNotMatch(entitlements, /com\.apple\.security\.get-task-allow/);
});
