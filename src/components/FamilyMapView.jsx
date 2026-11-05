import { useEffect, useMemo, useRef, useState } from "react";
import { loadImage } from "../data/imageStore";
import { useI18n } from "../i18n/LanguageContext";
import { focusPan } from "../map/geometry";
import { Button } from "./ui";
import { MapSheet } from "./MapSheet";

export function FamilyMapView({ snapshot, plots, destinationPlotId = "", resetToken = 0 }) {
  const { t } = useI18n();
  const stageRef = useRef(null);
  const sheetRef = useRef(null);
  const dragRef = useRef(null);
  const [imageUrl, setImageUrl] = useState("");
  const [aerial, setAerial] = useState(Boolean(snapshot?.familyDefaultAerial));
  const [opacity, setOpacity] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const plotsById = useMemo(() => {
    const map = {};
    plots.forEach((plot) => {
      map[plot.id] = plot;
    });
    return map;
  }, [plots]);

  const destination = snapshot.elements.find((element) => element.type === "plot" && element.refId === destinationPlotId);

  useEffect(() => {
    let url = "";
    let cancelled = false;
    const imageId = snapshot.background?.imageId;
    if (!imageId) {
      setImageUrl("");
      return undefined;
    }
    loadImage(imageId)
      .then((record) => {
        if (cancelled || !record?.blob) return;
        url = URL.createObjectURL(record.blob);
        setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImageUrl("");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshot.background?.imageId]);

  useEffect(() => {
    setAerial(Boolean(snapshot.familyDefaultAerial));
    setOpacity(50);
  }, [snapshot.familyDefaultAerial, snapshot.publishedAt]);

  function fit(nextZoom = destination ? 1.8 : 1) {
    if (!destination) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    setZoom(nextZoom);
    setPan(focusPan(stageRef.current, destination, snapshot.background, nextZoom));
  }

  useEffect(() => {
    fit(destination ? 1.8 : 1);
    // Recenter when the visitor asks, or when the published destination changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationPlotId, resetToken, snapshot.publishedAt]);

  function onPointerDown(event) {
    if (event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* Capture can be rejected for this pointer. Panning still follows the pointer. */
    }
    dragRef.current = { x: event.clientX, y: event.clientY, pan };
  }

  function onPointerMove(event) {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.pan.x + (event.clientX - dragRef.current.x),
      y: dragRef.current.pan.y + (event.clientY - dragRef.current.y),
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="stack">
      <MapSheet
        stageRef={stageRef}
        sheetRef={sheetRef}
        background={snapshot.background}
        elements={snapshot.elements}
        imageUrl={imageUrl}
        showImage={aerial && Boolean(imageUrl)}
        imageOpacity={opacity / 100}
        plotsById={plotsById}
        destinationPlotId={destinationPlotId}
        zoom={zoom}
        pan={pan}
        onZoom={setZoom}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        label={t("Published cemetery map")}
        destinationLabel={t("Destination")}
        statusLabel={(status) => t(status === "occupied" ? "Occupied" : status === "reserved" ? "Reserved" : "Available")}
      />
      <div className="builder-toolbar">
        <Button variant="secondary" onClick={() => setZoom((value) => Math.min(4, value * 1.15))}>{t("Zoom in")}</Button>
        <Button variant="secondary" onClick={() => setZoom((value) => Math.max(0.45, value / 1.15))}>{t("Zoom out")}</Button>
        <Button variant="secondary" onClick={() => fit(destination ? 1.8 : 1)}>{t("Fit to screen")}</Button>
        <Button variant="ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{t("Reset map view")}</Button>
      </div>
      <div className="card card-pad stack">
        <label className="check-row">
          <input
            type="checkbox"
            checked={aerial}
            onChange={(event) => setAerial(event.target.checked)}
          />
          <span>{t("Show Aerial Reference")}</span>
        </label>
        {aerial ? (
          <label htmlFor="aerial-opacity">
            {t("Background opacity")}
            <input
              id="aerial-opacity"
              type="range"
              min="0"
              max="100"
              step="5"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
            />
            <span className="hint">{opacity}%</span>
          </label>
        ) : (
          <p className="hint">{t("The custom map is shown without the reference photo.")}</p>
        )}
        {!imageUrl && snapshot.background?.imageId ? (
          <p className="warn-banner" role="status">{t("The reference image is not available in this browser.")}</p>
        ) : null}
      </div>
      <ul className="legend">
        <li><span className="swatch swatch-available" aria-hidden="true" />{t("Available")}</li>
        <li><span className="swatch swatch-occupied" aria-hidden="true" />{t("Occupied")}</li>
        <li><span className="swatch swatch-reserved" aria-hidden="true" />{t("Reserved")}</li>
        <li><span className="swatch swatch-destination" aria-hidden="true" />{t("Selected")}</li>
      </ul>
    </div>
  );
}
