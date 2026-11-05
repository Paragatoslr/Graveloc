/**
 * Cemetery maps live in db.maps[]. Legacy db.customMap migrates into maps[0].
 * Geometry uses normalized image-space coordinates. Images stay in IndexedDB.
 */

export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function defaultBackground() {
  return {
    imageId: "",
    width: 0,
    height: 0,
    opacity: 0.55,
    locked: false,
    x: 0.03,
    y: 0.03,
    w: 0.94,
    h: 0.94,
  };
}

export function defaultScaleCalibration() {
  return { pointA: null, pointB: null, meters: 0, metersPerUnit: 0 };
}

export function createMapDocument({
  id,
  cemeteryId = "evergreen",
  name = "Cemetery map",
  description = "",
  mapType = "main",
  status = "draft",
} = {}) {
  const now = new Date().toISOString();
  return {
    id: id || `map-${Math.random().toString(36).slice(2, 8)}`,
    cemeteryId,
    name,
    description,
    mapType,
    status,
    version: 1,
    createdAt: now,
    updatedAt: now,
    familyDefaultAerial: false,
    background: defaultBackground(),
    scale: defaultScaleCalibration(),
    draft: { elements: [] },
    published: null,
    previousPublished: null,
  };
}

function sampleMaps(cemeteryId) {
  const now = new Date().toISOString();
  const main = createMapDocument({
    id: "map-main",
    cemeteryId,
    name: "Map 01 — Main Cemetery",
    description: "Primary burial grounds with sections A through D.",
    mapType: "main",
    status: "draft",
  });
  const north = createMapDocument({
    id: "map-north",
    cemeteryId,
    name: "Map 02 — Northern Extension",
    description: "Northern land extension with additional sections.",
    mapType: "extension",
    status: "draft",
  });
  north.draft.elements = [
    {
      id: "el-sample-e",
      type: "section",
      shape: "rect",
      name: "Section E",
      code: "E",
      color: "#245B48",
      x: 0.12,
      y: 0.18,
      w: 0.34,
      h: 0.28,
      rotation: 0,
      refId: "",
      parentId: "",
      points: [],
    },
  ];
  const garden = createMapDocument({
    id: "map-garden",
    cemeteryId,
    name: "Map 03 — Memorial Garden",
    description: "Memorial garden with niche sections.",
    mapType: "garden",
    status: "published",
  });
  garden.published = {
    name: garden.name,
    familyDefaultAerial: false,
    background: defaultBackground(),
    elements: [
      {
        id: "el-garden-h",
        type: "section",
        shape: "rect",
        name: "Section H",
        code: "H",
        color: "#5d7a62",
        x: 0.2,
        y: 0.22,
        w: 0.5,
        h: 0.35,
        rotation: 12,
        refId: "",
        parentId: "",
        points: [],
      },
    ],
    publishedAt: now,
    version: 1,
  };
  garden.status = "published";
  return [main, north, garden];
}

function normalizeElement(element) {
  if (!element || typeof element !== "object") return element;
  return {
    rotation: 0,
    refId: "",
    parentId: "",
    points: [],
    ...element,
    rotation: Number(element.rotation) || 0,
  };
}

function normalizeMapDoc(doc) {
  if (!doc) return createMapDocument();
  const draftElements = Array.isArray(doc.draft?.elements) ? doc.draft.elements.map(normalizeElement) : [];
  const published = doc.published
    ? {
        ...doc.published,
        elements: Array.isArray(doc.published.elements) ? doc.published.elements.map(normalizeElement) : [],
      }
    : null;
  return {
    ...createMapDocument({ id: doc.id, cemeteryId: doc.cemeteryId, name: doc.name }),
    ...doc,
    background: { ...defaultBackground(), ...(doc.background || {}) },
    scale: { ...defaultScaleCalibration(), ...(doc.scale || {}) },
    draft: { elements: draftElements },
    published,
    previousPublished: doc.previousPublished || null,
  };
}

