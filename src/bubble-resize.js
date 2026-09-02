function clampScale(value, minimum = 0.65, maximum = 1.6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(minimum, Math.min(maximum, numeric));
}

function scaledSize(baseSize, scale) {
  const factor = clampScale(scale);
  return {
    width: Math.round(baseSize.width * factor),
    height: Math.round(baseSize.height * factor),
  };
}

function topRightResize({ startCursor, startBounds, point, baseSize, minimum = 0.65, maximum = 1.6 }) {
  const startScale = startBounds.width / baseSize.width;
  const deltaX = point.x - startCursor.x;
  const deltaY = point.y - startCursor.y;
  const denominator = (baseSize.width ** 2) + (baseSize.height ** 2);
  const projectedScale = denominator
    ? ((deltaX * baseSize.width) - (deltaY * baseSize.height)) / denominator
    : 0;
  const scale = clampScale(startScale + projectedScale, minimum, maximum);
  const size = scaledSize(baseSize, scale);

  return {
    scale,
    bounds: {
      x: startBounds.x,
      y: startBounds.y + startBounds.height - size.height,
      width: size.width,
      height: size.height,
    },
  };
}

module.exports = { clampScale, scaledSize, topRightResize };
