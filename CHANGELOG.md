# Changelog

## 0.1.11

- Fixed mascot size drift while dragging Spooly between Windows displays using different scaling levels.
- Kept drag movement and window sizing atomic across mixed-DPI monitor transitions.
- Added regression coverage for repeated 100% to 125% display transitions and display-edge clamping.

## 0.1.10

- Fixed fleet-state priority so a completed printer takes precedence when another printer is still printing.
- Preserved higher-priority error, filament-out, and paused states above completion.
- Added regression coverage for mixed-printer completion scenarios regardless of printer order.
- Updated patched transitive dependencies used by configuration and network libraries.

## 0.1.8

- Added status-colored telemetry, progress bars, multi-nozzle handling, fan reporting, configuration backup/restore, and the current animated Spooly states.
- Improved duplicate-printer detection, local discovery, window placement, live resizing, launch-at-login behavior, and status-bubble layout.
