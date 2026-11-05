export const DEFAULT_MAP_SHORTCUTS = {
  toolSelect: "v",
  toolBackground: "shift+b",
  toolSection: "shift+d",
  toolBlock: "shift+g",
  toolPlot: "shift+p",
  toolRoad: "shift+w",
  toolLandmark: "shift+l",
  undo: "mod+z",
  redo: "mod+shift+z",
  copy: "mod+c",
  paste: "mod+v",
  duplicate: "mod+d",
  delete: "delete",
  save: "mod+s",
  zoomIn: "mod+=",
  zoomOut: "mod+-",
  fit: "shift+f",
  deselect: "escape",
};

export const SHORTCUT_LABELS = {
  toolSelect: "Select Tool",
  toolBackground: "Background Tool",
  toolSection: "Draw Section",
  toolBlock: "Draw Block",
  toolPlot: "Draw Burial Plot",
  toolRoad: "Draw Pathway",
  toolLandmark: "Add Landmark",
  undo: "Undo",
  redo: "Redo",
  copy: "Copy",
  paste: "Paste",
  duplicate: "Duplicate",
  delete: "Delete Selected",
  save: "Save Map",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  fit: "Fit to Screen",
  deselect: "Deselect",
};

const BROWSER_WARNINGS = new Set(["mod+s", "mod+p", "mod+w", "mod+t", "mod+n"]);

function normalizePart(part) {
  const lower = String(part || "").trim().toLowerCase();
  if (lower === "control" || lower === "ctrl" || lower === "cmd" || lower === "meta" || lower === "mod") return "mod";
  if (lower === "shift") return "shift";
  if (lower === "alt" || lower === "option") return "alt";
  if (lower === "escape" || lower === "esc") return "escape";
  if (lower === "+" || lower === "=") return "+";
  if (lower === "-" || lower === "_") return "-";
  return lower.length === 1 ? lower : lower;
}

export function normalizeShortcut(raw) {
  const parts = String(raw || "")
    .toLowerCase()
    .split("+")
    .map(normalizePart)
    .filter(Boolean);
  const mods = [];
  let key = "";
  parts.forEach((part) => {
    if (part === "mod" || part === "shift" || part === "alt") {
      if (!mods.includes(part)) mods.push(part);
      return;
    }
    key = part;
  });
  mods.sort();
  return key ? [...mods, key].join("+") : mods.join("+");
}

export function eventToShortcut(event) {
  const parts = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  let key = event.key.toLowerCase();
  if (key === " ") key = "space";
  if (key.length === 1 || ["escape", "delete", "backspace", "+", "-", "="].includes(key)) {
    if (key === "=") key = "+";
    parts.push(key);
  }
  return normalizeShortcut(parts.join("+"));
}

export function formatShortcut(shortcut, isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
  return normalizeShortcut(shortcut)
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl";
      if (part === "shift") return "Shift";
      if (part === "alt") return isMac ? "Option" : "Alt";
      if (part === "escape") return "Esc";
      if (part === "delete") return "Delete";
      return part.toUpperCase();
    })
    .join(" + ");
}

export function mergeShortcuts(saved) {
  return { ...DEFAULT_MAP_SHORTCUTS, ...(saved || {}) };
}

export function shortcutConflicts(shortcuts) {
  const map = {};
  const conflicts = [];
  Object.entries(shortcuts).forEach(([action, combo]) => {
    const key = normalizeShortcut(combo);
    if (!key) return;
    if (map[key] && map[key] !== action) conflicts.push({ key, a: map[key], b: action });
    map[key] = action;
  });
  return conflicts;
}

export function shortcutWarnings(shortcuts) {
  return Object.entries(shortcuts)
    .filter(([, combo]) => BROWSER_WARNINGS.has(normalizeShortcut(combo)))
    .map(([action, combo]) => ({ action, combo }));
}

export function matchShortcut(event, shortcuts, actionId) {
  const combo = normalizeShortcut(shortcuts[actionId]);
  if (!combo) return false;
  return eventToShortcut(event) === combo;
}

export function isTypingTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}
