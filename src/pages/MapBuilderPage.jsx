import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAdminTitle } from "../components/AdminShell";
import { FamilyMapView } from "../components/FamilyMapView";
import { MapSheet } from "../components/MapSheet";
import { Button, ConfirmDialog, Modal, useToast } from "../components/ui";
import { loadImage, prepareImage, saveImage, uploadErrorText } from "../data/imageStore";
import { getMapById, primaryMapId } from "../data/mapModel";
import { useApp } from "../data/store";
import { useI18n } from "../i18n/LanguageContext";
import { fullName, PLOT_STATUS_LABEL } from "../lib/records";
import { cloneMapElement } from "../map/elementClone";
import {
  angleFromCenter,
  clamp,
  containFrame,
  elementCenter,
  imageToSheet,
  nearRotationHandle,
  rectCornersRotated,
  resizeRect,
  rotationDegrees,
  rotationHandlePoint,
  sheetPointFromEvent,
  sheetToImage,
  snapRotation,
  topElementAt,
  translateElement,
} from "../map/geometry";
import { MapShortcutsModal } from "../map/MapShortcutsModal";
import {
  DEFAULT_MAP_SHORTCUTS,
  formatShortcut,
  isTypingTarget,
  matchShortcut,
  mergeShortcuts,
} from "../map/shortcuts";

const TOOLS = [
  ["select", "Select"],
  ["background", "Background"],
  ["section", "Draw section"],
  ["polygon", "Polygon section"],
  ["block", "Draw block"],
  ["plot", "Add burial plot"],
  ["road", "Draw pathway"],
  ["landmark", "Add landmark"],
  ["entrance", "Add entrance"],
];

