function clampBoundsToWorkArea(bounds, workArea) {
  const maxX = workArea.x + Math.max(0, workArea.width - bounds.width);
  const maxY = workArea.y + Math.max(0, workArea.height - bounds.height);
  return {
    ...bounds,
    x: Math.round(Math.min(maxX, Math.max(workArea.x, bounds.x))),
    y: Math.round(Math.min(maxY, Math.max(workArea.y, bounds.y))),
  };
}

function placementForBounds(bounds, display) {
  return {
    x: bounds.x,
    y: bounds.y,
    displayId: String(display.id),
    displayLabel: display.label || '',
    offsetX: bounds.x - display.workArea.x,
    offsetY: bounds.y - display.workArea.y,
  };
}

function displayForSavedPlacement(saved, displays = []) {
  if (!saved) return null;
  return displays.find((display) => String(display.id) === String(saved.displayId))
    || displays.find((display) => saved.displayLabel && display.label === saved.displayLabel)
    || displays.find((display) => saved.x >= display.bounds.x
      && saved.x < display.bounds.x + display.bounds.width
      && saved.y >= display.bounds.y
      && saved.y < display.bounds.y + display.bounds.height)
    || null;
}

function resolveSavedBounds(saved, displays, primaryDisplay, size) {
  const display = displayForSavedPlacement(saved, displays) || primaryDisplay;
  const hasOffset = Number.isFinite(saved?.offsetX) && Number.isFinite(saved?.offsetY)
    && displayForSavedPlacement(saved, displays);
  const bounds = {
    width: size,
    height: size,
    x: hasOffset ? display.workArea.x + saved.offsetX : (Number.isFinite(saved?.x) ? saved.x : display.workArea.x),
    y: hasOffset ? display.workArea.y + saved.offsetY : (Number.isFinite(saved?.y) ? saved.y : display.workArea.y),
  };
  return clampBoundsToWorkArea(bounds, display.workArea);
}

module.exports = {
  clampBoundsToWorkArea,
  displayForSavedPlacement,
  placementForBounds,
  resolveSavedBounds,
};
