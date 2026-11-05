import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/LanguageContext";
import { buildLayout, routeToPlot } from "../map/layout";
import { PLOT_STATUS_LABEL } from "../lib/records";
import { Button } from "./ui";

function pointsToString(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function CemeteryMap({
  sections,
  blocks,
  plots,
  destinationPlotId = "",
  selectedPlotId = "",
  occupantNames = {},
  showPath = false,
  navStep = 3,
  showNumbers = true,
  onSelectPlot,
  onSelectSection,
  onSelectBlock,
  focusToken = 0,
  focusPlotId = "",
}) {
  const { t } = useI18n();
  const layout = useMemo(() => buildLayout(sections, blocks, plots), [sections, blocks, plots]);
  const viewportRef = useRef(null);
  const layoutRef = useRef(layout);
  const focusRef = useRef(focusPlotId);
  const userMoved = useRef(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const [view, setView] = useState({ x: 20, y: 20, k: 0.6 });
  layoutRef.current = layout;
  focusRef.current = focusPlotId;

  function fitTo(plot) {
    const element = viewportRef.current;
    const currentLayout = layoutRef.current;
    if (!element || !currentLayout) return;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return;
    if (!plot) {
      const scale = Math.min(width / currentLayout.width, height / currentLayout.height) * 0.94;
      setView({
        k: scale,
        x: (width - currentLayout.width * scale) / 2,
        y: (height - currentLayout.height * scale) / 2,
      });
      return;
    }
    const scale = Math.min(3.4, Math.max(1.7, Math.min(width, height) / 300));
    setView({
      k: scale,
      x: width / 2 - plot.cx * scale,
      y: height / 2 - plot.cy * scale,
    });
  }

  useEffect(() => {
    userMoved.current = false;
    const element = viewportRef.current;
    if (!element) return undefined;
    const apply = () => {
      if (userMoved.current) return;
      const plot = layoutRef.current.plots.find((item) => item.id === focusRef.current);
      fitTo(plot || null);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, [focusToken, layout.width, layout.height]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      userMoved.current = true;
      const rect = element.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      setView((current) => {
        const next = Math.min(5, Math.max(0.35, current.k * (event.deltaY < 0 ? 1.08 : 0.92)));
        const worldX = (mx - current.x) / current.k;
        const worldY = (my - current.y) / current.k;
        return { k: next, x: mx - worldX * next, y: my - worldY * next };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  function pan(dx, dy) {
    userMoved.current = true;
    setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
  }

  function zoomBy(factor) {
    const element = viewportRef.current;
    if (!element) return;
    userMoved.current = true;
    const mx = element.clientWidth / 2;
    const my = element.clientHeight / 2;
    setView((current) => {
      const next = Math.min(5, Math.max(0.35, current.k * factor));
      const worldX = (mx - current.x) / current.k;
      const worldY = (my - current.y) / current.k;
      return { k: next, x: mx - worldX * next, y: my - worldY * next };
    });
  }

  function resetView() {
    userMoved.current = false;
    const plot = layout.plots.find((item) => item.id === (focusPlotId || destinationPlotId));
    fitTo(plot || null);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowUp") pan(0, 48);
    if (event.key === "ArrowDown") pan(0, -48);
    if (event.key === "ArrowLeft") pan(48, 0);
    if (event.key === "ArrowRight") pan(-48, 0);
    if (event.key === "+" || event.key === "=") zoomBy(1.15);
    if (event.key === "-" || event.key === "_") zoomBy(0.87);
    if (event.key === "Home" || event.key === "0") resetView();
  }

  const route = showPath ? routeToPlot(layout, destinationPlotId) : null;
  const cutIndex = [1, 2, 4, 5][Math.max(0, Math.min(3, navStep))] ?? 5;
  const walked = route ? route.points.slice(0, cutIndex + 1) : [];

  return (
    <div className="map-stage">
      <div className="map-toolbar" role="group" aria-label={t("Map controls")}>
        <Button variant="secondary" onClick={() => pan(0, 60)}>{t("Up")}</Button>
        <Button variant="secondary" onClick={() => pan(0, -60)}>{t("Down")}</Button>
        <Button variant="secondary" onClick={() => pan(60, 0)}>{t("Left")}</Button>
        <Button variant="secondary" onClick={() => pan(-60, 0)}>{t("Right")}</Button>
        <Button variant="secondary" onClick={() => zoomBy(1.2)}>{t("Zoom in")}</Button>
        <Button variant="secondary" onClick={() => zoomBy(0.84)}>{t("Zoom out")}</Button>
        <Button variant="secondary" onClick={resetView}>{t("Reset view")}</Button>
      </div>
      <div className="map-viewport" ref={viewportRef}>
        <svg
          className="map-svg"
          role="application"
          tabIndex={0}
          aria-label={t("Illustrated cemetery plan. Drag to move. Arrow keys also pan the plan.")}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            drag.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              vx: view.x,
              vy: view.y,
              moved: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || drag.current.id !== event.pointerId) return;
            const dx = event.clientX - drag.current.x;
            const dy = event.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
            userMoved.current = true;
            setView((current) => ({ ...current, x: drag.current.vx + dx, y: drag.current.vy + dy }));
          }}
          onPointerUp={() => {
            suppressClick.current = Boolean(drag.current?.moved);
            drag.current = null;
          }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <rect width={layout.width} height={layout.height} rx="36" fill="#e4f0e6" />
            <rect x="16" y="16" width={layout.width - 32} height={layout.height - 32} rx="28" fill="none" stroke="#245B48" strokeWidth="3" />
            {layout.roads.map((road) => (
              <rect key={`${road.x}-${road.y}`} x={road.x} y={road.y} width={road.w} height={road.h} rx={road.rx} fill="#f7f4ee" stroke="#e3d9c8" />
            ))}
            <line
              x1={layout.centerRoadX}
              y1={90}
              x2={layout.centerRoadX}
              y2={layout.entrance.y - 16}
              stroke="#c7a66a"
              strokeWidth="2"
              strokeDasharray="7 9"
            />
            {layout.shrubs.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="9" fill="#7f9a78" />
            ))}
            <g>
              <rect x={layout.pavilion.x} y={layout.pavilion.y} width={layout.pavilion.w} height={layout.pavilion.h} rx="10" fill="#ffffff" stroke="#245B48" />
              <text x={layout.width / 2} y={layout.pavilion.y + 28} textAnchor="middle" fontSize="13" fontWeight="700" fill="#245B48">
                {t("Visitor Pavilion")}
              </text>
            </g>
            <g>
              <circle cx={layout.fountain.x} cy={layout.fountain.y} r="18" fill="#d9ebf2" stroke="#1f4e78" />
              <text x={layout.fountain.x} y={layout.fountain.y + 34} textAnchor="middle" fontSize="11" fill="#1f4e78">
                {t("Fountain")}
              </text>
            </g>
            <g>
              <rect x={layout.entrance.x - 74} y={layout.entrance.y - 18} width="148" height="46" rx="8" fill="#245B48" />
              <text x={layout.entrance.x} y={layout.entrance.y + 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff">
                {t("Main Entrance")}
              </text>
            </g>
            {layout.sections.map((section) => (
              <g key={section.id}>
                <rect
                  x={section.x}
                  y={section.y}
                  width={section.w}
                  height={section.h}
                  rx="16"
                  fill="#f7fbf8"
                  stroke="#c5d1c4"
                  onClick={() => {
                  if (suppressClick.current) return;
                  onSelectSection?.(section.id);
                }}
                />
                <text x={section.x + 16} y={section.y + 24} fontSize="16" fontWeight="700" fill="#245B48">
                  {section.name}
                </text>
              </g>
            ))}
            {layout.blocks.map((block) => (
              <g key={block.id} onClick={() => {
                if (suppressClick.current) return;
                onSelectBlock?.(block.id);
              }}>
                <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="8" fill="#ffffff" stroke="#d5ddd4" />
                <text x={block.x + 8} y={block.y + 14} fontSize="11" fontWeight="700" fill="#55605A">
                  {t("Block {label}", { label: block.label })}
                </text>
              </g>
            ))}
            {route ? (
              <polyline
                points={pointsToString(route.points)}
                fill="none"
                stroke="#c7a66a"
                strokeWidth="8"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.45"
              />
            ) : null}
            {walked.length > 1 ? (
              <polyline
                points={pointsToString(walked)}
                fill="none"
                stroke="#245B48"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {layout.plots.map((plot) => {
              const destination = plot.id === destinationPlotId;
              const selected = plot.id === selectedPlotId;
              const names = occupantNames[plot.id] || [];
              const expose = destination || selected;
              const label = [
                t("Lot {lot}", { lot: plot.lot }),
                t(PLOT_STATUS_LABEL[plot.status] || plot.status),
                destination ? t("Highlighted destination") : "",
                names.length ? names.join(", ") : "",
              ].filter(Boolean).join(", ");
              const fill = destination ? "#c7a66a" : plot.status === "occupied" ? "#245B48" : plot.status === "reserved" ? "#e7d3a1" : "#f7fbf8";
              const stroke = selected ? "#242B27" : destination ? "#1b4536" : plot.status === "available" ? "#7d9a84" : "#1b4536";
              const textFill = plot.status === "occupied" && !destination ? "#ffffff" : "#242B27";
              return (
                <g key={plot.id}>
                  {destination ? (
                    <circle className="pulse" cx={plot.cx} cy={plot.cy} r={Math.max(plot.w, plot.h) + 8} fill="none" stroke="#c7a66a" strokeWidth="3" />
                  ) : null}
                  <rect
                    x={plot.x}
                    y={plot.y}
                    width={Math.max(plot.w, 1)}
                    height={Math.max(plot.h, 1)}
                    rx="2"
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={selected || destination ? 2 : 1}
                    aria-hidden={expose ? undefined : true}
                    role={expose ? "img" : undefined}
                    aria-label={expose ? label : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (suppressClick.current) return;
                      onSelectPlot?.(plot.id);
                    }}
                  />
                  {plot.status === "reserved" ? (
                    <line x1={plot.x + 2} y1={plot.y + plot.h - 2} x2={plot.x + plot.w - 2} y2={plot.y + 2} stroke="#7a5e2a" strokeWidth="1" />
                  ) : null}
                  {showNumbers && view.k > 1.35 && plot.h > 8 ? (
                    <text
                      x={plot.cx}
                      y={plot.cy + 3}
                      textAnchor="middle"
                      fontSize={Math.min(10, plot.h * 0.55)}
                      fill={textFill}
                      pointerEvents="none"
                    >
                      {plot.lot}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {showPath ? (
              <g>
                <circle cx={layout.entrance.x} cy={layout.entrance.y - 34} r="8" fill="#1f4e78" />
                <text x={layout.entrance.x} y={layout.entrance.y - 46} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f4e78">
                  {t("Start")}
                </text>
              </g>
            ) : null}
          </g>
        </svg>
        <p className="map-note">{t("Illustrated plan. Not to scale.")}</p>
      </div>
      <ul className="legend">
        <li><span className="swatch swatch-available" aria-hidden="true" />{t("Available")}</li>
        <li><span className="swatch swatch-occupied" aria-hidden="true" />{t("Occupied")}</li>
        <li><span className="swatch swatch-reserved" aria-hidden="true" />{t("Reserved")}</li>
        <li><span className="swatch swatch-destination" aria-hidden="true" />{t("Destination")}</li>
      </ul>
    </div>
  );
}
