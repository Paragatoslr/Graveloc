const PASTE_OFFSET = 0.018;

export function cloneMapElement(element, offsetIndex = 1) {
  const id = `el-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
  const dx = PASTE_OFFSET * offsetIndex;
  const dy = PASTE_OFFSET * offsetIndex;
  const base = {
    ...element,
    id,
    refId: element.type === "plot" ? "" : element.refId,
    name: element.type === "plot" ? "" : element.name,
  };
  if (element.shape === "polygon" || element.shape === "polyline") {
    return {
      ...base,
      points: element.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  }
  return {
    ...base,
    x: clamp01(element.x + dx, element.w),
    y: clamp01(element.y + dy, element.h),
    rotation: element.rotation || 0,
  };
}

function clamp01(value, size) {
  return Math.min(1 - (size || 0.02), Math.max(0, value));
}

export function cloneElements(elements, offsetIndex = 1) {
  return elements.map((element) => cloneMapElement(element, offsetIndex));
}