function newId() {
  return `el-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function baseElement(type, point) {
  const size = type === "plot" ? { w: 0.045, h: 0.035 } : { w: 0.08, h: 0.06 };
  return {
    id: newId(),
    type,
    shape: "rect",
    parentId: "",
    refId: "",
    name: type === "entrance" ? "Main entrance" : "",
    code: "",
    color: type === "block" ? "#5d7a62" : "#245B48",
    description: "",
    landmarkType: type === "entrance" ? "entrance" : "landmark",
    x: point.x - size.w / 2,
    y: point.y - size.h / 2,
    w: size.w,
    h: size.h,
    points: [],
    rotation: 0,
  };
}

const TOOL_SHORTCUT = {
  select: "toolSelect",
  background: "toolBackground",
  section: "toolSection",
  block: "toolBlock",
  plot: "toolPlot",
  road: "toolRoad",
  landmark: "toolLandmark",
};

export function MapBuilderPage() {
  const { t } = useI18n();
  const { mapId: routeMapId } = useParams();
  const {
    db,
    can,
    saveMapDraft,
    publishMap,
    restorePublishedMap,
    updateEditorPrefs,
  } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const mapId = routeMapId || primaryMapId(db);
  const map = getMapById(db, mapId) || getMapById(db, primaryMapId(db));
  const stageRef = useRef(null);
  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const elementsRef = useRef([]);
  const backgroundRef = useRef(map.background);
  const fileRef = useRef(null);
  const [name, setName] = useState(map.name);
  const [familyDefaultAerial, setFamilyDefaultAerial] = useState(map.familyDefaultAerial);
  const [background, setBackground] = useState(map.background);
  const [elements, setElements] = useState(map.draft.elements);
  const [selectedId, setSelectedId] = useState("");
  const [tool, setTool] = useState("select");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imageUrl, setImageUrl] = useState("");
  const [draftRect, setDraftRect] = useState(null);
  const draftRectRef = useRef(null);
  const [draftPoints, setDraftPoints] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [plotQuery, setPlotQuery] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [calibrateStep, setCalibrateStep] = useState(0);
  const calibrateStepRef = useRef(0);
  calibrateStepRef.current = calibrateStep;
  const [scaleState, setScaleState] = useState(map?.scale || { pointA: null, pointB: null, meters: 0, metersPerUnit: 0 });
  const clipboardRef = useRef(null);
  const pasteCountRef = useRef(0);
  const shortcuts = useMemo(
    () => mergeShortcuts(db.editorPrefs?.mapShortcuts),
    [db.editorPrefs?.mapShortcuts],
  );
  useAdminTitle(t("Cemetery Map Builder"));

  useEffect(() => {
    if (!getMapById(db, routeMapId)) {
      navigate(`/admin/map/builder/${primaryMapId(db)}`, { replace: true });
    }
  }, [db, routeMapId, navigate]);

  useEffect(() => {
    if (!map) return;
    setName(map.name);
    setFamilyDefaultAerial(map.familyDefaultAerial);
    setBackground(map.background);
    setElements(map.draft.elements);
    setSelectedId("");
    setScaleState(map.scale || { pointA: null, pointB: null, meters: 0, metersPerUnit: 0 });
  }, [map?.id]);

  elementsRef.current = elements;
  backgroundRef.current = background;

  useEffect(() => {
    let url = "";
    let cancelled = false;
    if (!background.imageId) return undefined;
    loadImage(background.imageId)
      .then((record) => {
        if (cancelled || !record?.blob) return;
        url = URL.createObjectURL(record.blob);
        setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setUploadError(t("The reference image could not be loaded."));
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [background.imageId, t]);

  const plotsById = useMemo(() => {
    const next = {};
    db.plots.forEach((plot) => {
      next[plot.id] = plot;
    });
    return next;
  }, [db.plots]);

  const selected = elements.find((element) => element.id === selectedId) || null;
  const publishedMatch = JSON.stringify({
    elements: map.published?.elements || [],
    background: map.published?.background || null,
  }) === JSON.stringify({ elements, background });

  function rememberHistory() {
    pastRef.current.push(JSON.stringify({ elements: elementsRef.current, background: backgroundRef.current }));
    if (pastRef.current.length > 40) pastRef.current.shift();
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(JSON.stringify({ elements: elementsRef.current, background: backgroundRef.current }));
    const data = JSON.parse(previous);
    setElements(data.elements);
    setBackground(data.background);
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(JSON.stringify({ elements: elementsRef.current, background: backgroundRef.current }));
    const data = JSON.parse(next);
    setElements(data.elements);
    setBackground(data.background);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }

  function updateSelected(patch) {
    setElements((list) => list.map((element) => (element.id === selectedId ? { ...element, ...patch } : element)));
  }

  function payload() {
    return {
      name: name.trim() || "Cemetery map",
      familyDefaultAerial,
      background,
      elements,
      scale: scaleState,
    };
  }

  function saveDraft(silent = false) {
    const result = saveMapDraft(mapId, payload());
    if (!result.ok) {
      toast(t("The draft could not be saved in this browser. Try a smaller reference image."), "error");
      return false;
    }
    if (!silent) {
      toast(map.published ? t("Draft saved. Families still see the published map.") : t("Draft saved. Publish the map before families can see it."));
    }
    return true;
  }

  async function useFile(file) {
    setUploadError("");
    try {
      const prepared = await prepareImage(file);
      const imageId = `img-${Date.now().toString(36)}`;
      await saveImage(imageId, prepared);
      rememberHistory();
      const frame = containFrame(prepared.width, prepared.height);
      setBackground((current) => ({
        ...current,
        ...frame,
        imageId,
        width: prepared.width,
        height: prepared.height,
      }));
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(prepared.blob);
      });
      toast(t("Reference image added."));
    } catch (error) {
      setUploadError(t(uploadErrorText(error.code)));
    }
  }

  function removeImage() {
    rememberHistory();
    setBackground((current) => ({ ...current, imageId: "", width: 0, height: 0 }));
    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }

  function resetBackground() {
    rememberHistory();
    const frame = containFrame(background.width, background.height);
    setBackground((current) => ({ ...current, ...frame }));
  }

  function finishShape() {
    if (draftPoints.length < (tool === "road" ? 2 : 3)) return;
    rememberHistory();
    const element = {
      ...baseElement(tool === "road" ? "road" : "section", draftPoints[0]),
      shape: tool === "road" ? "polyline" : "polygon",
      name: tool === "road" ? "Pathway" : "",
      points: draftPoints,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    };
    setElements((list) => [...list, element]);
    setSelectedId(element.id);
    setDraftPoints([]);
    setTool("select");
  }

  function removeSelected() {
    if (!selectedId) return;
    rememberHistory();
    setElements((list) => list.filter((element) => element.id !== selectedId && element.parentId !== selectedId));
    setSelectedId("");
  }

  function copySelection() {
    if (!selected) return;
    clipboardRef.current = JSON.parse(JSON.stringify(selected));
    pasteCountRef.current = 0;
  }

  function pasteClipboard() {
    if (!clipboardRef.current) return;
    rememberHistory();
    pasteCountRef.current += 1;
    const clone = cloneMapElement(clipboardRef.current, pasteCountRef.current);
    setElements((list) => [...list, clone]);
    setSelectedId(clone.id);
  }

  function duplicateSelection() {
    copySelection();
    pasteClipboard();
  }

  useEffect(() => {
    function onKey(event) {
      if (isTypingTarget(event.target)) {
        if (event.key === "Enter" && (tool === "polygon" || tool === "road")) finishShape();
        return;
      }
      if (matchShortcut(event, shortcuts, "undo")) {
        event.preventDefault();
        undo();
        return;
      }
      if (matchShortcut(event, shortcuts, "redo")) {
        event.preventDefault();
        redo();
        return;
      }
      if (matchShortcut(event, shortcuts, "save")) {
        event.preventDefault();
        saveDraft(false);
        return;
      }
      if (matchShortcut(event, shortcuts, "copy")) {
        event.preventDefault();
        copySelection();
        return;
      }
      if (matchShortcut(event, shortcuts, "paste")) {
        event.preventDefault();
        pasteClipboard();
        return;
      }
      if (matchShortcut(event, shortcuts, "duplicate")) {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (matchShortcut(event, shortcuts, "delete")) {
        event.preventDefault();
        removeSelected();
        return;
      }
      if (matchShortcut(event, shortcuts, "zoomIn")) {
        event.preventDefault();
        setZoom((value) => Math.min(4, value * 1.12));
        return;
      }
      if (matchShortcut(event, shortcuts, "zoomOut")) {
        event.preventDefault();
        setZoom((value) => Math.max(0.45, value / 1.12));
        return;
      }
      if (matchShortcut(event, shortcuts, "fit")) {
        event.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }
      if (matchShortcut(event, shortcuts, "deselect")) {
        event.preventDefault();
        setSelectedId("");
        setDraftPoints([]);
        draftRectRef.current = null;
        setDraftRect(null);
        return;
      }
      Object.entries(TOOL_SHORTCUT).forEach(([toolId, actionId]) => {
        if (matchShortcut(event, shortcuts, actionId)) {
          event.preventDefault();
          setTool(toolId);
          setDraftPoints([]);
        }
      });
      if (event.key === "Enter" && (tool === "polygon" || tool === "road")) finishShape();
      if (selected && (event.key === "ArrowLeft" || event.key === "ArrowRight") && event.shiftKey) {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        const interval = db.editorPrefs?.snapInterval || 15;
        const snap = db.editorPrefs?.snapRotation !== false;
        updateSelected({
          rotation: snapRotation(rotationDegrees(selected) + delta, interval, snap),
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Keyboard actions close over the latest draft and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, draftPoints, selectedId, selected, shortcuts, db.editorPrefs]);

  function imagePoint(event) {
    return sheetToImage(sheetPointFromEvent(event, sheetRef.current), backgroundRef.current);
  }

  function onPointerDown(event) {
    if (event.button !== 0 || !sheetRef.current) return;
    const sheetPoint = sheetPointFromEvent(event, sheetRef.current);
    const point = sheetToImage(sheetPoint, backgroundRef.current);
    if (calibrateStepRef.current === 1) {
      setScaleState((current) => ({ ...current, pointA: point, pointB: null, meters: 0, metersPerUnit: 0 }));
      setCalibrateStep(2);
      toast(t("Click the second calibration point."));
      return;
    }
    if (calibrateStepRef.current === 2) {
      setScaleState((current) => ({ ...current, pointB: point }));
      setCalibrateStep(0);
      setPreviewOpen(true);
      toast(t("Enter the distance between the two points."));
      return;
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* Capture can be rejected for this pointer. Drag still follows the stage. */
    }

    if (tool === "polygon" || tool === "road") {
      setDraftPoints((points) => [...points, point]);
      return;
    }
    if (tool === "landmark" || tool === "entrance") {
      rememberHistory();
      const element = baseElement(tool, point);
      setElements((list) => [...list, element]);
      setSelectedId(element.id);
      setTool("select");
      return;
    }
    if (tool === "background" && !backgroundRef.current.locked) {
      const frame = backgroundRef.current;
      const corners = [
        { id: "se", x: frame.x + frame.w, y: frame.y + frame.h },
        { id: "nw", x: frame.x, y: frame.y },
      ];
      const corner = corners.find((item) => Math.hypot(item.x - sheetPoint.x, item.y - sheetPoint.y) < 0.03);
      rememberHistory();
      dragRef.current = corner
        ? { kind: "background-resize", corner: corner.id, start: { ...frame }, sheet: sheetPoint }
        : { kind: "background", start: { ...frame }, sheet: sheetPoint };
      return;
    }
    if (tool === "section" || tool === "block" || tool === "plot") {
      rememberHistory();
      dragRef.current = { kind: "draw", type: tool, origin: point };
      const nextDraft = { ...baseElement(tool, point), id: "draft", x: point.x, y: point.y, w: 0.01, h: 0.01 };
      draftRectRef.current = nextDraft;
      setDraftRect(nextDraft);
      return;
    }

    const selectedElement = elementsRef.current.find((element) => element.id === selectedId);
    if (selectedElement && selectedElement.shape !== "polyline") {
      if (nearRotationHandle(selectedElement, point)) {
        rememberHistory();
        const center = elementCenter(selectedElement);
        dragRef.current = {
          kind: "rotate",
          id: selectedElement.id,
          center,
          startAngle: angleFromCenter(center, point),
          startRotation: rotationDegrees(selectedElement),
        };
        return;
      }
    }
    if (selectedElement?.shape !== "polygon" && selectedElement?.shape !== "polyline") {
      const handle = selectedElement
        ? rectCornersRotated(selectedElement)
            .map((corner) => ({ ...corner, sheet: imageToSheet(corner, backgroundRef.current) }))
            .find((corner) => Math.hypot(corner.sheet.x - sheetPoint.x, corner.sheet.y - sheetPoint.y) < 0.03)
        : null;
      if (handle) {
        rememberHistory();
        dragRef.current = { kind: "resize", corner: handle.id, start: { ...selectedElement }, id: selectedElement.id };
        return;
      }
    }
    const hit = topElementAt(elementsRef.current, point);
    if (hit) {
      rememberHistory();
      setSelectedId(hit.id);
      dragRef.current = { kind: "move", id: hit.id, origin: point, start: hit };
      return;
    }
    setSelectedId("");
    dragRef.current = { kind: "pan", x: event.clientX, y: event.clientY, pan };
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      setPan({ x: drag.pan.x + (event.clientX - drag.x), y: drag.pan.y + (event.clientY - drag.y) });
      return;
    }
    const point = imagePoint(event);
    const sheetPoint = sheetPointFromEvent(event, sheetRef.current);
    if (drag.kind === "draw") {
      const x = Math.min(drag.origin.x, point.x);
      const y = Math.min(drag.origin.y, point.y);
      const nextDraft = {
        ...baseElement(drag.type, drag.origin),
        id: "draft",
        x,
        y,
        w: Math.max(0.01, Math.abs(point.x - drag.origin.x)),
        h: Math.max(0.01, Math.abs(point.y - drag.origin.y)),
      };
      draftRectRef.current = nextDraft;
      setDraftRect(nextDraft);
      return;
    }
    if (drag.kind === "move") {
      const dx = point.x - drag.origin.x;
      const dy = point.y - drag.origin.y;
      setElements((list) => list.map((element) => (element.id === drag.id ? translateElement(drag.start, dx, dy) : element)));
      return;
    }
    if (drag.kind === "resize") {
      const next = resizeRect(drag.start, drag.corner, point);
      setElements((list) => list.map((element) => (element.id === drag.id ? { ...element, ...next } : element)));
      return;
    }
    if (drag.kind === "rotate") {
      const angle = angleFromCenter(drag.center, point);
      let next = drag.startRotation + (angle - drag.startAngle);
      const interval = db.editorPrefs?.snapInterval || 15;
      const snap = db.editorPrefs?.snapRotation !== false;
      if (snap) next = snapRotation(next, interval, true);
      setElements((list) => list.map((element) => (element.id === drag.id ? { ...element, rotation: next } : element)));
      return;
    }
    if (drag.kind === "background") {
      const dx = sheetPoint.x - drag.sheet.x;
      const dy = sheetPoint.y - drag.sheet.y;
      setBackground((current) => ({
        ...current,
        x: clamp(drag.start.x + dx, 0, 1 - current.w),
        y: clamp(drag.start.y + dy, 0, 1 - current.h),
      }));
      return;
    }
    if (drag.kind === "background-resize") {
      const aspect = backgroundRef.current.width && backgroundRef.current.height
        ? backgroundRef.current.width / backgroundRef.current.height
        : 4 / 3;
      const dw = sheetPoint.x - drag.sheet.x;
      const w = clamp(drag.start.w + (drag.corner === "nw" ? -dw : dw), 0.12, 1);
      const h = clamp((w * (4 / 3)) / aspect, 0.12, 1);
      setBackground((current) => ({ ...current, w, h }));
    }
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    const drawn = draftRectRef.current;
    if (drag?.kind === "draw" && drawn && drawn.w > 0.015 && drawn.h > 0.015) {
      const element = { ...drawn, id: newId() };
      setElements((list) => [...list, element]);
      setSelectedId(element.id);
      setTool("select");
    }
    draftRectRef.current = null;
    setDraftRect(null);
  }

  if (!can("map.edit")) {
    return <p className="warn-banner">{t("Your role cannot edit the cemetery map.")}</p>;
  }

  const visibleElements = draftRect ? [...elements, draftRect] : elements;
  const shapePreview = draftPoints.length
    ? [{
        id: "draft-shape",
        type: tool === "road" ? "road" : "section",
        shape: tool === "road" ? "polyline" : "polygon",
        points: draftPoints,
        color: "#245B48",
        name: "",
      }]
    : [];

  const groups = [
    ["section", "Sections"],
    ["block", "Blocks"],
    ["plot", "Burial plots"],
    ["road", "Pathways"],
    ["landmark", "Landmarks"],
    ["entrance", "Entrances"],
  ];

  return (
    <div className="stack">
      <p className="lede">{t("Build a cemetery map from a reference image you are authorized to use. Families see a map only after you publish it.")}</p>
      <p className={map.published ? "info-banner" : "warn-banner"}>
        {map.published
          ? publishedMatch
            ? t("The published map matches this draft.")
            : t("Unpublished changes stay in the draft. Families still see the last published map.")
          : t("Nothing is published yet. Families still see the illustrated plan.")}
      </p>
      <div className="builder-toolbar">
        <Button onClick={() => fileRef.current?.click()}>{t("Upload background image")}</Button>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) useFile(file);
            event.target.value = "";
          }}
        />
        {TOOLS.map(([id, label]) => {
          const action = TOOL_SHORTCUT[id];
          const hint = action ? formatShortcut(shortcuts[action]) : "";
          return (
            <Button
              key={id}
              variant={tool === id ? "primary" : "secondary"}
              aria-pressed={tool === id}
              title={hint ? `${t(label)} (${hint})` : t(label)}
              onClick={() => { setTool(id); setDraftPoints([]); }}
            >
              {t(label)}
            </Button>
          );
        })}
        <Button variant="ghost" onClick={() => setShortcutsOpen(true)}>{t("Keyboard shortcuts")}</Button>
        <Button variant="ghost" onClick={() => setPreviewOpen(true)}>{t("Map preview & scale")}</Button>
        <Button variant="secondary" onClick={undo} disabled={!canUndo}>{t("Undo")}</Button>
        <Button variant="secondary" onClick={redo} disabled={!canRedo}>{t("Redo")}</Button>
        <Button variant="secondary" onClick={() => saveDraft(false)}>{t("Save draft")}</Button>
        <Button variant="secondary" onClick={() => { if (saveDraft(true)) navigate(`/admin/map/preview/${mapId}`); }}>{t("Preview family view")}</Button>
        <Button onClick={() => setConfirm("publish")}>{t("Publish map")}</Button>
        <Button variant="ghost" onClick={() => setConfirm("restore")} disabled={!map.previousPublished}>{t("Restore previous published map")}</Button>
      </div>
      {uploadError ? <p className="form-alert" role="alert">{uploadError}</p> : null}
      {(tool === "polygon" || tool === "road") && draftPoints.length ? (
        <div className="btn-row">
          <Button onClick={finishShape}>{t("Finish shape")}</Button>
          <Button variant="ghost" onClick={() => setDraftPoints([])}>{t("Cancel shape")}</Button>
        </div>
      ) : null}
      <div className="builder">
        <aside className="card card-pad stack builder-side">
          <h2>{t("Map layers")}</h2>
          {groups.map(([type, label]) => {
            const items = elements.filter((element) => element.type === type);
            if (!items.length) return null;
            return (
              <div key={type}>
                <h3>{t(label)}</h3>
                <div className="layer-list">
                  {items.map((element) => (
                    <button
                      key={element.id}
                      type="button"
                      aria-pressed={element.id === selectedId}
                      onClick={() => setSelectedId(element.id)}
                    >
                      {element.name || element.code || plotsById[element.refId]?.lot || t(label)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!elements.length ? <p>{t("No shapes yet. Choose a drawing tool and drag on the map.")}</p> : null}
          <h2>{t("Map settings")}</h2>
          <label htmlFor="map-name">{t("Map name")}</label>
          <input id="map-name" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="check-row">
            <input type="checkbox" checked={familyDefaultAerial} onChange={(event) => setFamilyDefaultAerial(event.target.checked)} />
            <span>{t("Show the aerial image to families by default")}</span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={background.locked} onChange={(event) => setBackground((current) => ({ ...current, locked: event.target.checked }))} />
            <span>{t("Lock background image")}</span>
          </label>
          <label htmlFor="builder-opacity">{t("Background opacity")}</label>
          <input
            id="builder-opacity"
            type="range"
            min="0"
            max="100"
            value={Math.round((background.opacity ?? 0.55) * 100)}
            onChange={(event) => setBackground((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))}
          />
          <div className="builder-side-actions">
            <Button variant="secondary" onClick={resetBackground}>{t("Reset background position")}</Button>
            <Button variant="ghost" onClick={removeImage} disabled={!background.imageId}>{t("Remove image")}</Button>
          </div>
          <p className="hint">{t("Use a photo the cemetery owns or is allowed to use. Do not upload imagery you are not authorized to use.")}</p>
        </aside>
        <div className="stack">
          <MapSheet
            stageRef={stageRef}
            sheetRef={sheetRef}
            background={background}
            elements={[...visibleElements, ...shapePreview]}
            imageUrl={imageUrl}
            showImage
            imageOpacity={background.opacity ?? 0.55}
            plotsById={plotsById}
            selectedId={selectedId}
            zoom={zoom}
            pan={pan}
            onZoom={setZoom}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDropImage={useFile}
            label={t("Map builder canvas")}
            destinationLabel={t("Destination")}
            statusLabel={(status) => t(status === "occupied" ? "Occupied" : status === "reserved" ? "Reserved" : "Available")}
            overlay={selected && selected.shape !== "polyline" ? (
              <svg className="builder-svg builder-handles" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                {selected.shape !== "polygon" ? rectCornersRotated(selected).map((corner) => {
                  const sheet = imageToSheet(corner, background);
                  return <rect key={corner.id} x={sheet.x * 1000 - 8} y={sheet.y * 1000 - 8} width="16" height="16" fill="#ffffff" stroke="#245B48" strokeWidth="3" />;
                }) : null}
                {(() => {
                  const handle = rotationHandlePoint(selected);
                  const sheet = imageToSheet(handle, background);
                  return (
                    <circle cx={sheet.x * 1000} cy={sheet.y * 1000} r="10" fill="#C7A66A" stroke="#245B48" strokeWidth="3" />
                  );
                })()}
              </svg>
            ) : null}
          />
          <div className="builder-toolbar">
            <Button variant="secondary" onClick={() => setZoom((value) => Math.min(4, value * 1.15))}>{t("Zoom in")}</Button>
            <Button variant="secondary" onClick={() => setZoom((value) => Math.max(0.45, value / 1.15))}>{t("Zoom out")}</Button>
            <Button variant="secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{t("Fit to screen")}</Button>
            <Button variant="ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setTool("select"); setDraftPoints([]); }}>{t("Reset view")}</Button>
          </div>
        </div>
        <aside className="card card-pad stack builder-side">
          <h2>{t("Properties")}</h2>
          {!selected ? <p>{t("Select a shape to edit its name, color, and links.")}</p> : null}
          {selected ? (
            <>
              <p className="eyebrow">{t(selected.type)}</p>
              {selected.type !== "road" && selected.type !== "plot" ? (
                <>
                  <label htmlFor="el-name">{t("Name")}</label>
                  <input id="el-name" value={selected.name} onFocus={rememberHistory} onChange={(event) => updateSelected({ name: event.target.value })} />
                </>
              ) : null}
              {selected.type === "section" ? (
                <>
                  <label htmlFor="el-code">{t("Section code")}</label>
                  <input id="el-code" value={selected.code} onFocus={rememberHistory} onChange={(event) => updateSelected({ code: event.target.value })} />
                  <label htmlFor="el-section">{t("Existing section")}</label>
                  <select id="el-section" value={selected.refId} onChange={(event) => { rememberHistory(); updateSelected({ refId: event.target.value }); }}>
                    <option value="">{t("Not linked")}</option>
                    {db.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                  </select>
                </>
              ) : null}
              {selected.type === "block" ? (
                <>
                  <label htmlFor="el-parent">{t("Parent section")}</label>
                  <select id="el-parent" value={selected.parentId} onChange={(event) => { rememberHistory(); updateSelected({ parentId: event.target.value }); }}>
                    <option value="">{t("None")}</option>
                    {elements.filter((element) => element.type === "section").map((element) => (
                      <option key={element.id} value={element.id}>{element.name || element.code || element.id}</option>
                    ))}
                  </select>
                  <label htmlFor="el-block">{t("Existing block")}</label>
                  <select id="el-block" value={selected.refId} onChange={(event) => { rememberHistory(); updateSelected({ refId: event.target.value }); }}>
                    <option value="">{t("Not linked")}</option>
                    {db.blocks.map((block) => <option key={block.id} value={block.id}>{block.id}</option>)}
                  </select>
                </>
              ) : null}
              {selected.type === "plot" ? (
                <>
                  <label htmlFor="plot-search">{t("Link burial plot")}</label>
                  <input id="plot-search" value={plotQuery} placeholder={t("Search lot or plot ID")} onChange={(event) => setPlotQuery(event.target.value)} />
                  <select
                    id="el-plot"
                    size="6"
                    value={selected.refId}
                    onChange={(event) => { rememberHistory(); updateSelected({ refId: event.target.value, name: plotsById[event.target.value]?.lot || "" }); }}
                  >
                    <option value="">{t("Not linked")}</option>
                    {db.plots
                      .filter((plot) => {
                        const query = plotQuery.trim().toLowerCase();
                        if (!query) return true;
                        return plot.id.toLowerCase().includes(query) || String(plot.lot).includes(query);
                      })
                      .slice(0, 80)
                      .map((plot) => (
                        <option key={plot.id} value={plot.id}>
                          {plot.id} · {t(PLOT_STATUS_LABEL[plot.status] || plot.status)}
                        </option>
                      ))}
                  </select>
                  <p>{t("Status")}: {selected.refId ? t(PLOT_STATUS_LABEL[plotsById[selected.refId]?.status] || "Available") : t("Not linked")}</p>
                  <p>
                    {t("Associated record")}:{" "}
                    {db.records.filter((record) => record.plotId === selected.refId && record.status !== "archived").map((record) => fullName(record)).join(", ") || t("None")}
                  </p>
                  <p className="hint">{t("Plot assignment stays on the burial record. The map only stores the shape.")}</p>
                </>
              ) : null}
              {selected.type === "landmark" || selected.type === "entrance" ? (
                <>
                  <label htmlFor="el-kind">{t("Type")}</label>
                  <input id="el-kind" value={selected.landmarkType} onFocus={rememberHistory} onChange={(event) => updateSelected({ landmarkType: event.target.value })} />
                </>
              ) : null}
              {selected.description !== undefined && selected.type !== "plot" && selected.type !== "road" ? (
                <>
                  <label htmlFor="el-desc">{t("Description")}</label>
                  <textarea id="el-desc" value={selected.description} onFocus={rememberHistory} onChange={(event) => updateSelected({ description: event.target.value })} />
                </>
              ) : null}
              {selected.type === "section" || selected.type === "block" ? (
                <>
                  <label htmlFor="el-color">{t("Color")}</label>
                  <input id="el-color" type="color" value={selected.color || "#245B48"} onChange={(event) => updateSelected({ color: event.target.value })} />
                </>
              ) : null}
              {selected.shape !== "polyline" ? (
                <>
                  <label htmlFor="el-rotation">{t("Rotation (degrees)")}</label>
                  <div className="row wrap-row">
                    <input
                      id="el-rotation"
                      type="number"
                      step="1"
                      value={Math.round(rotationDegrees(selected))}
                      onFocus={rememberHistory}
                      onChange={(event) => {
                        const interval = db.editorPrefs?.snapInterval || 15;
                        const snap = db.editorPrefs?.snapRotation !== false;
                        updateSelected({ rotation: snapRotation(Number(event.target.value), interval, snap) });
                      }}
                    />
                    <Button variant="ghost" onClick={() => updateSelected({ rotation: 0 })}>{t("Reset rotation")}</Button>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={db.editorPrefs?.snapRotation !== false}
                      onChange={(event) => updateEditorPrefs({ snapRotation: event.target.checked })}
                    />
                    <span>{t("Snap rotation ({degrees}°)", { degrees: db.editorPrefs?.snapInterval || 15 })}</span>
                  </label>
                </>
              ) : null}
              {selected.shape !== "polygon" && selected.shape !== "polyline" ? (
                <div className="grid-2">
                  {["x", "y", "w", "h"].map((key) => (
                    <label key={key}>
                      {key.toUpperCase()}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={Number((selected[key] * 100).toFixed(1))}
                        onFocus={rememberHistory}
                        onChange={(event) => updateSelected({ [key]: clamp(Number(event.target.value) / 100, 0, 1) })}
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              <Button variant="danger" onClick={removeSelected}>{t("Delete element")}</Button>
            </>
          ) : null}
        </aside>
      </div>
      <ConfirmDialog
        open={confirm === "publish"}
        title={t("Publish this map?")}
        message={t("Families will see this version. Burial records and plot assignments will not change.")}
        confirmLabel={t("Publish map")}
        tone="primary"
        onClose={() => setConfirm("")}
        onConfirm={() => {
          if (!saveDraft(true)) return;
          const result = publishMap(mapId);
          setConfirm("");
          if (!result.ok) toast(t("The map could not be published."), "error");
          else toast(t("Map published."));
        }}
      />
      <ConfirmDialog
        open={confirm === "restore"}
        title={t("Restore the previous published map?")}
        message={t("Families will see the earlier published version. This draft stays as it is.")}
        confirmLabel={t("Restore published map")}
        tone="primary"
        onClose={() => setConfirm("")}
        onConfirm={() => {
          const result = restorePublishedMap(mapId);
          setConfirm("");
          toast(result.ok ? t("The previous published map is visible to families.") : t(result.error), result.ok ? "success" : "error");
        }}
      />
      <MapShortcutsModal
        open={shortcutsOpen}
        shortcuts={shortcuts}
        onClose={() => setShortcutsOpen(false)}
        onSave={(next) => {
          updateEditorPrefs({ mapShortcuts: next });
          toast(t("Keyboard shortcuts saved."));
        }}
        onRestoreDefaults={() => updateEditorPrefs({ mapShortcuts: DEFAULT_MAP_SHORTCUTS })}
      />
      <Modal
        open={previewOpen}
        title={t("Map preview & scale")}
        description={t("Review canvas dimensions and optional real-world calibration.")}
        onClose={() => { setPreviewOpen(false); setCalibrateStep(0); }}
      >
        <div className="stack">
          <p>{t("Canvas")}: 4:3 · {t("Zoom")}: {Math.round(zoom * 100)}%</p>
          <p>{t("Background image")}: {background.width || "—"} × {background.height || "—"} px</p>
          <p>{t("Map aspect ratio")}: {(background.w / background.h).toFixed(2)}</p>
          {scaleState.metersPerUnit > 0 ? (
            <p>{t("Calibrated scale")}: 1 {t("map unit")} = {scaleState.metersPerUnit.toFixed(3)} m</p>
          ) : (
            <p>{t("Scale not calibrated")}</p>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            {t("Fit to screen")}
          </Button>
          <p className="hint">{t("Calibration: click two points on the map, then enter the real distance in meters.")}</p>
          <Button
            variant="ghost"
            onClick={() => {
              setCalibrateStep(1);
              toast(t("Click the first calibration point on the map."));
              setPreviewOpen(false);
            }}
          >
            {t("Start calibration")}
          </Button>
          {calibrateStep === 2 && scaleState.pointA && scaleState.pointB ? (
            <label>
              {t("Distance between points (meters)")}
              <input
                type="number"
                min="0"
                step="0.1"
                value={scaleState.meters || ""}
                onChange={(event) => {
                  const meters = Number(event.target.value);
                  const dx = scaleState.pointB.x - scaleState.pointA.x;
                  const dy = scaleState.pointB.y - scaleState.pointA.y;
                  const units = Math.hypot(dx, dy);
                  setScaleState((current) => ({
                    ...current,
                    meters,
                    metersPerUnit: units > 0 ? meters / units : 0,
                  }));
                }}
              />
            </label>
          ) : null}
        </div>
      </Modal>
      <p><Link to="/admin/map/gallery">{t("Map Gallery")}</Link> · <Link to="/admin/map">{t("Cemetery map")}</Link></p>
    </div>
  );
}

export function MapPreviewPage() {
  const { t } = useI18n();
  const { mapId } = useParams();
  const { db, can } = useApp();
  useAdminTitle(t("Family map preview"));
  if (!can("map.edit")) return <p className="warn-banner">{t("Your role cannot preview unpublished map changes.")}</p>;
  const map = getMapById(db, mapId) || getMapById(db, primaryMapId(db));
  const snapshot = {
    ...map.draft,
    background: map.background,
    familyDefaultAerial: map.familyDefaultAerial,
    scale: map.scale,
    elements: map.draft.elements,
  };
  return (
    <div className="stack">
      <p className="info-banner">{t("This is the draft families would see. It is not public until you publish it.")}</p>
      <FamilyMapView snapshot={snapshot} plots={db.plots} />
      <Button to={`/admin/map/builder/${map.id}`}>{t("Return to map builder")}</Button>
    </div>
  );
}
