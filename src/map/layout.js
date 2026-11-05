const SECTION_W = 520;
const SECTION_H = 430;
const GAP_X = 110;
const GAP_Y = 100;
const ORIGIN_X = 80;
const ORIGIN_Y = 100;

export function buildLayout(sections, blocks, plots) {
  const cols = 2;
  const sectionFrames = sections.map((section, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = ORIGIN_X + col * (SECTION_W + GAP_X);
    const y = ORIGIN_Y + row * (SECTION_H + GAP_Y);
    return { ...section, x, y, w: SECTION_W, h: SECTION_H, col, row };
  });

  const rowCount = Math.max(1, Math.ceil(Math.max(sections.length, 1) / cols));
  const width = ORIGIN_X * 2 + cols * SECTION_W + (cols - 1) * GAP_X;
  const height = ORIGIN_Y + rowCount * SECTION_H + Math.max(0, rowCount - 1) * GAP_Y + 160;
  const centerRoadX = ORIGIN_X + SECTION_W + GAP_X / 2;
  const entrance = { x: width / 2, y: height - 58 };
  const pavilion = { x: width / 2 - 78, y: 22, w: 156, h: 44 };
  const fountain = { x: 78, y: height - 108 };

  const roads = [
    {
      x: centerRoadX - 28,
      y: 72,
      w: 56,
      h: Math.max(80, entrance.y - 72),
      rx: 28,
    },
  ];

  for (let row = 0; row < rowCount - 1; row += 1) {
    const y = ORIGIN_Y + (row + 1) * SECTION_H + row * GAP_Y + (GAP_Y - 46) / 2;
    roads.push({ x: 46, y, w: width - 92, h: 46, rx: 23 });
  }

  const blockFrames = [];
  const plotFrames = [];

  sectionFrames.forEach((section) => {
    const sectionBlocks = blocks.filter((block) => block.sectionId === section.id);
    const pad = 16;
    const labelH = 36;
    const innerX = section.x + pad;
    const innerY = section.y + labelH;
    const innerW = section.w - pad * 2;
    const innerH = section.h - labelH - pad;
    const blockCols = 2;
    const blockRows = Math.max(1, Math.ceil(sectionBlocks.length / blockCols));
    const gap = 10;
    const blockWidth = (innerW - gap * (blockCols - 1)) / blockCols;
    const blockHeight = (innerH - gap * (blockRows - 1)) / blockRows;

    sectionBlocks.forEach((block, index) => {
      const col = index % blockCols;
      const row = Math.floor(index / blockCols);
      const x = innerX + col * (blockWidth + gap);
      const y = innerY + row * (blockHeight + gap);
      const frame = {
        ...block,
        x,
        y,
        w: blockWidth,
        h: blockHeight,
        cx: x + blockWidth / 2,
        cy: y + blockHeight / 2,
        sectionCol: section.col,
        sectionRow: section.row,
      };
      blockFrames.push(frame);

      const blockPlots = plots
        .filter((plot) => plot.blockId === block.id)
        .slice()
        .sort((a, b) => a.lot.localeCompare(b.lot, undefined, { numeric: true }));

      const plotPad = 7;
      const plotLabel = 18;
      const areaX = x + plotPad;
      const areaY = y + plotLabel;
      const areaW = blockWidth - plotPad * 2;
      const areaH = Math.max(12, blockHeight - plotLabel - plotPad);
      const plotCols = 6;
      const plotRows = Math.max(1, Math.ceil(blockPlots.length / plotCols));
      const plotGap = 2;
      const plotWidth = blockPlots.length
        ? (areaW - plotGap * (plotCols - 1)) / plotCols
        : 0;
      const plotHeight = blockPlots.length
        ? (areaH - plotGap * (plotRows - 1)) / plotRows
        : 0;

      blockPlots.forEach((plot, plotIndex) => {
        const colIndex = plotIndex % plotCols;
        const rowIndex = Math.floor(plotIndex / plotCols);
        const px = areaX + colIndex * (plotWidth + plotGap);
        const py = areaY + rowIndex * (plotHeight + plotGap);
        plotFrames.push({
          ...plot,
          x: px,
          y: py,
          w: plotWidth,
          h: plotHeight,
          cx: px + plotWidth / 2,
          cy: py + plotHeight / 2,
          sectionCol: section.col,
          sectionRow: section.row,
          blockLabel: block.label,
          sectionName: section.name,
        });
      });
    });
  });

  return {
    width,
    height,
    centerRoadX,
    entrance,
    pavilion,
    fountain,
    roads,
    sections: sectionFrames,
    blocks: blockFrames,
    plots: plotFrames,
    shrubs: shrubPositions(width, height, entrance),
  };
}

function shrubPositions(width, height, entrance) {
  const spots = [];
  for (let x = 48; x < width - 30; x += 74) {
    spots.push([x, 40], [x + 18, height - 34]);
  }
  return spots.filter(([x, y]) => {
    const nearEntrance = Math.abs(x - entrance.x) < 120 && y > height - 90;
    const nearPavilion = Math.abs(x - width / 2) < 110 && y < 80;
    return !nearEntrance && !nearPavilion;
  });
}

export function routeToPlot(layout, plotId) {
  const plot = layout.plots.find((item) => item.id === plotId);
  if (!plot) return null;
  const section = layout.sections.find((item) => item.id === plot.sectionId);
  if (!section) return null;
  const sectionMidY = section.y + section.h / 2;
  const sideX = section.col === 0 ? section.x + section.w + 10 : section.x - 10;
  const points = [
    { x: layout.entrance.x, y: layout.entrance.y },
    { x: layout.centerRoadX, y: layout.entrance.y - 8 },
    { x: layout.centerRoadX, y: sectionMidY },
    { x: sideX, y: sectionMidY },
    { x: plot.cx, y: sectionMidY },
    { x: plot.cx, y: plot.cy },
  ];
  return { plot, section, points };
}

export function estimateWalk(plotFrame) {
  const meters = 110 + plotFrame.sectionRow * 60 + Number(plotFrame.blockLabel || 1) * 7;
  const minutes = Math.max(2, Math.round(meters / 65));
  return { meters, minutes };
}
