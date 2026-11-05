export const SHEET_ASPECT = 4 / 3;

export const PLOT_FILL = {
  available: "#d7eadc",
  occupied: "#245B48",
  reserved: "#e7d3a1",
};

export function containFrame(imageWidth, imageHeight) {
  const imageAspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : SHEET_ASPECT;
  if (imageAspect >= SHEET_ASPECT) {
    const w = 0.94;
    const h = (w * SHEET_ASPECT) / imageAspect;
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }
  const h = 0.94;
  const w = (h * imageAspect) / SHEET_ASPECT;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function sheetToImage(point, frame) {
  const w = frame.w || 1;
  const h = frame.h || 1;
  return { x: (point.x - frame.x) / w, y: (point.y - frame.y) / h };
}

export function imageToSheet(point, frame) {
  return { x: frame.x + point.x * frame.w, y: frame.y + point.y * frame.h };
}

export function rotationDegrees(element) {
  return Number(element?.rotation) || 0;
}

export function rotatePoint(point, center, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

export function unrotatePoint(point, center, degrees) {
  return rotatePoint(point, center, -degrees);
}

export function elementCenter(element) {
  if (element.shape === "polygon" || element.shape === "polyline") {
    const box = boundsOf(element.points);
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  }
  return { x: element.x + element.w / 2, y: element.y + element.h / 2 };
}

export function rotationHandlePoint(element) {
  const center = elementCenter(element);
  const top = { x: center.x, y: element.y };
  return rotatePoint(top, center, rotationDegrees(element));
}

export function snapRotation(degrees, interval = 15, enabled = true) {
  if (!enabled) return degrees;
  const step = interval || 15;
  return Math.round(degrees / step) * step;
}

export function angleFromCenter(center, point) {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI + 90;
}

export function boundsOf(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function pointInPolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function nearPolyline(points, x, y, threshold) {
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = dx * dx + dy * dy || 1;
    const t = clamp(((x - start.x) * dx + (y - start.y) * dy) / length, 0, 1);
    const px = start.x + t * dx;
    const py = start.y + t * dy;
    if (Math.hypot(x - px, y - py) <= threshold) return true;
  }
  return false;
}

export function hitElement(element, point) {
  if (!element) return false;
  const center = elementCenter(element);
  const local = unrotatePoint(point, center, rotationDegrees(element));
  if (element.shape === "polyline") return nearPolyline(element.points, local.x, local.y, 0.03);
  if (element.shape === "polygon") return pointInPolygon(element.points, local.x, local.y);
  return local.x >= element.x && local.y >= element.y && local.x <= element.x + element.w && local.y <= element.y + element.h;
}

export function nearRotationHandle(element, point, threshold = 0.03) {
  if (!element || element.shape === "polyline") return false;
  const handle = rotationHandlePoint(element);
  return Math.hypot(point.x - handle.x, point.y - handle.y) <= threshold;
}

export function topElementAt(elements, point) {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    if (hitElement(elements[index], point)) return elements[index];
  }
  return null;
}

export function resizeRect(start, corner, point) {
  let x = start.x;
  let y = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (corner.includes("e")) right = point.x;
  if (corner.includes("w")) x = point.x;
  if (corner.includes("s")) bottom = point.y;
  if (corner.includes("n")) y = point.y;
  const left = Math.min(x, right);
  const top = Math.min(y, bottom);
  return {
    x: left,
    y: top,
    w: Math.max(0.02, Math.abs(right - x)),
    h: Math.max(0.02, Math.abs(bottom - y)),
  };
}

export function translateElement(element, dx, dy) {
  if (element.shape === "polygon" || element.shape === "polyline") {
    return { ...element, points: element.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }
  return { ...element, x: element.x + dx, y: element.y + dy };
}

export function rectCorners(element) {
  return [
    { id: "nw", x: element.x, y: element.y },
    { id: "ne", x: element.x + element.w, y: element.y },
    { id: "sw", x: element.x, y: element.y + element.h },
    { id: "se", x: element.x + element.w, y: element.y + element.h },
  ];
}

export function rectCornersRotated(element) {
  const center = elementCenter(element);
  const degrees = rotationDegrees(element);
  return rectCorners(element).map((corner) => ({
    id: corner.id,
    ...rotatePoint(corner, center, degrees),
  }));
}

export function sheetPointFromEvent(event, sheet) {
  const rect = sheet.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

export function focusPan(stage, element, frame, zoom) {
  if (!stage || !element) return { x: 0, y: 0 };
  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  const sheetW = stageW * 0.84;
  const sheetH = sheetW / SHEET_ASPECT;
  const center = imageToSheet(elementCenter(element), frame);
  const px = stageW * 0.08 + center.x * sheetW;
  const py = stageH * 0.06 + center.y * sheetH;
  return { x: stageW / 2 - zoom * px, y: stageH / 2 - zoom * py };
}