export function mapStats(map) {
  const elements = map?.draft?.elements || [];
  const sections = elements.filter((item) => item.type === "section").length;
  const blocks = elements.filter((item) => item.type === "block").length;
  const plots = elements.filter((item) => item.type === "plot").length;
  return { sections, blocks, plots, elements: elements.length };
}

export function activeMaps(db) {
  return Array.isArray(db?.maps) ? db.maps : [];
}

export function getMapById(db, mapId) {
  return activeMaps(db).find((item) => item.id === mapId) || null;
}

export function primaryMapId(db) {
  return activeMaps(db)[0]?.id || "map-main";
}

export function publishedSnapshot(db, mapId) {
  const map = mapId ? getMapById(db, mapId) : activeMaps(db).find((item) => item.published);
  const published = map?.published;
  if (!published || !Array.isArray(published.elements)) return null;
  if (!published.elements.length && !published.background?.imageId) return null;
  return { ...published, mapId: map.id, mapName: map.name };
}

export function publishedMapForPlot(db, plotId) {
  if (!plotId) return null;
  for (const map of activeMaps(db)) {
    const published = map.published;
    if (!published?.elements?.length) continue;
    if (published.elements.some((element) => element.type === "plot" && element.refId === plotId)) {
      return { ...published, mapId: map.id, mapName: map.name };
    }
  }
  return publishedSnapshot(db);
}

export function plotIsDrawn(snapshot, plotId) {
  if (!snapshot || !plotId) return false;
  return snapshot.elements.some((element) => element.type === "plot" && element.refId === plotId);
}

export function daysRemaining(deletedAt, now = Date.now()) {
  const elapsed = now - new Date(deletedAt).getTime();
  return Math.max(0, TRASH_RETENTION_DAYS - Math.floor(elapsed / (24 * 60 * 60 * 1000)));
}

export function applyRetentionPurge(db) {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const trash = db.trash || { records: [], maps: [] };
  const keptRecords = (trash.records || []).filter((item) => new Date(item.deletedAt).getTime() >= cutoff);
  const keptMaps = (trash.maps || []).filter((item) => new Date(item.deletedAt).getTime() >= cutoff);
  const purgedRecords = (trash.records || []).length - keptRecords.length;
  const purgedMaps = (trash.maps || []).length - keptMaps.length;
  if (!purgedRecords && !purgedMaps) return db;
  return {
    ...db,
    trash: { records: keptRecords, maps: keptMaps },
    activity: [
      {
        id: `act-purge-${Date.now()}`,
        type: "trash.purged",
        params: { records: purgedRecords, maps: purgedMaps },
        actorId: null,
        at: new Date().toISOString(),
      },
      ...(db.activity || []),
    ].slice(0, 500),
  };
}

export function migrateDb(db) {
  if (!db || typeof db !== "object" || !Array.isArray(db.records)) return db;
  const cemeteryId = db.cemetery?.id || "evergreen";
  let maps = Array.isArray(db.maps) ? db.maps.map(normalizeMapDoc) : [];

  if (!maps.length && db.customMap) {
    maps = [normalizeMapDoc({ ...db.customMap, id: db.customMap.id || "map-main", cemeteryId })];
  }
  if (!maps.length) {
    maps = sampleMaps(cemeteryId);
  } else if (maps.length === 1 && maps[0].id === "map-main" && !db.maps && !db._gallerySeeded) {
    maps = [maps[0], ...sampleMaps(cemeteryId).slice(1)];
  }

  const editorPrefs = {
    mapShortcuts: db.editorPrefs?.mapShortcuts || null,
    snapRotation: db.editorPrefs?.snapRotation !== false,
    snapInterval: db.editorPrefs?.snapInterval || 15,
  };

  const trash = {
    records: Array.isArray(db.trash?.records) ? db.trash.records : [],
    maps: Array.isArray(db.trash?.maps) ? db.trash.maps : [],
  };

  const legacyCustom = maps[0] ? { ...maps[0] } : createMapDocument({ cemeteryId });

  return applyRetentionPurge({
    ...db,
    maps,
    customMap: legacyCustom,
    trash,
    editorPrefs,
    _gallerySeeded: true,
  });
}
