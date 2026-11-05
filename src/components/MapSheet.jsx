import { useEffect } from "react";
import { PLOT_FILL, elementCenter, imageToSheet, rotationDegrees } from "../map/geometry";

function svgRotation(element, frame) {
  const degrees = rotationDegrees(element);
  if (!degrees || element.shape === "polyline") return undefined;
  const center = elementCenter(element);
  const sheet = imageToSheet(center, frame);
  return `rotate(${degrees} ${sheet.x * 1000} ${sheet.y * 1000})`;
}

function sheetBox(element, frame) {
  if (element.shape === "rect" || !element.points?.length) {
    const origin = imageToSheet({ x: element.x, y: element.y }, frame);
    return { x: origin.x * 1000, y: origin.y * 1000, w: element.w * frame.w * 1000, h: element.h * frame.h * 1000 };
  }
  return null;
}

function pointString(element, frame) {
  return element.points
    .map((point) => {
      const sheet = imageToSheet(point, frame);
      return `${sheet.x * 1000},${sheet.y * 1000}`;
    })
    .join(" ");
}

function plotStatus(element, plotsById) {
  if (element.type !== "plot" || !element.refId) return "";
  return plotsById[element.refId]?.status || "";
}

function labelOf(element, plotsById) {
  if (element.type === "plot") {
    const plot = plotsById[element.refId];
    return plot?.lot || element.name || "Plot";
  }
  if (element.type === "road") return "";
  return element.name || element.code || "";
}

export function MapSheet({
  sheetRef,
  stageRef,
  background,
  elements,
  imageUrl,
  showImage,
  imageOpacity = 1,
  plotsById = {},
  selectedId = "",
  destinationPlotId = "",
  zoom = 1,
  pan = { x: 0, y: 0 },
  onZoom,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDropImage,
  overlay = null,
  label = "Cemetery map",
  destinationLabel = "Destination",
  statusLabel = (status) => status,
}) {
  useEffect(() => {
    const node = stageRef?.current;
    if (!node || !onZoom) return undefined;
    function onWheel(event) {
      event.preventDefault();
      const next = event.deltaY < 0 ? zoom * 1.08 : zoom / 1.08;
      onZoom(Math.min(4, Math.max(0.45, next)));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onZoom, stageRef, zoom]);

  const frame = background || { x: 0, y: 0, w: 1, h: 1 };

  return (
    <div
      ref={stageRef}
      className="builder-stage"
      role="application"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDragOver={(event) => {
        if (!onDropImage) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        if (!onDropImage) return;
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) onDropImage(file);
      }}
    >
      <div className="builder-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <div className="builder-sheet" ref={sheetRef}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              draggable="false"
              style={{
                left: `${frame.x * 100}%`,
                top: `${frame.y * 100}%`,
                width: `${frame.w * 100}%`,
                height: `${frame.h * 100}%`,
                opacity: showImage ? imageOpacity : 0,
              }}
            />
          ) : (
            <div
              className="builder-image-empty"
              style={{
                left: `${frame.x * 100}%`,
                top: `${frame.y * 100}%`,
                width: `${frame.w * 100}%`,
                height: `${frame.h * 100}%`,
              }}
            />
          )}
          <svg className="builder-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {elements.map((element) => {
              const selected = element.id === selectedId;
              const destination = element.type === "plot" && element.refId && element.refId === destinationPlotId;
              const status = plotStatus(element, plotsById);
              const text = labelOf(element, plotsById);
              const center = imageToSheet(elementCenter(element), frame);
              const fill = element.type === "plot" ? PLOT_FILL[status] || "#f4f7f4" : element.color || "#245B48";
              const textFill = status === "occupied" ? "#f8f9f6" : "#242B27";
              if (element.shape === "polyline") {
                return (
                  <polyline
                    key={element.id}
                    points={pointString(element, frame)}
                    fill="none"
                    stroke={selected ? "#C7A66A" : "#cfc6b6"}
                    strokeWidth={selected ? 18 : 14}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                );
              }
              if (element.shape === "polygon") {
                return (
                  <g key={element.id} transform={svgRotation(element, frame)}>
                    <polygon
                      points={pointString(element, frame)}
                      fill={fill}
                      fillOpacity={element.type === "plot" ? 0.92 : 0.28}
                      stroke={destination || selected ? "#C7A66A" : fill}
                      strokeWidth={destination ? 8 : 3}
                    />
                    {text ? (
                      <text x={center.x * 1000} y={center.y * 1000} textAnchor="middle" fontSize="18" fontWeight="700" fill="#242B27">
                        {text}
                      </text>
                    ) : null}
                  </g>
                );
              }
              const box = sheetBox(element, frame);
              if (!box) return null;
              return (
                <g key={element.id} className={destination ? "pulse" : undefined} transform={svgRotation(element, frame)}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={element.type === "landmark" || element.type === "entrance" ? 18 : 6}
                    fill={fill}
                    fillOpacity={element.type === "plot" ? 0.95 : 0.28}
                    stroke={destination || selected ? "#C7A66A" : element.type === "block" ? "#5c7564" : fill}
                    strokeWidth={destination ? 8 : selected ? 5 : 3}
                    strokeDasharray={element.type === "block" ? "10 6" : undefined}
                  />
                  {text ? (
                    <text x={center.x * 1000} y={center.y * 1000 - (status ? 6 : 0)} textAnchor="middle" fontSize="16" fontWeight="700" fill={textFill}>
                      {text}
                    </text>
                  ) : null}
                  {status ? (
                    <text x={center.x * 1000} y={center.y * 1000 + 16} textAnchor="middle" fontSize="12" fontWeight="650" fill={textFill}>
                      {statusLabel(status)}
                    </text>
                  ) : null}
                  {destination ? (
                    <text x={center.x * 1000} y={box.y - 8} textAnchor="middle" fontSize="14" fontWeight="750" fill="#7a5e2a">
                      {destinationLabel}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {overlay}
        </div>
      </div>
    </div>
  );
}
